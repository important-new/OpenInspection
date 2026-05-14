import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import type { HonoConfig } from '../types/hono';
import { QBOService } from '../services/qbo.service';
import { encryptToken } from '../lib/qbo-crypto';
import { QBOTokenResponseSchema, QBOCompanyInfoResponseSchema, QBOLinkCustomerBodySchema } from '../lib/validations/qbo.schema';
import { logger } from '../lib/logger';
import { drizzle } from 'drizzle-orm/d1';
import { qboConnections, qboSyncErrors } from '../lib/db/schema/qbo';
import { eq, and } from 'drizzle-orm';

const api = new Hono<HonoConfig>();

function getQBOService(env: HonoConfig['Bindings']): QBOService {
    if (!env.QBO_CLIENT_ID || !env.QBO_CLIENT_SECRET) {
        throw new Error('QBO credentials not configured');
    }
    return new QBOService(
        env.DB,
        env.QBO_CLIENT_ID,
        env.QBO_CLIENT_SECRET,
        env.QBO_WEBHOOK_SECRET ?? '',
        env.JWT_SECRET,
    );
}

// Auth guard for all QBO settings routes
api.use('*', async (c, next) => {
    const token = getCookie(c, '__Host-inspector_token') ?? getCookie(c, 'inspector_token');
    if (!token) return c.redirect('/login');
    try {
        await verify(token, c.env.JWT_SECRET, 'HS256');
        return next();
    } catch {
        return c.redirect('/login');
    }
});

// GET /status — connection status JSON (for Alpine)
api.get('/status', async (c) => {
    const tenantId = c.get('tenantId') as string;
    const svc = getQBOService(c.env);
    const status = await svc.getConnectionStatus(tenantId);
    return c.json({ success: true, data: status });
});

// GET /connect — initiate OAuth flow
api.get('/connect', async (c) => {
    if (!c.env.QBO_CLIENT_ID || !c.env.QBO_CLIENT_SECRET) {
        return c.html('<p>QBO credentials not configured</p>', 503);
    }
    if (!c.env.APP_BASE_URL) {
        return c.html('<p>APP_BASE_URL not configured</p>', 503);
    }
    const state = crypto.randomUUID();
    await c.env.TENANT_CACHE.put(`qbo_oauth_state:${state}`, '1', { expirationTtl: 600 });
    const redirectUri = `${c.env.APP_BASE_URL}/settings/integrations/qbo/callback`;
    const url = new URL('https://appcenter.intuit.com/connect/oauth2');
    url.searchParams.set('client_id', c.env.QBO_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'com.intuit.quickbooks.accounting');
    url.searchParams.set('state', state);
    return c.redirect(url.toString());
});

