"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { BeforeAfter } from "@/components/BeforeAfter";
import { useCurrency } from "@/lib/currency";
import {
  IconPinMini,
  IconClockMini,
  IconClose,
  IconNote,
  IconCalendar,
  IconShieldMini,
  IconCameraMini,
  IconSeal,
} from "@/components/icons";

type Status = "wait" | "scheduled" | "done";

type Care = {
  cem: string;
  loc: string;
  coord: string;
  when: string;
  deceased: string;
  usta: string;
  note: string;
  status: Status;
  // liste görünümü
  title: string;
  sub: string;
  date: string;
};

const COORD = "41.0012° N · 29.0361° E";
const LOC = "Karacaahmet · Ada 14 / Parsel 207";
const USTA = "Hasan Kaya";
const DECEASED = "Mehmet Yılmaz";

const ACTIVE: Care[] = [
  {
    cem: "Haziran ayı bakımı",
    loc: LOC,
    coord: COORD,
    when: "Planlandı · 12 Haz 2026",
    deceased: DECEASED,
    usta: USTA,
    note: "Bu bakım henüz yapılmadı. Planlanan tarihte usta sahaya gidip canlı önce/sonra fotoğrafı çekecek.",
    status: "scheduled",
    title: "Haziran ayı bakımı",
    sub: "Karacaahmet · Aylık abonelik",
    date: "12 Haz 2026",
  },
  {
    cem: "Bayram öncesi özel bakım",
    loc: LOC,
    coord: COORD,
    when: "Planlandı · Kurban Bayramı öncesi",
    deceased: DECEASED,
    usta: USTA,
    note: "Aylık aboneliğinize dahil bayram önceliği. Bayramdan önce ek temizlik ve düzenleme yapılacak.",
    status: "scheduled",
    title: "Bayram öncesi özel bakım",
    sub: "Karacaahmet · Bayram önceliği",
    date: "~ 5 Haz 2026",
  },
];

const HISTORY: Care[] = [
  {
    cem: "Nisan ayı bakımı",
    loc: LOC,
    coord: COORD,
    when: "28 Nis 2026 · 10:15",
    deceased: DECEASED,
    usta: USTA,
    note: "Mermer temizliği, yabani ot alımı ve sulama yapıldı. Bahar yağmurları sonrası toprak düzenlendi.",
    status: "done",
    title: "Nisan ayı bakımı",
    sub: "Karacaahmet · Onaylandı",
    date: "28 Nis 2026",
  },
  {
    cem: "Mart ayı bakımı",
    loc: LOC,
    coord: COORD,
    when: "26 Mar 2026 · 14:03",
    deceased: DECEASED,
    usta: USTA,
    note: "Kış sonrası ilk kapsamlı bakım. Taş yüzeyi temizlendi, çevre düzenlendi.",
    status: "done",
    title: "Mart ayı bakımı",
    sub: "Karacaahmet · Onaylandı",
    date: "26 Mar 2026",
  },
  {
    cem: "İlk bakım",
    loc: LOC,
    coord: COORD,
    when: "24 Şub 2026 · 11:30",
    deceased: DECEASED,
    usta: USTA,
    note: "İlk tespit ve kapsamlı temizlik. Mezar konumu doğrulandı ve fotoğraflandı.",
    status: "done",
    title: "İlk bakım",
    sub: "Karacaahmet · Onaylandı",
    date: "24 Şub 2026",
  },
];

const PENDING: Care = {
  cem: "Mayıs ayı bakımı",
  loc: LOC,
  coord: COORD,
  when: "29 May 2026 · 11:42",
  deceased: DECEASED,
  usta: USTA,
  note: "Mermer ve taş yüzeyi temizlendi, yabani otlar alındı, toprak havalandırıldı ve sulama yapıldı. Mezar taşı yazısı okunaklı; çatlak veya hasar görülmedi.",
  status: "wait",
  title: "Mayıs ayı bakımı",
  sub: "Karacaahmet",
  date: "29 May 2026",
};

type OvResult = "approve" | "approved" | "redo" | "archived";

