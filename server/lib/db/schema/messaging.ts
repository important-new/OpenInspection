import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

/**
 * WH-2 — tenant SMS delivery-status ledger. One row per outbound message,
 * keyed on `(tenant_id, provider_message_id)` where `provider_message_id` is the
 * id the provider returned at send time (Twilio message SID / Telnyx message id).
 *
 * The send path seeds a `sent` row the moment a message is accepted; the
 * provider's delivery-status webhook (POST /sms/status/:tenant) then upserts the
 * terminal state. Upsert is LAST-WRITER-WINS by `updatedAt`: an event whose
 * observed time is older than the stored `updatedAt` must NOT overwrite a newer
 * status (out-of-order callbacks are common).
 *
 * `status` is the normalized cross-provider enum; provider-specific words are
 * mapped to it in the receiver. `errorCode` carries the provider's failure code
 * when the message did not deliver (nullable otherwise).
 */
export const smsDeliveryStatus = sqliteTable('sms_delivery_status', {
    id:                text('id').primaryKey(),
    tenantId:          text('tenant_id').notNull(),
    providerMessageId: text('provider_message_id').notNull(),
    status:            text('status', {
        enum: ['queued', 'sent', 'delivered', 'undelivered', 'failed'],
    }).notNull(),
    errorCode:         text('error_code'),
    updatedAt:         integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
}, (t) => [
    index('idx_sms_delivery_status_msg').on(t.tenantId, t.providerMessageId),
]);

export type SmsDeliveryStatus = typeof smsDeliveryStatus.$inferSelect;

/**
 * WH-2 — idempotency ledger shared by all webhook receivers. A receiver derives
 * a stable `event_id` from the inbound payload and inserts it here BEFORE acting;
 * if the id is already present the event is a duplicate (provider retry) and is
 * acknowledged as a no-op. Mirrors the `processed_cmd_events` dedup posture for
 * the portal command seam. Platform-level (NOT tenant-scoped): the event id is
 * globally unique, and a webhook receiver dedups before it has resolved a tenant.
 */
export const processedWebhookEvents = sqliteTable('processed_webhook_events', {
    eventId:    text('event_id').primaryKey(),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
});

export type ProcessedWebhookEvent = typeof processedWebhookEvents.$inferSelect;
