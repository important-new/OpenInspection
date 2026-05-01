import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';

const widgetRoutes = new OpenAPIHono<HonoConfig>();

const recordEventRoute = createRoute({
    method: 'post',
    path: '/event',
    tags: ['Widget'],
    summary: 'Record an embeddable widget event (public, no JWT)',
    middleware: [] as const,
    request: {
        body: {
            content: {
                'application/json': {
                    schema: z.object({
                        event: z.enum(['view', 'submit', 'success', 'error']),
                        metadata: z.record(z.string(), z.unknown()).optional(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.object({ success: z.literal(true) }),
                },
            },
            description: 'Recorded',
        },
    },
});

widgetRoutes.openapi(recordEventRoute, async (c) => {
    const tenantId = c.get('resolvedTenantId') || c.get('tenantId');
    if (!tenantId) {
        return c.json({ success: true }, 200);
    }
    const origin = c.req.header('origin');
    const ok = await c.var.services.widget.isOriginAllowed(tenantId, origin ?? null);
    if (!ok) {
        // Silently drop unauthorised events (no signal for attackers, no DB noise)
        return c.json({ success: true }, 200);
    }
    const { event, metadata } = c.req.valid('json');
    await c.var.services.widget.recordEvent(tenantId, event, { ...(metadata ?? {}), origin });
    return c.json({ success: true }, 200);
});

export default widgetRoutes;
