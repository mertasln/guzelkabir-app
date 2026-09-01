import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

// "Yardım isteyin" akışını tamamlayan uç (kullanıcı kararı, ADIM 5): saha ekibi
// mezarı sahada tespit edince section/plot/lat/lng'yi burada doldurur. Spec
// §5'in tablosunda yok — grave_locations endpoint'i gibi tespit edilmiş bir
// boşluk (bkz. GraveLocationsService yorumu).
export class UpdateGraveLocationDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  section?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  plot?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
