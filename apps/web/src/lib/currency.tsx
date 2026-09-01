"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Currency = "try" | "eur";

const STORAGE_KEY = "gk-cur";

type CurrencyCtx = {
  cur: Currency;
  setCur: (c: Currency) => void;
  /** Bir tutarı seçili para birimine göre biçimlendirir. */
  fmt: (amount: { try: number; eur: number }) => string;
};

const Ctx = createContext<CurrencyCtx | null>(null);

function format(value: number, cur: Currency): string {
  return cur === "eur" ? "€" + value : "₺" + value.toLocaleString("tr-TR");
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [cur, setCurState] = useState<Currency>("try");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "try" || saved === "eur") setCurState(saved);
  }, []);

  const setCur = useCallback((c: Currency) => {
    setCurState(c);
    localStorage.setItem(STORAGE_KEY, c);
  }, []);

  const fmt = useCallback(
    (amount: { try: number; eur: number }) => format(amount[cur], cur),
    [cur],
  );

  return <Ctx.Provider value={{ cur, setCur, fmt }}>{children}</Ctx.Provider>;
}

export function useCurrency(): CurrencyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
