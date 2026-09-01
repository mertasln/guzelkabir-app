import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Global JwtAuthGuard varsayılan olarak her route'u korur (spec §6: auth
// zorunlu) — bu route'u istisna tutmak için kullan.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
