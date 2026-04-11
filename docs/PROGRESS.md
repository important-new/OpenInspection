---
last_updated: "2026-03-30"
status: "feature-complete"
---

# OpenInspection (apps/core) — Development Progress

## Tech Stack

- **Runtime**: Cloudflare Workers (Edge-Native, WinterCG)
- **Framework**: Hono.js v4 with `hono/jwt`
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM — `openinspection-db`
- **Storage**: Cloudflare R2 — `openinspection-photos`
- **Email**: Resend API
- **AI**: Google Gemini 1.5 Flash
- **Billing**: Stripe (checkout + webhooks + Connect payout routing, mock fallback)
- **Bot Protection**: Cloudflare Turnstile + CF threat_score
- **Calendar**: Google Calendar OAuth (inspector availability sync + event creation)
- **Silo Mode**: Per-tenant isolated D1 via Cloudflare D1 REST API (`D1HttpDatabase`)

---

## Completed Milestones

### Phase A: Inspector Dispatch UI
- Dashboard with inspection list
- New inspection modal: select template, enter address, assign inspector

### Phase B: Field Data Collection
- Mobile-first form renderer parsing `templates.schema` JSON into interactive HTML
- Offline-first IndexedDB storage with auto-sync via `PATCH /api/inspections/:id/results`
- `GET /api/inspections/:id` — single inspection with template schema
- `GET /api/inspections/:id/results` — current field values blob

### Phase C: Photo Uploads & Annotations
- Photo upload to R2 via `POST /api/inspections/:id/upload`
- Canvas annotation modal (circles, arrows) in form-renderer
- File retrieval via `GET /api/inspections/files/:key`

### Phase D: Report Delivery (Email)
- `POST /api/inspections/:id/complete` marks inspection done and triggers Resend email to client
- PDF export via print stylesheets (native browser `window.print()`, no Puppeteer)

### Phase E: Business & Monetization
- Digital agreements: `GET /api/inspections/:id/agreement`, `POST /api/inspections/:id/sign`
- E-signature stored in `inspection_agreements` (base64, IP, timestamp)
- Pay-to-unlock: `POST /api/inspections/:id/checkout` (Stripe or mock), `GET /api/inspections/:id/payment-success`
- Payment status gates report visibility via `inspections.paymentStatus`

### Phase F: AI Intelligence
- `POST /api/ai/comment-assist` — Gemini rewrites inspector notes into professional descriptions
- `POST /api/ai/auto-summary` — Gemini generates defect summary from inspection results

### Phase G: Public Booking
- `GET /api/public/inspectors` — list inspectors for tenant
- `GET /api/public/availability/:inspectorId` — weekly slots minus booked inspections
- `POST /api/public/book` — submit booking, creates draft inspection
- Availability managed via `availability` (weekly) + `availability_overrides` (date-specific) tables

### Infrastructure Refactoring
- Replaced custom JWT wrapper with Hono's built-in `jwt()` middleware
- Replaced `email-service.ts` wrapper with direct Resend SDK calls
- Separated databases (portal/core have independent D1 instances)
- Each app fully standalone; no shared packages

### Phase H: Agent CRM & Growth
- Agent Dashboard: `/agent-dashboard` + `GET /api/agent/my-reports` scoped by `referredByAgentId`
- Referral Tracking: `GET /api/agent/leaderboard` — groups inspections by agent (admin/owner only)
- Schema: `referredByAgentId` column in `inspections`; migration `migrations/0003_agent_crm.sql`

### Inspection Helpers
- `GET /api/inspections/inspectors` — list all users in tenant (inspector picker, admin/owner only)

### Phase I: Security, Scheduling & Team Management
- **Bot protection** — `src/lib/middleware/bot-protection.ts`
  - `blockHighThreatScore` blocks CF IPs with threat_score ≥ 50 on `POST /api/public/book`
  - Cloudflare Turnstile widget on `/book`; server-side `verifyTurnstile()` (skipped for dev/demo tenant)
  - `TURNSTILE_SITE_KEY` in `wrangler.toml`; `TURNSTILE_SECRET_KEY` in `.dev.vars`
- **Availability API** — `src/api/availability.ts`
  - `GET/PUT /api/availability` — list/replace weekly schedule
  - `GET/POST /api/availability/overrides` — list/add date-specific overrides
  - `DELETE /api/availability/overrides/:id`
- **Template CRUD** — added to `src/api/inspections.ts`
  - `GET/POST /api/inspections/templates`, `PUT/DELETE /api/inspections/templates/:id`
  - DELETE blocked with 409 if template is in use
