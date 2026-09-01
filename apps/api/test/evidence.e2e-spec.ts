/**
 * spec §8.1/§8.2: gerçek EXIF/GPS/Haversine doğrulaması, geotag_validation_status
 * kararları, referans-konumsuz "yardım isteyin" akışı, Ops manual_review
 * bildirimi ve complete()'in wide_shot+detail_shot kombinasyon kontrolü.
 * StorageService gerçek AWS yerine MockStorageService ile değiştirilir (bkz.
 * test-app.helper.ts) — deterministik, gerçek S3 gerektirmez.
 * Needs a real (disposable) Postgres — see auth.e2e-spec.ts header for how to run.
 */
import { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './test-app.helper';
import { makeJpegWithExif, makeJpegWithoutExif } from './evidence-fixtures';

type UploadUrlResponseBody = { fileKey: string; uploadUrl: string };
type EvidenceResponseBody = {
  id: string;
  geotagValidationStatus: string;
  distanceFromGraveM: string | null;
};
type ErrorResponseBody = {
  error: { code: string; message: string; requestId: string };
};

describe('Evidence verification (e2e)', () => {
  let app: INestApplication;
  let server: App;
  let prisma: PrismaService;
  let mockStorage: Awaited<ReturnType<typeof createTestApp>>['mockStorage'];
  let opsToken: string;
  let partnerToken: string;
  let partnerId: string;
  let customerId: string;
  let cemeteryId: string;

  const GRAVE_LAT = 41.0012;
  const GRAVE_LNG = 29.0361;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    prisma = ctx.prisma;
    mockStorage = ctx.mockStorage;
    server = app.getHttpServer() as App;

    const cemetery = await prisma.cemetery.create({
      data: {
        name: 'Evidence Test Mezarlık',
        city: 'İstanbul',
        district: 'Üsküdar',
        municipalityAuthority: 'İBB',
      },
    });
    cemeteryId = cemetery.id;

    const customer = await prisma.user.create({
      data: {
        email: 'evidence-cust@test.com',
        passwordHash: 'x',
        role: 'customer',
        fullName: 'Cust',
        locale: 'tr',
      },
    });
    customerId = customer.id;
    const ops = await prisma.user.create({
      data: {
        email: 'evidence-ops@test.com',
        passwordHash: 'x',
        role: 'ops_manager',
        fullName: 'Ops',
        locale: 'tr',
      },
    });
    const partnerUser = await prisma.user.create({
      data: {
        email: 'evidence-partner@test.com',
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

    opsToken = ctx.accessTokenFor(ops.id, 'ops_manager');
    partnerToken = ctx.accessTokenFor(partnerUser.id, 'field_partner');
  });

  afterAll(async () => {
    await app.close();
  });

  let orderCounter = 0;

  async function createInProgressOrder(graveLocationId: string) {
    orderCounter += 1;
    // orders.order_number spec §4.4: VARCHAR(20) — kısa tutulmalı.
    const order = await prisma.order.create({
      data: {
        orderNumber: `#MB-EV-${String(orderCounter).padStart(5, '0')}`,
        customerId,
        graveLocationId,
        serviceType: 'cleaning',
        status: 'in_progress',
        assignedPartnerId: partnerId,
        priceAmount: 850,
        currency: 'TRY',
      },
    });
    return order;
  }

  async function uploadEvidence(
    orderId: string,
    photoType: 'wide_shot' | 'detail_shot',
    fileBuffer: Buffer,
  ) {
    const contentSha256 = createHash('sha256')
      .update(fileBuffer)
      .digest('base64');
    const uploadUrlRes = await request(server)
      .post(`/api/v1/orders/${orderId}/evidence/upload-url`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ contentSha256 });
    expect(uploadUrlRes.status).toBe(201);
    const { fileKey } = uploadUrlRes.body as UploadUrlResponseBody;
    mockStorage.setObject(fileKey, fileBuffer);
    return request(server)
      .post(`/api/v1/orders/${orderId}/evidence`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ photoType, fileKey });
  }

  it('sets geotag_validation_status=valid for a photo taken near the grave with fresh timestamp', async () => {
    const graveLocation = await prisma.graveLocation.create({
      data: {
        cemeteryId,
        section: 'V1',
        plot: 'V1',
        lat: GRAVE_LAT,
        lng: GRAVE_LNG,
      },
    });
    const order = await createInProgressOrder(graveLocation.id);

    const jpeg = await makeJpegWithExif({
      lat: GRAVE_LAT + 0.0001, // ~11m kuzeyde, tolerans içinde
      lng: GRAVE_LNG,
      timestamp: new Date(),
    });
    const res = await uploadEvidence(order.id, 'wide_shot', jpeg);
    expect(res.status).toBe(201);
    const body = res.body as EvidenceResponseBody;
    expect(body.geotagValidationStatus).toBe('valid');
    expect(Number(body.distanceFromGraveM)).toBeLessThan(150);

    const notifications = await prisma.notification.findMany({
      where: {
        templateKey: 'evidence_manual_review',
        payload: { path: ['orderId'], equals: order.id },
      },
    });
    expect(notifications).toHaveLength(0);
  });

  it('sets geotag_validation_status=missing_exif and notifies Ops when the photo has no EXIF GPS', async () => {
    const graveLocation = await prisma.graveLocation.create({
      data: {
        cemeteryId,
        section: 'M1',
        plot: 'M1',
        lat: GRAVE_LAT,
        lng: GRAVE_LNG,
      },
    });
    const order = await createInProgressOrder(graveLocation.id);

    const jpeg = await makeJpegWithoutExif();
    const res = await uploadEvidence(order.id, 'wide_shot', jpeg);
    expect(res.status).toBe(201);
    expect((res.body as EvidenceResponseBody).geotagValidationStatus).toBe(
      'missing_exif',
    );

    const notifications = await prisma.notification.findMany({
      where: {
        userId: (
          await prisma.user.findUniqueOrThrow({
            where: { email: 'evidence-ops@test.com' },
          })
        ).id,
        templateKey: 'evidence_manual_review',
      },
    });
    expect(
      notifications.some(
        (n) => (n.payload as { orderId?: string }).orderId === order.id,
      ),
    ).toBe(true);
  });

  it('sets geotag_validation_status=gps_mismatch when the photo is taken beyond the cemetery tolerance', async () => {
    const graveLocation = await prisma.graveLocation.create({
      data: {
        cemeteryId,
        section: 'G1',
        plot: 'G1',
        lat: GRAVE_LAT,
        lng: GRAVE_LNG,
      },
    });
    const order = await createInProgressOrder(graveLocation.id);

    const jpeg = await makeJpegWithExif({
      lat: GRAVE_LAT + 0.02, // ~2.2km kuzeyde — varsayılan 150m toleransın çok üzerinde
      lng: GRAVE_LNG,
      timestamp: new Date(),
    });
    const res = await uploadEvidence(order.id, 'wide_shot', jpeg);
    expect(res.status).toBe(201);
    const body = res.body as EvidenceResponseBody;
    expect(body.geotagValidationStatus).toBe('gps_mismatch');
    expect(Number(body.distanceFromGraveM)).toBeGreaterThan(150);
  });

  it('respects a per-cemetery geotag tolerance override (spec §8.1)', async () => {
    const largeCemetery = await prisma.cemetery.create({
      data: {
        name: 'Büyük Mezarlık',
        city: 'İstanbul',
        district: 'Eyüpsultan',
        municipalityAuthority: 'İBB',
        geotagToleranceM: 5000, // büyük mezarlık — daha geniş tolerans
      },
    });
    const graveLocation = await prisma.graveLocation.create({
      data: {
        cemeteryId: largeCemetery.id,
        section: 'T1',
        plot: 'T1',
        lat: GRAVE_LAT,
        lng: GRAVE_LNG,
      },
    });
    const order = await createInProgressOrder(graveLocation.id);

    // Varsayılan (150m) toleransı aşan ama özel 5000m toleransı aşmayan bir mesafe.
    const jpeg = await makeJpegWithExif({
      lat: GRAVE_LAT + 0.02, // ~2.2km
      lng: GRAVE_LNG,
      timestamp: new Date(),
    });
    const res = await uploadEvidence(order.id, 'wide_shot', jpeg);
    expect(res.status).toBe(201);
    expect((res.body as EvidenceResponseBody).geotagValidationStatus).toBe(
      'valid',
    );
  });

  it('sets geotag_validation_status=timestamp_mismatch when EXIF timestamp is >24h old', async () => {
    const graveLocation = await prisma.graveLocation.create({
      data: {
        cemeteryId,
        section: 'TS1',
        plot: 'TS1',
        lat: GRAVE_LAT,
        lng: GRAVE_LNG,
      },
    });
    const order = await createInProgressOrder(graveLocation.id);

    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const jpeg = await makeJpegWithExif({
      lat: GRAVE_LAT,
      lng: GRAVE_LNG,
      timestamp: tenDaysAgo,
    });
    const res = await uploadEvidence(order.id, 'wide_shot', jpeg);
    expect(res.status).toBe(201);
    expect((res.body as EvidenceResponseBody).geotagValidationStatus).toBe(
      'timestamp_mismatch',
    );
  });

  it('does NOT block evidence upload when the grave location has no reference coordinate ("yardım isteyin" flow) — falls to manual_review instead', async () => {
    const graveLocation = await prisma.graveLocation.create({
      data: { cemeteryId }, // section/plot/lat/lng hepsi NULL — henüz saha ekibi tespit etmemiş
    });
    const order = await createInProgressOrder(graveLocation.id);

    const jpeg = await makeJpegWithExif({
      lat: GRAVE_LAT,
      lng: GRAVE_LNG,
      timestamp: new Date(),
    });
    const res = await uploadEvidence(order.id, 'wide_shot', jpeg);
    // Kullanıcı kararı: yükleme ENGELLENMEZ, kabul edilir.
    expect(res.status).toBe(201);
    expect((res.body as EvidenceResponseBody).geotagValidationStatus).toBe(
      'manual_review',
    );

    const opsUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'evidence-ops@test.com' },
    });
    const notifications = await prisma.notification.findMany({
      where: { userId: opsUser.id, templateKey: 'evidence_manual_review' },
    });
    expect(
      notifications.some(
        (n) => (n.payload as { orderId?: string }).orderId === order.id,
      ),
    ).toBe(true);
  });

  it('rejects complete() when photos lack the wide_shot + detail_shot combination (spec §8.2)', async () => {
    const graveLocation = await prisma.graveLocation.create({
      data: {
        cemeteryId,
        section: 'C1',
        plot: 'C1',
        lat: GRAVE_LAT,
        lng: GRAVE_LNG,
      },
    });
    const order = await createInProgressOrder(graveLocation.id);

    // İki fotoğraf da wide_shot — spec §8.2'nin 1+1 kombinasyon şartını karşılamıyor.
    for (let i = 0; i < 2; i++) {
      const jpeg = await makeJpegWithExif({
        lat: GRAVE_LAT,
        lng: GRAVE_LNG,
        timestamp: new Date(),
      });
      const res = await uploadEvidence(order.id, 'wide_shot', jpeg);
      expect(res.status).toBe(201);
    }

    const completeRes = await request(server)
      .post(`/api/v1/orders/${order.id}/complete`)
      .set('Authorization', `Bearer ${partnerToken}`);
    expect(completeRes.status).toBe(422);
    expect((completeRes.body as ErrorResponseBody).error.message).toContain(
      'detail_shot',
    );
  });

  it('PATCH /cemeteries/:id lets ops/admin set a per-cemetery geotag tolerance', async () => {
    const cemetery = await prisma.cemetery.create({
      data: {
        name: 'Patch Test Mezarlık',
        city: 'İstanbul',
        district: 'Şişli',
        municipalityAuthority: 'İBB',
      },
    });

    const forbidden = await request(server)
      .patch(`/api/v1/cemeteries/${cemetery.id}`)
      .set('Authorization', `Bearer ${partnerToken}`)
      .send({ geotagToleranceM: 300 });
    expect(forbidden.status).toBe(403);

    const ok = await request(server)
      .patch(`/api/v1/cemeteries/${cemetery.id}`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ geotagToleranceM: 300 });
    expect(ok.status).toBe(200);
    expect((ok.body as { geotagToleranceM: number }).geotagToleranceM).toBe(
      300,
    );

    const missing = await request(server)
      .patch('/api/v1/cemeteries/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ geotagToleranceM: 300 });
    expect(missing.status).toBe(404);
  });
});
