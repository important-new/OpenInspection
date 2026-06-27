// server/lib/messaging/providers/telnyx-compliance.ts
//
// TelnyxComplianceProvider — the Telnyx implementation of the ComplianceProvider
// seam (Plan 1), driving the 10DLC provision path on the official `telnyx` SDK
// and persisting through the injected state store. Structural twin of
// TwilioComplianceProvider: idempotent, persist-before-advance, resume-safe.
//
// The constructor takes an ALREADY-BUILT telnyx client. The telnyx SDK is
// edge-native (Stainless): it routes through the global `fetch` with
// `Authorization: Bearer <apiKey>`, so production builds it plainly —
//   new Telnyx({ apiKey })
// (no custom httpClient, unlike twilio-node). Resolver wiring is a later task.
// Tests inject a structural fake recording each resource call.
//
// 10DLC differs from Twilio's ISV flow in two structural ways:
//   - There is NO Trust Hub "customer profile" step. The first persisted status
//     is 'brand_pending' (never 'profile_pending').
//   - Numbers are attached to a campaign by E.164 phone number via
//     phoneNumberCampaigns, not by attaching a number SID to a messaging service.
//
// DRIFT SURFACE — Telnyx field names / resource paths live in THIS file only.
//
// SCOPE (Task 1): the sp10dlc `provision` path + `webhookUrl`. The `tollfree`
// branch and the verify/parse/sync methods are stubbed to throw until later
// tasks implement them (they exist only to satisfy the interface).

import type {
    ComplianceProvider,
    ComplianceProviderId,
    ComplianceEvent,
    ComplianceSnapshot,
    ProvisionInput,
    WebhookVerifyCtx,
} from '../compliance-provider';
import type { ComplianceStateStore, ComplianceRow } from '../compliance-state-store';
import { complianceWebhookUrl } from '../../sms/compliance-webhook';

// ---------------------------------------------------------------------------
// Minimal structural type of the telnyx SDK surface the provider uses. The real
// `new Telnyx(...)` client structurally satisfies these names (return types are
// the SDK's thenable APIPromise, assignable to Promise); the resolver casts it
// to this type. Tests inject a fake of the same shape.
//   - messaging10dlc.brand.create                → POST /10dlc/brand        → TelnyxBrand
//   - messaging10dlc.brand.externalVetting.order → POST /10dlc/brand/{id}/externalVetting
//   - messaging10dlc.campaignBuilder.submit      → POST /10dlc/campaignBuilder → TelnyxCampaignCsp
//   - messagingProfiles.create                   → POST /messaging_profiles
//   - availablePhoneNumbers.list                 → GET  /available_phone_numbers
//   - numberOrders.create                        → POST /number_orders
//   - messaging10dlc.phoneNumberCampaigns.create → POST /10dlc/phoneNumberCampaigns
// ---------------------------------------------------------------------------

interface TelnyxBrandResult { brandId?: string; identityStatus?: string }
interface TelnyxVettingResult { vettingId?: string }
interface TelnyxCampaignResult { campaignId?: string; campaignStatus?: string }
interface TelnyxMessagingProfileResult { data?: { id?: string } }
interface TelnyxAvailableNumbersResult { data?: Array<{ phone_number?: string }> }
interface TelnyxNumberOrderResult {
    data?: { id?: string; phone_numbers?: Array<{ id?: string; phone_number?: string }> };
}
interface TelnyxPhoneNumberCampaignResult { phoneNumber?: string; assignmentStatus?: string }

export interface TelnyxComplianceClient {
    messaging10dlc: {
        brand: {
            create(body: Record<string, unknown>): Promise<TelnyxBrandResult>;
            externalVetting: {
                order(brandID: string, body: { evpId: string; vettingClass: string }): Promise<TelnyxVettingResult>;
            };
        };
        campaignBuilder: {
            submit(body: Record<string, unknown>): Promise<TelnyxCampaignResult>;
        };
        phoneNumberCampaigns: {
            create(body: { campaignId: string; phoneNumber: string }): Promise<TelnyxPhoneNumberCampaignResult>;
        };
    };
    messagingProfiles: {
        create(body: { name: string; whitelisted_destinations: string[] }): Promise<TelnyxMessagingProfileResult>;
    };
    availablePhoneNumbers: {
        list(query: { filter: Record<string, unknown> }): Promise<TelnyxAvailableNumbersResult>;
    };
    numberOrders: {
        create(body: {
            phone_numbers: Array<{ phone_number: string }>;
            messaging_profile_id?: string;
        }): Promise<TelnyxNumberOrderResult>;
    };
}

