"use client";

import { useCurrency } from "@/lib/currency";

export function CurrencyToggle() {
  const { cur, setCur } = useCurrency();
  return (
    <div className="cur-toggle" role="group" aria-label="Para birimi">
      <button className={cur === "try" ? "active" : ""} onClick={() => setCur("try")}>
        ₺ TRY
      </button>
      <button className={cur === "eur" ? "active" : ""} onClick={() => setCur("eur")}>
        € EUR
      </button>
    </div>
  );
}
