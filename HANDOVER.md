# GüzelKabir — Developer Handover

Handover for continued development. Everything below is verified live as of this document.

---

## 1. Links & access

| Resource | URL |
| --- | --- |
| **GitHub repo** (private) | https://github.com/drtaylanyildiz/guzelkabir |
| **Production site** | https://guzelkabir.vercel.app |
| **Vercel project** | `vtaylan-5137s-projects/guzelkabir` |

**Access you'll need granted:**
- **GitHub:** repo is private under `drtaylanyildiz`. Ask the owner to add your GitHub account as a collaborator (Settings → Collaborators).
- **Vercel:** the project lives in the owner's personal scope. Either get added to the Vercel team/scope, or connect your own Vercel account to your fork. The GitHub repo is already linked to Vercel, so **pushing to `main` auto-deploys to production** — no manual deploy step needed once you have push access.

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
npm install
npm run dev
```

Dev server: http://localhost:3000 (the repo's `.claude/launch.json` uses port 3005 for the in-app preview tool; either is fine).

```bash
npm run build   # production build — run this before pushing; Vercel runs the same
npm run lint    # eslint
```

Node 18.18+ or 20+ recommended (built here on Node 22/25).

---

## 5. Project structure

```
src/
  app/
    layout.tsx          Root layout: fonts, <CurrencyProvider>, metadata (lang="tr")
    globals.css         ★ ALL styling. Design tokens + every component's CSS.
    page.tsx            Home (Ana Sayfa) — server component using client "islands"
    siparis/page.tsx    5-step order wizard (Sipariş Akışı) — client component
    panel/page.tsx      Customer panel (Müşteri Paneli) + detail overlay — client component
  components/
    Topbar.tsx          Header; variant="home" | "flow" | "panel"
    CurrencyToggle.tsx  ₺/€ switch (writes to CurrencyProvider)
    BeforeAfter.tsx     Pointer-drag before/after photo slider
    Reveal.tsx          IntersectionObserver scroll-reveal wrapper
    Faq.tsx             Accordion
    Price.tsx           Renders an amount in the active currency
    icons.tsx           All inline SVG icons as React components
  lib/
    currency.tsx        CurrencyProvider context + useCurrency() hook (localStorage "gk-cur")
public/
    hero-bakimli-mezar.avif   Hero photo (cared-for grave)
    bakimli-mezar.png         Before/after "after" (clean grave w/ flowers)
    bakimsiz-mezar.jpeg       Before/after "before" (same grave, overgrown)
design_handoff_guzelkabir/    Original HTML/CSS/JS prototypes — design source of truth (reference only, not shipped)
```

### Styling model — read this before touching UI
- **One global stylesheet:** `src/app/globals.css`. The original designer's exact class names are preserved verbatim for fidelity, which is why it's global rather than CSS Modules. When you add UI, follow the same class-naming and token conventions already in the file.
- **Design tokens** live as CSS custom properties in `:root` (only the "C · Modern Sakin" theme; the prototype's A/B themes were dropped). Colors are derived with `color-mix(in srgb, …)`.
- **Photos** are wired via CSS `background-image` on `.ba-before` / `.ba-after` / `.hero-photo`, not `<img>` tags. To swap a photo, drop a file in `public/` and update the `url(...)` in `globals.css` (or reuse the same filename to change nothing else).

---

## 6. ⚠️ Important: this is a front-end prototype

Nothing is persisted and nothing talks to a server. Before this can go live you'll need to build the backend. Specifically:

- **All content is hardcoded** in the page components — plans/prices, cemeteries, the panel's care history, deceased info, GPS coordinates, caretaker names. There is no CMS or DB.
- **The order wizard** (`siparis/page.tsx`) validates and computes a total, but "Siparişi tamamla" just advances to a confirmation screen. **No order is submitted anywhere.**
- **Payment is fake.** Card fields are collected but nothing is processed. There's an explicit "prototip ekranıdır; gerçek bir ödeme alınmaz" notice. You'll need a real PSP (e.g. Stripe / iyzico for TR) — and per the product model, payment is only captured *after* the customer approves the work.
- **The panel** (`panel/page.tsx`) approve/redo, subscription pause/cancel, and "history count" changes are all **in-memory simulations** that reset on reload. No auth, no user session — "Murat Y." is hardcoded.
- **Currency** is a display toggle only (₺/€ values are both hardcoded per item); there's no FX conversion.

### Suggested next build steps
1. Auth + user accounts.
2. A data layer (DB + API) for orders, subscriptions, care records, and caretakers.
3. Real photo upload/storage with the GPS + timestamp verification the product promises.
4. Payment integration with the approve-then-capture flow.
5. i18n: copy is Turkish-only but components are structured so a library (e.g. next-intl) can be layered in without a rewrite.

### Known cosmetic TODOs
- Care-list row thumbnails (`.ph.thumb`) and the wizard's order-summary image (`.summary-card .ph`) are still striped placeholders — swap in real thumbnails when available.

---

## 7. Deployment workflow

The GitHub repo is connected to Vercel:

- **Push to `main` → auto-deploys to production** (https://guzelkabir.vercel.app).
- **Open a PR / push a branch → Vercel posts a preview deployment** URL on the PR.
- Manual deploy if ever needed: `vercel --prod` from the repo root (requires Vercel CLI + scope access).

Always run `npm run build` locally before pushing — Vercel runs the identical build and will fail the deploy on type errors.

---

## 8. Working with Claude Code on this repo

A **`CLAUDE.md`** at the repo root gives Claude Code the project's conventions automatically every session — read it, and keep it updated as the architecture changes. Practical tips:

- Ask Claude Code to run `npm run build` after changes; the whole app is statically prerendered, so type/build errors surface fast.
- Point it at `design_handoff_guzelkabir/` when you want to rebuild or extend a screen faithfully to the original design.
- When changing anything visual, have it verify in a browser preview (screenshots + console check) rather than guessing — that workflow caught a dropped CSS rule during the initial build.
- The single global `globals.css` is large; when editing styles, ask Claude to match the existing token names and section comments rather than introducing a new styling approach.

---

*Questions on anything here → check `CLAUDE.md` first, then the `design_handoff_guzelkabir/README.md` for original design intent.*
