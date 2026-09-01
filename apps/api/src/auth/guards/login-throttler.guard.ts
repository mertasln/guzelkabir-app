import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// spec §6.2: "brute-force koruması için login endpoint'inde rate limiting
// (5 deneme / 15 dk / IP+hesap)" — varsayılan ThrottlerGuard yalnızca IP'ye
// göre izler; burada IP + denenen e-posta birleşik anahtar oluyor, böylece
// tek bir IP'den farklı hesaplara yapılan denemeler birbirini etkilemiyor
// (ve aynı hesaba farklı IP'lerden yapılan denemeler de ayrı ayrı sayılıyor).
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, unknown>): Promise<string> {
    const body = req.body as { email?: unknown } | undefined;
    const email =
      typeof body?.email === 'string' ? body.email.toLowerCase() : 'unknown';
    const ip = typeof req.ip === 'string' ? req.ip : 'unknown';
    return Promise.resolve(`${ip}:${email}`);
  }
}
