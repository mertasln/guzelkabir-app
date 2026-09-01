import { Injectable } from '@nestjs/common';

// Gerçek AWS olmadan e2e testler için StorageService yerine geçen sahte —
// bkz. test-app.helper.ts'teki overrideProvider. Testler, sunucunun ürettiği
// fileKey'i setObject() ile "S3'e yüklenmiş" gibi işaretler, böylece
// OrdersService.addEvidence gerçek bir S3 çağrısı yapmadan EXIF/Haversine
// mantığını uçtan uca çalıştırabilir.
@Injectable()
export class MockStorageService {
  private readonly objects = new Map<string, Buffer>();

  setObject(key: string, buffer: Buffer): void {
    this.objects.set(key, buffer);
  }

  createPresignedUploadUrl(
    ...args: [string, string?, string?]
  ): Promise<string> {
    const [key] = args;
    return Promise.resolve(`https://mock-s3.test/${key}`);
  }

  getObjectBuffer(key: string): Promise<Buffer> {
    const buffer = this.objects.get(key);
    if (!buffer) {
      throw new Error(`MockStorageService: no object set for key ${key}`);
    }
    return Promise.resolve(buffer);
  }

  putObject(): Promise<void> {
    return Promise.resolve();
  }

  getPublicUrl(key: string): string {
    return `https://mock-cdn.test/${key}`;
  }
}
