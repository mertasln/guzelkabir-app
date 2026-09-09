import type { NextConfig } from "next";

// ADIM 12 (spec §13 deploy devamı): statik export olarak deploy ediliyor —
// bkz. CLAUDE.md "Deployment (apps/web)" bölümü. Gerekçe kısaca: app/api
// route'u, middleware.ts, ya da next/headers/revalidatePath gibi sunucuya
// özel dinamik API'lerin hiçbiri kullanılmıyor (doğrulandı) — tüm
// interaktivite/veri çekme zaten apps/api'ye karşı client-side çalışıyor
// (lib/api.ts). Bu yüzden gerçek bir Node sunucusu/container yerine, build
// çıktısı (out/) doğrudan nginx tarafından statik dosya olarak servis
// ediliyor — paylaşılan droplet'te bir process daha yok.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
