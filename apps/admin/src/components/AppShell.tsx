import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

// spec §11.1'in 7 modülü — Sipariş Yönetimi ve Atama Ekranı AYRI modüller
// (Phase 3'te yanlışlıkla tek nav öğesine birleştirilmişti, Phase 5'te
// düzeltildi — bkz. CLAUDE.md "Admin Panel" bölümü).
const NAV_ITEMS = [
  { to: "/", label: "Panel", end: true },
  { to: "/partnerler", label: "Partner Yönetimi" },
  { to: "/siparisler", label: "Sipariş Yönetimi" },
  { to: "/atama", label: "Atama Ekranı" },
  { to: "/sikayetler", label: "Şikayet Yönetimi" },
  { to: "/kullanicilar", label: "Kullanıcı & Rol Yönetimi" },
  { to: "/mezarliklar", label: "Mezarlık & İzin Yönetimi" },
  { to: "/kpi", label: "KPI Dashboard" },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-64 shrink-0 flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
        <div className="px-4 py-5 text-lg font-semibold">GüzelKabir Admin</div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-white/10 font-medium" : "text-white/70 hover:bg-white/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4 text-sm">
          <p className="mb-2 truncate text-white/80">{user?.fullName ?? "Hesabım"}</p>
          <Button variant="outline" size="sm" onClick={logout} className="w-full text-[var(--foreground)]">
            Çıkış Yap
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-[var(--muted)] p-6">
        <Outlet />
      </main>
    </div>
  );
}
