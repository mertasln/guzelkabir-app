import { Injectable, Logger } from '@nestjs/common';

// Netgsm'in resmi bir Node.js SDK'sı yok — bu, resmi `netgsm/netgsm-sms-python`
// GitHub organizasyonu SDK'sının kaynağından (dokümantasyon sayfaları JS
// render'lı, doğrudan alınamadı) doğrulanmış REST v2 JSON API sözleşmesine göre
// elle yazıldı. Belirsiz kalan TEK nokta: başarı yanıtındaki id alanının adı
// (`id` mi `jobid` mi — SDK'nın kendi kaynağı bu konuda tutarsız) — kritik
// değil, yalnızca loglama için kullanılıyor, başarı/başarısızlık kararı her
// zaman `code === '00'`e dayanıyor. Gerçek sandbox kimlik bilgileriyle ilk
// canlı çağrıda doğrulanmalı.
const NETGSM_ENDPOINT = 'https://api.netgsm.com.tr/sms/rest/v2/send';

// Netgsm'in dokümante ettiği hata kodları — yalnızca loglarda okunabilir bir
// mesaj üretmek için, akış kontrolü için değil.
const NETGSM_ERROR_MESSAGES: Record<string, string> = {
  '20': 'Mesaj metni sorunlu veya karakter sınırını aşıyor',
  '30': 'Geçersiz kullanıcı adı/şifre veya API erişimi yok (IP kısıtlaması olabilir)',
  '40': 'Gönderici başlığı (msgheader) tanımlı/onaylı değil',
  '50': 'Hesap İYS kontrollü gönderime izin vermiyor',
  '51': 'Aboneliğe ait İYS marka bilgisi bulunamadı',
  '70': 'Geçersiz sorgu — eksik/hatalı zorunlu parametre',
  '80': 'Gönderim limiti aşıldı',
  '85': 'Aynı numaraya tekrar gönderim limiti aşıldı (1 dakikada >20)',
};

type NetgsmResponse = {
  code: string;
  id?: string;
  jobid?: string;
  description?: string;
};

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly username = process.env.NETGSM_USERNAME;
  private readonly password = process.env.NETGSM_PASSWORD;
  private readonly msgHeader = process.env.NETGSM_MSGHEADER;

  async send(phone: string, message: string): Promise<void> {
    if (!this.username || !this.password || !this.msgHeader) {
      throw new Error(
        'Netgsm yapılandırılmamış (NETGSM_USERNAME/NETGSM_PASSWORD/NETGSM_MSGHEADER).',
      );
    }

    const normalizedPhone = phone.replace(/[^0-9]/g, '');
    const authHeader = Buffer.from(
      `${this.username}:${this.password}`,
    ).toString('base64');

    const response = await fetch(NETGSM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        msgheader: this.msgHeader,
        messages: [{ msg: message, no: normalizedPhone }],
        encoding: 'tr',
        iysfilter: '0',
        appname: 'guzelkabir-api',
      }),
    });

    let body: NetgsmResponse | undefined;
    try {
      body = (await response.json()) as NetgsmResponse;
    } catch {
      // yanıt JSON değilse aşağıdaki !response.ok / !body kontrolleri yakalar.
    }

    if (!response.ok || !body || body.code !== '00') {
      const code = body?.code ?? String(response.status);
      const reason =
        NETGSM_ERROR_MESSAGES[code] ?? body?.description ?? 'bilinmeyen hata';
      throw new Error(
        `Netgsm SMS gönderimi başarısız (kod: ${code}): ${reason}`,
      );
    }

    this.logger.log(
      `SMS kuyruğa alındı (Netgsm id: ${body.id ?? body.jobid ?? '?'})`,
    );
  }
}
