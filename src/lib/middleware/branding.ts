import { MiddlewareHandler } from 'hono';
import { BrandingConfig } from '../../types/auth';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { tenantConfigs, tenants } from '../db/schema';
import { HonoConfig } from '../../types/hono';

/**
 * Middleware to resolve and inject branding configuration for the current tenant.
 * Uses KV for caching and D1 as a fallback.
 */
export const brandingMiddleware: MiddlewareHandler<HonoConfig> = async (c, next) => {
    const host = c.req.header('host') || '';
    const subdomain = host.split('.')[0];
    
    // Default system branding (fallback)
    const defaultBranding: BrandingConfig = {
        siteName: c.env.APP_NAME || 'OpenInspection',
        primaryColor: c.env.PRIMARY_COLOR || '#6366f1',
        logoUrl: null,
        supportEmail: c.env.SENDER_EMAIL || 'support@openinspection.org',
        billingUrl: '/settings',
        gaMeasurementId: c.env.GA_MEASUREMENT_ID || null
    };

    // Global routes use defaults
    if (!subdomain || subdomain === 'www' || subdomain === 'app') {
        c.set('branding', defaultBranding);
        return await next();
    }

    const cacheKey = `branding:${subdomain}`;
    const cached = await c.env.TENANT_CACHE?.get(cacheKey);
    
    if (cached) {
        try {
            c.set('branding', JSON.parse(cached));
            return await next();
        } catch (e) {
            console.error('[branding] Cache parse failed:', e);
        }
    }

    const db = drizzle(c.env.DB);
    try {
        const config = await db.select({
            siteName: tenantConfigs.siteName,
            primaryColor: tenantConfigs.primaryColor,
            logoUrl: tenantConfigs.logoUrl,
            supportEmail: tenantConfigs.supportEmail,
            billingUrl: tenantConfigs.billingUrl,
            gaMeasurementId: tenantConfigs.gaMeasurementId
        })
        .from(tenantConfigs)
        .innerJoin(tenants, eq(tenants.id, tenantConfigs.tenantId))
        .where(eq(tenants.subdomain, subdomain))
        .get();

        const branding: BrandingConfig = config ? {
            siteName: config.siteName || defaultBranding.siteName,
            primaryColor: config.primaryColor || defaultBranding.primaryColor,
            logoUrl: config.logoUrl,
            supportEmail: config.supportEmail || defaultBranding.supportEmail,
            billingUrl: config.billingUrl || defaultBranding.billingUrl,
            gaMeasurementId: config.gaMeasurementId || defaultBranding.gaMeasurementId
        } : defaultBranding;
        
        c.set('branding', branding);
        
        if (config && c.env.TENANT_CACHE) {
            c.executionCtx.waitUntil(c.env.TENANT_CACHE.put(cacheKey, JSON.stringify(branding), { expirationTtl: 3600 }));
        }
    } catch (e) {
        console.error('[branding] DB lookup failed:', e);
        c.set('branding', defaultBranding);
    }

    await next();
};
