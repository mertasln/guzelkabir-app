import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

// spec §5'in tablosunda yok — spec §8.1'in "mezarlık büyüklüğüne göre
// yapılandırılabilir" gereksinimini karşılamak için tespit edilmiş bir
// boşluk (ADIM 7 kararı, bkz. schema.prisma Cemetery.geotagToleranceM
// yorumu). Şimdilik yalnızca bu alan — kapsam bilinçli olarak dar tutuldu.
export class UpdateCemeteryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  geotagToleranceM?: number;
}
