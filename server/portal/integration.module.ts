// Single composition seam for the SaaS-Portal integration. The rest of the
// codebase touches portal ONLY via this module's two exports + the
// IntegrationProvider / OutboxService selection in lib/middleware/di.ts.
// Standalone never reaches these in normal operation. A planned worker-entry
// guard (workers/app.ts) will 404 /api/integration/* unless APP_MODE=saas.
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';
import integrationRoutes from './integration.routes';
import { flushOutboxOnce } from './outbox.service';
import { signM2mHeader } from '../lib/m2m-auth';

/** Minimal env shape the outbox drain needs — satisfied by both AppEnv and
 *  ScheduledEnv. `PORTAL_SERVICE` is the portal Service Binding (saas only). */
interface PortalDrainEnv {
    DB: D1Database;
    PORTAL_SERVICE?: Fetcher;
}

/** Mount the portal->core M2M integration routes on the API app. */
export function registerPortalIntegration(app: OpenAPIHono<HonoConfig>): void {
    app.route('/api/integration', integrationRoutes);
}

/** Drain the core->portal user-sync outbox via the PORTAL_SERVICE binding.
 *  Call only when env.PORTAL_SERVICE is bound (saas). */
export async function drainPortalOutbox(env: PortalDrainEnv): Promise<void> {
    const m2m = await signM2mHeader(env as unknown as Record<string, string | undefined>);
    await flushOutboxOnce(env.DB, env.PORTAL_SERVICE!, m2m, 50);
}
