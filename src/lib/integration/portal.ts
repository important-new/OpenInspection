import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { tenants, users } from '../db/schema';
import { IntegrationProvider, TenantUpdateParams, ProviderCapabilities } from '../integration';

/**
 * Portal implementation of IntegrationProvider.
 * Used in the SaaS version where Core is tightly coupled with the SaaS Portal.
 */
export class PortalProvider implements IntegrationProvider {
    constructor(private db: D1Database, private kv?: KVNamespace) {}

    private getDrizzle() {
        return drizzle(this.db);
    }

    async handleTenantUpdate(params: TenantUpdateParams): Promise<void> {
        const db = this.getDrizzle();
        const { subdomain, status, tier, name, adminEmail, adminPasswordHash } = params;

        // Upsert tenant
        const existingTenant = await db.query.tenants.findFirst({
            where: eq(tenants.subdomain, subdomain),
        });

        if (!existingTenant) {
            await db.insert(tenants).values({
                subdomain,
                name: name || subdomain,
                status: (status as any) || 'active',
                tier: tier || 'free',
            });
        } else {
            await db.update(tenants)
                .set({
                    status: (status as any) || existingTenant.status,
                    tier: tier || existingTenant.tier,
                    name: name || existingTenant.name,
                })
                .where(eq(tenants.subdomain, subdomain));
        }

        // Handle Admin Sync if provided
        if (adminEmail && adminPasswordHash) {
            const existingUser = await db.query.users.findFirst({
                where: eq(users.email, adminEmail),
            });

            if (!existingUser) {
                await db.insert(users).values({
                    email: adminEmail,
                    passwordHash: adminPasswordHash,
                    role: 'owner',
                    name: 'Administrator',
                });
            } else {
                await db.update(users)
                    .set({ passwordHash: adminPasswordHash })
                    .where(eq(users.id, existingUser.id));
            }
        }

        // Clear cache if KV exists
        if (this.kv) {
            await this.kv.delete(`tenant:${subdomain}`);
        }
    }

    async handleStripeConnect(subdomain: string, accountId: string): Promise<void> {
        const db = this.getDrizzle();
        await db.update(tenants)
            .set({ stripeConnectAccountId: accountId })
            .where(eq(tenants.subdomain, subdomain));
        
        if (this.kv) {
            await this.kv.delete(`tenant:${subdomain}`);
        }
    }

    getCapabilities(): ProviderCapabilities {
        return {
            allowsM2M: true,
            requiresPortalAuth: true,
            supportsSiloProvisioning: true
        };
    }
}
