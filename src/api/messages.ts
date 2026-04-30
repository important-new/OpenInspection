import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';
import { requireRole } from '../lib/middleware/rbac';
import { Errors } from '../lib/errors';
import { detectMime } from '../lib/file-validation';

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
    // T22: notify client
    try {
        await c.var.services.email.sendMessageNotification('client', inspectionId, row, {
            db: c.env.DB, kv: c.env.TENANT_CACHE, baseUrl: c.env.APP_BASE_URL || `https://${c.req.header('host') ?? ''}`,
        });
    } catch { /* silent */ }
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

// ── T20: public client routes (no JWT, token-based) ─────────────────────────────

const publicListRoute = createRoute({
    method: 'get',
    path: '/public/{token}',
    tags: ['Messages'],
    request: { params: z.object({ token: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.object({
            success: z.boolean(),
            data: z.object({ messages: z.array(z.any()), inspection: z.any() }),
        }) } }, description: 'OK' },
        404: { description: 'Not found' },
    },
});

messageRoutes.openapi(publicListRoute, async (c) => {
    const { token } = c.req.valid('param');
    const svc = c.var.services.message;
    const insp = await svc.resolveByToken(token);
    if (!insp) throw Errors.NotFound('Conversation not found');
    const messages = await svc.listForInspection(insp.id, insp.tenantId);
    // Mark all inspector messages read on client view.
    await svc.markAllReadForRole(insp.id, insp.tenantId, 'inspector');
    return c.json({ success: true, data: { messages, inspection: {
        id: insp.id, propertyAddress: insp.propertyAddress, clientName: insp.clientName, date: insp.date,
    } } }, 200);
});

const publicSendRoute = createRoute({
    method: 'post',
    path: '/public/{token}',
    tags: ['Messages'],
    request: {
        params: z.object({ token: z.string() }),
        body: { content: { 'application/json': { schema: z.object({
            body: z.string().min(1).max(5000),
            attachments: z.array(AttachmentSchema).max(5).optional(),
        }) } } },
    },
    responses: {
        201: { content: { 'application/json': { schema: z.object({ success: z.boolean(), data: z.any() }) } }, description: 'Created' },
        404: { description: 'Not found' },
    },
});

messageRoutes.openapi(publicSendRoute, async (c) => {
    const { token } = c.req.valid('param');
    const { body, attachments } = c.req.valid('json');
    const svc = c.var.services.message;
    const insp = await svc.resolveByToken(token);
    if (!insp) throw Errors.NotFound('Conversation not found');
    const row = await svc.createMessage({
        tenantId: insp.tenantId,
        inspectionId: insp.id,
        fromRole: 'client',
        fromName: insp.clientName ?? null,
        body,
        attachments: attachments ?? [],
    });
    // T22: notify inspector
    try {
        await c.var.services.email.sendMessageNotification('inspector', insp.id, row, {
            db: c.env.DB, kv: c.env.TENANT_CACHE, baseUrl: c.env.APP_BASE_URL || `https://${c.req.header('host') ?? ''}`,
        });
    } catch { /* silent */ }
    return c.json({ success: true, data: row }, 201);
});

// ── T21: attachment upload routes ───────────────────────────────────────────────

const uploadRoute = createRoute({
    method: 'post',
    path: '/inspections/{inspectionId}/upload',
    tags: ['Messages'],
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    request: { params: z.object({ inspectionId: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.object({
            success: z.boolean(),
            data: z.object({ id: z.string(), key: z.string(), name: z.string(), size: z.number(), type: z.string(), uploadedAt: z.number() }),
        }) } }, description: 'OK' },
    },
});

messageRoutes.openapi(uploadRoute, async (c) => {
    const { inspectionId } = c.req.valid('param');
    const tenantId = c.get('tenantId');
    const fd = await c.req.parseBody();
    const file = fd['file'] as File | undefined;
    if (!file) throw Errors.BadRequest('file required');
    if (file.size > 10 * 1024 * 1024) throw Errors.BadRequest('file too large (max 10MB)');
    const buf = new Uint8Array(await file.arrayBuffer());
    const detected = detectMime(buf);
    if (!detected && !file.name.toLowerCase().endsWith('.heic')) throw Errors.BadRequest('unsupported file type');
    const id = crypto.randomUUID();
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8);
    const key = `${tenantId}/${inspectionId}/messages/${id}/${id}.${ext}`;
    if (!c.env.PHOTOS) throw Errors.BadRequest('Storage not available');
    await c.env.PHOTOS.put(key, buf, { httpMetadata: { contentType: detected ?? file.type } });
    return c.json({ success: true, data: { id, key, name: file.name, size: file.size, type: detected ?? file.type, uploadedAt: Date.now() } }, 200);
});

const publicUploadRoute = createRoute({
    method: 'post',
    path: '/public/{token}/upload',
    tags: ['Messages'],
    request: { params: z.object({ token: z.string() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.object({
            success: z.boolean(),
            data: z.object({ id: z.string(), key: z.string(), name: z.string(), size: z.number(), type: z.string(), uploadedAt: z.number() }),
        }) } }, description: 'OK' },
        404: { description: 'Not found' },
    },
});

messageRoutes.openapi(publicUploadRoute, async (c) => {
    const { token } = c.req.valid('param');
    const svc = c.var.services.message;
    const insp = await svc.resolveByToken(token);
    if (!insp) throw Errors.NotFound('Conversation not found');
    const fd = await c.req.parseBody();
    const file = fd['file'] as File | undefined;
    if (!file) throw Errors.BadRequest('file required');
    if (file.size > 10 * 1024 * 1024) throw Errors.BadRequest('file too large (max 10MB)');
    const buf = new Uint8Array(await file.arrayBuffer());
    const detected = detectMime(buf);
    if (!detected && !file.name.toLowerCase().endsWith('.heic')) throw Errors.BadRequest('unsupported file type');
    const id = crypto.randomUUID();
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 8);
    const key = `${insp.tenantId}/${insp.id}/messages/_pending/${token}/${id}.${ext}`;
    if (!c.env.PHOTOS) throw Errors.BadRequest('Storage not available');
    await c.env.PHOTOS.put(key, buf, { httpMetadata: { contentType: detected ?? file.type } });
    return c.json({ success: true, data: { id, key, name: file.name, size: file.size, type: detected ?? file.type, uploadedAt: Date.now() } }, 200);
});

export default messageRoutes;
