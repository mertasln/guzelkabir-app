"use client";

import { useState } from "react";
import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { useCurrency } from "@/lib/currency";
import { IconClockMini, IconPinMini, IconShieldMini, IconCameraMini, IconCheckMini, IconShieldNote, IconSeal } from "@/components/icons";

type PlanKey = "tek" | "aylik" | "yillik";

const PLANS: Record<PlanKey, { name: string; try: number; eur: number; unit: string }> = {
  tek: { name: "Tek Seferlik", try: 850, eur: 25, unit: "tek sefer" },
  aylik: { name: "Aylık Abonelik", try: 1200, eur: 35, unit: "/ ay" },
  yillik: { name: "Yıllık Premium", try: 9500, eur: 280, unit: "/ yıl" },
};
const FLOWER = { try: 250, eur: 8 };

const CEMETERIES = [
  { value: "Zincirlikuyu", role: "Premium itina" },
  { value: "Karacaahmet", role: "Büyük ölçek · diaspora" },
  { value: "Edirnekapı", role: "Manevi miras" },
  { value: "Eyüpsultan", role: "Yüksek manevi trafik" },
];

const STEP_LABELS = ["Konum", "Paket", "Merhum", "Ödeme", "Onay"];

export default function FlowPage() {
  const { fmt, cur } = useCurrency();

  const [step, setStep] = useState(0);
  const [cemetery, setCemetery] = useState<string | null>(null);
  const [ilce, setIlce] = useState("");
  const [ada, setAda] = useState("");
  const [parsel, setParsel] = useState("");
  const [helpNeeded, setHelpNeeded] = useState(false);
  const [helpNote, setHelpNote] = useState("");
  const [plan, setPlan] = useState<PlanKey>("aylik");
  const [flower, setFlower] = useState(false);
  const [deceased, setDeceased] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [relation, setRelation] = useState("");
  const [anniv, setAnniv] = useState(true);
  const [payMethod, setPayMethod] = useState<"card" | "sepa">("card");
  const [card, setCard] = useState({ name: "", no: "", exp: "", cvc: "" });

  // doğrulama hatası bayrakları
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [cemError, setCemError] = useState(false);

  const p = PLANS[plan];
  const total = p[cur] + (flower ? FLOWER[cur] : 0);

  function clearErr(key: string) {
    setErrors((e) => (e[key] ? { ...e, [key]: false } : e));
  }

  function validate(i: number): boolean {
    if (i === 0) {
      if (helpNeeded) return true;
      const next: Record<string, boolean> = {};
      let ok = true;
      if (!cemetery) {
        setCemError(true);
        ok = false;
      }
      if (!ada.trim()) {
        next.ada = true;
        ok = false;
      }
      if (!parsel.trim()) {
        next.parsel = true;
        ok = false;
      }
      setErrors((e) => ({ ...e, ...next }));
      return ok;
    }
    if (i === 2) {
      const next: Record<string, boolean> = {};
      let ok = true;
      if (!deceased.trim()) {
        next.deceased = true;
        ok = false;
      }
      if (!deathDate) {
        next.deathDate = true;
        ok = false;
      }
      setErrors((e) => ({ ...e, ...next }));
      return ok;
    }
    if (i === 3) {
      const next: Record<string, boolean> = {};
      let ok = true;
      (["name", "no", "exp", "cvc"] as const).forEach((k) => {
        if (!card[k].trim()) {
          next["card-" + k] = true;
          ok = false;
        }
      });
      setErrors((e) => ({ ...e, ...next }));
      return ok;
    }
    return true;
  }

  function goNext() {
    if (!validate(step)) return;
    if (step < STEP_LABELS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }
  function goBack() {
    if (step > 0) {
      setStep(step - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const inputCls = (key: string) => `input${errors[key] ? " invalid" : ""}`;
  const fieldCls = (key: string) => `field${errors[key] ? " show-err" : ""}`;

  // özet türetilmiş değerler
  const sumCem = cemetery ?? (helpNeeded ? "Ekip tespit edecek" : "—");
  const sumLoc = helpNeeded
    ? "Yardım istendi"
    : ada || parsel
      ? `Ada ${ada || "—"} / Parsel ${parsel || "—"}`
      : "—";

  return (
    <>
      <Topbar variant="flow" />

      <div className="flow-shell">
        {/* SOL: AKIŞ */}
        <div className="flow-main">
          {/* stepper */}
          <div className="stepper">
            {STEP_LABELS.map((label, i) => (
              <Stepper key={label} label={label} index={i} step={step} last={i === STEP_LABELS.length - 1} />
            ))}
          </div>

          {/* ADIM 1 · KONUM */}
          {step === 0 && (
            <section className="step-panel">
              <div className="step-h">
                <span className="skicker">Adım 1 / 5</span>
                <h1>Kabir nerede?</h1>
                <p>Mezarlığı seçin ve ada/parsel bilgisini girin. Bilmiyorsanız, sizin için tespit ederiz.</p>
              </div>

              <div className={`flow-fieldset${helpNeeded ? " help-on" : ""}`}>
                <div className="row2">
                  <div className="field">
                    <label htmlFor="il">İl</label>
                    <select className="select" id="il" disabled defaultValue="İstanbul">
                      <option>İstanbul</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="ilce">İlçe</label>
                    <select className="select" id="ilce" value={ilce} onChange={(e) => setIlce(e.target.value)}>
                      <option value="">Seçiniz</option>
                      <option>Şişli</option>
                      <option>Üsküdar</option>
                      <option>Eyüpsultan</option>
                      <option>Fatih</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Mezarlık</label>
                  <div className="cem-pick">
                    {CEMETERIES.map((c) => (
                      <label key={c.value}>
                        <input
                          type="radio"
                          name="cemetery"
                          value={c.value}
                          checked={cemetery === c.value}
                          onChange={() => {
                            setCemetery(c.value);
                            setCemError(false);
                          }}
                        />
                        <span className="cem-card">
                          <span className="cname">{c.value}</span>
                          <span className="crole">{c.role}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className={`err${cemError ? " show" : ""}`}>Lütfen bir mezarlık seçin.</div>
                </div>

                <div className="req-fields">
                  <div className="row2">
                    <div className={fieldCls("ada")}>
                      <label htmlFor="ada">Ada</label>
                      <input
                        className={inputCls("ada")}
                        id="ada"
                        placeholder="Örn. 14"
                        value={ada}
                        onChange={(e) => {
                          setAda(e.target.value);
                          clearErr("ada");
                        }}
                      />
                      <div className="err">Ada bilgisini girin.</div>
                    </div>
                    <div className={fieldCls("parsel")}>
                      <label htmlFor="parsel">Parsel</label>
                      <input
                        className={inputCls("parsel")}
                        id="parsel"
                        placeholder="Örn. 207"
                        value={parsel}
                        onChange={(e) => {
                          setParsel(e.target.value);
                          clearErr("parsel");
                        }}
                      />
                      <div className="err">Parsel bilgisini girin.</div>
                    </div>
                  </div>
                </div>

                <label className="help-toggle" htmlFor="help-needed">
                  <input
                    type="checkbox"
                    id="help-needed"
                    checked={helpNeeded}
                    onChange={(e) => setHelpNeeded(e.target.checked)}
                  />
                  <span className="ht-txt">
                    <b>Ada/parsel bilmiyorum — yardım isteyin</b>
                    <span>Mezarlık adı ve merhum bilgisiyle ekibimiz yeri harita ve saha tespitiyle bulur.</span>
                  </span>
                </label>

                {helpNeeded && (
                  <div className="help-fields">
                    <div className="field" style={{ marginTop: 16 }}>
                      <label htmlFor="help-note">
                        Bildiğiniz detaylar <span className="hint">(opsiyonel)</span>
                      </label>
                      <textarea
                        className="input"
                        id="help-note"
                        rows={2}
                        placeholder="Örn. ana girişten girince sağda, çınar ağacının yanında..."
                        value={helpNote}
                        onChange={(e) => setHelpNote(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flow-nav">
                <Link href="/" className="back">
                  ← Vazgeç
                </Link>
                <button className="btn btn-primary btn-next" onClick={goNext}>
                  Devam et <span className="arr">→</span>
                </button>
              </div>
            </section>
          )}

          {/* ADIM 2 · PAKET */}
          {step === 1 && (
            <section className="step-panel">
              <div className="step-h">
                <span className="skicker">Adım 2 / 5</span>
                <h1>Bakım paketini seçin.</h1>
                <p>Üst bardan ₺ / € geçişi yapabilirsiniz. Abonelik tek tıkla iptal edilir.</p>
              </div>

              <div className="plan-pick">
                {(Object.keys(PLANS) as PlanKey[]).map((key) => {
                  const pl = PLANS[key];
                  const desc =
                    key === "tek"
                      ? "Bir kerelik özenli bakım. Tanışmak için ideal."
                      : key === "aylik"
                        ? "Yıl boyu bakımlı kalır. Haftalık sulama, bayramda öncelik."
                        : "En kapsamlı itina. Onarım, yazı boyama ve çiçek dahil.";
                  return (
                    <label key={key}>
                      <input type="radio" name="plan" value={key} checked={plan === key} onChange={() => setPlan(key)} />
                      <span className="ppick">
                        {key === "aylik" && <span className="tag">Öne çıkan</span>}
                        <span className="chk">
                          <IconCheckMini width={11} height={11} />
                        </span>
                        <span className="pn">{pl.name}</span>
                        <span className="pp">
                          <span className="a">{fmt(pl)}</span>
                          {pl.unit !== "tek sefer" && <span className="u">{pl.unit}</span>}
                        </span>
                        <span className="pd">{desc}</span>
                      </span>
                    </label>
                  );
                })}
              </div>

              <label className="addon" htmlFor="flower">
                <input type="checkbox" id="flower" checked={flower} onChange={(e) => setFlower(e.target.checked)} />
                <span className="a-txt">
                  <b>Mevsimlik çiçek ekle</b> — isteğe bağlı, edebe uygun düzenleme
                </span>
                <span className="a-price">+ {fmt(FLOWER)}</span>
              </label>

              <div className="flow-nav">
                <button className="back" onClick={goBack}>
                  ← Geri
                </button>
                <button className="btn btn-primary btn-next" onClick={goNext}>
                  Devam et <span className="arr">→</span>
                </button>
              </div>
            </section>
          )}

          {/* ADIM 3 · MERHUM */}
          {step === 2 && (
            <section className="step-panel">
              <div className="step-h">
                <span className="skicker">Adım 3 / 5</span>
                <h1>Merhum bilgileri.</h1>
                <p>Vefat tarihini girmeniz, her yıl yıldönümünde size nazikçe hatırlatma yapmamızı sağlar.</p>
              </div>

              <div className={fieldCls("deceased")}>
                <label htmlFor="deceased">Ad Soyad</label>
                <input
                  className={inputCls("deceased")}
                  id="deceased"
                  placeholder="Merhumun adı soyadı"
                  value={deceased}
                  onChange={(e) => {
                    setDeceased(e.target.value);
                    clearErr("deceased");
                  }}
                />
                <div className="err">Lütfen ad soyad girin.</div>
              </div>
              <div className="row2">
                <div className={fieldCls("deathDate")}>
                  <label htmlFor="death-date">Vefat tarihi</label>
                  <input
                    className={inputCls("deathDate")}
                    id="death-date"
                    type="date"
                    value={deathDate}
                    onChange={(e) => {
                      setDeathDate(e.target.value);
                      clearErr("deathDate");
                    }}
                  />
                  <div className="err">Lütfen vefat tarihini girin.</div>
                </div>
                <div className="field">
                  <label htmlFor="relation">
                    Yakınlık <span className="hint">(opsiyonel)</span>
                  </label>
                  <select className="select" id="relation" value={relation} onChange={(e) => setRelation(e.target.value)}>
                    <option value="">Seçiniz</option>
                    <option>Baba</option>
                    <option>Anne</option>
                    <option>Dede</option>
                    <option>Nine</option>
                    <option>Eş</option>
                    <option>Kardeş</option>
                    <option>Diğer</option>
                  </select>
                </div>
              </div>
              <label className="addon" htmlFor="anniv" style={{ marginTop: 4 }}>
                <input type="checkbox" id="anniv" checked={anniv} onChange={(e) => setAnniv(e.target.checked)} />
                <span className="a-txt">
                  <b>Yıldönümü hatırlatması</b> — vefat yıldönümü ve bayram öncesi nazik bildirim
                </span>
              </label>

              <div className="flow-nav">
                <button className="back" onClick={goBack}>
                  ← Geri
                </button>
                <button className="btn btn-primary btn-next" onClick={goNext}>
                  Devam et <span className="arr">→</span>
                </button>
              </div>
            </section>
          )}

          {/* ADIM 4 · ÖDEME */}
          {step === 3 && (
            <section className="step-panel">
              <div className="step-h">
                <span className="skicker">Adım 4 / 5</span>
                <h1>Özet ve ödeme.</h1>
                <p>Kart bilgileriniz yalnızca ödeme sağlayıcısına iletilir. Ücret, işi onaylamadan tahsil edilmez.</p>
              </div>

              <div className="seg" role="group" aria-label="Ödeme yöntemi">
                <button className={payMethod === "card" ? "active" : ""} onClick={() => setPayMethod("card")}>
                  Kredi / Banka kartı
                </button>
                <button className={payMethod === "sepa" ? "active" : ""} onClick={() => setPayMethod("sepa")}>
                  SEPA / Havale
                </button>
              </div>

              <div className="card-visual">
                <div className={fieldCls("card-name")}>
                  <label htmlFor="card-name">Kart üzerindeki ad</label>
                  <input
                    className={inputCls("card-name")}
                    id="card-name"
                    placeholder="Ad Soyad"
                    autoComplete="cc-name"
                    value={card.name}
                    onChange={(e) => {
                      setCard({ ...card, name: e.target.value });
                      clearErr("card-name");
                    }}
                  />
                  <div className="err">Bu alan gerekli.</div>
                </div>
                <div className={fieldCls("card-no")}>
                  <label htmlFor="card-no">Kart numarası</label>
                  <input
                    className={inputCls("card-no")}
                    id="card-no"
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={card.no}
                    onChange={(e) => {
                      setCard({ ...card, no: e.target.value });
                      clearErr("card-no");
                    }}
                  />
                  <div className="err">Bu alan gerekli.</div>
                </div>
                <div className="row2">
                  <div className={fieldCls("card-exp")}>
                    <label htmlFor="card-exp">Son kullanma</label>
                    <input
                      className={inputCls("card-exp")}
                      id="card-exp"
                      placeholder="AA / YY"
                      autoComplete="cc-exp"
                      value={card.exp}
                      onChange={(e) => {
                        setCard({ ...card, exp: e.target.value });
                        clearErr("card-exp");
                      }}
                    />
                    <div className="err">Gerekli.</div>
                  </div>
                  <div className={fieldCls("card-cvc")}>
                    <label htmlFor="card-cvc">CVC</label>
                    <input
                      className={inputCls("card-cvc")}
                      id="card-cvc"
                      placeholder="123"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      value={card.cvc}
                      onChange={(e) => {
                        setCard({ ...card, cvc: e.target.value });
                        clearErr("card-cvc");
                      }}
                    />
                    <div className="err">Gerekli.</div>
                  </div>
                </div>
              </div>

              <div className="sum-note" style={{ marginTop: 18 }}>
                <span className="ic" aria-hidden="true">
                  <IconShieldNote />
                </span>
                <span>
                  Bu bir prototip ekranıdır; gerçek bir ödeme alınmaz. Yayında ücret yalnızca siz işi onayladıktan
                  sonra ustaya aktarılır.
                </span>
              </div>

              <div className="flow-nav">
                <button className="back" onClick={goBack}>
                  ← Geri
                </button>
                <button className="btn btn-primary btn-next" onClick={goNext}>
                  Siparişi tamamla <span className="arr">→</span>
                </button>
              </div>
            </section>
          )}

          {/* ADIM 5 · ONAY */}
          {step === 4 && (
            <section className="step-panel">
              <div className="confirm">
                <div className="seal" aria-hidden="true">
                  <IconSeal />
                </div>
                <h1>Talebiniz alındı.</h1>
                <p>
                  <span>{cemetery ?? "İstanbul"}</span> için <b>{p.name}</b> bakım talebiniz oluşturuldu.
                </p>
                <p>
                  Onaylı ustamız atandığında ve ilk fotoğraflar hazır olduğunda panelinizden haberdar olacaksınız.
                </p>

                <div className="next">
                  <h3>Bundan sonra ne olacak?</h3>
                  <div className="nstep">
                    <span className="ni">1</span> O mezarlıktan sorumlu onaylı usta talebinizi üstlenir (genellikle 48
                    saat içinde).
                  </div>
                  <div className="nstep">
                    <span className="ni">2</span> Usta sahada canlı önce/sonra fotoğrafı çeker; GPS ve zaman damgalı
                    olarak panelinize düşer.
                  </div>
                  <div className="nstep">
                    <span className="ni">3</span> Siz onaylarsınız — ancak o zaman ödeme ustaya aktarılır.
                  </div>
                </div>

                <div className="flow-nav" style={{ border: "none", justifyContent: "center", marginTop: 28 }}>
                  <Link href="/" className="btn btn-ghost">
                    Ana sayfaya dön
                  </Link>
                  <Link href="/panel" className="btn btn-primary">
                    Panele git →
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* SAĞ: ÖZET */}
        <aside className="summary">
          <div className="summary-card">
            <div className="ph" data-label="foto: mevcut kabir" />
            <div className="summary-body">
              <h3>Sipariş özeti</h3>
              <p className="sub">İstanbul · Uzaktan kabir bakımı</p>
              <div className="sum-row">
                <span className="k">Mezarlık</span>
                <span className={`v${cemetery ? "" : " empty"}`}>{sumCem}</span>
              </div>
              <div className="sum-row">
                <span className="k">Konum</span>
                <span className={`v${!helpNeeded && !ada && !parsel ? " empty" : ""}`}>{sumLoc}</span>
              </div>
              <div className="sum-row">
                <span className="k">Merhum</span>
                <span className={`v${deceased ? "" : " empty"}`}>{deceased || "—"}</span>
              </div>
              <div className="sum-row">
                <span className="k">
                  Paket <span className="muted" style={{ fontWeight: 400 }}>{p.unit}</span>
                </span>
                <span className="v">{p.name}</span>
              </div>
              {flower && (
                <div className="sum-row">
                  <span className="k">Mevsimlik çiçek</span>
                  <span className="v">+ {fmt(FLOWER)}</span>
                </div>
              )}
              <div className="sum-total">
                <span className="k">Toplam</span>
                <span className="v">{fmt({ try: total, eur: total })}</span>
              </div>
              <div className="sum-note">
                <span className="ic" aria-hidden="true">
                  <IconClockMini width={15} height={15} />
                </span>
                <span>Önce işi onaylar, sonra ödersiniz. Onay vermeden ücret tahsil edilmez.</span>
              </div>
            </div>
          </div>

          <div className="trust-mini">
            <div className="tm">
              <IconShieldMini /> Onaylı, faturalı yerel ustalar
            </div>
            <div className="tm">
              <IconCameraMini /> GPS &amp; zaman damgalı kanıt
            </div>
            <div className="tm">
              <IconPinMini width={15} height={15} /> Memnun kalmazsanız yeniden yapılır
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

function Stepper({ label, index, step, last }: { label: string; index: number; step: number; last: boolean }) {
  const cls = index === step ? "node active" : index < step ? "node done" : "node";
  return (
    <>
      <div className={cls}>
        <span className="dot">{index + 1}</span>
        <span className="nlabel">{label}</span>
      </div>
      {!last && <div className={`bar${index < step ? " done" : ""}`} />}
    </>
  );
}
