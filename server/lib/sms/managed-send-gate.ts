import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { messagingCompliance } from '../db/schema';

/**
 * Minimal env shape the gate needs: just the shared-pool SID for the
 * managed_shared branch. Safe to pass any superset (AppEnv, TwilioLoaderEnv, etc.).
 */
export interface ManagedSendGateEnv {
    /** Shared Messaging Service SID used by all managed_shared tenants.
     *  Its presence signals that the platform's shared pool is provisioned
     *  and toll-free verified (TFV approved). Absent → gate blocks shared sends. */
    TWILIO_SHARED_MESSAGING_SERVICE_SID?: string;
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
 *
 * managed_shared:
 *   Platform-level TFV gate: allowed ONLY when
 *   TWILIO_SHARED_MESSAGING_SERVICE_SID is set in env.
 *   Its presence means the platform provisioned the shared pool and
 *   obtained TFV approval. Absent → blocked (managed_not_approved).
 *   (A per-tenant approval flag is a possible later refinement.)
 *
 * own / platform:
 *   Always allowed — no behavior change.
 *
 * This gate is INDEPENDENT of the per-recipient consent gate and must
 * run before any provider call so a blocked send makes NO Twilio call.
 *
 * @param db        - Tenant-bound Drizzle instance (caller's existing instance).
 * @param env       - Worker env (only TWILIO_SHARED_MESSAGING_SERVICE_SID is read).
 * @param tenantId  - The tenant whose compliance status to check.
 * @param smsMode   - The tenant's configured SMS mode.
 */
export async function managedSendAllowed(
    db: DrizzleD1Database,
    env: ManagedSendGateEnv,
    tenantId: string,
    smsMode: string,
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
        if (row?.complianceStatus === 'approved') return { allowed: true };
        return { allowed: false, reason: 'managed_not_approved' };
    }

    if (smsMode === 'managed_shared') {
        // Platform-TFV gate: TWILIO_SHARED_MESSAGING_SERVICE_SID being set means
        // the platform's shared pool is provisioned and approved.
        if (env.TWILIO_SHARED_MESSAGING_SERVICE_SID) return { allowed: true };
        return { allowed: false, reason: 'managed_not_approved' };
    }

    // own / platform — always allowed.
    return { allowed: true };
}
