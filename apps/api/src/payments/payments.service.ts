import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createHmac, timingSafeEqual } from 'node:crypto';
import Iyzipay from 'iyzipay';
import { PrismaService } from '../prisma/prisma.service';
import { IYZICO_CLIENT } from './iyzico.constants';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { AccessTokenPayload } from '../auth/types/jwt-payload.type';

type CheckoutFormInitializeResult = {
  status: string;
  errorMessage?: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
};

type CheckoutFormRetrieveResult = {
  status: string;
  errorMessage?: string;
  paymentStatus?: string;
  fraudStatus?: number;
  itemTransactions?: Array<{ paymentTransactionId?: string }>;
};

// iyzico webhook body'si (HPP/Checkout Form formatı) — spec §5.1'in "Webhook
// endpointleri imza doğrulaması yapar" gereksinimi artık Stripe-Signature
// yerine X-IYZ-SIGNATURE-V3 ile karşılanıyor (bkz. CLAUDE.md "Payment
// provider: iyzico, not Stripe"). Alan adları iyzico'nun resmi webhook
// dokümantasyonundan doğrulandı.
export type IyzicoWebhookPayload = {
  paymentConversationId: string;
  merchantId: number;
  status: 'SUCCESS' | 'FAILURE';
  token: string;
  iyziReferenceCode: string;
  iyziEventType: string;
  iyziEventTime: number;
  iyziPaymentId: number;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(IYZICO_CLIENT) private readonly iyzico: Iyzipay,
  ) {}

  // identityNumber (TC Kimlik No/pasaport) hiçbir hata mesajına, log satırına
  // veya (ileride kurulacak, ADIM 16) Sentry event'ine HAM haliyle sızmamalı —
  // kullanıcı kararı, ADIM 6. Bu değer DB'ye hiç yazılmıyor zaten (bkz.
  // CreatePaymentIntentDto yorumu); burada da iyzico'dan dönen herhangi bir
  // hata metni bu değeri yansıtıyorsa (ör. bir validasyon hatasında), NestJS'in
  // exception filter'ına (ve dolayısıyla ileride Sentry'ye) ulaşmadan önce
  // maskeleniyor. Yeni bir hata yolu eklerken bu deseni koru: dto.identityNumber
  // hiçbir throw/log çağrısına doğrudan enterpole edilmemeli.
  private redact(text: string, sensitiveValue: string | undefined): string {
    if (!sensitiveValue) return text;
    return text.split(sensitiveValue).join('***');
  }

  // spec §7.1 madde 9-10 (iyzico'ya uyarlanmış — bkz. CLAUDE.md): sipariş
  // taslağı için iyzico Checkout Form başlatılır. Kart verisi iyzico'nun
  // kendi barındırdığı (gömülebilir) formunda toplanır — bizim sunucumuza
  // hiç dokunmaz (PCI DSS SAQ-A, Stripe Elements ile aynı garanti). 3D
  // Secure akışının kendisi bu form içinde otomatik tetiklenir.
  async createIntent(
    user: AccessTokenPayload,
    dto: CreatePaymentIntentDto,
    ip: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı.');
    }
    if (order.customerId !== user.sub) {
      throw new ForbiddenException(
        'Bu sipariş için ödeme başlatma yetkiniz yok.',
      );
    }
    if (order.status !== 'draft' && order.status !== 'pending_payment') {
      throw new BadRequestException(
        `Bu sipariş için ödeme başlatılamaz (mevcut durum: ${order.status}).`,
      );
    }

    const customer = await this.prisma.user.findUnique({
      where: { id: user.sub },
    });
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı.');
    }

    // buyer.gsmNumber — kayıt sırasında telefon opsiyonel (bkz. RegisterDto);
    // iyzico bunu zorunlu tutuyor, o yüzden ödeme anında da girilebilir.
    const gsmNumber = dto.phone ?? customer.phone;
    if (!gsmNumber) {
      throw new BadRequestException(
        'Ödeme için bir telefon numarası gerekli. Lütfen kayıt bilgilerinize telefon ekleyin veya ödeme formunda girin.',
      );
    }

    const [name, ...surnameParts] = customer.fullName.trim().split(/\s+/);
    const surname = surnameParts.length > 0 ? surnameParts.join(' ') : name;

    const price = order.priceAmount.toFixed(2);
    const conversationId = order.id;

    const result = await new Promise<CheckoutFormInitializeResult>(
      (resolve, reject) => {
        this.iyzico.checkoutFormInitialize.create(
          {
            locale: Iyzipay.LOCALE.TR,
            conversationId,
            price,
            paidPrice: price,
            currency: this.mapCurrency(order.currency),
            basketId: order.id,
            paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
            callbackUrl:
              process.env.IYZICO_CALLBACK_URL ??
              'http://localhost:3001/api/v1/payments/callback',
            buyer: {
              id: customer.id,
              name,
              surname,
              identityNumber: dto.identityNumber,
              email: customer.email,
              gsmNumber,
              registrationAddress: dto.billingAddress,
              city: dto.billingCity,
              country: dto.billingCountry,
              zipCode: dto.billingZipCode,
              ip,
            },
            shippingAddress: {
              address: dto.billingAddress,
              contactName: customer.fullName,
              city: dto.billingCity,
              country: dto.billingCountry,
              zipCode: dto.billingZipCode,
            },
            billingAddress: {
              address: dto.billingAddress,
              contactName: customer.fullName,
              city: dto.billingCity,
              country: dto.billingCountry,
              zipCode: dto.billingZipCode,
            },
            basketItems: [
              {
                id: order.id,
                price,
                name: `GüzelKabir — ${order.orderNumber}`,
                category1: 'Kabir Bakımı',
                // Fiziksel bir ürün gönderilmiyor (bakım hizmeti) — VIRTUAL,
                // shippingAddress bu yüzden iyzico tarafında zorunlu değil
                // ama zararsız şekilde gönderiliyor.
                itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
              },
            ],
          },
          (error, res) => {
            if (error) {
              // Ham SDK hata nesnesini olduğu gibi reject etmiyoruz — bazı HTTP
              // istemcileri hata objesine gönderilen `options`'ı (dolayısıyla
              // buyer.identityNumber'ı) ekleyebiliyor. Yalnızca mesajı, ve o da
              // maskelenmiş haliyle, ileri taşınıyor (bkz. sınıf üstü yorum).
              const message =
                error instanceof Error ? error.message : String(error);
              reject(new Error(this.redact(message, dto.identityNumber)));
            } else {
              resolve(res);
            }
          },
        );
      },
    );

    if (result.status !== 'success' || !result.token) {
      throw new BadRequestException(
        this.redact(
          result.errorMessage ?? 'Ödeme başlatılamadı.',
          dto.identityNumber,
        ),
      );
    }

    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: 'iyzico',
          // Bu aşamada iyzico'nun kalıcı paymentId'si henüz yok — token,
          // hem retrieve hem webhook eşleştirmesi için kullanılan referans
          // (bkz. handleCallback/handleWebhook).
          providerPaymentIntentId: result.token,
          amount: order.priceAmount,
          currency: order.currency,
          status: 'requires_action',
        },
      }),
      this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'pending_payment' },
      }),
    ]);

    return {
      token: result.token,
      checkoutFormContent: result.checkoutFormContent,
      paymentPageUrl: result.paymentPageUrl,
    };
  }

  // iyzico Checkout Form'un ikinci (senkron) onay yolu — müşterinin tarayıcısı
  // ödeme tamamlandıktan hemen sonra bu adrese bir POST ile (token alanıyla)
  // yönlendirilir. Webhook'un yanında bağımsız bir doğrulama yolu (bkz.
  // CLAUDE.md "Payment provider: iyzico" — "belt-and-suspenders").
  async handleCallback(token: string | undefined): Promise<string> {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    if (!token) {
      return `${frontendUrl}/siparis?odeme=hata`;
    }

    const result = await this.retrieveCheckoutForm(token);
    const succeeded =
      result.status === 'success' && result.paymentStatus === 'SUCCESS';
    await this.finalizePayment(token, succeeded ? 'succeeded' : 'failed');

    return succeeded
      ? `${frontendUrl}/siparis?odeme=basarili`
      : `${frontendUrl}/siparis?odeme=hata`;
  }

  private async retrieveCheckoutForm(
    token: string,
  ): Promise<CheckoutFormRetrieveResult> {
    return new Promise((resolve, reject) => {
      this.iyzico.checkoutForm.retrieve(
        { locale: Iyzipay.LOCALE.TR, conversationId: randomUUID(), token },
        (error, res) => {
          if (error) reject(error);
          else resolve(res);
        },
      );
    });
  }

  // spec §5.1: imza doğrulaması olmadan hiçbir webhook payload'ı işlenmez,
  // işlenmiş event ID'leri processed_webhook_events'te tutulur (replay
  // koruması) — Stripe'tan devralınan aynı mimari, yalnızca imza algoritması
  // değişti (bkz. CLAUDE.md "Payment provider: iyzico, not Stripe").
  async handleIyzicoWebhook(
    body: IyzicoWebhookPayload,
    signature: string | undefined,
  ) {
    if (!signature) {
      throw new BadRequestException('X-IYZ-SIGNATURE-V3 header eksik.');
    }
    const secretKey = process.env.IYZICO_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException('Webhook doğrulama yapılandırılmamış.');
    }
    if (!this.verifyWebhookSignature(body, secretKey, signature)) {
      throw new BadRequestException('Webhook imzası doğrulanamadı.');
    }

    const alreadyProcessed = await this.prisma.processedWebhookEvent.findUnique(
      {
        where: {
          provider_eventId: {
            provider: 'iyzico',
            eventId: body.iyziReferenceCode,
          },
        },
      },
    );
    if (alreadyProcessed) {
      return { received: true, duplicate: true };
    }

    await this.finalizePayment(
      body.token,
      body.status === 'SUCCESS' ? 'succeeded' : 'failed',
    );

    await this.prisma.processedWebhookEvent.create({
      data: {
        provider: 'iyzico',
        eventId: body.iyziReferenceCode,
        eventType: body.iyziEventType,
      },
    });

    return { received: true, duplicate: false };
  }

  // iyzico webhook imza şeması (HPP/Checkout Form formatı, resmi dokümantasyon):
  // HMAC-SHA256(secretKey + iyziEventType + iyziPaymentId + token +
  // paymentConversationId + status), hex encode, X-IYZ-SIGNATURE-V3 header'ıyla
  // karşılaştırılır. Stripe'ın aksine imza HAM BODY byte'ları üzerinden değil,
  // parse edilmiş alanlar üzerinden hesaplanıyor — main.ts'teki raw-body
  // yönlendirmesi bu yüzden artık gerekmiyor (bkz. CLAUDE.md).
  private verifyWebhookSignature(
    body: IyzicoWebhookPayload,
    secretKey: string,
    signature: string,
  ): boolean {
    const data =
      secretKey +
      body.iyziEventType +
      body.iyziPaymentId +
      body.token +
      body.paymentConversationId +
      body.status;
    const expected = createHmac('sha256', secretKey).update(data).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, signatureBuf);
  }

  // spec §7.3 iade akışı, iyzico'ya uyarlanmış (bkz. CLAUDE.md "Payment
  // provider: iyzico" — Stripe Refunds API karşılığı). Admin Panel Phase 6
  // (Şikayet Yönetimi) tarafından, bir şikayet 'resolved_refund' olarak
  // çözüldükten SONRA, yalnızca ops_manager/admin onayıyla çağrılır.
  //
  // Gerçek, canlı araştırmayla bulunan gereklilik: iyzico'nun v1
  // /payment/refund'u üstteki `paymentId` değil, sepet KALEMİ bazlı
  // `paymentTransactionId`'yi ister (node_modules/iyzipay kaynağından
  // doğrulandı — checkoutFormInitialize/checkoutForm.retrieve'in
  // kullandığı AYNI SDK, farklı bir alan). Bu değer hiçbir yerde kalıcı
  // olarak saklanmıyor (yeni bir migration/kolon GEREKMEDİ) — ödemenin
  // kendi token'ı (providerPaymentIntentId, zaten kalıcı) üzerinden iade
  // anında checkoutForm.retrieve ile TAZE olarak çekiliyor. Bu hem daha az
  // değişiklikle (finalizePayment/webhook/callback yolları hiç
  // dokunulmadı) hem de daha doğru (her zaman en güncel işlem kimliği).
  async refund(orderId: string, description: string): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: 'succeeded' },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      throw new BadRequestException(
        'Bu sipariş için iade edilebilir (başarılı) bir ödeme bulunamadı.',
      );
    }
    if (!payment.providerPaymentIntentId) {
      throw new BadRequestException(
        'Ödeme kaydında iyzico referansı yok, iade yapılamaz.',
      );
    }

    const checkoutForm = await this.retrieveCheckoutForm(
      payment.providerPaymentIntentId,
    );
    const paymentTransactionId =
      checkoutForm.itemTransactions?.[0]?.paymentTransactionId;
    if (!paymentTransactionId) {
      throw new BadRequestException(
        'iyzico işlem kimliği alınamadı, iade yapılamaz.',
      );
    }

    const result = await new Promise<{
      status: string;
      errorMessage?: string;
    }>((resolve, reject) => {
      this.iyzico.refund.create(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: randomUUID(),
          paymentTransactionId,
          price: payment.amount.toFixed(2),
          // Sunucu-taraflı (ops/admin aksiyonuyla) tetiklenen bir iade —
          // gerçek bir müşteri isteği IP'si yok, createIntent'teki gibi
          // istekten alınamaz.
          ip: '127.0.0.1',
          currency: this.mapCurrency(payment.currency),
          reason: Iyzipay.REFUND_REASON.BUYER_REQUEST,
          description,
        },
        (error, res) => {
          if (error) {
            reject(
              new Error(error instanceof Error ? error.message : String(error)),
            );
          } else {
            resolve(res);
          }
        },
      );
    });

    if (result.status !== 'success') {
      throw new BadRequestException(
        result.errorMessage ?? 'İade işlemi başarısız oldu.',
      );
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded' },
    });
  }

  private mapCurrency(currency: string): string {
    // spec §7.3: EUR/USD/GBP diaspora desteği — iyzico Multi Currency add-on'u
    // gerektiriyor (bkz. CLAUDE.md), API tarafında ek bir kod değişikliği yok.
    switch (currency) {
      case 'EUR':
        return Iyzipay.CURRENCY.EUR;
      case 'USD':
        return Iyzipay.CURRENCY.USD;
      case 'GBP':
        return Iyzipay.CURRENCY.GBP;
      default:
        return Iyzipay.CURRENCY.TRY;
    }
  }

  private async finalizePayment(
    token: string,
    paymentStatus: 'succeeded' | 'failed',
  ): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: { providerPaymentIntentId: token },
    });
    if (!payment) {
      return;
    }
    // spec §7.1 madde 12: "Ödeme reddi/başarısızlığında sipariş
    // 'pending_payment' durumunda kalır" — order status yalnızca başarıda
    // değiştirilir.
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: paymentStatus },
    });
    if (paymentStatus === 'succeeded') {
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'confirmed' },
      });
    }
  }
}
