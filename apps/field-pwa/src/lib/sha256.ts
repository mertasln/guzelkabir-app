// apps/api/src/storage/storage.service.ts yorumunda açıklanan, ADIM 7'nin canlı
// S3 Object Lock testinde bulunan gerçek gereklilik: presigned upload URL,
// checksum değerini imzanın bir parçası olarak ÖNCEDEN bilmek zorunda — yani
// istemci dosyayı /evidence/upload-url'i çağırmadan ÖNCE burada hashlemeli,
// sonra PUT isteğinde AYNI değeri x-amz-checksum-sha256 header'ı olarak
// göndermeli (bkz. CameraCapturePage). crypto.subtle tarayıcıya yerleşik —
// ekstra kütüphane gerekmez.
export async function sha256Base64(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const bytesArray = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytesArray) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
