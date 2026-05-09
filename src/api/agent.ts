import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, sql } from 'drizzle-orm';
import { requireRole } from '../lib/middleware/rbac';
import { inspections } from '../lib/db/schema/inspection';
import { contacts } from '../lib/db/schema/contact';
import { HonoConfig } from '../types/hono';
import { Errors } from '../lib/errors';
import {
    AgentReportsQuerySchema,
    AgentReportsResponseSchema,
    LeaderboardResponseSchema,
    AgentProfilePatchSchema,
    AgentProfilePatchResponseSchema,
    ConciergeBookSchema,
    ConciergeBookResponseSchema,
} from '../lib/validations/agent.schema';

const agentRoutes = new OpenAPIHono<HonoConfig>();

/**
 * GET /api/agents/my-reports
 * Agent or admin can view referral reports.
 */
const getReportsRoute = createRoute({
    method: 'get',
    path: '/my-reports',
    tags: ['Agents'],
    summary: 'View referral reports',
    request: {
        query: AgentReportsQuerySchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: AgentReportsResponseSchema,
                },
            },
            description: 'Success',
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
    },
    security: [{ bearerAuth: [] }],
});

agentRoutes.openapi(getReportsRoute, async (c) => {
    // Move RBAC check inside to fix OpenAPIHono type inference issues with context
    await requireRole(['office_staff', 'admin'])(c, async () => {});

    const tenantId = c.get('tenantId');
    const user = c.get('user');
    const userRole = c.get('userRole');
    const { agentId: queryAgentId } = c.req.valid('query');
    const db = drizzle(c.env.DB);

    // Admins/owners can pass ?agentId= to view any agent's reports
    const agentId =
        userRole === 'admin'
            ? (queryAgentId ?? user.sub)
            : user.sub;

    const rows = await db
        .select()
        .from(inspections)
        .where(and(
            eq(inspections.tenantId, tenantId),
            eq(inspections.referredByAgentId, agentId)
        ));

    return c.json({ 
        success: true, 
        data: { agentId, reports: rows } 
    }, 200);
});

/**
 * GET /api/agents/leaderboard
 * Admin/owner leaderboard based on referral counts.
 */
const getLeaderboardRoute = createRoute({
    method: 'get',
    path: '/leaderboard',
    tags: ['Agents'],
    summary: 'Agent referral leaderboard',
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: LeaderboardResponseSchema,
                },
            },
            description: 'Success',
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
    },
    security: [{ bearerAuth: [] }],
});

agentRoutes.openapi(getLeaderboardRoute, async (c) => {
    await requireRole(['owner', 'admin', 'inspector', 'agent'])(c, async () => {});

    const tenantId = c.get('tenantId');
    const db = drizzle(c.env.DB);

    // JOIN contacts to surface agent name + agency in one query (Round 28
    // — UI was an orphan; now leaderboard card needs displayable rows).
    const rows = await db
        .select({
            agentId: inspections.referredByAgentId,
            name:    contacts.name,
            agency:  contacts.agency,
            email:   contacts.email,
            total:   sql<number>`count(*)`,
        })
        .from(inspections)
        .leftJoin(contacts, eq(inspections.referredByAgentId, contacts.id))
        .where(eq(inspections.tenantId, tenantId))
        .groupBy(inspections.referredByAgentId, contacts.name, contacts.agency, contacts.email)
        .orderBy(sql`count(*) DESC`);

    // Exclude rows where agentId is null (un-referred inspections)
    const leaderboard = rows.filter((r) => r.agentId !== null);

    return c.json({
        success: true,
        data: { leaderboard }
    }, 200);
});

/**
 * Agent Accounts A2 — POST /api/agent/profile
 * Persists slug + notification preferences for the signed-in agent. Agents are
 * global users (tenant_id IS NULL), so the route does NOT require a tenantId.
 * RBAC narrows to role='agent' only.
 */
const updateProfileRoute = createRoute({
    method: 'post',
    path: '/profile',
    tags: ['Agents'],
    summary: 'Update agent profile (slug + notification prefs)',
    request: {
        body: { content: { 'application/json': { schema: AgentProfilePatchSchema } } },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: AgentProfilePatchResponseSchema } },
            description: 'Profile updated',
        },
        400: { description: 'Invalid input' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — agent role required' },
        409: { description: 'Slug already taken' },
    },
    security: [{ bearerAuth: [] }],
});

agentRoutes.openapi(updateProfileRoute, async (c) => {
    await requireRole(['agent'])(c, async () => {});
    const user = c.get('user');
    if (!user?.sub) throw Errors.Unauthorized();

    const body = c.req.valid('json');
    const patch: Parameters<typeof c.var.services.agent.updateProfile>[1] = {};
    if (body.slug !== undefined)             patch.slug             = body.slug;
    if (body.name !== undefined)             patch.name             = body.name;
    if (body.notifyOnReferral !== undefined) patch.notifyOnReferral = body.notifyOnReferral;
    if (body.notifyOnReport !== undefined)   patch.notifyOnReport   = body.notifyOnReport;
    if (body.notifyOnPaid !== undefined)     patch.notifyOnPaid     = body.notifyOnPaid;

    await c.var.services.agent.updateProfile(user.sub, patch);
    return c.json({ success: true as const, data: { ok: true as const } }, 200);
});

/**
 * Agent Accounts A3 — POST /api/agent/concierge-book
 * Agent submits a booking on behalf of a client. The route never trusts the
 * agent_user_id from the body — it uses `c.get('agentUserId')` set by the
 * global JWT middleware so a stolen tenantId can't bypass the agent ↔ tenant
 * link check.
 */
const conciergeBookRoute = createRoute({
    method: 'post',
    path: '/concierge-book',
    tags: ['Agents'],
    summary: 'Agent submits a concierge booking on behalf of a client',
    request: {
        body: { content: { 'application/json': { schema: ConciergeBookSchema } } },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: ConciergeBookResponseSchema } },
            description: 'Booking created — state machine entered',
        },
        400: { description: 'Invalid input' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden — agent not linked to tenant' },
        404: { description: 'Inspector contact not found' },
    },
    security: [{ bearerAuth: [] }],
});

agentRoutes.openapi(conciergeBookRoute, async (c) => {
    await requireRole(['agent'])(c, async () => {});
    const agentUserId = c.get('agentUserId');
    if (!agentUserId) throw Errors.Unauthorized('Agent identity missing from token');

    const body = c.req.valid('json');
    const result = await c.var.services.concierge.createBooking({
        tenantId: body.tenantId,
        agentUserId,
        inspectorContactId: body.inspectorContactId,
        date: body.date,
        timeSlot: body.timeSlot,
        propertyAddress: body.propertyAddress,
        clientName: body.clientName,
        clientEmail: body.clientEmail,
        ...(body.clientPhone ? { clientPhone: body.clientPhone } : {}),
        agreementRequired: body.agreementRequired,
        paymentRequired: body.paymentRequired,
    });
    return c.json({ success: true as const, data: result }, 200);
});

export default agentRoutes;
