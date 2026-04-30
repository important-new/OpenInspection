import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { users } from '../lib/db/schema';
import type { HonoConfig } from '../types/hono';

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
    },
});

userRoutes.openapi(getOnboardingRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const jwtUser = c.get('user');
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
    },
});

userRoutes.openapi(setOnboardingRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const jwtUser = c.get('user');
    const { key, completed } = c.req.valid('json');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = drizzle(c.env.DB as any);
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
