# GüzelKabir — Developer Handover

Handover for continued development. Everything below is verified live as of this document.

---

## 1. Links & access

| Resource | URL |
| --- | --- |
| **GitHub repo** | `mertasln/guzelkabir-app` |

No hosting/deploy integration (Vercel or otherwise) is currently connected to this repo.

---

## 2. What this is

GüzelKabir is a **remote grave-care marketplace** for Turkey (İstanbul pilot, aimed at the Turkish diaspora in Europe). A customer orders periodic care for a relative's grave; a vetted local caretaker does the work and uploads GPS- and timestamp-verified before/after photos; the customer approves, and only then is payment released.

The UI is **Turkish-only** and intentionally calm/respectful in tone. It's a **front-end prototype** — there is **no backend yet** (see §6).

---

## 3. Tech stack

- **Next.js 15.5.18** (App Router) — `package.json` pins `^15.5.18`. Do **not** downgrade below 15.5.x: Vercel blocks deploys of vulnerable Next versions (we hit this with 15.1.6 / CVE-2025-66478).
- **React 19.0.0**
- **TypeScript 5** (strict mode)
- **next/font/google** — Newsreader (display serif), Hanken Grotesk (body), IBM Plex Mono (mono)
- **No CSS framework** — a single global stylesheet with CSS custom properties (design tokens). No Tailwind, no CSS Modules.
- **No state library, no data layer** — component-local React state only.

---

## 4. Running locally

```bash
git clone https://github.com/drtaylanyildiz/guzelkabir.git
cd guzelkabir
npm install       # installs all workspaces (apps/web, apps/api, packages/shared-types)
npm run dev       # turbo run dev — runs every app's dev server in parallel
```

To run a single app: `npm run dev --workspace=apps/web` or `--workspace=apps/api`.

Dev servers: apps/web on http://localhost:3000 (the repo's `.claude/launch.json` uses port 3005 for the in-app preview tool; either is fine), apps/api on http://localhost:3001 (prefixed `/api/v1`).

**Since ADIM 5, `/giris` and the last step of `/siparis` need apps/api actually running** (with a migrated Postgres, Redis, and `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` set — see §6.5/§6.6) — `apps/web/.env.local` (gitignored, copy from `.env.example`) sets `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:3001/api/v1`. The rest of apps/web (home, panel) still works standalone without apps/api.

```bash
npm run build       # turbo run build — builds every app; run this before pushing, Vercel runs the same for apps/web
npm run lint        # turbo run lint
npm run typecheck   # turbo run typecheck
```

Node 22 LTS (pinned per engineering spec §3; built here on Node 22).

---

## 5. Project structure

This is a **Turborepo monorepo** (npm workspaces: `apps/*`, `packages/*`), set up per `docs/muhendislik-spec.pdf` §18.1. The original single-app Next.js prototype now lives under `apps/web/` unchanged; `apps/api/` is a new NestJS backend being built out module by module against the spec.

```
apps/web/                  the original front-end prototype (see §6) — now wired to apps/api for the order wizard + login (§6.9)
  src/
    app/
      layout.tsx          Root layout: fonts, <AuthProvider><CurrencyProvider>, metadata (lang="tr")
      globals.css         ★ ALL styling. Design tokens + every component's CSS.
      page.tsx            Home (Ana Sayfa) — server component using client "islands"
      siparis/page.tsx    5-step order wizard (Sipariş Akışı) — client component, wired to real API (§6.9)
      giris/page.tsx      Login/register — client component, new in ADIM 5 (§6.9)
      panel/page.tsx      Customer panel (Müşteri Paneli) + detail overlay — client component, still hardcoded (deliberately out of scope, §6.9)
    components/
      Topbar.tsx          Header; variant="home" | "flow" | "panel". home/flow show a real AuthIndicator; panel stays hardcoded.
      CurrencyToggle.tsx  ₺/€ switch (writes to CurrencyProvider)
      BeforeAfter.tsx     Pointer-drag before/after photo slider
      Reveal.tsx          IntersectionObserver scroll-reveal wrapper
      Faq.tsx             Accordion
      Price.tsx           Renders an amount in the active currency
      icons.tsx           All inline SVG icons as React components
    lib/
      currency.tsx        CurrencyProvider context + useCurrency() hook (localStorage "gk-cur")
      api.ts              fetch wrapper: spec §5 error envelope, in-memory access token, auto-refresh-on-401
      auth.tsx            AuthProvider/useAuth() — same Context pattern as currency.tsx
  public/
      hero-bakimli-mezar.avif   Hero photo (cared-for grave)
      bakimli-mezar.png         Before/after "after" (clean grave w/ flowers)
      bakimsiz-mezar.jpeg       Before/after "before" (same grave, overgrown)
apps/api/                  NestJS backend (Node 22, TS strict) — see §6.5-6.12 for what's actually built (auth, orders, payments, evidence, field-partner PWA support, etc.)
  src/main.ts               global prefix set to api/v1
apps/field-pwa/            Vite+React saha PWA (spec §12) — see §6.12. New in ADIM 8, online-only.
packages/shared-types/     placeholder for DTOs/Prisma-derived types shared between web and api (spec §10.3)
design_handoff_guzelkabir/    Original HTML/CSS/JS prototypes — design source of truth (reference only, not shipped)
docs/muhendislik-spec.pdf     Engineering spec — single source of truth for backend/DB/API/infra work
```

### Styling model — read this before touching UI
- **One global stylesheet:** `src/app/globals.css`. The original designer's exact class names are preserved verbatim for fidelity, which is why it's global rather than CSS Modules. When you add UI, follow the same class-naming and token conventions already in the file.
- **Design tokens** live as CSS custom properties in `:root` (only the "C · Modern Sakin" theme; the prototype's A/B themes were dropped). Colors are derived with `color-mix(in srgb, …)`.
- **Photos** are wired via CSS `background-image` on `.ba-before` / `.ba-after` / `.hero-photo`, not `<img>` tags. To swap a photo, drop a file in `public/` and update the `url(...)` in `globals.css` (or reuse the same filename to change nothing else).

---

## 6. ⚠️ Important: this is a front-end prototype

Nothing is persisted and nothing talks to a server. Before this can go live you'll need to build the backend. Specifically:

- **All content is hardcoded** in the page components — plans/prices, cemeteries, the panel's care history, deceased info, GPS coordinates, caretaker names. There is no CMS or DB.
- **The order wizard** (`siparis/page.tsx`) **now really submits** — "Siparişi tamamla" calls `POST /grave-locations` then `POST /orders` for real (see §6.9). Login is required to complete it (redirects to `/giris` and back if not).
- **Payment is now real, via iyzico (not Stripe — see §6.10).** The wizard's payment step no longer collects card fields at all — it collects `identityNumber`/phone/billing-address (iyzico's legal requirements) and redirects to iyzico's own hosted, secure page for the actual card entry + 3DS. Correction to the product-model framing used elsewhere in this doc: the customer's card is captured immediately on successful payment; it's the *payout to the field partner* that's held until the customer approves the work (see §6.8's state machine, step 7).
- **The panel** (`panel/page.tsx`) approve/redo, subscription pause/cancel, and "history count" changes are all still **in-memory simulations** that reset on reload — wiring the panel to real auth/data is deliberately out of scope for this ADIM (only the order wizard + a new login page were wired, see §6.9). "Murat Y." stays hardcoded there.
- **Currency** is a display toggle only (₺/€ values are both hardcoded per item); there's no FX conversion.

### Suggested next build steps
1. ~~Auth + user accounts.~~ Backend auth (register/login/refresh, RBAC) done — see §6.6. apps/web now has a real login/register page and auth context (§6.9); the panel still needs wiring.
2. ~~A data layer (DB + API) for orders, subscriptions, care records, and caretakers.~~ DB schema/migrations/seed done (§6.5), full spec §5 API surface + order state machine done (§6.7/§6.8), and the order wizard is now wired to it for real (§6.9).
3. Real photo upload/storage with the GPS + timestamp verification the product promises (S3 pre-signed URLs, EXIF extraction — the evidence endpoint currently only registers metadata for a URL the client already has, see §6.7).
4. ~~Payment integration — capture-on-success / payout-on-approval flow.~~ Done against **iyzico** (not Stripe), see §6.10: real Checkout Form initiation, webhook + callback confirmation, wizard wired end to end, plus a real refund method (§6.14 Phase 6). Subscription billing and chargeback still need iyzico's Subscription API / chargeback handling wired. **You'll add real iyzico sandbox/production keys to `apps/api/.env` yourself** (not shared with the assistant, same protocol as the earlier Stripe key) — once that's in place, the checkout-form success path, full webhook flow, and the refund call should all be re-tested against real iyzico.
5. i18n: copy is Turkish-only but components are structured so a library (e.g. next-intl) can be layered in without a rewrite.

### Known cosmetic TODOs
- Care-list row thumbnails (`.ph.thumb`) and the wizard's order-summary image (`.summary-card .ph`) are still striped placeholders — swap in real thumbnails when available.

---

## 6.5 Database (apps/api/prisma)

`apps/api/prisma/schema.prisma` implements every table in spec §4.1–4.8 (users, field_partners, cemeteries, grave_locations, orders, evidence_photos, payments, subscriptions, partner_payouts, complaints, notifications, audit_log) with exact field/enum names and the §4.8 indexes.

**Setup:**
```bash
cp apps/api/.env.example apps/api/.env   # then point DATABASE_URL at a real Postgres 16 + PostGIS instance
npm run db:deploy --workspace=apps/api   # applies all three migrations
npm run db:seed --workspace=apps/api     # loads the prototype's hardcoded data (4 cemeteries, "Murat Y." customer, "Hasan Kaya" partner, 6 sample orders)
```

**Notable decisions:**
- Generator is `prisma-client-js` (classic, CJS+ESM compatible), not Prisma 6's newer `prisma-client` — the latter is ESM-only and breaks under NestJS's ts-node/CommonJS toolchain.
- `audit_log` has no `updated_at`/`deleted_at`, unlike every other table — spec §4.7 explicitly calls it immutable/append-only.
- `grave_locations`' PostGIS GIST index (spec §4.8) is a second, hand-written migration on top of the Prisma-generated base migration, since Prisma's schema DSL can't express a PostGIS geography generated column.
- **Resolved spec gap:** the field partner's completion note ("saha notu", max 200 chars, spec §8.2/§12.1/§17) had no column anywhere in spec §4. Decision: `evidence_photos.field_note` (nullable `VARCHAR(200)`, third migration `20260101000002_evidence_photo_field_note`) — matches spec §8.1's "note sent along with the evidence upload"; no `orders` column, no junction table.
- **`grave_locations.section`/`.plot` are now nullable** (fourth migration `20260101000004_grave_location_section_plot_nullable`, ADIM 5) — the wizard's "ada/parsel bilmiyorum" path only requires a `cemetery_id`; section/plot stay genuine `NULL` until filled in later via `PATCH /grave-locations/:id` (§6.7), same "filled in later" treatment spec already gives `lat`/`lng` on this table.
- **Bug fix found via live testing, not hypothetical:** `prisma/seed.ts`'s fixture IDs were originally non-RFC4122 (`00000000-0000-0000-0000-000000000001` — version nibble isn't 1-5), which `class-validator`'s `@IsUUID()` rejects on any DTO field referencing them (e.g. `cemeteryId`). This only surfaced when the wizard flow was driven end-to-end against real seeded data — the e2e test suite never touched seeded IDs (tests create their own real fixtures). Fixed: all seed IDs reshaped to valid v4 form (`00000000-0000-4000-8000-...`).
- No Postgres was available in the sandbox that built this — the schema/migrations were still validated end-to-end (all 12 tables + FKs + indexes applied, full seed run, including the `field_note` addition) against a temporary embedded Postgres; only the PostGIS extension itself couldn't be exercised there. Confirm the PostGIS migration against real Postgres 16 + PostGIS before depending on it.
- **npm-workspaces gotcha:** a root `npm install`/`npm ci` does not reliably trigger `apps/api`'s own `postinstall` (which runs `prisma generate`) — this is a known npm-workspaces limitation, not specific to this repo. Fixed by adding a `postinstall` script to the *root* `package.json` that explicitly delegates into `apps/api`. If Prisma types ever look stale after installing, run `npm run postinstall --workspace=apps/api`. (And when checking whether it worked, inspect `apps/api/node_modules/.prisma/client/index.d.ts`, not `apps/api/node_modules/@prisma/client/index.d.ts` — the latter is always a 1-line re-export stub, seeing it short is not a bug.)

