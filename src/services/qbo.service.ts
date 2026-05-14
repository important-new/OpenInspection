import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { qboConnections, qboEntityMap, qboSyncErrors } from '../lib/db/schema/qbo';
import { encryptToken, decryptToken } from '../lib/qbo-crypto';
import { logger } from '../lib/logger';
import { QBOTokenResponseSchema } from '../lib/validations/qbo.schema';

const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const MINOR_VERSION = '75';

export interface QBOConnectionStatus {
    realmId: string;
    companyName: string | null;
    lastSyncAt: number | null;
    syncEnabled: boolean;
    openErrors: number;
    refreshTokenExpiresAt: number;
}

type QBOToken = {
    accessToken: string;
    realmId: string;
    tenantId: string;
};

export class QBOService {
    constructor(
        private db: D1Database,
        private clientId: string,
        private clientSecret: string,
        private webhookSecret: string,
        private jwtSecret: string,
    ) {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private getDrizzle() { return drizzle(this.db as any); }

    private buildBasicAuth(): string {
        return 'Basic ' + btoa(`${this.clientId}:${this.clientSecret}`);
    }

    private parseCloudEventType(type: string): { entityType: string; operation: string } | null {
        const parts = type.split('.');
        if (parts.length < 4 || parts[0] !== 'qbo') return null;
        return { entityType: parts[1], operation: parts[2] };
    }

    private async verifyWebhookSignature(rawBody: string, headerSig: string): Promise<boolean> {
        try {
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(this.webhookSecret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign'],
            );
            const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
            const computed = btoa(Array.from(new Uint8Array(sig), b => String.fromCharCode(b)).join(''));
            return computed === headerSig;
        } catch {
            return false;
        }
    }

    private toIso8601(unixSeconds: number): string {
        return new Date(unixSeconds * 1000).toISOString();
    }

    private buildDocNumber(invoiceNumber: string): string {
        return invoiceNumber.slice(0, 21);
    }

    private async getToken(tenantId: string): Promise<QBOToken> {
        const db = this.getDrizzle();
        const row = await db.select().from(qboConnections)
            .where(eq(qboConnections.tenantId, tenantId)).get();
        if (!row) throw new Error(`No QBO connection for tenant ${tenantId}`);

        const now = Math.floor(Date.now() / 1000);
        if (row.tokenExpiresAt - now < 300) {
            return this.refreshToken(tenantId);
        }
        const accessToken = await decryptToken(row.accessToken, this.jwtSecret);
        return { accessToken, realmId: row.realmId, tenantId };
    }

    private async refreshToken(tenantId: string): Promise<QBOToken> {
        const db = this.getDrizzle();
        const row = await db.select().from(qboConnections)
            .where(eq(qboConnections.tenantId, tenantId)).get();
        if (!row) throw new Error(`No QBO connection for tenant ${tenantId}`);

        const currentRefresh = await decryptToken(row.refreshToken, this.jwtSecret);
        const resp = await fetch(QBO_TOKEN_URL, {
            method: 'POST',
            headers: {
                Authorization: this.buildBasicAuth(),
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: currentRefresh,
            }),
        });

        if (!resp.ok) {
            await db.delete(qboConnections).where(eq(qboConnections.tenantId, tenantId));
            throw new Error('QBO token refresh failed — reconnect required');
        }

        const data = QBOTokenResponseSchema.parse(await resp.json());
        const now = Math.floor(Date.now() / 1000);

        await db.update(qboConnections).set({
            accessToken:           await encryptToken(data.access_token, this.jwtSecret),
            refreshToken:          await encryptToken(data.refresh_token, this.jwtSecret),
            tokenExpiresAt:        now + 3600,
            refreshTokenExpiresAt: now + data.x_refresh_token_expires_in,
        }).where(eq(qboConnections.tenantId, tenantId));

        return { accessToken: data.access_token, realmId: row.realmId, tenantId };
    }

