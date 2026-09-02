/**
 * spec §11.1 "Şikayet Yönetimi" (Admin Panel, ADIM 9, Phase 6): kanban durum
 * geçişleri (open→investigating→resolved_refund|resolved_reservice|rejected),
 * rol kısıtları, audit_log, disputed→closed (rejected kenarı). Gerçek iyzico
 * refund çağrısının BAŞARILI yolu burada test EDİLMİYOR — gerçek sandbox
 * anahtarı yok (bkz. CLAUDE.md, payment intent oluşturmayla aynı standart
 * sınır); o yol payments.service.spec.ts'te mock'lanmış SDK ile test edildi.
 * Needs a real (disposable) Postgres — see auth.e2e-spec.ts header for how to run.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.helper';

type ComplaintResponseBody = { id: string; status: string };
type ErrorResponseBody = {
  error: { code: string; message: string; requestId: string };
};

describe('Complaints (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let opsToken: string;
  let supportToken: string;
  let custToken: string;
  let customerId: string;
  let graveLocationId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    server = app.getHttpServer() as App;

    const cemetery = await prisma.cemetery.create({
      data: {
        name: 'Complaints Test Mezarlık',
        city: 'İstanbul',
        district: 'Üsküdar',
        municipalityAuthority: 'İBB',
      },
    });
    const graveLocation = await prisma.graveLocation.create({
      data: { cemeteryId: cemetery.id, section: '1', plot: '1' },
    });
    graveLocationId = graveLocation.id;

    const customer = await prisma.user.create({
      data: {
        email: 'complaints-cust@test.com',
        passwordHash: 'x',
        role: 'customer',
        fullName: 'Cust',
        locale: 'tr',
      },
    });
    customerId = customer.id;
    const ops = await prisma.user.create({
      data: {
        email: 'complaints-ops@test.com',
        passwordHash: 'x',
        role: 'ops_manager',
        fullName: 'Ops',
        locale: 'tr',
      },
    });
    const support = await prisma.user.create({
      data: {
        email: 'complaints-support@test.com',
        passwordHash: 'x',
        role: 'support_agent',
        fullName: 'Support',
        locale: 'tr',
      },
    });

    opsToken = ctx.accessTokenFor(ops.id, 'ops_manager');
    supportToken = ctx.accessTokenFor(support.id, 'support_agent');
    custToken = ctx.accessTokenFor(customer.id, 'customer');
  });

  afterAll(async () => {
    await app.close();
  });

  async function createDisputedOrderWithComplaint(orderNumber: string) {
    const completedAt = new Date();
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'disputed',
        priceAmount: 850,
        currency: 'TRY',
        completedAt,
        approvalDeadline: new Date(completedAt.getTime() + 48 * 60 * 60 * 1000),
      },
    });
    const complaint = await prisma.complaint.create({
      data: {
        orderId: order.id,
        raisedBy: customerId,
        category: 'quality',
        description: 'Mermer yeterince temizlenmemiş.',
        status: 'open',
      },
    });
    return { order, complaint };
  }

  it('GET /complaints is ops/support/admin-only and filters by status', async () => {
    const { complaint } =
      await createDisputedOrderWithComplaint('#MB-CMP-LIST1');

    const forbidden = await request(server)
      .get('/api/v1/complaints')
      .set('Authorization', `Bearer ${custToken}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(server)
      .get('/api/v1/complaints')
      .query({ status: 'open' })
      .set('Authorization', `Bearer ${supportToken}`);
    expect(ok.status).toBe(200);
    const body = ok.body as { items: Array<{ id: string; status: string }> };
    expect(body.items.some((c) => c.id === complaint.id)).toBe(true);
    expect(body.items.every((c) => c.status === 'open')).toBe(true);
  });

  it('enforces open -> investigating -> resolved_refund and writes audit_log at each step', async () => {
    const { complaint } =
      await createDisputedOrderWithComplaint('#MB-CMP-CHAIN1');

    const resolveTooEarly = await request(server)
      .post(`/api/v1/complaints/${complaint.id}/resolve`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ outcome: 'resolved_refund', resolutionNotes: 'Erken deneme.' });
    expect(resolveTooEarly.status).toBe(400);

    const investigated = await request(server)
      .post(`/api/v1/complaints/${complaint.id}/investigate`)
      .set('Authorization', `Bearer ${supportToken}`);
    expect(investigated.status).toBe(200);
    expect((investigated.body as ComplaintResponseBody).status).toBe(
      'investigating',
    );

    const noReason = await request(server)
      .post(`/api/v1/complaints/${complaint.id}/resolve`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({ outcome: 'resolved_refund' });
    expect(noReason.status).toBe(400);

    const resolved = await request(server)
      .post(`/api/v1/complaints/${complaint.id}/resolve`)
      .set('Authorization', `Bearer ${supportToken}`)
      .send({
        outcome: 'resolved_refund',
        resolutionNotes: 'Tutar iade edilecek.',
      });
    expect(resolved.status).toBe(200);
    expect((resolved.body as ComplaintResponseBody).status).toBe(
      'resolved_refund',
    );

    const logs = await prisma.auditLog.findMany({
      where: { entityId: complaint.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => l.action)).toEqual([
      'complaint.investigate',
      'complaint.resolve',
    ]);

    // spec §9 satır 6 "Şikayet açıldı/çözüldü" — çözüm yarısı (E-posta + SMS).
    const complaintResolvedNotifications = await prisma.notification.findMany({
      where: {
        templateKey: 'complaint_resolved',
        payload: { path: ['orderId'], equals: complaint.orderId },
      },
    });
    expect(complaintResolvedNotifications.map((n) => n.channel).sort()).toEqual(
      ['email', 'sms'],
    );
  });

  it('rejected outcome closes a disputed order (spec §21.2 disputed -> closed)', async () => {
    const { order, complaint } =
      await createDisputedOrderWithComplaint('#MB-CMP-REJECT1');
    await request(server)
      .post(`/api/v1/complaints/${complaint.id}/investigate`)
      .set('Authorization', `Bearer ${opsToken}`);

    const resolved = await request(server)
      .post(`/api/v1/complaints/${complaint.id}/resolve`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ outcome: 'rejected', resolutionNotes: 'Kanıtlar yetersiz.' });
    expect(resolved.status).toBe(200);

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(updatedOrder?.status).toBe('closed');

    const logs = await prisma.auditLog.findMany({
      where: { entityId: order.id, action: 'order.dispute_rejected' },
    });
    expect(logs.length).toBe(1);
  });

  it('resolved_reservice does NOT close the order (real re-service flow not built yet, flagged not faked)', async () => {
    const { order, complaint } =
      await createDisputedOrderWithComplaint('#MB-CMP-RESVC1');
    await request(server)
      .post(`/api/v1/complaints/${complaint.id}/investigate`)
      .set('Authorization', `Bearer ${opsToken}`);
    const resolved = await request(server)
      .post(`/api/v1/complaints/${complaint.id}/resolve`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({
        outcome: 'resolved_reservice',
        resolutionNotes: 'Tekrar hizmet planlanacak.',
      });
    expect(resolved.status).toBe(200);

    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(updatedOrder?.status).toBe('disputed');
  });

  it('POST /complaints/:id/process-refund is ops/admin-only and requires resolved_refund status', async () => {
    const { complaint } =
      await createDisputedOrderWithComplaint('#MB-CMP-REFUND1');

    const forbidden = await request(server)
      .post(`/api/v1/complaints/${complaint.id}/process-refund`)
      .set('Authorization', `Bearer ${supportToken}`);
    expect(forbidden.status).toBe(403);

    const tooEarly = await request(server)
      .post(`/api/v1/complaints/${complaint.id}/process-refund`)
      .set('Authorization', `Bearer ${opsToken}`);
    expect(tooEarly.status).toBe(400);

    await request(server)
      .post(`/api/v1/complaints/${complaint.id}/investigate`)
      .set('Authorization', `Bearer ${opsToken}`);
    await request(server)
      .post(`/api/v1/complaints/${complaint.id}/resolve`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ outcome: 'resolved_refund', resolutionNotes: 'İade edilecek.' });

    // Bu sipariş için hiç Payment satırı yok (gerçek dünyada olmaz — her
    // 'disputed' sipariş bir ödemeden geçmiştir — ama bu test iyzico'ya HİÇ
    // dokunmadan gerçek "iade edilebilir ödeme yok" hatasını doğruluyor.
    const noPayment = await request(server)
      .post(`/api/v1/complaints/${complaint.id}/process-refund`)
      .set('Authorization', `Bearer ${opsToken}`);
    expect(noPayment.status).toBe(400);
    expect((noPayment.body as ErrorResponseBody).error.message).toContain(
      'iade edilebilir',
    );
  });
});
