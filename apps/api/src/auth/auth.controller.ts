import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService, TokenPair } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';

const REFRESH_COOKIE_NAME = 'refresh_token';

// spec §6.2: refresh token httpOnly secure cookie olarak taşınır.
// sameSite=lax (None DEĞİL): apps/web ve apps/api için hiçbir hosting/domain
// mimarisi kararı verilmedi (bkz. HANDOVER.md §7). Varsayılan, en doğal kurulum
// aynı kayıtlı domain altında alt-domainler (örn. app.guzelkabir.com +
// api.guzelkabir.com) — SameSite açısından bunlar "same-site" sayılır (site
// kıyaslaması kayıtlı domaine göre yapılır, port/alt-domain'e göre değil), yani
// Lax bu kurulumda ve yerel geliştirmede (localhost:3000 ↔ localhost:3001, port
// da site tanımına dahil değil) sorunsuz çalışır ve None'un aksine çapraz-site
// CSRF'e karşı gerçek bir koruma sağlar (bkz. auth.module.ts üstündeki CSRF notu).
// Eğer ileride gerçekten farklı kayıtlı domainlerde barındırma kararı alınırsa
// (ADIM 13 altyapı adımı), bu o zaman None + spec §14.3 CSRF token'ına
// yükseltilmeli — şimdiden yükseltmek erken ve gereksiz risk taşımaktan başka
// bir şey değil.
const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/api/v1/auth',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto);
    return this.respondWithTokens(res, tokens);
  }

  @Public()
  @UseGuards(LoginThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    return this.respondWithTokens(res, tokens);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as
      Record<string, string | undefined> | undefined;
    const presentedToken = cookies?.[REFRESH_COOKIE_NAME];
    if (!presentedToken) {
      throw new UnauthorizedException('Refresh token bulunamadı.');
    }
    const tokens = await this.authService.refresh(presentedToken);
    return this.respondWithTokens(res, tokens);
  }

  private respondWithTokens(res: Response, tokens: TokenPair) {
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: tokens.refreshTokenTtlSeconds * 1000,
    });
    return { accessToken: tokens.accessToken };
  }
}
