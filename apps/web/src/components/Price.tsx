"use client";

import { useCurrency } from "@/lib/currency";

/** Seçili para birimine göre tutar gösterir (₺ / €). */
export function Price({ amount }: { amount: { try: number; eur: number } }) {
  const { fmt } = useCurrency();
  return <>{fmt(amount)}</>;
}
