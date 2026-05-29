import type { MiddlewareHandler } from 'hono';
import type { HonoConfig } from '../../types/hono';
import { logger } from '../../lib/logger';
import { resolveByFixedTenant } from './resolve-by-fixed-tenant';
import { resolveByPathParam } from './resolve-by-path-param';

/**
 * Tenant resolution middleware.
 *
 * Reads `c.var.profile` (injected by DI middleware) to pick the
 * resolution strategy:
 *
 *   - profile.fixedTenantId       → resolveByFixedTenant   (standalone)
 *   - everything else (saas)      → leave unset; JWT mw fills it
 *
 * Path-param resolution runs first regardless of mode, so public
 * routes like `/book/:tenant/:slug` work uniformly across all
 * deploys. Subdomain-based resolution was retired with the
 * silo-deconvergence plan (2026-05-29) — silo + shared now share
 * the same path/JWT lookup; vanity subdomains, if any, are bound
 * by ops at the Cloudflare DNS + Worker-route layer and the tenant
 * row is identified by path or JWT inside the Worker either way.
 */
export const tenantRouter: MiddlewareHandler<HonoConfig> = async (c, next) => {
    const url = new URL(c.req.url);
    const path = url.pathname;

    if (path === '/status') return next();

    // Try path-param resolution first. This makes /book/:tenant/:slug
    // and similar public routes work uniformly across all deploy
    // modes.
    const pathParamResolved = await resolveByPathParam(c, path);
    if (pathParamResolved) return next();

    const profile = c.var.profile;

    if (profile.fixedTenantId) {
        await resolveByFixedTenant(c, profile.fixedTenantId);
    }
    // saas paths: leave tenant unresolved. JWT middleware downstream
    // sets c.set('tenantId', ...) from the verified token's claim.

    if (!c.get('tenantId') || !c.get('requestedSubdomain')) {
        const isBypassPath = path === '/setup' || path === '/login'
            || path === '/api/auth/setup' || path === '/api/auth/login'
            || path === '/status' || path.startsWith('/api/integration')
            || path === '/api/agent-signup' || path === '/api/agents/accept'
            || path === '/api/concierge/confirm'
            || path.startsWith('/api/public/')
            // M2M admin endpoints carry tenantId in the request body,
            // not in the URL/JWT. They authenticate via Bearer M2M
            // secret instead of tenant routing. Bypass tenant
            // resolution to avoid 503 when the M2M caller wants to
            // act on a tenant other than the current host's tenant.
            || path.startsWith('/api/admin/');
        if (!isBypassPath && path.startsWith('/api')) {
            logger.info('[TenantRouter] Tenant resolution failed', {
                path,
                tenantId: c.get('tenantId'),
                subdomain: c.get('requestedSubdomain'),
            });
            return c.text('Tenant not found or system not initialized.', 503);
        }
    }

    return next();
};
