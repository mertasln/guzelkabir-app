import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';

// spec §5.1: "Ödeme ve sipariş oluşturma endpointleri Idempotency-Key header'ı
// destekler (çift tıklama/ağ tekrarı koruması)". Header client tarafından
// opsiyonel gönderilir (Stripe'ın kendi API'sindeki gibi) — sağlanmazsa istek
// normal işlenir, sağlanırsa aynı anahtarla tekrar edilen istek yeniden
// yürütülmez, önceki sonucu döner.
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
