/**
 * spec §7.1/§2.3/§17: SLA sweep business logic (24h payment timeout, 48h
 * auto-close, 30min assignment escalation). Tests SlaService directly rather
 * than through BullMQ — BullMQ needs a real Redis, which isn't available in
 * this sandbox (see CLAUDE.md); the scheduling wiring itself (cron patterns,
 * queue registration) is exercised implicitly by app bootstrap in every other
 * e2e spec (SlaModule.onModuleInit runs there) and is not re-tested here.
 * Needs a real (disposable) Postgres — see auth.e2e-spec.ts header for how to run.
 */
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { SlaService } from '../src/sla/sla.service';
import { createTestApp } from './test-app.helper';

describe('SLA sweeps (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let slaService: SlaService;
  let graveLocationId: string;
  let customerId: string;
  let partnerId: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    slaService = app.get(SlaService);

    const cemetery = await prisma.cemetery.create({
      data: {
        name: 'SLA Test Mezarlık',
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
        email: 'sla-cust@test.com',
        passwordHash: 'x',
        role: 'customer',
        fullName: 'Cust',
        locale: 'tr',
      },
    });
    customerId = customer.id;
    const partnerUser = await prisma.user.create({
      data: {
        email: 'sla-partner@test.com',
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
        status: 'active',
        serviceCities: ['İstanbul'],
      },
    });
    partnerId = partner.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // @updatedAt alanları Prisma tarafından her update()'te otomatik "now" ile
  // ezildiği için, geçmişe atmak amacıyla ham SQL kullanılıyor.
  //
  // Zaman, bir JS Date PARAMETRESİ olarak DEĞİL, açık bir UTC metin literal'i
  // olarak veriliyor (ör. '2026-08-24 13:45:46.147'::timestamp). Sebep: bu
  // sütun timestamp(3) — saat dilimsiz. $executeRaw'a bir Date nesnesi
  // parametre olarak verildiğinde, alttaki sürücü onu VERİTABANI OTURUMUNUN
  // saat dilimine (bu test ortamındaki embedded Postgres'te varsayılan olarak
  // Europe/Istanbul, UTC+3) göre "yerel" duvar saatine çevirip öyle yazıyor —
  // ama Prisma'nın normal ORM okuma yolu bu naive değeri geri okurken tersine
  // çevirmiyor, doğrudan UTC kabul ediyor. Sonuç: yaz-oku asimetrisi, sessizce
  // 3 saatlik bir kayma. Açık metin + ::timestamp cast, sürücünün Date-özel
  // saat dilimi dönüşüm mantığını devreye hiç sokmadan hedeflenen duvar saati
  // basamaklarını birebir yazdırıyor.
  async function backdateUpdatedAt(orderId: string, hoursAgo: number) {
    const backdated = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const literal = backdated.toISOString().replace('T', ' ').replace('Z', '');
    await prisma.$executeRaw`UPDATE "orders" SET "updated_at" = ${literal}::timestamp WHERE "id" = ${orderId}::uuid`;
  }

  it('cancels pending_payment orders older than 24h but leaves recent ones alone (spec §7.1 madde 12)', async () => {
    const old = await prisma.order.create({
      data: {
        orderNumber: '#MB-SLA-PAY-OLD',
        customerId,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'pending_payment',
        priceAmount: 850,
        currency: 'TRY',
      },
    });
    await backdateUpdatedAt(old.id, 25);

    const recent = await prisma.order.create({
      data: {
        orderNumber: '#MB-SLA-PAY-RECENT',
        customerId,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'pending_payment',
        priceAmount: 850,
        currency: 'TRY',
      },
    });

    const count = await slaService.cancelUnpaidOrders();
    expect(count).toBeGreaterThanOrEqual(1);

    const oldAfter = await prisma.order.findUnique({ where: { id: old.id } });
    const recentAfter = await prisma.order.findUnique({
      where: { id: recent.id },
    });
    expect(oldAfter?.status).toBe('cancelled');
    expect(recentAfter?.status).toBe('pending_payment');

    // spec §11.1 zaman çizelgesi görünümü: SLA otomasyonu da audit_log'a
    // yazar, insan aksiyonlarından actorId=null/actorRole='system' ile ayrılır.
    const logs = await prisma.auditLog.findMany({
      where: { entityId: old.id, action: 'order.auto_cancel' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].actorId).toBeNull();
    expect(logs[0].actorRole).toBe('system');
  });

  it('auto-closes completed_pending_approval orders past their approval deadline and creates a payout (spec §2.3 madde 7/§17)', async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: '#MB-SLA-APPROVE-OLD',
        customerId,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'completed_pending_approval',
        assignedPartnerId: partnerId,
        priceAmount: 850,
        currency: 'TRY',
        completedAt: new Date(Date.now() - 50 * 60 * 60 * 1000),
        approvalDeadline: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h in the past
      },
    });

    const count = await slaService.autoCloseApprovedOrders();
    expect(count).toBeGreaterThanOrEqual(1);

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    expect(updated?.status).toBe('closed');

    const payout = await prisma.partnerPayout.findFirst({
      where: { orderId: order.id },
    });
    expect(payout?.status).toBe('pending');

    // Idempotent: running it again must not create a second payout for the same order.
    await slaService.autoCloseApprovedOrders();
    const payoutCount = await prisma.partnerPayout.count({
      where: { orderId: order.id },
    });
    expect(payoutCount).toBe(1);

    const logs = await prisma.auditLog.findMany({
      where: { entityId: order.id, action: 'order.auto_close' },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].actorId).toBeNull();
  });

  it('escalates confirmed orders unassigned past 30min and does not duplicate notifications on re-sweep (spec §17)', async () => {
    const ops = await prisma.user.create({
      data: {
        email: 'sla-ops@test.com',
        passwordHash: 'x',
        role: 'ops_manager',
        fullName: 'Ops',
        locale: 'tr',
      },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: '#MB-SLA-ASSIGN-OLD',
        customerId,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'confirmed',
        priceAmount: 850,
        currency: 'TRY',
      },
    });
    await backdateUpdatedAt(order.id, 35 / 60);

    const count = await slaService.escalateOverdueAssignments();
    expect(count).toBeGreaterThanOrEqual(1);

    const notifications = await prisma.notification.findMany({
      where: { userId: ops.id, templateKey: 'assignment_sla_escalation' },
    });
    expect(notifications.length).toBe(1);

    // Re-sweep must not create a duplicate notification for the same order+ops user.
    await slaService.escalateOverdueAssignments();
    const notificationsAfter = await prisma.notification.findMany({
      where: { userId: ops.id, templateKey: 'assignment_sla_escalation' },
    });
    expect(notificationsAfter.length).toBe(1);
  });
});
