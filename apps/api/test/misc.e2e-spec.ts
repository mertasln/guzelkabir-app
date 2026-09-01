/**
 * spec §5: cemeteries search, KPI dashboard RBAC, partner onboarding encryption,
 * subscription create/cancel. Needs a real (disposable) Postgres — see
 * auth.e2e-spec.ts header for how to run.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.helper';

type CemeterySearchResponseBody = { items: unknown[] };
type KpiResponseBody = { conversionFunnel: unknown };
type SubscriptionResponseBody = { id: string; status: string };

describe('Cemeteries / KPI / Partners / Subscriptions (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let custToken: string;
  let adminToken: string;
  let opsToken: string;
  let partnerToken: string;
  let partnerUserId: string;
  let graveLocationId: string;
  let cemetery2Id: string;
  let adminUserId: string;
  let custIdForStaffTest: string;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    server = app.getHttpServer() as App;

    await prisma.cemetery.create({
      data: {
        name: 'Misc Test Mezarlık',
        city: 'İstanbul',
        district: 'Şişli',
        municipalityAuthority: 'İBB',
      },
    });
    const cemetery2 = await prisma.cemetery.create({
      data: {
        name: 'İkinci Mezarlık',
        city: 'Ankara',
        district: 'Çankaya',
        municipalityAuthority: 'ABB',
      },
    });
    const graveLocation = await prisma.graveLocation.create({
      data: { cemeteryId: cemetery2.id, section: '1', plot: '1' },
    });
    graveLocationId = graveLocation.id;
    cemetery2Id = cemetery2.id;

    const customer = await prisma.user.create({
      data: {
        email: 'misc-cust@test.com',
        passwordHash: 'x',
        role: 'customer',
        fullName: 'Cust',
        locale: 'tr',
      },
    });
    custIdForStaffTest = customer.id;
    const admin = await prisma.user.create({
      data: {
        email: 'misc-admin@test.com',
        passwordHash: 'x',
        role: 'admin',
        fullName: 'Admin',
        locale: 'tr',
      },
    });
    adminUserId = admin.id;
    const partnerUser = await prisma.user.create({
      data: {
        email: 'misc-partner@test.com',
        passwordHash: 'x',
        role: 'field_partner',
        fullName: 'Partner',
        locale: 'tr',
      },
    });
    partnerUserId = partnerUser.id;

    const ops = await prisma.user.create({
      data: {
        email: 'misc-ops@test.com',
        passwordHash: 'x',
        role: 'ops_manager',
        fullName: 'Ops',
        locale: 'tr',
      },
    });

    custToken = ctx.accessTokenFor(customer.id, 'customer');
    adminToken = ctx.accessTokenFor(admin.id, 'admin');
    opsToken = ctx.accessTokenFor(ops.id, 'ops_manager');
    partnerToken = ctx.accessTokenFor(partnerUser.id, 'field_partner');
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /cemeteries/search is public and matches by name/city', async () => {
    const res = await request(server)
      .get('/api/v1/cemeteries/search')
      .query({ q: 'Misc' });
    expect(res.status).toBe(200);
    expect(
      (res.body as CemeterySearchResponseBody).items.length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('GET /kpi/dashboard is admin-only and returns honestly-computable metrics', async () => {
    const forbidden = await request(server)
      .get('/api/v1/kpi/dashboard')
      .set('Authorization', `Bearer ${custToken}`);
    expect(forbidden.status).toBe(403);

    const ok = await request(server)
      .get('/api/v1/kpi/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body).toHaveProperty('ordersByStatus');
    // Gerçek bir üst-huni (site ziyaretçisi → sipariş) hiçbir yerde
    // izlenmiyor — bkz. kpi.service.ts, dürüstçe null.
    expect((ok.body as KpiResponseBody).conversionFunnel).toBeNull();
  });

  // Admin Panel, ADIM 9 Phase 9: spec §11.1'in daha önce yanlışlıkla
  // "olay izleme gerektirir" diye null bırakılan iki metriği artık gerçekten
  // hesaplanıyor.
  it('GET /kpi/dashboard computes repeatCustomerRate, averageAssignmentSlaMinutes (from real audit_log timestamps), and orderLifecycleFunnel', async () => {
    const repeatCustomer = await prisma.user.create({
      data: {
        email: 'kpi-repeat-cust@test.com',
        passwordHash: 'x',
        role: 'customer',
        fullName: 'Repeat Cust',
        locale: 'tr',
      },
    });
    await prisma.order.createMany({
      data: [
        {
          orderNumber: '#MB-KPI-00001',
          customerId: repeatCustomer.id,
          graveLocationId,
          serviceType: 'cleaning',
          status: 'draft',
          priceAmount: 850,
          currency: 'TRY',
        },
        {
          orderNumber: '#MB-KPI-00002',
          customerId: repeatCustomer.id,
          graveLocationId,
          serviceType: 'cleaning',
          status: 'closed',
          priceAmount: 850,
          currency: 'TRY',
        },
      ],
    });

    // audit_log'a gerçek zaman damgalarıyla elle yazılıyor — bu test, tam
    // ödeme webhook akışını değil (bkz. payments.e2e-spec.ts), KpiService'in
    // audit_log'dan doğru SÜRE hesapladığını doğruluyor.
    const slaOrder = await prisma.order.create({
      data: {
        orderNumber: '#MB-KPI-00003',
        customerId: repeatCustomer.id,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'assigned',
        priceAmount: 850,
        currency: 'TRY',
      },
    });
    const confirmedAt = new Date(Date.now() - 20 * 60 * 1000);
    const assignedAt = new Date(Date.now() - 5 * 60 * 1000); // 15 dk sonra
    await prisma.auditLog.createMany({
      data: [
        {
          actorRole: 'system',
          action: 'order.confirm',
          entityType: 'order',
          entityId: slaOrder.id,
          oldValue: { status: 'pending_payment' },
          newValue: { status: 'confirmed' },
          createdAt: confirmedAt,
        },
        {
          actorRole: 'ops_manager',
          action: 'order.assign',
          entityType: 'order',
          entityId: slaOrder.id,
          oldValue: { status: 'confirmed' },
          newValue: { status: 'assigned' },
          createdAt: assignedAt,
        },
      ],
    });

    const res = await request(server)
      .get('/api/v1/kpi/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const body = res.body as {
      repeatCustomerRate: number;
      averageAssignmentSlaMinutes: number;
      orderLifecycleFunnel: Array<{ stage: string; count: number }>;
    };

    expect(body.repeatCustomerRate).toBeGreaterThan(0);

    expect(body.averageAssignmentSlaMinutes).toBeGreaterThanOrEqual(14.9);
    expect(body.averageAssignmentSlaMinutes).toBeLessThanOrEqual(15.1);

    const stages = body.orderLifecycleFunnel.map((s) => s.stage);
    expect(stages).toEqual([
      'draft',
      'pending_payment',
      'confirmed',
      'assigned',
      'in_progress',
      'completed_pending_approval',
      'closed',
    ]);
    // Kümülatif huni: her aşama bir öncekinden büyük olamaz.
    for (let i = 1; i < body.orderLifecycleFunnel.length; i++) {
      expect(body.orderLifecycleFunnel[i].count).toBeLessThanOrEqual(
        body.orderLifecycleFunnel[i - 1].count,
      );
    }
    const draftStage = body.orderLifecycleFunnel.find(
      (s) => s.stage === 'draft',
    );
    expect(draftStage?.count).toBeGreaterThanOrEqual(3); // en az az yukarıda oluşturulan 3 sipariş
  });

  it('POST /partners/onboarding encrypts the national ID at rest (spec §14.1)', async () => {
    const res = await request(server)
      .post('/api/v1/partners/onboarding')
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({
        nationalId: '98765432109',
        criminalRecordCheck: true,
        serviceCities: ['İstanbul'],
      });
    expect(res.status).toBe(200);

    const stored = await prisma.fieldPartner.findUnique({
      where: { userId: partnerUserId },
    });
    expect(stored?.nationalIdEncrypted).not.toBe('98765432109');
    expect(stored?.nationalIdEncrypted).toContain('.');

    // Admin Panel Phase 4'te bulunan gerçek boşluk: bu response daha önce
    // nationalIdEncrypted'ı (şifreli olsa bile) doğrudan içeriyordu —
    // gereksiz bir sunucu-dışı ifşa. Regresyon kilidi.
    expect(res.body).not.toHaveProperty('nationalIdEncrypted');
  });

  it('creates and cancels a subscription', async () => {
    const created = await request(server)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${custToken}`)
      .send({
        graveLocationId,
        plan: 'monthly',
        priceAmount: 1200,
        currency: 'TRY',
      });
    expect(created.status).toBe(201);
    const createdBody = created.body as SubscriptionResponseBody;
    expect(createdBody.status).toBe('active');

    const cancelled = await request(server)
      .delete(`/api/v1/subscriptions/${createdBody.id}`)
      .set('Authorization', `Bearer ${custToken}`);
    expect(cancelled.status).toBe(200);
    expect((cancelled.body as SubscriptionResponseBody).status).toBe(
      'cancelled',
    );
  });

  it('dedupes POST /subscriptions when the same Idempotency-Key is reused (spec §5.1)', async () => {
    const body = {
      graveLocationId,
      plan: 'monthly',
      priceAmount: 1200,
      currency: 'TRY',
    };
    const key = 'subscriptions-e2e-idem-key';

    const first = await request(server)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${custToken}`)
      .set('Idempotency-Key', key)
      .send(body);
    const second = await request(server)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${custToken}`)
      .set('Idempotency-Key', key)
      .send(body);

    const firstBody = first.body as SubscriptionResponseBody;
    const secondBody = second.body as SubscriptionResponseBody;
    expect(firstBody.id).toBe(secondBody.id);
    const count = await prisma.subscription.count({
      where: { id: firstBody.id },
    });
    expect(count).toBe(1);
  });

  it('POST /grave-locations finds-or-creates by (cemetery, section, plot) — not in spec §5, added to unblock the order flow', async () => {
    const body = {
      cemeteryId: cemetery2Id,
      section: '99',
      plot: '99',
      deceasedName: 'Test Kişi',
    };

    const first = await request(server)
      .post('/api/v1/grave-locations')
      .set('Authorization', `Bearer ${custToken}`)
      .send(body);
    expect(first.status).toBe(201);
    const firstBody = first.body as { id: string };

    const second = await request(server)
      .post('/api/v1/grave-locations')
      .set('Authorization', `Bearer ${custToken}`)
      .send(body);
    expect(second.status).toBe(201);
    const secondBody = second.body as { id: string };

    expect(firstBody.id).toBe(secondBody.id);
    const count = await prisma.graveLocation.count({
      where: { cemeteryId: cemetery2Id, section: '99', plot: '99' },
    });
    expect(count).toBe(1);
  });

  it('POST /grave-locations without section/plot ("yardım isteyin" akışı) creates a fresh row each time, never dedupes', async () => {
    const body = {
      cemeteryId: cemetery2Id,
      locationNote: 'Ana girişten sağda',
    };

    const first = await request(server)
      .post('/api/v1/grave-locations')
      .set('Authorization', `Bearer ${custToken}`)
      .send(body);
    expect(first.status).toBe(201);
    const firstBody = first.body as {
      id: string;
      section: string | null;
      plot: string | null;
    };
    expect(firstBody.section).toBeNull();
    expect(firstBody.plot).toBeNull();

    const second = await request(server)
      .post('/api/v1/grave-locations')
      .set('Authorization', `Bearer ${custToken}`)
      .send(body);
    expect(second.status).toBe(201);
    const secondBody = second.body as { id: string };
    expect(secondBody.id).not.toBe(firstBody.id);
  });

  it('PATCH /grave-locations/:id lets ops/admin/field_partner fill in section/plot/lat/lng later', async () => {
    const created = await prisma.graveLocation.create({
      data: { cemeteryId: cemetery2Id, locationNote: 'Tespit bekliyor' },
    });

    const forbidden = await request(server)
      .patch(`/api/v1/grave-locations/${created.id}`)
      .set('Authorization', `Bearer ${custToken}`)
      .send({ section: '5', plot: '12' });
    expect(forbidden.status).toBe(403);

    const ok = await request(server)
      .patch(`/api/v1/grave-locations/${created.id}`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ section: '5', plot: '12', lat: 41.05, lng: 29.0 });
    expect(ok.status).toBe(200);
    const okBody = ok.body as { section: string; plot: string };
    expect(okBody.section).toBe('5');
    expect(okBody.plot).toBe('12');

    const missing = await request(server)
      .patch('/api/v1/grave-locations/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ section: '1' });
    expect(missing.status).toBe(404);
  });

  // Admin Panel, ADIM 9: spec §11.1 "Partner Yönetimi: Onboarding onay akışı"
  describe('Partner management (Admin Panel, spec §11.1)', () => {
    async function createOnboardingPartner(email: string) {
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'x',
          role: 'field_partner',
          fullName: 'Onboarding Partner',
          locale: 'tr',
        },
      });
      return prisma.fieldPartner.create({
        data: {
          userId: user.id,
          nationalIdEncrypted: 'x',
          status: 'onboarding',
          serviceCities: ['İstanbul'],
        },
      });
    }

    it('GET /partners is ops/admin-only and filters by status', async () => {
      const partner = await createOnboardingPartner(
        'misc-partner-list@test.com',
      );

      const forbidden = await request(server)
        .get('/api/v1/partners')
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(forbidden.status).toBe(403);

      const ok = await request(server)
        .get('/api/v1/partners')
        .query({ status: 'onboarding' })
        .set('Authorization', `Bearer ${opsToken}`);
      expect(ok.status).toBe(200);
      const body = ok.body as { items: Array<{ id: string; status: string }> };
      expect(body.items.some((p) => p.id === partner.id)).toBe(true);
      expect(body.items.every((p) => p.status === 'onboarding')).toBe(true);
      expect(body.items.every((p) => !('nationalIdEncrypted' in p))).toBe(true);
    });

    it('POST /partners/:id/approve moves onboarding -> active and writes audit_log', async () => {
      const partner = await createOnboardingPartner(
        'misc-partner-approve@test.com',
      );

      const forbidden = await request(server)
        .post(`/api/v1/partners/${partner.id}/approve`)
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(forbidden.status).toBe(403);

      const ok = await request(server)
        .post(`/api/v1/partners/${partner.id}/approve`)
        .set('Authorization', `Bearer ${opsToken}`);
      expect(ok.status).toBe(200);
      expect((ok.body as { status: string }).status).toBe('active');
      expect(ok.body).not.toHaveProperty('nationalIdEncrypted');

      const reapprove = await request(server)
        .post(`/api/v1/partners/${partner.id}/approve`)
        .set('Authorization', `Bearer ${opsToken}`);
      expect(reapprove.status).toBe(400);

      const logs = await prisma.auditLog.findMany({
        where: { entityId: partner.id, action: 'partner.approve' },
      });
      expect(logs.length).toBe(1);
      expect(logs[0].oldValue).toEqual({ status: 'onboarding' });
      expect(logs[0].newValue).toEqual({ status: 'active' });
    });

    it('POST /partners/:id/reject moves onboarding -> rejected, requires a reason, writes audit_log', async () => {
      const partner = await createOnboardingPartner(
        'misc-partner-reject@test.com',
      );

      const noReason = await request(server)
        .post(`/api/v1/partners/${partner.id}/reject`)
        .set('Authorization', `Bearer ${opsToken}`)
        .send({});
      expect(noReason.status).toBe(400);

      const ok = await request(server)
        .post(`/api/v1/partners/${partner.id}/reject`)
        .set('Authorization', `Bearer ${opsToken}`)
        .send({ reason: 'Sabıka kaydı belgesi eksik/geçersiz.' });
      expect(ok.status).toBe(200);
      expect((ok.body as { status: string }).status).toBe('rejected');
      expect(ok.body).not.toHaveProperty('nationalIdEncrypted');

      const logs = await prisma.auditLog.findMany({
        where: { entityId: partner.id, action: 'partner.reject' },
      });
      expect(logs.length).toBe(1);
      expect(logs[0].newValue).toEqual({
        status: 'rejected',
        reason: 'Sabıka kaydı belgesi eksik/geçersiz.',
      });
    });

    it('GET /partners/:id/payouts is ops/admin-only', async () => {
      const partner = await createOnboardingPartner(
        'misc-partner-payouts@test.com',
      );

      const forbidden = await request(server)
        .get(`/api/v1/partners/${partner.id}/payouts`)
        .set('Authorization', `Bearer ${partnerToken}`);
      expect(forbidden.status).toBe(403);

      const ok = await request(server)
        .get(`/api/v1/partners/${partner.id}/payouts`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(ok.status).toBe(200);
      expect(Array.isArray(ok.body)).toBe(true);

      const missing = await request(server)
        .get('/api/v1/partners/00000000-0000-0000-0000-000000000000/payouts')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(missing.status).toBe(404);
    });
  });

  // Admin Panel, ADIM 9 Phase 7: spec §11.1 "Kullanıcı & Rol Yönetimi:
  // Admin/Support/Ops kullanıcı CRUD, rol atama" — spec §6.1'e göre yalnızca
  // Admin bu yetkiye sahip (Ops Manager/Support Agent'ın rol tablosunda yok).
  describe('Staff user management (Admin Panel, spec §11.1)', () => {
    it('GET/POST /users is admin-only, creates a staff account, and never leaks the password hash', async () => {
      const forbiddenList = await request(server)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${opsToken}`);
      expect(forbiddenList.status).toBe(403);

      const forbiddenCreate = await request(server)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${opsToken}`)
        .send({
          email: 'misc-staff-forbidden@test.com',
          password: 'correct-horse-battery',
          fullName: 'Forbidden Attempt',
          role: 'support_agent',
        });
      expect(forbiddenCreate.status).toBe(403);

      const created = await request(server)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'misc-staff-new@test.com',
          password: 'correct-horse-battery',
          fullName: 'New Support Agent',
          role: 'support_agent',
        });
      expect(created.status).toBe(201);
      const createdBody = created.body as { id: string; role: string };
      expect(createdBody.role).toBe('support_agent');
      expect(created.body).not.toHaveProperty('passwordHash');

      const duplicate = await request(server)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'misc-staff-new@test.com',
          password: 'correct-horse-battery',
          fullName: 'Duplicate',
          role: 'support_agent',
        });
      expect(duplicate.status).toBe(409);

      const list = await request(server)
        .get('/api/v1/users')
        .query({ role: 'support_agent' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(list.status).toBe(200);
      const listBody = list.body as {
        items: Array<{ id: string; role: string }>;
      };
      expect(listBody.items.some((u) => u.id === createdBody.id)).toBe(true);
      expect(listBody.items.every((u) => u.role === 'support_agent')).toBe(
        true,
      );
    });

    it('rejects self-registering a staff role via POST /auth/register (still customer/field_partner only)', async () => {
      const res = await request(server).post('/api/v1/auth/register').send({
        email: 'misc-self-admin-attempt@test.com',
        password: 'correct-horse-battery',
        fullName: 'Sneaky',
        role: 'admin',
      });
      expect(res.status).toBe(400);
    });

    it('PATCH /users/:id reassigns role and deactivates/reactivates, writes audit_log, and blocks self-deactivation', async () => {
      const created = await request(server)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'misc-staff-patch@test.com',
          password: 'correct-horse-battery',
          fullName: 'Patch Target',
          role: 'support_agent',
        });
      const staffId = (created.body as { id: string }).id;

      const roleChange = await request(server)
        .patch(`/api/v1/users/${staffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ops_manager' });
      expect(roleChange.status).toBe(200);
      expect((roleChange.body as { role: string }).role).toBe('ops_manager');

      const deactivated = await request(server)
        .patch(`/api/v1/users/${staffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      expect(deactivated.status).toBe(200);

      // Devre dışı bırakılan hesap gerçekten giriş yapamıyor (bkz.
      // auth.e2e-spec.ts'in kendi doğrudan testi — burada uçtan uca).
      const loginAttempt = await request(server)
        .post('/api/v1/auth/login')
        .send({
          email: 'misc-staff-patch@test.com',
          password: 'correct-horse-battery',
        });
      expect(loginAttempt.status).toBe(401);

      const reactivated = await request(server)
        .patch(`/api/v1/users/${staffId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: true });
      expect(reactivated.status).toBe(200);
      const loginAfterReactivate = await request(server)
        .post('/api/v1/auth/login')
        .send({
          email: 'misc-staff-patch@test.com',
          password: 'correct-horse-battery',
        });
      expect(loginAfterReactivate.status).toBe(200);

      const logs = await prisma.auditLog.findMany({
        where: { entityId: staffId, action: 'user.update' },
        orderBy: { createdAt: 'asc' },
      });
      expect(logs.length).toBe(3);
      expect(logs[0].newValue).toMatchObject({ role: 'ops_manager' });
      expect(logs[1].newValue).toMatchObject({ isActive: false });
      expect(logs[2].newValue).toMatchObject({ isActive: true });

      // Bir admin kendi hesabını devre dışı bırakamaz (kilitlenmeyi önler).
      const selfDeactivate = await request(server)
        .patch(`/api/v1/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      expect(selfDeactivate.status).toBe(400);
    });

    it('PATCH /users/:id rejects targeting a non-staff account (customer/field_partner out of scope)', async () => {
      const res = await request(server)
        .patch(`/api/v1/users/${custIdForStaffTest}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ops_manager' });
      expect(res.status).toBe(400);
    });
  });

  // Admin Panel, ADIM 9 Phase 8: spec §11.1 "Mezarlık & İzin Yönetimi:
  // Mezarlık kayıtları, belediye izin statüsü ve belge arşivi."
  describe('Cemetery & permit management (Admin Panel, spec §11.1)', () => {
    it('POST /cemeteries is ops/admin-only and creates a new cemetery record', async () => {
      const forbidden = await request(server)
        .post('/api/v1/cemeteries')
        .set('Authorization', `Bearer ${custToken}`)
        .send({
          name: 'Forbidden Attempt Mezarlık',
          city: 'İstanbul',
          district: 'Kadıköy',
          municipalityAuthority: 'İBB',
        });
      expect(forbidden.status).toBe(403);

      const created = await request(server)
        .post('/api/v1/cemeteries')
        .set('Authorization', `Bearer ${opsToken}`)
        .send({
          name: 'Phase8 Yeni Mezarlık',
          city: 'İzmir',
          district: 'Konak',
          municipalityAuthority: 'İzmir BB',
        });
      expect(created.status).toBe(201);
      const createdBody = created.body as { id: string; permitStatus: string };
      expect(createdBody.permitStatus).toBe('pending');

      const logs = await prisma.auditLog.findMany({
        where: { entityId: createdBody.id, action: 'cemetery.create' },
      });
      expect(logs.length).toBe(1);
    });

    it('GET /cemeteries is admin-only (distinct from public GET /cemeteries/search) and filters by permitStatus', async () => {
      const created = await request(server)
        .post('/api/v1/cemeteries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Phase8 Filtre Mezarlık',
          city: 'Ankara',
          district: 'Çankaya',
          municipalityAuthority: 'ABB',
        });
      const cemeteryId = (created.body as { id: string }).id;

      const forbidden = await request(server)
        .get('/api/v1/cemeteries')
        .set('Authorization', `Bearer ${custToken}`);
      expect(forbidden.status).toBe(403);

      const list = await request(server)
        .get('/api/v1/cemeteries')
        .query({ permitStatus: 'pending' })
        .set('Authorization', `Bearer ${opsToken}`);
      expect(list.status).toBe(200);
      const listBody = list.body as {
        items: Array<{ id: string; permitStatus: string }>;
      };
      expect(listBody.items.some((c) => c.id === cemeteryId)).toBe(true);
      expect(listBody.items.every((c) => c.permitStatus === 'pending')).toBe(
        true,
      );
    });

    it('PATCH /cemeteries/:id sets permitStatus/permitDocumentUrl (extends the existing endpoint, not a new one) and audit-logs the permit status change', async () => {
      const created = await request(server)
        .post('/api/v1/cemeteries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Phase8 İzin Mezarlık',
          city: 'Bursa',
          district: 'Nilüfer',
          municipalityAuthority: 'Bursa BB',
        });
      const cemeteryId = (created.body as { id: string }).id;

      const updated = await request(server)
        .patch(`/api/v1/cemeteries/${cemeteryId}`)
        .set('Authorization', `Bearer ${opsToken}`)
        .send({
          permitStatus: 'approved',
          permitDocumentUrl: 'https://example.com/izin-belgesi.pdf',
        });
      expect(updated.status).toBe(200);
      const updatedBody = updated.body as {
        permitStatus: string;
        permitDocumentUrl: string;
      };
      expect(updatedBody.permitStatus).toBe('approved');
      expect(updatedBody.permitDocumentUrl).toBe(
        'https://example.com/izin-belgesi.pdf',
      );

      const logs = await prisma.auditLog.findMany({
        where: {
          entityId: cemeteryId,
          action: 'cemetery.permit_status_change',
        },
      });
      expect(logs.length).toBe(1);
      expect(logs[0].oldValue).toEqual({ permitStatus: 'pending' });
      expect(logs[0].newValue).toEqual({ permitStatus: 'approved' });

      // geotagToleranceM (ADIM 7) hâlâ AYNI PATCH üzerinden çalışıyor —
      // genişletme geriye dönük uyumluluğu bozmadı.
      const toleranceUpdate = await request(server)
        .patch(`/api/v1/cemeteries/${cemeteryId}`)
        .set('Authorization', `Bearer ${opsToken}`)
        .send({ geotagToleranceM: 200 });
      expect(toleranceUpdate.status).toBe(200);
      expect(
        (toleranceUpdate.body as { geotagToleranceM: number }).geotagToleranceM,
      ).toBe(200);
    });

    it('GET /cemeteries/search (public, unauthenticated) never exposes permitDocumentUrl', async () => {
      const created = await request(server)
        .post('/api/v1/cemeteries')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Phase8 Gizlilik Mezarlık',
          city: 'İstanbul',
          district: 'Şişli',
          municipalityAuthority: 'İBB',
        });
      const cemeteryId = (created.body as { id: string }).id;
      await request(server)
        .patch(`/api/v1/cemeteries/${cemeteryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permitDocumentUrl: 'https://example.com/gizli-belge.pdf' });

      const search = await request(server)
        .get('/api/v1/cemeteries/search')
        .query({ q: 'Phase8 Gizlilik' });
      expect(search.status).toBe(200);
      const body = search.body as { items: Array<Record<string, unknown>> };
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.every((c) => !('permitDocumentUrl' in c))).toBe(true);
    });
  });
});