export default function PanelPage() {
  const { cur } = useCurrency();

  const [selected, setSelected] = useState<Care | null>(null);
  const [ovResult, setOvResult] = useState<OvResult>("approve");
  const [approvedDone, setApprovedDone] = useState(false);
  const [subState, setSubState] = useState<"active" | "paused" | "cancel">("active");

  // overlay açıkken body scroll kilidi + Esc ile kapatma
  useEffect(() => {
    if (!selected) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  function openDetail(item: Care) {
    setSelected(item);
    setOvResult(item.status === "wait" ? "approve" : "archived");
  }
  function closeDetail() {
    setSelected(null);
  }

  function approve() {
    setOvResult("approved");
    setApprovedDone(true);
  }
  function redo() {
    setOvResult("redo");
  }

  const histCount = approvedDone ? "4 kayıt" : "3 kayıt";

  return (
    <>
      <Topbar variant="panel" />

      <div className="panel-wrap">
        {/* SELAM */}
        <div className="greet">
          <div>
            <h1>Merhaba, Murat.</h1>
            <p className="gsub">Babanız Mehmet Yılmaz&apos;ın kabri · Karacaahmet</p>
          </div>
          <span className="gstat">
            {approvedDone ? (
              <span style={{ color: "var(--primary-deep)" }}>✓ Tüm bakımlarınız güncel</span>
            ) : (
              <>
                <span className="pulse" /> 1 bakım onayınızı bekliyor
              </>
            )}
          </span>
        </div>

        <div className="panel-grid">
          {/* ===================== SOL ===================== */}
          <div className="panel-main">
            {/* ONAY BEKLEYEN */}
            {!approvedDone && (
              <div className="block" id="approve-section">
                <div className="block-head">
                  <h2>Onayınızı bekliyor</h2>
                </div>
                <div className="approve-card">
                  <BeforeAfter initial={48} />
                  <div className="ac-body">
                    <span className="ac-badge">
                      <span
                        style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor" }}
                      />{" "}
                      Yeni rapor
                    </span>
                    <h3>Mayıs ayı bakımı tamamlandı</h3>
                    <div className="ac-meta">
                      <span>
                        <IconPinMini width={14} height={14} /> {LOC}
                      </span>
                      <span>
                        <IconClockMini width={14} height={14} /> 29 May 2026 · 11:42
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: ".9rem",
                        color: "var(--ink-2)",
                        marginBottom: 16,
                        lineHeight: 1.5,
                      }}
                    >
                      Fotoğraflar sahada canlı çekildi ve GPS konumu parsel ile eşleşti. İnceleyip
                      onaylayabilirsiniz.
                    </p>
                    <div className="ac-actions">
                      <button className="btn btn-primary" onClick={() => openDetail(PENDING)}>
                        İncele ve onayla <span className="arr">→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AKTİF BAKIMLAR */}
            <div className="block">
              <div className="block-head">
                <h2>Aktif bakımlar</h2>
                <span className="count">Aylık abonelik</span>
              </div>
              <div className="care-list">
                {ACTIVE.map((item) => (
                  <CareRow key={item.title} item={item} onOpen={openDetail} />
                ))}
              </div>
            </div>

            {/* GEÇMİŞ BAKIMLAR */}
            <div className="block">
              <div className="block-head">
                <h2>Geçmiş bakımlar</h2>
                <span className="count">{histCount}</span>
              </div>
              <div className="care-list">
                {HISTORY.map((item) => (
                  <CareRow key={item.title} item={item} onOpen={openDetail} />
                ))}
              </div>
            </div>
          </div>

          {/* ===================== SAĞ ===================== */}
          <aside>
            {/* ABONELİK */}
            <div className="aside-card">
              <h3>Aboneliğiniz</h3>
              <span className="plan-tag">
                <IconShieldMini width={14} height={14} /> Aylık Abonelik
              </span>
              <div className="sub-line">
                <span className="k">Tutar</span>
                <span className="v">{cur === "try" ? "₺1.200" : "€35"} / ay</span>
              </div>
              <div className="sub-line">
                <span className="k">Sonraki yenileme</span>
                <span className="v">12 Haz 2026</span>
              </div>
              <div className="sub-line">
                <span className="k">Ödeme yöntemi</span>
                <span className="v">•••• 4417</span>
              </div>
              <div className="sub-actions">
                <button
                  className="btn btn-quiet"
                  onClick={() => setSubState((s) => (s === "paused" ? "active" : "paused"))}
                >
                  {subState === "paused" ? "Devam ettir" : "Duraklat"}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => setSubState((s) => (s === "cancel" ? "active" : "cancel"))}
                >
                  İptal et
                </button>
              </div>
              {subState === "paused" && (
                <div className="sub-state show paused">
                  Aboneliğiniz duraklatıldı. Dilediğinizde tek tıkla yeniden başlatabilirsiniz.
                </div>
              )}
              {subState === "cancel" && (
                <div className="sub-state show cancel">
                  Abonelik dönem sonunda iptal edilecek (12 Haz 2026). O tarihe dek bakım sürer.
                </div>
              )}
            </div>

            {/* HATIRLATMA */}
            <div className="aside-card memory">
              <div className="anniv">
                <span className="ic" aria-hidden="true">
                  <IconCalendar />
                </span>
                <span>
                  <b style={{ display: "block", color: "var(--ink)", fontWeight: 700, marginBottom: 3 }}>
                    Yıldönümü yaklaşıyor
                  </b>
                  Babanız Mehmet Yılmaz&apos;ın vefat yıldönümü 18 Temmuz. O hafta için özel bir bakım
                  planlamamızı ister misiniz?
                </span>
              </div>
              <Link
                href="/siparis"
                className="btn btn-ghost"
                style={{ width: "100%", justifyContent: "center", marginTop: 16, fontSize: ".9rem" }}
              >
                Özel bakım planla
              </Link>
            </div>

            {/* GÜVEN MİNİ */}
            <div className="aside-card">
              <h3 style={{ fontSize: "1.05rem", marginBottom: 14 }}>Her bakımda</h3>
              <div className="trust-mini" style={{ marginTop: 0 }}>
                <div className="tm">
                  <IconCameraMini /> Sahada canlı çekim, galeri kapalı
                </div>
                <div className="tm">
                  <IconPinMini width={15} height={15} /> GPS, parsel ile eşleşir
                </div>
                <div className="tm">
                  <IconClockMini width={15} height={15} /> Değiştirilemez zaman damgası
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ===================== DETAY OVERLAY ===================== */}
      <div className={`overlay${selected ? " open" : ""}`} role="dialog" aria-modal="true">
        <div className="overlay-bg" onClick={closeDetail} />
        <div className="overlay-panel">
          <div className="ov-head">
            <h2>{selected?.cem ?? "Bakım detayı"}</h2>
            <button className="ov-close" aria-label="Kapat" onClick={closeDetail}>
              <IconClose />
            </button>
          </div>
          {selected && (
            <div className="ov-body">
              <BeforeAfter
                key={selected.title}
                initial={50}
                stamp={
                  <>
                    Konum doğrulandı
                    <br />
                    <span className="mono">{selected.coord}</span>
                  </>
                }
              />

              <div className="ov-meta">
                <div className="m">
                  <div className="lbl">Konum</div>
                  <div className="val">{selected.loc}</div>
                </div>
                <div className="m">
                  <div className="lbl">Tarih &amp; saat</div>
                  <div className="val mono">{selected.when}</div>
                </div>
                <div className="m">
                  <div className="lbl">Merhum</div>
                  <div className="val">{selected.deceased}</div>
                </div>
                <div className="m">
                  <div className="lbl">GPS koordinatı</div>
                  <div className="val mono">
                    <span style={{ color: "var(--primary)" }}>●</span> Eşleşti
                  </div>
                </div>
              </div>

              <div className="ov-notes">
                <h4>
                  <IconNote /> Usta notu
                </h4>
                <p>{selected.note}</p>
                <div className="usta">
                  <span className="ava">{selected.usta.charAt(0)}</span>
                  <span>
                    <span className="un">{selected.usta}</span>
                    <br />
                    <span className="ur">Onaylı usta · Karacaahmet</span>
                  </span>
                </div>
              </div>

              {ovResult === "approve" && (
                <div className="ov-approve">
                  <p>
                    Fotoğrafları incelediniz. İşi onaylarsanız ödeme ustaya aktarılır. Memnun kalmazsanız
                    ek ücret olmadan yeniden yapılır.
                  </p>
                  <div className="row">
                    <button className="btn btn-primary" onClick={approve}>
                      ✓ Onayla, ödemeyi aktar
                    </button>
                    <button className="btn btn-ghost" onClick={redo}>
                      Eksik var, yeniden yapılsın
                    </button>
                  </div>
                </div>
              )}

              {ovResult !== "approve" && (
                <div className={`ov-approved show${ovResult === "redo" ? " redo" : ""}`}>
                  <div className="seal" aria-hidden="true">
                    <IconSeal width={30} height={30} />
                  </div>
                  <h3>{OV_TEXT[ovResult].title}</h3>
                  <p>{OV_TEXT[ovResult].body}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const OV_TEXT: Record<Exclude<OvResult, "approve">, { title: string; body: string }> = {
  approved: {
    title: "Onaylandı, teşekkürler",
    body: "Ödeme ustaya aktarıldı. Bu kayıt geçmiş bakımlarınıza eklendi.",
  },
  redo: {
    title: "Talebiniz iletildi",
    body: "Usta eksikleri ek ücret olmadan giderecek. Yeni fotoğraflar hazır olduğunda haberdar olacaksınız.",
  },
  archived: {
    title: "Bu bakım onaylandı",
    body: "Ödeme ustaya aktarıldı. Kayıt değiştirilemez biçimde arşivlendi.",
  },
};

function CareRow({ item, onOpen }: { item: Care; onOpen: (i: Care) => void }) {
  const isDone = item.status === "done";
  return (
    <div className="care-row" onClick={() => onOpen(item)}>
      <div className="ph thumb" />
      <div className="cr-main">
        <h4>{item.title}</h4>
        <p>{item.sub}</p>
      </div>
      <div className="cr-side">
        <span className="cr-date">{item.date}</span>
        <span className={`pill ${isDone ? "done" : "scheduled"}`}>
          {isDone ? "✓ Onaylı" : "Planlandı"}
        </span>
      </div>
    </div>
  );
}
