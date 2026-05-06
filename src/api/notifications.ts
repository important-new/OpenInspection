import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';
import {
    ListNotificationsQuerySchema,
    ListNotificationsResponseSchema,
    UnreadCountResponseSchema,
    MarkReadSchema,
} from '../lib/validations/notification.schema';
import { Errors } from '../lib/errors';
import type { ListOptions } from '../services/notification.service';

const notificationsRoutes = new OpenAPIHono<HonoConfig>();

/**
 * Convert a service-layer notification row to the API DTO.
 * Date fields → ISO strings; metadata is preserved as-is (object or null).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dto(row: any) {
    return {
        id:         row.id as string,
        type:       row.type as string,
        title:      row.title as string,
        body:       (row.body ?? null) as string | null,
        entityType: (row.entityType ?? null) as string | null,
        entityId:   (row.entityId ?? null) as string | null,
        metadata:   (row.metadata ?? null) as Record<string, unknown> | null,
        readAt:     row.readAt ? (row.readAt as Date).toISOString() : null,
        archivedAt: row.archivedAt ? (row.archivedAt as Date).toISOString() : null,
        createdAt:  (row.createdAt as Date).toISOString(),
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireUserId(c: any): string {
    const user = c.get('user');
    const sub = user?.sub as string | undefined;
    if (!sub) throw Errors.Unauthorized();
    return sub;
}

const OkResponseSchema = z.object({
    success: z.literal(true),
    data: z.object({ ok: z.literal(true) }),
});

// GET / — list notifications for current user
const listRoute = createRoute({
    method: 'get',
    path: '/',
    tags: ['Notifications'],
    summary: 'List notifications for current user',
    request: { query: ListNotificationsQuerySchema },
    responses: {
        200: {
            content: { 'application/json': { schema: ListNotificationsResponseSchema } },
            description: 'OK',
        },
    },
    security: [{ bearerAuth: [] }],
});
notificationsRoutes.openapi(listRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const userId   = requireUserId(c);
    const q = c.req.valid('query');
    const opts: ListOptions = {
        ...(q.unread === '1' ? { unread: true } : {}),
        ...(q.includeArchived === '1' ? { includeArchived: true } : {}),
        ...(q.limit ? { limit: q.limit } : {}),
        ...(q.cursor ? { cursor: q.cursor } : {}),
    };
    const result = await c.var.services.notification.list(tenantId, userId, opts);
    return c.json({
        success: true as const,
        data: { items: result.items.map(dto), nextCursor: result.nextCursor },
    }, 200);
});

// GET /unread-count
const unreadCountRoute = createRoute({
    method: 'get',
    path: '/unread-count',
    tags: ['Notifications'],
    summary: 'Count unread notifications for current user',
    responses: {
        200: {
            content: { 'application/json': { schema: UnreadCountResponseSchema } },
            description: 'OK',
        },
    },
    security: [{ bearerAuth: [] }],
});
notificationsRoutes.openapi(unreadCountRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const userId   = requireUserId(c);
    const count = await c.var.services.notification.unreadCount(tenantId, userId);
    return c.json({ success: true as const, data: { count } }, 200);
});

// POST /mark-read
const markReadRoute = createRoute({
    method: 'post',
    path: '/mark-read',
    tags: ['Notifications'],
    summary: 'Mark a list of notifications as read',
    request: { body: { content: { 'application/json': { schema: MarkReadSchema } } } },
    responses: {
        200: {
            content: { 'application/json': { schema: OkResponseSchema } },
            description: 'OK',
        },
    },
    security: [{ bearerAuth: [] }],
});
notificationsRoutes.openapi(markReadRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const userId   = requireUserId(c);
    const { ids } = c.req.valid('json');
    await c.var.services.notification.markRead(tenantId, userId, ids);
    return c.json({ success: true as const, data: { ok: true as const } }, 200);
});

// POST /mark-all-read
const markAllRoute = createRoute({
    method: 'post',
    path: '/mark-all-read',
    tags: ['Notifications'],
    summary: 'Mark every unread notification as read',
    responses: {
        200: {
            content: { 'application/json': { schema: OkResponseSchema } },
            description: 'OK',
        },
    },
    security: [{ bearerAuth: [] }],
});
notificationsRoutes.openapi(markAllRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const userId   = requireUserId(c);
    await c.var.services.notification.markAllRead(tenantId, userId);
    return c.json({ success: true as const, data: { ok: true as const } }, 200);
});

// DELETE /{id} — archive (soft-delete)
const archiveRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    tags: ['Notifications'],
    summary: 'Archive a notification (soft-delete from inbox)',
    request: { params: z.object({ id: z.string().min(1) }) },
    responses: {
        200: {
            content: { 'application/json': { schema: OkResponseSchema } },
            description: 'OK',
        },
    },
    security: [{ bearerAuth: [] }],
});
notificationsRoutes.openapi(archiveRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const userId   = requireUserId(c);
    const { id } = c.req.valid('param');
    await c.var.services.notification.archive(tenantId, userId, id);
    return c.json({ success: true as const, data: { ok: true as const } }, 200);
});

export default notificationsRoutes;
