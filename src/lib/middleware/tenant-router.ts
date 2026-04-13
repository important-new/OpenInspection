import { MiddlewareHandler } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { tenants } from '../db/schema';
import { HonoConfig } from '../../types/hono';

/**
 * Middleware to resolve the current tenant/workspace.
 */
export const tenantRouter: MiddlewareHandler<HonoConfig> = async (c, next) => {
    const url = new URL(c.req.url);
    const path = url.pathname;
    const hostWithPort = c.req.header('host') || '';
    const host = hostWithPort.split(':')[0];
    
    if (path === '/status' || path.startsWith('/static/') || path.includes('.')) {
        return next();
    }

    const db = drizzle(c.env.DB);
    let tenantId: string | null = null;
    let subdomain: string | null = null;

    // Resolve Subdomain from Host OR Custom Header (for local testing)
    const parts = host.split('.');
    const isLocalhost = parts.length === 2 && (parts[1] === 'localhost' || parts[1] === 'local');
    
    if (parts.length >= 3 || isLocalhost) {
        subdomain = parts[0];
        if (subdomain === 'www' || subdomain === 'app' || subdomain === 'api' || subdomain === 'dev') {
            subdomain = null;
        }
    }

    // Fallback to custom header for easier local testing
    const headerSubdomain = c.req.header('x-tenant-subdomain');
    if (headerSubdomain) {
        subdomain = headerSubdomain;
    }

    // DEBUG LOGGING
    console.log(`[TenantRouter] Request: ${c.req.method} ${path}`);
    console.log(`[TenantRouter] Host: ${host}, Subdomain extracted: ${subdomain}, Mode: ${c.env.APP_MODE}`);

    if (c.env.APP_MODE === 'saas' && subdomain) {
        const cacheKey = `tenant:${subdomain}`;
        let cachedTenant = c.env.TENANT_CACHE ? await c.env.TENANT_CACHE.get(cacheKey, { type: 'json' }) : null;

        if (!cachedTenant) {
            const tenantMatch = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain)).get();
            console.log(`[TenantRouter] DB Lookup for ${subdomain}:`, tenantMatch ? 'FOUND' : 'NOT FOUND');
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
            c.set('resolvedTenantId', tenantId!);
            c.set('requestedSubdomain', (cachedTenant as any).subdomain);
            c.set('tenantTier', (cachedTenant as any).tier || 'free');
            c.set('tenantStatus', (cachedTenant as any).status || 'active');
        }
    } else {
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

    if (!c.get('tenantId') || !c.get('requestedSubdomain')) {
        const isSetupPath = path === '/setup' || path === '/api/auth/setup' || path === '/status' || path.startsWith('/api/integration');
        if (!isSetupPath && path.startsWith('/api')) {
            console.log(`[TenantRouter] Resolution failed for ${path}. tenantId: ${c.get('tenantId')}, subdomain: ${c.get('requestedSubdomain')}`);
            return c.text('Tenant not found or system not initialized.', 503);
        }
    }

    return next();
};
