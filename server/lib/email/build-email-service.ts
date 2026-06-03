import { EmailService } from '../../services/email.service';
import { BrandingService } from '../../services/branding.service';
import { EmailTemplateService } from '../../services/email-template.service';
import { EmailTemplateRenderer } from '../email-templates/renderer';
import type { EmailIdentityConfig } from './sender-identity';
import type { TemplateOverride } from '../email-templates/types';

/**
 * The env bindings an EmailService needs. Both the Hono request env (`c.env`)
 * and the Cloudflare Workflow env structurally satisfy this.
 */
export interface EmailServiceEnv {
    DB: D1Database;
    TENANT_CACHE: KVNamespace;
    JWT_SECRET: string;
    RESEND_API_KEY?: string;
    SENDER_EMAIL?: string;
    APP_NAME?: string;
    PRIMARY_COLOR?: string;
}

/** Tenant email config the assembler needs — loaded by `di` (pre-fetched) or by `buildTenantEmailService`. */
export interface LoadedEmailConfig {
    emailIdentity?: EmailIdentityConfig | undefined;
    emailBrand?: { siteName: string | null; logoUrl: string | null; primaryColor: string | null } | undefined;
    dbSecrets: { resendApiKey?: string; senderEmail?: string; geminiApiKey?: string };
    emailOverrides?: Map<string, TemplateOverride> | undefined;
}

/**
 * Single source of truth for own-vs-platform Resend resolution + branded
 * renderer construction. Pure/sync so `diMiddleware` (which pre-loads the
 * config in its async body) and `buildTenantEmailService` (non-request
 * contexts) both produce identical EmailService instances.
 */
export function assembleTenantEmailService(env: EmailServiceEnv, cfg: LoadedEmailConfig): EmailService {
    const { emailIdentity, emailBrand, dbSecrets, emailOverrides } = cfg;
    const ownReady =
        emailIdentity?.mode === 'own' &&
        !!dbSecrets.resendApiKey &&
        !!emailIdentity.senderEmail;
    const resendKey = ownReady
        ? dbSecrets.resendApiKey!
        : (env.RESEND_API_KEY || dbSecrets.resendApiKey || '');
    const fromAddress = ownReady
        ? emailIdentity!.senderEmail!
        : (env.SENDER_EMAIL || emailIdentity?.senderEmail || '');
    const appName = emailIdentity?.siteName || env.APP_NAME || 'OpenInspection';
    const platformColor = env.PRIMARY_COLOR || '#4f46e5';
    const renderer = new EmailTemplateRenderer({
        tenantBrand: {
            name: emailBrand?.siteName || appName,
            logoUrl: emailBrand?.logoUrl ?? null,
            primaryColor: emailBrand?.primaryColor || platformColor,
        },
        platformBrand: {
            name: env.APP_NAME || 'OpenInspection',
            logoUrl: null,
            primaryColor: platformColor,
        },
        ...(emailOverrides ? { overrides: emailOverrides } : {}),
    });
    return new EmailService(resendKey, fromAddress, appName, emailIdentity, renderer);
}

/**
 * Async: load a tenant's email config (identity, brand, secrets, overrides)
 * then assemble the EmailService. For NON-request contexts where
 * `diMiddleware` never ran — Cloudflare Workflows, scheduled handlers — so
 * those sends still honor the tenant's sender identity + branded templates
 * (B-13). Pass `undefined` tenantId for platform defaults (no overrides).
 */
export async function buildTenantEmailService(env: EmailServiceEnv, tenantId: string | undefined): Promise<EmailService> {
    if (!tenantId) {
        return assembleTenantEmailService(env, { dbSecrets: {} });
    }
    const branding = new BrandingService(env.DB, env.TENANT_CACHE);
    const [emailIdentity, emailBrand, dbSecrets, overrides] = await Promise.all([
        branding.getEmailIdentity(tenantId).catch(() => undefined),
        branding.getEmailBrand(tenantId).catch(() => undefined),
        branding.getDecryptedSecrets(tenantId, env.JWT_SECRET).catch(() => ({} as LoadedEmailConfig['dbSecrets'])),
        new EmailTemplateService(env.DB).listForTenant(tenantId).catch(() => []),
    ]);
    const emailOverrides = overrides.length ? new Map(overrides.map(o => [o.trigger, o])) : undefined;
    return assembleTenantEmailService(env, { emailIdentity, emailBrand, dbSecrets, emailOverrides });
}
