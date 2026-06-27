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

describe('MessagingComplianceService.provision — StatusCallback auto-registration (a)', () => {
    /** Capturing client that records the createSecondaryProfile args. */
    function makeCapturingClient(captured: { profileArgs?: Record<string, unknown> }): WriteClient {
        return {
            ...makeSp10dlcClient([]),
            trusthub: {
                createSecondaryProfile: async (args: Record<string, unknown>) => {
                    captured.profileArgs = args;
                    return { sid: 'BUx' };
                },
            },
        } as never;
    }

    it('passes statusCallbackUrl to createSecondaryProfile when provided', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const captured: { profileArgs?: Record<string, unknown> } = {};
        const url = 'https://app.example.test/api/public/twilio/compliance-status/acme';
        await new MessagingComplianceService({} as D1Database).provision(
            'cb-1',
            { legalName: 'Acme', address: '1 Main, TX', repName: 'Bob' },
            'sp10dlc',
            makeCapturingClient(captured),
            url,
        );
        expect(captured.profileArgs?.statusCallbackUrl).toBe(url);
        fx.sqlite.close();
    });

    it('omits statusCallbackUrl when not provided (backward-compatible)', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const captured: { profileArgs?: Record<string, unknown> } = {};
        await new MessagingComplianceService({} as D1Database).provision(
            'cb-2',
            { legalName: 'Acme', address: '1 Main, TX', repName: 'Bob' },
            'sp10dlc',
            makeCapturingClient(captured),
        );
        expect('statusCallbackUrl' in (captured.profileArgs ?? {})).toBe(false);
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
import type { HonoConfig, AppServices } from '../../server/types/hono';
import { smsPublicRoutes } from '../../server/api/sms';
import { signParams } from '../../server/lib/messaging/twilio';

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

    // Inject a minimal services stub into context so the compliance-webhook handler
    // can read c.var.services.outbox (the UserSyncOutbox seam) without needing
    // the full diMiddleware stack. The outbox is populated only when hasSyncQueue
    // is true (mirrors the SaaS gate in di.ts).
    app.use('*', async (c, next) => {
        const outbox = (opts.hasSyncQueue && opts.appendSpy)
            ? { append: opts.appendSpy }
            : undefined;
        c.set('services', { outbox } as unknown as AppServices);
        await next();
    });

    app.route('/api/public', smsPublicRoutes);
    (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(database);

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

// ---------------------------------------------------------------------------
// applyComplianceCallback — brand callback must NEVER regress a more-advanced
// status. Twilio re-delivers callbacks and does not guarantee brand-before-
// campaign ordering; a late brand-approved must not roll campaign_pending /
// approved back to brand_pending (which would silently disable an approved
// tenant's SMS at the send gate).
// ---------------------------------------------------------------------------

describe('applyComplianceCallback — brand approval never regresses status', () => {
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
            tenantId, mode: 'managed_dedicated', complianceStatus,
            createdAt: now, updatedAt: now,
        } as never);
    }

    it('does NOT regress campaign_pending → brand_pending on a late brand TWILIO_APPROVED', async () => {
        await seedRow('t-reg-1', 'campaign_pending');
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.applyComplianceCallback('t-reg-1', {
            entity: 'brand', rawStatus: 'TWILIO_APPROVED', rejectionReason: null, entitySid: 'BN_LATE',
        });
        expect(result.changed).toBe(false);
        expect(result.complianceStatus).toBe('campaign_pending');
        // brandStatus sub-field still records the approval.
        const row = await db.select().from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 't-reg-1')).get();
        expect(row?.brandStatus).toBe('TWILIO_APPROVED');
    });

    it('does NOT regress approved → brand_pending on a redelivered brand TWILIO_APPROVED', async () => {
        await seedRow('t-reg-2', 'approved');
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.applyComplianceCallback('t-reg-2', {
            entity: 'brand', rawStatus: 'TWILIO_APPROVED', rejectionReason: null, entitySid: 'BN_DUP',
        });
        expect(result.changed).toBe(false);
        expect(result.complianceStatus).toBe('approved');
    });

    it('still advances brand_pending on first brand approval (no false guard)', async () => {
        await seedRow('t-reg-3', 'profile_pending');
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.applyComplianceCallback('t-reg-3', {
            entity: 'brand', rawStatus: 'TWILIO_APPROVED', rejectionReason: null, entitySid: 'BN_FIRST',
        });
        expect(result.changed).toBe(true);
        expect(result.complianceStatus).toBe('brand_pending');
    });
});

// ---------------------------------------------------------------------------
// syncManagedStatus (cron twin) — brand poll must hold the same no-regress
// invariant as the webhook: a brand-approved poll must not roll campaign_pending
// backward to brand_pending.
// ---------------------------------------------------------------------------

