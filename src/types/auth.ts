export interface User {
    sub: string;
    role: 'owner' | 'admin' | 'inspector' | 'agent';
    // Agent Accounts A1 — tenantId is undefined for global agent accounts
    // (role='agent'). Each agent route resolves the active tenant per-request
    // via `resolveAgentTenant()`.
    tenantId?: string;
}

export type UserRole = User['role'];

export interface BrandingConfig {
    siteName: string;
    primaryColor: string;
    logoUrl: string | null;
    supportEmail: string;
    billingUrl: string;
    gaMeasurementId?: string | null | undefined;
    reportTheme?: 'modern' | 'classic' | 'minimal' | undefined;
    /** Sprint 1 CC-2 — true when the worker runs as the public sandbox demo
     *  (resolved from `c.var.profile.showSandboxBanner`). Plumbed through
     *  branding so every page template that already accepts branding gets it
     *  for free. */
    sandboxMode?: boolean | undefined;
    /** Sprint B-1 — signed-in user's booking slug. Plumbed via the
     *  inspectorPaletteMiddleware so MainLayout can pass it to
     *  <CommandPalette /> for the "Copy my booking link" action. Null when
     *  the user hasn't picked a slug yet. */
    currentUserSlug?: string | null | undefined;
    /** Sprint B-1 — host portion of the booking URL (e.g. "acme.inspectorhub.io").
     *  Used by the ⌘K palette action and any other slug-aware UI. */
    bookingHost?: string | undefined;
    /** PR 2 — tenant subdomain (path segment). Needed for path-tenant booking
     *  URLs (`<host>/book/<tenant>/<slug>`). Populated by inspectorPaletteMiddleware. */
    tenantSubdomain?: string | null | undefined;
}

import { ScopedDB } from '../lib/db/scoped';

export interface AuthVariables {
    tenantId: string;
    resolvedTenantId?: string; // Explicitly tracked for isolation guard
    user: User;
    userRole: UserRole;
    // Agent Accounts A1 — set by JWT middleware on the role=agent branch.
    // Mirrors `user.sub` but lets agent-only handlers stay narrowly typed
    // without re-deriving from the broader User payload.
    agentUserId?: string;
    requestedSubdomain?: string;
    tenantTier?: string;
    tenantStatus?: string;
    branding?: BrandingConfig;
    sdb?: ScopedDB;
}

export interface InspectionData {
    sections: Array<{
        id: string;
        title: string;
        items: Array<{
            id: string;
            label: string;
            description?: string;
            status?: 'Satisfactory' | 'Monitor' | 'Defect' | 'Not Inspected';
            notes?: string;
            photos?: Array<{
                key: string;
                pending?: boolean;
                dataUrl?: string;
            }>;
        }>;
    }>;
}
