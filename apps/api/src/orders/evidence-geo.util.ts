import * as exifr from 'exifr';
import type { GeotagValidationStatus } from '@prisma/client';

export type ExifData = {
  lat?: number;
  lng?: number;
  timestamp?: Date;
};

// spec §8.1 madde 15: "sharp/exifr kütüphanesi ile EXIF GPS ve timestamp
// çıkarılır". exifr.parse() varsayılan olarak GPS koordinatlarını DMS'ten
// DD'ye çevirip latitude/longitude olarak, tarihleri de Date nesnesine
// çevirip DateTimeOriginal olarak döndürür (bkz. exifr README — "Revives
// dates into Date class instances", "Converts GPS coords... to single
// latitude value"). EXIF hiç yoksa (veya bozuksa) exifr istisna fırlatabilir
// — bu durumda EXIF'in tamamen eksik olduğu kabul edilir (missing_exif).
export async function extractExifData(buffer: Buffer): Promise<ExifData> {
  const output = (await exifr.parse(buffer).catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!output) {
    return {};
  }
  const lat = output.latitude;
  const lng = output.longitude;
  const timestamp = output.DateTimeOriginal ?? output.CreateDate;
  return {
    lat: typeof lat === 'number' ? lat : undefined,
    lng: typeof lng === 'number' ? lng : undefined,
    timestamp: timestamp instanceof Date ? timestamp : undefined,
  };
}

const EARTH_RADIUS_M = 6371000;

// spec §8.1 madde 16: "Haversine formülü kullanılarak karşılaştırılır".
export function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const TIMESTAMP_MISMATCH_MS = 24 * 60 * 60 * 1000; // spec §8.1 madde 18: 24 saat

export type GeotagStatusResult = {
  status: GeotagValidationStatus;
  distanceFromGraveM: number | null;
  // Ops bildirim payload'ı için — yalnızca status !== 'valid' iken anlamlı.
  reason?: string;
};

// spec §8.1 madde 16-18'in tam karar sırası: önce referans konum var mı
// (ADIM 5'in "yardım isteyin" akışında olmayabilir — bkz. CLAUDE.md "Evidence
// verification" kararı: bu durumda yükleme ENGELLENMEZ, manual_review'a
// düşer), sonra EXIF var mı, sonra mesafe tolerans içinde mi, sonra zaman
// damgası 24 saat içinde mi.
export function resolveGeotagStatus(input: {
  exif: ExifData;
  referenceLat: number | null;
  referenceLng: number | null;
  toleranceMeters: number;
  serverReceivedAt: Date;
}): GeotagStatusResult {
  const {
    exif,
    referenceLat,
    referenceLng,
    toleranceMeters,
    serverReceivedAt,
  } = input;

  if (referenceLat === null || referenceLng === null) {
    return {
      status: 'manual_review',
      distanceFromGraveM: null,
      reason:
        'Bu mezar konumu için henüz referans koordinat girilmemiş (saha ekibi tarafından tespit edilmeyi bekliyor) — otomatik GPS doğrulaması yapılamadı.',
    };
  }

  if (exif.lat === undefined || exif.lng === undefined) {
    return {
      status: 'missing_exif',
      distanceFromGraveM: null,
      reason:
        'Fotoğrafta EXIF GPS verisi bulunamadı (konum izni kapalı olabilir).',
    };
  }

  const distanceFromGraveM = haversineDistanceMeters(
    { lat: exif.lat, lng: exif.lng },
    { lat: referenceLat, lng: referenceLng },
  );

  if (distanceFromGraveM > toleranceMeters) {
    return {
      status: 'gps_mismatch',
      distanceFromGraveM,
      reason: `Fotoğraf, mezar konumundan ${Math.round(distanceFromGraveM)}m uzaklıkta çekilmiş (tolerans: ${toleranceMeters}m).`,
    };
  }

  if (exif.timestamp) {
    const diffMs = Math.abs(
      serverReceivedAt.getTime() - exif.timestamp.getTime(),
    );
    if (diffMs > TIMESTAMP_MISMATCH_MS) {
      return {
        status: 'timestamp_mismatch',
        distanceFromGraveM,
        reason:
          'Fotoğrafın çekim zamanı ile sunucuya ulaşma zamanı arasında 24 saatten fazla fark var.',
      };
    }
  }

  return { status: 'valid', distanceFromGraveM };
}
