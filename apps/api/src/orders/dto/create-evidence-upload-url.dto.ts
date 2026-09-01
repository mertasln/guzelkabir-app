import { IsBase64, Length } from 'class-validator';

// ADIM 7'de canlı S3 testinde bulunan gerçek bir gereklilik (bkz.
// StorageService.createPresignedUploadUrl yorumu): bucket'a Object Lock
// varsayılan saklama kuralı eklendikten sonra S3, presigned URL'in içerik
// bütünlüğü checksum'ını İMZANIN bir parçası olarak önceden bilmesini
// zorunlu kılıyor. İstemci (saha PWA'sı, ADIM 8) dosyayı bu uca çağrı
// yapmadan ÖNCE `crypto.subtle.digest('SHA-256', ...)` ile hashleyip
// base64 olarak buraya iletmeli, sonra upload PUT'unda AYNI değeri
// `x-amz-checksum-sha256` header'ı olarak göndermeli.
export class CreateEvidenceUploadUrlDto {
  @IsBase64()
  @Length(44, 44) // SHA-256 -> 32 bayt -> base64'te sabit 44 karakter
  contentSha256!: string;
}
