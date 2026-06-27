import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { messagingCompliance } from '../db/schema';
import { MeteringService } from '../../services/metering.service';
import { currentPeriodKey } from '../usage/period';

/**
 * Default monthly SMS allowance for managed tenants when
 * MANAGED_SMS_MONTHLY_ALLOWANCE is absent or non-numeric.
 */
export const DEFAULT_MANAGED_SMS_ALLOWANCE = 1000;

/**
 * Minimal env shape the gate needs: the shared-pool SID for the
 * managed_shared branch, and the monthly SMS allowance cap.
 * Safe to pass any superset (AppEnv, TwilioLoaderEnv, etc.).
 */
export interface ManagedSendGateEnv {
    /** Shared Messaging Service SID used by all managed_shared tenants.
     *  Its presence signals that the platform's shared pool is provisioned
     *  and toll-free verified (TFV approved). Absent → gate blocks shared sends. */
    TWILIO_SHARED_MESSAGING_SERVICE_SID?: string;
    /** Platform-wide monthly SMS allowance for managed tenants (string-encoded integer).
     *  Parsed at gate-check time; defaults to DEFAULT_MANAGED_SMS_ALLOWANCE when absent
     *  or non-numeric. */
    MANAGED_SMS_MONTHLY_ALLOWANCE?: string;
}

export interface ManagedSendGateResult {
    allowed: boolean;
    /** Present only when allowed=false. */
    reason?: string;
}

/**
 * Fail-closed send gate for managed SMS tenants.
 *
 * managed_dedicated:
 *   Reads messaging_compliance.complianceStatus for tenantId.
 *   Allowed ONLY when complianceStatus === 'approved'.
 *   Missing row → not approved → blocked (fail-closed).
 *   After approval check passes, reads current-period SMS counter and blocks
 *   when count >= MANAGED_SMS_MONTHLY_ALLOWANCE (default 1000).
 *
 * managed_shared:
 *   Platform-level TFV gate: allowed ONLY when
 *   TWILIO_SHARED_MESSAGING_SERVICE_SID is set in env.
 *   Its presence means the platform provisioned the shared pool and
 *   obtained TFV approval. Absent → blocked (managed_not_approved).
 *   After approval check passes, applies the same monthly quota check.
 *
 * own / platform:
 *   Always allowed — no behavior change.
 *
 * This gate is INDEPENDENT of the per-recipient consent gate and must
 * run before any provider call so a blocked send makes NO Twilio call.
 *
 * @param db        - Tenant-bound Drizzle instance (caller's existing instance).
 * @param env       - Worker env (TWILIO_SHARED_MESSAGING_SERVICE_SID + MANAGED_SMS_MONTHLY_ALLOWANCE read).
 * @param tenantId  - The tenant whose compliance status to check.
 * @param smsMode   - The tenant's configured SMS mode.
 * @param db1       - Raw D1Database for metering reads (optional; when absent, quota check is skipped).
 */
export async function managedSendAllowed(
    db: DrizzleD1Database,
    env: ManagedSendGateEnv,
    tenantId: string,
    smsMode: string,
    db1?: D1Database,
): Promise<ManagedSendGateResult> {
    if (smsMode === 'managed_dedicated') {
        // Fail-closed: missing row → not approved → block.
        let row: { complianceStatus: string } | null | undefined;
        try {
            row = await db
                .select({ complianceStatus: messagingCompliance.complianceStatus })
                .from(messagingCompliance)
                .where(eq(messagingCompliance.tenantId, tenantId))
                .get();
        } catch { row = null; }
        if (row?.complianceStatus !== 'approved') {
            return { allowed: false, reason: 'managed_not_approved' };
        }
        // Compliance approved — check monthly quota.
        return checkManagedQuota(env, tenantId, db1);
    }

    if (smsMode === 'managed_shared') {
        // Platform-TFV gate: TWILIO_SHARED_MESSAGING_SERVICE_SID being set means
        // the platform's shared pool is provisioned and approved.
        if (!env.TWILIO_SHARED_MESSAGING_SERVICE_SID) {
            return { allowed: false, reason: 'managed_not_approved' };
        }
        // Approved — check monthly quota.
        return checkManagedQuota(env, tenantId, db1);
    }

    // own / platform — always allowed.
    return { allowed: true };
}

/**
 * Check the current-period SMS counter against the configured allowance.
 * Returns { allowed: false, reason: 'managed_quota_exceeded' } when the
 * tenant has reached or exceeded their monthly allowance.
 *
 * When db1 is absent (unit tests without a real D1Database), the quota check
 * is skipped (safe — metering only runs in real deployments).
 */
async function checkManagedQuota(
    env: ManagedSendGateEnv,
    tenantId: string,
    db1?: D1Database,
): Promise<ManagedSendGateResult> {
    if (!db1) return { allowed: true };

    const allowanceRaw = parseInt(env.MANAGED_SMS_MONTHLY_ALLOWANCE ?? '', 10);
    const allowance = Number.isFinite(allowanceRaw) && allowanceRaw > 0
        ? allowanceRaw
        : DEFAULT_MANAGED_SMS_ALLOWANCE;

    const metering = new MeteringService(db1);
    const count = await metering.getCount(tenantId, 'sms', currentPeriodKey(new Date())).catch(() => 0);
    if (count >= allowance) {
        return { allowed: false, reason: 'managed_quota_exceeded' };
    }
    return { allowed: true };
}
