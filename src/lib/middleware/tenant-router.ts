import { MiddlewareHandler } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { tenants } from '../db/schema';
import { HonoConfig } from '../../types/hono';

/**
 * Middleware to resolve the current tenant/workspace.
 * - In SaaS mode: Resolves via Host header (subdomain).
 * - In Standalone mode: Uses a hardcoded Global Workspace ID.
 */
export const tenantRouter: MiddlewareHandler<HonoConfig> = async (c, next) => {
    const url = new URL(c.req.url);
    const path = url.pathname;
    const host = c.req.header('host') || '';
    
    // Bypass for status checks and common static assets
    if (path === '/status' || path.startsWith('/static/') || path.includes('.')) {
        return next();
    }

    const db = drizzle(c.env.DB);
    let tenantId: string | null = null;
    let subdomain: string | null = null;

    // 1. Resolve Subdomain from Host
    // app.inspectorhub.io -> global (no tenant)
    // tenant1.inspectorhub.io -> tenant1
    const parts = host.split('.');
    if (parts.length >= 3) {
        subdomain = parts[0];
        // Skip common system subdomains
        if (subdomain === 'www' || subdomain === 'app' || subdomain === 'api' || subdomain === 'dev') {
            subdomain = null;
        }
    }

    // 2. Resolve Tenant ID
    if (c.env.APP_MODE === 'saas' && subdomain) {
        // SaaS Multi-tenant Mode
        const cacheKey = `tenant_by_subdomain:${subdomain}`;
        let cachedTenant = c.env.TENANT_CACHE ? await c.env.TENANT_CACHE.get(cacheKey, { type: 'json' }) : null;

        if (!cachedTenant) {
            const tenantMatch = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain)).get();
            if (tenantMatch) {
                cachedTenant = tenantMatch;
                if (c.env.TENANT_CACHE) {
                    c.executionCtx.waitUntil(c.env.TENANT_CACHE.put(cacheKey, JSON.stringify(tenantMatch), { expirationTtl: 3600 }));
                }
            }
        }

        if (cachedTenant) {
            tenantId = (cachedTenant as any).id;
            c.set('tenantId', tenantId!);
            c.set('requestedSubdomain', (cachedTenant as any).subdomain);
            c.set('tenantTier', (cachedTenant as any).tier || 'free');
            c.set('tenantStatus', (cachedTenant as any).status || 'active');
        }
    } else {
        // Standalone or Admin Mode (Single Workspace)
        tenantId = c.env.SINGLE_TENANT_ID || '00000000-0000-0000-0000-000000000000';
        c.set('tenantId', tenantId);

        const cacheKey = `global_tenant:${tenantId}`;
        let tenant = c.env.TENANT_CACHE ? await c.env.TENANT_CACHE.get(cacheKey, { type: 'json' }) : null;

        if (!tenant) {
            tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).get() || null;
            if (tenant && c.env.TENANT_CACHE) {
                c.executionCtx.waitUntil(c.env.TENANT_CACHE.put(cacheKey, JSON.stringify(tenant), { expirationTtl: 3600 }));
            }
        }

        if (tenant) {
            c.set('requestedSubdomain', (tenant as any).subdomain);
            c.set('tenantTier', (tenant as any).tier || 'free');
            c.set('tenantStatus', (tenant as any).status || 'active');
        }
    }

    // 3. Fallback / Setup Guard
    if (!c.get('tenantId') || !c.get('requestedSubdomain')) {
        const isSetupPath = path === '/setup' || path === '/api/auth/setup' || path === '/status' || path.startsWith('/api/integration');
        
        if (!isSetupPath && (path === '/' || path.startsWith('/dashboard') || path === '/book')) {
            // If in SaaS mode and no subdomain, it's the landing page (which handled by index.ts)
            // But if it's a dashboard path, we need a tenant.
            if (c.env.APP_MODE === 'saas' && !subdomain) {
                return next(); // Let index.ts redirect to landing
            }
            return c.redirect('/setup');
        }

        if (!isSetupPath && path.startsWith('/api')) {
            return c.text('Tenant not found or system not initialized.', 503);
        }
    }

    return next();
};