// External vetting order defaults. evpId names the external vetting provider
// (e.g. AEGIS) and vettingClass the requested classification; neither is carried
// by businessInfo. These literal defaults are NOT secrets — they are public
// Telnyx enum values — but a managed deployment may want them configurable.
const VETTING_EVP_ID = 'AEGIS';
const VETTING_CLASS = 'STANDARD';

// Home-inspection businesses register under the real-estate vertical with a
// for-profit private entity type. businessInfo cannot supply EIN / structured
// address / stock info, so the rest are sensible literal defaults (see report).
const BRAND_ENTITY_TYPE = 'PRIVATE_PROFIT';
const BRAND_VERTICAL = 'REAL_ESTATE';
const BRAND_COUNTRY = 'US';
const CAMPAIGN_USECASE = 'AGENTS_FRANCHISES';

function parseMeta(row: ComplianceRow): Record<string, unknown> {
    if (!row.providerMeta) return {};
    try {
        const parsed = JSON.parse(row.providerMeta);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

export class TelnyxComplianceProvider implements ComplianceProvider {
    readonly id: ComplianceProviderId = 'telnyx';

    constructor(private client: TelnyxComplianceClient) {}

    /**
     * Idempotent managed provisioning orchestrator (10DLC). Each step is GUARDED
     * by its persisted id: a step whose id already exists is skipped (resume). A
     * step that throws stops the chain with all prior ids persisted, so a later
     * call resumes from the first missing id. Step ordering follows Telnyx
     * resource dependencies:
     *
     *   brand → vetting → campaign → messaging profile → number(buy + assign)
     *
     * Final complianceStatus after a full run = 'campaign_pending'. 'approved' is
     * set asynchronously by the webhook / sync poll, never here.
     */
    async provision(input: ProvisionInput, store: ComplianceStateStore): Promise<ComplianceSnapshot> {
        const { tenantId, channel, businessInfo, statusCallbackUrl } = input;

        if (channel === 'tollfree') {
            // Telnyx toll-free verification path — Task 2.
            throw new Error('tollfree not implemented');
        }

        let row = (await store.load(tenantId)) ?? (await store.init(tenantId, this.id));

        // Step 1: brand registration (per tenant). No Trust Hub profile precedes
        // it — brand creation is the first managed entity, so the first persisted
        // status is 'brand_pending'. statusCallbackUrl is registered as the brand
        // webhook so Telnyx delivers status transitions automatically.
        if (!row.brandSid) {
            const b = await this.client.messaging10dlc.brand.create({
                country: BRAND_COUNTRY,
                displayName: businessInfo.legalName,
                companyName: businessInfo.legalName,
                email: businessInfo.email ?? '',
                entityType: BRAND_ENTITY_TYPE,
                vertical: BRAND_VERTICAL,
                firstName: businessInfo.repName,
                street: businessInfo.address,
                ...(statusCallbackUrl ? { webhookURL: statusCallbackUrl } : {}),
            });
            const brandId = b.brandId;
            if (!brandId) throw new Error('Telnyx brand.create returned no brandId');
            row = await store.persist(tenantId, {
                brandSid: brandId,
                brandStatus: b.identityStatus ?? null,
                complianceStatus: 'brand_pending',
            });
        }

        // Step 2: submit brand vetting — needs brandSid. The vetting id has no
        // Twilio-shaped SID column, so it is stored in providerMeta (JSON). Guarded
        // on the presence of that key so a resume does not re-order vetting.
        if (!parseMeta(row).vettingId) {
            const v = await this.client.messaging10dlc.brand.externalVetting.order(row.brandSid!, {
                evpId: VETTING_EVP_ID,
                vettingClass: VETTING_CLASS,
            });
            const meta = { ...parseMeta(row), vettingId: v.vettingId ?? null };
            row = await store.persist(tenantId, { providerMeta: JSON.stringify(meta) });
        }

        // Step 3: campaign — needs brandSid. campaignBuilder.submit creates the
        // campaign; usecase AGENTS_FRANCHISES.
        if (!row.campaignSid) {
            const c = await this.client.messaging10dlc.campaignBuilder.submit({
                brandId: row.brandSid!,
                usecase: CAMPAIGN_USECASE,
                description: `Inspection notifications for ${businessInfo.legalName}`,
                messageFlow: 'Clients opt in via the inspection booking form.',
                sample1: 'Your inspection report is ready. View it at {{link}}.',
                sample2: 'Reminder: your inspection is scheduled for {{date}}.',
                embeddedLink: true,
                embeddedPhone: false,
                subscriberOptin: true,
                subscriberOptout: true,
                subscriberHelp: true,
                termsAndConditions: true,
                ...(statusCallbackUrl ? { webhookURL: statusCallbackUrl } : {}),
            });
            const campaignId = c.campaignId;
            if (!campaignId) throw new Error('Telnyx campaignBuilder.submit returned no campaignId');
            row = await store.persist(tenantId, {
                campaignSid: campaignId,
                campaignStatus: c.campaignStatus ?? null,
                complianceStatus: 'campaign_pending',
            });
        }

        // Step 4: messaging profile — the sending container the bought number is
        // ordered into.
        if (!row.messagingResourceSid) {
            const mp = await this.client.messagingProfiles.create({
                name: businessInfo.legalName,
                whitelisted_destinations: [BRAND_COUNTRY],
            });
            const mpId = mp.data?.id;
            if (!mpId) throw new Error('Telnyx messagingProfiles.create returned no id');
            row = await store.persist(tenantId, { messagingResourceSid: mpId });
        }

        // Step 5: buy number (guarded on provisionedNumberSid), then assign it to
        // the campaign (guarded separately on senderAttached). Independent markers
        // so a crash between buy and assign resumes by assigning the already-bought
        // number — never re-buying, never orphaning. (Same invariant as Twilio's
        // buy/attach split; here "attach" is the phone↔campaign assignment.)
        if (!row.provisionedNumberSid) {
            row = await this.buyNumber(tenantId, businessInfo.areaCode, row.messagingResourceSid!, store);
        }
        if (!row.senderAttached) {
            await this.assignToCampaign(row.campaignSid!, row.provisionedNumber!);
            row = await store.persist(tenantId, { senderAttached: true });
        }

        return { complianceStatus: row.complianceStatus, rejectionReason: row.rejectionReason ?? null };
    }

    /**
     * Search a US SMS-capable DID and order it into the messaging profile, then
     * persist (provisionedNumber, provisionedNumberSid) BEFORE returning — so a
     * crash after the order resumes by assigning, not re-buying.
     *   search → availablePhoneNumbers.list (filter country_code/features/limit;
     *            areaCode → national_destination_code)
     *   buy    → numberOrders.create (messaging_profile_id ties it to the profile)
     */
    private async buyNumber(
        tenantId: string,
        areaCode: string | undefined,
        messagingProfileId: string,
        store: ComplianceStateStore,
    ): Promise<ComplianceRow> {
        const available = await this.client.availablePhoneNumbers.list({
            filter: {
                country_code: BRAND_COUNTRY,
                features: ['SMS'],
                limit: 1,
                ...(areaCode ? { national_destination_code: areaCode } : {}),
            },
        });
        const phone = available.data?.[0]?.phone_number;
        if (!phone) throw new Error('No available Telnyx numbers for the requested area');

        const order = await this.client.numberOrders.create({
            phone_numbers: [{ phone_number: phone }],
            messaging_profile_id: messagingProfileId,
        });
        const ordered = order.data?.phone_numbers?.[0];
        const numberSid = ordered?.id ?? order.data?.id;
        const e164 = ordered?.phone_number ?? phone;
        if (!numberSid) throw new Error('Telnyx numberOrders.create returned no phone-number id');

        return store.persist(tenantId, {
            provisionedNumber: e164,
            provisionedNumberSid: numberSid,
        });
    }

    /** Assign a bought number (E.164) to the campaign (POST /10dlc/phoneNumberCampaigns). */
    private async assignToCampaign(campaignId: string, phoneNumber: string): Promise<void> {
        const assigned = await this.client.messaging10dlc.phoneNumberCampaigns.create({ campaignId, phoneNumber });
        // A success with no phoneNumber echoed back is not a valid assignment —
        // surface it rather than mark senderAttached on a non-assignment.
        if (!assigned.phoneNumber) throw new Error('Telnyx phoneNumberCampaigns.create returned no phoneNumber');
    }

    // --- interface methods stubbed until later tasks ------------------------

    /** Telnyx Ed25519 webhook-signature verification — Task 3. */
    async verifyWebhookSignature(_ctx: WebhookVerifyCtx): Promise<boolean> {
        throw new Error('not implemented');
    }

    /** Telnyx compliance-event parsing — Task 3. */
    parseCallback(_headers: Record<string, string>, _rawBody: string): ComplianceEvent | null {
        throw new Error('not implemented');
    }

    /** Cron-poll status reconciliation — Task 3. */
    async syncStatus(_input: { tenantId: string }, _store: ComplianceStateStore): Promise<ComplianceSnapshot> {
        throw new Error('not implemented');
    }

    /** Public compliance-status webhook URL for a tenant slug (single source of truth). */
    webhookUrl(baseUrl: string, tenantSlug: string): string {
        return complianceWebhookUrl(baseUrl, 'telnyx', tenantSlug);
    }
}
