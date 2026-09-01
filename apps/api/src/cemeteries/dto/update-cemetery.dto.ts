import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { PermitStatus } from '@prisma/client';

const PERMIT_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const satisfies readonly PermitStatus[];

// spec §5'in tablosunda yok — spec §8.1'in "mezarlık büyüklüğüne göre
// yapılandırılabilir" gereksinimini karşılamak için tespit edilmiş bir
// boşluk (ADIM 7 kararı, bkz. schema.prisma Cemetery.geotagToleranceM
// yorumu).
//
// ADIM 9 (Admin Panel) Phase 8: kullanıcı talimatı üzerine bu DTO
// permitStatus/permitDocumentUrl için GENİŞLETİLDİ — "Mezarlık & İzin
// Yönetimi" (spec §11.1) için yeni/paralel bir cemetery-update endpoint'i
// AÇILMADI, mevcut PATCH /cemeteries/:id kullanılıyor.
export class UpdateCemeteryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  geotagToleranceM?: number;

  @IsOptional()
  @IsIn(PERMIT_STATUSES)
  permitStatus?: PermitStatus;

  // Belge arşivi (spec §11.1: "belge arşivi") — belgenin kendisi burada
  // yüklenmiyor, yalnızca URL'i kaydediliyor (spec §8.1'in kanıt
  // fotoğraflarında yaptığı gibi ayrı bir presigned-upload akışı bu fazın
  // kapsamı dışında bırakıldı, kapsam bilinçli olarak dar tutuldu — bkz.
  // CemeteriesPage yorumu, admin dosyayı kendi barındırdığı bir yere
  // yükleyip URL'i buraya yapıştırıyor).
  @IsOptional()
  @IsUrl()
  permitDocumentUrl?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  municipalityAuthority?: string;
}
