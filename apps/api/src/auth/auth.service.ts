import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import type { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/jwt-payload.type';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // spec §6.2: 7 gün

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  refreshTokenTtlSeconds: number;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Bu e-posta adresi zaten kayıtlı.');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        locale: dto.locale ?? 'tr',
        role: dto.role ?? 'customer',
      },
    });

    return this.issueTokenPair(user.id, user.role);
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('E-posta veya şifre hatalı.');
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw new UnauthorizedException('E-posta veya şifre hatalı.');
    }

    return this.issueTokenPair(user.id, user.role);
  }

  async refresh(presentedToken: string): Promise<TokenPair> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(
        presentedToken,
        {
          secret: this.requireSecret('JWT_REFRESH_SECRET'),
        },
      );
    } catch {
      throw new UnauthorizedException(
        'Refresh token geçersiz veya süresi dolmuş.',
      );
    }

    const currentJtiKey = this.currentJtiKey(payload.sub);
    const storedJti = await this.redis.get(currentJtiKey);

    if (!storedJti || storedJti !== payload.jti) {
      // Rotasyon sonrası eski (kullanılmış) bir refresh token tekrar sunuldu —
      // olası çalıntı token senaryosu. O kullanıcının tüm oturumu iptal edilir.
      await this.redis.del(currentJtiKey);
      throw new UnauthorizedException(
        'Refresh token geçersiz veya süresi dolmuş.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      await this.redis.del(currentJtiKey);
      throw new UnauthorizedException(
        'Refresh token geçersiz veya süresi dolmuş.',
      );
    }

    return this.issueTokenPair(user.id, user.role);
  }

  private async issueTokenPair(
    userId: string,
    role: AccessTokenPayload['role'],
  ): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, role } satisfies AccessTokenPayload,
      {
        secret: this.requireSecret('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL,
      },
    );

    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti } satisfies RefreshTokenPayload,
      {
        secret: this.requireSecret('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      },
    );

    // Tek aktif oturum modeli: kullanıcı başına yalnızca en son üretilen jti
    // geçerlidir (bkz. src/auth/auth.service.ts üst yorum niyeti — refresh()).
    // Çoklu cihaz/oturum desteği gerekiyorsa bu anahtar bir set'e genişletilmeli.
    await this.redis.set(
      this.currentJtiKey(userId),
      jti,
      'EX',
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenTtlSeconds: REFRESH_TOKEN_TTL_SECONDS,
    };
  }

  private currentJtiKey(userId: string): string {
    return `refresh:current:${userId}`;
  }

  private requireSecret(
    name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET',
  ): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} is not set`);
    }
    return value;
  }
}
