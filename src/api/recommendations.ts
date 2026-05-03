import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { HonoConfig } from '../types/hono';
import type { Recommendation } from '../services/recommendation.service';
import { requireRole } from '../lib/middleware/rbac';
import { auditFromContext } from '../lib/audit';
import { Errors } from '../lib/errors';
import {
    CreateRecommendationSchema,
    UpdateRecommendationSchema,
    RecommendationResponseSchema,
    RecommendationListResponseSchema,
    ListRecommendationsQuerySchema,
} from '../lib/validations/recommendation.schema';
import { RECOMMENDATION_SEEDS } from '../data/recommendation-seeds';

const recommendationsRoutes = new OpenAPIHono<HonoConfig>();

/* ── GET /api/recommendations ─────────────────────────────────────────────── */
recommendationsRoutes.openapi(createRoute({
    method: 'get', path: '/',
    tags: ['Recommendations'],
    summary: 'List recommendations (filter: category, severity)',
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    request: { query: ListRecommendationsQuerySchema },
    responses: {
        200: { content: { 'application/json': { schema: RecommendationListResponseSchema } }, description: 'List' },
    },
}), async (c) => {
    const { category, severity } = c.req.valid('query');
    const tenantId = c.get('tenantId') as string;
    const filter: { category?: string; severity?: 'satisfactory' | 'monitor' | 'defect' } = {};
    if (category) filter.category = category;
    if (severity) filter.severity = severity;
    const data = await c.var.services.recommendation.listByTenant(tenantId, filter);
    return c.json({ success: true as const, data }, 200);
});

/* ── GET /api/recommendations/:id ─────────────────────────────────────────── */
recommendationsRoutes.openapi(createRoute({
    method: 'get', path: '/{id}',
    tags: ['Recommendations'],
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
        200: { content: { 'application/json': { schema: RecommendationResponseSchema } }, description: 'Single recommendation' },
    },
}), async (c) => {
    const { id } = c.req.valid('param');
    const tenantId = c.get('tenantId') as string;
    const r = await c.var.services.recommendation.getById(id, tenantId);
    if (!r) throw Errors.NotFound('Recommendation not found');
    return c.json({ success: true as const, data: r }, 200);
});

/* ── POST /api/recommendations ────────────────────────────────────────────── */
recommendationsRoutes.openapi(createRoute({
    method: 'post', path: '/',
    tags: ['Recommendations'],
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    request: { body: { content: { 'application/json': { schema: CreateRecommendationSchema } } } },
    responses: {
        200: { content: { 'application/json': { schema: RecommendationResponseSchema } }, description: 'Created' },
    },
}), async (c) => {
    const input = c.req.valid('json');
    const tenantId = c.get('tenantId') as string;
    const userId = (c.get('user') as { sub?: string } | undefined)?.sub;
    const r = await c.var.services.recommendation.create(tenantId, { ...input, createdByUserId: userId ?? null });
    auditFromContext(c, 'recommendation.created', 'recommendation', { entityId: r.id, metadata: { name: r.name, severity: r.severity } });
    return c.json({ success: true as const, data: r }, 200);
});

/* ── PUT /api/recommendations/:id ─────────────────────────────────────────── */
recommendationsRoutes.openapi(createRoute({
    method: 'put', path: '/{id}',
    tags: ['Recommendations'],
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    request: {
        params: z.object({ id: z.string().uuid() }),
        body: { content: { 'application/json': { schema: UpdateRecommendationSchema } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: RecommendationResponseSchema } }, description: 'Updated' },
    },
}), async (c) => {
    const { id } = c.req.valid('param');
    const patch = c.req.valid('json');
    const tenantId = c.get('tenantId') as string;
    const r = await c.var.services.recommendation.update(id, tenantId, patch);
    auditFromContext(c, 'recommendation.updated', 'recommendation', { entityId: r.id });
    return c.json({ success: true as const, data: r }, 200);
});

/* ── DELETE /api/recommendations/:id ──────────────────────────────────────── */
recommendationsRoutes.openapi(createRoute({
    method: 'delete', path: '/{id}',
    tags: ['Recommendations'],
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.literal(true), data: z.object({ deleted: z.literal(true) }) }) } }, description: 'Deleted' },
    },
}), async (c) => {
    const { id } = c.req.valid('param');
    const tenantId = c.get('tenantId') as string;
    await c.var.services.recommendation.delete(id, tenantId);
    auditFromContext(c, 'recommendation.deleted', 'recommendation', { entityId: id });
    return c.json({ success: true as const, data: { deleted: true as const } }, 200);
});

/* ── POST /api/recommendations/seed-defaults ──────────────────────────────── */
recommendationsRoutes.openapi(createRoute({
    method: 'post', path: '/seed-defaults',
    tags: ['Recommendations'],
    summary: 'Bulk-insert the default 80 recommendations (idempotent — skips entries with matching name+category)',
    middleware: [requireRole(['owner', 'admin'])] as const,
    request: {},
    responses: {
        200: { content: { 'application/json': { schema: z.object({
            success: z.literal(true),
            data: z.object({ inserted: z.number(), skipped: z.number() }),
        }) } }, description: 'Bulk seed result' },
    },
}), async (c) => {
    const tenantId = c.get('tenantId') as string;
    const userId = (c.get('user') as { sub?: string } | undefined)?.sub;
    const svc = c.var.services.recommendation;
    const existing = await svc.listByTenant(tenantId);
    const existingKeys = new Set(existing.map((r: Recommendation) => `${r.category ?? ''}::${r.name}`));

    let inserted = 0;
    let skipped = 0;
    for (const seed of RECOMMENDATION_SEEDS) {
        const key = `${seed.category}::${seed.name}`;
        if (existingKeys.has(key)) {
            skipped++;
            continue;
        }
        await svc.create(tenantId, {
            category:             seed.category,
            name:                 seed.name,
            severity:             seed.severity,
            defaultEstimateMin:   seed.defaultEstimateMin,
            defaultEstimateMax:   seed.defaultEstimateMax,
            defaultRepairSummary: seed.defaultRepairSummary,
            createdByUserId:      userId ?? null,
        });
        inserted++;
    }

    return c.json({ success: true as const, data: { inserted, skipped } }, 200);
});

export default recommendationsRoutes;