---

## 6.6 Auth (apps/api/src/auth) — spec §6

Implements `POST /auth/register`, `/auth/login`, `/auth/refresh` exactly per spec §5. Global auth-by-default: every route requires a valid access token unless explicitly marked `@Public()`; `@Roles(...)` + a global `RolesGuard` enforce spec §6.1's role matrix.

**Setup** (needs `apps/api/.env` filled in per §6.5, plus a reachable Redis — see `.env.example`'s `REDIS_URL`):
```bash
npm run dev --workspace=apps/api
# then e.g.
curl -X POST http://localhost:3001/api/v1/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"correct-horse-battery","fullName":"Test User"}'
```

**How it works:**
- Passwords: argon2id, minimum 10 characters (spec §6.2).
- Access token: JWT, 15 min, returned in the response body.
- Refresh token: JWT, 7 days, set as an **httpOnly + Secure + SameSite=Lax** cookie scoped to `/api/v1/auth`.
  - **Why Lax, not None:** no hosting/domain architecture is decided yet (§7 — no deploy integration exists at all right now). The natural default for a split SPA+API is same registrable domain via subdomains (e.g. `app.guzelkabir.com` + `api.guzelkabir.com`) — SameSite compares registrable domain, not host/port, so subdomains *are* same-site, and so is `localhost:3000` ↔ `localhost:3001` in dev. Lax works for both and, unlike None, actually blocks the cookie on cross-site POST requests (real CSRF protection). **If a genuinely separate registrable domain gets chosen later** (the infra/hosting step, spec §13), this needs revisiting explicitly — either put a reverse proxy in front of both to stay same-site, or upgrade to `sameSite: 'none'` + a real CSRF token (spec §14.3). Don't leave it at Lax in that scenario — the cookie would silently stop being sent at all, not just become less secure.
  - Allowed origins are controlled by `CORS_ORIGIN` (comma-separated, `credentials: true` required for the cookie to be sent).
- **CSRF token (spec §14.3, "form tabanlı işlemlerde") is deliberately deferred to the ADIM 9 security-hardening step — not silently skipped.** Current risk is low: `Authorization`-header-protected endpoints are CSRF-immune by construction, and the only cookie-authenticated endpoint (`/auth/refresh`) is already covered by `SameSite=Lax` blocking cross-site POST. Bundle this with the general 100 req/min/IP rate limiting from the same spec subsection when that step happens.
- **Refresh rotation with reuse detection**, state kept in Redis (`refresh:current:<userId>` → current valid `jti`). Every refresh call both validates and atomically replaces the stored `jti`. If an already-rotated-away refresh token is presented again (a stolen-token signal), the whole session is revoked immediately, not just that one request rejected.
- Register only accepts `role: customer | field_partner` — `ops_manager`/`support_agent`/`admin` accounts can never be self-registered.
- Login is rate-limited: 5 attempts / 15 minutes, keyed on IP **+** the attempted email (spec §6.2) — a single IP hammering different accounts, or one account hammered from different IPs, are tracked independently.

**Known simplification (documented, not a spec requirement):** one active refresh session per user at a time — logging in on a second device invalidates the first device's session. Fine for the pilot; extending to multi-device support later just means changing the Redis key from a single current-`jti` value to a set.

**Deliberately not done yet (scoped to later steps, not auth):**
- Per-access audit logging on sensitive fields (`deceased_name`, `national_id_encrypted`, spec §6.2/§14.1) — spans multiple resource modules. (The field-partner KYC gate itself is done — see §6.7, it lives on the orders/assign endpoint, not here.)

**⚠️ Not yet verified against a real Redis instance — same transparency standard as the PostGIS caveat in §6.5, don't skip this before pilot.** No real Redis was reachable in the sandbox that built this (network egress to the Redis download source was blocked), so all testing used `ioredis-mock` in place of `REDIS_CLIENT`. That mock faithfully emulates ioredis's command surface, so the rotation/reuse-detection *logic* genuinely executed and was verified — but the transport was never a real Redis process. **Re-run `apps/api/test/auth.e2e-spec.ts` against an actual Redis instance (remove the `ioredis-mock` override in the test) before relying on this in production or the pilot.**

**Tests:** `apps/api/test/auth.e2e-spec.ts` (Jest + Supertest) — registration validation & role restriction, login failure, full rotate → reuse-detected → session-revoked chain, and the rate limiter, all run against a real (temporary, embedded) Postgres during development, with Redis mocked as noted above. Not wired into CI yet (needs a real Postgres — lands with Testcontainers in the test-strategy step, spec §13.2/§15). Run locally:
```bash
DATABASE_URL=postgresql://... JWT_ACCESS_SECRET=test JWT_REFRESH_SECRET=test \
  npm run test:e2e --workspace=apps/api
```

---

## 6.7 API Layer (apps/api/src/{orders,payments,subscriptions,partners,cemeteries,kpi}) — spec §5

Every endpoint in spec §5's table exists now, one NestJS module per resource, exact paths/methods/roles.

**The two things specifically called out when this was built:**

1. **Field-partner KYC gate** (spec §6.2/§17) — `OrdersService.assign` checks `FieldPartner.status === 'active'` before allowing `PATCH /orders/:id/assign` to succeed, in the service layer (not a DB trigger, per instruction), with a specific error message naming what's missing. Confirmed against real Postgres: 403 while the partner is still `'onboarding'`, 200 once flipped to `'active'`.
2. **Stripe webhook signature verification** (spec §5.1) — no webhook payload is processed without a valid `Stripe-Signature`. `main.ts` had to change for this: Nest's default body parser is disabled app-wide, and a single middleware routes `POST /payments/webhook` through `express.raw()` (needed for HMAC verification — JSON-parsed bodies can't be re-verified) while everything else still gets normal `express.json()`. Verified event IDs land in a **new** `processed_webhook_events` table (spec §5.1 explicitly requires this table; unlike `field_note` in §6.5, this wasn't a spec gap needing a decision — the spec just doesn't put it in the §4 table list). Replayed events return `200 {duplicate: true}` without reprocessing anything. All four cases (no signature, bad signature, valid signature, replay) pass against real Postgres in `apps/api/test/payments.e2e-spec.ts`.

