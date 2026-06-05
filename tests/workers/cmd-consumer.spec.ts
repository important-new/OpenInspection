// A-21 — core cmd-consumer path under real workerd: dedup, seq guard, park,
// apply (tenant upsert + quota), per-message ack/retry.
import { env } from 'cloudflare:test';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { applyCmdEnvelope, handleCmdBatch } from '../../server/portal/cmd-consumer';

const b = env as unknown as { DB: D1Database };

function envelope(over: Partial<{ id: string; type: string; dataschema: string; tenantseq: number; data: Record<string, unknown> }> = {}) {
    return {
        specversion: '1.0',
        id: over.id ?? crypto.randomUUID(),
        type: over.type ?? 'io.inspectorhub.cmd.tenant.update',
        source: 'portal',
        time: '2026-06-05T00:00:00.000Z',
        dataschema: over.dataschema ?? 'cmd-tenant-update/v1',
        tenantseq: over.tenantseq ?? 1,
        data: over.data ?? { tenantId: 'ct1', slug: 'ws-1', status: 'active', name: 'WS One', maxUsers: 5 },
    };
}

async function seedSchema(): Promise<void> {
    await b.DB.exec(
        "CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, tier TEXT NOT NULL DEFAULT 'free', stripe_connect_account_id TEXT, status TEXT NOT NULL DEFAULT 'pending', max_users INTEGER NOT NULL DEFAULT 5, deployment_mode TEXT NOT NULL DEFAULT 'shared', nachi_number TEXT, applied_cmd_seq INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);",
    );
    await b.DB.exec(
        "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tenant_id TEXT, email TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', created_at INTEGER NOT NULL);",
    );
    await b.DB.exec(
        'CREATE TABLE IF NOT EXISTS processed_cmd_events (event_id TEXT PRIMARY KEY, cmd_type TEXT NOT NULL, processed_at INTEGER NOT NULL);',
    );
    await b.DB.exec(
        'CREATE TABLE IF NOT EXISTS parked_cmd_events (id TEXT PRIMARY KEY, envelope TEXT NOT NULL, reason TEXT NOT NULL, received_at INTEGER NOT NULL);',
    );
}

async function clearTables(): Promise<void> {
    for (const t of ['processed_cmd_events', 'parked_cmd_events', 'users', 'tenants']) {
        await b.DB.exec(`DELETE FROM ${t};`);
    }
}

describe('core cmd consumer — real D1 (A-21)', () => {
    beforeAll(seedSchema);
    beforeEach(clearTables);

    it('tenant.update upserts a new tenant and advances applied_cmd_seq', async () => {
        const result = await applyCmdEnvelope(b.DB, undefined, envelope({ tenantseq: 1 }));
        expect(result).toBe('applied');
        const t = await b.DB.prepare('SELECT slug, status, applied_cmd_seq FROM tenants WHERE id = ?')
            .bind('ct1').first<{ slug: string; status: string; applied_cmd_seq: number }>();
        expect(t?.slug).toBe('ws-1');
        expect(t?.status).toBe('active');
        expect(t?.applied_cmd_seq).toBe(1);
    });

    it('duplicate envelope id is dropped by dedup', async () => {
        const e = envelope({ tenantseq: 1 });
        expect(await applyCmdEnvelope(b.DB, undefined, e)).toBe('applied');
        expect(await applyCmdEnvelope(b.DB, undefined, e)).toBe('duplicate');
    });

    it('stale command (lower tenantseq) is dropped — suspend cannot undo a later activate', async () => {
        expect(await applyCmdEnvelope(b.DB, undefined, envelope({
            tenantseq: 2, data: { tenantId: 'ct1', slug: 'ws-1', status: 'active' },
        }))).toBe('applied');
        expect(await applyCmdEnvelope(b.DB, undefined, envelope({
            tenantseq: 1, data: { tenantId: 'ct1', slug: 'ws-1', status: 'suspended' },
        }))).toBe('stale');
        const t = await b.DB.prepare('SELECT status FROM tenants WHERE id = ?').bind('ct1').first<{ status: string }>();
        expect(t?.status).toBe('active');
    });

    it('sync_quota applies to an existing tenant; unknown tenant throws (retryable race)', async () => {
        await applyCmdEnvelope(b.DB, undefined, envelope({ tenantseq: 1 }));
        expect(await applyCmdEnvelope(b.DB, undefined, envelope({
            type: 'io.inspectorhub.cmd.tenant.sync_quota',
            dataschema: 'cmd-tenant-sync-quota/v1',
            tenantseq: 2,
            data: { tenantId: 'ct1', maxUsers: 11 },
        }))).toBe('applied');
        const t = await b.DB.prepare('SELECT max_users FROM tenants WHERE id = ?').bind('ct1').first<{ max_users: number }>();
        expect(t?.max_users).toBe(11);
        await expect(applyCmdEnvelope(b.DB, undefined, envelope({
            type: 'io.inspectorhub.cmd.tenant.sync_quota',
            dataschema: 'cmd-tenant-sync-quota/v1',
            tenantseq: 1,
            data: { tenantId: 'ghost', maxUsers: 3 },
        }))).rejects.toThrow(/tenant not found/);
    });

    it('unknown type/version and parse failures park (never throw)', async () => {
        expect(await applyCmdEnvelope(b.DB, undefined, envelope({
            type: 'io.inspectorhub.cmd.future.thing', dataschema: 'cmd-future-thing/v1',
        }))).toBe('parked');
        expect(await applyCmdEnvelope(b.DB, undefined, 'not json at all {{')).toBe('parked');
        const n = await b.DB.prepare('SELECT count(*) AS n FROM parked_cmd_events').first<{ n: number }>();
        expect(n?.n).toBe(2);
    });

    it('handleCmdBatch acks applied/parked and retries failures per-message with backoff', async () => {
        const acks: string[] = [];
        const retries: Array<{ id: string; delaySeconds?: number }> = [];
        const mk = (id: string, body: unknown, attempts = 1) => ({
            id, timestamp: new Date(), body, attempts,
            ack: () => acks.push(id),
            retry: (o?: { delaySeconds?: number }) => retries.push({ id, delaySeconds: o?.delaySeconds }),
        });
        const batch = {
            queue: 'inspectorhub-cmd-saas',
            messages: [
                mk('ok', envelope({ tenantseq: 1 })),
                mk('park', 'garbage {{'),
                mk('boom', envelope({
                    type: 'io.inspectorhub.cmd.tenant.sync_quota',
                    dataschema: 'cmd-tenant-sync-quota/v1',
                    tenantseq: 5, data: { tenantId: 'ghost', maxUsers: 1 },
                }), 2),
            ],
            ackAll: () => {}, retryAll: () => {},
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await handleCmdBatch(b.DB, undefined, batch as any);
        expect(acks).toEqual(['ok', 'park']);
        expect(retries).toEqual([{ id: 'boom', delaySeconds: 120 }]);
    });
});
