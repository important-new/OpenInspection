-- Spec 2A — extend agreement_requests with sent_at + last_error;
-- Drizzle TS enums (status on agreement_requests, trigger on automations)
-- are NOT enforced by SQLite — no DDL needed for enum extensions.
-- Existing rows with status pending|viewed|signed remain valid.

ALTER TABLE agreement_requests ADD COLUMN sent_at INTEGER;
ALTER TABLE agreement_requests ADD COLUMN last_error TEXT;
