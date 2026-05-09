import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';
import { ErrorCode, Errors } from '../lib/errors';
import { SetSlugRequestSchema } from '../lib/validations/profile.schema';

/**
 * Booking #7 Sprint A — authenticated profile endpoint.
 *
 * Mounted under `/api/profile/*`. The global JWT middleware in `index.ts`
 * already covers `/api/*` so `tenantId` and `userId` will be populated by the
 * time we get here. We re-validate availability inside the handler so a
 * concurrent claim cannot race past the UI's optimistic check.
 */
const app = new OpenAPIHono<HonoConfig>();

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
                    schema: z.object({
                        success: z.literal(true),
                        data: z.object({ slug: z.string() }),
                    }),
                },
            },
            description: 'Slug saved',
        },
        409: {
            content: {
                'application/json': {
                    schema: z.object({
                        success: z.literal(false),
                        error: z.object({
                            message: z.string(),
                            code: z.string(),
                            details: z
                                .object({ suggestions: z.array(z.string()).optional() })
                                .optional(),
                        }),
                    }),
                },
            },
            description: 'Slug conflict',
        },
    },
});

app.openapi(setSlugRoute, async (c) => {
    const user = c.get('user');
    const tenantId = c.get('tenantId');
    const userId = user?.sub;
    if (!userId || !tenantId) throw Errors.Unauthorized();

    const { slug } = c.req.valid('json');
    const userService = c.var.services.userService;
    const check = await userService.checkSlug(tenantId, slug, userId);
    if (!check.available) {
        return c.json(
            {
                success: false as const,
                error: {
                    message: check.reason === 'reserved'
                        ? 'That slug is reserved. Please choose another.'
                        : 'That slug is already taken.',
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
