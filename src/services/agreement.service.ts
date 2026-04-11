import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { agreements } from '../lib/db/schema';
import { Errors } from '../lib/errors';

/**
 * Service to manage tenant-specific agreement templates (signatures, terms).
 */
export class AgreementService {
    constructor(private db: D1Database) {}

    private getDrizzle() {
        return drizzle(this.db);
    }

    /**
     * Lists all agreement templates for a tenant.
     */
    async listAgreements(tenantId: string) {
        const db = this.getDrizzle();
        return db.select().from(agreements).where(eq(agreements.tenantId, tenantId)).all();
    }

    /**
     * Creates a new agreement template.
     */
    async createAgreement(tenantId: string, name: string, content: string) {
        const db = this.getDrizzle();
        const newAgreement = {
            id: crypto.randomUUID(),
            tenantId,
            name,
            content,
            version: 1,
            createdAt: new Date(),
        };
        await db.insert(agreements).values(newAgreement);
        return newAgreement;
    }

    /**
     * Updates an existing agreement template, incrementing the version.
     */
    async updateAgreement(id: string, tenantId: string, name?: string, content?: string) {
        const db = this.getDrizzle();
        const existing = await db.select().from(agreements).where(eq(agreements.id, id)).get();

        if (!existing || existing.tenantId !== tenantId) {
            throw Errors.NotFound('Agreement template not found');
        }

        const updateData = {
            name: name ??  existing.name,
            content: content ??  existing.content,
            version: (existing.version as number) + 1,
        };

        await db.update(agreements).set(updateData).where(eq(agreements.id, id));
        return { ...existing, ...updateData };
    }

    /**
     * Deletes an agreement template.
     */
    async deleteAgreement(id: string, tenantId: string) {
        const db = this.getDrizzle();
        const existing = await db.select().from(agreements).where(eq(agreements.id, id)).get();

        if (!existing || existing.tenantId !== tenantId) {
            throw Errors.NotFound('Agreement template not found');
        }

        await db.delete(agreements).where(eq(agreements.id, id));
    }
}
