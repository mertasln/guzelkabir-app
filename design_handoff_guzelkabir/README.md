# Handoff: GüzelKabir — Ana Sayfa, Sipariş Akışı, Müşteri Paneli

## Genel Bakış (Overview)
GüzelKabir, Türkiye'deki mezarlıklar için uzaktan, şeffaf ve itinalı kabir bakımı sunan
bir pazar yeridir. Bu paket, İstanbul pilotu için tasarlanmış üç temel ekranı içerir:

1. **Ana Sayfa** — pazarlama / dönüşüm sayfası (hero, güven, nasıl çalışır, şeffaflık, paketler, SSS).
2. **Sipariş Akışı** — 5 adımlı çok adımlı sihirbaz (en kritik dönüşüm ekranı).
3. **Müşteri Paneli** — onay döngüsünün kalbi (GPS/zaman damgalı önce/sonra fotoğrafı → "Onayla" → ödeme).

Birincil kitle Avrupa'daki Türk diasporasıdır; masaüstü öncelikli, Türkçe arayüz. Üst barda
kalıcı **₺ / €** geçişi vardır.

---

## Tasarım Dosyaları Hakkında (About the Design Files)
Bu paketteki dosyalar **HTML ile üretilmiş tasarım referanslarıdır** — amaçlanan görünümü ve
davranışı gösteren prototiplerdir; doğrudan kopyalanacak production kodu **değildir**.

