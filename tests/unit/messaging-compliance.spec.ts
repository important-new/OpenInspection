import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('drizzle-orm/d1', () => ({ drizzle: vi.fn() }));
import { drizzle as mockDrizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { createTestDb, setupSchema } from './db';
import * as schema from '../../server/lib/db/schema';
import { MessagingComplianceService } from '../../server/services/messaging-compliance.service';
import type { WriteClient } from '../../server/services/messaging-compliance.service';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

it('syncOwnStatus upserts the latest toll-free status', async () => {
    const fx = createTestDb(); await setupSchema(fx.sqlite);
    (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
    const svc = new MessagingComplianceService({} as D1Database);
    const fakeClient = { tollfree: { list: async () => [{ sid: 'HH1', status: 'TWILIO_APPROVED', phoneNumber: 'PN1' }] }, brands: { list: async () => [] } };
    await svc.syncOwnStatus('t1', { sid: 'AC1', token: 't' }, fakeClient as never);
    const got = await svc.getStatus('t1');
    expect(got?.complianceStatus).toBe('approved');
    fx.sqlite.close();
});

describe('MessagingComplianceService', () => {
    it('returns null when tenant has no row', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const svc = new MessagingComplianceService({} as D1Database);
        const got = await svc.getStatus('no-such-tenant');
        expect(got).toBeNull();
        fx.sqlite.close();
    });

    it('maps TWILIO_REJECTED to rejected', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const svc = new MessagingComplianceService({} as D1Database);
        const fakeClient = { tollfree: { list: async () => [{ sid: 'HH2', status: 'TWILIO_REJECTED', phoneNumber: 'PN2' }] }, brands: { list: async () => [] } };
        await svc.syncOwnStatus('t2', { sid: 'AC2', token: 't' }, fakeClient as never);
        const got = await svc.getStatus('t2');
        expect(got?.complianceStatus).toBe('rejected');
        fx.sqlite.close();
    });

    it('maps unknown Twilio status to tfv_pending', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const svc = new MessagingComplianceService({} as D1Database);
        const fakeClient = { tollfree: { list: async () => [{ sid: 'HH3', status: 'IN_REVIEW', phoneNumber: 'PN3' }] }, brands: { list: async () => [] } };
        await svc.syncOwnStatus('t3', { sid: 'AC3', token: 't' }, fakeClient as never);
        const got = await svc.getStatus('t3');
        expect(got?.complianceStatus).toBe('tfv_pending');
        fx.sqlite.close();
    });

    it('returns not_started when tollfree list is empty', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const svc = new MessagingComplianceService({} as D1Database);
        const fakeClient = { tollfree: { list: async () => [] }, brands: { list: async () => [] } };
        await svc.syncOwnStatus('t4', { sid: 'AC4', token: 't' }, fakeClient as never);
        const got = await svc.getStatus('t4');
        expect(got?.complianceStatus).toBe('not_started');
        fx.sqlite.close();
    });

    it('upsert is idempotent — second sync overwrites status', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const svc = new MessagingComplianceService({} as D1Database);
        const clientPending = { tollfree: { list: async () => [{ sid: 'HH5', status: 'IN_REVIEW', phoneNumber: 'PN5' }] }, brands: { list: async () => [] } };
        const clientApproved = { tollfree: { list: async () => [{ sid: 'HH5', status: 'TWILIO_APPROVED', phoneNumber: 'PN5' }] }, brands: { list: async () => [] } };
        await svc.syncOwnStatus('t5', { sid: 'AC5', token: 't' }, clientPending as never);
        await svc.syncOwnStatus('t5', { sid: 'AC5', token: 't' }, clientApproved as never);
        const got = await svc.getStatus('t5');
        expect(got?.complianceStatus).toBe('approved');
        fx.sqlite.close();
    });

    it('degrades gracefully when Twilio throws — returns not_started', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const svc = new MessagingComplianceService({} as D1Database);
        const errorClient = { tollfree: { list: async () => { throw new Error('network'); } }, brands: { list: async () => [] } };
        await svc.syncOwnStatus('t6', { sid: 'AC6', token: 't' }, errorClient as never);
        const got = await svc.getStatus('t6');
        expect(got?.complianceStatus).toBe('not_started');
        fx.sqlite.close();
    });
});

