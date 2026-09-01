import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className="p-4 text-sm text-[var(--muted-foreground)]">Yükleniyor…</p>;
  }
  if (!user) {
    return <Navigate to="/giris" replace />;
  }
  return <>{children}</>;
}
