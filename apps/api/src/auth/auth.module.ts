import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    // spec §6.2: login endpoint'i için 5 deneme / 15 dk (bkz. LoginThrottlerGuard,
    // IP+hesap birleşik anahtar kullanır). Diğer endpointlerin genel rate limiti
    // (spec §14.3: 100 req/dk/IP) güvenlik sertleştirme adımında (ADIM 9) eklenir.
    //
    // CSRF token (spec §14.3 "form tabanlı işlemlerde") BİLİNÇLİ olarak ADIM 9'a
    // ertelendi, sessizce atlanmadı. Gerekçe: (1) Authorization header ile
    // korunan tüm endpoint'ler CSRF'e karşı zaten bağışık — tarayıcılar cross-site
    // isteklere keyfi Authorization header'ı otomatik eklemez. (2) Çerez-tabanlı
    // TEK endpoint olan /auth/refresh, sameSite=lax cookie ile korunuyor (bkz.
    // auth.controller.ts) — Lax, cross-site POST isteklerinde cookie'yi hiç
    // göndermediği için klasik form-CSRF saldırısına karşı zaten kapalı. Bu iki
    // koruma, spec §14.3'ün aynı alt bölümündeki diğer sertleştirme kalemleriyle
    // (rate limiting, güvenlik başlıkları) aynı adımda topluca ele alınacak
    // ayrı bir CSRF-token katmanını şu an için gereksiz kılıyor.
    ThrottlerModule.forRoot([{ name: 'login', ttl: 15 * 60 * 1000, limit: 5 }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessStrategy],
  exports: [AuthService],
})
export class AuthModule {}
