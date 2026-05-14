import { Hono } from 'hono';
import type { HonoConfig } from '../types/hono';
import { QBOService } from '../services/qbo.service';
import { logger } from '../lib/logger';

const api = new Hono<HonoConfig>();

/**
 * POST /api/integrations/qbo/webhook
 * Excluded from JWT middleware — verified via intuit-signature HMAC instead.
 * Processes CloudEvents v1.0 payload (mandatory format from 2026-05-15).
 */
api.post('/', async (c) => {
    const headerSig = c.req.header('intuit-signature');
    if (!headerSig) {
        logger.info('QBO webhook: missing intuit-signature header');
        return c.json({ error: 'Missing signature' }, 401);
    }

    // Read raw body BEFORE any parsing — hashing must use raw bytes
    const rawBody = await c.req.text();

    const svc = new QBOService(
        c.env.DB,
        c.env.QBO_CLIENT_ID ?? '',
        c.env.QBO_CLIENT_SECRET ?? '',
        c.env.QBO_WEBHOOK_SECRET ?? '',
        c.env.JWT_SECRET,
    );

    const invoiceSvc = c.var.services.invoice;

    // Respond 200 immediately — Intuit retries on non-200
    c.executionCtx.waitUntil(
        svc.handleWebhook(
            rawBody,
            headerSig,
            (invoiceId, tenantId) => invoiceSvc.markPaid(invoiceId, tenantId, 'qbo'),
            (invoiceId, _balance, tenantId) => invoiceSvc.markPartial(invoiceId, tenantId, 'qbo'),
        ).then(({ valid }) => {
            if (!valid) logger.info('QBO webhook: signature mismatch — discarded');
        }).catch(e => {
            logger.error('QBO webhook processing error', {}, e instanceof Error ? e : undefined);
        }),
    );

    return c.json({ ok: true });
});

export default api;
