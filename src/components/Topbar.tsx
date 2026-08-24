"use client";

import Link from "next/link";
import { CurrencyToggle } from "./CurrencyToggle";
import { BrandMark } from "./icons";

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
            <Link href="/siparis" className="btn btn-primary nav-cta">
              Kabir Bakımı Başlat
            </Link>
          )}

          {variant === "flow" && (
            <Link href="/" className="btn btn-ghost nav-cta">
              ← Ana sayfa
            </Link>
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
