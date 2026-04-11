import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { tenantConfigs } from '../lib/db/schema';
import { Errors } from '../lib/errors';

/**
 * Service to handle tenant-specific branding and configuration.
 */
export class BrandingService {
    constructor(private db: D1Database, private kv?: KVNamespace, private r2?: R2Bucket) {}

    private getDrizzle() {
        return drizzle(this.db);
    }

    /**
     * Fetches the current branding configuration for a tenant.
     * Falls back to system defaults if no configuration exists.
     */
    async getBranding(tenantId: string, defaults: { siteName: string; primaryColor: string; supportEmail: string }) {
        const db = this.getDrizzle();
        const config = await db.select().from(tenantConfigs).where(eq(tenantConfigs.tenantId, tenantId)).get();

        return config ??  {
            siteName: defaults.siteName,
            primaryColor: defaults.primaryColor,
            logoUrl: null,
            supportEmail: defaults.supportEmail,
            billingUrl: '',
            gaMeasurementId: ''
        };
    }

    /**
     * Updates the branding configuration for a tenant.
     */
    async updateBranding(tenantId: string, data: Partial<typeof tenantConfigs.$inferInsert>) {
        const db = this.getDrizzle();
        const existing = await db.select().from(tenantConfigs).where(eq(tenantConfigs.tenantId, tenantId)).get();

        const updateData = {
            ...data,
            tenantId,
            updatedAt: new Date()
        };

        if (existing) {
            await db.update(tenantConfigs).set(updateData).where(eq(tenantConfigs.tenantId, tenantId));
        } else {
            await db.insert(tenantConfigs).values(updateData as typeof tenantConfigs.$inferInsert);
        }

        // Invalidate KV cache
        if (this.kv) {
            await this.kv.delete(`branding:${tenantId}`);
        }
        
        return updateData;
    }

    /**
     * Uploads a logo to R2 and updates the tenant configuration.
     */
    async uploadLogo(tenantId: string, file: File) {
        if (!this.r2) throw Errors.BadRequest('Logo upload not available');

        const extension = file.type.split('/')[1] === 'svg+xml' ? 'svg' : file.type.split('/')[1];
        const key = `branding/${tenantId}/logo-${Date.now()}.${extension}`;

        await this.r2.put(key, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type },
        });

        const logoUrl = `/api/inspections/photo/${key}`;
        await this.updateBranding(tenantId, { logoUrl });

        return logoUrl;
    }
}
