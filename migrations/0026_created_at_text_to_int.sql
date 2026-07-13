-- Retype text `created_at` columns (default `datetime('now')`, ISO-8601 text)
-- to `integer` epoch-ms (default `unixepoch() * 1000`) across the 4 tables
-- below. The table-rebuild copy preserves the raw ISO-string values verbatim
-- (TEXT -> declared INTEGER affinity does not auto-convert a non-numeric
-- string), so each rebuilt table gets a follow-up backfill UPDATE, gated on
-- `typeof(created_at) = 'text'`, that parses the ISO string via strftime('%s', ...)
-- and multiplies by 1000 to land on epoch-ms. Idempotent: rows already holding
-- an integer are skipped by the typeof() guard.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_inspection_units` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`inspection_id` text NOT NULL,
	`parent_unit_id` text,
	`kind` text NOT NULL,
	`type` text DEFAULT 'unit' NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`attrs` text
);
--> statement-breakpoint
INSERT INTO `__new_inspection_units`("id", "tenant_id", "inspection_id", "parent_unit_id", "kind", "type", "name", "sort_order", "created_at", "attrs") SELECT "id", "tenant_id", "inspection_id", "parent_unit_id", "kind", "type", "name", "sort_order", "created_at", "attrs" FROM `inspection_units`;--> statement-breakpoint
DROP TABLE `inspection_units`;--> statement-breakpoint
ALTER TABLE `__new_inspection_units` RENAME TO `inspection_units`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
UPDATE `inspection_units` SET `created_at` = CAST(strftime('%s', `created_at`) AS INTEGER) * 1000 WHERE typeof(`created_at`) = 'text';--> statement-breakpoint
CREATE INDEX `idx_inspection_units_tenant_inspection` ON `inspection_units` (`tenant_id`,`inspection_id`);--> statement-breakpoint
CREATE INDEX `idx_inspection_units_parent` ON `inspection_units` (`parent_unit_id`);--> statement-breakpoint
CREATE TABLE `__new_observer_links` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`inspection_id` text NOT NULL,
	`token` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`last_viewed_at` integer,
	`token_hash` text,
	`token_enc` text
);
--> statement-breakpoint
INSERT INTO `__new_observer_links`("id", "tenant_id", "inspection_id", "token", "created_by", "created_at", "expires_at", "revoked_at", "last_viewed_at", "token_hash", "token_enc") SELECT "id", "tenant_id", "inspection_id", "token", "created_by", "created_at", "expires_at", "revoked_at", "last_viewed_at", "token_hash", "token_enc" FROM `observer_links`;--> statement-breakpoint
DROP TABLE `observer_links`;--> statement-breakpoint
ALTER TABLE `__new_observer_links` RENAME TO `observer_links`;--> statement-breakpoint
UPDATE `observer_links` SET `created_at` = CAST(strftime('%s', `created_at`) AS INTEGER) * 1000 WHERE typeof(`created_at`) = 'text';--> statement-breakpoint
CREATE UNIQUE INDEX `observer_links_token_unique` ON `observer_links` (`token`);--> statement-breakpoint
CREATE INDEX `idx_observer_links_inspection` ON `observer_links` (`inspection_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_observer_links_token_hash` ON `observer_links` (`token_hash`);--> statement-breakpoint
CREATE TABLE `__new_report_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tenant_id` text NOT NULL,
	`inspection_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`summary` text,
	`content_hash` text,
	`prev_hash` text,
	`signature` text,
	`key_fingerprint` text,
	`is_amendment` integer DEFAULT false NOT NULL,
	`verification_token` text,
	`published_at` integer NOT NULL,
	`published_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_report_versions`("id", "tenant_id", "inspection_id", "version_number", "snapshot_json", "summary", "content_hash", "prev_hash", "signature", "key_fingerprint", "is_amendment", "verification_token", "published_at", "published_by", "created_at") SELECT "id", "tenant_id", "inspection_id", "version_number", "snapshot_json", "summary", "content_hash", "prev_hash", "signature", "key_fingerprint", "is_amendment", "verification_token", "published_at", "published_by", "created_at" FROM `report_versions`;--> statement-breakpoint
DROP TABLE `report_versions`;--> statement-breakpoint
ALTER TABLE `__new_report_versions` RENAME TO `report_versions`;--> statement-breakpoint
UPDATE `report_versions` SET `created_at` = CAST(strftime('%s', `created_at`) AS INTEGER) * 1000 WHERE typeof(`created_at`) = 'text';--> statement-breakpoint
CREATE INDEX `idx_report_versions_inspection` ON `report_versions` (`inspection_id`,`version_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_report_versions_inspection_version` ON `report_versions` (`inspection_id`,`version_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_report_versions_verify_token` ON `report_versions` (`verification_token`);--> statement-breakpoint
CREATE TABLE `__new_user_identity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`primary_user_id` text NOT NULL,
	`linked_user_id` text NOT NULL,
	`linked_tenant_id` text NOT NULL,
	`linked_role` text NOT NULL,
	`linked_display_name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user_identity_links`("id", "primary_user_id", "linked_user_id", "linked_tenant_id", "linked_role", "linked_display_name", "created_at") SELECT "id", "primary_user_id", "linked_user_id", "linked_tenant_id", "linked_role", "linked_display_name", "created_at" FROM `user_identity_links`;--> statement-breakpoint
DROP TABLE `user_identity_links`;--> statement-breakpoint
ALTER TABLE `__new_user_identity_links` RENAME TO `user_identity_links`;--> statement-breakpoint
UPDATE `user_identity_links` SET `created_at` = CAST(strftime('%s', `created_at`) AS INTEGER) * 1000 WHERE typeof(`created_at`) = 'text';--> statement-breakpoint
CREATE INDEX `idx_user_identity_links_primary` ON `user_identity_links` (`primary_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_identity_links_primary_linked` ON `user_identity_links` (`primary_user_id`,`linked_user_id`);