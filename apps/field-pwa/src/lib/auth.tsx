import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiRequest, onAccessTokenChange, refreshAccessToken, setAccessToken } from "./api";

export type UserRole = "customer" | "field_partner" | "ops_manager" | "support_agent" | "admin";

// apps/web/src/lib/auth.tsx ile aynı desen (bkz. o dosyanın yorumu): JWT
// yalnızca {sub, role} taşıyor, GET /users/me tam profili doğrular.
//
// fieldPartnerId ADIM 8 eklentisi (bkz. apps/api/src/users/users.service.ts
// yorumu) — User.id ile FieldPartner.id AYNI değil, GET /partners/:id/tasks'i
// çağırabilmek için bu PWA'nın kendi FieldPartner.id'sini bilmesi gerekiyor.
export type CurrentUser = {
  sub: string;
  role: UserRole;
  fullName?: string;
  fieldPartnerId?: string | null;
  fieldPartnerStatus?: "onboarding" | "active" | "suspended" | "terminated" | null;
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

type MeResponse = {
  fullName: string;
  fieldPartnerId: string | null;
  fieldPartnerStatus: "onboarding" | "active" | "suspended" | "terminated" | null;
};

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
            prev && prev.sub === decoded.sub
              ? {
                  ...prev,
                  fullName: me.fullName,
                  fieldPartnerId: me.fieldPartnerId,
                  fieldPartnerStatus: me.fieldPartnerStatus,
                }
              : prev,
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
