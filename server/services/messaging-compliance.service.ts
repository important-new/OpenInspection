import { drizzle } from 'drizzle-orm/d1';
import { eq, notInArray } from 'drizzle-orm';
import { messagingCompliance } from '../lib/db/schema';
import { TwilioClient } from '../lib/messaging/twilio';
import { logger } from '../lib/logger';
import type { ComplianceEvent } from '../lib/sms/compliance-webhook';

type ReadClient = Pick<TwilioClient, 'tollfree' | 'brands'>;

/**
 * Write surface injected into `provision`. Allows tests to pass a fake without
 * touching the network. The Task-6 managed route builds this from env.
 *
 * NOTE: Twilio API field names / resource paths live exclusively in
 * `server/lib/messaging/twilio.ts` — the drift surface for API-name changes is
 * that file alone, not here.
 */
export type WriteClient = Pick<
    TwilioClient,
    'trusthub' | 'brands' | 'campaigns' | 'tollfree' | 'messagingServices' | 'numbers'
>;

/** Map Twilio's raw TFV status string to our compliance_status enum. */
const mapTfv = (s: string): 'approved' | 'rejected' | 'tfv_pending' =>
    s === 'TWILIO_APPROVED' ? 'approved' : s === 'TWILIO_REJECTED' ? 'rejected' : 'tfv_pending';

/**
 * MessagingComplianceService — read-only mirror of a tenant's own Twilio account.
 * Never creates or modifies entities on the tenant's Twilio account; only reads
 * toll-free verification + brand registration status and upserts our local snapshot.
 *
 * Used by:
 *   - GET /api/manager/sms/compliance (Task 4 admin route) — Settings page status card.
 *   - Future cron reconciler — periodic background sync for managed tenants.
 */
export class MessagingComplianceService {
    constructor(private db: D1Database) {}

    private d() { return drizzle(this.db); }

    /**
     * Returns the stored compliance snapshot for a tenant, or null if none exists yet.
     * Shape matches the admin route response (`data.complianceStatus`, etc.).
     */
    async getStatus(tenantId: string): Promise<{
        complianceStatus: string;
        rejectionReason: string | null;
        lastSyncAt: number | null;
    } | null> {
        const row = await this.d()
            .select()
            .from(messagingCompliance)
            .where(eq(messagingCompliance.tenantId, tenantId))
            .get();
        if (!row) return null;
        return {
            complianceStatus: row.complianceStatus,
            rejectionReason: row.rejectionReason ?? null,
            lastSyncAt: row.lastSyncAt?.getTime() ?? null,
        };
    }

    /**
     * Reads the tenant's own Twilio account (toll-free verifications + brand
     * registrations) and upserts the result into `messaging_compliance`.
     *
     * @param tenantId - Tenant to update (read from JWT context, never user input).
     * @param creds    - The tenant's own Twilio credentials (sid + token).
     * @param client   - Injectable Twilio adapter (defaults to a real TwilioClient;
     *                   pass a fake in tests to avoid network calls).
     */
    async syncOwnStatus(
        tenantId: string,
        creds: { sid: string; token: string },
        client: ReadClient = new TwilioClient(creds),
    ): Promise<void> {
        const tfvs = await client.tollfree.list().catch(() => []);
        const status = tfvs.length ? mapTfv(tfvs[0].status) : 'not_started';
        const now = new Date();
        await this.d()
            .insert(messagingCompliance)
            .values({
                tenantId,
                mode: 'own',
                complianceStatus: status,
                tfvStatus: tfvs[0]?.status ?? null,
                lastSyncAt: now,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: messagingCompliance.tenantId,
                set: {
                    complianceStatus: status,
                    tfvStatus: tfvs[0]?.status ?? null,
                    lastSyncAt: now,
                    updatedAt: now,
                },
            });
    }

    // -------------------------------------------------------------------------
    // Managed provisioning orchestrator (write path)
    // -------------------------------------------------------------------------

    /** Fetch the compliance row for a tenant; returns undefined if it does not exist. */
    private async getRow(tenantId: string) {
        return this.d()
            .select()
            .from(messagingCompliance)
            .where(eq(messagingCompliance.tenantId, tenantId))
            .get();
    }

