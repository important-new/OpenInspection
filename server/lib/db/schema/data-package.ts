import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index, uniqueIndex, check } from 'drizzle-orm/sqlite-core';

/** Longest `cursor` or `counts` text a job row may hold, in characters. Enforced by a CHECK constraint, not only by callers. */
export const DATA_JOB_TEXT_MAX_CHARS = 4096;

/** Which way the data moves. */
export const DATA_JOB_KINDS = ['export', 'import'] as const;

/** `queued` and `running` are the active states; the rest are terminal and free the company's single job slot. */
export const DATA_JOB_STATUSES = ['queued', 'running', 'complete', 'failed', 'cancelled', 'expired'] as const;

/** Where a job stopped. Export and import use their own subsets; `media` is shared. */
export const DATA_JOB_STAGES = [
    'snapshot', 'rows', 'media', 'volumes', 'root',
    'upload', 'inspect', 'preview', 'apply', 'archive', 'finish',
] as const;

/** The only failure reasons a job row may record: fixed codes, never a message and never any content from the data. */
export const DATA_JOB_ERROR_CODES = [
    'storage_unavailable', 'database_unavailable', 'quota_exceeded', 'package_invalid',
    'package_checksum_mismatch', 'package_unsupported_version', 'limit_exceeded', 'cancelled_by_user', 'internal',
] as const;

/**
 * One export or import of a company's data package.
 *
 * A job is advanced in small bounded steps by a scheduled driver, so everything needed to resume lives
 * on the row: `stage` says which step comes next and `cursor` says where inside it. `cursor` is opaque
 * serialized state (a keyset position, a storage listing cursor, the volume being built) and is capped
 * at DATA_JOB_TEXT_MAX_CHARS by a CHECK constraint so a runaway writer cannot grow a row towards the
 * database's per-row ceiling. `counts` is a small serialized map of per-table row counts under the same cap.
 *
 * One active job per company: the partial unique index `uq_tenant_data_jobs_active` admits at most one
 * row whose status is `queued` or `running`. Starting a job is therefore a plain insert that the
 * database refuses when another is active; no read-then-write race exists. A terminal status leaves the
 * index, which is how the slot is freed. The vocabularies are enforced by the typed schema, not by a CHECK
 * constraint, so every writer must go through it: a raw write of a status the index does not match
 * (`Running`, say) would not hold the slot.
 *
 * `package_id` names the produced (or inbound) package and is minted once. `bytes` and `sha256` describe
 * the finished package. `expires_at` is when the stored package may be deleted by the expiry sweep; the
 * sweep marks the job `expired`. `error_code` is one of DATA_JOB_ERROR_CODES, set with a `failed` status.
 *
 * The row holds ids, counts and sizes only; nothing from the company's records. Referential integrity is
 * enforced by the service layer (no foreign keys). A tenant purge removes the rows (they carry `tenant_id`).
 * Every read or write must be scoped by `tenant_id` taken from the verified session.
 */
export const tenantDataJobs = sqliteTable('tenant_data_jobs', {
    id:         text('id').primaryKey(),
    tenantId:   text('tenant_id').notNull(),
    kind:       text('kind', { enum: DATA_JOB_KINDS }).notNull(),
    status:     text('status', { enum: DATA_JOB_STATUSES }).notNull(),
    stage:      text('stage', { enum: DATA_JOB_STAGES }).notNull(),
    cursor:     text('cursor'),
    packageId:  text('package_id'),
    bytes:      integer('bytes').notNull().default(0),
    sha256:     text('sha256'),
    counts:     text('counts'),
    errorCode:  text('error_code', { enum: DATA_JOB_ERROR_CODES }),
    createdBy:  text('created_by').notNull(),
    createdAt:  integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    startedAt:  integer('started_at', { mode: 'timestamp_ms' }),
    updatedAt:  integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    expiresAt:  integer('expires_at', { mode: 'timestamp_ms' }),
}, (t) => [
    // At most one active job per company (see the table comment).
    uniqueIndex('uq_tenant_data_jobs_active').on(t.tenantId).where(sql`status IN ('queued', 'running')`),
    // "A company's jobs, newest first."
    index('idx_tenant_data_jobs_tenant_created').on(t.tenantId, t.createdAt),
    // The driver probe and the expiry sweep read by state and by expiry.
    index('idx_tenant_data_jobs_sweep').on(t.status, t.expiresAt),
    check('ck_tenant_data_jobs_cursor_len', sql`${t.cursor} IS NULL OR length(${t.cursor}) <= ${sql.raw(String(DATA_JOB_TEXT_MAX_CHARS))}`),
    check('ck_tenant_data_jobs_counts_len', sql`${t.counts} IS NULL OR length(${t.counts}) <= ${sql.raw(String(DATA_JOB_TEXT_MAX_CHARS))}`),
]);

export type TenantDataJob = typeof tenantDataJobs.$inferSelect;
export type NewTenantDataJob = typeof tenantDataJobs.$inferInsert;
