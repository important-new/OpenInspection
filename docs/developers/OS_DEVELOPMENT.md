# Open-Source Development & Branching Strategy

This document outlines the workflow for developing the `core` application in an open-source context while maintaining a private, SaaS-integrated commercial version.

## 1. Repository & Branch Architecture

We use a **Public-Private Synchronized** model.

### Public Repository (`open-source`)
- **Main Branch (`main`)**: The source of truth for all open-source development.
- **Silo-Only**: This repository only supports Silo-mode or Standalone deployments. 
- **Decoupled**: All Portal-specific logic is abstracted through the `IntegrationProvider` interface, using the `StandaloneProvider` by default.

### Private Repository (`monorepo`)
- **Master Branch (`master`)**: Contains `portal`, `shared`, and the private version of `core`.
- **Portal-Integrated**: Uses the `PortalProvider` implementation for M2M synchronization and silent initialization.

---

## 2. Development Workflow

### Feature Development (Public-First)
1. **Generic Features**: All features (new inspection tools, AI improvements, UI refinements) should be developed on the **Public Repo's `main` branch**.
2. **Verification**: Verify features in the standalone environment using local D1 or mock silos.
3. **Draft Release**: Tag as a release candidate in the public repo.

### Private Synchronization (Downstream)
The private repository tracks the public repo as an `upstream` remote for the `apps/core` subtree or directory.

1. **Pulling Changes**: 
   ```bash
   git fetch upstream
   git merge upstream/main
   ```
2. **Implementing Private Providers**: When `IntegrationProvider` interfaces change in the public repo, the corresponding `PortalProvider` in the private repo must be updated to maintain portal sync.
3. **Private Verification**: Run the full SaaS suite tests (Portal + Core) to ensure integration integrity.

---

## 3. Code Design Principles

### The "Silo-Only" Rule
The open-source `core` should assume it is running as a **self-contained unit**.
- **Tenant ID**: For single-instance OS deployments, `tenantId` can be hardcoded or resolved from a simple config.
- **Auth**: The OS version relies on local D1 password hashes rather than Portal-managed sessions.

### Integration Abstraction
Always wrap infrastructure-specific logic in an interface. 
- **Correct**: `await integration.handleTenantUpdate(params)`
- **Incorrect**: `await fetch('https://portal.com/api/sync', { ... })`