    /** Insert an initial row for a new managed tenant. Returns the inserted row. */
    private async initRow(tenantId: string, mode: 'managed_dedicated') {
        const now = new Date();
        await this.d()
            .insert(messagingCompliance)
            .values({
                tenantId,
                mode,
                complianceStatus: 'not_started',
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoNothing();
        const row = await this.getRow(tenantId);
        if (!row) throw new Error('Failed to initialize compliance row');
        return row;
    }

    /**
     * Persist partial column updates for a tenant's compliance row and return the
     * refreshed row. ONLY the tenant's own row is modified (scoped by tenantId).
     */
    private async persist(
        tenantId: string,
        updates: Partial<typeof messagingCompliance.$inferInsert>,
    ) {
        const now = new Date();
        await this.d()
            .update(messagingCompliance)
            .set({ ...updates, updatedAt: now })
            .where(eq(messagingCompliance.tenantId, tenantId));
        const row = await this.getRow(tenantId);
        if (!row) throw new Error('Compliance row disappeared during provisioning');
        return row;
    }

    /**
     * Idempotent managed provisioning orchestrator.
     *
     * Runs the Twilio resource-creation chain as a sequence of GUARDED steps:
     * if the relevant SID is already stored in the DB the step is skipped (resume).
     * A step that throws stops the chain with all prior SIDs persisted, so a later
     * call resumes from the first missing SID.
     *
     * Step ordering is driven by Twilio resource dependencies (each step's inputs
     * are prior-persisted SIDs). THIS ORDERING IS THE DRIFT SURFACE — if Twilio
     * changes the dependency graph, update the order here and in the comments:
     *
     *   sp10dlc:
     *     1. customer profile (→ customerProfileSid, profile_pending)
     *     2. brand  [needs customerProfileSid] (→ brandSid, brand_pending)
     *     3. messaging service (→ messagingServiceSid)
     *     4. campaign [needs messagingServiceSid + brandSid] (→ campaignSid, campaign_pending)
     *     5. number: search + buy + attachSender [needs messagingServiceSid]
     *        (→ provisionedNumber)
     *
     *   tollfree:
     *     1. customer profile (→ customerProfileSid, profile_pending)
     *     2. messaging service (→ messagingServiceSid)
     *     3. number: search + buy + attachSender [needs messagingServiceSid]
     *        (→ provisionedNumber)
     *     4. tfv [needs provisionedNumber + messagingServiceSid] (→ tfvSid, tfv_pending)
     *
     * Final complianceStatus after a full run = 'campaign_pending' (sp10dlc) or
     * 'tfv_pending' (tollfree). 'approved' is set asynchronously by the webhook
     * (a later task) — never set here.
     *
     * @param tenantId     - Tenant to provision (from JWT context, never user input).
     * @param businessInfo - Legal name, address, rep name, optional area code.
     * @param channel      - 'sp10dlc' (10DLC sole-proprietor) or 'tollfree'.
     * @param client       - Injectable Twilio write adapter (no default — callers
     *                       must build it from env; tests inject a fake).
     */
    async provision(
        tenantId: string,
        businessInfo: {
            legalName: string;
            address: string;
            repName: string;
            areaCode?: string | undefined;
            email?: string | undefined;
        },
        channel: 'sp10dlc' | 'tollfree',
        client: WriteClient,
    ): Promise<{ complianceStatus: string }> {
        // Load or create the initial row.
        let row = (await this.getRow(tenantId)) ?? (await this.initRow(tenantId, 'managed_dedicated'));

        // Step 1 (shared): customer profile
        if (!row.customerProfileSid) {
            const cp = await client.trusthub.createSecondaryProfile({
                friendlyName: businessInfo.legalName,
                email: businessInfo.email ?? '',
                isvRegisteringForSelfOrSubaccounts: 'false',
            });
            row = await this.persist(tenantId, {
                customerProfileSid: cp.sid,
                customerProfileStatus: cp.status ?? 'PENDING',
                complianceStatus: 'profile_pending',
            });
        }

        if (channel === 'sp10dlc') {
            // Step 2 (sp10dlc): brand registration — needs customerProfileSid
            if (!row.brandSid) {
                const b = await client.brands.createSoleProprietor({
                    customerProfileBundleSid: row.customerProfileSid!,
                    a2pProfileBundleSid: row.customerProfileSid!, // same bundle for sole-prop
                    brandType: 'SOLE_PROPRIETOR',
                });
                row = await this.persist(tenantId, {
                    brandSid: b.sid,
                    brandStatus: b.status,
                    complianceStatus: 'brand_pending',
                });
            }

            // Step 3 (sp10dlc): messaging service
            if (!row.messagingServiceSid) {
                const ms = await client.messagingServices.create({
                    friendlyName: businessInfo.legalName,
                });
                row = await this.persist(tenantId, { messagingServiceSid: ms.sid });
            }

            // Step 4 (sp10dlc): campaign — needs messagingServiceSid + brandSid
            if (!row.campaignSid) {
                const c = await client.campaigns.create({
                    messagingServiceSid: row.messagingServiceSid!,
                    brandRegistrationSid: row.brandSid!,
                    description: `Inspection notifications for ${businessInfo.legalName}`,
                    messageFlow: 'Clients opt in via the inspection booking form.',
                    messageSamples: [
                        'Your inspection report is ready. View it at {{link}}.',
                        'Reminder: your inspection is scheduled for {{date}}.',
                    ],
                    usAppToPersonUsecase: 'MIXED',
                    hasEmbeddedLinks: true,
                    hasEmbeddedPhone: false,
                });
                row = await this.persist(tenantId, {
                    campaignSid: c.sid,
                    campaignStatus: c.status,
                    complianceStatus: 'campaign_pending',
                });
            }

            // Step 5 (sp10dlc): buy number, persist PN SID, then attach to messaging service.
            // Persist provisionedNumber + provisionedNumberSid BEFORE attachSender so a
            // crash-resume run can reuse the bought number (via provisionedNumberSid) instead
            // of purchasing a second number.
            if (!row.provisionedNumber) {
                const available = await client.numbers.search('local', businessInfo.areaCode);
                const bought = await client.numbers.buy(available[0].phoneNumber);
                row = await this.persist(tenantId, {
                    provisionedNumber: bought.phoneNumber,
                    provisionedNumberSid: bought.sid,
                });
                await client.messagingServices.attachSender(row.messagingServiceSid!, row.provisionedNumberSid!);
            }
        } else {
            // tollfree channel

            // Step 2 (tollfree): messaging service
            if (!row.messagingServiceSid) {
                const ms = await client.messagingServices.create({
                    friendlyName: businessInfo.legalName,
                });
                row = await this.persist(tenantId, { messagingServiceSid: ms.sid });
            }

            // Step 3 (tollfree): buy number, persist PN SID, then attach to messaging service.
            // Persist provisionedNumber + provisionedNumberSid BEFORE attachSender so a
            // crash-resume run can reuse the bought number (via provisionedNumberSid) instead
            // of purchasing a second number.
            if (!row.provisionedNumber) {
                const available = await client.numbers.search('tollfree', businessInfo.areaCode);
                const bought = await client.numbers.buy(available[0].phoneNumber);
                row = await this.persist(tenantId, {
                    provisionedNumber: bought.phoneNumber,
                    provisionedNumberSid: bought.sid,
                });
                await client.messagingServices.attachSender(row.messagingServiceSid!, row.provisionedNumberSid!);
            }

            // Step 4 (tollfree): toll-free verification — needs provisionedNumberSid + messagingServiceSid.
            // tollfreePhoneNumberSid must be the PN... SID, not the E.164 phone number string.
            if (!row.tfvSid) {
                const tfv = await client.tollfree.create({
                    tollfreePhoneNumberSid: row.provisionedNumberSid!,
                    messagingServiceSid: row.messagingServiceSid!,
                    useCaseDescription: `Inspection notifications for ${businessInfo.legalName}`,
                    useCaseSummary: 'Send inspection reports, scheduling reminders, and repair request updates to clients.',
                    productionMessageSample: 'Your inspection report is ready. View it at {{link}}.',
                    notificationEmail: businessInfo.email ?? '',
                    optInType: 'VERBAL',
                });
                row = await this.persist(tenantId, {
                    tfvSid: tfv.sid,
                    tfvStatus: tfv.status,
                    complianceStatus: 'tfv_pending',
                });
            }
        }

        return { complianceStatus: row.complianceStatus };
    }

    // -------------------------------------------------------------------------
    // Compliance-status webhook receiver (Task 7)
    // -------------------------------------------------------------------------

    /**
     * Apply a compliance-status callback from Twilio and advance the tenant's
     * complianceStatus state machine.
     *
     * Status mapping (raw Twilio → our enum):
     *   TWILIO_APPROVED / APPROVED → 'approved'
     *   TWILIO_REJECTED / REJECTED / FAILED → 'rejected'
     *   anything else → the per-entity pending status
     *     brand:    'brand_pending'
     *     campaign: 'campaign_pending'
     *     tfv:      'tfv_pending'
     *
     * The rolled-up `complianceStatus` moves to 'approved' ONLY when the
     * terminal entity for the channel is approved:
     *   sp10dlc channel: terminal entity = campaign
     *   tollfree channel: terminal entity = tfv
     * A brand approval alone does NOT set complianceStatus='approved'.
     *
     * A rejection in any entity sets complianceStatus='rejected' + stores the
     * rejectionReason verbatim from the Twilio payload.
     *
     * @param tenantId - Tenant whose row to update (from the route path slug,
     *                   already resolved and verified before this is called).
     * @param event    - Parsed compliance event from parseComplianceEvent.
     */
    async applyComplianceCallback(tenantId: string, event: ComplianceEvent): Promise<void> {
        const row = await this.getRow(tenantId);
        if (!row) {
            logger.warn('[compliance-svc] applyComplianceCallback: no row for tenant — ignoring', { tenantId });
            return;
        }

        const isApproved = event.rawStatus === 'TWILIO_APPROVED' || event.rawStatus === 'APPROVED';
        const isRejected = event.rawStatus === 'TWILIO_REJECTED' || event.rawStatus === 'REJECTED' || event.rawStatus === 'FAILED';

        const updates: Partial<typeof messagingCompliance.$inferInsert> = {};

        if (event.entity === 'brand') {
            updates.brandStatus = event.rawStatus;
            if (isApproved) {
                // Brand approval alone does not set overall approved (campaign is terminal for sp10dlc).
                updates.complianceStatus = 'brand_pending';
            } else if (isRejected) {
                updates.complianceStatus = 'rejected';
                updates.rejectionReason = event.rejectionReason ?? event.rawStatus;
            } else {
                updates.brandStatus = event.rawStatus;
            }
        } else if (event.entity === 'campaign') {
            updates.campaignStatus = event.rawStatus;
            if (isApproved) {
                // Campaign is the terminal entity for sp10dlc.
                updates.complianceStatus = 'approved';
                updates.rejectionReason = null;
            } else if (isRejected) {
                updates.complianceStatus = 'rejected';
                updates.rejectionReason = event.rejectionReason ?? event.rawStatus;
            } else {
                updates.complianceStatus = 'campaign_pending';
            }
        } else {
            // entity === 'tfv'
            updates.tfvStatus = event.rawStatus;
            if (isApproved) {
                // TFV is the terminal entity for tollfree.
                updates.complianceStatus = 'approved';
                updates.rejectionReason = null;
            } else if (isRejected) {
                updates.complianceStatus = 'rejected';
                updates.rejectionReason = event.rejectionReason ?? event.rawStatus;
            } else {
                updates.complianceStatus = 'tfv_pending';
            }
        }

        await this.persist(tenantId, updates);
        logger.info('[compliance-svc] applied compliance callback', {
            tenantId,
            entity: event.entity,
            rawStatus: event.rawStatus,
            newStatus: updates.complianceStatus ?? row.complianceStatus,
        });
    }

    // -------------------------------------------------------------------------
    // Cron poll fallback (Task 7) — re-reads status from Twilio for managed
    // tenants whose complianceStatus is not yet terminal.
    // -------------------------------------------------------------------------

    /**
     * Sync a managed tenant's compliance status from Twilio (cron fallback).
     *
     * Called by the scheduled sweeper for each non-terminal managed tenant row.
     * Uses READ-ONLY Twilio API surfaces:
     *   - TFV path (tollfree channel): client.tollfree.list() — available.
     *   - Brand path (sp10dlc channel): client.brands.list() — available.
     *
     * NOTE: Campaign status is NOT available as a read method via the Twilio
     * REST API — the campaign status is only delivered via webhook (see Twilio
     * docs for /v1/Services/:sid/Compliance/Usa2p). The webhook is therefore the
     * PRIMARY path for campaign approval; the cron poll covers brands + TFV only.
     * Campaign rows in non-terminal state will remain campaign_pending until
     * Twilio posts the callback.
     *
     * @param tenantId - Tenant to sync.
     * @param client   - Injectable TwilioClient (caller builds from env; tests inject a fake).
     */
    async syncManagedStatus(tenantId: string, client: ReadClient): Promise<void> {
        const row = await this.getRow(tenantId);
        if (!row) return;

        const updates: Partial<typeof messagingCompliance.$inferInsert> = {};

        // A managed row is single-channel: tollfree (tfv, terminal) OR sp10dlc
        // (brand→campaign). These paths are mutually exclusive (`else if`) so a
        // just-set TFV verdict can never be clobbered by the brand block reading
        // the pre-update row snapshot.
        // TFV path — poll toll-free verifications (tollfree channel, terminal).
        if (row.tfvSid || row.tfvStatus) {
            const tfvs = await client.tollfree.list().catch(() => []);
            const tfv = row.tfvSid ? tfvs.find((t) => t.sid === row.tfvSid) : tfvs[0];
            if (tfv) {
                updates.tfvStatus = tfv.status;
                const isApproved = tfv.status === 'TWILIO_APPROVED' || tfv.status === 'APPROVED';
                const isRejected = tfv.status === 'TWILIO_REJECTED' || tfv.status === 'REJECTED' || tfv.status === 'FAILED';
                if (isApproved) {
                    updates.complianceStatus = 'approved';
                    updates.rejectionReason = null;
                } else if (isRejected) {
                    updates.complianceStatus = 'rejected';
                    updates.rejectionReason = tfv.status;
                }
            }
        }

        // Brand path — poll brand registrations (sp10dlc channel; campaign is the
        // terminal entity, so brand approval only advances to brand_pending).
        else if (row.brandSid || row.brandStatus) {
            const brands = await client.brands.list().catch(() => []);
            const brand = row.brandSid ? brands.find((b) => b.sid === row.brandSid) : brands[0];
            if (brand) {
                updates.brandStatus = brand.status;
                const isApproved = brand.status === 'TWILIO_APPROVED' || brand.status === 'APPROVED';
                const isRejected = brand.status === 'TWILIO_REJECTED' || brand.status === 'REJECTED' || brand.status === 'FAILED';
                if (isApproved && row.complianceStatus !== 'approved') {
                    // Brand approval advances to brand_pending (not overall approved —
                    // campaign is terminal for sp10dlc).
                    updates.complianceStatus = 'brand_pending';
                } else if (isRejected && row.complianceStatus !== 'rejected') {
                    updates.complianceStatus = 'rejected';
                    updates.rejectionReason = brand.status;
                }
            }
        }

        if (Object.keys(updates).length > 0) {
            await this.persist(tenantId, updates);
            logger.info('[compliance-svc] syncManagedStatus: updated row', {
                tenantId, updates: JSON.stringify(updates),
            });
        }
    }

    /**
     * Sweep all managed, non-terminal rows and re-read status from Twilio.
     * Called from the scheduled cron. Fail-soft: a single tenant's error
     * does not abort the sweep for other tenants.
     *
     * NOTE: Campaign status polling is NOT available via the Twilio REST API.
     * The webhook (registerComplianceStatusRoute) is the primary path for
     * campaign approval. This cron covers brands and TFV verifications only.
     *
     * @param acctSid     - Twilio master account SID (managed ISV account).
     * @param apiKeySecret - Twilio API key secret (managed ISV account).
     * @param apiKeySid   - Twilio API key SID (managed ISV account).
     */
    async sweepManagedStatuses(
        acctSid: string,
        apiKeySecret: string,
        apiKeySid: string,
    ): Promise<void> {
        const db = this.d();
        const terminalStatuses = ['approved', 'rejected'] as const;

        // Fetch all managed rows that are not yet in a terminal status.
        // managed_shared and managed_dedicated are the only modes that use
        // the managed ISV Twilio account; 'own' tenants poll their own creds separately.
        const managedRows = await db
            .select({ tenantId: messagingCompliance.tenantId })
            .from(messagingCompliance)
            .where(notInArray(messagingCompliance.complianceStatus, [...terminalStatuses]))
            .all();

        // Build a single client for the managed ISV account.
        const client = new TwilioClient({ sid: acctSid, token: apiKeySecret, authSid: apiKeySid });

        for (const { tenantId } of managedRows) {
            try {
                await this.syncManagedStatus(tenantId, client);
            } catch (err) {
                // Fail-soft: log the error but continue sweeping remaining tenants.
                logger.error('[compliance-svc] sweepManagedStatuses: tenant sync failed', { tenantId },
                    err instanceof Error ? err : new Error(String(err)));
            }
        }

        if (managedRows.length > 0) {
            logger.info('[compliance-svc] sweepManagedStatuses: swept tenants', { count: managedRows.length });
        }
    }
}
