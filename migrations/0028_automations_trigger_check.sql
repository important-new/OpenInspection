-- Spec 2A — extend automations.trigger CHECK to allow new agreement.* events.
-- SQLite cannot ALTER CHECK; standard workaround = create_new + INSERT SELECT
-- + DROP old + RENAME. Same pattern as 0027 used for agreement_requests.
--
-- automation_logs has a FK to automations(id). PRAGMA defer_foreign_keys=ON
-- inside a transaction defers FK enforcement to COMMIT time — by then the
-- new automations table exists with the same row IDs (preserved via INSERT
-- SELECT), so existing FK refs in automation_logs remain valid.

PRAGMA defer_foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE automations_new (
    id               TEXT    PRIMARY KEY,
    tenant_id        TEXT    NOT NULL REFERENCES tenants(id),
    name             TEXT    NOT NULL,
    trigger          TEXT    NOT NULL CHECK(trigger IN (
                       'inspection.created','inspection.confirmed','inspection.cancelled',
                       'report.published','invoice.created','payment.received',
                       'agreement.signed','agreement.viewed','agreement.declined','agreement.expired'
                     )),
    recipient        TEXT    NOT NULL CHECK(recipient IN ('client','buying_agent','selling_agent','inspector','all')),
    delay_minutes    INTEGER NOT NULL DEFAULT 0,
    subject_template TEXT    NOT NULL,
    body_template    TEXT    NOT NULL,
    active           INTEGER NOT NULL DEFAULT 1,
    is_default       INTEGER NOT NULL DEFAULT 0,
    created_at       INTEGER NOT NULL
);

INSERT INTO automations_new
    (id, tenant_id, name, trigger, recipient, delay_minutes,
     subject_template, body_template, active, is_default, created_at)
SELECT id, tenant_id, name, trigger, recipient, delay_minutes,
       subject_template, body_template, active, is_default, created_at
FROM automations;

DROP TABLE automations;
ALTER TABLE automations_new RENAME TO automations;

CREATE INDEX idx_automations_tenant ON automations(tenant_id);

COMMIT;

PRAGMA defer_foreign_keys = OFF;
