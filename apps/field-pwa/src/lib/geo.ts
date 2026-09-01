// apps/api/src/orders/evidence-geo.util.ts'deki formülle aynı (bkz. o dosya) —
// burada yalnızca "Başla" ekranında YUMUŞAK bir uyarı göstermek için kullanılır.
// Gerçek/bağlayıcı doğrulama zaten sunucu tarafında, kanıt yüklemesinde EXIF
// üzerinden yapılıyor (bkz. TaskDetailPage yorumu) — bu istemci tarafı kontrol
// yalnızca UX amaçlı, asla engelleyici değil.
export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function getCurrentPositionSafe(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: true },
    );
  });
}
