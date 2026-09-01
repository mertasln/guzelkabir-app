"use client";

import Link from "next/link";
import { CurrencyToggle } from "./CurrencyToggle";
import { BrandMark } from "./icons";
import { useAuth } from "@/lib/auth";

const HOME_NAV = [
  { href: "/#nasil", label: "Nasıl çalışır" },
  { href: "/#seffaflik", label: "Şeffaflık" },
  { href: "/#paketler", label: "Paketler" },
  { href: "/#mezarliklar", label: "Mezarlıklar" },
  { href: "/#sss", label: "S.S.S." },
];

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="GüzelKabir ana sayfa">
      <span className="mark" aria-hidden="true">
        <BrandMark />
      </span>
      GüzelKabir
    </Link>
  );
}

// "panel" varyantı bilerek "Murat Y." ile hardcoded bırakıldı — panel/page.tsx'i
// gerçek oturuma bağlamak ADIM 5'in kapsamı dışında (yalnızca sipariş sihirbazı
// bağlandı), bkz. CLAUDE.md "Frontend wiring" notu.
function AuthIndicator() {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <Link href="/giris" className="btn btn-ghost nav-cta">
        Giriş Yap
      </Link>
    );
  }

  return (
    <span className="user-chip">
      <span className="ava">{(user.fullName ?? "?").charAt(0).toUpperCase()}</span>
      <span className="uname">{user.fullName ?? "Hesabım"}</span>
      <button type="button" className="btn btn-quiet" style={{ marginLeft: 8 }} onClick={logout}>
        Çıkış
      </button>
    </span>
  );
}

export function Topbar({ variant }: { variant: "home" | "flow" | "panel" }) {
  return (
    <header className="topbar">
      <div className="wrap topbar-inner">
        <Brand />

        {variant === "home" && (
          <nav className="nav">
            {HOME_NAV.map((n) => (
              <Link key={n.href} href={n.href}>
                {n.label}
              </Link>
            ))}
          </nav>
        )}

        {variant === "panel" && (
          <nav className="nav">
            <Link href="/panel" style={{ color: "var(--ink)" }}>
              Panelim
            </Link>
            <Link href="/siparis">Yeni bakım</Link>
          </nav>
        )}

        <div className="topbar-actions">
          <CurrencyToggle />

          {variant === "home" && (
            <>
              <AuthIndicator />
              <Link href="/siparis" className="btn btn-primary nav-cta">
                Kabir Bakımı Başlat
              </Link>
            </>
          )}

          {variant === "flow" && (
            <>
              <AuthIndicator />
              <Link href="/" className="btn btn-ghost nav-cta">
                ← Ana sayfa
              </Link>
            </>
          )}

          {variant === "panel" && (
            <span className="user-chip">
              <span className="ava">M</span>
              <span className="uname">Murat Y.</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
