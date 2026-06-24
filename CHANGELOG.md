# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Consolidated catch-up covering engine work since `1.0.0-rc.1` (the changelog had
lapsed). Feature-level summary; see git history / PRs for detail.

### Added
- **Collaborative editing**: real-time multi-inspector report editing via Yjs CRDT + Cloudflare Durable Objects, with offline buffering (y-indexeddb), automatic merge, presence roster, and version history / restore.
- **E-signature & agreements**: order-centric agreement envelopes, multiple signers, immutable signed-content snapshot + hash, sign-and-pay, and Ed25519 report signature with a public verification flow.
- **Editor workflow**: canned-comment library with full-library search and slash-trigger picker, structured defect fields (location / trade / deadline / timeframe), custom defects with save-to-library, clone-last, pinned tags, Speed Mode, and configurable rating auto-advance.
- **Media Studio**: unified photo/video capture, burst camera, cropping, Konva annotation, cover-photo selection, and Cloudflare Stream video.
- **Reports**: server-side PDF rendering with paginated print layout, cover photo, signature/verification block, report revisions with a version hash chain, and re-inspection.
- **Client portal**: magic-link sessions, "My Inspections" hub, shared client documents, and unpublish access revocation.
- **Scheduling & delivery**: company-level booking, an automations engine (when / only-if / do), and multi-channel SMS with per-tenant Twilio + consent ledger.
- **Compliance**: hashed-at-rest tokens, GDPR erasure, terms/privacy version ledger, and append-only-log retention sweep.

### Changed
- **Single-worker architecture**: collapsed the dual-worker (API + web) topology into one Cloudflare Worker (React Router SSR + in-process Hono API).
- **Tenant resolution**: moved from subdomain to URL slug.
- **Sync seam**: tenant→portal outbox now rides Cloudflare Queues with dead-letter / park handling and a health surface; cross-service messages use a versioned CloudEvents envelope with a tolerant-reader contract.
- **Database**: uniqueness constraints (results, soft-delete-aware user email, availability windows), a documented money-authority chain, an `inspection_inspectors` link table, typed status enums, GDPR/perf indexes, and a standardized naming pass.
- **Toolchain**: aligned to Vite 8 (rolldown) / esbuild 0.28 / ESLint 10 / Hono 4.12.

### Fixed
- Silent data-loss on concurrent edits (superseded by the CRDT model).
- Stale agreement-envelope expiry (seconds-vs-milliseconds cutoff comparison).

### Security
- Hardened collaborative/presence WebSocket authorization to match inspection edit permission.
- Tenant-scoping lint gate, design-system token gate, and blocking CI (type-check / drift / lint / tests / bundle-size).

---

## [1.0.0-rc.1] - 2026-04-09

### Added
- **High-Fidelity Testing**: Introduced `vitest` and `better-sqlite3` for in-memory, deterministic unit testing of the service layer.
- **Service Mocks**: Created robust simulations for Cloudflare D1 and KV to enable developer-friendly, portable testing.
- **CI/CD Automation**: Integrated unit tests, type-checking, and security audits into GitHub Actions.
- **Structured Logging**: Implemented a JSON-based `Logger` utility for professional observability in production.
- **Governorance Documents**: Added `SECURITY.md` and updated `README.md` with status badges.
- **Multi-Tenant Branding**: Propagated CSS-variable based themeing across all UI components.

### Changed
- Refactored `AuthService` and `AdminService` into standalone, unit-testable classes.
- Migrated testing infrastructure from edge runtime to high-fidelity Node.js environment for improved portability on Windows/macOS.
- Standardized error handling with structured JSON responses.

### Fixed
- Resolved module resolution issues between Cloudflare types and standard Node.js types.
- Fixed logic errors in team-joining and password reset workflows via unit test verification.

---

## [0.9.0] - 2026-04-08

### Added
- Multi-tenancy support via subdomain routing.
- SQLite (D1) integration with Drizzle ORM.
- Manual tenant approval workflow.
- Responsive dashboard and inspector field form.
- Branding system with logo uploads and custom color support.
