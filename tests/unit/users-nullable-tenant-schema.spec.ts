import { describe, it, expect, beforeEach } from 'vitest';
import { users } from '../../src/lib/db/schema/tenant';
import { createTestDb, setupSchema } from './db';

describe('users schema — A1', () => {
    let sqlite: import('better-sqlite3').Database;

    beforeEach(async () => {
        const fixture = createTestDb();
        sqlite = fixture.sqlite;
        await setupSchema(sqlite);
    });

    it('users.tenant_id is nullable in Drizzle schema', () => {
        const col = (users as unknown as { tenantId: { notNull?: boolean } }).tenantId;
        expect(col.notNull).toBe(false);
    });

    it('users.email has a global UNIQUE constraint after migration 0055', () => {
        // After migration 0055, the unique constraint on email is global (not per-tenant).
        // Insert two rows with the same email but different tenant_ids and expect a constraint failure.
        const row1 = sqlite.prepare(
            `INSERT INTO tenants (id, name, subdomain, tier, status, max_users, deployment_mode, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        );
        row1.run('t-a', 'A', 'aco', 'free', 'active', 5, 'shared', Date.now());
        row1.run('t-b', 'B', 'bco', 'free', 'active', 5, 'shared', Date.now());

        const insertUser = sqlite.prepare(
            `INSERT INTO users (id, tenant_id, email, password_hash, role, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
        );
        insertUser.run('u1', 't-a', 'jane@realty.com', 'h', 'inspector', Date.now());
        expect(() =>
            insertUser.run('u2', 't-b', 'jane@realty.com', 'h', 'inspector', Date.now()),
        ).toThrow(/UNIQUE constraint/);
    });

    it('agent users (tenant_id NULL) are accepted by the rebuilt schema', () => {
        // Insert a row with tenant_id NULL — this must succeed after migration 0055.
        const insertAgent = sqlite.prepare(
            `INSERT INTO users (id, tenant_id, email, password_hash, role, created_at)
             VALUES (?, NULL, ?, ?, 'agent', ?)`,
        );
        expect(() => insertAgent.run('agent1', 'jane@realty.com', 'h', Date.now())).not.toThrow();
    });
});