// GET /callback — OAuth token exchange
api.get('/callback', async (c) => {
    const code = c.req.query('code') ?? '';
    const state = c.req.query('state') ?? '';
    const realmId = c.req.query('realmId') ?? '';
    const error = c.req.query('error');

    if (error) return c.redirect('/settings/integrations/qbo?error=' + encodeURIComponent(error));

    const stored = await c.env.TENANT_CACHE.get(`qbo_oauth_state:${state}`);
    if (!stored) return c.redirect('/settings/integrations/qbo?error=invalid_state');
    await c.env.TENANT_CACHE.delete(`qbo_oauth_state:${state}`);

    const redirectUri = `${c.env.APP_BASE_URL ?? ''}/settings/integrations/qbo/callback`;
    const basicAuth = 'Basic ' + btoa(`${c.env.QBO_CLIENT_ID ?? ''}:${c.env.QBO_CLIENT_SECRET ?? ''}`);

    try {
        const tokenResp = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
            method: 'POST',
            headers: {
                Authorization: basicAuth,
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
            },
            body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
        });
        if (!tokenResp.ok) throw new Error('Token exchange failed');
        const tokens = QBOTokenResponseSchema.parse(await tokenResp.json());
        const now = Math.floor(Date.now() / 1000);
        const tenantId = c.get('tenantId') as string;

        let companyName: string | null = null;
        try {
            const infoResp = await fetch(
                `https://quickbooks.api.intuit.com/v3/company/${realmId}/companyinfo/${realmId}?minorversion=75`,
                { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' } },
            );
            if (infoResp.ok) {
                const info = QBOCompanyInfoResponseSchema.parse(await infoResp.json());
                companyName = info.CompanyInfo.CompanyName;
            }
        } catch { /* non-fatal */ }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [encAccessToken, encRefreshToken] = await Promise.all([
            encryptToken(tokens.access_token, c.env.JWT_SECRET),
            encryptToken(tokens.refresh_token, c.env.JWT_SECRET),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = drizzle(c.env.DB as any);
        await db.insert(qboConnections).values({
            tenantId,
            realmId,
            companyName,
            accessToken:           encAccessToken,
            refreshToken:          encRefreshToken,
            tokenExpiresAt:        now + 3600,
            refreshTokenExpiresAt: now + tokens.x_refresh_token_expires_in,
            syncEnabled:           1,
            defaultItemId:         '1',
            createdAt:             now,
        }).onConflictDoUpdate({
            target: qboConnections.tenantId,
            set: {
                realmId,
                companyName,
                accessToken:           encAccessToken,
                refreshToken:          encRefreshToken,
                tokenExpiresAt:        now + 3600,
                refreshTokenExpiresAt: now + tokens.x_refresh_token_expires_in,
            },
        });

        const svc = getQBOService(c.env);
        c.executionCtx.waitUntil(svc.bootstrapDefaultItem(tenantId));

        return c.redirect('/settings/integrations/qbo?connected=1');
    } catch (e) {
        logger.error('QBO OAuth callback failed', { realmId }, e instanceof Error ? e : undefined);
        return c.redirect('/settings/integrations/qbo?error=oauth_failed');
    }
});

// POST /disconnect
api.post('/disconnect', async (c) => {
    const tenantId = c.get('tenantId') as string;
    const svc = getQBOService(c.env);
    await svc.disconnect(tenantId);
    return c.json({ success: true });
});

// POST /pause — toggle sync on/off
api.post('/pause', async (c) => {
    const tenantId = c.get('tenantId') as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = drizzle(c.env.DB as any);
    const row = await db.select().from(qboConnections).where(eq(qboConnections.tenantId, tenantId)).get();
    if (!row) return c.json({ success: false, error: 'Not connected' }, 404);
    const newEnabled = row.syncEnabled === 1 ? 0 : 1;
    await db.update(qboConnections).set({ syncEnabled: newEnabled }).where(eq(qboConnections.tenantId, tenantId));
    return c.json({ success: true, syncEnabled: newEnabled === 1 });
});

// POST /sync — manual CDC trigger
api.post('/sync', async (c) => {
    const tenantId = c.get('tenantId') as string;
    const svc = getQBOService(c.env);
    const invoiceSvc = c.var.services.invoice;
    c.executionCtx.waitUntil(
        svc.runCDCSync(
            tenantId,
            (invoiceId, tid) => invoiceSvc.markPaid(invoiceId, tid, 'qbo'),
            (invoiceId, _balance, tid) => invoiceSvc.markPartial(invoiceId, tid, 'qbo'),
        ),
    );
    return c.json({ success: true, message: 'Sync started' });
});

// POST /errors/:id/retry — dismiss/resolve an error
api.post('/errors/:id/retry', async (c) => {
    const tenantId = c.get('tenantId') as string;
    const errorId = c.req.param('id');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = drizzle(c.env.DB as any);
    await db.update(qboSyncErrors).set({ resolved: 1 })
        .where(and(eq(qboSyncErrors.id, errorId), eq(qboSyncErrors.tenantId, tenantId)));
    return c.json({ success: true });
});

// POST /contacts/:contactId/link — manually link OI contact to QBO customer
api.post('/contacts/:contactId/link', async (c) => {
    const tenantId = c.get('tenantId') as string;
    const contactId = c.req.param('contactId');
    const parsed = QBOLinkCustomerBodySchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ success: false, error: 'Invalid body' }, 400);
    const svc = getQBOService(c.env);
    await svc.linkExistingCustomer(tenantId, contactId, parsed.data.qboCustomerId);
    return c.json({ success: true });
});

export default api;
