import type { AppEnv } from '../../types/hono';
import { logger } from '../../lib/logger';

/**
 * Sandbox-demo feature module.
 *
 * The sandbox deployment (sandbox.inspectorhub.io) is a public showcase.
 * `reset()` is dispatched from the Worker's `scheduled` handler when
 * `profile.demoResetCron` is set (sandbox profile only) so demo data
 * returns to a known-good state nightly.
 *
 * Today the actual reset is performed by `scripts/sandbox-seed.js`
 * (executed out-of-band against a deployed environment). Until the in-worker
 * reset lands, this is a stub that logs the trigger so cron wiring + the
 * profile gate are verifiable end-to-end.
 *
 * @see scripts/sandbox-seed.js — node-side reset implementation reference.
 */
export async function reset(_env: AppEnv): Promise<void> {
    // TODO(sandbox-reset): port `scripts/sandbox-seed.js` to run inside the
    // Worker via env.DB. Out of scope for the deployment-modes refactor;
    // tracked as a follow-up.
    logger.info('[cron:sandbox-demo] reset triggered (stub — no-op until in-worker reset lands)');
}

// Re-export the banner component so feature consumers import a single entry.
export { SandboxBanner } from '../../templates/components/sandbox-banner';
