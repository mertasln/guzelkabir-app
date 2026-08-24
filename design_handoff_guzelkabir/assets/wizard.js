/* ===========================================================
   GüzelKabir — Sipariş akışı mantığı
   =========================================================== */
(function () {
  "use strict";

  /* ---------- veri ---------- */
  const PLANS = {
    tek:    { name: "Tek Seferlik",   try: 850,  eur: 25,  unit: "tek sefer" },
    aylik:  { name: "Aylık Abonelik", try: 1200, eur: 35,  unit: "/ ay" },
    yillik: { name: "Yıllık Premium", try: 9500, eur: 280, unit: "/ yıl" },
  };
  const FLOWER = { try: 250, eur: 8 };
  const CEM_ROLE = {
    Zincirlikuyu: "Premium itina",
    Karacaahmet: "Büyük ölçek",
    Edirnekapı: "Manevi miras",
    Eyüpsultan: "Yüksek manevi trafik",
  };

  const state = {
    step: 0,
    cur: localStorage.getItem("gk-cur") || "try",
    cemetery: null,
    ada: "", parsel: "",
    helpNeeded: false,
    plan: "aylik",
    flower: false,
    deceased: "",
  };

  const panels = [...document.querySelectorAll(".step-panel")];
  const nodes  = [...document.querySelectorAll(".stepper .node")];
  const bars   = [...document.querySelectorAll(".stepper .bar")];
  const TOTAL = panels.length;

  function fmt(n, cur) {
    if (cur === "eur") return "€" + n;
    return "₺" + n.toLocaleString("tr-TR");
  }

  /* ---------- para birimi ---------- */
  function setCur(c) {
    state.cur = c; localStorage.setItem("gk-cur", c);
    document.querySelectorAll("[data-cur]").forEach((b) => b.classList.toggle("active", b.dataset.cur === c));
    renderPrices();
    renderSummary();
  }
  document.querySelectorAll("[data-cur]").forEach((b) => b.addEventListener("click", () => setCur(b.dataset.cur)));

  function renderPrices() {
    Object.keys(PLANS).forEach((k) => {
      const el = document.querySelector(`.ppick[data-plan="${k}"] .a`);
      if (el) el.textContent = fmt(PLANS[k][state.cur], state.cur);
    });
    const fa = document.querySelector(".addon .a-price");
    if (fa) fa.textContent = "+ " + fmt(FLOWER[state.cur], state.cur);
  }

  /* ---------- adım gösterimi ---------- */
  function showStep(i) {
    state.step = i;
    panels.forEach((p, idx) => p.classList.toggle("active", idx === i));
    nodes.forEach((n, idx) => {
      n.classList.toggle("active", idx === i);
      n.classList.toggle("done", idx < i);
    });
    bars.forEach((b, idx) => b.classList.toggle("done", idx < i));
    window.scrollTo({ top: 0, behavior: "smooth" });
    localStorage.setItem("gk-flow-step", i);
  }

  /* ---------- doğrulama ---------- */
  function validate(i) {
    let ok = true;
    if (i === 0) {
      if (state.helpNeeded) return true; // yardım yolu: ada/parsel zorunlu değil
      if (!state.cemetery) { flag("cem-err"); ok = false; }
      const ada = document.getElementById("ada");
      const parsel = document.getElementById("parsel");
      if (!ada.value.trim()) { mark(ada); ok = false; } else unmark(ada);
      if (!parsel.value.trim()) { mark(parsel); ok = false; } else unmark(parsel);
    }
    if (i === 2) {
      const ad = document.getElementById("deceased");
      const dt = document.getElementById("death-date");
      if (!ad.value.trim()) { mark(ad); ok = false; } else unmark(ad);
      if (!dt.value) { mark(dt); ok = false; } else unmark(dt);
    }
    if (i === 3) {
      ["card-name", "card-no", "card-exp", "card-cvc"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el.value.trim()) { mark(el); ok = false; } else unmark(el);
      });
    }
    return ok;
  }
  function mark(el) { el.classList.add("invalid"); el.closest(".field")?.classList.add("show-err"); }
  function unmark(el) { el.classList.remove("invalid"); el.closest(".field")?.classList.remove("show-err"); }
  function flag(id) { document.getElementById(id)?.classList.add("show"); }

  /* ---------- navigasyon ---------- */
  document.querySelectorAll("[data-next]").forEach((b) => b.addEventListener("click", () => {
    if (!validate(state.step)) return;
    if (state.step < TOTAL - 1) showStep(state.step + 1);
  }));
  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", () => {
    if (state.step > 0) showStep(state.step - 1);
  }));

  /* ---------- Adım 1: konum ---------- */
  document.querySelectorAll("input[name='cemetery']").forEach((r) => {
    r.addEventListener("change", () => {
      state.cemetery = r.value;
      document.getElementById("cem-err")?.classList.remove("show");
      renderSummary();
    });
  });
  const helpChk = document.getElementById("help-needed");
  helpChk.addEventListener("change", () => {
    state.helpNeeded = helpChk.checked;
    document.querySelector(".flow-fieldset").classList.toggle("help-on", helpChk.checked);
    document.getElementById("help-fields").classList.toggle("open", helpChk.checked);
    renderSummary();
  });
  ["ada", "parsel"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => { state[id] = el.value; unmark(el); renderSummary(); });
  });

  /* ---------- Adım 2: paket ---------- */
  document.querySelectorAll("input[name='plan']").forEach((r) => {
    r.addEventListener("change", () => { state.plan = r.value; renderSummary(); });
  });
  const flowerChk = document.getElementById("flower");
  flowerChk.addEventListener("change", () => { state.flower = flowerChk.checked; renderSummary(); });

  /* ---------- Adım 3: merhum ---------- */
  document.getElementById("deceased").addEventListener("input", (e) => { state.deceased = e.target.value; renderSummary(); });

  /* ---------- ödeme segment ---------- */
  document.querySelectorAll(".seg button").forEach((b) => {
    b.addEventListener("click", () => {
      b.parentElement.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
    });
  });

  /* ---------- özet ---------- */
  function renderSummary() {
    const cemEl = document.getElementById("sum-cem");
    const locEl = document.getElementById("sum-loc");
    const planEl = document.getElementById("sum-plan");
    const decEl = document.getElementById("sum-dec");
    const flowerRow = document.getElementById("sum-flower-row");
    const totalEl = document.getElementById("sum-total");
    const planUnitEl = document.getElementById("sum-plan-unit");

    if (cemEl) {
      cemEl.textContent = state.cemetery || (state.helpNeeded ? "Ekip tespit edecek" : "—");
      cemEl.classList.toggle("empty", !state.cemetery);
    }
    if (locEl) {
      const loc = state.helpNeeded ? "Yardım istendi" : (state.ada || state.parsel ? `Ada ${state.ada || "—"} / Parsel ${state.parsel || "—"}` : "—");
      locEl.textContent = loc;
      locEl.classList.toggle("empty", !state.helpNeeded && !state.ada && !state.parsel);
    }
    const p = PLANS[state.plan];
    if (planEl) planEl.textContent = p.name;
    if (planUnitEl) planUnitEl.textContent = p.unit;
    if (decEl) { decEl.textContent = state.deceased || "—"; decEl.classList.toggle("empty", !state.deceased); }

    let total = p[state.cur];
    if (flowerRow) {
      flowerRow.style.display = state.flower ? "flex" : "none";
      const fv = flowerRow.querySelector(".v");
      if (fv) fv.textContent = "+ " + fmt(FLOWER[state.cur], state.cur);
      if (state.flower) total += FLOWER[state.cur];
    }
    if (totalEl) totalEl.textContent = fmt(total, state.cur);

    // onay ekranı özeti
    const cc = document.getElementById("confirm-cem");
    if (cc) cc.textContent = state.cemetery || "İstanbul";
    const cp = document.getElementById("confirm-plan");
    if (cp) cp.textContent = p.name;
  }

  /* ---------- başlangıç ---------- */
  renderPrices();
  setCur(state.cur);
  renderSummary();
  showStep(0);
})();
