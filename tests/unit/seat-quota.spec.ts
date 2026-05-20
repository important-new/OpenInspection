import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb, setupSchema } from './db';
import { tenants, users } from '../../src/lib/db/schema';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/lib/db/schema';

// Mock the drizzle-orm/d1 module so the helper's `drizzle(d1)` call returns
// our in-memory SQLite-backed Drizzle instance instead of a real D1 client.
vi.mock('drizzle-orm/d1', () => ({
    drizzle: vi.fn(),
}));

import { drizzle as mockDrizzle } from 'drizzle-orm/d1';
import { getSeatUsage } from '../../src/features/seat-quota/usage';

describe('getSeatUsage', () => {
    let testDb: BetterSQLite3Database<typeof schema>;
    let sqlite: any;

    beforeEach(async () => {
        const setup = createTestDb();
        testDb = setup.db;
        sqlite = setup.sqlite;
        await setupSchema(sqlite);
        (mockDrizzle as any).mockReturnValue(testDb);
    });

    async function seedTenant(id: string, maxUsers: number) {
        await testDb.insert(tenants).values({
            id,
            name: `Tenant ${id}`,
            subdomain: id,
            maxUsers,
            createdAt: new Date(),
        });
    }

    async function seedUsers(tenantId: string, count: number) {
        for (let i = 0; i < count; i++) {
            await testDb.insert(users).values({
                id: `${tenantId}-u${i}`,
                tenantId,
                email: `${tenantId}-u${i}@example.com`,
                passwordHash: 'x',
                role: 'inspector',
                createdAt: new Date(),
            });
        }
    }

    it('returns {used, max, remaining} with positive remaining', async () => {
        await seedTenant('t1', 10);
        await seedUsers('t1', 3);

        const usage = await getSeatUsage('t1', {} as any);
        expect(usage).toEqual({ used: 3, max: 10, remaining: 7 });
    });

    it('returns remaining = 0 when at limit', async () => {
        await seedTenant('t1', 5);
        await seedUsers('t1', 5);

        const usage = await getSeatUsage('t1', {} as any);
        expect(usage.used).toBe(5);
        expect(usage.max).toBe(5);
        expect(usage.remaining).toBe(0);
    });

    it('returns remaining = 0 (not negative) when over limit', async () => {
        await seedTenant('t1', 3);
        await seedUsers('t1', 5);

        const usage = await getSeatUsage('t1', {} as any);
        expect(usage.used).toBe(5);
        expect(usage.max).toBe(3);
        expect(usage.remaining).toBe(0);
    });

    it('returns remaining = Infinity when maxUsers is 0 (unlimited sentinel)', async () => {
        // The schema column is NOT NULL with default 3, so unlimited is
        // expressed as 0 in DB. The helper treats 0/null as unlimited.
        await seedTenant('t1', 0);
        await seedUsers('t1', 3);

        const usage = await getSeatUsage('t1', {} as any);
        expect(usage.used).toBe(3);
        expect(usage.max).toBe(null);
        expect(usage.remaining).toBe(Number.POSITIVE_INFINITY);
    });

    it('scopes user count to the tenant', async () => {
        await seedTenant('t1', 10);
        await seedTenant('t2', 10);
        await seedUsers('t1', 2);
        await seedUsers('t2', 4);

        const usage = await getSeatUsage('t1', {} as any);
        expect(usage.used).toBe(2);
        expect(usage.remaining).toBe(8);
    });
});
