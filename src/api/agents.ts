import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { sign } from 'hono/jwt';
import { setCookie } from 'hono/cookie';
import type { HonoConfig } from '../types/hono';
import { Errors } from '../lib/errors';
import { requireRole } from '../lib/middleware/rbac';

/**
 * Agent Accounts A1 — invite + accept endpoints. The (existing) /api/agent
 * routes (singular, agent.ts) handle inspector-facing read-only views like
 * "my-reports" and "leaderboard". These plural /api/agents routes own the
 * invite + accept lifecycle for the new global-agent persona.
 */
const agentsRoutes = new OpenAPIHono<HonoConfig>();

const InviteBodySchema = z
    .object({
        email: z.string().email().openapi({ example: 'jane@realty.com' }),
        contactId: z.string().uuid().optional(),
    })
    .openapi('AgentInviteBody');

const InviteResponseSchema = z
    .object({
        success: z.literal(true),
        data: z.object({
            token: z.string(),
            expiresAt: z.number().openapi({ description: 'Unix epoch seconds' }),
            emailSent: z.boolean(),
        }),
    })
    .openapi('AgentInviteResponse');

const inviteRoute = createRoute({
    method: 'post',
    path: '/invite',
    tags: ['Agents'],
    summary: 'Invite a partner agent',
    description:
        'Mints a 7-day invite token and emails the recipient an /agent-invite/accept link. ' +
        'Inspector-facing — owners, admins, and inspectors can issue invites.',
    request: {
        body: { content: { 'application/json': { schema: InviteBodySchema } } },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: InviteResponseSchema } },
            description: 'Invite created',
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        409: { description: 'Invite already pending for this email' },
    },
    security: [{ bearerAuth: [] }],
});

agentsRoutes.openapi(inviteRoute, async (c) => {
    // RBAC moved inside to keep OpenAPIHono context typing happy. Owners, admins,
    // and rank-and-file inspectors can all invite agents.
    await requireRole(['owner', 'admin', 'inspector'])(c, async () => {});

    const tenantId = c.get('tenantId');
    const user = c.get('user');
    if (!tenantId || !user?.sub) throw Errors.Unauthorized();

    const body = c.req.valid('json');
    const result = await c.var.services.agent.invite(tenantId, user.sub, {
        email: body.email,
        ...(body.contactId ? { contactId: body.contactId } : {}),
    });

    return c.json({ success: true as const, data: result }, 200);
});

// --- POST /api/agents/accept ---

const AcceptBodySchema = z
    .object({
        token: z.string().min(8),
        password: z.string().min(12),
        name: z.string().min(2).max(120),
    })
    .openapi('AgentAcceptBody');

const AcceptResponseSchema = z
    .object({
        success: z.literal(true),
        data: z.object({
            redirect: z.string(),
            userId: z.string(),
        }),
    })
    .openapi('AgentAcceptResponse');

const acceptRoute = createRoute({
    method: 'post',
    path: '/accept',
    tags: ['Agents'],
    summary: 'Accept a partner-agent invite',
    description:
        'Public endpoint. Validates the invite token, creates or reuses the global agent ' +
        'user, links them to the invite tenant, and runs same-email auto-link to fold in ' +
        'any other tenants where this email already exists as an agent contact. Returns ' +
        'a Set-Cookie with the agent JWT and a redirect URL to /agent-dashboard.',
    request: {
        body: { content: { 'application/json': { schema: AcceptBodySchema } } },
    },
    responses: {
        200: {
            content: { 'application/json': { schema: AcceptResponseSchema } },
            description: 'Invite accepted',
        },
        400: { description: 'Expired token or invalid input' },
        404: { description: 'Token not found' },
        409: { description: 'Invite already used or email belongs to non-agent account' },
    },
});

agentsRoutes.openapi(acceptRoute, async (c) => {
    const body = c.req.valid('json');
    const result = await c.var.services.agent.acceptInvite(body.token, {
        password: body.password,
        name: body.name,
    });

    // Mint the agent JWT — note the deliberate absence of a tenantId claim. Per
    // Agent Accounts A1 the JWT carries no tenant scope; agent routes resolve a
    // tenant per-request via resolveAgentTenant().
    if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
        throw Errors.Internal('Server configuration error');
    }
    const now = Math.floor(Date.now() / 1000);
    const token = await sign({
        sub: result.userId,
        role: 'agent',
        'custom:userRole': 'agent',
        email: result.email,
        iat: now,
        exp: now + 60 * 60 * 24,
    }, c.env.JWT_SECRET, 'HS256');

    setCookie(c, '__Host-inspector_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        path: '/',
        maxAge: 60 * 60 * 24,
    });

    return c.json({
        success: true as const,
        data: { redirect: '/agent-dashboard', userId: result.userId },
    }, 200);
});

export default agentsRoutes;