**Idempotency-Key** (spec §5.1): `src/common/idempotency` — a `@Idempotent()` decorator + Redis-backed `IdempotencyInterceptor` (global `APP_INTERCEPTOR`). Optional per-request like Stripe's own API; when sent, a retried request with the same key/user/route gets the cached first response back instead of re-running side effects, and a genuinely concurrent duplicate gets `409`. Applied to `POST /orders`, `POST /payments/intent`, `POST /subscriptions` — spec §5.1's text only names payment + order creation; subscription creation got the same treatment as a judgment call (same double-submit risk class), not because the spec said so.
  - Tested for real on all three: `orders.e2e-spec.ts` and `misc.e2e-spec.ts` do a full success-path dedup check on `/orders` and `/subscriptions` (same key → same id → exactly one DB row). `/payments/intent` can't be dedup-tested the same way since its success path calls the real Stripe SDK and there's no real test key here — instead its test confirms a failed attempt doesn't leave a stuck lock or a bad cached result behind (retrying gets a fresh, honest failure).

**Judgment calls made along the way — flagged, not silently decided:**
- `GET /orders`: spec's role column says "Ops/Admin" only, but Customer can call it too now, hard-scoped server-side to their own orders (they can't override the filter). Without this, apps/web's panel has no backing endpoint for "my orders" at all. Say the word if this should be a separate endpoint instead.
- `POST /orders/:id/evidence`: spec §5 calls it "multipart", spec §8.1 says photos go straight from client to S3 via pre-signed URL, never through the backend — those two descriptions contradict each other, and no S3 infra exists yet (ADIM 7). Implemented for now as a JSON endpoint that registers `{photoType, fileUrl, exifGps*, fieldNote}` metadata for an already-uploaded file. Needs revisiting once ADIM 7 builds the real upload flow.
- `field_partners.national_id_encrypted` really is AES-256-GCM encrypted now (`src/common/crypto/national-id.crypto.ts`) — a column named `_encrypted` holding plaintext would've been an active bug, not a "later" item. The AES key is derived from `KMS_KEY_ID_PII` used as a raw secret (SHA-256'd to 32 bytes) — there's no actual KMS behind it, that's still ADIM 9.
- **⚠️ KNOWN, TRACKED BLOCKER, not silently deferred: no endpoint moves a field partner from `onboarding` to `active`.** Spec §11.1 mentions an "onboarding onay akışı" for Admin Panel but §5's endpoint table has nothing for it — without it, the KYC gate above can never actually let a real assignment through in production. **Explicit decision after ADIM 8: not opening Admin Panel piecemeal just for this one endpoint** — spec §18.3 plans Admin Panel as its own full sprint, and you didn't want it fragmented. Resolves when Admin Panel gets its own dedicated ADIM. Until then, e2e tests/live PWA testing set `status='active'` directly via seed/DB.
- `GET /kpi/dashboard` returns only what's honestly computable today (orders-by-status, AOV, revenue, complaint rate); `conversionFunnel`/`repeatCustomerRate`/`averageSlaHours` are `null` — spec §11.1's funnel/SLA metrics need event-tracking that doesn't exist yet (Admin Panel's job), nothing was invented to fill them in.

