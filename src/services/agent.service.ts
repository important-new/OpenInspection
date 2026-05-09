import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { isNull } from 'drizzle-orm';
import { agentInvites, agentTenantLinks, tenants, users } from '../lib/db/schema/tenant';
import { contacts } from '../lib/db/schema/contact';
import { Errors } from '../lib/errors';
import { logger } from '../lib/logger';
import type { EmailService } from './email.service';

/**
 * Agent Accounts A1 — invites, accepts, signups, and the same-email auto-link
 * routine that reconciles invite-driven and self-signup paths.
 *
 * Agents are global users (users.tenant_id IS NULL, role='agent') that connect
 * to one or more tenants via rows in `agent_tenant_links`. The mental model:
 *
 *   - Inspector at tenant A invites jane@realty.com
 *     -> agent_invites row (TTL 7d)
 *     -> Jane clicks /agent-invite/accept?token=… and sets a password
 *     -> users row (tenant_id NULL, role=agent) + agent_tenant_links row
 *
 *   - Jane self-signs-up at /agent-signup
 *     -> users row (tenant_id NULL, role=agent)
 *     -> autoLinkSameEmail() finds every contacts row where email=Jane's and
 *        type='agent' and creates an active agent_tenant_links row for each.
 */

const INVITE_TOKEN_BYTES = 24; // 24 bytes -> 48 hex chars
const INVITE_TTL_DAYS = 7;

function mintToken(): string {
    const buf = new Uint8Array(INVITE_TOKEN_BYTES);
    crypto.getRandomValues(buf);
    let hex = '';
    for (const b of buf) hex += b.toString(16).padStart(2, '0');
    return hex;
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

export class AgentService {
    constructor(
        private db: D1Database,
        private email: EmailService,
        private appBaseUrl: string,
    ) {}

    private getDrizzle() {
        return drizzle(this.db);
    }

    /**
     * Mint an invite token + persist the invite + send the agent-invite email.
     * Rejects when an unaccepted, non-expired invite for the same email already
     * exists for this tenant — duplicate prevention is per-tenant, so two
     * different tenants can independently invite the same email.
     */
    async invite(
        tenantId: string,
        invitedByUserId: string,
        params: { email: string; contactId?: string },
    ): Promise<{ token: string; expiresAt: number; emailSent: boolean }> {
        const db = this.getDrizzle();
        const email = normalizeEmail(params.email);

        // Look up tenant + inspector to populate the email body.
        const tenant = await db
            .select({ id: tenants.id, name: tenants.name })
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .get();
        if (!tenant) throw Errors.NotFound('Tenant not found');

        const inspector = await db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, invitedByUserId))
            .get();
        if (!inspector) throw Errors.NotFound('Inspector not found');

        // Reject duplicate pending invite (same tenant + email + not yet accepted + not expired).
        const nowMs = Date.now();
        const existing = await db
            .select({ token: agentInvites.token, expiresAt: agentInvites.expiresAt })
            .from(agentInvites)
            .where(
                and(
                    eq(agentInvites.tenantId, tenantId),
                    eq(agentInvites.email, email),
                    isNull(agentInvites.acceptedAt),
                ),
            )
            .all();
        const stillValid = existing.find((row) => {
            const exp = row.expiresAt instanceof Date ? row.expiresAt.getTime() : Number(row.expiresAt);
            return exp > nowMs;
        });
        if (stillValid) {
            throw Errors.Conflict('An invite is already pending for this email');
        }

        const token = mintToken();
        const expiresAt = new Date(nowMs + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
        const row = {
            token,
            tenantId,
            inspectorContactId: params.contactId ?? null,
            email,
            invitedByUserId,
            expiresAt,
            acceptedAt: null,
            createdAt: new Date(),
        };
        await db.insert(agentInvites).values(row);

        const acceptUrl = `${this.appBaseUrl.replace(/\/$/, '')}/agent-invite/accept?token=${encodeURIComponent(token)}`;
        let emailSent = false;
        try {
            await this.email.sendAgentInvite(email, {
                token,
                inspectorName: inspector.name ?? inspector.email ?? 'an inspector',
                tenantName: tenant.name,
                acceptUrl,
            });
            emailSent = true;
        } catch (err) {
            // Surface the token to the inspector even if email delivery flakes — they can
            // copy + paste the accept link manually. Production-ready alternative would
            // queue a retry; A1 keeps it simple.
            logger.warn('agent.invite.email.failed', {
                tenantId,
                email,
                error: err instanceof Error ? err.message : String(err),
            });
        }

        return {
            token,
            expiresAt: Math.floor(expiresAt.getTime() / 1000),
            emailSent,
        };
    }

    /**
     * Same-email auto-link: when an agent account is created (signup or invite-accept),
     * find every `contacts` row in any tenant where `type='agent'` and `email` matches
     * the agent's email, and create an `active` agent_tenant_links row for each. Skips
     * existing links thanks to the unique (agent_user_id, tenant_id) index.
     *
     * Returns the count of new links created (idempotent — second call returns 0).
     */
    async autoLinkSameEmail(userId: string, email: string): Promise<number> {
        const db = this.getDrizzle();
        const normalized = normalizeEmail(email);
        const matches = await db
            .select({ id: contacts.id, tenantId: contacts.tenantId })
            .from(contacts)
            .where(and(eq(contacts.email, normalized), eq(contacts.type, 'agent')))
            .all();

        let created = 0;
        for (const row of matches) {
            try {
                await db.insert(agentTenantLinks).values({
                    id: crypto.randomUUID(),
                    agentUserId: userId,
                    tenantId: row.tenantId,
                    inspectorContactId: row.id,
                    status: 'active',
                    invitedByUserId: null,
                    createdAt: new Date(),
                });
                created++;
            } catch {
                // unique-index violation (already linked) — skip silently.
            }
        }
        logger.info('agent.autolink', { userId, email: normalized, count: created });
        return created;
    }
}
