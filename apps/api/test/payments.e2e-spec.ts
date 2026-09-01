/**
 * spec §5.1: webhook imza doğrulaması + processed_webhook_events replay koruması.
 * "Bu ödeme güvenliğinin temeli, atlanamaz" — bu dosya asıl doğrulama katmanı.
 * ADIM 6'da Stripe'tan iyzico'ya geçildi (bkz. CLAUDE.md "Payment provider:
 * iyzico, not Stripe") — imza artık X-IYZ-SIGNATURE-V3 (HMAC-SHA256, parse
 * edilmiş alanlar üzerinden), Stripe-Signature (ham body) değil.
 * Needs a real (disposable) Postgres — see auth.e2e-spec.ts header for how to run.
 */
import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.helper';

const WEBHOOK_PATH = '/api/v1/payments/webhook';

type WebhookResponseBody = { received: boolean; duplicate: boolean };

function signIyzicoWebhook(payload: {
  iyziEventType: string;
  iyziPaymentId: number;
  token: string;
  paymentConversationId: string;
  status: string;
}): string {
  const secretKey = process.env.IYZICO_SECRET_KEY!;
  const data =
    secretKey +
    payload.iyziEventType +
    payload.iyziPaymentId +
    payload.token +
    payload.paymentConversationId +
    payload.status;
  return createHmac('sha256', secretKey).update(data).digest('hex');
}