Görev: bu HTML tasarımlarını **hedef kod tabanının mevcut ortamında yeniden oluşturmaktır**
(React, Vue, Next.js, SwiftUI vb.), o ortamın yerleşik desen ve kütüphanelerini kullanarak.
Henüz bir ortam yoksa, proje için en uygun framework seçilip tasarımlar orada uygulanmalıdır.
(Öneri: i18n'e hazır bir React/Next.js kurulumu; arayüz tamamen Türkçe, ileride DE/diaspora varyantı planlanıyor.)

CSS değişkenleri (design tokens) hâlihazırda `assets/themes.css` içinde tanımlı ve doğrudan bir
tasarım sistemine çevrilmeye uygundur.

---

## Fidelity
**Yüksek (hifi).** Renkler, tipografi, boşluklar, etkileşimler ve durumlar finaldir. UI
piksel hassasiyetinde, kod tabanının mevcut kütüphane ve desenleriyle yeniden oluşturulmalıdır.

> Not: Üç görsel yön (A · Bahçe, B · Hat & Geometri, C · Modern Sakin) keşfedildi ve
> **C · Modern Sakin** seçildi. Üç sayfa da `data-theme="c"` ile sunulur. A ve B temaları
> `assets/themes.css` içinde korunmuştur (referans/karşılaştırma amaçlı); production'da yalnız C gerekli.

---

## Görsel Sistem (seçilen yön: C · Modern Sakin)

### Renkler (Design Tokens — `[data-theme="c"]`)
| Rol | Değişken | Hex |
|---|---|---|
| Arka plan | `--bg` | `#FAF7F0` |
| İkincil arka plan (tint bölümler) | `--bg-2` | `#F1ECDF` |
| Yüzey (kartlar, inputlar) | `--surface` | `#FFFFFF` |
| Ana metin | `--ink` | `#1E231C` |
| İkincil metin | `--ink-2` | `#6A7062` |
| Soluk metin / placeholder | `--ink-3` | `#9AA08F` |
| Kenarlık | `--line` | `#E5DECC` |
| Yumuşak kenarlık | `--line-soft` | `#EFE9DA` |
| Birincil (zeytin) | `--primary` | `#53684A` |
| Koyu birincil | `--primary-deep` | `#3C4D35` |
| Aksan | `--accent` | `#7E8C66` |
| Birincil üzeri metin | `--on-primary` | `#F7F4EC` |
| Hata (kırmızı toprak) | — | `#A8472F` |
| Uyarı/bekleme (hardal) arka/metin | — | `#F0E6CF` / `#8A6D1F` |

Tüm tonlar düşük doygunlukta ve sıcaktır. Yeni renkler `color-mix(in srgb, var(--primary) N%, var(--surface))`
ile türetilir — örn. seçili kart arka planı `--primary 7%` ile karışım.

### Tipografi
- **Başlık (display):** `Newsreader` (Google Fonts), opsz 6..72, ağırlık 400/500/600. `--display-weight: 500`.
- **Gövde (body):** `Hanken Grotesk` (Google Fonts), ağırlık 400/500/600/700.
- **Mono (etiket, koordinat, tarih):** `IBM Plex Mono`, 400/500.
- Başlık harf aralığı `--h-tracking: -0.018em`. Eyebrow harf aralığı `--eyebrow-tracking: 0.22em`, uppercase.
- Gövde temel boyut: `17px`, satır yüksekliği `1.6`.
- Başlık ölçekleri `clamp()` ile akışkan; örn. hero H1 `clamp(2.5rem, 5.2vw, 4.3rem)`, bölüm H2 `clamp(1.9rem, 3.4vw, 2.9rem)`.

### Boşluk, köşe, gölge
- Maksimum içerik genişliği `--maxw: 1180px`; sayfa kenar boşluğu `--gutter: clamp(20px, 5vw, 64px)`.
- Bölüm dikey boşluğu `clamp(64px, 8vw, 116px)`.
- Köşe yarıçapı: `--radius: 8px`, `--radius-sm: 6px`, pill `999px`.
- Easing: `--ease: cubic-bezier(.22, .61, .36, 1)` (tüm geçişlerde kullanılır).
- Tipik kart gölgesi: `0 24px 50px -34px rgba(40,55,30,.4)` (hover'da derinleşir).

### İkonografi & Görseller
- Tüm ikonlar küçük, çizgisel (stroke) **inline SVG**'dir; `currentColor` kullanır. Üretimde
  mevcut ikon kütüphanesiyle (örn. Lucide) eşdeğer çizgi ikonlarla değiştirilebilir.
- Fotoğraflar **placeholder**'dır: `.ph` sınıfı, zeytin tonlu çapraz şerit (`repeating-linear-gradient`)
  ve monospace etiket (`data-label`). Üretimde gerçek, sahada çekilmiş fotoğraflarla doldurulur.

---

## Ekranlar / Görünümler (Screens / Views)

### 1) Ana Sayfa — `GüzelKabir — Ana Sayfa.html`
**Amaç:** Ziyaretçiyi "Kabir Bakımı Başlat" akışına dönüştürmek; güven inşa etmek.

**Düzen (yukarıdan aşağıya):**
- **Üst bar (sticky):** 72px yükseklik, blur arka plan. Sol: logo + marka adı. Orta: nav
  (Nasıl çalışır, Şeffaflık, Paketler, Mezarlıklar, S.S.S.). Sağ: ₺/€ geçişi + "Kabir Bakımı Başlat" (birincil buton → Sipariş Akışı).
- **Hero:** 2 sütun grid `1.05fr .95fr`. Sol: eyebrow + H1 ("Sevdiklerinizin kabri, *vefa ile bakımlı.*") + lead +
  iki CTA + güven notu + 3 küçük güven öğesi. Sağ: 4:5 oranlı foto placeholder; üzerinde "Konum doğrulandı"
  + GPS koordinatı rozeti.
- **Güven şeridi:** 4 hücreli grid (1px hairline ayraçlı), her hücre ikon + başlık + açıklama.
- **Nasıl Çalışır:** 4 adımlı grid; büyük serif numara + başlık + açıklama. Adım ayraçları dikey hairline.
- **Şeffaflık:** 2 sütun `1.1fr .9fr`. Sol: **interaktif önce/sonra slider** (`.ba`) + GPS/zaman damgalı stamp.
  Sağ: 3 "kanıt" maddesi (ikon + başlık + paragraf).
- **Paketler:** 3 sütun. Orta kart (Aylık) "Öne çıkan" rozetli ve birincil kenarlıklı (`.featured`).
  Fiyatlar `data-try`/`data-eur` ile ₺/€ duyarlı. Özellik listesi ✓ / ○ ile.
- **Yorum:** ortalanmış büyük serif blockquote + atıf.
- **Mezarlıklar:** 4 kartlı grid (Zincirlikuyu, Karacaahmet, Edirnekapı, Eyüpsultan) + rol açıklaması.
- **S.S.S.:** akordeon (tek seferde tek açık), ilk madde açık başlar.
- **CTA bandı:** koyu zeytin (`--primary-deep`) zemin, soluk geometrik doku, ortalanmış başlık + buton.
- **Footer:** 4 sütun (marka + 3 link grubu) + alt satır.
- **Yön anahtarı (sağ alt, sabit):** A · B · C — yalnızca tasarım keşfi içindir, **üretimde dahil edilmez**.

**Önemli kopya (exact):** Hero başlığı, alt metin, güven şeridi, 4 adım, 3 kanıt, paket özellikleri,
yorum ve 5 SSS maddesi HTML'de birebir mevcuttur ve sabittir.

### 2) Sipariş Akışı — `GüzelKabir — Sipariş Akışı.html`
**Amaç:** Bakım talebini 5 adımda toplamak. En kritik dönüşüm ekranı.

**Düzen:** 2 sütun `1fr 360px` (sol akış, sağ yapışkan özet, top: 92px sticky). 900px altında tek sütun
ve özet yukarı taşınır (`order: -1`).

**Adım göstergesi (stepper):** 5 node + aralarında bar. Aktif node dolu daire (`--primary`),
tamamlananlar açık dolgulu, bar `done` olunca yeşil.

**Adımlar:**
1. **Konum** — İl (kilitli: İstanbul), İlçe (select), **Mezarlık** (4 radyo kart), **Ada**/**Parsel** (input).
   "Ada/parsel bilmiyorum — yardım isteyin" kutusu işaretlenince zorunlu alanlar soluklaşır (`opacity .45; pointer-events:none`),
   serbest metin alanı açılır ve doğrulama atlanır.
2. **Paket** — 3 radyo kart (Tek/Aylık-öne çıkan/Yıllık), seçili kartta birincil kenarlık + glow + ✓ rozeti.
   Opsiyonel "Mevsimlik çiçek" checkbox (+₺250/+€8). Fiyatlar ₺/€ duyarlı.
3. **Merhum** — Ad Soyad (zorunlu), Vefat tarihi (zorunlu, `type=date`), Yakınlık (opsiyonel select),
   "Yıldönümü hatırlatması" checkbox (varsayılan açık).
4. **Özet & Ödeme** — yöntem segmenti (Kart / SEPA), kart alanları (ad, no, son kullanma, CVC — hepsi zorunlu).
   Bilgi notu: prototipte gerçek ödeme alınmaz; yayında ücret onaydan sonra aktarılır.
5. **Onay** — yeşil mühür + "Talebiniz alındı" + "Bundan sonra ne olacak?" 3 adımı + "Panele git" (→ Müşteri Paneli).

**Sağ özet (canlı):** mezarlık, konum, merhum, paket (+birim), çiçek satırı (koşullu), **Toplam** (paket + çiçek),
güven notu + 3 mini güven rozeti. Boş değerler italik soluk "—".

**Doğrulama kuralları:** her adımda "Devam et" tıklanınca ilgili zorunlu alanlar kontrol edilir;
eksikse `.invalid` (kırmızı kenarlık + glow) ve alanın `.err` mesajı görünür. Adım 1'de "yardım" yolu
seçiliyse ada/parsel zorunlu değildir, mezarlık da serbesttir (ekip tespit eder).

### 3) Müşteri Paneli — `GüzelKabir — Müşteri Paneli.html`
**Amaç:** Onay döngüsünün kalbi — müşteri kanıtı görür, onaylar, ödeme serbest bırakılır.

**Düzen:** Üst bar (marka + nav + ₺/€ + kullanıcı avatarı). Selam başlığı ("Merhaba, Murat" + durum rozeti
"1 bakım onayınızı bekliyor", nabız animasyonlu). Altında 2 sütun `1fr 340px`.

**Sol sütun:**
- **Onayınızı bekliyor** — vurgulu kart (`1.5px` birincil kenarlık): solda önce/sonra slider, sağda
  rozet + başlık + meta (konum, tarih) + "İncele ve onayla" (→ detay overlay, `data-status="wait"`).
- **Aktif bakımlar** — planlanmış satırlar (`pill.scheduled`), tıklanınca read-only overlay.
- **Geçmiş bakımlar** — onaylı satırlar (`pill.done`), tıklanınca read-only (onaylı) overlay.

**Sağ sütun (aside):**
- **Aboneliğiniz** kartı — tutar (₺/€ duyarlı), sonraki yenileme, ödeme yöntemi; **Duraklat** / **İptal et**
  butonları durum kutusunu (`.sub-state` paused/cancel) gösterir/gizler.
- **Yıldönümü hatırlatma** kartı (memory, zeytin tonlu) + "Özel bakım planla" (→ Sipariş Akışı).
- "Her bakımda" mini güven listesi.

**Detay Overlay (sağdan kayan panel, `min(640px, 94vw)`):**
- Üst: başlık + kapat (X). Esc / arka plan tıklaması kapatır; açıkken body scroll kilitlenir.
- Gövde: büyük önce/sonra slider (GPS stamp ile) → meta grid (konum, tarih, merhum, GPS eşleşti) →
  usta notu kartı (avatar + ad + rol).
- **Onay kutusu** (yalnız `wait`): "✓ Onayla, ödemeyi aktar" (birincil) + "Eksik var, yeniden yapılsın" (ghost).
- **Onaylandı durumu**: yeşil mühür + mesaj. "Yeniden yapılsın" hardal mühür + farklı mesaj.

---

## Etkileşimler & Davranış (Interactions & Behavior)
- **Önce/Sonra slider (`.ba`):** pointer ile sürükle; `--pos` CSS değişkeni (%4–%96 sınırlı) `clip-path: inset()`
  ile "önce" katmanını kırpar. Handle ortada dairesel grip.
- **₺/€ geçişi:** `[data-try]`/`[data-eur]` (ve akışta `[data-per-try]`/`[data-per-eur]`) metinleri değiştirir;
  seçim `localStorage["gk-cur"]` ile kalıcı. Akışta toplam yeniden hesaplanır.
- **Sihirbaz navigasyonu:** `[data-next]` doğrulama geçerse sonraki adıma; `[data-back]` geri. Adım `localStorage["gk-flow-step"]`.
  Adım değişince yumuşak `scrollTo top`. Panel geçişi `fadeUp .45s` animasyonu.
- **Akordeon (SSS):** tek açık; açılan içeriğin yüksekliği JS ile ölçülüp `height` animasyonu (`.35s`).
- **Detay overlay:** `slideIn .4s`; arka plan `fade .3s` + blur. Onayla → onay bekleyen bölüm `.4s` sonra
  fade-out + display:none; üst rozet "✓ Tüm bakımlarınız güncel"e döner; geçmiş sayacı güncellenir.
- **Abonelik:** Duraklat/Devam ettir toggle; İptal et dönem-sonu iptal kutusu. Salt görsel durum.
- **reveal-on-scroll:** `.reveal` öğeleri IntersectionObserver ile `.in` alır (opacity + translateY).
- **Hover:** butonlar `translateY(-2px)` + gölge; kartlar `translateY(-3/-4px)`; nav linkleri alt çizgi büyür.
- **Yön anahtarı:** `data-theme` değiştirir, `localStorage["gk-dir"]`. **Üretimde kaldırılır** (C sabit).

## Durum Yönetimi (State Management)
- **Akış (`wizard.js`):** `{ step, cur, cemetery, ada, parsel, helpNeeded, plan, flower, deceased }`.
  Fiyat verisi `PLANS` (try/eur/unit) + `FLOWER`. Özet ve toplam türetilmiş değerdir.
- **Panel (`panel.js`):** seçilen bakımın detay verisi `data-*` attribute'larından okunur; onay durumu (`wait`/`done`),
  abonelik durumu (`active`/`paused`/`cancel`) yerel UI state'idir.
- Üretimde: bakımlar, abonelik, ödeme, kullanıcı için gerçek API/auth gerekir; ödeme onaydan sonra serbest bırakılır
  (escrow mantığı). Fotoğraflar sahada canlı, GPS parsel ile eşleşmeli, değiştirilemez zaman damgalı (anti-fraud — bkz. spec §7).

## Responsive
- Masaüstü öncelikli. Kırılımlar: `980px` (homepage gridleri tek/iki sütuna), `900px` (akış & panel tek sütun),
  `720px` (stepper etiketleri gizlenir), `540px` (tek sütun listeler, daraltılmış üst bar).

## Assets
- **Fontlar:** Google Fonts — Newsreader, Hanken Grotesk, IBM Plex Mono (ayrıca A/B temaları için
  Spectral, Cormorant Garamond, Source Sans 3, IBM Plex Sans — C kullanılırsa gereksiz).
- **İkonlar:** inline SVG (stroke, currentColor). Marka logosu da inline SVG (sade lale/servi + zemin motifi).
- **Görüntüler:** yok — hepsi `.ph` placeholder. Üretimde gerçek önce/sonra fotoğraflarıyla doldurulacak.

## Dosyalar (Files)
```
GüzelKabir — Ana Sayfa.html        # Ana sayfa
GüzelKabir — Sipariş Akışı.html    # 5 adımlı sipariş sihirbazı
GüzelKabir — Müşteri Paneli.html   # Müşteri paneli (onay döngüsü)
assets/themes.css                   # Design tokens + 3 yön (A/B/C) + yöne özgü dekor
assets/base.css                     # Reset, düzen, ortak bileşenler, slider, paketler, footer
assets/app.js                       # Ana sayfa: yön anahtarı, ₺/€, slider, SSS
assets/wizard.css / wizard.js       # Sipariş akışı düzeni + mantığı
assets/panel.css / panel.js         # Müşteri paneli düzeni + mantığı
```

> Production'a geçerken: yön anahtarını ve A/B temalarını çıkarın, C tokenlarını tasarım sistemine taşıyın,
> placeholder'ları gerçek fotoğraflarla değiştirin, ödeme/auth/anti-fraud akışlarını gerçek servislere bağlayın.
