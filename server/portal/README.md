# Portal Integration (SaaS only)

Optional integration with the InspectorHub SaaS control plane. **Active only when
`APP_MODE=saas`** (declared in `wrangler.saas.jsonc`, which binds `PORTAL_SERVICE`).
The worker entry (`workers/app.ts`) returns 404 for `/api/integration/*` otherwise,
and the outbox drains only when `PORTAL_SERVICE` is bound. A self-host build
(default `wrangler.jsonc`) executes none of this directory.

Core code depends only on abstractions — `IntegrationProvider`
(`StandaloneProvider` is the self-host impl) and `UserSyncOutbox`
(`server/lib/integration/user-sync.ts`). The concrete classes here are wired in at
a single composition point, `server/lib/middleware/di.ts`, and only when the
`PORTAL_SERVICE` binding is present.

To produce a portal-free build: delete this directory, the
`registerPortalIntegration(app)` call in `server/index.ts`, the
`drainPortalOutbox` call in `server/scheduled.ts`, the `PortalProvider` +
`OutboxService` branches in `server/lib/middleware/di.ts` (fall back to
`StandaloneProvider` + leave `outbox` undefined), and the `/api/integration/*`
guard in `workers/app.ts`.

Detailed integration docs live in the super-project `docs/saas-ops/`.

| File | Purpose |
|---|---|
| `integration.module.ts` | The seam: `registerPortalIntegration` + `drainPortalOutbox` |
| `integration.routes.ts` | portal→core M2M routes (tenant sync, SSO handoff, export, purge) |
| `outbox.service.ts` | core→portal async event sync (implements `UserSyncOutbox`) |
| `portal.provider.ts` | `IntegrationProvider` impl for SaaS |
| `service-binding-guard.ts` | `x-portal-m2m` HMAC guard for the M2M routes |