// ---------------------------------------------------------------------------
// provision() — idempotent managed provisioning orchestrator
// ---------------------------------------------------------------------------

/** Build a fresh fake WriteClient that records which methods were called. */
function makeSp10dlcClient(calls: string[]): WriteClient {
    return {
        trusthub: {
            createSecondaryProfile: async () => { calls.push('cp'); return { sid: 'BUx' }; },
        },
        brands: {
            list: async () => [],
            createSoleProprietor: async () => { calls.push('brand'); return { sid: 'BNx', status: 'PENDING' }; },
        },
        campaigns: {
            create: async () => { calls.push('camp'); return { sid: 'CMx', status: 'PENDING' }; },
        },
        messagingServices: {
            create: async () => { calls.push('ms'); return { sid: 'MGx' }; },
            attachCompliance: async () => ({}),
            attachSender: async () => ({ sid: 'ASx' }),
        },
        numbers: {
            search: async (_kind: 'tollfree' | 'local') => [{ phoneNumber: '+15551110000' }],
            buy: async () => ({ sid: 'PNx', phoneNumber: '+15551110000' }),
        },
        tollfree: {
            list: async () => [],
            create: async () => { calls.push('tfv'); return { sid: 'HVx', status: 'PENDING_REVIEW' }; },
        },
    } as never;
}

