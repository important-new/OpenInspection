import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { users } from '../lib/db/schema';
import type { HonoConfig } from '../types/hono';
import { Errors } from '../lib/errors';

const userRoutes = new OpenAPIHono<HonoConfig>();

const getOnboardingRoute = createRoute({
    method: 'get', path: '/me/onboarding',
    tags: ['Users'],
    summary: 'Get current user onboarding state',
    responses: {
        200: { content: { 'application/json': { schema: z.object({
            success: z.boolean(),
            data: z.object({ state: z.record(z.string(), z.boolean()) }),
        }) } }, description: 'OK' },
        401: { description: 'Unauthorized' },
    },
});

userRoutes.openapi(getOnboardingRoute, async (c) => {
    const jwtUser = c.get('user');
    const tenantId = c.get('tenantId');
    if (!jwtUser?.sub || !tenantId) throw Errors.Unauthorized('Authentication required');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = drizzle(c.env.DB as any);
    const [u] = await db.select({ onboardingState: users.onboardingState })
        .from(users)
        .where(and(eq(users.id, jwtUser.sub), eq(users.tenantId, tenantId)))
        .limit(1);
    return c.json({ success: true, data: { state: (u?.onboardingState ?? {}) as Record<string, boolean> } }, 200);
});

const setOnboardingRoute = createRoute({
    method: 'post', path: '/me/onboarding',
    tags: ['Users'],
    summary: 'Mark an onboarding flow as completed',
    request: {
        body: { content: { 'application/json': { schema: z.object({
            key: z.string().min(1).max(64),
            completed: z.boolean(),
        }) } } },
    },
    responses: {
        200: { content: { 'application/json': { schema: z.object({ success: z.boolean() }) } }, description: 'OK' },
        401: { description: 'Unauthorized' },
    },
});

userRoutes.openapi(setOnboardingRoute, async (c) => {
    const jwtUser = c.get('user');
    const tenantId = c.get('tenantId');
    if (!jwtUser?.sub || !tenantId) throw Errors.Unauthorized('Authentication required');
    const { key, completed } = c.req.valid('json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = drizzle(c.env.DB as any);
    // NOTE: Read-modify-write is non-atomic. For boolean dismissal flags this is acceptable —
    // last-writer-wins means at worst one onboarding flow re-shows once and is then re-dismissed.
    // If atomicity becomes important, switch to UPDATE ... SET onboarding_state = JSON_PATCH(...).
    const [u] = await db.select({ onboardingState: users.onboardingState })
        .from(users)
        .where(and(eq(users.id, jwtUser.sub), eq(users.tenantId, tenantId)))
        .limit(1);
    const newState = { ...(u?.onboardingState ?? {}), [key]: completed } as Record<string, boolean>;
    await db.update(users).set({ onboardingState: newState })
        .where(and(eq(users.id, jwtUser.sub), eq(users.tenantId, tenantId)));
    return c.json({ success: true }, 200);
});

export default userRoutes;
