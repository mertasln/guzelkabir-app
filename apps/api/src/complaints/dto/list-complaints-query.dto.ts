import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ComplaintStatus } from '@prisma/client';

const STATUSES = [
  'open',
  'investigating',
  'resolved_refund',
  'resolved_reservice',
  'rejected',
] as const satisfies readonly ComplaintStatus[];

// spec §11.1 "Şikayet Yönetimi" — spec §5'in tablosunda yok, Admin Panel
// (ADIM 9) kararı, GET /orders'ın status filtresiyle aynı desen.
export class ListComplaintsQueryDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: ComplaintStatus;

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
