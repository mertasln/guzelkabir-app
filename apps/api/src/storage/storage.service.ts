import { Inject, Injectable } from '@nestjs/common';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3_CLIENT } from './storage.constants';

const UPLOAD_URL_TTL_SECONDS = 5 * 60; // spec §8.1 madde 14: kısa ömürlü presigned URL

@Injectable()
export class StorageService {
  constructor(@Inject(S3_CLIENT) private readonly s3: S3Client) {}

  private get bucket(): string {
    return process.env.S3_EVIDENCE_BUCKET ?? 'guzelkabir-evidence-placeholder';
  }

  // spec §8.1 madde 14: istemci fotoğrafı doğrudan bu URL'e yükler, backend
  // hiç proxy etmez (performans). Kısa ömürlü — yalnızca bir tekil PUT için.
  //
  // contentSha256 (istemcinin dosyanın TAM baytlarından SHA-256 hesaplayıp
  // base64 ile ilettiği değer) ZORUNLU — gerçek bucket'a karşı canlı testte
  // bulunan bir gereklilik: bucket'a Object Lock varsayılan saklama kuralı
  // eklendikten sonra S3, Object Lock'lu bir bucket'a yapılan HER PutObject'in
  // bir içerik bütünlüğü header'ı (Content-MD5 veya x-amz-checksum-*)
  // taşımasını ZORUNLU kılıyor. Presigned URL'ler için bu header'ın değeri
  // İMZANIN bir parçası olmak zorunda (aksi halde "SignatureDoesNotMatch") —
  // yani sunucu, URL'i imzalarken checksum değerini ÖNCEDEN bilmeli. Bu da
  // istemcinin (saha PWA'sı, ADIM 8) dosyayı /upload-url'i çağırmadan ÖNCE
  // yerel olarak hashlemesi gerektiği anlamına geliyor (`crypto.subtle.digest`
  // ile — tarayıcıda yerleşik, ekstra kütüphane gerekmez) ve upload PUT'unda
  // AYNI değeri `x-amz-checksum-sha256` header'ı olarak göndermesi gerekiyor.
  async createPresignedUploadUrl(
    key: string,
    contentType: string,
    contentSha256: string,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ChecksumAlgorithm: 'SHA256',
      ChecksumSHA256: contentSha256,
    });
    return getSignedUrl(this.s3, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      // x-amz-checksum-sha256'ı sorgu string'ine "hoist" etmek yerine
      // (varsayılan davranış) gerçek, imzalanmış bir istek header'ı olarak
      // ZORUNLU kılıyoruz — S3'ün Object Lock bütünlük kontrolü yalnızca
      // gerçek header'a bakıyor, sorgu string'indeki değere değil (canlı
      // testte doğrulandı: yalnızca sorgu string'inde olduğunda "Content-MD5
      // OR x-amz-checksum- HTTP header is required" hatası alınıyordu).
      unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
    });
  }

  // EXIF çıkarımı için: backend, istemcinin S3'e zaten yüklediği orijinal
  // dosyayı indirir (bkz. OrdersService.addEvidence) — istemcinin gönderdiği
  // "EXIF" değerlerine güvenmek doğrulamanın tüm amacını geçersiz kılardı.
  async getObjectBuffer(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.s3.send(command);
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`S3 nesnesi boş veya okunamadı: ${key}`);
    }
    return Buffer.from(bytes);
  }

  // spec §8.2: "CDN üzerinden sıkıştırılmış türetilmiş versiyon sunulur" —
  // orijinal (WORM kilitli) dosyaya dokunulmaz, sıkıştırılmış kopya ayrı bir
  // key'e yazılır (bkz. OrdersService.addEvidence).
  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  // evidence_photos.file_url (spec §4.5: "S3 object URL") için — CloudFront
  // henüz kurulmadığından (ADIM 13'te, kullanıcının DigitalOcean droplet'i
  // dışında AWS tarafı) EVIDENCE_CDN_BASE_URL boşsa ham bir S3 URL'ine düşer.
  // Bucket public değil (WORM/private) — CloudFront kurulana kadar bu ham URL
  // doğrudan tarayıcıda açılamaz, yalnızca referans/kayıt amaçlıdır.
  getPublicUrl(key: string): string {
    const cdnBase = process.env.EVIDENCE_CDN_BASE_URL;
    if (cdnBase) {
      return `${cdnBase.replace(/\/+$/, '')}/${key}`;
    }
    const region = process.env.AWS_REGION ?? 'eu-central-1';
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}
