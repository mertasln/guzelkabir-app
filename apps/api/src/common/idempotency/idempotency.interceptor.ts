import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Redis } from 'ioredis';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import { IDEMPOTENT_KEY } from '../decorators/idempotent.decorator';
import { AuthenticatedRequest } from '../../auth/types/authenticated-request.type';

const LOCK_TTL_SECONDS = 60; // işlem sürerken kilit süresi
const RESULT_TTL_SECONDS = 24 * 60 * 60; // tamamlanmış sonucu ne kadar saklayacağız

type CachedEntry = { status: 'processing' } | { status: 'done'; body: unknown };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const isIdempotent = this.reflector.getAllAndOverride<boolean>(
      IDEMPOTENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isIdempotent) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const headerValue = req.headers['idempotency-key'];
    const idempotencyKey = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;
    if (!idempotencyKey) {
      return next.handle();
    }

    const userId = req.user?.sub ?? 'anonymous';
    const routePath =
      (req.route as { path?: string } | undefined)?.path ?? req.path;
    const redisKey = `idempotency:${userId}:${req.method}:${routePath}:${idempotencyKey}`;

    const existingRaw = await this.redis.get(redisKey);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw) as CachedEntry;
      if (existing.status === 'processing') {
        throw new ConflictException(
          'Aynı Idempotency-Key ile bir istek hâlihazırda işleniyor.',
        );
      }
      return of(existing.body);
    }

    const claimed = await this.redis.set(
      redisKey,
      JSON.stringify({ status: 'processing' } satisfies CachedEntry),
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );
    if (!claimed) {
      throw new ConflictException(
        'Aynı Idempotency-Key ile bir istek hâlihazırda işleniyor.',
      );
    }

    return next.handle().pipe(
      tap((body: unknown) => {
        void this.redis.set(
          redisKey,
          JSON.stringify({ status: 'done', body } satisfies CachedEntry),
          'EX',
          RESULT_TTL_SECONDS,
        );
      }),
      catchError((err: unknown) => {
        void this.redis.del(redisKey);
        throw err;
      }),
    );
  }
}
