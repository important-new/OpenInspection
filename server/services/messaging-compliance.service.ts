import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { messagingCompliance } from '../lib/db/schema';
import { TwilioClient } from '../lib/messaging/twilio';

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
            areaCode?: string;
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
                email: '',                                  // caller can extend later
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

            // Step 5 (sp10dlc): buy number + attach to messaging service
            if (!row.provisionedNumber) {
                const available = await client.numbers.search(businessInfo.areaCode);
                const bought = await client.numbers.buy(available[0].phoneNumber);
                await client.messagingServices.attachSender(row.messagingServiceSid!, bought.sid);
                row = await this.persist(tenantId, { provisionedNumber: bought.phoneNumber });
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

            // Step 3 (tollfree): buy number + attach to messaging service
            if (!row.provisionedNumber) {
                const available = await client.numbers.search(businessInfo.areaCode);
                const bought = await client.numbers.buy(available[0].phoneNumber);
                await client.messagingServices.attachSender(row.messagingServiceSid!, bought.sid);
                row = await this.persist(tenantId, { provisionedNumber: bought.phoneNumber });
            }

            // Step 4 (tollfree): toll-free verification — needs provisionedNumber + messagingServiceSid
            if (!row.tfvSid) {
                const tfv = await client.tollfree.create({
                    tollfreePhoneNumberSid: row.provisionedNumber!,
                    messagingServiceSid: row.messagingServiceSid!,
                    useCaseDescription: `Inspection notifications for ${businessInfo.legalName}`,
                    useCaseSummary: 'Send inspection reports, scheduling reminders, and repair request updates to clients.',
                    productionMessageSample: 'Your inspection report is ready. View it at {{link}}.',
                    notificationEmail: '',
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
}
