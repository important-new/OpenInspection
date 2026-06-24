// ──────────────────────────────────────────────────────────────────────────
// SCHEMA CONVENTION — timestamp columns (DB-10)
//
// New timestamp columns MUST use `integer(name, { mode: 'timestamp_ms' })`
// (epoch milliseconds). Some legacy columns still use `{ mode: 'timestamp' }`
// (epoch SECONDS); these are per-table isolated and safe, but do NOT mix modes
// within a comparison. Convergence is OPPORTUNISTIC — when a table is otherwise
// rewritten, migrate its `timestamp` columns to `timestamp_ms`; no big-bang
// migration is planned (D1 cannot rebuild FK-referenced tables cheaply).
// Always pass a `Date` to Drizzle comparisons (`lt(col, new Date(...))`) so the
// column's mode mapper encodes the cutoff correctly — never hand-build an
// epoch number, or you reintroduce the ms-vs-seconds class of bug.
// ──────────────────────────────────────────────────────────────────────────
export * from './tenant';
export {
    ratingSystems,
    templates,
    inspections,
    inspectionResults,
    agreements,
    availability,
    availabilityOverrides,
    inspectionInspectors,
    serviceInspectors,
    comments,
    agreementRequests,
    agreementSigners,
    services,
    inspectionServices,
    discountCodes,
    automations,
    automationLogs,
    eventTypes,
    inspectionTypes,
    inspectionEvents,
    inspectionRequests,
    inspectionMediaPool,
    orphanedMedia,
    tags,
    inspectionItemTagLinks,
    conciergeConfirmTokens,
    commentUsage,
} from './inspection';
export { commercialSubtypes } from './commercial-subtypes';
export { contacts } from './contact';
export { contractorTypes } from './contractor-types';
export { invoices } from './invoice';
export {
    marketplaceTemplates,
    tenantMarketplaceImports,
    marketplaceLibraries,
    tenantLibraryImports,
    tenantMarketplaceImportHistory,
} from './marketplace';
export { inspectionMessages } from './message';
export type { MessageAttachment } from './message';
export { reportPdfs } from './report-pdf';
export type { ReportPdf, NewReportPdf } from './report-pdf';
export { signingKeys, esignAuditLogs } from './esign';
export type { SigningKey, NewSigningKey, EsignAuditLog, NewEsignAuditLog } from './esign';
export { qboConnections, qboEntityMap, qboSyncErrors } from './qbo';
// Apprentice review-queue subsystem removed 2026-06-13. The physical
// `apprentice_reviews` table is orphaned (D1 cannot drop tables) but all
// schema + code is gone (apprentices became plain inspectors).
// Guest invite subsystem removed 2026-06-13. The physical `guest_invites`
// table is orphaned (D1 cannot drop tables) but all schema + code is gone.
// Design System 0520 subsystem D — UnitTree hierarchy
export { inspectionUnits } from './units';
// Design System 0520 subsystem D — ObserverLink (no-account read-only links)
export { observerLinks } from './observer';
// Design System 0520 subsystem D — ReportVersions (snapshot-on-publish)
export { reportVersions } from './report-versions';
// Design System 0520 subsystem E — IdentitySwitcher links
export { userIdentityLinks } from './identity-links';

export { inspectionAccessTokens } from './portal-access';

// Track I-a GDPR (spec §4) — append-only DSAR erasure decision log.
// Track L (D7) — SMS consent ledger + disclosure versions.
export { erasureLog, smsDisclosureVersions, smsConsentLog } from './compliance';
// Usage metering (Phase 1, SaaS-only).
export { usageCounters } from './usage';
// Repair Request Builder — buyer/agent/inspector negotiation lists per inspection.
export { repairRequests, repairRequestItems } from './repair-request';
export type { RepairRequest, RepairRequestItem } from './repair-request';
// Client documents — bidirectional per-inspection uploads (clients + inspectors).
export * from './client-upload';
