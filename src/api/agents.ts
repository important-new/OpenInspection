import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
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

export default agentsRoutes;
