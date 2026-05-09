import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';
import { SlugAvailabilityResponseSchema } from '../lib/validations/profile.schema';
import { createApiResponseSchema } from '../lib/validations/shared.schema';

/**
 * Booking #7 Sprint A — public slug-availability endpoint.
 *
 * Mounted at `/api/public/check/slug` inside the `/api/public/*` JWT
 * allowlist. tenantId resolves from subdomain via `tenantRouter`; an
 * unresolved tenant returns `{ available:false, reason:'invalid' }` so the
 * client can surface a friendly message instead of a 5xx.
 *
 * The query param is permissive (1..64 chars); canonical slug rules live in
 * `UserService.checkSlug` (reservations + uniqueness) and `SlugSchema`
 * (client-side format check).
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
                    schema: createApiResponseSchema(SlugAvailabilityResponseSchema),
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
