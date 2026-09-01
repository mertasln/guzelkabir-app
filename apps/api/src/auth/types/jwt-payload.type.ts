import { UserRole } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
};