**`grave-locations` module** (spec §5's table has no route for this — user decision, ADIM 5, needed to unblock the order wizard):
- `POST /grave-locations` (`customer`, `ops_manager`, `admin`) — find-or-create by `(cemeteryId, section, plot)`; dedup only when both `section` and `plot` are given, so the "yardım isteyin" path (neither given) always creates a fresh row instead of wrongly merging distinct field-detection requests.
- `PATCH /grave-locations/:id` (`ops_manager`, `admin`, `field_partner`) — fills `section`/`plot`/`lat`/`lng` once a partner locates the grave. Role-gated only (no ownership/assignment check) — matches exactly what was asked for; tighten later if needed.

**`users` module** (spec §5's table has no route for this either — user decision, ADIM 5): `GET /users/me` returns the caller's own `{id, email, fullName, phone, role, locale, isVerified, kycStatus}` (no `passwordHash`), from `user.sub` in the JWT. No `@Roles()` — any authenticated user, own data only. Added to fix a real bug found via live browser testing (§6.9): the JWT only carries `{sub, role}`, so `apps/web` had no server-verified source for `fullName` and it reset to a placeholder on every page reload.

**Tests:** `apps/api/test/orders.e2e-spec.ts`, `payments.e2e-spec.ts`, `misc.e2e-spec.ts` — all Jest + Supertest against a real (temporary, embedded) Postgres, same CI caveat as auth's tests (not wired in yet, lands with Testcontainers in ADIM 9). `apps/api/test/test-app.helper.ts` now centralizes the shared app-bootstrap logic (raw-body routing, Redis mock, JWT minting) — `auth.e2e-spec.ts` was refactored to use it too.

**One non-obvious debugging note if you extend the webhook tests:** supertest's `.send(someBuffer)` silently JSON-serializes the Buffer object itself when `Content-Type: application/json` is set (`{"type":"Buffer","data":[...]}`), not the raw bytes. This corrupts webhook payloads in a way that looks exactly like a broken signature. Use `.type('json').send(rawString)` instead.

---

## 6.8 Order State Machine (apps/api/src/orders, src/sla) — spec §2.3/§21.2/§17

The full chain from spec §21.2 is implemented: `draft → pending_payment → confirmed → assigned → in_progress → completed_pending_approval → closed | disputed`, plus the side branches (`pending_payment → cancelled` after 24h unpaid, `completed_pending_approval → disputed` on complaint).

**New pieces since §6.7:**
- `POST /orders/:id/start` (`assigned → in_progress`) — filled a real spec gap: §5's endpoint table has no route for this, but §2.3 madde 5 and §12.1 madde 27 (the field PWA's "Başla" button) both describe it as a real step, and §21.2's state machine has `in_progress` as a real state. `addEvidence`/`complete` were tightened to require `in_progress` (previously unchecked) so the chain is actually enforced, not just documented.
- `completed_pending_approval → disputed` on complaint (`OrdersService.addComplaint`) — matches §21.2's literal edge. Complaints on orders in other statuses still get recorded, just without the order-status transition.
- **`disputed → refunded | reservice → closed` — `rejected` and `refunded` both work now (Admin Panel §6.14 Phase 6).** `reservice` still doesn't transition the order — real re-service dispatch is a separate, not-yet-built operational flow; deliberately not faked.

**SLA automation** (`apps/api/src/sla`) uses BullMQ, per spec §2.2's explicit choice ("Message Queue (BullMQ + Redis)... otomasyon SLA takipleri") rather than a simpler alternative. Business logic lives in `SlaService` (plain, directly testable); `SlaProcessor` is a thin BullMQ worker that just calls it on a schedule:
- `cancelUnpaidOrders` (every 15 min): `pending_payment` past 24h → `cancelled` (spec §7.1 madde 12).
- `autoCloseApprovedOrders` (every 15 min): `completed_pending_approval` past `approvalDeadline` → `closed` + payout record (spec §2.3/§17). 15-min is a guess for both — spec only gives an explicit interval for the assignment SLA below.
- `escalateOverdueAssignments` (every 5 min, spec §17's literal interval): `confirmed` orders unassigned past 30 min → queues a `Notification` row per ops_manager (detection + record only, not actual SMS/email dispatch — that's ADIM 8).
- **Timestamp caveat:** neither the 24h nor 30min window has a dedicated field in spec §4.4 — both sweeps use `updated_at` as a "when did this order enter this status" proxy, since spec doesn't name a field for it.

**Setup note:** BullMQ needs its own Redis connection, separate from the shared `REDIS_CLIENT` auth/idempotency use (BullMQ Workers require `maxRetriesPerRequest: null` on the connection, which the shared client doesn't set). `SlaModule` builds its own from `REDIS_URL` with a fast-fail `connectTimeout`/`retryStrategy` and wraps its job-scheduling in try/catch — so the app boots fine even when Redis is unreachable (confirmed: this sandbox has no real Redis, and the built app still starts and maps all 19 routes cleanly, logging a warning instead of hanging).

**⚠️ Not verified against a real Redis** — same standing caveat as §6.6's auth Redis usage. `SlaService`'s three sweep methods are fully tested against real Postgres in `apps/api/test/sla.e2e-spec.ts` (called directly, bypassing BullMQ); the actual cron-trigger machinery is only confirmed to not crash app boot, not confirmed to fire jobs on a live queue.

**Debugging note for future time-based tests:** don't bind a JS `Date` as a `$executeRaw` parameter to backdate a `timestamp(3)` column. The write path applies an implicit database-session-timezone conversion that Prisma's normal read path doesn't reverse — this sandbox's embedded Postgres defaults to `Europe/Istanbul` (not UTC), which silently produced a 3-hour-wrong backdated value the first time this was tried. `sla.e2e-spec.ts`'s `backdateUpdatedAt` helper works around it with an explicit UTC string literal (`'YYYY-MM-DD HH:MI:SS.sss'::timestamp`) instead — copy that pattern.

---

## 6.9 Frontend wiring (apps/web) — ADIM 5, order wizard + login done

The two gaps that blocked this (no login UI, no grave-location endpoint) are both closed now.

- **`lib/api.ts`**: fetch wrapper matching spec §5's error envelope (throws `ApiError{code, message, requestId, status}`). Access token lives **in memory only** (module-level var + subscriber set), not `localStorage` — standard XSS mitigation. Auto-retries once on `401` via `refreshAccessToken()` (`POST /auth/refresh`, `credentials: "include"`), deduping concurrent refreshes.
- **`lib/auth.tsx`**: `AuthProvider`/`useAuth()`, same Context pattern as `currency.tsx` — no new state library. On mount, silently calls `refreshAccessToken()` so a page reload restores the session from the httpOnly cookie — **verified for real with headless Chrome** (§6.9's verification note below), not just by reading the code: login → real `page.reload()` → `POST /auth/refresh` returns `200`, user stays logged in.
  - **Bug found via that same browser test, then fixed:** `CurrentUser.fullName` used to be rebuilt purely from in-memory React state on every token change — a full reload wipes JS memory, so the displayed name reverted to a "Hesabım" placeholder on *every* reload (the session itself stayed valid; only the name broke). Fixed with a new **`GET /users/me`** (`src/users`, not in spec §5's table — a direct complement to spec §6's RBAC/auth design, not a new architectural call), which `auth.tsx` now calls after every login/register/refresh to get the server-verified name. Re-confirmed with the same Puppeteer test: name now survives a real F5.
- **`app/giris/page.tsx`** (new route): login/register, reusing only existing CSS classes — no new styling. Register always sends `role: "customer"`.
- **`components/Topbar.tsx`**: `AuthIndicator` added to `home`/`flow` variants only. **`panel` variant deliberately stays hardcoded** — wiring the panel is out of this ADIM's scope.
- **`app/siparis/page.tsx`**: wizard steps/labels/CSS unchanged. What's real now:
  - Mezarlık (cemetery) selection is **always required**, even in "yardım isteyin" mode (matches `grave_locations.cemetery_id` staying `NOT NULL` while section/plot went nullable, §6.5).
  - Step 4's "Siparişi tamamla" resolves the cemetery name → id via `GET /cemeteries/search`, then really calls `POST /grave-locations` and `POST /orders`. Not logged in? Current field values are saved to `sessionStorage` and the browser goes to `/giris?next=/siparis` — nothing typed is lost.
  - **`serviceType` is always `'full_package'`** regardless of plan chosen — flagged, not silent. Mapping "aylık"/"yıllık" to the `subscription` enum would imply a real recurring Subscription behind it, and the iyzico Subscription API integration still isn't built (§6.10 — only a column rename happened). Revisit then.
  - "Yakınlık" and "yıldönümü hatırlatması" fields stay UI-only — no backing column exists for either yet (ADIM 8/spec §9 territory).
  - **Payment step note as of ADIM 5 (superseded by ADIM 6, §6.10):** at this point the payment step was still a pure simulation with no `POST /payments/intent` call. That's no longer true — see §6.10 for the real iyzico wiring.
- **How this was verified:** the full flow (register → login → cookie refresh → cemetery search → grave-location create, both paths → order create → partner `PATCH`) was driven live over HTTP against a real `apps/api` + temporary embedded Postgres, calling the exact endpoints/payloads the frontend code uses. CORS preflight was checked for real too. Real Redis still isn't reachable in this sandbox (same standing limitation as §6.6) — auth was exercised against a small hand-written RESP-protocol stub instead of `ioredis-mock`, a real TCP/RESP round-trip through ioredis's actual client code, stronger than the mock but still not real Redis.
  - **A real headless Chrome was obtained and used for the reload/session question specifically** — `npx puppeteer browsers install chrome` downloads a genuine Linux Chrome binary (first attempt got cut off by a tool timeout mid-download and left a corrupt zip; retrying in background mode completed cleanly). Puppeteer then drove that real Chrome through `/giris` → login → home → an actual `page.reload()`, with full network/cookie logging. This is how the `fullName`-reset bug above was actually *found* — not by inspection — and how the `GET /users/me` fix was actually *confirmed*, not asserted. (A Windows Chrome reachable via WSL's `/mnt/c/` path was tried first and failed — Puppeteer passes Linux-style paths a Windows process can't parse; the downloaded Linux binary is what worked.) All Chrome/Puppeteer tooling was `--no-save` and removed afterward — not a repo dependency. Re-verify against real Redis before pilot, same as the existing Redis caveat already says.

---

## 6.10 Payment provider: iyzico, not Stripe (spec §3/§7 updated — ADIM 6, implemented)

**Spec §3's "Ödeme: Stripe (birincil), PayPal (opsiyonel diaspora için)" is superseded — user decision.** Stripe doesn't open production merchant accounts for Turkey-incorporated companies (only its test/sandbox mode is geography-unrestricted); GüzelKabir's operating company is Turkish, so real money could never move through Stripe here. PayPal has the identical Turkey restriction, so it's dropped too — not "opsiyonel" anymore, just out. **New — and only — provider: iyzico**, Turkey-headquartered, TRY-native, 3D Secure built in, PCI DSS SAQ-A compliant, and actually issuable to a Turkish company.

This is a vendor swap, not a business-rule change — spec §7's rules (3D Secure mandatory, capture the customer's payment immediately on success, hold the *field partner's* payout until customer approval, refund/chargeback, diaspora multi-currency) don't change. One correction made while re-reading spec §2.3/§7.1 for this: the "onaylandıktan sonra ödeme" framing is about the payout to the field partner, not about withholding the customer's charge — the customer is charged in full the moment payment succeeds (order → `confirmed`); it's the `partner_payouts` record that's gated on the 48h approval window (§6.8, step 7). So iyzico's standard immediate-capture flow is a direct match; no PSP-level pre-auth/capture split is needed (iyzico has one — "ön provizyon" — but the Stripe build never used one either).

**§6.7's Stripe work (`PaymentsService`, raw-body webhook routing, `processed_webhook_events`, e2e tests) was the reference architecture ADIM 6 replaced piece-by-piece** — not wasted, not a rewrite. Mapping used (iyzico's official docs at docs.iyzico.com; `iyzipay` on npm is iyzico's own officially-maintained Node.js SDK):

| Stripe (current) | iyzico (ADIM 6 plan) |
|---|---|
| `paymentIntents.create()` | Checkout Form initialize — `POST /payment/iyzipos/checkoutform/initialize/auth/ecom`, returns `token` + `checkoutFormContent` (Base64 HTML/JS snippet, embedded directly — same PCI DSS SAQ-A guarantee as Stripe Elements) or a `paymentPageUrl` for hosted redirect. |
| Stripe.js client-side 3DS | 3D Secure runs inside the embedded Checkout Form itself, no separate client SDK call. |
| Webhook: `Stripe-Signature`, HMAC over **raw body** | Webhook: `X-IYZ-SIGNATURE-V3`, HMAC-SHA256 over **named JSON fields** (`secretKey+iyziEventType+iyziPaymentId+token+paymentConversationId+status`, hex-encoded). **Simplifies `main.ts`:** the current `express.raw()`/`express.json()` branching exists only because Stripe needs raw bytes — iyzico doesn't, so that split can go away. |
| *(none)* | iyzico also POSTs to a `callbackUrl` synchronously after payment, and offers a pull-based `POST /payment/iyzipos/checkoutform/auth/ecom/detail` (query by `token`) — a second confirmation path alongside the webhook. |
| Stripe Radar score (>75 → review) | `fraudStatus`: `1` approved / `0` manual review / `-1` rejected — simpler 3-state, same manual-queue behavior. |
| Stripe Refunds API | `POST /payment/refund`, keyed on `paymentTransactionId` (**per-basket-item, not per-order like Stripe**). **✅ Actually implemented, §6.14 Phase 6** — `PaymentsService.refund()`. |
| Stripe Billing (subscriptions) | iyzico's own Subscription API — separate initialize/cancel/retry endpoints on a `subscriptionReferenceCode`, not invoice-driven. **Real structural rework here, not a rename**, when ADIM 6 reaches §7.2. |
| Stripe auto multi-currency | iyzico "Multi Currency" (USD/EUR/GBP/RUB/CHF/NOK) — covers spec's diaspora currencies, but it's a paid opt-in add-on (99 TL/yr) on iyzico's panel, not default-on. Settles in TRY at CBRT rate — already matches spec §7.3's TRY-pegged pricing model. |
| `STRIPE_SECRET_KEY` | `IYZICO_API_KEY` + `IYZICO_SECRET_KEY` + `IYZICO_URI` (sandbox `https://sandbox-api.iyzipay.com`, prod `https://api.iyzipay.com`). Same key-handling protocol as before: **you add your own real iyzico keys to `apps/api/.env` directly, not shared with the assistant.** |

**Accepted tradeoff, resolved (user decision):** spec §20.2's risk table pairs Stripe with PayPal for outage redundancy (circuit breaker across two providers). PayPal has the same Turkey problem, so that redundancy is gone. Two options weighed: add PayTR now as a second Turkish PSP with a real circuit breaker (keeps spec's original intent, doubles ADIM 6's integration surface), or accept single-provider risk for MVP1 and track the gap explicitly for MVP2. **Decided: single-provider for MVP1** — dual-PSP complexity isn't justified at pilot scale (8 weeks, low volume, spec §18.5–18.6). This supersedes spec §20.2's "Stripe + PayPal çift entegrasyon" mitigation for MVP1 (replaced with: accepted single-point-of-failure risk, no PSP-level redundancy) and **adds a new line item to spec §18.7's MVP2 backlog: PayTR as secondary provider + real circuit breaker**, reinstating the original redundancy intent once pilot volume justifies it. Keep this line in the backlog — don't let single-provider silently become the permanent answer.

### What's actually built (ADIM 6)

`package.json`: `stripe` → `iyzipay`. No official TS types exist for `iyzipay` — `src/payments/iyzipay.d.ts` hand-declares just the surface used, checked against the SDK's actual JS source (`node_modules/iyzipay/lib/**`), not guessed.

- `POST /payments/intent` calls `iyzico.checkoutFormInitialize.create()`, returns `{token, checkoutFormContent?, paymentPageUrl?}`.
- `POST /payments/webhook` verifies `X-IYZ-SIGNATURE-V3` (HMAC-SHA256, `timingSafeEqual` comparison), dedupes on `iyziReferenceCode` (confirmed from real webhook payload examples — iyzico's actual unique-per-event field, the analogue of Stripe's `event.id`).
- `main.ts`'s raw-body branching is gone, back to NestJS's default body parser — also now handles the callback route's `application/x-www-form-urlencoded` POST body with zero extra config.
- **New: `POST /payments/callback`** — iyzico's hosted page POSTs `token` here post-payment; calls `checkoutForm.retrieve()`, finalizes the `Payment`/`Order` (same `finalizePayment` helper the webhook uses — idempotent either order), 302-redirects to `${FRONTEND_URL}/siparis?odeme=basarili|hata&orderId=...`.
- **Real MASAK/AML gap, found and resolved, not invented:** `buyer.identityNumber` (TC Kimlik No / passport) is legally mandatory on every iyzico Checkout Form call — nothing collected this before. User decision: collected **only at payment time, never written to our DB** — `CreatePaymentIntentDto.identityNumber`, passed straight to iyzico. Same for the billing-address fields iyzico also requires (nothing in `grave_locations` has the *customer's* address, only the cemetery's) — transient, not persisted.
  - **Not persisting it isn't the whole job — it must not leak into logs/Sentry (ADIM 16) via an error message either.** `PaymentsService.redact()` scrubs `identityNumber` at both places an error could carry it: the SDK transport-error path and iyzico's own `errorMessage`. `src/payments/payments.service.spec.ts` proves this with a mocked SDK that deliberately embeds the value in both error shapes — a live e2e test against the real (placeholder-key) failure wouldn't actually prove anything here, since iyzico's real error text doesn't happen to include it. Keep this pattern (never interpolate `dto.identityNumber` directly into a thrown message or log call) for any new error path that touches it.
- `buyer.gsmNumber` falls back to `dto.phone ?? customer.phone` (registration's phone is optional); `400` with a clear message if both are missing. No `PATCH /users/me` exists yet for a customer to add a phone outside this flow.
- `subscriptions.stripe_subscription_id` → `iyzico_subscription_reference_code` (migration `20260101000006`) — renamed for honesty since the old name is Stripe-specific. **The real iyzico Subscription API integration is still NOT built** — same placeholder-record behavior as before, just correctly named. Don't confuse the rename with the feature.
- `PaymentProvider` enum: added `iyzico` (migration `20260101000005`, `ALTER TYPE ... ADD VALUE`); `stripe`/`paypal` kept for schema history, never produced anymore. `prisma/seed.ts` updated to `provider: "iyzico"`.
- **`apps/web/src/app/siparis/page.tsx`'s payment step is real now** — the fake card fields are gone, replaced by identityNumber/phone/billing-address inputs matching the DTO. Submit creates the grave-location + order exactly once (a `createdOrderId` guard blocks a duplicate order on retry after a failed iyzico call — verified live), then redirects the top-level browser to `paymentPageUrl` (not an iframe — hosted checkout pages commonly block iframe embedding for anti-clickjacking reasons, unverifiable without a live account, so the safer documented pattern was used). Since this is a full page reload, the wizard's in-memory state is gone by the time the customer returns from iyzico — the "Onay" step now reads `?odeme=basarili|hata&orderId=...` from the URL instead, fetching `GET /orders/:id` for the real order number on success.
- **`checkoutFormContent` (the embeddable-script alternative to `paymentPageUrl`) was deliberately not wired** — it's a literal `<script>` tag iyzico expects to execute in-place; React's `dangerouslySetInnerHTML` strips scripts by design, so this needs a manual DOM-recreation trick that couldn't be visually verified without a live iyzico account. `paymentPageUrl` (full redirect) was chosen as the lower-risk, well-documented path instead. If an account config ever returns only `checkoutFormContent`, `createIntent` throws a clear "not supported yet" error rather than failing silently.
  - **⚠️ Tracked spec deviation, user-confirmed:** spec §10.2 madde 23 literally specifies "Adım 5 — Ödeme: **Stripe Elements gömülü kart formu**" — an *embedded* form, not a redirect. What's actually built sends the customer to iyzico's hosted page instead. Approved tradeoff (unverifiable script-injection vs. verified redirect, given no real account here) — **but flagged as a to-revisit item once the user adds a real iyzico sandbox key**: switching to embedded `checkoutFormContent` to match spec §10.2's original intent should be re-discussed then, not left as the permanent default by default.
- **How this was verified:** full e2e suite (29 tests) passes against real Postgres, including a rewritten `payments.e2e-spec.ts` with hand-computed iyzico HMAC signatures (pure math, no live API needed, same pattern as the old Stripe tests). This sandbox has real network egress to iyzico's sandbox API too — confirmed live: `POST /payments/intent` returns a genuine `"api bilgileri bulunamadı"` (invalid credentials) straight from iyzico's servers, matching ADIM 4's Stripe-401 confirmation pattern. The full wizard flow — login, all 4 steps, submit, real order created, real iyzico call, graceful error shown (no crash), retry does not duplicate the order — was driven through a real downloaded headless Chrome via Puppeteer, not simulated; a React-controlled-`<input>` gotcha (setting `.value` directly on a date input doesn't trigger React's state update — needs the native-setter-descriptor trick) had to be worked around in the test itself, worth remembering for future browser tests. Webhook and callback endpoints were both hit live via curl with hand-computed valid/invalid signatures, confirming correct accept/reject behavior. **Not verified, same standing gap as Stripe before it:** the actual successful-payment path (real card entry, 3DS challenge, `paymentPageUrl` genuinely rendering iyzico's hosted form) — needs a real iyzico sandbox key, which the user adds directly to `apps/api/.env`.

---

## 6.11 Evidence verification system (spec §8) — ADIM 7, implemented

- **AWS S3 (`eu-central-1`), not DigitalOcean Spaces.** Spec §8.2 needs 2-year WORM retention on evidence photos; DigitalOcean Spaces has no Object Lock/WORM support at all (verified, not assumed) — disqualifying regardless of its cost/simplicity edge. S3 Object Lock (Compliance mode) is the intended mechanism.
  - **✅ Object Lock confirmed active — was an open finding, now resolved, but it took a real code fix, not just the bucket config change.** After the user set the bucket's default Object Lock retention rule (2yr, Compliance) in the AWS console, the *same* presigned-upload flow that used to work started failing live with `400 InvalidRequest: Content-MD5 OR x-amz-checksum- HTTP header is required for Put Object requests with Object Lock parameters` — that error only ever appears on Object-Lock-enabled buckets, so hitting it is itself proof the default rule is genuinely active now (the earlier `ObjectLockMode: undefined` reading was, as suspected at the time, just "no default rule yet," not a code bug).
    - **Why**: S3 requires a content-integrity header (`Content-MD5` or `x-amz-checksum-*`) on every `PutObject` into an Object-Lock-enabled bucket. For a *presigned* URL, the exact checksum value has to be baked into the SigV4 signature at presign time — you can't presign "some checksum, TBD" and let the client fill it in later, S3 rejects a mismatched/late value as `SignatureDoesNotMatch`.
    - **Fix**: `StorageService.createPresignedUploadUrl(key, contentType, contentSha256)` now takes a caller-supplied base64 SHA-256 of the exact file bytes, sets `ChecksumAlgorithm: 'SHA256'` + `ChecksumSHA256: contentSha256` on the `PutObjectCommand`, and passes `unhoistableHeaders: new Set(['x-amz-checksum-sha256'])` to `getSignedUrl` so the checksum is a required signed header, not a query-string value (tried query-string-only first — still failed, S3's Object Lock check only honors the real header). **API contract change**: `POST /orders/:id/evidence/upload-url` now requires `{contentSha256}` in the body. **Real requirement for the field PWA (ADIM 8)**: it must `crypto.subtle.digest('SHA-256', fileBytes)` client-side (built into browsers) before calling this endpoint, then send the same value as `x-amz-checksum-sha256` on the actual `PUT`.
    - **✅ Directly verified, not inferred.** After the user added `s3:GetObjectRetention` to `guzelkabir-api`'s IAM policy, a live `HeadObject` returned `ObjectLockMode: "COMPLIANCE"` and `ObjectLockRetainUntilDate: 2028-08-27T11:49:59.792Z` — ~2 years from the object's `LastModified` (`2026-08-27T11:50:00.000Z`), exactly as spec §8.2 requires. This replaces the earlier checksum-error-based indirect inference with real, direct proof.
  - Setup gotcha (still true): Object Lock can only be enabled at bucket *creation*, requires versioning. CloudFront in front for CDN (not yet configured — `EVIDENCE_CDN_BASE_URL` falls back to a raw S3 URL). Lock intended for the original upload only, not the compressed CDN derivative.
  - **⚠️ Process failure, corrected: never write real test data into the production bucket again.** The checksum-fix re-verification wrote a real object into `guzelkabir-evidence-prod` — wrong, since that bucket should only ever hold real customer evidence under 2-year WORM retention. **Now in effect**: all live S3/Object-Lock verification targets `S3_EVIDENCE_STAGING_BUCKET` (env var now set — user provisioned `guzelkabir-evidence-staging`, same Object Lock config as prod). The direct `HeadObject` verification above was the **last read-only touch to prod** — no further writes there; ADIM 8's field PWA and any other live S3 testing use staging.
  - **Exact inventory of test artifacts left in the prod bucket** (so nobody has to re-investigate this later): `evidence/_checksum-fix-verification/54c2e291-7e47-464a-829b-b0228e5c9a96.txt` — created **2026-08-27T11:50:00.000Z**, eligible for deletion at **2028-08-27T11:49:59.792Z** (confirmed exact value from the direct `HeadObject` check above), cannot be deleted early. Two other prefixes, `evidence/_presign-probe/` and `evidence/_object-lock-probe/`, hold objects from an earlier debugging session whose exact keys/timestamps were never recorded and **cannot be enumerated from application code** — `guzelkabir-api` has no `s3:ListBucket` (confirmed: `AccessDenied`). Check the S3 console directly if a full count is ever needed.
- **Geotag tolerance is per-cemetery**: `Cemetery.geotagToleranceM` (nullable `Int`, migration `20260101000007`), falls back to `GEOTAG_DEFAULT_TOLERANCE_M` (env, default 150) when null. `PATCH /cemeteries/:id` (ops/admin) added so it's actually reachable.
- **Missing reference coordinate on `grave_locations`** (the "yardım isteyin" flow, §6.5): evidence upload is **not blocked** — falls to `manual_review` with an Ops notification.
- **Ops manual-review notifications reuse `SlaService.escalateOverdueAssignments`'s exact pattern** — queued `Notification` row, no real send (ADIM 8/9). Fires for `missing_exif`/`gps_mismatch`/`timestamp_mismatch`/no-reference-coordinate — spec §8.1 madde 17 only names the first two explicitly, the rest included for consistency (flagged extension).
- **"Canlı çekim zorunlu" (madde 13) confirmed as UI-only, backend-unenforceable — accepted MVP1 trust boundary.** Real backend levers: EXIF-timestamp freshness (madde 18) + GPS/Haversine — deterrents, not proof.
- **⚠️ KVKK erasure vs. WORM retention tension — flagged for spec §19's compliance role, not resolved in code.**
- **Bundled fix:** `OrdersService.complete()` now actually requires 1 wide_shot + 1 detail_shot (spec §8.2), not just count ≥ 2.

**What's built** (`src/storage` + `src/orders`): `POST /orders/:id/evidence/upload-url` issues a real S3 presigned PUT URL (5-min TTL). `POST /orders/:id/evidence` no longer accepts client-supplied `exifGpsLat`/`exifGpsLng`/`exifTimestamp` — `OrdersService.addEvidence` downloads the real S3 object, extracts real EXIF via `exifr` (`src/orders/evidence-geo.util.ts` — pure, unit-tested), makes a compressed derivative via `sharp`, computes Haversine, writes the real `geotag_validation_status`.

**How this was verified:** 11 unit tests (haversine + all 5 status outcomes) need no AWS. 8 new e2e tests (`test/evidence.e2e-spec.ts`) run against real Postgres with `StorageService` swapped for an in-memory `MockStorageService` — deterministic, CI-safe. Beyond that — **you added real AWS credentials mid-ADIM, so the full pipeline was live-verified against the real `guzelkabir-evidence-prod` bucket**: real presigned URL requested, a real JPEG with crafted EXIF GPS (`sharp.withExif()`, round-trip-verified through `exifr.parse()`) `PUT` directly to it, then `POST /orders/:id/evidence` correctly downloaded that real object, extracted the exact embedded GPS (`41.0013, 29.0362`), computed a real Haversine distance (`13.93m`), and returned `geotagValidationStatus: "valid"` — full real round trip confirmed working. The compressed derivative's presence in the bucket was also confirmed via `HeadObject`. This live check is exactly how the Object Lock gap above was found — not guessed.

---

## 6.12 Field partner PWA (apps/field-pwa) — ADIM 8, online-only, implemented

New app, spec §12: Vite + React 19 + TypeScript + Tailwind v4 + hand-rolled shadcn/ui-style primitives. Dev port 3002. **Offline-first (spec §12.2) deliberately NOT in this ADIM** — tracked as **ADIM 8b**, required before pilot hardening (spec §18.5), not open-ended backlog. Now done — see §6.13.

**Tracked spec deviations, all user-confirmed:**
- **Email+password login, not phone+OTP** (spec §12.1 madde 25). No real SMS provider exists anywhere (`NETGSM_API_KEY` still an empty placeholder). A fake/simulated OTP flow was explicitly rejected by you ("gerçek olmayan bir güvenlik akışını 'çalışıyormuş gibi' göstermek... sahte veri yazmaktan farksız bir risk") — not a compromise, a hard no. `User.phone` already collected at registration, so switching later needs no migration.
- **No embedded map on "Görev Listesi"** (madde 26) — `GOOGLE_MAPS_API_KEY` doesn't exist yet. List sorted by SLA urgency instead. You confirmed this as a flagged follow-up you'll raise yourself.
- **Saha notu entered on the last photo's confirm step, not a separate "Rapor" screen** (madde 29) — real backend constraint: `field_note` lives on `evidence_photos` and can only be set at evidence-creation time, no `PATCH` exists to attach it after. `CompletePage` (spec's literal screen) is reduced to a recap + "Tamamla".
- **GPS check on "Başla" is soft/non-blocking** (madde 27 itself calls this "opsiyonel") — your call, adopted verbatim: the real, binding check already happens server-side via EXIF+Haversine at evidence upload.
- **Camera-only via `getUserMedia`** (madde 28) — no `<input type="file">` anywhere, so there's no gallery path to defeat spec §8.1 madde 13 in the first place; architectural, not enforced-by-rule.

**Backend additions needed to make the PWA work — real gaps found by building against the existing API:**
- `GET /users/me` now returns `fieldPartnerId`/`fieldPartnerStatus` (`src/users/users.service.ts`) — `User.id` ≠ `FieldPartner.id`, nothing exposed the mapping before.
- `GET /orders/:id` now allows `field_partner` when they're the assigned partner (`OrdersService.findOneForUser`) — spec §5 literally says "Owner/Ops/Admin", field_partner treated as a natural extension of "Owner" for their own task, same class of reading as the earlier Customer-scoped `GET /orders` decision.
- `GET /orders/:id` and `GET /partners/:id/tasks` both now `include: { graveLocation: { include: { cemetery: true } } }` — neither joined grave/cemetery data before; the PWA's list/detail screens need "adres, mezar konumu" (madde 26/27).
- All verified: full e2e suite still 36/36, plus live-driven through the real PWA below.

**⚠️ Real gap found only by live-testing with an actual browser: S3 CORS.** Every prior S3 verification (ADIM 7) was curl/Node scripts, never a real browser — the presigned-upload flow's CORS requirement was never exercised. First real browser attempt failed the PUT with a CORS preflight rejection (pure bucket config, the presigned URL itself was correctly signed). **Fixed on `guzelkabir-evidence-staging` only** (you added: `AllowedOrigins: ["http://localhost:3002"]`, `AllowedMethods: ["PUT"]`, `AllowedHeaders: ["Content-Type", "x-amz-checksum-sha256"]`). **Deliberately not added to prod yet** — your call, wait until the real deployed PWA origin is known (ADIM 13). **Action item before go-live: add the equivalent CORS rule to `guzelkabir-evidence-prod` with the real production origin.**

**⚠️ npm-workspaces gotcha worth knowing if it recurs:** `field-pwa`'s scaffolded `package.json` pinned `"react": "^19.2.8"` while `apps/web` pins exact `"19.0.0"` — npm couldn't hoist one shared copy, silently installed a second nested `react`/`react-dom` under `apps/field-pwa/node_modules/`, causing `Invalid hook call` (two React instances) at runtime the moment `react-router-dom` (hoisted, against `19.0.0`) rendered against the nested `19.2.8` copy. Fixed by pinning to the exact same `"19.0.0"` and manually deleting two stale `apps/field-pwa/node_modules/react*` entries from `package-lock.json` — a plain reinstall did **not** self-heal this, the lockfile needed a direct edit. Pin new apps' React version to match the others up front next time.

**Live-verified for real:** full flow — login → task list (real joined grave-location data) → task detail → "Başla" → `in_progress` → camera capture → 2 photos via `getUserMedia` (Chrome's `--use-fake-device-for-media-stream` — a synthetic feed, but the capture code path/canvas-to-Blob/`crypto.subtle.digest` checksum are all real) → saha notu on the last photo → both uploaded through the real presigned-URL+checksum flow to the real, live `guzelkabir-evidence-staging` bucket (all 4 S3 requests confirmed targeting staging, zero touched prod, all `200`) → `POST /orders/:id/complete` → order genuinely reached `completed_pending_approval` with a real 48h `approval_deadline` — driven through a real downloaded headless Chrome (Puppeteer). Both photos show `geotag_validation_status: "missing_exif"`, expected and correct (fake camera has no real EXIF GPS, same code path as a real phone with location off). Final DB state confirmed directly against Postgres. The backend for this test ran with `S3_EVIDENCE_BUCKET` forced to the staging value from the start (never the real `.env`'s prod value) — the "never touch prod during live testing" rule applied proactively this time, not after an incident.

---

## 6.13 Field partner PWA offline-first (apps/field-pwa) — ADIM 8b, implemented

spec §12.2: task list/detail viewable offline, photos captured offline queue and upload once connectivity returns. Sequencing decision (your call, after ADIM 8): do this before opening Admin Panel, since Admin Panel is its own full sprint (spec §18.3) and won't be opened piecemeal just to patch the field-partner onboarding→active gap — that gap stays tracked in §6.7 below until Admin Panel gets its own ADIM.

**Architecture — one unified queue, not three separate ones:**
- `src/lib/db.ts` — `idb`-wrapped IndexedDB, single `pendingActions` store (`start` / `evidence` / `complete`), each record has `status: pending|syncing|synced|failed` and a monotonic `seq`.
- `src/lib/queue.ts` — `enqueueAction` (writes to IndexedDB, immediately tries a sync), `flushOrder` (processes one order's actions **strictly in `seq` order** — evidence never fires before `start` synced, `complete` never fires before both evidence photos synced; backend would reject out-of-order anyway, this just avoids the wasted round-trip), `flushQueue` (drives all orders with pending items).
- `src/sw.ts` (vite-plugin-pwa, `injectManifest` strategy — chosen over `generateSW` because custom Background Sync logic is needed) — Workbox `precacheAndRoute` for the app shell, `NetworkFirst` for task-list/detail API GETs (spec §12.2's "offline görüntülenebilir"), and a `sync` event listener that calls the same `flushQueue()`.
- **Idempotency-Key reuse**: each queue item's own UUID is sent as `Idempotency-Key` on `start`/`evidence`/`complete`. `apps/api/src/orders/orders.controller.ts` got `@Idempotent()` added to those three routes specifically for this (they already had the interceptor infra from spec §5.1, just weren't applied there yet) — this is what makes a retry after an interrupted request safe: if the first attempt actually reached the server, the retry replays the cached response instead of double-executing.
- **Conflict handling, server-authoritative, never silently overwritten**: a 409 (idempotency lock still "processing") retries later; any other `ApiError` (4xx) is a permanent server rejection → status `failed`, the server's own message shown to the user, never retried automatically; a network-level failure (not an `ApiError`) leaves the item `pending` for the next sync attempt. This is spec §12.2's "son yazan kazanır, sessizce ezilmez" applied literally.

**Real bugs found via live Playwright testing (`context.setOffline(true)`, your explicit instruction — not just asserted to work):**
- **Missing SPA offline-navigation fallback.** `precacheAndRoute` alone only matches exact precached URLs (e.g. `/index.html`), not client-routed deep links (`/gorevler/:id/fotograf`). Without a `NavigationRoute`, offline navigation to any non-precached path showed Chromium's native offline error page — the app never loaded, so the IndexedDB queue looked inaccessible (it wasn't lost, just unreachable). Fixed: `registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html")))`.
- **The core scenario you asked to verify — does an interrupted request survive a full app close, or get stuck/lost — passes.** Test sequence: go offline → capture a photo (real `enqueueAction`, real IndexedDB write) → force the record to `syncing` (simulating a request killed mid-flight) → close the entire browser context → relaunch on the same profile, still offline → confirm the record survived and was reset from `syncing` back to `pending` (`resetInterruptedSyncs()`, called before `flushQueue()` on every boot — order matters, a fresh `flushQueue()` would otherwise skip records still marked `syncing` and never retry them) → go online → confirm it actually flushes to `synced`. All four steps verified for real against a live `apps/api` (real Postgres) and the real `guzelkabir-evidence-staging` S3 bucket — the evidence row landed with a real `file_url` pointing at staging, confirmed via a direct DB query, not just the browser-side IndexedDB state.
- **⚠️ Real, load-bearing finding: the browser `online` DOM event is not reliable enough to be the sole reconnect trigger.** Reproduced deterministically: when `context.setOffline(true)` is set on a **fresh** browser context/profile **before** its first navigation, and that navigation is served offline via the Service Worker's precache fallback, `navigator.onLine` gets stuck reporting `true` for the rest of that session — even though real network requests genuinely fail (`net::ERR_INTERNET_DISCONNECTED`, confirmed). Later calling `setOffline(false)` produces no `false→true` transition, so `online` never fires. Isolated minimal repros confirmed the event fires correctly in every OTHER tested ordering (plain `newContext()`; a persistent context where offline is toggled only after the page is already interactive) — it's specific to this "offline set before first paint on a fresh context" sequence. Whether this is purely a Playwright/CDP timing artifact or a real edge case a field partner could hit on a real device with flaky signal wasn't conclusively distinguished — and given this PWA's actual use case (outdoor cemetery visits, intermittent signal), it wasn't worth gambling on. **Fix, not a workaround for the test:** `queue.ts` now also exports `startPeriodicSync()` — a plain 20s `setInterval` calling `flushQueue()` — wired up in `main.tsx` alongside the existing `online` listener and Background Sync registration. Three independent reconnect triggers now, not one. With this fix, the full 4-phase scenario above passes reliably (though real sync latency — S3 round-trip from this sandbox — meant waiting up to ~40s in testing, not instant; expected, not a bug).
- **Cross-context auth (found and already fixed before this round, still worth knowing):** the Service Worker and the page are separate JS module instances, each with its own in-memory access-token copy (`api.ts` is bundled twice). `flushQueue()` proactively calls `refreshAccessToken()` when no in-memory token exists, relying on the shared httpOnly refresh cookie (browser-level, sent automatically in either context) rather than assuming the page's own token state.
- **Separate TypeScript project for the Service Worker.** `sw.ts` needs the `WebWorker` lib, the React app needs `DOM` — can't mix in one `tsconfig`. Solved with `tsconfig.sw.json` (project reference) + `tsconfig.app.json` excluding `sw.ts`, plus hand-written ambient types for the Background Sync API (`background-sync.d.ts` — not in TypeScript's built-in DOM lib yet).
- **Test against `vite preview` (production build), not `vite dev`.** Dev-mode Service Worker registration (`devOptions.enabled: true`) did not reliably reproduce production offline-navigation behavior even after the `NavigationRoute` fix — switched to building + serving the real production bundle for all live verification.

**Not verified, real remaining gap:** Background Sync itself (the `sync` event actually firing in a real browser process when connectivity returns, independent of the page being open) could not be directly confirmed in this headless-Chromium sandbox — the periodic-poll and `online`-event fallbacks are what's actually been proven to work. Background Sync also has no Safari/iOS support at all, so the periodic-poll fallback is the one universal guarantee across browsers, not just a backstop. Revisit if a real Android field test ever becomes possible.

---

## 6.14 Admin Panel (apps/admin) — ADIM 9, spec §11, in progress

Own full sprint per explicit user decision (not opened piecemeal). Spec §18.3 only time-boxes 2 of §11.1's 7 modules (Sipariş Yönetimi + Atama Ekranı) — the rest (Partner/Şikayet/KPI/Kullanıcı-Rol/Mezarlık) are sequenced here by actual need.

**Stack (verified directly against spec §3's PDF table, not inferred):** `apps/admin` — React 19 + Vite + TanStack Query + TanStack Table (Admin Panel's own row) + Tailwind CSS + shadcn/ui (spec §3's separate, project-wide "UI Kit" row — not app-specific). Port 3003, ops_manager/support_agent/admin only.

**⚠️ Tracked spec deviation:** KPI Dashboard uses native Recharts only, not spec's "Metabase embed veya native chart" option — a separate BI tool's hosting is unneeded complexity at pilot scale. Revisit if real multi-user/self-service reporting need emerges post-pilot.

**Real-time updates: 30s TanStack Query polling, not Socket.io** (spec offers both) — simpler, no connection-management layer, kept swappable in one place.

**§11.2 "onay modalı" + audit_log — two independent guarantees:** backend already writes `audit_log` unconditionally on every critical mutation (can't be bypassed by a frontend bug); frontend's `useConfirmedMutation` hook (Phase 3 infra) owns both the confirm-modal and the actual API call so screens can't skip the modal by accident.

**Phase 1 (`fb8c4ee`) done:** resolves the tracked onboarding→active blocker for real — `POST /partners/:id/approve`/`reject`, `GET /partners`, `GET /partners/:id/payouts`, plus `AuditLogService` (the `audit_log` table existed since the original schema, never had a writer until now). New `rejected` FieldPartnerStatus (migration, user decision). Support Agent's spec §19 refund limit has no numeric value in spec — MVP1 requires full ops/admin approval for any real refund rather than inventing a threshold.

**Phase 2 (`aa7ee20`) done:** all order status transitions (assign/start/complete/approve/dispute + SLA auto-cancel/auto-close) now audit-logged too — `GET /orders/:id/audit` (timeline), `partnerId` filter on `GET /orders`.

**Reminder for Phase 8 (Mezarlık & İzin Yönetimi), noted now:** extend the existing `PATCH /cemeteries/:id` (ADIM 7) with `permitStatus`/`permitDocumentUrl` — do not add a second cemetery-update endpoint.

**Phase 3 (`12c7851`) done:** `apps/admin` scaffolded, `ProtectedRoute` role-gated, `ConfirmDialogProvider`/`useConfirmedMutation` built (raw `mutate` never exposed to screens). Live-verified: login, real name, nav, session-survives-reload, logout, both role-gate directions.

**Phase 4 (`2e1f6b1` + fix in `beb2a2f`) done:** Partner Yönetimi screen (`DataTable` built here, reused everywhere after) — approve/reject via `useConfirmedMutation`, reject's reason collected through a new optional `input` field on the confirm modal. **Real bug found building this, then found 3 more times in the same file:** `PartnersService` used `include` instead of `select` on `findMany`/`approve`/`reject`/`submitOnboarding`, leaking the encrypted `nationalIdEncrypted` ciphertext into API responses that never needed it. Fixed all four with explicit selects + regression assertions in the e2e suite; grepped the rest of the codebase to confirm no other spot repeats it.

**Phase 5 (`2a98abc`) done:** Sipariş Yönetimi (list + detail w/ audit-log timeline) + Atama Ekranı (pending orders + active partners side by side, one-click assign, live SLA countdown reusing `SlaService`'s existing `updated_at` proxy). Fixed a Phase 3 nav bug along the way — Sipariş Yönetimi and Atama Ekranı had been merged into one nav item; spec lists them as 2 of 7 modules. "Toplu işlem desteği" deliberately not built — spec never says which bulk actions are wanted, flagged rather than invented. Backend joins (customer/cemetery/partner) use the same explicit-select discipline as the Phase 4 fix.

**Phase 6 (`9ff2ee0`) done — first real iyzico refund implementation, correcting my own earlier claim.** Phase 3's plan said Phase 6 would wire refunds to "the already-built iyzico refund API" — wrong, it never existed, only a conceptual mapping table did. Building `PaymentsService.refund()` for real surfaced a genuine gap: iyzico's `/payment/refund` keys on a per-basket-item `paymentTransactionId` (verified from `node_modules/iyzipay` source), completely uncaptured anywhere in the existing code. Fixed without a schema migration — fetched fresh at refund time via `checkoutForm.retrieve()` on the payment's existing stored token, rather than touching the tested webhook/callback paths. Self-caught error: my research agent said iyzico's `REFUND_REASON` keys were lowercase; checking the actual source showed they're uppercase — verify agent research against source for anything touching real money.

- `ComplaintsService`: investigate/resolve/processRefund (refund trigger is ops_manager/admin only — Support Agent can mark `resolved_refund` but not trigger the real money movement, per the Phase 1 decision). `rejected` closes a disputed order; `resolved_reservice` deliberately leaves the order `disputed` — real re-service dispatch is a separate flow that doesn't exist yet, faking "closed" would be the same shortcut as the rejected fake-OTP idea from ADIM 8.
- `ComplaintsPage`: 3-column kanban (spec's literal Açık/İnceleniyor/Çözüldü — 5 statuses bucket into 3 columns), real SLA countdown off `Complaint.slaDeadline` (a genuine field, no proxy needed), resolution templates per outcome.
- Live-verified via Playwright: full state machine, template auto-fill, dynamic confirm-modal text, and the refund attempt correctly rejected by the real backend (no Payment row on the test order) rather than falsely succeeding. `support_agent` confirmed unable to see or call the refund action (client and server both). Actual successful-refund path unverified without a live iyzico key — same standing limit as payment creation, covered by 4 mocked-SDK unit tests instead.

**Phase 7 (`96a456a`) done — surfaced a real auth gap.** `User.deletedAt` existed since the original schema but `login()`/`refresh()` never checked it, harmless until "deactivate a staff account" (this phase) gave it a real writer. Fixed first: a deactivated account can't log in and an already-issued refresh token for it is rejected too. An already-valid access token still works for its remaining ≤15min — accepted JWT tradeoff, not fixed.

- `UsersService`: admin-only (spec §6.1's literal role table — Ops/Support don't have this authority) CRUD scoped strictly to `ops_manager`/`support_agent`/`admin` rows, password hash never selected, deactivate reuses the existing soft-delete convention, self-deactivation blocked server-side.
- Live-verified: create → role change → deactivate → the account genuinely can't log in (checked against the real backend) → `ops_manager` blocked both server- and client-side with no data leak.

**Phase 8 (`4dfa3b7`) done** — `PATCH /cemeteries/:id` extended with `permitStatus`/`permitDocumentUrl` per explicit user instruction (no parallel update endpoint). Surfaced a real leak: the public `GET /cemeteries/search` had no `select`, returning every field including permit data — harmless while `permitDocumentUrl` was always null, a real leak once this phase gave it real values. Fixed with an explicit select (same pattern as the Phase 4 fix). Two genuinely new endpoints (not duplicating the update path): `POST /cemeteries` (creation never existed) and `GET /cemeteries` (admin-only full list, kept separate from the public search for the same security reason as the leak fix).

**Phase 9 (`f4d2e85`) done — final phase of ADIM 9.** Every spec §11.1 KPI was audited for real computability before coding: repeat-customer rate had been wrongly bundled as "needs event tracking" — it's a plain existing-schema aggregation, fixed for real. Average assignment SLA (spec §17's 30-min target) needed one missing `order.confirm` audit-log call in `PaymentsService.finalizePayment` — added, now genuinely real. True conversion funnel stays `null` correctly (no analytics infra anywhere in `apps/web`) — replaced with an honestly-labeled order-lifecycle funnel instead. `KpiDashboardPage` uses native Recharts. Live-verified via direct API call: a hand-seeded 20-minute audit-log gap produced exactly `averageAssignmentSlaMinutes: 20`.

**All 9 phases of ADIM 9 (Admin Panel, spec §11) are complete** — verified against real Postgres (55/55 e2e after Phase 9), full monorepo lint/typecheck/build clean throughout every phase.

## 7. Deployment workflow

No hosting/deploy integration is set up for this repo yet. Deployment targets (frontend, API, DB, object storage) land as part of the infra/DevOps step (spec §13).

Always run `npm run build` locally before pushing — CI (`.github/workflows/ci.yml`) runs the same lint/typecheck/build and will fail on type errors.

---

## 8. Working with Claude Code on this repo

A **`CLAUDE.md`** at the repo root gives Claude Code the project's conventions automatically every session — read it, and keep it updated as the architecture changes. Practical tips:

- Ask Claude Code to run `npm run build` after changes; the whole app is statically prerendered, so type/build errors surface fast.
- Point it at `design_handoff_guzelkabir/` when you want to rebuild or extend a screen faithfully to the original design.
- When changing anything visual, have it verify in a browser preview (screenshots + console check) rather than guessing — that workflow caught a dropped CSS rule during the initial build.
- The single global `globals.css` is large; when editing styles, ask Claude to match the existing token names and section comments rather than introducing a new styling approach.

---

*Questions on anything here → check `CLAUDE.md` first, then the `design_handoff_guzelkabir/README.md` for original design intent.*
