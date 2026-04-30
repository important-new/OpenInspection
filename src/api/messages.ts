import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';
import { requireRole } from '../lib/middleware/rbac';

const messageRoutes = new OpenAPIHono<HonoConfig>();

const AttachmentSchema = z.object({
    id: z.string(),
    key: z.string(),
    name: z.string(),
    size: z.number(),
    type: z.string(),
    uploadedAt: z.number(),
});

// GET /api/messages/inspections/{inspectionId} — list inspector view
const listRoute = createRoute({
    method: 'get',
    path: '/inspections/{inspectionId}',
    tags: ['Messages'],
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    request: { params: z.object({ inspectionId: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.object({
            success: z.boolean(),
            data: z.object({ messages: z.array(z.any()), token: z.string().nullable() }),
        }) } }, description: 'OK' },
        401: { description: 'Unauthorized' },
    },
});

messageRoutes.openapi(listRoute, async (c) => {
    const { inspectionId } = c.req.valid('param');
    const tenantId = c.get('tenantId');
    const svc = c.var.services.message;
    const [messages, token] = await Promise.all([
        svc.listForInspection(inspectionId, tenantId),
        svc.getOrCreateToken(inspectionId, tenantId),
    ]);
    // Mark all client messages read on inspector view.
    await svc.markAllReadForRole(inspectionId, tenantId, 'client');
    return c.json({ success: true, data: { messages, token } }, 200);
});

// POST /api/messages/inspections/{inspectionId} — send message as inspector
const sendRoute = createRoute({
    method: 'post',
    path: '/inspections/{inspectionId}',
    tags: ['Messages'],
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    request: {
        params: z.object({ inspectionId: z.string() }),
        body: { content: { 'application/json': { schema: z.object({
            body: z.string().min(1).max(5000),
            attachments: z.array(AttachmentSchema).max(5).optional(),
        }) } } },
    },
    responses: {
        201: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Created' },
        401: { description: 'Unauthorized' },
    },
});

messageRoutes.openapi(sendRoute, async (c) => {
    const { inspectionId } = c.req.valid('param');
    const tenantId = c.get('tenantId');
    const { body, attachments } = c.req.valid('json');
    const jwtUser = c.get('user');
    const svc = c.var.services.message;
    const row = await svc.createMessage({
        tenantId,
        inspectionId,
        fromRole: 'inspector',
        fromName: (jwtUser as { name?: string } | undefined)?.name ?? null,
        body,
        attachments: attachments ?? [],
    });
    // Email notification will be wired in T22; placeholder no-op now.
    return c.json({ success: true, data: row }, 201);
});

// GET /api/messages/unread-count — sidebar badge
const unreadRoute = createRoute({
    method: 'get', path: '/unread-count',
    tags: ['Messages'],
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    responses: {
        200: { content: { 'application/json': { schema: z.object({
            success: z.boolean(),
            data: z.object({ count: z.number() }),
        }) } }, description: 'OK' },
        401: { description: 'Unauthorized' },
    },
});

messageRoutes.openapi(unreadRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const count = await c.var.services.message.unreadCountForTenant(tenantId);
    return c.json({ success: true, data: { count } }, 200);
});

export default messageRoutes;
