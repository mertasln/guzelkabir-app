import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { OrderStatus } from '@prisma/client';

const STATUSES = [
  'draft',
  'pending_payment',
  'confirmed',
  'assigned',
  'in_progress',
  'completed_pending_approval',
  'closed',
  'disputed',
  'refunded',
  'cancelled',
] as const satisfies readonly OrderStatus[];

// spec §5: "Filtrelenebilir sipariş listesi (status, city, date)" + §5.1:
// cursor-based pagination.
export class ListOrdersQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

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
