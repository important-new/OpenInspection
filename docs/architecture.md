# Architecture — OpenInspection

## Vision

OpenInspection is a standalone, single-tenant inspection engine. It is designed for individual inspection companies who want total control over their data and infrastructure. One deployment equals one business.

## Principles

- **Edge-Native**: Runs as a Cloudflare Worker for global performance and zero maintenance.
- **Serverless Storage**: Uses Cloudflare D1 (Database), R2 (Photos), and KV (Config Cache).
- **Single-Workspace Model**: The architecture is simplified to serve a single global workspace, eliminating the complexity of multi-tenant routing.
- **Privacy First**: You own 100% of the code and your database resides in your own Cloudflare account.

## Core Components

| Component | Responsibility |
|---|---|
| **Inspection Engine** | Handles templates, field data collection, and report generation. |
| **Booking System** | A public-facing scheduler with bot protection. |
| **Auth & Security** | Integrated JWT-based authentication and role-based access control. |
| **AI Assist** | Optional Gemini integration for writing professional notes. |

## Request Lifecycle

The engine uses a simplified middleware chain to ensure every request is correctly contexted:

1. **Global Router**: Resolves the request to the single system workspace.
2. **Setup Guard**: Redirects to `/setup` if the database hasn't been initialized.
3. **Security Layer**: Handles bot protection, threat scoring, and JWT verification.
4. **API Handlers**: Process business logic for inspections, users, and settings.

## Database Strategy

Every database record is stored in a single D1 instance. While the schema retains a `tenantId` for internal consistency, the system is configured to use a constant `00000000-0000-0000-0000-000000000000` ID for all operations.

## Scalability for Private Use

For organizations needing multiple private instances, the recommended approach is **instance-based scaling**. Deploy a separate Worker for each brand or logical business unit. This ensures complete data isolation and allows for independent updates and configuration.
