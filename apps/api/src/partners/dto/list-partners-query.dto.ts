import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { FieldPartnerStatus } from '@prisma/client';

const STATUSES = [
  'onboarding',
  'active',
  'suspended',
  'terminated',
  'rejected',
] as const satisfies readonly FieldPartnerStatus[];

// spec §11.1 "Partner Yönetimi" (Admin Panel) — spec §5'in tablosunda bu
// listeleme ucu yok, aynı sınıf karar: GET /orders'ın status filtresiyle
// tutarlı bir desen.
export class ListPartnersQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: FieldPartnerStatus;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
