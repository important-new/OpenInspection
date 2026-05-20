import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import { requireRole } from '../lib/middleware/rbac';
import { requireSeatAvailable } from '../features/seat-quota';
import { getBaseUrl } from '../lib/url';
import { HonoConfig } from '../types/hono';
import { Errors } from '../lib/errors';
import {
    InviteMemberSchema,
    InviteResponseSchema,
    TeamMembersResponseSchema
} from '../lib/validations/admin.schema';
import { createApiResponseSchema } from '../lib/validations/shared.schema';

const teamRoutes = new OpenAPIHono<HonoConfig>();

/**
 * GET /api/team/members
 * Fetches active members and pending invitations for the workspace.
 */
const listTeamMembersRoute = createRoute({
    method: 'get',
    path: '/members',
    tags: ['Team'],
    summary: 'List team members and pending invites',
    middleware: [requireRole(['admin', 'owner', 'inspector', 'viewer'])],
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: TeamMembersResponseSchema,
                },
            },
            description: 'Success',
        },
    },
});

teamRoutes.openapi(listTeamMembersRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const teamService = c.var.services.team;
    const { activeUsers, pendingInvites, maxUsers } = await teamService.getMembers(tenantId);

    return c.json({
        success: true,
        data: {
            members: activeUsers,
            invites: pendingInvites,
            maxUsers,
        }
    }, 200);
});

/**
 * POST /api/team/invite
 * Invites a new team member to the workspace.
 */
const inviteTeamMemberRoute = createRoute({
    method: 'post',
    path: '/invite',
    tags: ['Team'],
    summary: 'Invite a new team member',
    middleware: [requireRole(['admin', 'owner']), requireSeatAvailable],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: InviteMemberSchema,
                },
            },
        },
    },
    responses: {
        201: {
            content: {
                'application/json': {
                    schema: InviteResponseSchema,
                },
            },
            description: 'Created',
        },
    },
});

teamRoutes.openapi(inviteTeamMemberRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const body = c.req.valid('json');
    const teamService = c.var.services.team;

    const { token, expiresAt } = await teamService.createInvite({
        tenantId,
        email: body.email,
        role: body.role,
    });

    const inviteLink = `${getBaseUrl(c)}/join?token=${token}`;

    // Send email via service (requires RESEND_API_KEY in env)
    await c.var.services.email.sendInvitation(body.email, inviteLink);

    return c.json({ 
        success: true, 
        data: { 
            inviteLink, 
            expiresAt: expiresAt.toISOString() 
        } 
    }, 201);
});

/**
 * DELETE /api/team/members/:id
 * Removes a team member and invalidates their sessions.
 */
const removeTeamMemberRoute = createRoute({
    method: 'delete',
    path: '/members/{id}',
    tags: ['Team'],
    summary: 'Remove a team member',
    middleware: [requireRole(['admin', 'owner'])],
    request: {
        params: z.object({ id: z.string().uuid() }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: createApiResponseSchema(z.object({ removed: z.boolean() })),
                },
            },
            description: 'Member removed',
        },
    },
});

teamRoutes.openapi(removeTeamMemberRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const user = c.get('user');
    const requesterId = user?.sub as string;
    const { id: memberId } = c.req.valid('param');

    const teamService = c.var.services.team;
    const authService = c.var.services.auth;

    await teamService.removeMember(tenantId, memberId, requesterId);

    // Invalidate the deleted user's sessions so their cookie becomes invalid immediately
    await authService.invalidateUserSessions(memberId);

    return c.json({ success: true, data: { removed: true } }, 200);
});

// ============================================================================
// Design System 0520 subsystem C phase 3 — apprentice review queue routes.
// ============================================================================
// Mentor-facing endpoints used by /apprentice-review (HTML page mounted
// separately). list returns this mentor's pending queue; decide closes
// a single row and (on approve / edit) applies the value to
// inspection_results via patchItem(force: true).

const listApprenticeReviewsRoute = createRoute({
    method:     'get',
    path:       '/apprentice-reviews',
    tags:       ['Apprentice'],
    summary:    "List the caller's pending apprentice reviews",
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    responses:  { 200: { description: 'ok' } },
});
teamRoutes.openapi(listApprenticeReviewsRoute, async (c) => {
    const tenantId = c.get('tenantId');
    const user     = c.get('user') as { sub?: string } | undefined;
    if (!user?.sub) throw Errors.Unauthorized('Missing user identity');

    const items = await c.var.services.apprentice.listPendingForMentor(tenantId, user.sub);
    return c.json({ success: true as const, data: { items } }, 200);
});

const decideApprenticeReviewRoute = createRoute({
    method:     'post',
    path:       '/apprentice-reviews/{id}/decide',
    tags:       ['Apprentice'],
    summary:    'Approve / reject / edit an apprentice-submitted item field',
    middleware: [requireRole(['owner', 'admin', 'inspector'])] as const,
    request: {
        params: z.object({ id: z.string().min(1) }),
        body: { content: { 'application/json': { schema: z.object({
            action:        z.enum(['approved', 'rejected', 'edited']),
            decisionValue: z.unknown().optional(),
        }) } } },
    },
    responses: { 200: { description: 'ok' }, 404: { description: 'review not found' } },
});
teamRoutes.openapi(decideApprenticeReviewRoute, async (c) => {
    const { id } = c.req.valid('param');
    const { action, decisionValue } = c.req.valid('json');
    const tenantId = c.get('tenantId');
    const user     = c.get('user') as { sub?: string } | undefined;
    if (!user?.sub) throw Errors.Unauthorized('Missing user identity');

    const out = await c.var.services.apprentice.decide(tenantId, id, action, decisionValue);
    if (out.kind === 'not_found') throw Errors.NotFound('Review not found');

    // If approved or edited, apply the value to inspection_results via the
    // canonical patchItem path with force: true (bypasses version check
    // since mentor's decision is authoritative).
    if (action === 'approved' || action === 'edited') {
        const review = await c.var.services.apprentice.getById(tenantId, id);
        if (review) {
            const sourceJson = action === 'edited' ? review.decisionValue : review.proposedValue;
            let finalValue: unknown = null;
            try { finalValue = sourceJson ? JSON.parse(sourceJson) : null; } catch { /* keep null */ }
            await c.var.services.inspection.patchItem(
                review.inspectionId,
                tenantId,
                review.itemId,
                review.field as 'rating' | 'notes' | 'value',
                finalValue,
                0,
                review.apprenticeId,
                { force: true },
            );
        }
    }

    return c.json({ success: true as const, data: { reviewId: id, action } }, 200);
});

export default teamRoutes;
