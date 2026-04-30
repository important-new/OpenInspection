import { drizzle } from 'drizzle-orm/d1';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { customerMessages, inspections } from '../lib/db/schema';
import type { MessageAttachment } from '../lib/db/schema';
import { Errors } from '../lib/errors';

interface CreateMessageInput {
    tenantId: string;
    inspectionId: string;
    fromRole: 'client' | 'inspector';
    fromName?: string | null;
    body: string;
    attachments: MessageAttachment[];
}

export class MessageService {
    constructor(private d1: D1Database) {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private db() { return drizzle(this.d1 as any); }

    async createMessage(input: CreateMessageInput) {
        const id = crypto.randomUUID();
        const now = Date.now();
        await this.db().insert(customerMessages).values({
            id,
            tenantId: input.tenantId,
            inspectionId: input.inspectionId,
            fromRole: input.fromRole,
            fromName: input.fromName ?? null,
            body: input.body,
            attachments: input.attachments,
            readAt: null,
            createdAt: now,
        });
        const [row] = await this.db().select().from(customerMessages).where(eq(customerMessages.id, id)).limit(1);
        if (!row) throw Errors.Internal('Failed to create message');
        return row;
    }

    async listForInspection(inspectionId: string, tenantId: string) {
        return this.db().select().from(customerMessages)
            .where(and(eq(customerMessages.inspectionId, inspectionId), eq(customerMessages.tenantId, tenantId)))
            .orderBy(customerMessages.createdAt);
    }

    async markAllReadForRole(inspectionId: string, tenantId: string, fromRole: 'client' | 'inspector') {
        await this.db().update(customerMessages)
            .set({ readAt: Date.now() })
            .where(and(
                eq(customerMessages.inspectionId, inspectionId),
                eq(customerMessages.tenantId, tenantId),
                eq(customerMessages.fromRole, fromRole),
                isNull(customerMessages.readAt),
            ));
    }

    async unreadCountForTenant(tenantId: string): Promise<number> {
        const [row] = await this.db().select({ c: sql<number>`count(*)` })
            .from(customerMessages)
            .where(and(
                eq(customerMessages.tenantId, tenantId),
                eq(customerMessages.fromRole, 'client'),
                isNull(customerMessages.readAt),
            ));
        return Number(row?.c ?? 0);
    }

    async getOrCreateToken(inspectionId: string, tenantId: string): Promise<string> {
        const [insp] = await this.db().select().from(inspections)
            .where(and(eq(inspections.id, inspectionId), eq(inspections.tenantId, tenantId)))
            .limit(1);
        if (!insp) throw Errors.NotFound('Inspection not found');
        if (insp.messageToken) return insp.messageToken;
        const token = crypto.randomUUID().replace(/-/g, '');
        await this.db().update(inspections).set({ messageToken: token })
            .where(and(eq(inspections.id, inspectionId), eq(inspections.tenantId, tenantId)));
        return token;
    }

    async resolveByToken(token: string): Promise<typeof inspections.$inferSelect | null> {
        if (!token || token.length < 16) return null;
        const [insp] = await this.db().select().from(inspections).where(eq(inspections.messageToken, token)).limit(1);
        return insp ?? null;
    }
}