- **Team invite & join** — `src/api/admin.ts` + `src/api/auth.ts`
  - `POST /api/admin/invite` — creates 7-day invite, sends Resend email (admin/owner only)
  - `POST /api/auth/join` — accepts invite, creates user, sets `inspector_token` cookie
- **Password change** — `POST /api/auth/change-password` (verifies current, enforces 8-char min)
- **Booking confirmation email** — Resend email to client after successful booking (non-blocking via `waitUntil`)
- **Login page + server-side dashboard auth** — `POST /api/auth/login` sets httpOnly cookie; dashboard routes redirect to `/login` if no valid JWT cookie

### Phase J: Google Calendar, Stripe Connect & Silo Mode

- **Google Calendar OAuth** — `src/api/calendar.ts`
  - `GET /api/calendar/connect` — redirect inspector to Google OAuth consent (cookie-guarded)
  - `GET /api/calendar/callback` — exchange code, fetch primary calendar ID, store `googleRefreshToken` + `googleCalendarId` in `users` table
  - `DELETE /api/calendar/disconnect` — clear stored tokens
  - `POST /api/calendar/sync` — pull next 30 days of Google Calendar events → insert `availabilityOverrides` for busy blocks
  - `createCalendarEvent()` export — called non-blocking from `bookings.ts` after successful booking via `waitUntil`
  - Schema: `google_refresh_token`, `google_calendar_id` columns added to `users` (migration `0004_calendar_connect.sql`)

- **Stripe Connect integration** — inspections route to tenant's Connect account
  - `POST /api/inspections/:id/checkout` — if tenant has `stripeConnectAccountId`, Stripe Checkout includes `transfer_data.destination` + 10% `application_fee_amount`
  - `POST /api/admin/connect` — machine-to-machine endpoint: `Authorization: Bearer {JWT_SECRET}` → update `tenants.stripeConnectAccountId` by subdomain; called by portal after Connect onboarding
  - Schema: `stripe_connect_account_id` column added to `tenants` (migration `0004_calendar_connect.sql`)

- **Silo mode (per-tenant isolated D1)** — `src/lib/db/silo.ts`
  - `D1HttpDatabase` class wraps Cloudflare D1 REST API, satisfies Drizzle's `D1Database` duck-type
  - Silo middleware in `index.ts`: officially mounted; reads `silo:{tenantId}` from `TENANT_CACHE` KV; if found, replaces `c.env.DB` with `D1HttpDatabase` instance for all downstream handlers
  - `POST /api/admin/silo` — machine-to-machine: writes `silo:{tenantId}` → `siloDbId` to `TENANT_CACHE` KV; called by portal sysadmin after provisioning

### Phase K: Tenant Tier System, Role Standardization & API Completeness

- **Role Standardization** — transitioned from generic `admin`/`office_staff` to industrial-grade `owner`, `admin`, `inspector`, and `agent` roles. 
  - `owner`: full workspace control (synchronized from Portal)
  - `admin`: project and team management
  - `inspector`: field data collection
  - `agent`: referral management and report access
- **Tenant Tier/Status Enforcement** — `src/lib/middleware/tier-guard.ts`
  - `requireActiveSubscription` applied to all `/api/*` routes: blocks non-GET mutations for `past_due`/`pending` tenants (HTTP 402); dev subdomain and standalone free+active tenants always bypass
  - `requireTierFeature(feature)` factory for gating `silo_mode` (enterprise only) and `stripe_connect` (pro+)
  - Tier constants: `free`, `pro`, `enterprise`; Status constants: `pending`, `trialing`, `active`, `past_due`, `suspended`
  - Design modelled on AWS Serverless SaaS Reference Architecture (tier-based API enforcement pattern)
  - Generalization: hardcoded `inspectorhub.com` URLs replaced with relative paths and configurable placeholders.
- **M2M Tier/Status Sync** — `POST /api/admin/tenant-status`
  - Portal pushes tier+status to core after every Stripe subscription lifecycle event
  - Endpoint validates `Authorization: Bearer {JWT_SECRET}`, updates D1, invalidates `tenant:{subdomain}` KV cache
  - JWT middleware regex updated: `admin/(connect|silo|tenant-status)` exempt from user JWT requirement