describe('syncManagedStatus — brand poll never regresses campaign_pending', () => {
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

    it('keeps campaign_pending when the brand poll reports approved', async () => {
        const now = new Date();
        // sp10dlc row: brandSid set (brand poll path), already advanced to campaign_pending.
        await db.insert(schema.messagingCompliance).values({
            tenantId: 't-cron-reg', mode: 'managed_dedicated', complianceStatus: 'campaign_pending',
            brandSid: 'BN_X', brandStatus: 'PENDING', createdAt: now, updatedAt: now,
        } as never);
        const approvedBrandClient = {
            tollfree: { list: async () => [] as Array<{ sid: string; status: string; phoneNumber: string }> },
            brands: { list: async () => [{ sid: 'BN_X', status: 'TWILIO_APPROVED' }] },
        };
        const svc = new MessagingComplianceService({} as D1Database);
        const result = await svc.syncManagedStatus('t-cron-reg', approvedBrandClient);
        expect(result.changed).toBe(false);
        expect(result.complianceStatus).toBe('campaign_pending');
    });
});

// ---------------------------------------------------------------------------
// provision — attachSender resume: a crash AFTER buy but DURING attachSender
// must not orphan the purchased number. The resume run re-attaches (without
// re-buying) and the senderAttached marker gates the attach independently.
// ---------------------------------------------------------------------------

describe('MessagingComplianceService.provision — attachSender resume (I1)', () => {
    it('re-attaches the bought number on resume without buying a second number', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        let buyCount = 0;
        let attachCount = 0;
        let attachShouldThrow = true;
        const info = { legalName: 'Attach Co', address: '7 Main, TX', repName: 'Eve' };
        const client: WriteClient = {
            ...makeSp10dlcClient([]),
            messagingServices: {
                create: async () => ({ sid: 'MGx' }),
                attachCompliance: async () => ({}),
                attachSender: async () => {
                    attachCount++;
                    if (attachShouldThrow) throw new Error('attach failed');
                    return { sid: 'ASx' };
                },
            },
            numbers: {
                search: async (_kind: 'tollfree' | 'local') => [{ phoneNumber: '+15557770000' }],
                buy: async () => { buyCount++; return { sid: 'PNattach', phoneNumber: '+15557770000' }; },
            },
        } as never;

        // First run: throws inside attachSender (after the number is bought + persisted).
        await expect(
            new MessagingComplianceService({} as D1Database).provision('p-attach', info, 'sp10dlc', client),
        ).rejects.toThrow('attach failed');

        const mid = await fx.db.select().from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 'p-attach')).get();
        expect(mid?.provisionedNumberSid).toBe('PNattach'); // number persisted despite attach crash
        expect(mid?.senderAttached).toBe(false);            // attach not yet confirmed

        // Resume: attachSender now succeeds. Buy must NOT run again; attach completes.
        attachShouldThrow = false;
        const result = await new MessagingComplianceService({} as D1Database)
            .provision('p-attach', info, 'sp10dlc', client);

        expect(buyCount).toBe(1);      // bought exactly once across both runs
        expect(attachCount).toBe(2);   // attach retried on resume (1 failed + 1 success)
        expect(result.complianceStatus).toBe('campaign_pending');
        const final = await fx.db.select().from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 'p-attach')).get();
        expect(final?.senderAttached).toBe(true);
        fx.sqlite.close();
    });
});

// ---------------------------------------------------------------------------
// sweepManagedStatuses — must scope to managed modes only. An 'own'-mode tenant
// (BYO Twilio) must NEVER be polled against the managed ISV account, or its
// compliance state would be overwritten with an unrelated account's data (C1).
// ---------------------------------------------------------------------------

describe('sweepManagedStatuses — excludes own-mode tenants (C1)', () => {
    it('does not touch an own-mode row while sweeping managed rows', async () => {
        const fx = createTestDb(); await setupSchema(fx.sqlite);
        (mockDrizzle as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fx.db);
        const now = new Date();
        // own-mode tenant: BYO Twilio, non-terminal, tfvStatus set (TFV poll path).
        await fx.db.insert(schema.messagingCompliance).values({
            tenantId: 'own-1', mode: 'own', complianceStatus: 'tfv_pending',
            tfvStatus: 'PENDING_REVIEW', createdAt: now, updatedAt: now,
        } as never);
        // managed_dedicated tenant: should be swept and advanced.
        await fx.db.insert(schema.messagingCompliance).values({
            tenantId: 'mgd-1', mode: 'managed_dedicated', complianceStatus: 'tfv_pending',
            tfvStatus: 'PENDING_REVIEW', createdAt: now, updatedAt: now,
        } as never);

        // Fake ISV client: every TFV poll returns approved. If the own row were
        // (incorrectly) included, it would flip to approved too.
        const isvClient = {
            tollfree: { list: async () => [{ sid: 'HV_ISV', status: 'TWILIO_APPROVED', phoneNumber: '+18005550000' }] },
            brands: { list: async () => [] as Array<{ sid: string; status: string }> },
        };
        const svc = new MessagingComplianceService({} as D1Database);
        await svc.sweepManagedStatuses('AC_ISV', 'secret', 'SK_ISV', undefined, isvClient);

        const own = await fx.db.select().from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 'own-1')).get();
        const mgd = await fx.db.select().from(schema.messagingCompliance)
            .where(eq(schema.messagingCompliance.tenantId, 'mgd-1')).get();
        expect(own?.complianceStatus).toBe('tfv_pending'); // untouched — excluded by mode filter
        expect(mgd?.complianceStatus).toBe('approved');     // swept and advanced
        fx.sqlite.close();
    });
});
