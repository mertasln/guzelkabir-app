import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PermitStatus } from '@prisma/client';

const PERMIT_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const satisfies readonly PermitStatus[];

// spec §11.1 "Mezarlık & İzin Yönetimi" — admin-only tam liste, GET
// /cemeteries/search'ten (public, yalnızca ad/şehir autocomplete için) ayrı:
// izin durumu/belge URL'i gibi iç bilgiler kimliksiz bir uca hiç eklenmedi
// (bkz. CemeteriesController yorumu — bilinçli bir güvenlik kararı).
export class ListCemeteriesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  q?: string;

  @IsOptional()
  @IsIn(PERMIT_STATUSES)
  permitStatus?: PermitStatus;

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
