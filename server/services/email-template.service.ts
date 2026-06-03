import { drizzle } from 'drizzle-orm/d1';
import { and, eq } from 'drizzle-orm';
import { emailTemplates } from '../lib/db/schema';
import type { TemplateOverride } from '../lib/email-templates/types';

/** Phase 3 — CRUD over the sparse email_templates override table. */
export class EmailTemplateService {
    constructor(private d1: D1Database) {}
    private db() { return drizzle(this.d1); }

    async listForTenant(tenantId: string): Promise<TemplateOverride[]> {
        const rows = await this.db().select().from(emailTemplates).where(eq(emailTemplates.tenantId, tenantId)).all();
        return rows.map(r => ({
            trigger: r.trigger,
            subject: r.subject ?? null,
            blocks: (r.blocks ?? null) as Record<string, string> | null,
            enabled: r.enabled,
        }));
    }

    async upsert(
        tenantId: string,
        trigger: string,
        data: { subject: string | null; blocks: Record<string, string> | null; enabled: boolean },
        nowMs: number,
    ): Promise<void> {
        // Delete-then-insert rather than onConflictDoUpdate: Drizzle emits a
        // table-qualified ON CONFLICT target (`("email_templates"."tenant_id", …)`)
        // which real D1/SQLite rejects (the better-sqlite3 test shim tolerates it —
        // a known shim/D1 divergence, see backlog C-8). A single (tenant, trigger)
        // override row has no concurrent writer, so the two statements are safe.
        const db = this.db();
        const updatedAt = new Date(nowMs);
        await db
            .delete(emailTemplates)
            .where(and(eq(emailTemplates.tenantId, tenantId), eq(emailTemplates.trigger, trigger)));
        await db
            .insert(emailTemplates)
            .values({ tenantId, trigger, subject: data.subject, blocks: data.blocks, enabled: data.enabled, updatedAt });
    }

    async remove(tenantId: string, trigger: string): Promise<void> {
        await this.db()
            .delete(emailTemplates)
            .where(and(eq(emailTemplates.tenantId, tenantId), eq(emailTemplates.trigger, trigger)));
    }
}
