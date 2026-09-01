import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PhotoType } from '@prisma/client';

const PHOTO_TYPES = [
  'wide_shot',
  'detail_shot',
  'before',
  'after',
] as const satisfies readonly PhotoType[];

// ADIM 7: gerçek S3 pre-signed URL akışı kuruldu (bkz.
// OrdersController.createEvidenceUploadUrl, StorageService). exifGpsLat/
// exifGpsLng/exifTimestamp artık istemciden ALINMIYOR — bu değerlere
// güvenmek doğrulamanın tüm amacını geçersiz kılardı (istemci herhangi bir
// "doğrulanmış" koordinat gönderebilirdi). Backend, istemcinin S3'e
// yüklediği dosyayı indirip EXIF'i kendisi çıkarır (bkz.
// OrdersService.addEvidence).
export class CreateEvidenceDto {
  @IsIn(PHOTO_TYPES)
  photoType!: PhotoType;

  // POST /orders/:id/evidence/upload-url'den dönen S3 object key'i.
  @IsString()
  fileKey!: string;

  // "Saha notu" (spec §8.1/§8.2, max 200 karakter) — bkz. schema.prisma
  // EvidencePhoto.fieldNote yorumu.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  fieldNote?: string;
}
