-- Convert epoch-seconds timestamp columns to epoch-milliseconds.
-- Idempotent: the `< 100000000000` guard (~1973 in ms) means values already
-- stored as ms (which are always >= ~1.4e12 for any real date) are skipped,
-- while genuine epoch-seconds values (~1.6e9) are multiplied by 1000. Safe to
-- re-run any number of times without double-converting already-migrated rows.

-- Columns previously declared with drizzle mode: 'timestamp' (seconds).
UPDATE contacts SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE agreements SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE agreement_requests SET signed_at = signed_at * 1000 WHERE signed_at IS NOT NULL AND signed_at < 100000000000;
UPDATE agreement_requests SET viewed_at = viewed_at * 1000 WHERE viewed_at IS NOT NULL AND viewed_at < 100000000000;
UPDATE agreement_requests SET sent_at = sent_at * 1000 WHERE sent_at IS NOT NULL AND sent_at < 100000000000;
UPDATE agreement_requests SET inspector_signed_at = inspector_signed_at * 1000 WHERE inspector_signed_at IS NOT NULL AND inspector_signed_at < 100000000000;
UPDATE agreement_requests SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE availability SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE availability_overrides SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE automations SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE event_types SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE inspection_events SET scheduled_at = scheduled_at * 1000 WHERE scheduled_at IS NOT NULL AND scheduled_at < 100000000000;
UPDATE inspection_events SET completed_at = completed_at * 1000 WHERE completed_at IS NOT NULL AND completed_at < 100000000000;
UPDATE inspection_events SET results_received_at = results_received_at * 1000 WHERE results_received_at IS NOT NULL AND results_received_at < 100000000000;
UPDATE inspection_events SET cancelled_at = cancelled_at * 1000 WHERE cancelled_at IS NOT NULL AND cancelled_at < 100000000000;
UPDATE inspection_events SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE comments SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE concierge_confirm_tokens SET expires_at = expires_at * 1000 WHERE expires_at IS NOT NULL AND expires_at < 100000000000;
UPDATE concierge_confirm_tokens SET confirmed_at = confirmed_at * 1000 WHERE confirmed_at IS NOT NULL AND confirmed_at < 100000000000;
UPDATE concierge_confirm_tokens SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE inspections SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE inspection_results SET last_synced_at = last_synced_at * 1000 WHERE last_synced_at IS NOT NULL AND last_synced_at < 100000000000;
UPDATE services SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE discount_codes SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE templates SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE invoices SET sent_at = sent_at * 1000 WHERE sent_at IS NOT NULL AND sent_at < 100000000000;
UPDATE invoices SET paid_at = paid_at * 1000 WHERE paid_at IS NOT NULL AND paid_at < 100000000000;
UPDATE invoices SET partial_paid_at = partial_paid_at * 1000 WHERE partial_paid_at IS NOT NULL AND partial_paid_at < 100000000000;
UPDATE invoices SET voided_at = voided_at * 1000 WHERE voided_at IS NOT NULL AND voided_at < 100000000000;
UPDATE invoices SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE tenants SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE tenant_configs SET updated_at = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at < 100000000000;
UPDATE email_templates SET updated_at = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at < 100000000000;
UPDATE tenant_destruction_records SET destroyed_at = destroyed_at * 1000 WHERE destroyed_at IS NOT NULL AND destroyed_at < 100000000000;
UPDATE audit_logs SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE agent_tenant_links SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE agent_tenant_links SET revoked_at = revoked_at * 1000 WHERE revoked_at IS NOT NULL AND revoked_at < 100000000000;
UPDATE notifications SET read_at = read_at * 1000 WHERE read_at IS NOT NULL AND read_at < 100000000000;
UPDATE notifications SET archived_at = archived_at * 1000 WHERE archived_at IS NOT NULL AND archived_at < 100000000000;
UPDATE notifications SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE users SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE users SET totp_verified_at = totp_verified_at * 1000 WHERE totp_verified_at IS NOT NULL AND totp_verified_at < 100000000000;
UPDATE users SET deleted_at = deleted_at * 1000 WHERE deleted_at IS NOT NULL AND deleted_at < 100000000000;
UPDATE tenant_invites SET expires_at = expires_at * 1000 WHERE expires_at IS NOT NULL AND expires_at < 100000000000;
UPDATE agent_invites SET expires_at = expires_at * 1000 WHERE expires_at IS NOT NULL AND expires_at < 100000000000;
UPDATE agent_invites SET accepted_at = accepted_at * 1000 WHERE accepted_at IS NOT NULL AND accepted_at < 100000000000;
UPDATE agent_invites SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;

-- Bare integer('*_at') columns confirmed (by write-site inspection) to store
-- epoch-seconds; converted here alongside the mode:'timestamp' set above.
UPDATE comment_usage SET last_used_at = last_used_at * 1000 WHERE last_used_at IS NOT NULL AND last_used_at < 100000000000;
UPDATE observer_links SET expires_at = expires_at * 1000 WHERE expires_at IS NOT NULL AND expires_at < 100000000000;
UPDATE observer_links SET revoked_at = revoked_at * 1000 WHERE revoked_at IS NOT NULL AND revoked_at < 100000000000;
UPDATE observer_links SET last_viewed_at = last_viewed_at * 1000 WHERE last_viewed_at IS NOT NULL AND last_viewed_at < 100000000000;
UPDATE qbo_connections SET token_expires_at = token_expires_at * 1000 WHERE token_expires_at IS NOT NULL AND token_expires_at < 100000000000;
UPDATE qbo_connections SET refresh_token_expires_at = refresh_token_expires_at * 1000 WHERE refresh_token_expires_at IS NOT NULL AND refresh_token_expires_at < 100000000000;
UPDATE qbo_connections SET last_sync_at = last_sync_at * 1000 WHERE last_sync_at IS NOT NULL AND last_sync_at < 100000000000;
UPDATE qbo_connections SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE qbo_entity_map SET synced_at = synced_at * 1000 WHERE synced_at IS NOT NULL AND synced_at < 100000000000;
UPDATE qbo_sync_errors SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE qbo_sync_errors SET updated_at = updated_at * 1000 WHERE updated_at IS NOT NULL AND updated_at < 100000000000;
UPDATE report_versions SET published_at = published_at * 1000 WHERE published_at IS NOT NULL AND published_at < 100000000000;
UPDATE sync_outbox SET created_at = created_at * 1000 WHERE created_at IS NOT NULL AND created_at < 100000000000;
UPDATE sync_outbox SET last_tried_at = last_tried_at * 1000 WHERE last_tried_at IS NOT NULL AND last_tried_at < 100000000000;
UPDATE processed_cmd_events SET processed_at = processed_at * 1000 WHERE processed_at IS NOT NULL AND processed_at < 100000000000;
UPDATE parked_cmd_events SET received_at = received_at * 1000 WHERE received_at IS NOT NULL AND received_at < 100000000000;
UPDATE users SET last_active_at = last_active_at * 1000 WHERE last_active_at IS NOT NULL AND last_active_at < 100000000000;