describe('MessagingComplianceService.provision', () => {
    it('sp10dlc full run — persists all SIDs and sets campaign_pending', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const calls: string[] = [];
        const client = makeSp10dlcClient(calls);
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.provision(
            'p1',
            { legalName: 'Acme Inspections', address: '1 Main, TX', repName: 'Bob' },
            'sp10dlc',
            client,
        );
        const row = await fx.db
            .select()
            .from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 'p1'))
            .get();
        expect(result.complianceStatus).toBe('campaign_pending');
        expect(row?.brandSid).toBe('BNx');
        expect(row?.campaignSid).toBe('CMx');
        expect(row?.messagingServiceSid).toBe('MGx');
        expect(row?.provisionedNumber).toBe('+15551110000');
        expect(row?.complianceStatus).toBe('campaign_pending');
        expect(calls).toContain('cp');
        expect(calls).toContain('brand');
        expect(calls).toContain('ms');
        expect(calls).toContain('camp');
        fx.sqlite.close();
    });

    it('sp10dlc resume — second call does not recreate brand or campaign', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const calls: string[] = [];
        const client = makeSp10dlcClient(calls);
        const svc = new MessagingComplianceService({} as D1Database);
        const info = { legalName: 'Acme Inspections', address: '1 Main, TX', repName: 'Bob' };
        await svc.provision('p2', info, 'sp10dlc', client);
        // Reset call log; second invocation must skip already-created resources.
        calls.length = 0;
        await svc.provision('p2', info, 'sp10dlc', client);
        expect(calls.filter(c => c === 'brand').length).toBe(0);
        expect(calls.filter(c => c === 'camp').length).toBe(0);
        expect(calls.filter(c => c === 'cp').length).toBe(0);
        expect(calls.filter(c => c === 'ms').length).toBe(0);
        fx.sqlite.close();
    });

    it('tollfree full run — persists tfvSid and messagingServiceSid, sets tfv_pending', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const calls: string[] = [];
        const client = makeSp10dlcClient(calls); // same fake; tollfree.create path exercised
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.provision(
            'p3',
            { legalName: 'Acme TF', address: '2 Main, TX', repName: 'Alice' },
            'tollfree',
            client,
        );
        const row = await fx.db
            .select()
            .from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 'p3'))
            .get();
        expect(result.complianceStatus).toBe('tfv_pending');
        expect(row?.tfvSid).toBe('HVx');
        expect(row?.messagingServiceSid).toBe('MGx');
        expect(row?.provisionedNumber).toBe('+15551110000');
        expect(row?.complianceStatus).toBe('tfv_pending');
        expect(calls.filter(c => c === 'tfv').length).toBe(1);
        fx.sqlite.close();
    });

    it('tollfree crash-resume: numbers.buy called once even if process died after buy but before tfv.create', async () => {
        // Simulate a crash AFTER numbers.buy (provisionedNumber + provisionedNumberSid persisted)
        // but BEFORE tollfree.create. A second provision() call with a non-throwing client must
        // reuse the already-persisted PN SID and NOT call numbers.buy a second time.
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        let buyCount = 0;
        // First client: throws on tollfree.create to simulate crash mid-chain.
        const crashClient: WriteClient = {
            ...makeSp10dlcClient([]),
            numbers: {
                search: async (_kind: 'tollfree' | 'local') => [{ phoneNumber: '+18005559999' }],
                buy: async () => { buyCount++; return { sid: 'PNresume', phoneNumber: '+18005559999' }; },
            },
            tollfree: {
                list: async () => [],
                create: async () => { throw new Error('crash'); },
            },
        } as never;
        await expect(
            new MessagingComplianceService({} as D1Database).provision(
                'p5',
                { legalName: 'Resume Co', address: '5 Main, TX', repName: 'Dave' },
                'tollfree',
                crashClient,
            ),
        ).rejects.toThrow('crash');

        // Verify the number was persisted despite the crash on tfv.create.
        const rowAfterCrash = await fx.db
            .select()
            .from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 'p5'))
            .get();
        expect(rowAfterCrash?.provisionedNumber).toBe('+18005559999');
        expect(rowAfterCrash?.provisionedNumberSid).toBe('PNresume');

        // Second client: fully succeeds. numbers.buy must NOT be called again.
        const resumeCalls: string[] = [];
        const resumeClient: WriteClient = {
            ...makeSp10dlcClient(resumeCalls),
            numbers: {
                search: async (_kind: 'tollfree' | 'local') => [{ phoneNumber: '+18005559999' }],
                buy: async () => { buyCount++; return { sid: 'PNresume2', phoneNumber: '+18005559999' }; },
            },
        } as never;
        const svc2 = new MessagingComplianceService({} as D1Database);
        const result = await svc2.provision(
            'p5',
            { legalName: 'Resume Co', address: '5 Main, TX', repName: 'Dave' },
            'tollfree',
            resumeClient,
        );
        expect(buyCount).toBe(1); // numbers.buy ran exactly once across both calls
        expect(result.complianceStatus).toBe('tfv_pending');
        const finalRow = await fx.db
            .select()
            .from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 'p5'))
            .get();
        expect(finalRow?.tfvSid).toBe('HVx');
        expect(resumeCalls.filter(c => c === 'tfv').length).toBe(1);
        fx.sqlite.close();
    });

    it('mid-chain throw leaves prior SIDs persisted and propagates the error', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const calls: string[] = [];
        // campaigns.create throws to simulate a mid-chain failure
        const client: WriteClient = {
            ...makeSp10dlcClient(calls),
            campaigns: {
                create: async () => { calls.push('camp_fail'); throw new Error('TCR error'); },
            },
        } as never;
        const svc = new MessagingComplianceService({} as D1Database);
        await expect(
            svc.provision(
                'p4',
                { legalName: 'Failing Co', address: '3 Main, TX', repName: 'Carol' },
                'sp10dlc',
                client,
            ),
        ).rejects.toThrow('TCR error');
        // Prior steps (profile, brand, messaging service) must be persisted despite the failure.
        const row = await fx.db
            .select()
            .from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 'p4'))
            .get();
        expect(row?.customerProfileSid).toBe('BUx');
        expect(row?.brandSid).toBe('BNx');
        expect(row?.messagingServiceSid).toBe('MGx');
        // Campaign was not persisted.
        expect(row?.campaignSid).toBeNull();
        expect(row?.complianceStatus).toBe('brand_pending');
        fx.sqlite.close();
    });
});

// ---------------------------------------------------------------------------
// applyComplianceCallback — change-detection return value (Task 11)
// ---------------------------------------------------------------------------

