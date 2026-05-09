import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';
import { ErrorCode, Errors } from '../lib/errors';
import { SetSlugRequestSchema } from '../lib/validations/profile.schema';
import { createApiResponseSchema } from '../lib/validations/shared.schema';

/**
 * Booking #7 Sprint A — authenticated profile endpoint mounted at
 * `/api/profile/*`. JWT middleware populates tenantId/userId; availability
 * is re-checked inside the handler to close the optimistic-UI race.
 */
const app = new OpenAPIHono<HonoConfig>();

const SlugConflictResponseSchema = z.object({
    success: z.literal(false),
    error: z.object({
        message: z.string(),
        code: z.string(),
        details: z.object({ suggestions: z.array(z.string()).optional() }).optional(),
    }),
});

const setSlugRoute = createRoute({
    method: 'post',
    path: '/slug',
    tags: ['Profile'],
    summary: 'Set the current user’s booking slug',
    request: {
        body: {
            content: {
                'application/json': { schema: SetSlugRequestSchema },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: createApiResponseSchema(z.object({ slug: z.string() })),
                },
            },
            description: 'Slug saved',
        },
        409: {
            content: {
                'application/json': { schema: SlugConflictResponseSchema },
            },
            description: 'Slug conflict',
        },
    },
});

app.openapi(setSlugRoute, async (c) => {
    const userId = c.get('user')?.sub;
    const tenantId = c.get('tenantId');
    if (!userId || !tenantId) throw Errors.Unauthorized();

    const { slug } = c.req.valid('json');
    const userService = c.var.services.userService;
    const check = await userService.checkSlug(tenantId, slug, userId);
    if (!check.available) {
        const message = check.reason === 'reserved'
            ? 'That slug is reserved. Please choose another.'
            : 'That slug is already taken.';
        return c.json(
            {
                success: false as const,
                error: {
                    message,
                    code: ErrorCode.CONFLICT,
                    details: { suggestions: check.suggestions ?? [] },
                },
            },
            409,
        );
    }
    await userService.setSlug(userId, tenantId, slug);
    return c.json({ success: true as const, data: { slug } }, 200);
});

export default app;
