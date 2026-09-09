# GüzelKabir — production deploy (spec §13, ADIM 11: apps/api, ADIM 12: apps/web)

Paylaşılan bir DigitalOcean droplet'e (Ubuntu 24.04, üzerinde zaten aktif nginx/node@3000/uvicorn@8000 var — hiçbirine dokunulmuyor). Bkz. `CLAUDE.md`'nin "Deployment" bölümü, kararların gerekçesi için.

Bu dosya yalnızca "nasıl" — "neden" için CLAUDE.md/HANDOVER.md'ye bakın.

## 1. Droplet üzerinde tek seferlik kurulum (root/opsadmin ile, elle)

```bash
# Docker + Compose plugin (Ubuntu 24.04 resmi Docker apt repo'su)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker opsadmin   # opsadmin sudo olmadan docker çalıştırabilsin

# Repo'yu klonla (deploy script'inin beklediği sabit yol)
sudo mkdir -p /opt/guzelkabir
sudo chown opsadmin:opsadmin /opt/guzelkabir
git clone https://github.com/mertasln/guzelkabir-app.git /opt/guzelkabir
cd /opt/guzelkabir

# Doppler CLI (secrets için — bkz. aşağıdaki "Doppler" bölümü)
curl -Ls https://cli.doppler.com/install.sh | sudo sh
```

**Deploy SSH kullanıcısı/anahtarı** (GitHub Actions'ın kullanacağı, `opsadmin`'in kendisinden ayrı tutulması ÖNERİLİR ama zorunlu değil — basitlik için doğrudan `opsadmin` da kullanılabilir):

**⚠️ Sertleştirme (kullanıcı talebi) — bu key'e sınırsız shell VERME.** Droplet paylaşılan (nginx/node@3000/uvicorn@8000 de burada) — bu key sızarsa (ör. `DEPLOY_SSH_KEY` GitHub secret'ı sızarsa), sınırsız bir `opsadmin` shell'i etki alanını tüm droplet'e genişletir, yalnızca GüzelKabir'e değil. Bunun yerine `authorized_keys` satırına bir `command=` zorlaması ekle — bu key ile açılan HER oturum, istemci ne gönderirse göndersin, SADECE `deploy/remote-deploy.sh`'ı çalıştırabilir, genel bir shell açamaz:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/guzelkabir-deploy -N ""

PUBKEY=$(cat ~/.ssh/guzelkabir-deploy.pub)
echo "command=\"/bin/bash /opt/guzelkabir/deploy/remote-deploy.sh\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $PUBKEY" >> ~/.ssh/authorized_keys

cat ~/.ssh/guzelkabir-deploy   # bunun İÇERİĞİNİ GitHub secret'ı DEPLOY_SSH_KEY'e kopyala
```

Deploy mantığını değiştirmek istersen `.github/workflows/deploy-api.yml`'i değil, `deploy/remote-deploy.sh`'ı güncelle — workflow'un gönderdiği komut içeriği bu zorlama tarafından sunucu tarafında yok sayılıyor, `git pull` her deploy'da script'in kendisini de günceller.

**apps/web için AYRI, kendi forced-command key'i (ADIM 12) — `guzelkabir-deploy` (yukarıdaki) ile KARIŞTIRMAYIN.** apps/web statik export olarak deploy ediliyor (build GitHub Actions'ta yapılıyor, droplette Node YOK) — `remote-deploy-web.sh` bir tarball'ı stdin'den okuyup `/var/www/guzelkabir-web`'e açıyor, `remote-deploy.sh` gibi `git pull` yapmıyor. Per-purpose key ayrımı: bu key sızsa bile yalnızca web dizinini değiştirebilir, apps/api container'larına/veritabanına dokunamaz — aynı gerekçe, ayrı anahtar:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/guzelkabir-deploy-web -N ""

PUBKEY=$(cat ~/.ssh/guzelkabir-deploy-web.pub)
echo "command=\"/bin/bash /opt/guzelkabir/deploy/remote-deploy-web.sh\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $PUBKEY" >> ~/.ssh/authorized_keys

cat ~/.ssh/guzelkabir-deploy-web   # bunun İÇERİĞİNİ GitHub secret'ı DEPLOY_SSH_KEY_WEB'e kopyala
```

