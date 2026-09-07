# GüzelKabir API — production deploy (spec §13, ADIM 11)

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

## 2. nginx + certbot (mevcut nginx'e YENİ bir server block ekleniyor, var olanlara dokunulmuyor)

```bash
sudo cp /opt/guzelkabir/deploy/nginx/api.guzelkabir.com.conf /etc/nginx/sites-available/
# gerçek domain alındığında dosya içindeki "api.guzelkabir.com"u değiştir
sudo ln -s /etc/nginx/sites-available/api.guzelkabir.com.conf /etc/nginx/sites-enabled/
sudo nginx -t          # mevcut config'i BOZMADIĞINI doğrula
sudo systemctl reload nginx
sudo certbot --nginx -d api.guzelkabir.com   # yalnızca bu domain'e ait server block'u düzenler
```

`web.guzelkabir.com.conf.example` / `admin.guzelkabir.com.conf.example` — henüz `sites-enabled`'a bağlanmasın, apps/web ve apps/admin bu ADIM'ın kapsamında değil (bkz. CLAUDE.md).

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
  - `DEPLOY_SSH_HOST` — droplet IP/hostname
  - `DEPLOY_SSH_USER` — `opsadmin`
  - `DEPLOY_SSH_KEY` — yukarıda üretilen `guzelkabir-deploy` private key'in TAM içeriği (§2'deki `command=` zorlamasıyla eşleşen anahtar — sızsa bile yalnızca `deploy/remote-deploy.sh`'ı çalıştırabilir, genel shell açamaz)
  - `DEPLOY_SSH_PORT` — genelde `22`, farklıysa belirt (opsiyonel, workflow varsayılan 22 kullanır)

  **`DOPPLER_TOKEN` burada YOK** — §3'teki sertleştirme sonrası droplette `/etc/guzelkabir/doppler-token`'da yerel olarak duruyor, GitHub'a hiç taşınmıyor.

## 5. Deploy nasıl tetiklenir

`main`'deki `CI` workflow'u (lint/typecheck/build) BAŞARIYLA bittiğinde `deploy-api.yml` otomatik tetiklenir (CI kırmızıysa hiç başlamaz) — ama `production` environment'ının "required reviewers" onayı gelene kadar `deploy` job'ı beklemede kalır (spec §13.1). Onaylandıktan sonra: GitHub Actions SSH'a bağlanır, ama §2'deki `command=` zorlaması nedeniyle workflow'un gönderdiği komut önemsiz — droplette gerçekte çalışan her zaman `deploy/remote-deploy.sh`'tır: `git pull` → `docker compose build` → `prisma migrate deploy` → `docker compose up -d` → `/api/v1/health` smoke check.

**Manuel deploy** (acil durum, CI olmadan): Actions sekmesinden `Deploy API (production)` workflow'unu `workflow_dispatch` ile elle tetikleyebilirsin — aynı onay kapısından geçer.

## Bilinçli basitleştirmeler (spec §13.2'den sapma, flaglenmiş)

- **GHCR image push/pull yok** — droplet üzerinde doğrudan `git pull` + `docker compose build`. Ek bir registry-auth secret'ı gerektirmeden pilot ölçeğinde yeterli; bkz. `deploy-api.yml`'in üst yorumu.
- **Ayrı bir staging ortamı yok** — spec §13.1'in üç-ortam modeli (local/staging/production) bu ADIM'da yalnızca local+production olarak kuruldu. Staging, ayrı bir droplet/App Platform kaynağı gerektirir — bu ADIM'ın kapsamında sağlanmadı, "Before going live" listesine eklenmeli.
- **Playwright smoke test yok** — yalnızca bir `curl /api/v1/health` kontrolü. Gerçek bir staging+Playwright akışı, yukarıdaki staging boşluğu kapatılınca anlamlı olur.