describe('applyComplianceCallback — change detection', () => {
    let db: BetterSQLite3Database<typeof schema>;
    let sqlite: { close: () => void };

    beforeEach(async () => {
        const fx = createTestDb();
        db = fx.db as BetterSQLite3Database<typeof schema>;
        sqlite = fx.sqlite;
        await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
    });

    afterEach(() => sqlite.close());

    async function seedRow(tenantId: string, complianceStatus: string) {
        const now = new Date();
        await db.insert(schema.messagingCompliance).values({
            tenantId,
            mode: 'managed_dedicated',
            complianceStatus,
            createdAt: now,
            updatedAt: now,
        } as never);
    }

    it('returns changed=true + new status when campaign TWILIO_APPROVED transitions from campaign_pending', async () => {
        await seedRow('t-chg-1', 'campaign_pending');
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.applyComplianceCallback('t-chg-1', {
            entity: 'campaign',
            rawStatus: 'TWILIO_APPROVED',
            rejectionReason: null,
            entitySid: 'CR123',
        });
        expect(result.changed).toBe(true);
        expect(result.complianceStatus).toBe('approved');
        expect(result.rejectionReason).toBeNull();
    });

    it('returns changed=false when inbound status results in the same complianceStatus', async () => {
        // If the row is already campaign_pending and a brand intermediate callback
        // comes in that does not change complianceStatus, changed must be false.
        await seedRow('t-chg-2', 'brand_pending');
        const svc = new MessagingComplianceService({} as D1Database);
        // brand TWILIO_APPROVED from brand_pending → stays brand_pending
        const result = await svc.applyComplianceCallback('t-chg-2', {
            entity: 'brand',
            rawStatus: 'TWILIO_APPROVED',
            rejectionReason: null,
            entitySid: 'BN123',
        });
        // brand_pending → brand_pending = no change
        expect(result.changed).toBe(false);
        expect(result.complianceStatus).toBe('brand_pending');
    });

    it('returns changed=true + rejectionReason when campaign REJECTED transitions from campaign_pending', async () => {
        await seedRow('t-chg-3', 'campaign_pending');
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.applyComplianceCallback('t-chg-3', {
            entity: 'campaign',
            rawStatus: 'REJECTED',
            rejectionReason: 'code=30034: Use case not approved',
            entitySid: 'CR456',
        });
        expect(result.changed).toBe(true);
        expect(result.complianceStatus).toBe('rejected');
        expect(result.rejectionReason).toBe('code=30034: Use case not approved');
    });

    it('returns changed=false + sentinel status when no row exists for tenant', async () => {
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.applyComplianceCallback('no-such-tenant', {
            entity: 'campaign',
            rawStatus: 'TWILIO_APPROVED',
            rejectionReason: null,
            entitySid: 'CR000',
        });
        expect(result.changed).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// syncManagedStatus — change-detection return value (Task 11)
// ---------------------------------------------------------------------------

describe('syncManagedStatus — change detection', () => {
    let db: BetterSQLite3Database<typeof schema>;
    let sqlite: { close: () => void };

    beforeEach(async () => {
        const fx = createTestDb();
        db = fx.db as BetterSQLite3Database<typeof schema>;
        sqlite = fx.sqlite;
        await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);
    });

    afterEach(() => sqlite.close());

    async function seedRow(tenantId: string, complianceStatus: string, tfvStatus?: string) {
        const now = new Date();
        await db.insert(schema.messagingCompliance).values({
            tenantId,
            mode: 'managed_dedicated',
            complianceStatus,
            tfvStatus: tfvStatus ?? null,
            createdAt: now,
            updatedAt: now,
        } as never);
    }

    const approvedTfvClient = {
        tollfree: { list: async () => [{ sid: 'HV1', status: 'TWILIO_APPROVED', phoneNumber: '+18005550001' }] },
        brands: { list: async () => [] as Array<{ sid: string; status: string }> },
    };

    const noChangeTfvClient = {
        tollfree: { list: async () => [] as Array<{ sid: string; status: string; phoneNumber: string }> },
        brands: { list: async () => [] as Array<{ sid: string; status: string }> },
    };

    it('returns changed=true when TFV poll transitions status from tfv_pending to approved', async () => {
        await seedRow('t-sc-1', 'tfv_pending', 'PENDING_REVIEW');
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.syncManagedStatus('t-sc-1', approvedTfvClient);
        expect(result.changed).toBe(true);
        expect(result.complianceStatus).toBe('approved');
    });

    it('returns changed=false when TFV poll finds no entries (no status change)', async () => {
        await seedRow('t-sc-2', 'tfv_pending', 'PENDING_REVIEW');
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.syncManagedStatus('t-sc-2', noChangeTfvClient);
        expect(result.changed).toBe(false);
        expect(result.complianceStatus).toBe('tfv_pending');
    });

    it('returns changed=false when no row exists for tenant', async () => {
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.syncManagedStatus('no-row', approvedTfvClient);
        expect(result.changed).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// compliance-status webhook → outbox emit (Task 11)
// Tests drive the webhook handler directly to verify the outbox is called
// with the correct event type and payload when the status changes.
// ---------------------------------------------------------------------------

import { OpenAPIHono } from '@hono/zod-openapi';
import { AppError } from '../../server/lib/errors';
import type { HonoConfig } from '../../server/types/hono';
import { smsPublicRoutes } from '../../server/api/sms';
import { signParams } from '../../server/lib/messaging/twilio';
import { OutboxService } from '../../server/portal/outbox.service';

const APP_BASE_URL_WH = 'https://app.example.test';
const COMPLIANCE_TOKEN_WH = 'compliance-webhook-token-11';
const TENANT_WH = '00000000-0000-0000-0000-000000000099';

function makeExecCtx() {
    return { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
}

async function buildWebhookApp(
    database: BetterSQLite3Database<typeof schema>,
    opts: { appendSpy?: ReturnType<typeof vi.fn>; hasSyncQueue?: boolean } = {},
) {
    const app = new OpenAPIHono<HonoConfig>();
    app.onError((err, c) => {
        if (err instanceof AppError) {
            return c.json({ success: false, error: { code: err.code, message: err.message } }, err.status);
        }
        return c.json({ success: false, error: { code: 'internal_error', message: String(err) } }, 500);
    });
    app.route('/api/public', smsPublicRoutes);
    (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(database);

    // Mock OutboxService.append if a spy is supplied.
    if (opts.appendSpy) {
        vi.spyOn(OutboxService.prototype, 'append').mockImplementation(opts.appendSpy);
    }

    const env: HonoConfig['Bindings'] = {
        DB: {},
        APP_BASE_URL: APP_BASE_URL_WH,
        JWT_SECRET: 'test-secret',
        TWILIO_COMPLIANCE_WEBHOOK_TOKEN: COMPLIANCE_TOKEN_WH,
        TENANT_CACHE: { get: async () => null, put: async () => {} },
        ...(opts.hasSyncQueue ? { SYNC_QUEUE: {} } : {}),
    } as unknown as HonoConfig['Bindings'];

    return { app, env };
}

async function postWebhook(
    app: OpenAPIHono<HonoConfig>,
    env: HonoConfig['Bindings'],
    tenantSlug: string,
    params: Record<string, string>,
) {
    const url = `${APP_BASE_URL_WH}/api/public/twilio/compliance-status/${tenantSlug}`;
    const sig = await signParams(COMPLIANCE_TOKEN_WH, url, params);
    return app.request(
        `/api/public/twilio/compliance-status/${tenantSlug}`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'x-twilio-signature': sig,
            },
            body: new URLSearchParams(params).toString(),
        },
        env,
        makeExecCtx(),
    );
}

describe('compliance-status webhook → outbox emit (Task 11)', () => {
    let db: BetterSQLite3Database<typeof schema>;
    let sqlite: { close: () => void };

    beforeEach(async () => {
        const fx = createTestDb();
        db = fx.db as BetterSQLite3Database<typeof schema>;
        sqlite = fx.sqlite;
        await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(db);

        // Seed the tenant used by webhook tests.
        await db.insert(schema.tenants).values({
            id: TENANT_WH, name: 'Webhook Co', slug: 'webhookco', status: 'active',
            deploymentMode: 'shared', tier: 'free', createdAt: new Date(),
        } as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sqlite.close();
    });

    it('emits outbox event with correct type and payload on status-changing callback (SYNC_QUEUE present)', async () => {
        // Seed a compliance row at campaign_pending so the APPROVED callback changes status.
        const now = new Date();
        await db.insert(schema.messagingCompliance).values({
            tenantId: TENANT_WH, mode: 'managed_dedicated',
            complianceStatus: 'campaign_pending', createdAt: now, updatedAt: now,
        } as never);

        const appendSpy = vi.fn().mockResolvedValue('outbox-id-1');
        const { app, env } = await buildWebhookApp(db, { appendSpy, hasSyncQueue: true });

        const res = await postWebhook(app, env, 'webhookco', {
            CampaignSid: 'CR_APPROVED', CampaignStatus: 'TWILIO_APPROVED',
        });

        expect(res.status).toBe(200);
        expect(appendSpy).toHaveBeenCalledOnce();
        const [calledWith] = appendSpy.mock.calls[0] as [{ type: string; payload: Record<string, unknown> }];
        expect(calledWith.type).toBe('io.inspectorhub.tenant.compliance_status_updated');
        expect(calledWith.payload.tenantId).toBe(TENANT_WH);
        expect(calledWith.payload.complianceStatus).toBe('approved');
        expect(calledWith.payload.rejectionReason).toBeNull();
        expect(typeof calledWith.payload.updatedAt).toBe('number');
    });

    it('does NOT emit outbox event when status is unchanged (brand-only sub-status update)', async () => {
        // brand_pending → brand TWILIO_APPROVED keeps complianceStatus=brand_pending (no change).
        const now = new Date();
        await db.insert(schema.messagingCompliance).values({
            tenantId: TENANT_WH, mode: 'managed_dedicated',
            complianceStatus: 'brand_pending', createdAt: now, updatedAt: now,
        } as never);

        const appendSpy = vi.fn().mockResolvedValue('outbox-id-2');
        const { app, env } = await buildWebhookApp(db, { appendSpy, hasSyncQueue: true });

        const res = await postWebhook(app, env, 'webhookco', {
            BrandSid: 'BN_NOCHANGE', BrandStatus: 'TWILIO_APPROVED',
        });

        expect(res.status).toBe(200);
        expect(appendSpy).not.toHaveBeenCalled();
    });

    it('does NOT emit outbox event when SYNC_QUEUE is absent (standalone mode)', async () => {
        const now = new Date();
        await db.insert(schema.messagingCompliance).values({
            tenantId: TENANT_WH, mode: 'managed_dedicated',
            complianceStatus: 'campaign_pending', createdAt: now, updatedAt: now,
        } as never);

        const appendSpy = vi.fn().mockResolvedValue('outbox-id-3');
        // hasSyncQueue=false (default) → no SYNC_QUEUE in env
        const { app, env } = await buildWebhookApp(db, { appendSpy, hasSyncQueue: false });

        const res = await postWebhook(app, env, 'webhookco', {
            CampaignSid: 'CR_NO_QUEUE', CampaignStatus: 'TWILIO_APPROVED',
        });

        expect(res.status).toBe(200);
        expect(appendSpy).not.toHaveBeenCalled();
    });

    it('still returns 200 even when outbox append throws (fail-soft)', async () => {
        const now = new Date();
        await db.insert(schema.messagingCompliance).values({
            tenantId: TENANT_WH, mode: 'managed_dedicated',
            complianceStatus: 'campaign_pending', createdAt: now, updatedAt: now,
        } as never);

        const appendSpy = vi.fn().mockRejectedValue(new Error('queue unavailable'));
        const { app, env } = await buildWebhookApp(db, { appendSpy, hasSyncQueue: true });

        const res = await postWebhook(app, env, 'webhookco', {
            CampaignSid: 'CR_FAILSOFT', CampaignStatus: 'TWILIO_APPROVED',
        });

        // Despite outbox throwing, the route must return 200 so Twilio does not retry.
        expect(res.status).toBe(200);
    });
});