    private async revokeToken(tenantId: string): Promise<void> {
        try {
            const db = this.getDrizzle();
            const row = await db.select().from(qboConnections)
                .where(eq(qboConnections.tenantId, tenantId)).get();
            if (!row) return;
            const refreshToken = await decryptToken(row.refreshToken, this.jwtSecret);
            await fetch(QBO_REVOKE_URL, {
                method: 'POST',
                headers: {
                    Authorization: this.buildBasicAuth(),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({ token: refreshToken }),
            });
        } catch (e) {
            logger.error('QBO revokeToken failed (non-fatal)', {}, e instanceof Error ? e : undefined);
        }
    }

    private async apiCall<T>(
        tenantId: string,
        method: 'GET' | 'POST' | 'PUT',
        path: string,
        body?: unknown,
    ): Promise<T> {
        const { accessToken, realmId } = await this.getToken(tenantId);
        const separator = path.includes('?') ? '&' : '?';
        const url = `${QBO_API_BASE}/${realmId}/${path}${separator}minorversion=${MINOR_VERSION}`;

        const opts: RequestInit = {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
        };
        if (body !== undefined) opts.body = JSON.stringify(body);

        let lastError: Error | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, 2 ** attempt * 500));
            const resp = await fetch(url, opts);
            if (resp.ok) return resp.json() as T;
            if (resp.status === 429) {
                const retryAfter = parseInt(resp.headers.get('Retry-After') ?? '60', 10);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
                continue;
            }
            if (resp.status >= 500) {
                lastError = new Error(`QBO ${resp.status}`);
                continue;
            }
            const err = await resp.json().catch(() => ({})) as Record<string, unknown>;
            throw Object.assign(new Error(`QBO ${resp.status}`), { qboResponse: err, status: resp.status });
        }
        throw lastError ?? new Error('QBO API call failed after retries');
    }

    private async qboQuery<T>(tenantId: string, query: string): Promise<T> {
        return this.apiCall<T>(tenantId, 'GET', `query?query=${encodeURIComponent(query)}`);
    }

    private async logSyncError(tenantId: string, oiType: string, oiId: string, error: unknown): Promise<void> {
        const db = this.getDrizzle();
        const now = Math.floor(Date.now() / 1000);
        const msg = error instanceof Error ? error.message : String(error);
        const existing = await db.select().from(qboSyncErrors)
            .where(and(
                eq(qboSyncErrors.tenantId, tenantId),
                eq(qboSyncErrors.oiType, oiType),
                eq(qboSyncErrors.oiId, oiId),
                eq(qboSyncErrors.resolved, 0),
            )).get();

        if (existing) {
            await db.update(qboSyncErrors).set({
                retries:   existing.retries + 1,
                errorMsg:  msg,
                updatedAt: now,
            }).where(eq(qboSyncErrors.id, existing.id));
        } else {
            await db.insert(qboSyncErrors).values({
                id:        crypto.randomUUID(),
                tenantId,
                oiType,
                oiId,
                errorCode: 'SYNC_ERROR',
                errorMsg:  msg,
                retries:   0,
                resolved:  0,
                createdAt: now,
                updatedAt: now,
            });
        }
    }

    /**
     * Verifies and dispatches an inbound QBO Cloud Event webhook.
     * Returns false if the signature is invalid or the event type is unrecognized.
     */
    async handleWebhookEvent(
        tenantId: string,
        rawBody: string,
        signature: string,
        eventType: string,
        entityId: string,
        occurredAt: number,
    ): Promise<boolean> {
        const valid = await this.verifyWebhookSignature(rawBody, signature);
        if (!valid) {
            logger.warn('QBO webhook signature mismatch', { tenantId });
            return false;
        }

        const parsed = this.parseCloudEventType(eventType);
        if (!parsed) {
            logger.warn('QBO webhook unrecognized event type', { tenantId, eventType });
            return false;
        }

        try {
            logger.info('QBO webhook received', {
                tenantId,
                entityType: parsed.entityType,
                operation:  parsed.operation,
                entityId,
                occurredAt: this.toIso8601(occurredAt),
                docRef:     this.buildDocNumber(entityId),
            });
        } catch (e) {
            await this.logSyncError(tenantId, parsed.entityType, entityId, e);
            return false;
        }

        return true;
    }

    async getConnectionStatus(tenantId: string): Promise<QBOConnectionStatus | null> {
        const db = this.getDrizzle();
        const row = await db.select().from(qboConnections)
            .where(eq(qboConnections.tenantId, tenantId)).get();
        if (!row) return null;
        const errorCount = await db.select().from(qboSyncErrors)
            .where(and(eq(qboSyncErrors.tenantId, tenantId), eq(qboSyncErrors.resolved, 0))).all();
        return {
            realmId:               row.realmId,
            companyName:           row.companyName,
            lastSyncAt:            row.lastSyncAt,
            syncEnabled:           row.syncEnabled === 1,
            openErrors:            errorCount.length,
            refreshTokenExpiresAt: row.refreshTokenExpiresAt,
        };
    }

    async disconnect(tenantId: string): Promise<void> {
        await this.revokeToken(tenantId);
        const db = this.getDrizzle();
        await db.delete(qboEntityMap).where(eq(qboEntityMap.tenantId, tenantId));
        await db.delete(qboConnections).where(eq(qboConnections.tenantId, tenantId));
    }

    async searchCustomer(tenantId: string, email: string): Promise<{ Id: string; DisplayName: string } | null> {
        try {
            const result = await this.qboQuery<{ QueryResponse: { Customer?: Array<{ Id: string; DisplayName: string }> } }>(
                tenantId,
                `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}' MAXRESULTS 1`,
            );
            return result.QueryResponse.Customer?.[0] ?? null;
        } catch {
            return null;
        }
    }

    async linkExistingCustomer(tenantId: string, contactId: string, qboCustomerId: string): Promise<void> {
        const db = this.getDrizzle();
        const now = Math.floor(Date.now() / 1000);
        await db.insert(qboEntityMap).values({
            id:           crypto.randomUUID(),
            tenantId,
            oiType:       'contact',
            oiId:         contactId,
            qboType:      'Customer',
            qboId:        qboCustomerId,
            qboSyncToken: '0',
            syncedAt:     now,
        }).onConflictDoUpdate({
            target: [qboEntityMap.tenantId, qboEntityMap.oiType, qboEntityMap.oiId],
            set: { qboId: qboCustomerId, syncedAt: now },
        });
    }
}

