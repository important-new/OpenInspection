import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';
import { SlugAvailabilityResponseSchema } from '../lib/validations/profile.schema';

/**
 * Booking #7 Sprint A — public slug-availability endpoint.
 *
 * Mounted at `/api/public/check/slug` so it lands inside the existing
 * `/api/public/*` allowlist in the JWT middleware (no auth required). The
 * tenant is resolved from subdomain by `tenantRouter`; if it can't resolve we
 * return `{ available:false, reason:'invalid' }` rather than a 5xx so the
 * client UI can surface a friendly message.
 *
 * The query param is intentionally permissive (1..64 chars) — the canonical
 * slug rules are enforced by `UserService.checkSlug` via the reservations
 * lookup and (in the dashboard UI) by `SlugSchema` before the request leaves
 * the browser.
 */
const app = new OpenAPIHono<HonoConfig>();

const checkSlugRoute = createRoute({
    method: 'get',
    path: '/check/slug',
    tags: ['Public'],
    summary: 'Check whether an inspector booking slug is available',
    request: {
        query: z.object({
            value: z.string().min(1).max(64),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(true),
                        data: SlugAvailabilityResponseSchema,
                    }),
                },
            },
            description: 'Availability check result',
        },
    },
});

app.openapi(checkSlugRoute, async (c) => {
    const { value } = c.req.valid('query');
    const tenantId = c.get('resolvedTenantId') || c.get('tenantId');
    if (!tenantId) {
        return c.json({ success: true as const, data: { available: false, reason: 'invalid' as const } }, 200);
    }
    const result = await c.var.services.userService.checkSlug(tenantId, value);
    return c.json({ success: true as const, data: result }, 200);
});

export default app;
