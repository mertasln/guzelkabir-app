import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest, onAccessTokenChange, refreshAccessToken, setAccessToken } from "./api";

export type UserRole = "customer" | "field_partner" | "ops_manager" | "support_agent" | "admin";

// spec §6.1: Admin Panel'e yalnızca bu üç rol girebilir. Diğer roller (JWT
// geçerli olsa bile) ProtectedRoute tarafından reddedilir — bkz. o dosya.
export const ADMIN_PANEL_ROLES = ["ops_manager", "support_agent", "admin"] as const;
export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number];

// apps/web/apps/field-pwa ile aynı desen (bkz. o dosyaların yorumu): JWT
// yalnızca {sub, role} taşıyor, GET /users/me tam profili doğrular.
export type CurrentUser = {
  sub: string;
  role: UserRole;
  fullName?: string;
};

type AuthCtx = {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
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

type MeResponse = { fullName: string };

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
      setUser((prev) => (prev?.sub === decoded.sub ? prev : decoded));
      apiRequest<MeResponse>("/users/me")
        .then((me) => {
          setUser((prev) =>
            prev && prev.sub === decoded.sub ? { ...prev, fullName: me.fullName } : prev,
          );
        })
        .catch(() => {
          // sessizce yok say — oturum geçerliliğini etkilemez
        });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
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

  const logout = useCallback(() => {
    setAccessToken(null);
  }, []);

  return <Ctx.Provider value={{ user, isLoading, login, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