`remote-deploy-web.sh` `rsync` kullanıyor — droplette kurulu değilse: `sudo apt-get install -y rsync`. Web dizinini de şimdi oluştur:
```bash
sudo mkdir -p /var/www/guzelkabir-web
sudo chown opsadmin:opsadmin /var/www/guzelkabir-web
```

## 2. nginx + certbot (mevcut nginx'e YENİ bir server block ekleniyor, var olanlara dokunulmuyor)

**Droplet'in gerçek nginx durumu doğrulandı (kullanıcı tarafından kontrol edildi) — iki mevcut config var:**
- `yakupmertaslan.com` — kendi domain'ine özel `server_name`, `default_server` DEĞİL, sorun yok.
- `berber` — **`default_server`** olarak işaretli (`listen 80 default_server; server_name _;`) — eşleşmeyen TÜM istekler şu an buraya düşüyor.

**Kural: GüzelKabir'in üç config'inden (api/admin/web) hiçbiri `default_server` bildirmez, hiçbiri `berber`'e dokunmaz.** Her birinin `server_name`'i tam ve kesin (`api.guzelkabir.com`, `admin.guzelkabir.com`, `guzelkabir.com`+`www.guzelkabir.com`) — nginx, `Host` header'ı bu isimlerden biriyle birebir eşleşmeyen hiçbir isteği bu server block'lara yönlendirmez, `berber`'in `default_server` statüsü değişmeden kalır. `deploy/nginx/*.conf`/`*.conf.example` dosyalarının her biri bunu üstteki yorumda tekrar doğruluyor — yeni bir subdomain eklenirse aynı disiplin (tam `server_name`, asla `default_server`) korunmalı.

Domain gerçek ve DNS tam yayıldı (kullanıcı doğruladı — üç subdomain de `165.227.204.8`'e çözümleniyor), dosyadaki `api.guzelkabir.com` değerine dokunmaya gerek yok:

```bash
sudo cp /opt/guzelkabir/deploy/nginx/api.guzelkabir.com.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/api.guzelkabir.com.conf /etc/nginx/sites-enabled/
sudo nginx -t          # mevcut config'i (yakupmertaslan.com, berber) BOZMADIĞINI doğrula
sudo systemctl reload nginx
sudo certbot --nginx -d api.guzelkabir.com   # yalnızca bu domain'e ait server block'u düzenler
```

O sırada **yalnızca `api.guzelkabir.com` için** sertifika alınmıştı — `guzelkabir.com` şimdi (ADIM 12) hazır, `admin.guzelkabir.com` hâlâ bilinçli olarak dışarıda (apps/admin'in henüz gerçek bir deploy hikayesi yok — `admin.guzelkabir.com.conf.example` hâlâ `.example`, `sites-enabled`'a bağlanmasın).

**apps/web'i etkinleştir (ADIM 12) — `berber`'e dokunmadan, dört bağımsız server block (http+https × apex+www):**

⚠️ **Gerçek bug, canlı testte bulundu ve düzeltildi — `certbot --nginx -d ... -d ...`'in KENDİ otomatik HTTP→HTTPS redirect mantığı, www block'undaki bizim apex'e-yönlendirme gövdemizi KENDİ "aynı host'a yönlendir" davranışıyla EZMİŞTİ** (`curl -I http://www.guzelkabir.com` apex yerine www'nin kendisine (https) yönlendiriyordu). `deploy/nginx/web.guzelkabir.com.conf` artık HTTP+HTTPS'in DÖRDÜNÜ de (apex×www) kendi içinde elle tanımlıyor — certbot'un rolü artık yalnızca sertifika ÜRETMEK, bu dosyanın redirect/serving mantığını bir daha DÜZENLEMEMELİ.

**Sertifika henüz yoksa (ilk kurulum), önce `certonly` ile İZOLE üret — düzenleyen `--nginx` modu DEĞİL:**
```bash
sudo certbot certonly --nginx -d guzelkabir.com -d www.guzelkabir.com
```
`certonly`, ACME doğrulaması için nginx'i geçici olarak kullanır ama server block'ların gövdesini HİÇ düzenlemez — yalnızca `/etc/letsencrypt/live/guzelkabir.com/`'a sertifika dosyalarını yazar (lineage adı ilk `-d` domain'inden gelir — farklıysa `sudo certbot certificates` ile doğrula ve `deploy/nginx/web.guzelkabir.com.conf`'taki `ssl_certificate` yollarını ona göre düzelt). Sertifika zaten varsa (mevcut durum) bu adımı atla.

**Sonra bizim tam config'i deploy et (certbot'un daha önce düzenlediği eski hâlin TAMAMEN YERİNE):**
```bash
sudo cp /opt/guzelkabir/deploy/nginx/web.guzelkabir.com.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/web.guzelkabir.com.conf /etc/nginx/sites-enabled/
sudo nginx -t          # mevcut config'i (api.guzelkabir.com, yakupmertaslan.com, berber) BOZMADIĞINI doğrula
sudo systemctl reload nginx
```

