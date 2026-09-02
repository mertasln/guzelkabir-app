/**
 * spec §5/§6.2/§17/§21.2: orders lifecycle, field-partner KYC gate, state
 * machine transitions, and Idempotency-Key.
 * Needs a real (disposable) Postgres — see auth.e2e-spec.ts header for how to run.
 */
import { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.helper';
import { makeJpegWithExif } from './evidence-fixtures';

type OrderResponseBody = { id: string; status: string };
type OrderListResponseBody = { items: { id: string; customerId: string }[] };
// spec §5: standart hata zarfı — bkz. common/filters/http-exception.filter.ts.
type ErrorResponseBody = {
  error: { code: string; message: string; requestId: string };
};
type UploadUrlResponseBody = { fileKey: string; uploadUrl: string };

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let mockStorage: Awaited<ReturnType<typeof createTestApp>>['mockStorage'];
  let custToken: string;
  let opsToken: string;
  let partnerToken: string;
  let graveLocationId: string;
  let graveLat: number;
  let graveLng: number;
  let partnerId: string;
  let customerId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    mockStorage = ctx.mockStorage;
    server = app.getHttpServer() as App;

    const cemetery = await prisma.cemetery.create({
      data: {
        name: 'Orders Test Mezarlık',
        city: 'İstanbul',
        district: 'Üsküdar',
        municipalityAuthority: 'İBB',
      },
    });
    graveLat = 41.0012;
    graveLng = 29.0361;
    const graveLocation = await prisma.graveLocation.create({
      data: {
        cemeteryId: cemetery.id,
        section: '1',
        plot: '1',
        lat: graveLat,
        lng: graveLng,
      },
    });
    graveLocationId = graveLocation.id;

    const customer = await prisma.user.create({
      data: {
        email: 'orders-cust@test.com',
        passwordHash: 'x',
        role: 'customer',
        fullName: 'Cust',
        locale: 'tr',
      },
    });
    customerId = customer.id;
    const ops = await prisma.user.create({
      data: {
        email: 'orders-ops@test.com',
        passwordHash: 'x',
        role: 'ops_manager',
        fullName: 'Ops',
        locale: 'tr',
      },
    });
    const partnerUser = await prisma.user.create({
      data: {
        email: 'orders-partner@test.com',
        passwordHash: 'x',
        role: 'field_partner',
        fullName: 'Partner',
        locale: 'tr',
      },
    });
    const partner = await prisma.fieldPartner.create({
      data: {
        userId: partnerUser.id,
        nationalIdEncrypted: 'x',
        status: 'onboarding',
        serviceCities: ['İstanbul'],
      },
    });
    partnerId = partner.id;

    custToken = ctx.accessTokenFor(customer.id, 'customer');
    opsToken = ctx.accessTokenFor(ops.id, 'ops_manager');
    partnerToken = ctx.accessTokenFor(partnerUser.id, 'field_partner');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects assignment to a field partner whose KYC is not active (spec §6.2/§17)', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: '#MB-TEST-KYC1',
        customerId,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'confirmed',
        priceAmount: 850,
        currency: 'TRY',
      },
    });

    const rejected = await request(server)
      .patch(`/api/v1/orders/${order.id}/assign`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ fieldPartnerId: partnerId });
    expect(rejected.status).toBe(403);
    expect((rejected.body as ErrorResponseBody).error.message).toContain(
      'aktif değil',
    );

    await prisma.fieldPartner.update({
      where: { id: partnerId },
      data: { status: 'active' },
    });

    const accepted = await request(server)
      .patch(`/api/v1/orders/${order.id}/assign`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ fieldPartnerId: partnerId });
    expect(accepted.status).toBe(200);
    expect((accepted.body as OrderResponseBody).status).toBe('assigned');

    const logs = await prisma.auditLog.findMany({
      where: { entityId: order.id, action: 'order.assign' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].newValue).toEqual({
      status: 'assigned',
      assignedPartnerId: partnerId,
    });

    // spec §9 satır 2 "Saha atandı" — yalnızca WhatsApp tanımlı, WhatsApp bu
    // fazda kasıtlı olarak ertelendi. Kullanıcı kararıyla e-posta fallback
    // eklendi (WhatsApp gelene kadar müşteri hiç bilgilendirilmesin
    // istenmedi, bkz. CLAUDE.md/templates.ts). WhatsApp satırı 'queued'
    // yazılır ama hiçbir gerçek gönderim asla denenmez; e-posta satırı
    // gerçek dispatch job'ı alır (bu sandbox'ta Redis erişilemediği için
    // yine de 'queued' kalır — bkz. NotificationsService).
    const notifications = await prisma.notification.findMany({
      where: { userId: customerId, templateKey: 'field_assigned' },
    });
    expect(notifications.map((n) => n.channel).sort()).toEqual([
      'email',
      'whatsapp',
    ]);
    expect(notifications.every((n) => n.status === 'queued')).toBe(true);
  });

  it('enforces the assigned → in_progress → completed_pending_approval → closed chain (spec §21.2)', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: '#MB-TEST-CHAIN1',
        customerId,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'assigned',
        assignedPartnerId: partnerId,
        priceAmount: 850,
        currency: 'TRY',
      },
    });

    // Evidence/complete must not be reachable before start() (spec §2.3 madde 5).
    // fileKey burada gerçek bir mock nesnesine karşılık gelmiyor — order status
    // kontrolü storage'a hiç dokunmadan önce başarısız olmalı.
    const evidenceTooEarly = await request(server)
      .post(`/api/v1/orders/${order.id}/evidence`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ photoType: 'before', fileKey: 'evidence/unused/unused.jpg' });
    expect(evidenceTooEarly.status).toBe(400);

    const completeTooEarly = await request(server)
      .post(`/api/v1/orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${partnerToken}`);
    expect(completeTooEarly.status).toBe(400);

    const started = await request(server)
      .post(`/api/v1/orders/${order.id}/start`)
      .set('Authorization', `Bearer ${partnerToken}`);
    expect(started.status).toBe(200);
    expect((started.body as OrderResponseBody).status).toBe('in_progress');

    const completeBeforeEvidence = await request(server)
      .post(`/api/v1/orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${partnerToken}`);
    expect(completeBeforeEvidence.status).toBe(422);

    // spec §8.2: "1 geniş açı (wide_shot), 1 detay çekimi (detail_shot)" —
    // ikisi de gerçek, mezar konumuna yakın GPS EXIF'i taşıyan JPEG'ler.
    for (const photoType of ['wide_shot', 'detail_shot'] as const) {
      const jpeg = await makeJpegWithExif({
        lat: graveLat,
        lng: graveLng,
        timestamp: new Date(),
      });
      const contentSha256 = createHash('sha256').update(jpeg).digest('base64');
      const uploadUrlRes = await request(server)
        .post(`/api/v1/orders/${order.id}/evidence/upload-url`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ contentSha256 });
      expect(uploadUrlRes.status).toBe(201);
      const { fileKey } = uploadUrlRes.body as UploadUrlResponseBody;

      mockStorage.setObject(fileKey, jpeg);

      const res = await request(server)
        .post(`/api/v1/orders/${order.id}/evidence`)
        .set('Authorization', `Bearer ${partnerToken}`)
        .send({ photoType, fileKey });
      expect(res.status).toBe(201);
    }

    const completed = await request(server)
      .post(`/api/v1/orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${partnerToken}`);
    expect(completed.status).toBe(200);
    expect((completed.body as OrderResponseBody).status).toBe(
      'completed_pending_approval',
    );

    // spec §9 satır 3 "Görev tamamlandı" — E-posta + SMS + WhatsApp (WhatsApp
    // ertelendi, aynı gerekçe). Üçü de bu tetikleyicide satır olarak yazılır.
    const taskCompletedNotifications = await prisma.notification.findMany({
      where: { userId: customerId, templateKey: 'task_completed' },
    });
    expect(taskCompletedNotifications.map((n) => n.channel).sort()).toEqual([
      'email',
      'sms',
      'whatsapp',
    ]);
    expect(taskCompletedNotifications.every((n) => n.status === 'queued')).toBe(
      true,
    );

    const approved = await request(server)
      .post(`/api/v1/orders/${order.id}/approve`)
      .set('Authorization', `Bearer ${custToken}`);
    expect(approved.status).toBe(200);
    expect((approved.body as OrderResponseBody).status).toBe('closed');

    const payout = await prisma.partnerPayout.findFirst({
      where: { orderId: order.id },
    });
    expect(payout?.status).toBe('pending');

    // spec §11.1 "Sipariş Yönetimi: ... zaman çizelgesi/audit trail
    // görünümü" (Admin Panel, ADIM 9) — her durum geçişi audit_log'a yazılmış
    // olmalı, ekranın gösterecek gerçek verisi olsun.
    const auditRes = await request(server)
      .get(`/api/v1/orders/${order.id}/audit`)
      .set('Authorization', `Bearer ${opsToken}`);
    expect(auditRes.status).toBe(200);
    const auditActions = (auditRes.body as { action: string }[]).map(
      (e) => e.action,
    );
    expect(auditActions).toEqual([
      'order.start',
      'order.complete',
      'order.approve',
    ]);

    const filteredRes = await request(server)
      .get('/api/v1/orders')
      .query({ partnerId })
      .set('Authorization', `Bearer ${opsToken}`);
    expect(filteredRes.status).toBe(200);
    const filteredIds = (
      filteredRes.body as { items: { id: string }[] }
    ).items.map((o) => o.id);
    expect(filteredIds).toContain(order.id);
  });

  it('transitions completed_pending_approval → disputed when a complaint is raised (spec §21.2)', async () => {
    const completedAt = new Date();
    const order = await prisma.order.create({
      data: {
        orderNumber: '#MB-TEST-DISPUTE1',
        customerId,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'completed_pending_approval',
        assignedPartnerId: partnerId,
        priceAmount: 850,
        currency: 'TRY',
        completedAt,
        approvalDeadline: new Date(completedAt.getTime() + 48 * 60 * 60 * 1000),
      },
    });

    const complaintRes = await request(server)
      .post(`/api/v1/orders/${order.id}/complaint`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        category: 'quality',
        description: 'Mermer yeterince temizlenmemiş.',
      });
    expect(complaintRes.status).toBe(201);

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(updatedOrder?.status).toBe('disputed');

    const logs = await prisma.auditLog.findMany({
      where: { entityId: order.id, action: 'order.dispute' },
    });
    expect(logs.length).toBe(1);

    // spec §9 satır 6 "Şikayet açıldı/çözüldü" — açılış yarısı (E-posta + SMS).
    const complaintOpenedNotifications = await prisma.notification.findMany({
      where: { userId: customerId, templateKey: 'complaint_opened' },
    });
    expect(complaintOpenedNotifications.map((n) => n.channel).sort()).toEqual([
      'email',
      'sms',
    ]);
  });

  it('dedupes POST /orders when the same Idempotency-Key is reused (spec §5.1)', async () => {
    const body = {
      graveLocationId,
      serviceType: 'cleaning',
      priceAmount: 850,
      currency: 'TRY',
    };
    const key = 'orders-e2e-idem-key';

    const first = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${custToken}`)
      .set('Idempotency-Key', key)
      .send(body);
    const second = await request(server)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${custToken}`)
      .set('Idempotency-Key', key)
      .send(body);

    const firstBody = first.body as OrderResponseBody;
    const secondBody = second.body as OrderResponseBody;
    expect(firstBody.id).toBe(secondBody.id);
    const count = await prisma.order.count({ where: { id: firstBody.id } });
    expect(count).toBe(1);
  });

  it("scopes GET /orders to the caller's own orders when called as a customer", async () => {
    const res = await request(server)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${custToken}`);
    expect(res.status).toBe(200);
    const body = res.body as OrderListResponseBody;
    expect(body.items.length).toBeGreaterThan(0);
    for (const order of body.items) {
      expect(order.customerId).toBe(customerId);
    }
  });
});
