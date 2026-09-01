/**
 * spec §15 (Jest + Supertest) — auth akışının uçtan uca testi: register → login →
 * refresh (rotasyon) → eski token'ın yeniden kullanımının reddedilmesi (reuse
 * detection) → login rate limiti (5/15dk).
 *
 * DATABASE_URL, gerçek (atılabilir) bir PostgreSQL'e işaret etmeli — migration'lar
 * önceden uygulanmış olmalı (bkz. HANDOVER.md §6.5). Testcontainers ile izole
 * test veritabanı + CI'a bağlama işi spec §13.2/§15 gereği ADIM 9'da yapılacak;
 * bu dosya o zamana kadar CI'da otomatik çalışmaz, yerelde manuel çalıştırılır:
 *   DATABASE_URL=... JWT_ACCESS_SECRET=test JWT_REFRESH_SECRET=test npm run test:e2e --workspace=apps/api
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp } from './test-app.helper';

type TokenResponseBody = { accessToken?: string };

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let server: App;

  beforeAll(async () => {
    const ctx = await createTestApp();
    app = ctx.app;
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  function extractCookie(res: request.Response): string {
    const header: unknown = res.headers['set-cookie'];
    const raw = Array.isArray(header) ? (header[0] as string) : String(header);
    return raw.split(';')[0];
  }

  it('rejects passwords under 10 characters', async () => {
    const res = await request(server).post('/api/v1/auth/register').send({
      email: 'murat@example.com',
      password: 'short',
      fullName: 'Murat Y.',
    });
    expect(res.status).toBe(400);
  });

  it('registers, rejects duplicate email, and only allows self-registerable roles', async () => {
    const ok = await request(server).post('/api/v1/auth/register').send({
      email: 'murat@example.com',
      password: 'correct-horse-battery',
      fullName: 'Murat Y.',
    });
    expect(ok.status).toBe(201);
    expect((ok.body as TokenResponseBody).accessToken).toBeDefined();
    expect(extractCookie(ok)).toMatch(/^refresh_token=/);

    const dup = await request(server).post('/api/v1/auth/register').send({
      email: 'murat@example.com',
      password: 'correct-horse-battery',
      fullName: 'Murat Y.',
    });
    expect(dup.status).toBe(409);

    const forbiddenRole = await request(server)
      .post('/api/v1/auth/register')
      .send({
        email: 'sneaky-admin@example.com',
        password: 'correct-horse-battery',
        fullName: 'Sneaky',
        role: 'admin',
      });
    expect(forbiddenRole.status).toBe(400);

    const partner = await request(server).post('/api/v1/auth/register').send({
      email: 'partner1@example.com',
      password: 'correct-horse-battery',
      fullName: 'Partner Bir',
      role: 'field_partner',
    });
    expect(partner.status).toBe(201);
  });

  it('rejects login with wrong password', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'murat@example.com', password: 'totally-wrong' });
    expect(res.status).toBe(401);
  });

  it('logs in, rotates refresh tokens, and detects reuse of a rotated-away token', async () => {
    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'murat@example.com', password: 'correct-horse-battery' });
    expect(login.status).toBe(200);
    const firstRefreshCookie = extractCookie(login);

    const refresh1 = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstRefreshCookie);
    expect(refresh1.status).toBe(200);
    const secondRefreshCookie = extractCookie(refresh1);
    expect(secondRefreshCookie).not.toBe(firstRefreshCookie);

    // Rotasyonla kullanımdan kalkan eski token tekrar sunulursa reddedilmeli.
    const reuse = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', firstRefreshCookie);
    expect(reuse.status).toBe(401);

    // Reuse tespiti tüm oturumu iptal eder — o an geçerli olan ikinci token da artık geçersiz.
    const afterReuse = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', secondRefreshCookie);
    expect(afterReuse.status).toBe(401);
  });

  it("GET /users/me returns the authenticated user's server-verified fullName — apps/web needs this so a full page reload doesn't drop the displayed name to a placeholder", async () => {
    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'murat@example.com', password: 'correct-horse-battery' });
    expect(login.status).toBe(200);
    const accessToken = (login.body as TokenResponseBody).accessToken;

    const noAuth = await request(server).get('/api/v1/users/me');
    expect(noAuth.status).toBe(401);

    const res = await request(server)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const body = res.body as { email: string; fullName: string; role: string };
    expect(body.email).toBe('murat@example.com');
    expect(body.fullName).toBe('Murat Y.');
    expect(body.role).toBe('customer');
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('rate-limits login to 5 attempts per 15 minutes per IP+account', async () => {
    const attempt = () =>
      request(server)
        .post('/api/v1/auth/login')
        .send({ email: 'rate-limit-test@example.com', password: 'wrong' });

    for (let i = 0; i < 5; i++) {
      const res = await attempt();
      expect(res.status).toBe(401);
    }
    const sixth = await attempt();
    expect(sixth.status).toBe(429);
  });
});
