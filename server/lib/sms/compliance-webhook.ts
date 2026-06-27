/**
 * WH-3 — Twilio compliance-status webhook receiver.
 *
 * Mounts POST /twilio/compliance-status/:tenant on the public SMS router
 * (full path /api/public/twilio/compliance-status/:tenant).
 *
 * Twilio posts brand/campaign/TFV status transitions here (configured as a
 * StatusCallback URL during managed provisioning). The handler:
 *   1. Resolves :tenant slug → tenantId (unknown slug → 404).
 *   2. Verifies the Twilio HMAC signature fail-closed (no secret or bad sig → 403,
 *      no DB write).
 *   3. Parses the event fields into a typed ComplianceEvent.
 *   4. Delegates the DB update to MessagingComplianceService.applyComplianceCallback.
 *
 * DRIFT SURFACE — Twilio payload field names:
 *   Brand callback:    BrandSid, BrandStatus, ErrorCode? (optional rejection detail)
 *   Campaign callback: MessagingServiceSid, CampaignSid, CampaignStatus, ErrorCode?
 *   TFV callback:      TollfreePhoneNumberSid, VerificationStatus, ErrorCode?
 *
 * All field names are isolated here (do not scatter them across other files).
 * If Twilio renames a field, update ONLY this file.
 */

import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { tenants } from '../db/schema';
import { validateTwilioSignature } from '../messaging/twilio';
import { getBaseUrl } from '../url';
import { MessagingComplianceService } from '../../services/messaging-compliance.service';
import { logger } from '../logger';
import type { HonoConfig } from '../../types/hono';

// ---------------------------------------------------------------------------
// Compliance event type — parsed from the Twilio form params.
// Entity type is inferred from which identifier fields are present:
//   brand:    BrandSid present
//   campaign: CampaignSid present
//   tfv:      VerificationStatus present (toll-free verification)
// ---------------------------------------------------------------------------

/**
 * Build the public compliance-status webhook URL for a tenant slug.
 *
 * Single source of truth for the path, so the StatusCallback auto-registered on
 * the Trust Hub CustomerProfile during provisioning (provision → createSecondary-
 * Profile) byte-matches the URL this receiver reconstructs for Twilio signature
 * validation (`${getBaseUrl(c)}${c.req.path}`). A mismatch here would make every
 * callback fail the signature check (403). Mount prefix `/api/public` + the route
 * path `/twilio/compliance-status/:tenant`.
 */
export function complianceWebhookUrl(baseUrl: string, tenantSlug: string): string {
    return `${baseUrl}/api/public/twilio/compliance-status/${tenantSlug}`;
}

export type ComplianceEventEntity = 'brand' | 'campaign' | 'tfv';

export interface ComplianceEvent {
    entity: ComplianceEventEntity;
    /** Raw Twilio status string (e.g. TWILIO_APPROVED, REJECTED, PENDING_REVIEW). */
    rawStatus: string;
    /** Optional rejection detail from Twilio ErrorCode / ErrorMessage fields. */
    rejectionReason: string | null;
    /** Entity-specific SID for correlating with our stored row. */
    entitySid: string;
}

/**
 * Parse the Twilio compliance-status form params into a typed ComplianceEvent.
 *
 * Returns null when the payload is unrecognized (no DB write; handler returns 200 no-op).
 *
 * Entity detection order (first match wins):
 *   1. TollfreePhoneNumberSid or VerificationStatus → tfv
 *   2. CampaignSid or UsAppToPersonUsecase → campaign
 *   3. BrandSid or BrandStatus → brand
 *
 * The ErrorCode / ErrorMessage fields are joined as the rejection reason when present.
 */
function parseComplianceEvent(params: Record<string, string>): ComplianceEvent | null {
    // Build rejection reason from Twilio error fields when present.
    const parts: string[] = [];
    if (params.ErrorCode) parts.push(`code=${params.ErrorCode}`);
    if (params.ErrorMessage) parts.push(params.ErrorMessage);
    const rejectionReason = parts.length ? parts.join(': ') : null;

    // TFV branch — Twilio uses VerificationStatus for toll-free callbacks.
    if (params.VerificationStatus || params.TollfreePhoneNumberSid) {
        return {
            entity: 'tfv',
            rawStatus: params.VerificationStatus ?? '',
            rejectionReason,
            entitySid: params.VerificationSid ?? params.TollfreePhoneNumberSid ?? '',
        };
    }

    // Campaign branch — UsAppToPersonUsecase is present in 10DLC campaign callbacks.
    if (params.CampaignSid || params.UsAppToPersonUsecase) {
        return {
            entity: 'campaign',
            rawStatus: params.CampaignStatus ?? '',
            rejectionReason,
            entitySid: params.CampaignSid ?? '',
        };
    }

    // Brand branch — BrandSid or BrandStatus present.
    if (params.BrandSid || params.BrandStatus) {
        return {
            entity: 'brand',
            rawStatus: params.BrandStatus ?? '',
            rejectionReason,
            entitySid: params.BrandSid ?? '',
        };
    }

    return null; // unrecognized payload → 200 no-op
}

