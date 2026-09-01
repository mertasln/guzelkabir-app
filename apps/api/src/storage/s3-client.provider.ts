import { Provider } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { S3_CLIENT } from './storage.constants';

// İstemci kurulumu (constructor) ağ çağrısı yapmaz — yalnızca gerçek bir S3
// çağrısı (presign, GetObject, PutObject) yapıldığında AWS_ACCESS_KEY_ID/
// AWS_SECRET_ACCESS_KEY'in geçerli olması gerekir. Bu sandbox'ta yalnızca
// placeholder değerler var (bkz. .env.example) — Stripe/iyzico ile aynı
// desen: uygulama açılır, gerçek S3 çağrıları gerçek anahtarlar olmadan
// başarısız olur (beklenen).
export const s3ClientProvider: Provider = {
  provide: S3_CLIENT,
  useFactory: () =>
    new S3Client({
      region: process.env.AWS_REGION ?? 'eu-central-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'placeholder-access-key',
        secretAccessKey:
          process.env.AWS_SECRET_ACCESS_KEY ?? 'placeholder-secret-key',
      },
    }),
};
