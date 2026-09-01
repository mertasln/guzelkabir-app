import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import RedisMock from 'ioredis-mock';
import { AppModule } from '../src/app.module';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { UserRole } from '@prisma/client';
import { MockStorageService } from './mock-storage.service';

export async function createTestApp() {
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
  process.env.IYZICO_API_KEY ??= 'sandbox-placeholder-api-key';
  process.env.IYZICO_SECRET_KEY ??= 'sandbox-placeholder-secret-key';
  process.env.IYZICO_URI ??= 'https://sandbox-api.iyzipay.com';
  process.env.KMS_KEY_ID_PII ??= 'test-kms-key';

  const mockStorage = new MockStorageService();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    // Sandbox'ta gerçek Redis'e ağ erişimi yok (bkz. CLAUDE.md Auth bölümü) —
    // ioredis-mock komut yüzeyini sadakatle taklit ediyor.
    .overrideProvider(REDIS_CLIENT)
    .useValue(new RedisMock())
    // Gerçek S3'e her e2e testinde bağlanmak hem yavaş hem de deterministik
    // değil (ADIM 7) — testler mockStorage.setObject() ile fileKey'e karşılık
    // gelen gerçek bir JPEG buffer'ı (EXIF'li/EXIF'siz) elle "yükler".
    .overrideProvider(StorageService)
    .useValue(mockStorage)
    .compile();

  // ADIM 4'te (Stripe) burada özel bir raw-body yönlendirmesi vardı — iyzico'nun
  // webhook imzası parse edilmiş alanlar üzerinden hesaplandığı için artık
  // gerekmiyor (main.ts ile aynı basitleştirme, bkz. CLAUDE.md).
  const app: INestApplication = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  const jwt = app.get(JwtService);
  const prisma = app.get(PrismaService);
  const accessTokenFor = (sub: string, role: UserRole) =>
    jwt.sign(
      { sub, role },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
    );

  return { app, prisma, accessTokenFor, mockStorage };
}