describe('Payments (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let accessTokenFor: Awaited<
    ReturnType<typeof createTestApp>
  >['accessTokenFor'];

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    accessTokenFor = ctx.accessTokenFor;
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a webhook with no X-IYZ-SIGNATURE-V3 header', async () => {
    const res = await request(server).post(WEBHOOK_PATH).send({ foo: 'bar' });
    expect(res.status).toBe(400);
  });

  it('rejects a webhook with an invalid signature', async () => {
    const res = await request(server)
      .post(WEBHOOK_PATH)
      .set('x-iyz-signature-v3', 'deadbeef')
      .send({
        paymentConversationId: 'conv',
        merchantId: 1,
        status: 'SUCCESS',
        token: 'tok_bad_sig',
        iyziReferenceCode: 'ref_bad_sig',
        iyziEventType: 'CHECKOUT_FORM_AUTH',
        iyziEventTime: Date.now(),
        iyziPaymentId: 1,
      });
    expect(res.status).toBe(400);
  });

  it('processes a validly-signed CHECKOUT_FORM_AUTH SUCCESS event and marks order confirmed', async () => {
    const cemetery = await prisma.cemetery.create({
      data: {
        name: 'Payments Test Mezarlık',
        city: 'İstanbul',
        district: 'Üsküdar',
        municipalityAuthority: 'İBB',
      },
    });
    const graveLocation = await prisma.graveLocation.create({
      data: { cemeteryId: cemetery.id, section: '1', plot: '1' },
    });
    const customer = await prisma.user.create({
      data: {
        email: 'payments-cust@test.com',
        passwordHash: 'x',
        role: 'customer',
        fullName: 'Cust',
        locale: 'tr',
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: '#MB-TEST-PAY1',
        customerId: customer.id,
        graveLocationId: graveLocation.id,
        serviceType: 'cleaning',
        status: 'pending_payment',
        priceAmount: 850,
        currency: 'TRY',
      },
    });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'iyzico',
        providerPaymentIntentId: 'tok_e2e_test',
        amount: 850,
        currency: 'TRY',
        status: 'requires_action',
      },
    });

    const payload = {
      paymentConversationId: order.id,
      merchantId: 12345,
      status: 'SUCCESS',
      token: 'tok_e2e_test',
      iyziReferenceCode: 'ref_e2e_test',
      iyziEventType: 'CHECKOUT_FORM_AUTH',
      iyziEventTime: Date.now(),
      iyziPaymentId: 99887766,
    };
    const signature = signIyzicoWebhook(payload);

    const res = await request(server)
      .post(WEBHOOK_PATH)
      .set('x-iyz-signature-v3', signature)
      .send(payload);
    expect(res.status).toBe(200);
    expect((res.body as WebhookResponseBody).duplicate).toBe(false);

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    const updatedPayment = await prisma.payment.findFirst({
      where: { orderId: order.id },
    });
    expect(updatedOrder?.status).toBe('confirmed');
    expect(updatedPayment?.status).toBe('succeeded');

    // Replay: the exact same event delivered again must not be reprocessed.
    const replay = await request(server)
      .post(WEBHOOK_PATH)
      .set('x-iyz-signature-v3', signature)
      .send(payload);
    expect(replay.status).toBe(200);
    expect((replay.body as WebhookResponseBody).duplicate).toBe(true);

    const processedCount = await prisma.processedWebhookEvent.count({
      where: { eventId: 'ref_e2e_test' },
    });
    expect(processedCount).toBe(1);
  });

  // POST /payments/intent also carries @Idempotent() (spec §5.1), but its
  // success path calls the real iyzico SDK — untestable here without a real
  // iyzico sandbox key (see CLAUDE.md). What IS testable without one: a failed
  // attempt must not poison the idempotency cache with a stuck "processing"
  // lock or a stale cached failure — a retry has to actually retry, not hang.
  it('does not deadlock retries on POST /payments/intent when the underlying call fails (no real iyzico key here)', async () => {
    const cemetery = await prisma.cemetery.create({
      data: {
        name: 'Payments Idem Test',
        city: 'İstanbul',
        district: 'Üsküdar',
        municipalityAuthority: 'İBB',
      },
    });
    const graveLocation = await prisma.graveLocation.create({
      data: { cemeteryId: cemetery.id, section: '1', plot: '1' },
    });
    const customer = await prisma.user.create({
      data: {
        email: 'payments-idem-cust@test.com',
        phone: '+905551234567',
        passwordHash: 'x',
        role: 'customer',
        fullName: 'Cust',
        locale: 'tr',
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: '#MB-TEST-PAY2',
        customerId: customer.id,
        graveLocationId: graveLocation.id,
        serviceType: 'cleaning',
        status: 'draft',
        priceAmount: 850,
        currency: 'TRY',
      },
    });
    const custToken = accessTokenFor(customer.id, 'customer');
    const key = 'payments-intent-e2e-idem-key';
    const body = {
      orderId: order.id,
      identityNumber: '11111111111',
      billingAddress: 'Örnek Mahalle, Örnek Sokak No:1',
      billingCity: 'İstanbul',
      billingCountry: 'Türkiye',
    };

    const first = await request(server)
      .post('/api/v1/payments/intent')
      .set('Authorization', `Bearer ${custToken}`)
      .set('Idempotency-Key', key)
      .send(body);
    // Placeholder iyzico key -> the real API call fails (auth/signature error
    // from iyzico's sandbox, or a network error if this sandbox has no egress
    // to it — either way, a failure, not a success).
    expect(first.status).toBeGreaterThanOrEqual(400);

    const second = await request(server)
      .post('/api/v1/payments/intent')
      .set('Authorization', `Bearer ${custToken}`)
      .set('Idempotency-Key', key)
      .send(body);
    // Must actually retry and fail the same honest way again — not return a
    // stuck 409 "already processing" from an abandoned lock, and not a
    // silently-cached success either.
    expect(second.status).toBe(first.status);
  });

  it('POST /payments/intent requires a phone number when the customer has none on file', async () => {
    const cemetery = await prisma.cemetery.create({
      data: {
        name: 'Payments No Phone Test',
        city: 'İstanbul',
        district: 'Üsküdar',
        municipalityAuthority: 'İBB',
      },
    });
    const graveLocation = await prisma.graveLocation.create({
      data: { cemeteryId: cemetery.id, section: '1', plot: '1' },
    });
    const customer = await prisma.user.create({
      data: {
        email: 'payments-no-phone@test.com',
        passwordHash: 'x',
        role: 'customer',
        fullName: 'No Phone',
        locale: 'tr',
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: '#MB-TEST-PAY3',
        customerId: customer.id,
        graveLocationId: graveLocation.id,
        serviceType: 'cleaning',
        status: 'draft',
        priceAmount: 850,
        currency: 'TRY',
      },
    });
    const custToken = accessTokenFor(customer.id, 'customer');

    const res = await request(server)
      .post('/api/v1/payments/intent')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        orderId: order.id,
        identityNumber: '11111111111',
        billingAddress: 'Örnek Mahalle, Örnek Sokak No:1',
        billingCity: 'İstanbul',
        billingCountry: 'Türkiye',
      });
    expect(res.status).toBe(400);
  });
});
