import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// spec §11.1 "Mezarlık & İzin Yönetimi: Mezarlık kayıtları" — yeni bir
// mezarlık kaydı oluşturma. Spec §5'in tablosunda yok, önceden hiçbir
// oluşturma ucu yoktu (yalnızca seed script'i doğrudan DB'ye yazıyordu) —
// kullanıcının "PATCH'i genişlet, yeni endpoint açma" talimatı yalnızca
// GÜNCELLEME içindi; oluşturma hiç var olmayan, gerçekten yeni bir ihtiyaç.
export class CreateCemeteryDto {
  @IsString()
  name!: string;

  @IsString()
  city!: string;

  @IsString()
  district!: string;

  @IsString()
  municipalityAuthority!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  geotagToleranceM?: number;
}
