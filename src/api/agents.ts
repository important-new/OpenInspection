import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { setCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { desc, eq } from 'drizzle-orm';
import type { HonoConfig } from '../types/hono';
import { Errors } from '../lib/errors';
import { requireRole } from '../lib/middleware/rbac';
import { signJwt } from '../lib/jwt-keyring';
import { agentTenantLinks, users } from '../lib/db/schema/tenant';
import { withMcpMetadata } from "../lib/route-metadata-standards";

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

const inviteRoute = createRoute(withMcpMetadata({
    method: 'post',
    path: '/invite',
    tags: ["agents"],
    summary: 'Invite a partner agent',
    description: "Auto-generated placeholder for inviteAgent (POST /invite, agents domain). TODO: replace with a real description sourced from the handler.",
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
    operationId: "inviteAgent"
}, { scopes: ['write'], tier: 'extended' }));

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

const acceptRoute = createRoute(withMcpMetadata({
    method: 'post',
    path: '/accept',
    tags: ["agents"],
    summary: 'Accept a partner-agent invite',
    description: "Auto-generated placeholder for acceptAgent (POST /accept, agents domain). TODO: replace with a real description sourced from the handler.",
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
    operationId: "acceptAgent"
}, { scopes: ['write'], tier: 'extended' }));

agentsRoutes.openapi(acceptRoute, async (c) => {
    const body = c.req.valid('json');
    const result = await c.var.services.agent.acceptInvite(body.token, {
        password: body.password,
        name: body.name,
    });

    // Mint the agent JWT — note the deliberate absence of a tenantId claim. Per
    // Agent Accounts A1 the JWT carries no tenant scope; agent routes resolve a
    // tenant per-request via resolveAgentTenant().
    const keyring = await c.var.keyringPromise!;
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt({
        sub: result.userId,
        role: 'agent',
        'custom:userRole': 'agent',
        email: result.email,
        iat: now,
        exp: now + 60 * 60 * 24,
    }, keyring);

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

// --- A2: GET /api/agents/links — inspector-side partner-link listing ---

const LinkRowSchema = z
    .object({
        id:          z.string(),
        agentUserId: z.string(),
        agentName:   z.string().nullable(),
        agentEmail:  z.string().nullable(),
        status:      z.enum(['pending', 'active', 'revoked']),
        createdAt:   z.number().nullable(),
        revokedAt:   z.number().nullable(),
    })
    .openapi('AgentLinkRow');

const ListLinksResponseSchema = z
    .object({
        success: z.literal(true),
        data: z.object({ links: z.array(LinkRowSchema) }),
    })
    .openapi('ListAgentLinksResponse');

const listLinksRoute = createRoute(withMcpMetadata({
    method: 'get',
    path: '/links',
    tags: ["agents"],
    summary: 'List partner-agent links for the current tenant',
    description: "Auto-generated placeholder for listAgentLinks (GET /links, agents domain). TODO: replace with a real description sourced from the handler.",
    responses: {
        200: {
            content: { 'application/json': { schema: ListLinksResponseSchema } },
            description: 'Links',
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
    },
    security: [{ bearerAuth: [] }],
    operationId: "listAgentLinks"
}, { scopes: ['read'], tier: 'extended' }));

agentsRoutes.openapi(listLinksRoute, async (c) => {
    await requireRole(['owner', 'admin', 'inspector'])(c, async () => {});
    const tenantId = c.get('tenantId');
    if (!tenantId) throw Errors.Unauthorized();
    const db = drizzle(c.env.DB);
    const rows = await db
        .select({
            id:          agentTenantLinks.id,
            agentUserId: agentTenantLinks.agentUserId,
            agentName:   users.name,
            agentEmail:  users.email,
            status:      agentTenantLinks.status,
            createdAt:   agentTenantLinks.createdAt,
            revokedAt:   agentTenantLinks.revokedAt,
        })
        .from(agentTenantLinks)
        .leftJoin(users, eq(users.id, agentTenantLinks.agentUserId))
        .where(eq(agentTenantLinks.tenantId, tenantId))
        .orderBy(desc(agentTenantLinks.createdAt))
        .all();
    const links = rows.map((r) => {
        const created = r.createdAt instanceof Date ? r.createdAt.getTime() : (r.createdAt ? Number(r.createdAt) : null);
        const revoked = r.revokedAt instanceof Date ? r.revokedAt.getTime() : (r.revokedAt ? Number(r.revokedAt) : null);
        return {
            id:          r.id,
            agentUserId: r.agentUserId,
            agentName:   r.agentName ?? null,
            agentEmail:  r.agentEmail ?? null,
            status:      (r.status as 'pending' | 'active' | 'revoked'),
            createdAt:   created,
            revokedAt:   revoked,
        };
    });
    return c.json({ success: true as const, data: { links } }, 200);
});

// --- A2: POST /api/agents/<linkId>/revoke ---

const RevokeParamsSchema = z.object({
    linkId: z.string().min(1),
}).openapi('AgentLinkRevokeParams');

const RevokeResponseSchema = z
    .object({
        success: z.literal(true),
        data: z.object({ ok: z.literal(true) }),
    })
    .openapi('AgentLinkRevokeResponse');

const revokeRoute = createRoute(withMcpMetadata({
    method: 'post',
    path: '/{linkId}/revoke',
    tags: ["agents"],
    summary: 'Revoke a partner-agent link',
    description: "Auto-generated placeholder for revokeAgent (POST /{linkId}/revoke, agents domain). TODO: replace with a real description sourced from the handler.",
    request: { params: RevokeParamsSchema },
    responses: {
        200: {
            content: { 'application/json': { schema: RevokeResponseSchema } },
            description: 'Link revoked',
        },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        404: { description: 'Link not found' },
    },
    security: [{ bearerAuth: [] }],
    operationId: "revokeAgent"
}, { scopes: ['write'], tier: 'extended' }));

agentsRoutes.openapi(revokeRoute, async (c) => {
    await requireRole(['owner', 'admin', 'inspector'])(c, async () => {});
    const tenantId = c.get('tenantId');
    if (!tenantId) throw Errors.Unauthorized();
    const { linkId } = c.req.valid('param');
    await c.var.services.agent.revokeLink(linkId, tenantId);
    return c.json({ success: true as const, data: { ok: true as const } }, 200);
});

export default agentsRoutes;