- **Portal Billing Sync** — `apps/portal/src/api/billing.ts`
  - `syncTenantStatusToCore()` helper calls core after `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
  - Stripe session metadata now includes `tier` for downstream webhook tier assignment
  - `STRIPE_PRICE_PRO` and `STRIPE_PRICE_ENTERPRISE` env vars for price-to-tier mapping
- **DELETE Inspection** — `DELETE /api/inspections/:id` (admin/owner only); scoped to tenant
- **Team Members API** — `GET /api/admin/members` returns members + pending invites (admin/owner only)
- **Agreement CRUD** — `GET/POST/PUT/DELETE /api/admin/agreements` with version bumping on update
- **Password Reset** — `POST /api/auth/forgot-password` + `POST /api/auth/reset-password`
  - KV-backed one-time tokens (`pw_reset:{uuid}` → userId, 1h TTL; no DB migration needed)
  - Resend email with reset link if `RESEND_API_KEY` + `APP_BASE_URL` configured; always returns 200
- **Agent Referral on Booking** — `?agent=<id>` URL param on `/book` page captured in Alpine data, sent to `POST /api/public/book`, stored as `referredByAgentId` on inspection
- **Dashboard Filtering** — client-side filtering by status, date range, and text search; clear button
- **Availability Overrides UI** — date picker + type selector + list management in dashboard
- **Testing** — 122 E2E tests passing (18 new tests covering all Phase K features)

### Phase L: Bug Fixes & API Completeness

- **Auth flow fix (standalone)** — `POST /api/auth/login` and `POST /api/auth/join` now return `token` in the JSON response body alongside setting the `inspector_token` httpOnly cookie. Login template stores it in `localStorage` so subsequent Bearer-authenticated dashboard API calls work without URL token injection.
- **Join redirect fix** — `/join` template redirected to `/tenant-dashboard` (portal route); corrected to `data.redirect || '/dashboard'` (core route).
- **Dashboard logout fix** — hardcoded `http://localhost:8787/login` replaced with relative `/login`; works in standalone and production deployments.
- **Calendar sync security** — `POST /api/calendar/sync` uniqueness check now filters by `inspectorId AND date` (previously filtered `date` only, risking false-positive matches across tenants/inspectors).
- **PATCH /api/inspections/:id** — new endpoint to update inspection metadata (`propertyAddress`, `clientName`, `clientEmail`, `date`, `inspectorId`, `price`, `status`). Validates status transitions against allowed values. Scoped to tenant.
- **Testing** — 133 E2E tests passing (+5 covering auth token response, PATCH metadata, and auth guard for PATCH).

---

## How to Run

```bash
cd apps/core
npm install
npm run db:migrate   # apply migrations locally
npm run dev          # http://localhost:8788
npm run css:watch    # compile Tailwind (run alongside dev)
```

Copy `.dev.vars.example` → `.dev.vars` and fill in secrets.

## Testing

```bash
npm run test:e2e     # Playwright E2E (requires dev server running)
```

See `docs/testing.md` for test structure and coverage.

### Phase O: PWA Support

- **Web App Manifest** — `public/manifest.json`
  - `display: standalone` — removes browser chrome when installed
  - `theme_color: #4f46e5` — matches indigo primary brand colour
  - `start_url: /dashboard` — opens directly to dashboard on launch
  - Icons: `favicon.png` (192 px) + `logo.png` (512 px, maskable)
  - Shortcut: Dashboard

- **Service Worker** — `public/sw.js`
  - **Static assets** (CSS/JS/images/manifest): stale-while-revalidate (cache-first, refresh in background)
  - **CDN assets** (Alpine.js, Google Fonts): cache-first, stored on first fetch
  - **HTML navigation**: network-first with cached-shell fallback for offline
  - **`/api/*`**: network-only — offline data handled by existing IndexedDB layer
  - Auto-activates via `skipWaiting()` + `clients.claim()` on install/activate
  - Cache versioned as `openinspection-v1`; old caches purged on activate

- **PWA Meta Tags** — added to both `MainLayout` and `BareLayout`
  - `<link rel="manifest">`, `theme-color`, `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-status-bar-style: black-translucent`
  - `apple-touch-icon` for iOS home screen icon
  - SW registered via inline script on page load (graceful no-op if SW not supported)

- **Inspector field form** (`/inspections/:id/form`) is now installable as a standalone PWA on iOS and Android, works offline after first visit using the existing IndexedDB sync layer.

- **Offline photo queue** — `form-renderer.tsx`
  - `pendingPhotoDb` helper: IDB store `oi_pending_photos` with `add / getAll / remove`
  - `handleFileUpload`: if offline, stores blob in IDB + shows local `dataUrl` preview with "QUEUED" badge; uploads immediately when online
  - `saveAnnotation`: same offline-queue pattern for annotated canvas blobs
  - `flushPendingPhotos()`: on reconnect (and on page load if online), iterates IDB queue, uploads each pending blob, replaces `pending:uuid` keys with real R2 keys in results
  - Photo thumbnails: `x-bind:src` uses `photo.dataUrl` for pending photos; annotate button disabled with tooltip while photo is pending
  - R2 photo GET responses (`/api/inspections/files/*`) now cached by service worker (cache-first) so previously-viewed photos load offline
