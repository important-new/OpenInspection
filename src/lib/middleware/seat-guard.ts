/**
 * Design System 0520 subsystem C phase 5 — unified seat-quota guard.
 *
 * Per the simplified seat model: permanent members + active guests both
 * count against tenants.max_users. Guests are merely users with an
 * `expires_at` set; when the cron sweeps expired rows their seats free
 * up automatically. There is no per-role billing.
 *
 * Two surfaces:
 *   • `computeSeatsUsed(users, nowSeconds)`  — pure helper, used by
 *     GuestInviteService.claim and unit-tested directly.
 *   • `requireSeatAvailable` middleware       — applied to invite + mint
 *     routes so admins fail fast at 402 with a portal upgrade URL.
 */
import type { MiddlewareHandler } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { users as usersTbl, tenants } from '../db/schema';
import { Errors } from '../errors';
import type { HonoConfig } from '../../types/hono';

export interface SeatUser {
    id: string;
    expiresAt?: number | null;
}

/**
 * Count seats actively held by `users` at the given timestamp.
 *
 * - Permanent members (`expires_at == null`) always count.
 * - Guests count only while `expires_at > now`. The boundary is strict:
 *   an `expires_at` exactly equal to `now` is treated as expired so the
 *   cron's idempotent sweep does not race with claim checks.
 */
export function computeSeatsUsed(users: SeatUser[], now: number): number {
    return users.filter(u => u.expiresAt == null || u.expiresAt > now).length;
}

/**
 * True when `seatsUsed >= maxUsers`. A tenant with `max_users === 0`
 * is always blocked — used by tests to assert the hard-stop branch.
 */
export function isAtOrOverQuota(seatsUsed: number, maxUsers: number): boolean {
    return seatsUsed >= maxUsers;
}

/**
 * Middleware: looks up the active user count + tenant quota and short-
 * circuits with a 402 `SEAT_LIMIT_REACHED` AppError when the tenant has
 * no spare seats. Mount on routes that consume a seat (permanent invite
 * + guest mint).
 */
export const requireSeatAvailable: MiddlewareHandler<HonoConfig> = async (c, next) => {
    const tenantId = c.get('tenantId');
    if (!tenantId) throw Errors.Unauthorized();

    const db = drizzle(c.env.DB);
    const tenant = await db.select({ maxUsers: tenants.maxUsers })
        .from(tenants).where(eq(tenants.id, tenantId)).get();
    if (!tenant) throw Errors.NotFound('Tenant not found');

    const rows = await db.select({ id: usersTbl.id, expiresAt: usersTbl.expiresAt })
        .from(usersTbl).where(eq(usersTbl.tenantId, tenantId)).all();
    const nowSec = Math.floor(Date.now() / 1000);

    if (isAtOrOverQuota(computeSeatsUsed(rows, nowSec), tenant.maxUsers)) {
        const billingUrl = c.env.BILLING_URL || c.env.PORTAL_API_URL
            ? `${c.env.BILLING_URL || c.env.PORTAL_API_URL}/billing/upgrade?tenant=${tenantId}`
            : null;
        throw Errors.SeatLimitReached({
            used: computeSeatsUsed(rows, nowSec),
            max:  tenant.maxUsers,
            billingPortalUrl: billingUrl,
        });
    }

    await next();
};
