// spec §9'un şablon tablosundaki 6 satırdan, kullanıcı kararıyla bu fazda
// gerçekten gönderilen 5'i (Abonelik yenileme hariç — iyzico Subscription
// entegrasyonu henüz yok, tetikleyecek bir olay yok).
//
// "Saha atandı" satırı spec'te yalnızca WhatsApp kanalı tanımlıyor; WhatsApp
// bu fazda kasıtlı olarak ERTELENDİ (kullanıcı kararı — Meta Business
// doğrulaması ayrı, yavaş bir süreç). İLK kararda field_assigned'ın burada
// sms/email girdisi hiç yoktu — bu, müşterinin saha ekibi atandığında hiçbir
// bildirim ALMAMASI anlamına geliyordu (yalnızca 'queued' bir WhatsApp
// satırı, hiçbir gerçek gönderim yok). Kullanıcı bunu gerçek bir UX boşluğu
// olarak flagledi ve E-POSTA FALLBACK eklenmesine karar verdi — spec §9
// satır 2'nin literal WhatsApp-only tanımından KASITLI bir sapma, sessizce
// değil, burada ve CLAUDE.md'de açıkça işaretli. WhatsApp gerçekten
// eklendiğinde bu fallback'in hâlâ gerekli olup olmadığı yeniden
// değerlendirilmeli (muhtemelen kalır — e-posta WhatsApp'tan daha güvenilir
// bir teslimat kanalı, ikisi birlikte gitmesi zararsız).

export type NotificationPayload = Record<string, unknown>;

type EmailContent = { subject: string; text: string };

export type NotificationTemplate = {
  sms?: (payload: NotificationPayload) => string;
  email?: (payload: NotificationPayload) => EmailContent;
};

function str(payload: NotificationPayload, key: string): string {
  const value = payload[key];
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return value == null ? '' : JSON.stringify(value);
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  // spec §9 satır 2 "Saha atandı" — spec yalnızca WhatsApp diyor; e-posta,
  // WhatsApp ertelenmişken müşteri hiç bilgilendirilmesin diye eklenen
  // kullanıcı-onaylı fallback (yukarıdaki not).
  field_assigned: {
    email: (p) => ({
      subject: `Saha ekibi atandı — #${str(p, 'orderNumber')}`,
      text: `Merhaba ${str(p, 'customerName')},\n\nSiparişiniz #${str(p, 'orderNumber')} için saha ekibimiz atanmıştır ve en kısa sürede göreve başlayacaktır.\n\nGüzelKabir`,
    }),
  },

  // spec §9 satır 1 "Sipariş onaylandı" — E-posta + SMS.
  order_confirmed: {
    sms: (p) =>
      `GüzelKabir: Siparişiniz #${str(p, 'orderNumber')} alındı ve onaylandı. Saha ekibimiz en kısa sürede atanacak.`,
    email: (p) => ({
      subject: `Siparişiniz onaylandı — #${str(p, 'orderNumber')}`,
      text: `Merhaba ${str(p, 'customerName')},\n\nSiparişiniz #${str(p, 'orderNumber')} alınmış ve ödemeniz onaylanmıştır. Saha ekibimiz en kısa sürede göreve atanacaktır.\n\nGüzelKabir`,
    }),
  },

  // spec §9 satır 3 "Görev tamamlandı" — E-posta + SMS + WhatsApp (WhatsApp
  // ertelendi, yukarıdaki nota bakın).
  task_completed: {
    sms: (p) =>
      `GüzelKabir: Siparişiniz #${str(p, 'orderNumber')} için bakım tamamlandı. Fotoğraflı raporunuzu 48 saat içinde onaylayın.`,
    email: (p) => ({
      subject: `Bakım raporunuz hazır — #${str(p, 'orderNumber')}`,
      text: `Merhaba ${str(p, 'customerName')},\n\nSiparişiniz #${str(p, 'orderNumber')} için mezar bakımı tamamlanmış ve fotoğraflı rapor yüklenmiştir. Lütfen 48 saat içinde onaylayın — süre sonunda otomatik olarak onaylanmış sayılacaktır.\n\nGüzelKabir`,
    }),
  },

  // spec §9 satır 4 "48 saat onay hatırlatma (24. saatte)" — yalnızca SMS
  // (spec'in kendisi burada tek kanal tanımlıyor, e-posta eklemek bir
  // genişletme olurdu).
  approval_reminder_24h: {
    sms: (p) =>
      `GüzelKabir: Siparişiniz #${str(p, 'orderNumber')} için onay süreniz 24 saat içinde doluyor.`,
  },

  // spec §9 satır 6 "Şikayet açıldı/çözüldü" — E-posta + SMS. İki ayrı
  // şablon anahtarı (açılış/çözüm farklı olaylar, aynı satırda birleşik
  // anlatılmış).
  complaint_opened: {
    sms: (p) =>
      `GüzelKabir: Siparişiniz #${str(p, 'orderNumber')} için şikayetiniz alındı, ekibimiz inceliyor.`,
    email: (p) => ({
      subject: `Şikayetiniz alındı — #${str(p, 'orderNumber')}`,
      text: `Merhaba ${str(p, 'customerName')},\n\nSiparişiniz #${str(p, 'orderNumber')} için şikayetiniz alınmıştır, ekibimiz en kısa sürede inceleyecektir.\n\nGüzelKabir`,
    }),
  },
  complaint_resolved: {
    sms: (p) =>
      `GüzelKabir: Siparişiniz #${str(p, 'orderNumber')} için şikayetiniz çözüme kavuştu.`,
    email: (p) => ({
      subject: `Şikayetiniz çözüldü — #${str(p, 'orderNumber')}`,
      text: `Merhaba ${str(p, 'customerName')},\n\nSiparişiniz #${str(p, 'orderNumber')} için açtığınız şikayet çözüme kavuşmuştur.\n\nGüzelKabir`,
    }),
  },
};
