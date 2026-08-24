import Link from "next/link";
import { Topbar } from "@/components/Topbar";
import { Reveal } from "@/components/Reveal";
import { Faq } from "@/components/Faq";
import { BeforeAfter } from "@/components/BeforeAfter";
import { Price } from "@/components/Price";
import {
  BrandMark,
  IconShieldCheck,
  IconCamera,
  IconClock,
  IconPin,
  IconGps,
  IconNoFakePhoto,
  IconClockSmall,
  IconShieldSmall,
} from "@/components/icons";

const CEMETERIES = [
  { num: "01", name: "Zincirlikuyu", role: "Premium müşteri, yüksek itina." },
  { num: "02", name: "Karacaahmet", role: "Büyük ölçek, diaspora yoğunluğu." },
  { num: "03", name: "Edirnekapı", role: "Manevi miras." },
  { num: "04", name: "Eyüpsultan", role: "Yüksek manevi trafik." },
];

export default function HomePage() {
  return (
    <>
      <Topbar variant="home" />

      <main>
        {/* HERO */}
        <section className="hero">
          <div className="wrap hero-inner">
            <div className="hero-grid">
              <Reveal className="hero-copy">
                <span className="eyebrow">Uzaktan kabir bakımı · İstanbul</span>
                <h1 className="display">
                  Sevdiklerinizin kabri, <em>vefa ile bakımlı.</em>
                </h1>
                <p className="lead">
                  Nerede olursanız olun. Onaylı yerel ustalar mezarınızı itinayla bakar; GPS doğrulamalı
                  önce/sonra fotoğraflarıyla her adımı şeffafça panelinize yansıtır.
                </p>
                <div className="hero-actions">
                  <Link href="/siparis" className="btn btn-primary btn-lg">
                    Kabir Bakımı Başlat <span className="arr">→</span>
                  </Link>
                  <Link href="#nasil" className="btn btn-ghost btn-lg">
                    Nasıl çalışır?
                  </Link>
                </div>
                <p className="hero-note">
                  <span className="dot" /> Önce işi onaylar, sonra ödersiniz. Onay vermeden ücret alınmaz.
                </p>
                <div className="hero-trust">
                  <span className="ht">✓ Onaylı yerel ustalar</span>
                  <span className="ht">✓ GPS &amp; zaman damgalı kanıt</span>
                  <span className="ht">✓ İstanbul&apos;un 4 mezarlığı</span>
                </div>
              </Reveal>

              <Reveal className="hero-figure">
                <div className="ph hero-photo" role="img" aria-label="Bakım sonrası kabir" />
                <div className="hero-badge">
                  <span className="gps" aria-hidden="true">
                    <IconGps />
                  </span>
                  <span>
                    Konum doğrulandı
                    <br />
                    <span className="mono">41.0668° N · 29.0073° E</span>
                  </span>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* GÜVEN ŞERİDİ */}
        <section className="section section--tint">
          <div className="wrap">
            <Reveal className="trust-strip">
              <div className="trust-cell">
                <div className="ic" aria-hidden="true">
                  <IconShieldCheck />
                </div>
                <h3>Onaylı ustalar</h3>
                <p>Faturalı, yerleşik mermerci &amp; çiçekçiler.</p>
              </div>
              <div className="trust-cell">
                <div className="ic" aria-hidden="true">
                  <IconCamera />
                </div>
                <h3>Kanıtlı bakım</h3>
                <p>GPS &amp; zaman damgalı önce/sonra fotoğrafı.</p>
              </div>
              <div className="trust-cell">
                <div className="ic" aria-hidden="true">
                  <IconClock />
                </div>
                <h3>Önce onay, sonra ödeme</h3>
                <p>Onaylamadan ücret alınmaz.</p>
              </div>
              <div className="trust-cell">
                <div className="ic" aria-hidden="true">
                  <IconPin />
                </div>
                <h3>İstanbul&apos;un 4 mezarlığı</h3>
                <p>Zincirlikuyu · Karacaahmet · Edirnekapı · Eyüpsultan</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* NASIL ÇALIŞIR */}
        <section className="section" id="nasil">
          <div className="wrap">
            <Reveal className="section-head">
              <span className="eyebrow">Nasıl çalışır</span>
              <h2 className="display">Dört adımda, baştan sona şeffaf.</h2>
              <p className="lead">
                Konumu girersiniz, gerisini onaylı ustamız üstlenir. Siz yalnızca gördüğünüz işi onaylarsınız.
              </p>
            </Reveal>
            <Reveal className="steps">
              <div className="step">
                <div className="num">1</div>
                <h3>Konumu girin</h3>
                <p>İl, ilçe, mezarlık ve ada/parsel. Bilmiyorsanız ekip harita ve fotoğrafla yeri tespit eder.</p>
              </div>
              <div className="step">
                <div className="num">2</div>
                <h3>Onaylı usta atanır</h3>
                <p>O mezarlıktan sorumlu, doğrulanmış yerleşik usta işi üstlenir.</p>
              </div>
              <div className="step">
                <div className="num">3</div>
                <h3>Önce/sonra fotoğrafı</h3>
                <p>Usta sahada canlı çeker; GPS ve zaman damgalı olarak panelinize düşer.</p>
              </div>
              <div className="step">
                <div className="num">4</div>
                <h3>Onaylayın</h3>
                <p>Onayınızla ödeme ustaya aktarılır. Memnun kalmazsanız yeniden yapılır.</p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ŞEFFAFLIK */}
        <section className="section section--tint" id="seffaflik">
          <div className="wrap">
            <Reveal className="section-head">
              <span className="eyebrow">Şeffaflık</span>
              <h2 className="display">Görmediğiniz hiçbir işe güvenmek zorunda değilsiniz.</h2>
            </Reveal>
            <div className="transp-grid">
              <Reveal>
                <BeforeAfter
                  stamp={
                    <>
                      Karacaahmet · Ada 14 / Parsel 207
                      <br />
                      <span className="mono">29 May 2026 · 11:42</span>
                    </>
                  }
                />
              </Reveal>
              <Reveal className="proofs">
                <div className="proof">
                  <h3>
                    <span className="ic" aria-hidden="true">
                      <IconNoFakePhoto />
                    </span>{" "}
                    Sahte fotoğrafa yer yok
                  </h3>
                  <p>
                    Galeriden yükleme kapalıdır; yalnızca sahada canlı çekim kabul edilir. GPS, ada/parsel ile
                    eşleşmezse rapor reddedilir.
                  </p>
                </div>
                <div className="proof">
                  <h3>
                    <span className="ic" aria-hidden="true">
                      <IconClockSmall />
                    </span>{" "}
                    Zaman damgalı kayıt
                  </h3>
                  <p>
                    Her işlem, değiştirilemez biçimde tarih ve saatiyle arşivlenir. Geçmiş bakımlarınız her zaman
                    erişilebilir kalır.
                  </p>
                </div>
                <div className="proof">
                  <h3>
                    <span className="ic" aria-hidden="true">
                      <IconShieldSmall />
                    </span>{" "}
                    Memnuniyet güvencesi
                  </h3>
                  <p>Onaylamadığınız işe ödeme yapılmaz. Eksikler ek ücret olmadan yeniden yapılır.</p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* PAKETLER */}
        <section className="section" id="paketler">
          <div className="wrap">
            <Reveal className="section-head">
              <span className="eyebrow">Hizmet paketleri</span>
              <h2 className="display">İhtiyacınıza göre, vefa ölçüsünde.</h2>
              <p className="lead">Üst bardan ₺ / € geçişi yapabilirsiniz. Abonelikler tek tıkla iptal edilir.</p>
            </Reveal>
            <div className="plans">
              <Reveal className="plan">
                <div className="pname">Tek Seferlik</div>
                <p className="pdesc">Bir kerelik özenli bakım — tanışmak için ideal.</p>
                <div className="price">
                  <span className="amt">
                    <Price amount={{ try: 850, eur: 25 }} />
                  </span>
                  <span className="per">tek sefer</span>
                </div>
                <ul className="pfeat">
                  <li><span className="tick">✓</span> Mermer &amp; taş temizliği</li>
                  <li><span className="tick">✓</span> Yabani ot alımı &amp; toprak havalandırma</li>
                  <li><span className="tick">✓</span> Sulama <b>(hizmet günü)</b></li>
                  <li><span className="tick">✓</span> Fotoğraflı/videolu rapor</li>
                  <li className="off"><span className="tick">○</span> Mevsimlik çiçek (opsiyonel)</li>
                </ul>
                <Link href="/siparis" className="btn btn-ghost">Tek bakım başlat</Link>
              </Reveal>

              <Reveal className="plan featured">
                <div className="pname">Aylık Abonelik</div>
                <p className="pdesc">Yıl boyu bakımlı kalır — en çok tercih edilen.</p>
                <div className="price">
                  <span className="amt">
                    <Price amount={{ try: 1200, eur: 35 }} />
                  </span>
                  <span className="per">/ ay</span>
                </div>
                <ul className="pfeat">
                  <li><span className="tick">✓</span> Mermer &amp; taş temizliği</li>
                  <li><span className="tick">✓</span> Yabani ot alımı &amp; toprak havalandırma</li>
                  <li><span className="tick">✓</span> Sulama <b>(haftalık)</b></li>
                  <li><span className="tick">✓</span> Fotoğraflı rapor <b>(her ay)</b></li>
                  <li><span className="tick">✓</span> Bayramda öncelik</li>
                  <li className="off"><span className="tick">○</span> Mevsimlik çiçek (opsiyonel)</li>
                </ul>
                <Link href="/siparis" className="btn btn-primary">Aboneliği başlat</Link>
              </Reveal>

              <Reveal className="plan">
                <div className="pname">Yıllık Premium</div>
                <p className="pdesc">En kapsamlı itina — onarım ve çiçek dahil.</p>
                <div className="price">
                  <span className="amt">
                    <Price amount={{ try: 9500, eur: 280 }} />
                  </span>
                  <span className="per">/ yıl</span>
                </div>
                <ul className="pfeat">
                  <li><span className="tick">✓</span> Aylık aboneliğin tümü</li>
                  <li><span className="tick">✓</span> Sulama <b>(haftalık)</b></li>
                  <li><span className="tick">✓</span> Rapor <b>(her bakım sonrası)</b></li>
                  <li><span className="tick">✓</span> Mevsimlik çiçek <b>(yılda 2 kez dahil)</b></li>
                  <li><span className="tick">✓</span> Yazı boyama &amp; küçük onarım</li>
                  <li><span className="tick">✓</span> Bayramda öncelik</li>
                </ul>
                <Link href="/siparis" className="btn btn-ghost">Premium&apos;a geç</Link>
              </Reveal>
            </div>
            <Reveal as="p" className="plan-foot">
              Fiyatlar örnektir, netleştirilecektir. Çiçek ve peyzaj her zaman isteğe bağlıdır; varsayılan bakım
              sade ve edebe uygundur.
            </Reveal>
          </div>
        </section>

        {/* YORUM */}
        <section className="section section--tint">
          <Reveal className="wrap quote">
            <div className="qmark" aria-hidden="true">&ldquo;</div>
            <blockquote className="display">
              Yıllardır Almanya&apos;dayım, babamın kabrini her bayram merak ederdim. Şimdi telefonumdan görüyorum;
              tertemiz, çiçekli. İçim rahat.
            </blockquote>
            <div className="cite">
              <b>Murat Y.</b> · Köln, Almanya
            </div>
          </Reveal>
        </section>

        {/* MEZARLIKLAR */}
        <section className="section" id="mezarliklar">
          <div className="wrap">
            <Reveal className="section-head">
              <span className="eyebrow">Pilot kapsam</span>
              <h2 className="display">İstanbul&apos;un dört mezarlığı.</h2>
              <p className="lead">
                Önce derinlik, sonra genişlik. Pilot, dört mezarlıkta güçlü bir usta ağıyla başlıyor.
              </p>
            </Reveal>
            <div className="cems">
              {CEMETERIES.map((c) => (
                <Reveal key={c.num} className="cem">
                  <div className="cnum">{c.num}</div>
                  <h3>{c.name}</h3>
                  <p>{c.role}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* SSS */}
        <section className="section section--tint" id="sss">
          <div className="wrap">
            <Reveal className="section-head" style={{ marginInline: "auto", textAlign: "center" }}>
              <span className="eyebrow" style={{ justifyContent: "center" }}>
                Sıkça sorulan sorular
              </span>
              <h2 className="display">Aklınızdaki sorular.</h2>
            </Reveal>
            <Reveal>
              <Faq />
            </Reveal>
          </div>
        </section>

        {/* CTA */}
        <section className="section">
          <div className="wrap">
            <Reveal className="cta-band">
              <div className="geo-faint" aria-hidden="true" />
              <h2>Gönlünüz rahat olsun.</h2>
              <p>Bir kabir bakımı başlatın; her adımı kendi panelinizden, kendi gözünüzle görün.</p>
              <Link href="/siparis" className="btn btn-primary btn-lg">
                Kabir Bakımı Başlat <span className="arr">→</span>
              </Link>
            </Reveal>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div>
              <div className="brand">
                <span className="mark" aria-hidden="true">
                  <BrandMark width={28} height={28} />
                </span>{" "}
                GüzelKabir
              </div>
              <p className="fdesc">Uzaktan, şeffaf ve itinalı kabir bakımı. Vefa, gönül rahatlığıyla.</p>
            </div>
            <div className="fcol">
              <h4>Hizmet</h4>
              <Link href="#nasil">Nasıl çalışır</Link>
              <Link href="#paketler">Paketler</Link>
              <Link href="#seffaflik">Şeffaflık</Link>
              <Link href="#mezarliklar">Mezarlıklar</Link>
            </div>
            <div className="fcol">
              <h4>Kurumsal</h4>
              <Link href="#">Hakkımızda</Link>
              <Link href="#">Usta Ol</Link>
              <Link href="#">İletişim</Link>
              <Link href="#sss">S.S.S.</Link>
            </div>
            <div className="fcol">
              <h4>Güven</h4>
              <Link href="#">Gizlilik</Link>
              <Link href="#">Kullanım koşulları</Link>
              <Link href="#">Memnuniyet güvencesi</Link>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 GüzelKabir · İstanbul pilotu</span>
            <span>Önce onaylayın, sonra ödeyin · ₺ / € · Türkçe</span>
          </div>
        </div>
      </footer>
    </>
  );
}
