/* ===========================================================
   GüzelKabir — etkileşim
   =========================================================== */
(function () {
  "use strict";
  const root = document.documentElement;

  /* ---------- Yön anahtarı (A · B · C) ---------- */
  const savedDir = localStorage.getItem("gk-dir") || "c";
  setDir(savedDir);
  document.querySelectorAll("[data-dir]").forEach((b) => {
    b.addEventListener("click", () => setDir(b.dataset.dir));
  });
  function setDir(d) {
    root.setAttribute("data-theme", d);
    localStorage.setItem("gk-dir", d);
    document.querySelectorAll("[data-dir]").forEach((b) => {
      b.classList.toggle("active", b.dataset.dir === d);
    });
  }

  /* ---------- Para birimi ₺ / € ---------- */
  const savedCur = localStorage.getItem("gk-cur") || "try";
  setCur(savedCur);
  document.querySelectorAll("[data-cur]").forEach((b) => {
    b.addEventListener("click", () => setCur(b.dataset.cur));
  });
  function setCur(c) {
    localStorage.setItem("gk-cur", c);
    document.querySelectorAll("[data-cur]").forEach((b) => {
      b.classList.toggle("active", b.dataset.cur === c);
    });
    document.querySelectorAll("[data-try]").forEach((el) => {
      el.textContent = c === "try" ? el.dataset.try : el.dataset.eur;
    });
    document.querySelectorAll("[data-per-try]").forEach((el) => {
      el.textContent = c === "try" ? el.dataset.perTry : el.dataset.perEur;
    });
  }

  /* ---------- Önce / Sonra slider ---------- */
  document.querySelectorAll(".ba").forEach((ba) => {
    const handle = ba.querySelector(".ba-handle");
    let dragging = false;
    const setPos = (clientX) => {
      const r = ba.getBoundingClientRect();
      let p = ((clientX - r.left) / r.width) * 100;
      p = Math.max(4, Math.min(96, p));
      ba.style.setProperty("--pos", p + "%");
    };
    const down = (e) => { dragging = true; setPos((e.touches ? e.touches[0] : e).clientX); e.preventDefault(); };
    const move = (e) => { if (dragging) setPos((e.touches ? e.touches[0] : e).clientX); };
    const up = () => { dragging = false; };
    handle.addEventListener("pointerdown", down);
    ba.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });

  /* ---------- SSS akordeon ---------- */
  document.querySelectorAll(".faq-item").forEach((item) => {
    const q = item.querySelector(".faq-q");
    const a = item.querySelector(".faq-a");
    if (item.classList.contains("open")) {
      requestAnimationFrame(() => { a.style.height = a.firstElementChild.offsetHeight + "px"; });
    }
    q.addEventListener("click", () => {
      const isOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((o) => {
        if (o !== item) { o.classList.remove("open"); o.querySelector(".faq-a").style.height = "0px"; }
      });
      if (isOpen) { item.classList.remove("open"); a.style.height = "0px"; }
      else { item.classList.add("open"); a.style.height = a.firstElementChild.offsetHeight + "px"; }
    });
  });

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
})();
