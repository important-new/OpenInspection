// apps/openinspection/tests/portal-isolation.spec.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

describe('SaaS-Portal isolation', () => {
  // Confinement: PORTAL_API_URL / PORTAL_SERVICE may appear ONLY in these files.
  const ALLOWED = [
    'server/types/hono.ts',                 // env binding type declarations
    'server/lib/deployment-profile.ts',     // env -> capability seam
    'server/lib/middleware/di.ts',          // composition point #3: provider + OutboxService wiring
    'server/scheduled.ts',                  // the one PORTAL_SERVICE drain guard
    'server/portal/',                       // the integration module itself
    'workers/app.ts',                       // entry-level APP_MODE 404 guard
  ];
  it('PORTAL_API_URL / PORTAL_SERVICE appear only in allowed files', () => {
    const hits = execSync(
      `git grep -lE "PORTAL_API_URL|PORTAL_SERVICE" -- server workers || true`,
      { cwd: __dirname + '/..', encoding: 'utf8' },
    ).split('\n').filter(Boolean);
    const stray = hits.filter(f => !ALLOWED.some(a => f.startsWith(a)));
    expect(stray, `stray PORTAL_* references: ${stray.join(', ')}`).toEqual([]);
  });

  it('integration.routes + outbox.service are wired only via integration.module (not imported raw)', () => {
    // NOTE: portal.provider is intentionally EXCLUDED — di.ts is wiring point #3
    // and legitimately imports PortalProvider directly. Only the route/outbox
    // files must funnel through integration.module.
    const hits = execSync(
      `git grep -lE "portal/integration.routes|portal/outbox.service" -- server || true`,
      { cwd: __dirname + '/..', encoding: 'utf8' },
    ).split('\n').filter(Boolean);
    const stray = hits.filter(
      f => !f.startsWith('server/portal/') && f !== 'server/lib/middleware/di.ts',
    );
    expect(stray, `raw integration.routes/outbox imports outside server/portal/: ${stray.join(', ')}`).toEqual([]);
  });
});
