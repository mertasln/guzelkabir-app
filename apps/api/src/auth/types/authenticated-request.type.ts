import type { Request } from 'express';
import { AccessTokenPayload } from './jwt-payload.type';

export type AuthenticatedRequest = Request & { user?: AccessTokenPayload };
