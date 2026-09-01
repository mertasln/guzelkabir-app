import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // ADIM 4'te (Stripe) burada özel bir raw-body yönlendirmesi vardı, çünkü
  // Stripe'ın webhook imza doğrulaması ham body byte'larına ihtiyaç duyuyordu.
  // iyzico'nun imza şeması (X-IYZ-SIGNATURE-V3, HMAC-SHA256) parse edilmiş
  // JSON alanları üzerinden hesaplanıyor (bkz. PaymentsService.
  // verifyWebhookSignature) — bu yüzden artık normal, global body parser
  // yeterli (bkz. CLAUDE.md "Payment provider: iyzico, not Stripe" —
  // ADIM 6 simplification notu). /payments/callback'in aldığı form-POST
  // (application/x-www-form-urlencoded) da NestJS'in varsayılan body
  // parser'ı tarafından zaten destekleniyor.
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // spec §5: standart hata zarfı { error: { code, message, requestId } } —
  // bkz. common/filters/http-exception.filter.ts.
  app.useGlobalFilters(new AllExceptionsFilter());

  // apps/web dev server(s) — bkz. HANDOVER.md (3000, ve önizleme için 3005).
  // Refresh cookie'nin gönderilebilmesi için credentials:true şart (bkz.
  // auth/auth.controller.ts — sameSite=lax, aynı kayıtlı domain/localhost
  // varsayımıyla).
  const corsOrigins = (
    process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3005'
  ).split(',');
  app.enableCors({ origin: corsOrigins, credentials: true });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
