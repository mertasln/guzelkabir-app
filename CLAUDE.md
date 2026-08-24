# CLAUDE.md — GüzelKabir

Project context for Claude Code. See `HANDOVER.md` for the full developer handover.

## What this is
Remote grave-care marketplace for Turkey (İstanbul pilot, Turkish diaspora in Europe). Customer orders periodic grave care; a vetted caretaker uploads GPS/timestamp-verified before/after photos; customer approves; only then is payment released. **Turkish-only UI**, calm/respectful tone.

**Status: front-end prototype. No backend, no persistence, no auth, no real payments.** All data is hardcoded in the page components; wizard submission, panel approve/redo, and subscription actions are in-memory simulations.

## Stack
- Next.js 15.5.x App Router · React 19 · TypeScript (strict)
- `next/font/google`: Newsreader (display), Hanken Grotesk (body), IBM Plex Mono (mono) → CSS vars `--font-display` / `--font-body` / `--font-mono`
- No CSS framework, no state library, no data layer

## Layout
```
src/app/          layout.tsx · globals.css · page.tsx (home) · siparis/ (wizard) · panel/ (panel)
src/components/   Topbar · CurrencyToggle · BeforeAfter · Reveal · Faq · Price · icons
src/lib/          currency.tsx (CurrencyProvider + useCurrency, localStorage "gk-cur")
public/           hero + before/after grave photos
design_handoff_guzelkabir/   original HTML/CSS/JS prototypes = design source of truth (reference only)
```

## Conventions — follow these
- **All styling is in the single global stylesheet `src/app/globals.css`.** No CSS Modules, no Tailwind. The original designer's class names are preserved verbatim for fidelity — match existing class names, token names, and section comments when adding UI. Don't introduce a new styling approach.
- **Design tokens** are CSS custom properties in `:root` (only the "C · Modern Sakin" theme; A/B themes and the theme switcher were intentionally removed). Derive colors with `color-mix(in srgb, …)`.
- **Photos are CSS `background-image`** (`.ba-before`, `.ba-after`, `.hero-photo`), not `<img>`. Swap by editing the `url(...)` in `globals.css` or replacing the file in `public/`.
- **Currency:** amounts are `{ try: number, eur: number }` pairs rendered via `<Price>` / `useCurrency().fmt`; the ₺/€ toggle is display-only (no FX).
- **Client vs server:** pages are server components using client "islands" where interactivity/context is needed. The wizard and panel are full client components. `useCurrency()` must run inside `<CurrencyProvider>` (provided in `layout.tsx`).
- **Copy is final Turkish** — don't paraphrase existing strings. Components are structured so i18n can be layered in later without a rewrite.

## Workflow
- Run `npm run build` after changes — the app is statically prerendered, so type/build errors surface immediately. Vercel runs the identical build and **blocks deploys on type errors and on vulnerable Next.js versions** (keep Next ≥ 15.5.x).
- For visual changes, verify in a browser preview (screenshot + console check) instead of assuming — this caught a dropped CSS rule during the initial build.
- Push to `main` auto-deploys to production (https://guzelkabir.vercel.app) via the connected Vercel project.

## Before going live (not built yet)
Auth · DB + API for orders/subscriptions/care-records/caretakers · real photo upload with GPS+timestamp verification · payment (approve-then-capture; e.g. Stripe or iyzico) · i18n layer.
