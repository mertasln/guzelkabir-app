"use client";

// apps/api'nin taban URL'i. apps/api varsayılan olarak :3001'de, api/v1 önekiyle
// çalışıyor (bkz. apps/api/src/main.ts).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

// spec §5: standart hata zarfı — bkz. apps/api/src/common/filters/http-exception.filter.ts.
export type ApiErrorBody = { error: { code: string; message: string; requestId: string } };

export class ApiError extends Error {
  code: string;
  status: number;
  requestId: string;
  constructor(status: number, body: ApiErrorBody) {
    super(body.error?.message ?? "Bilinmeyen bir hata oluştu.");
    this.code = body.error?.code ?? "UNKNOWN";
    this.status = status;
    this.requestId = body.error?.requestId ?? "";
  }
}

// Access token yalnızca bellekte tutulur (localStorage'da DEĞİL) — XSS'e karşı
// standart pratik. Sayfa yenilendiğinde AuthProvider, httpOnly refresh cookie'si
// üzerinden POST /auth/refresh ile sessizce yeni bir access token alır.
let accessToken: string | null = null;
type TokenListener = (token: string | null) => void;
const listeners = new Set<TokenListener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  listeners.forEach((listener) => listener(token));
}

export function onAccessTokenChange(listener: TokenListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function rawRequest(path: string, options: RequestInit): Promise<Response> {
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // credentials: "include" — refresh cookie'nin gönderilip alınabilmesi için
  // şart (bkz. apps/api CLAUDE.md Auth bölümü: sameSite=lax, CORS_ORIGIN).
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: "include" });
}

let refreshPromise: Promise<string | null> | null = null;

// Eşzamanlı birden fazla 401 aynı anda tek bir refresh çağrısını paylaşsın diye
// (isteklerin her biri kendi refresh'ini tetiklemesin).
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          setAccessToken(null);
          return null;
        }
        const body = (await res.json()) as { accessToken: string };
        setAccessToken(body.accessToken);
        return body.accessToken;
      } catch {
        setAccessToken(null);
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, options);

  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await rawRequest(path, options);
    }
  }

  if (!res.ok) {
    let body: ApiErrorBody;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = { error: { code: "UNKNOWN", message: res.statusText, requestId: "" } };
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
