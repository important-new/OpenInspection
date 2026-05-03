import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { recommendations } from '../lib/db/schema';
import { Errors } from '../lib/errors';

export type Recommendation = InferSelectModel<typeof recommendations>;

export interface CreateRecommendationInput {
    category?:            string | null | undefined;
    name:                 string;
    severity:             'satisfactory' | 'monitor' | 'defect';
    defaultEstimateMin?:  number | null | undefined;
    defaultEstimateMax?:  number | null | undefined;
    defaultRepairSummary: string;
    createdByUserId?:     string | null | undefined;
}
export type UpdateRecommendationInput = Partial<Omit<CreateRecommendationInput, never>>;

export class RecommendationService {
    constructor(private db: D1Database) {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getDrizzle() { return drizzle(this.db as any); }

    async create(tenantId: string, input: CreateRecommendationInput): Promise<Recommendation> {
        const db = this.getDrizzle();
        const row = {
            id:                   crypto.randomUUID(),
            tenantId,
            category:             input.category ?? null,
            name:                 input.name,
            severity:             input.severity,
            defaultEstimateMin:   input.defaultEstimateMin ?? null,
            defaultEstimateMax:   input.defaultEstimateMax ?? null,
            defaultRepairSummary: input.defaultRepairSummary,
            createdByUserId:      input.createdByUserId ?? null,
            createdAt:            new Date(),
        };
        await db.insert(recommendations).values(row);
        return row as Recommendation;
    }

    async getById(id: string, tenantId: string): Promise<Recommendation | null> {
        const db = this.getDrizzle();
        const row = await db.select().from(recommendations)
            .where(and(eq(recommendations.id, id), eq(recommendations.tenantId, tenantId)))
            .get();
        return row ?? null;
    }

    async listByTenant(tenantId: string, filter?: { category?: string; severity?: 'satisfactory' | 'monitor' | 'defect' }): Promise<Recommendation[]> {
        const db = this.getDrizzle();
        const conditions = [eq(recommendations.tenantId, tenantId)];
        if (filter?.category) conditions.push(eq(recommendations.category, filter.category));
        if (filter?.severity) conditions.push(eq(recommendations.severity, filter.severity));
        return db.select().from(recommendations).where(and(...conditions)).all();
    }

    async update(id: string, tenantId: string, patch: UpdateRecommendationInput): Promise<Recommendation> {
        const db = this.getDrizzle();
        const existing = await this.getById(id, tenantId);
        if (!existing) throw Errors.NotFound('Recommendation not found');
        const updates: Partial<Recommendation> = {};
        if (patch.category !== undefined)             updates.category             = patch.category ?? null;
        if (patch.name !== undefined)                 updates.name                 = patch.name;
        if (patch.severity !== undefined)             updates.severity             = patch.severity;
        if (patch.defaultEstimateMin !== undefined)   updates.defaultEstimateMin   = patch.defaultEstimateMin ?? null;
        if (patch.defaultEstimateMax !== undefined)   updates.defaultEstimateMax   = patch.defaultEstimateMax ?? null;
        if (patch.defaultRepairSummary !== undefined) updates.defaultRepairSummary = patch.defaultRepairSummary;
        await db.update(recommendations).set(updates)
            .where(and(eq(recommendations.id, id), eq(recommendations.tenantId, tenantId)));
        const refetched = await this.getById(id, tenantId);
        if (!refetched) throw Errors.Internal('Failed to read back updated recommendation');
        return refetched;
    }

    async delete(id: string, tenantId: string): Promise<void> {
        const db = this.getDrizzle();
        await db.delete(recommendations)
            .where(and(eq(recommendations.id, id), eq(recommendations.tenantId, tenantId)));
    }
}
