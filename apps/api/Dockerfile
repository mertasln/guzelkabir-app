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
# sırasında otomatik çalışır — bkz. yukarıdaki not.
RUN npm ci

RUN npm run build --workspace=apps/api

ENV NODE_ENV=production
EXPOSE 3001

WORKDIR /app/apps/api
CMD ["node", "dist/main"]