/**
 * Mount POST /twilio/compliance-status/:tenant on the public SMS router.
 *
 * The handler verifies the Twilio signature fail-closed and delegates the
 * DB update to MessagingComplianceService.applyComplianceCallback (thin route).
 */
export function registerComplianceStatusRoute(router: Hono<HonoConfig>): void {
    router.post('/twilio/compliance-status/:tenant', async (c) => {
        const slug = c.req.param('tenant');
        const db = drizzle(c.env.DB);
        const tenant = await db.select({ id: tenants.id }).from(tenants)
            .where(eq(tenants.slug, slug)).get();
        if (!tenant) return c.text('', 404);

        // Prefer the dedicated compliance webhook token; fall back to the platform
        // auth token. Missing secret → fail-closed (no secret means no way to
        // verify the signature → reject rather than accept without verification).
        const secret = c.env.TWILIO_COMPLIANCE_WEBHOOK_TOKEN ?? c.env.TWILIO_AUTH_TOKEN;
        if (!secret) {
            logger.warn('[compliance-webhook] no signing secret configured — rejecting', { tenantId: tenant.id });
            return c.text('', 403);
        }

        // Read the raw body ONCE (single-consume stream). Parse params for the
        // HMAC verification (Twilio signs the form fields, not the raw body).
        let rawBody: string;
        try { rawBody = await c.req.text(); } catch { return c.text('', 400); }

        const params: Record<string, string> = {};
        for (const [k, v] of new URLSearchParams(rawBody)) params[k] = v;

        // Lower-case headers for provider-agnostic header lookup.
        const headers: Record<string, string> = {};
        c.req.raw.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

        const url = `${getBaseUrl(c)}${c.req.path}`;
        const presented = headers['x-twilio-signature'] ?? '';

        const ok = await validateTwilioSignature(secret, url, params, presented);
        if (!ok) {
            logger.warn('[compliance-webhook] signature verification failed', { tenantId: tenant.id });
            return c.text('', 403);
        }

        // Parse the event. Unknown entity → 200 no-op (acknowledged, no DB write).
        const event = parseComplianceEvent(params);
        if (!event) {
            logger.info('[compliance-webhook] unrecognized payload — no-op', { tenantId: tenant.id });
            return c.text('', 200);
        }

        // Delegate the state-machine update to the service layer.
        const svc = new MessagingComplianceService(c.env.DB);
        const result = await svc.applyComplianceCallback(tenant.id, event).catch((err) => {
            logger.error('[compliance-webhook] DB update failed', { tenantId: tenant.id, entity: event.entity },
                err instanceof Error ? err : new Error(String(err)));
            return null;
        });

        // Emit a core→portal sync event when the compliance status actually changed.
        // The outbox is the DI-provided UserSyncOutbox interface (di.ts builds it via
        // buildOutbox(), gated on SYNC_QUEUE → undefined in standalone). diMiddleware runs
        // app.use('*'), so c.var.services is populated even on this public route. No portal
        // import here keeps the SaaS-Portal isolation invariant. Fail-soft: an emit failure
        // must never break the 200 response Twilio expects.
        if (result?.changed) {
            const outbox = c.var.services?.outbox;
            if (outbox) {
                outbox.append({
                    type: 'io.inspectorhub.tenant.compliance_status_updated',
                    payload: {
                        tenantId: tenant.id,
                        complianceStatus: result.complianceStatus,
                        rejectionReason: result.rejectionReason,
                        updatedAt: Math.floor(Date.now() / 1000),
                    },
                }).catch((err) => {
                    logger.error('[compliance-webhook] outbox emit failed', { tenantId: tenant.id },
                        err instanceof Error ? err : new Error(String(err)));
                });
            }
        }

        return c.text('', 200);
    });
}
