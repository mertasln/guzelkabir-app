/* ===========================================================
   GüzelKabir — Müşteri paneli mantığı
   =========================================================== */
(function () {
  "use strict";

  /* ---------- para birimi ---------- */
  const savedCur = localStorage.getItem("gk-cur") || "try";
  setCur(savedCur);
  document.querySelectorAll("[data-cur]").forEach((b) => b.addEventListener("click", () => setCur(b.dataset.cur)));
  function setCur(c) {
    localStorage.setItem("gk-cur", c);
    document.querySelectorAll("[data-cur]").forEach((b) => b.classList.toggle("active", b.dataset.cur === c));
    document.querySelectorAll("[data-try]").forEach((el) => { el.textContent = c === "try" ? el.dataset.try : el.dataset.eur; });
  }

  /* ---------- önce/sonra slider (tüm .ba) ---------- */
  function initBA(ba) {
    if (ba.dataset.baInit) return;
    ba.dataset.baInit = "1";
    const handle = ba.querySelector(".ba-handle");
    let dragging = false;
    const setPos = (x) => {
      const r = ba.getBoundingClientRect();
      let p = ((x - r.left) / r.width) * 100;
      p = Math.max(4, Math.min(96, p));
      ba.style.setProperty("--pos", p + "%");
    };
    const down = (e) => { dragging = true; setPos((e.touches ? e.touches[0] : e).clientX); e.preventDefault(); };
    const move = (e) => { if (dragging) setPos((e.touches ? e.touches[0] : e).clientX); };
    if (handle) handle.addEventListener("pointerdown", down);
    ba.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", () => { dragging = false; });
  }
  document.querySelectorAll(".ba").forEach(initBA);

  /* ---------- detay overlay ---------- */
  const overlay = document.getElementById("overlay");
  const ovBA = overlay.querySelector(".ba");
  let pendingCardEl = null;

  function openDetail(data, sourceEl) {
    pendingCardEl = data.status === "wait" ? sourceEl : null;
    overlay.querySelector("#ov-title").textContent = data.cem;
    overlay.querySelector("#ov-loc").textContent = data.loc;
    overlay.querySelector("#ov-coord").textContent = data.coord;
    overlay.querySelector("#ov-when").textContent = data.when;
    overlay.querySelector("#ov-deceased").textContent = data.deceased;
    overlay.querySelector("#ov-usta").textContent = data.usta;
    overlay.querySelector("#ov-usta-avatar").textContent = data.usta.charAt(0);
    overlay.querySelector("#ov-note-text").textContent = data.note;

    const approveBox = overlay.querySelector(".ov-approve");
    const approvedBox = overlay.querySelector(".ov-approved");
    approvedBox.classList.remove("show");
    if (data.status === "wait") {
      approveBox.classList.remove("hide");
    } else {
      approveBox.classList.add("hide");
      approvedBox.classList.add("show");
      approvedBox.querySelector("h3").textContent = "Bu bakım onaylandı";
      approvedBox.querySelector("p").textContent = "Ödeme ustaya aktarıldı. Kayıt değiştirilemez biçimde arşivlendi.";
    }
    ovBA.style.setProperty("--pos", "50%");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function closeDetail() { overlay.classList.remove("open"); document.body.style.overflow = ""; }

  document.querySelectorAll("[data-detail]").forEach((el) => {
    el.addEventListener("click", () => {
      openDetail({
        cem: el.dataset.cem, loc: el.dataset.loc, coord: el.dataset.coord,
        when: el.dataset.when, deceased: el.dataset.deceased, usta: el.dataset.usta,
        note: el.dataset.note, status: el.dataset.status,
      }, el);
    });
  });
  overlay.querySelector(".ov-close").addEventListener("click", closeDetail);
  overlay.querySelector(".overlay-bg").addEventListener("click", closeDetail);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

  /* ---------- Onayla akışı ---------- */
  overlay.querySelector("#btn-approve").addEventListener("click", () => {
    overlay.querySelector(".ov-approve").classList.add("hide");
    const ab = overlay.querySelector(".ov-approved");
    ab.classList.add("show");
    ab.querySelector("h3").textContent = "Onaylandı, teşekkürler";
    ab.querySelector("p").textContent = "Ödeme ustaya aktarıldı. Bu kayıt geçmiş bakımlarınıza eklendi.";

    // panelde onay bekleyen kartı 'tamamlandı'ya çevir
    if (pendingCardEl) {
      const status = pendingCardEl.querySelector("[data-status-pill]");
      pendingCardEl.dataset.status = "done";
    }
    // selam başlığındaki durum rozetini temizle, onay kartını gizle
    const banner = document.getElementById("approve-section");
    if (banner) setTimeout(() => { banner.style.transition = "opacity .4s, transform .4s"; banner.style.opacity = "0"; banner.style.transform = "translateY(-8px)"; setTimeout(() => banner.style.display = "none", 420); }, 900);
    const gstat = document.getElementById("gstat");
    if (gstat) gstat.innerHTML = '<span style="color:var(--primary-deep)">✓ Tüm bakımlarınız güncel</span>';
    // geçmişe yeni satır eklendiğini simüle et — rozet güncelle
    const histCount = document.getElementById("hist-count");
    if (histCount) histCount.textContent = "4 kayıt";
  });

  /* "yeniden yapılsın" */
  overlay.querySelector("#btn-redo").addEventListener("click", () => {
    overlay.querySelector(".ov-approve").classList.add("hide");
    const ab = overlay.querySelector(".ov-approved");
    ab.classList.add("show");
    ab.querySelector(".seal").style.background = "#f0e6cf";
    ab.querySelector(".seal").style.borderColor = "#c79b3a";
    ab.querySelector(".seal").style.color = "#8a6d1f";
    ab.querySelector("h3").textContent = "Talebiniz iletildi";
    ab.querySelector("p").textContent = "Usta eksikleri ek ücret olmadan giderecek. Yeni fotoğraflar hazır olduğunda haberdar olacaksınız.";
  });

  /* ---------- abonelik yönetimi ---------- */
  const pauseBtn = document.getElementById("btn-pause");
  const cancelBtn = document.getElementById("btn-cancel");
  const stateBox = document.getElementById("sub-state");
  let subState = "active";
  function setSub(s) {
    subState = s;
    stateBox.className = "sub-state";
    if (s === "paused") { stateBox.classList.add("show", "paused"); stateBox.textContent = "Aboneliğiniz duraklatıldı. Dilediğinizde tek tıkla yeniden başlatabilirsiniz."; pauseBtn.textContent = "Devam ettir"; }
    else if (s === "cancel") { stateBox.classList.add("show", "cancel"); stateBox.textContent = "Abonelik dönem sonunda iptal edilecek (12 Haz 2026). O tarihe dek bakım sürer."; }
    else { stateBox.classList.remove("show"); pauseBtn.textContent = "Duraklat"; }
  }
  pauseBtn.addEventListener("click", () => setSub(subState === "paused" ? "active" : "paused"));
  cancelBtn.addEventListener("click", () => setSub(subState === "cancel" ? "active" : "cancel"));
})();
