import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

type NestErrorBody = { message?: string | string[]; error?: string };

// spec §5 giriş cümlesi: "Hata formatı standardize edilmiştir:
// { "error": { "code": "ORDER_NOT_FOUND", "message": "...", "requestId": "..." } }"
//
// NOT (bilinen sınırlama): `code` alanı burada yalnızca HTTP durumundan türetilen
// GENEL bir kod (örn. NOT_FOUND, FORBIDDEN) — spec'in örneğindeki gibi alan-özel
// kodlar (ORDER_NOT_FOUND) değil. Bunun için her throw noktasına (orders, payments,
// auth, ...) açık bir kod parametresi eklemek gerekir — ayrı, daha büyük bir iş;
// burada düzeltilen şey ZARF'ın (error/message/requestId) doğru şekli, kod
// GRANÜLERLİĞİ değil.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let code = statusToGenericCode(status);
    let message = 'Beklenmeyen bir hata oluştu.';

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const typed = body as NestErrorBody;
        message = Array.isArray(typed.message)
          ? typed.message.join(', ')
          : (typed.message ?? exception.message);
        if (typed.error) {
          code = toScreamingSnakeCase(typed.error);
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
    }

    response.status(status).json({
      error: { code, message, requestId: randomUUID() },
    });
  }
}

const GENERIC_CODES_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
};

function statusToGenericCode(status: number): string {
  const known = GENERIC_CODES_BY_STATUS[status];
  if (known) {
    return known;
  }
  return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
}

function toScreamingSnakeCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();
}
