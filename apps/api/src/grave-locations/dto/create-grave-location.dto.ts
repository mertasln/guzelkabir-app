import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// spec §4.3 (grave_locations) alan adlarıyla birebir — ama bu ENDPOINT'in kendisi
// spec §5'in tablosunda yok (bkz. GraveLocationsService yorumu, kullanıcı kararı).
export class CreateGraveLocationDto {
  @IsUUID()
  cemeteryId!: string;

  // "Yardım isteyin" akışında ikisi de gönderilmez (bkz. GraveLocationsService.findOrCreate)
  // — saha ekibi tespit edince PATCH /grave-locations/:id ile doldurulur.
  @IsOptional()
  @IsString()
  @MaxLength(50)
  section?: string; // ada

  @IsOptional()
  @IsString()
  @MaxLength(50)
  plot?: string; // parsel

  @IsOptional()
  @IsString()
  @MaxLength(50)
  graveNo?: string;

  // Hassas/kişisel veri — spec §14.1. Bkz. schema.prisma GraveLocation.deceasedName yorumu.
  @IsOptional()
  @IsString()
  @MaxLength(255)
  deceasedName?: string;

  @IsOptional()
  @IsString()
  locationNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @IsUrl()
  referencePhotoUrl?: string;
}
