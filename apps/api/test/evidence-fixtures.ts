import sharp from 'sharp';

// exifr, ham EXIF DateTimeOriginal string'ini (saat dilimi bilgisi taşımaz)
// makinenin YEREL saat dilimine göre yorumluyor (deneyle doğrulandı) — bu
// yüzden testlerde saatlik hassasiyette bir sınır değeri değil, "açıkça
// taze" (now) veya "açıkça eski" (10 gün önce) gibi sağlam değerler kullanın.
function toDMSFraction(decimal: number): string {
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = (minFloat - min) * 60;
  return `${deg}/1 ${min}/1 ${Math.round(sec * 100)}/100`;
}

function toExifDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export async function makeJpegWithExif(options: {
  lat: number;
  lng: number;
  timestamp: Date;
}): Promise<Buffer> {
  return sharp({
    create: {
      width: 20,
      height: 20,
      channels: 3,
      background: { r: 120, g: 120, b: 120 },
    },
  })
    .jpeg()
    .withExif({
      IFD2: { DateTimeOriginal: toExifDateTime(options.timestamp) },
      IFD3: {
        GPSLatitudeRef: options.lat >= 0 ? 'N' : 'S',
        GPSLatitude: toDMSFraction(options.lat),
        GPSLongitudeRef: options.lng >= 0 ? 'E' : 'W',
        GPSLongitude: toDMSFraction(options.lng),
      },
    })
    .toBuffer();
}

export async function makeJpegWithoutExif(): Promise<Buffer> {
  return sharp({
    create: {
      width: 20,
      height: 20,
      channels: 3,
      background: { r: 80, g: 80, b: 80 },
    },
  })
    .jpeg()
    .toBuffer();
}
