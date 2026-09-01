import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

// spec §6.1 rol matrisi — route bazlı yetki kontrolü için.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
