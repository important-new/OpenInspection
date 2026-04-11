import { MiddlewareHandler } from 'hono';
import { HonoConfig } from '../../types/hono';

/**
 * Tenant tier definitions.
 */
export const TIERS = {
    free: 'free',
    pro: 'pro',
    enterprise: 'enterprise',
} as const;

/**
 * Tenant status lifecycle in Standalone mode.
 */
export const STATUS = {
    pending: 'pending',
    active: 'active',
} as const;


/** Feature gating definitions */
export const TIER_FEATURES: Record<string, string[]> = {
    silo_mode: [TIERS.free, TIERS.pro, TIERS.enterprise],
    stripe_connect: [TIERS.free, TIERS.pro, TIERS.enterprise],
};

/**
 * Middleware: block non-GET API mutations when tenant subscription is not active.
 */
export const requireActiveSubscription: MiddlewareHandler<HonoConfig> = async (c, next) => {
    const subdomain = c.get('requestedSubdomain');
    if (!subdomain || subdomain === 'dev') return next();
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') return next();

    const status = c.get('tenantStatus') || STATUS.active;
    const tier = c.get('tenantTier') || TIERS.free;

    if (tier === TIERS.free && status === STATUS.active) return next();
    if (status === STATUS.active) return next();

    if (status === STATUS.pending) {
        return c.json({
            success: false,
            error: {
                message: 'Your workspace is not yet activated.',
                code: 'billing_pending',
                status,
                billingUrl: c.env.BILLING_URL || '/setup',
            }
        }, 402);
    }

    return next();
};


/**
 * Middleware factory: require a specific feature gated by tenant tier.
 */
export const requireTierFeature = (feature: string): MiddlewareHandler<HonoConfig> => async (c, next) => {
    const subdomain = c.get('requestedSubdomain');
    if (!subdomain || subdomain === 'dev') return next();

    const tier = c.get('tenantTier') || TIERS.free;
    const status = c.get('tenantStatus') || STATUS.active;

    if (tier === TIERS.free && status === STATUS.active) return next();

    const allowed = TIER_FEATURES[feature];
    if (!allowed || allowed.includes(tier)) return next();

    return c.json({
        success: false,
        error: {
            message: `This feature requires a ${allowed.join(' or ')} subscription tier.`,
            code: 'feature_locked',
            currentTier: tier,
            requiredTiers: allowed,
            upgradeUrl: c.env.BILLING_URL || '/pricing',
        }
    }, 403);
};
