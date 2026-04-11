import type { Context, Next } from 'hono';

interface RateLimitOptions {
    limit: number;
    windowSeconds: number;
    keyPrefix: string;
}

/**
 * KV-backed fixed-window rate limiter.
 * Uses TENANT_CACHE KV: key = `rl:{prefix}:{ip}:{window}`, value = count.
 *
 * Note: KV has eventual consistency so counts may slightly over- or under-count
 * under extreme concurrency. This is acceptable for abuse prevention.
 */
export function rateLimit(options: RateLimitOptions) {
    const { limit, windowSeconds, keyPrefix } = options;

    return async (c: Context<{ Bindings: { TENANT_CACHE: KVNamespace } }>, next: Next) => {
        const kv = c.env.TENANT_CACHE;
        if (!kv) return next(); // skip if KV not configured

        const ip =
            c.req.header('CF-Connecting-IP') ||
            c.req.header('X-Forwarded-For')?.split(',')[0].trim() ||
            'unknown';

        const window = Math.floor(Date.now() / (windowSeconds * 1000));
        const key = `rl:${keyPrefix}:${ip}:${window}`;

        const raw = await kv.get(key);
        const count = raw ? parseInt(raw, 10) : 0;

        if (count >= limit) {
            return c.json(
                { error: 'Too many requests. Please try again shortly.' },
                429,
                { 'Retry-After': String(windowSeconds) }
            );
        }

        // Increment asynchronously ??fire-and-forget with TTL slightly beyond window
        c.executionCtx.waitUntil(
            kv.put(key, String(count + 1), { expirationTtl: windowSeconds + 5 }).catch(() => {})
        );

        return next();
    };
}