**⚠️ "Doğru olmalı" bir varsayımdır, kanıt değil — reload sonrası gerçekten doğrula:**
```bash
curl -I http://www.guzelkabir.com     # beklenen: 301, Location: https://guzelkabir.com/
curl -I https://www.guzelkabir.com    # beklenen: 301 (SSL hatası YOK), Location: https://guzelkabir.com/
curl -I http://guzelkabir.com         # beklenen: 301, Location: https://guzelkabir.com/
curl -I https://guzelkabir.com        # beklenen: 200 (deploy henüz yapılmadıysa 403 — bkz. CLAUDE.md "apps/web (ADIM 12)" notu, /var/www/guzelkabir-web boş olduğu için beklenen davranış, bir config hatası değil)
```
Dördü de beklenen çıktıyı vermeden bu ADIM'ı "doğrulandı" saymayın.

Let's Encrypt'in haftalık limiti (registered domain başına 50 sertifika, tüm subdomain'ler dahil) toplam 3-4 sertifika için gerçek bir kısıt değil — `admin.guzelkabir.com`'u ileride ayrı almanın maliyeti yok.

## 3. Doppler — proje kurulumu

Proje `guzelkabir-api`, config `prd`, aşağıdaki değişkenler (kullanıcı doğrudan Doppler dashboard'undan girecek, assistant'a gösterilmez — iyzico/AWS ile aynı protokol):

**`apps/api/.env.example`'daki her değişken** (`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`, `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_URI`, `IYZICO_CALLBACK_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_EVIDENCE_BUCKET`, `S3_EVIDENCE_STAGING_BUCKET`, `EVIDENCE_CDN_BASE_URL`, `GEOTAG_DEFAULT_TOLERANCE_M`, `NETGSM_USERNAME`, `NETGSM_PASSWORD`, `NETGSM_MSGHEADER`, `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`, `KMS_KEY_ID_PII`, `WHATSAPP_BUSINESS_TOKEN`, `SENTRY_DSN`, `GOOGLE_MAPS_API_KEY`).

**Ek 3 değişken — daha önceki Doppler rehberinde eksikti, `docker-compose.yml`'i yazarken ortaya çıktı**: Postgres container'ının kendisi ilk açılışta kendini bu üçüyle initialize ediyor (Prisma'nın `DATABASE_URL`'i içindeki kullanıcı/şifre/DB adıyla AYNI olmalı):
- `POSTGRES_USER` — örn. `guzelkabir`
- `POSTGRES_PASSWORD` — `DATABASE_URL` içindeki şifreyle birebir aynı
- `POSTGRES_DB` — örn. `guzelkabir` (`DATABASE_URL`'in path'iyle aynı)

`DATABASE_URL`/`REDIS_URL`'in host kısmı `postgres`/`redis` olmalı (Docker Compose servis adları), `localhost` DEĞİL:
```
DATABASE_URL="postgresql://guzelkabir:<POSTGRES_PASSWORD ile aynı>@postgres:5432/guzelkabir?schema=public"
REDIS_URL="redis://redis:6379"
```

**Service token — droplette yerel bir dosyada, GitHub secret'ı DEĞİL** (yukarıdaki SSH sertleştirmesinin bir sonucu): `command=` zorlamalı bir SSH oturumunda istemcinin (GitHub Actions) gönderdiği ortam değişkenlerinin güvenilir şekilde sürece ulaşacağı garanti değil, bu yüzden token'ı SSH üzerinden taşımak yerine droplette saklıyoruz.

Doppler → proje → `prd` config → Access → Service Tokens → `prd`'ye salt-okunur bir token üret, sonra droplette (`opsadmin` ile, elle, bir kere):
```bash
sudo mkdir -p /etc/guzelkabir
sudo chown opsadmin:opsadmin /etc/guzelkabir
chmod 700 /etc/guzelkabir
umask 077
echo -n "<DOPPLER_SERVICE_TOKEN>" > /etc/guzelkabir/doppler-token
chmod 600 /etc/guzelkabir/doppler-token
```

Bu dosya `/opt/guzelkabir` (git repo) DIŞINDA — `git fetch`/`git reset --hard` asla dokunmaz, commit edilme riski yok. Droplet'e ulaşan TEK secret bu — gerçek uygulama değerleri (DATABASE_URL, iyzico anahtarları vb.) hiçbir zaman bir dosyaya yazılmıyor, her deploy'da Doppler'dan canlı çekiliyor; yalnızca bu tek servis token'ı yerel, kilitli bir dosyada duruyor (zaten salt-okunur + yalnızca `prd` config ile sınırlı kapsamlı).

## 4. GitHub repo ayarları (kullanıcı elle yapmalı, dosyadan yapılamaz)

- **Settings → Environments → New environment → `production`** → "Required reviewers" ekle (spec §13.1'in "manuel onaylı deploy" gereksinimi tam olarak bu).
- **Settings → Secrets and variables → Actions**, şu secret'ları ekle:
  - `DEPLOY_SSH_HOST` — droplet IP/hostname (her iki workflow da aynısını kullanır)
  - `DEPLOY_SSH_USER` — `opsadmin` (her iki workflow da aynısını kullanır)
  - `DEPLOY_SSH_PORT` — genelde `22`, farklıysa belirt (opsiyonel, workflow varsayılan 22 kullanır; her iki workflow da aynısını kullanır)
  - `DEPLOY_SSH_KEY` — `guzelkabir-deploy` private key'in TAM içeriği — **yalnızca `deploy-api.yml`'in kullandığı** (§1'deki `command=` zorlamasıyla eşleşen anahtar — sızsa bile yalnızca `deploy/remote-deploy.sh`'ı çalıştırabilir)
  - `DEPLOY_SSH_KEY_WEB` — `guzelkabir-deploy-web` private key'in TAM içeriği — **yalnızca `deploy-web.yml`'in kullandığı**, `DEPLOY_SSH_KEY` ile AYNI DEĞİL (§1'deki ikinci `command=` zorlamasıyla eşleşen, ayrı anahtar — sızsa bile yalnızca `remote-deploy-web.sh`'ı çalıştırabilir, apps/api'ye dokunamaz)
  - `DATABASE_URL` — `ci.yml`'in zaten kullandığı sahte placeholder secret'ın AYNISI, `deploy-web.yml`'de de kullanılıyor (kök `npm ci`, apps/api'nin `postinstall`'ını da tetikliyor — `prisma generate` gerçek bir bağlantı kurmuyor, yalnızca tanımlı bir değer istiyor)

  **`DOPPLER_TOKEN` burada YOK** — §3'teki sertleştirme sonrası droplette `/etc/guzelkabir/doppler-token`'da yerel olarak duruyor, GitHub'a hiç taşınmıyor. **apps/web'in Doppler'a hiç ihtiyacı yok** — tek build-time değeri (`NEXT_PUBLIC_API_URL`) gizli değil, `deploy-web.yml`'in içinde düz metin olarak duruyor.

## 5. Deploy nasıl tetiklenir

`main`'deki `CI` workflow'u (lint/typecheck/build) BAŞARIYLA bittiğinde **hem** `deploy-api.yml` **hem** `deploy-web.yml` otomatik tetiklenir (CI kırmızıysa hiçbiri başlamaz) — ikisi de bağımsız, `production` environment'ının "required reviewers" onayını ayrı ayrı bekler (spec §13.1). Şu an ikisi de her CI başarısında tetikleniyor (path-filtreleme yok — yalnızca apps/web değişse bile deploy-api.yml da tetiklenir, ve tersi; küçük bir verimsizlik, gelecekte `paths:` filtresiyle iyileştirilebilir, şu an flaglenmiş bir basitleştirme).

- **`deploy-api.yml`**: onaylandıktan sonra GitHub Actions SSH'a bağlanır, ama §1'deki `command=` zorlaması nedeniyle workflow'un gönderdiği komut önemsiz — droplette gerçekte çalışan her zaman `deploy/remote-deploy.sh`'tır: `git pull` → `docker compose build` → `prisma migrate deploy` → `docker compose up -d` → `/api/v1/health` smoke check.
- **`deploy-web.yml`**: build (statik export) ve doğrulama (`NEXT_PUBLIC_API_URL`'in gerçekten gömüldüğü kontrolü) GitHub Actions'ın kendi runner'ında olur — droplete yalnızca bitmiş `out/` dizini bir tarball olarak, `guzelkabir-deploy-web` anahtarı üzerinden stdin'den akıtılır; `remote-deploy-web.sh` onu `/var/www/guzelkabir-web`'e açar.

**Manuel deploy** (acil durum, CI olmadan): Actions sekmesinden `Deploy API (production)` ya da `Deploy Web (production)` workflow'unu `workflow_dispatch` ile elle tetikleyebilirsin — ikisi de aynı onay kapısından geçer.

## Bilinçli basitleştirmeler (spec §13.2'den sapma, flaglenmiş)

- **GHCR image push/pull yok** — droplet üzerinde doğrudan `git pull` + `docker compose build`. Ek bir registry-auth secret'ı gerektirmeden pilot ölçeğinde yeterli; bkz. `deploy-api.yml`'in üst yorumu.
- **Ayrı bir staging ortamı yok** — spec §13.1'in üç-ortam modeli (local/staging/production) bu ADIM'da yalnızca local+production olarak kuruldu. Staging, ayrı bir droplet/App Platform kaynağı gerektirir — bu ADIM'ın kapsamında sağlanmadı, "Before going live" listesine eklenmeli.
- **Playwright smoke test yok** — yalnızca bir `curl /api/v1/health` kontrolü. Gerçek bir staging+Playwright akışı, yukarıdaki staging boşluğu kapatılınca anlamlı olur.
- **`deploy-web.yml`'de `rsync --delete`, symlink-swap bir `releases/` deseni değil** — tarball önce geçici bir dizine açılıp doğrulandıktan (`index.html` var mı) sonra `rsync -a --delete` ile `/var/www/guzelkabir-web`'e uygulanıyor. Mükemmel atomik değil (senkron sırasında bir istek teorik olarak yarı-güncellenmiş bir dizin görebilir) — pilot ölçekte bu, bir symlink-swap deseninin ek karmaşıklığına değmeyen, kabul edilmiş bir basitleştirme.
- **`deploy-api.yml`/`deploy-web.yml`'de `paths:` filtresi yok** — ikisi de her CI başarısında tetikleniyor, değişen dizinden bağımsız. `production` environment'ının onay kapısı zaten her deploy'u elle onaylatıyor, o yüzden gereksiz bir otomatik deploy'un pratik riski düşük — ama gelecekte gürültüyü azaltmak için `paths: ['apps/api/**']`/`['apps/web/**']` eklenebilir.
