"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest, getAccessToken, onAccessTokenChange, refreshAccessToken, setAccessToken } from "./api";

export type UserRole = "customer" | "field_partner" | "ops_manager" | "support_agent" | "admin";

// Access token payload'ı yalnızca {sub, role} taşıyor (bkz. apps/api
// src/auth/types/jwt-payload.type.ts). fullName, GET /users/me'den ayrıca
// çekilir (spec §5'in tablosunda yok — spec §6'nın RBAC/auth mimarisinin
// doğal bir tamamlayıcısı olarak eklendi, kullanıcı kararı). Bu sayede tam
// sayfa yenilemesinde de (F5) sunucudan doğrulanmış gerçek ad gösterilir —
// eski "yalnızca kayıt formunda yazılanı anlık oturum için hatırlar" modeli
// her reload'da "Hesabım" placeholder'ına düşüyordu, artık düşmüyor.
export type CurrentUser = { sub: string; role: UserRole; fullName?: string };

type AuthCtx = {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; fullName: string; phone?: string }) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

function decodeAccessToken(token: string): { sub: string; role: UserRole } | null {
  try {
    const [, payloadB64] = token.split(".");
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { sub: string; role: UserRole };
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAccessTokenChange((token) => {
      if (!token) {
        setUser(null);
        return;
      }
      const decoded = decodeAccessToken(token);
      if (!decoded) {
        setUser(null);
        return;
      }
      setUser((prev) => ({ ...decoded, fullName: prev?.sub === decoded.sub ? prev.fullName : undefined }));
      apiRequest<{ fullName: string }>("/users/me")
        .then((me) => {
          setUser((prev) => (prev && prev.sub === decoded.sub ? { ...prev, fullName: me.fullName } : prev));
        })
        .catch(() => {
          // sessizce yok say — fullName olmadan "Hesabım" gösterilir, oturum geçerliliğini etkilemez
        });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Sayfa yenilendiğinde: access token bellekte kaybolur (bilerek — bkz.
    // lib/api.ts), httpOnly refresh cookie'si üzerinden sessizce yenilenir.
    (async () => {
      await refreshAccessToken();
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest<{ accessToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(res.accessToken);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; fullName: string; phone?: string }) => {
      const res = await apiRequest<{ accessToken: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...input, role: "customer", locale: "tr" }),
      });
      setAccessToken(res.accessToken);
      setUser((prev) => (prev ? { ...prev, fullName: input.fullName } : prev));
    },
    [],
  );

  const logout = useCallback(() => {
    setAccessToken(null);
  }, []);

  return <Ctx.Provider value={{ user, isLoading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { getAccessToken };
