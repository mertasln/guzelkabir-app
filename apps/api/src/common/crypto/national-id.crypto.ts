import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

// spec §14.1: field_partners.national_id_encrypted "AES-256 alan bazlı
// şifreleme, ayrı KMS anahtarı" gerektiriyor. Gerçek bir KMS servisi henüz
// kurulmadı (KMS_KEY_ID_PII hâlâ .env.example'da placeholder, ADIM 9'un
// kapsamı) — ama TC/pasaport no gibi bir alanı "_encrypted" adıyla düz metin
// saklamak kabul edilemez bir güvenlik açığı olurdu. Bu yüzden burada gerçek
// AES-256-GCM şifreleme uygulanıyor; anahtar KMS_KEY_ID_PII'den türetiliyor
// (env değişkeni ham simetrik anahtar gibi kullanılıyor — gerçek bir KMS'e
// (AWS KMS/Doppler vb.) taşınana kadar geçici, ama işlevsel bir çözüm).
const ALGORITHM = 'aes-256-gcm';

function deriveKey(): Buffer {
  const secret = process.env.KMS_KEY_ID_PII;
  if (!secret) {
    throw new Error(
      'KMS_KEY_ID_PII is not set — cannot encrypt/decrypt national ID data.',
    );
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptNationalId(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decryptNationalId(ciphertext: string): string {
  const [ivB64, authTagB64, dataB64] = ciphertext.split('.');
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Malformed encrypted national ID value.');
  }
  const key = deriveKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
