# Production image for apps/api (NestJS backend) — spec §13, ADIM 11 deploy.
#
# Tek aşamalı (multi-stage DEĞİL) bir build — kasıtlı bir basitlik tercihi,
# icat edilmiş bir kısayol değil: bu monorepo'da Prisma client'ı apps/api'nin
# KENDİ node_modules/.prisma altına üretiyor, root'a hoist edilmiyor (bkz.
# CLAUDE.md "npm install/npm ci... reliably run apps/api'nin postinstall'ı"
# notu). Çok aşamalı bir build'de bu yolu COPY --from ile doğru taşımak, bu
# sandbox'ta gerçek Docker olmadan test edilemeden riskli bir varsayım
# olurdu. Bu image, CI'nin (.github/workflows/ci.yml) zaten kanıtlanmış
# kurduğu adımların (root `npm ci` → `npm run build --workspace=apps/api`)
# birebir aynısını izliyor. İmaj boyutu optimize edilmemiş (dev bağımlılıkları
# ve diğer apps'in node_modules'ı da image'da kalıyor) — bu, gerçek bir
# deploy sonrası ayrı, düşük riskli bir optimizasyon adımı olarak ele
# alınmalı, ilk çalışan deploy'u riske atmamak için şimdi yapılmadı.

FROM node:22-alpine

WORKDIR /app

# Prisma'nın query engine binary'si alpine'in musl libc'sinde openssl'e
# ihtiyaç duyuyor.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages

# postinstall (root → apps/api'ye delege eder → prisma generate) npm ci
# sırasında otomatik çalışır. apps/api/prisma.config.ts, dotenv/config'i
# import ettikten sonra `env("DATABASE_URL")` (bkz. @prisma/config'in kaynağı,
# apps/api/node_modules/@prisma/config/dist/index.js) çağırıyor — bu düz
# `process.env.DATABASE_URL` okuyup boşsa fırlatıyor, gerçek bir bağlantı
# KURMUYOR, yalnızca şemayı okuyup client tiplerini üretiyor (aynı gerekçeyle
# .github/workflows/ci.yml'in lint-typecheck-build job'ında da sahte bir
# DATABASE_URL kullanılıyor).
#
# ⚠️ Düzeltilmiş gerçek hata: `ARG DATABASE_URL=...` TEK BAŞINA yeterli
# DEĞİL — ARG değeri yalnızca o Dockerfile satırının METNİ içinde `$VAR` ile
# referans verilirse görünür, `RUN npm ci` komutunun kendi process ortamına
# OTOMATİK enjekte edilmiyor (ilk denemede bu yanlış varsayıldı, aynı hatayı
# aynen tekrarlattı). Bu yüzden aşağıda ARG'ı doğrudan RUN'un komut satırına
# `DATABASE_URL="$DATABASE_URL"` öneki olarak veriyoruz — bu, yalnızca bu tek
# RUN adımının (ve npm ci'nin doğurduğu her alt process'in: postinstall →
# prisma generate → prisma.config.ts) process ortamına yazar. ENV
# kullanmadık (kalıcı olurdu) — gerçek DATABASE_URL yalnızca runtime'da
# docker-compose.yml'in environment: girdisi üzerinden (Doppler'dan) geliyor;
# bu sahte değer imajın hiçbir çalışan konteynerinde asla mevcut olmuyor.
# Doppler enjeksiyonu başarısız olursa uygulama runtime'da DATABASE_URL
# tanımsız olduğu için AÇIKÇA patlar — sessizce bu sahte değere bağlanmaya
# çalışmaz.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build?schema=public
RUN DATABASE_URL="$DATABASE_URL" npm ci

RUN npm run build --workspace=apps/api

ENV NODE_ENV=production
EXPOSE 3001

WORKDIR /app/apps/api
CMD ["node", "dist/main"]
