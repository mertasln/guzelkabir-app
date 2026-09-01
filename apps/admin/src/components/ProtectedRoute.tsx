import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { ADMIN_PANEL_ROLES, useAuth } from "@/lib/auth";

// spec §6.1: yalnızca ops_manager/support_agent/admin. Geçerli bir JWT'ye
// sahip ama bu üç rolden birine sahip olmayan biri (örn. customer/field_partner
// yanlışlıkla buraya gelirse) de reddedilir — sadece "giriş yapılmış mı" yeterli
// değil.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="p-4 text-sm text-[var(--muted-foreground)]">Yükleniyor…</p>;
  }
  if (!user) {
    return <Navigate to="/giris" replace />;
  }
  if (!ADMIN_PANEL_ROLES.includes(user.role as (typeof ADMIN_PANEL_ROLES)[number])) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <p className="text-sm text-[var(--destructive)]">
          Bu panele erişim yetkiniz yok.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
