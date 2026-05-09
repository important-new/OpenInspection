import type { BrandingConfig } from '../../types/auth';
import type { AgentReferralRow } from '../../services/agent.service';

export interface AgentDashboardProps {
    branding?: BrandingConfig | undefined;
    agent: { name?: string | null; email?: string | null };
    referrals: AgentReferralRow[];
    unreadReports: number;
}

interface LifecycleSteps {
    booked: boolean;     // step 1 — always true (every referral is at minimum booked)
    confirmed: boolean;  // step 2 — status not 'draft'
    onSite: boolean;     // step 3 — status in_progress / completed / delivered
    published: boolean;  // step 4 — status delivered
    paid: boolean;       // step 5 — paymentStatus paid
}

function computeSteps(r: AgentReferralRow): LifecycleSteps {
    const status = (r.status || '').toLowerCase();
    const completedOrLater = status === 'completed' || status === 'delivered';
    const onSiteOrLater = status === 'in_progress' || completedOrLater;
    const confirmedOrLater = status !== 'draft' && status !== '';
    return {
        booked:    true,
        confirmed: confirmedOrLater,
        onSite:    onSiteOrLater,
        published: status === 'delivered',
        paid:      r.paymentStatus === 'paid',
    };
}

function statusLabel(status: string): string {
    const s = (status || '').toLowerCase();
    switch (s) {
        case 'draft':       return 'Booked';
        case 'scheduled':   return 'Scheduled';
        case 'confirmed':   return 'Confirmed';
        case 'in_progress': return 'On site';
        case 'completed':   return 'Completed';
        case 'delivered':   return 'Published';
        case 'cancelled':   return 'Cancelled';
        default:            return status || 'Pending';
    }
}

/**
 * Agent Accounts A2 — cross-tenant referral dashboard.
 *
 * Frontend-design directives (non-negotiable):
 *  - Two stat cards top: "Active referrals · N" + "Reports ready to read · M"
 *  - Below: referrals grouped by tenant with a tenant-name color band header
 *    + collapsible sections (NOT a flat unified list)
 *  - Each row right-edge: lifecycle sparkline (booked → confirmed → on-site →
 *    published → paid), active step highlighted via primary color
 *
 * Sprint 1 design tokens: surface / ink / blueprint, Fraunces serif headlines,
 * DM Sans body. Markup-first; Alpine progressive enhancement only for the
 * collapse interaction.
 */
export const AgentDashboardPage = ({
    branding,
    agent,
    referrals,
    unreadReports,
}: AgentDashboardProps): JSX.Element => {
    const siteName = branding?.siteName || 'OpenInspection';
    const primaryColor = branding?.primaryColor || '#4f46e5';
    const greetingName = agent.name?.trim() || 'partner';
    const totalReferrals = referrals.length;

    // Group referrals by tenantId, preserving the natural order of first-seen
    // tenants (stable for tests + readable for users).
    const grouped = new Map<string, { tenantName: string; rows: AgentReferralRow[] }>();
    for (const r of referrals) {
        const bucket = grouped.get(r.tenantId);
        if (bucket) {
            bucket.rows.push(r);
        } else {
            grouped.set(r.tenantId, { tenantName: r.tenantName, rows: [r] });
        }
    }
    const tenantSections = Array.from(grouped.entries()).map(([tenantId, bucket]) => ({
        tenantId,
        tenantName: bucket.tenantName,
        rows: bucket.rows,
    }));

    return (
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>{`Agent dashboard | ${siteName}`}</title>
                <link rel="stylesheet" href="/fonts.css" />
                <style dangerouslySetInnerHTML={{ __html: `
                    :root {
                        --primary: ${primaryColor};
                        --primary-soft: ${primaryColor}14;
                        --ink: #1c1917;
                        --ink-soft: #57534e;
                        --ink-faint: #a8a29e;
                        --line: #e7e5e4;
                        --surface: #fafaf9;
                        --surface-card: #ffffff;
                        --good: #15803d;
                        --good-soft: #15803d14;
                        --warn: #b45309;
                        --slate: #475569;
                    }
                    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        font-family: 'DM Sans', system-ui, sans-serif;
                        background: var(--surface);
                        color: var(--ink);
                        min-height: 100vh;
                        -webkit-font-smoothing: antialiased;
                    }
                    .topbar {
                        max-width: 1080px; margin: 0 auto;
                        padding: 1.75rem 1.5rem;
                        display: flex; align-items: center; justify-content: space-between;
                    }
                    .brand-row { display: flex; align-items: center; gap: 0.75rem; }
                    .brand-row img { width: 32px; height: 32px; object-fit: contain; }
                    .brand-name {
                        font-family: 'Fraunces', serif; font-weight: 700;
                        font-size: 1.125rem; letter-spacing: -0.02em;
                    }
                    .topbar-actions { display: flex; gap: 0.5rem; }
                    .topbar-link {
                        background: transparent; border: 1.5px solid var(--line);
                        color: var(--ink); padding: 0.5rem 1rem;
                        font-family: inherit; font-size: 0.8125rem; font-weight: 600;
                        border-radius: 10px; cursor: pointer; text-decoration: none;
                        transition: border-color 0.15s;
                    }
                    .topbar-link:hover { border-color: var(--ink-faint); }
                    .shell {
                        max-width: 1080px; margin: 0 auto;
                        padding: 1rem 1.5rem 4rem;
                    }
                    .editorial-h1 {
                        font-family: 'Fraunces', serif; font-weight: 700;
                        font-size: 2.25rem; line-height: 1.1; letter-spacing: -0.025em;
                        margin-bottom: 0.5rem;
                    }
                    .editorial-h1 em { font-style: italic; color: var(--primary); }
                    .lede {
                        font-size: 1rem; line-height: 1.55;
                        color: var(--ink-soft); margin-bottom: 2rem;
                    }
                    .stats {
                        display: grid; gap: 1rem;
                        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                        margin-bottom: 2rem;
                    }
                    .stat-card {
                        background: var(--surface-card);
                        border: 1px solid var(--line);
                        border-radius: 16px;
                        padding: 1.25rem 1.5rem;
                        display: flex; flex-direction: column; gap: 0.5rem;
                        /* Tactile lift — without it the cards merge into the
                           cream page background and read as outlined boxes
                           rather than discrete tiles. Subtle to keep the
                           editorial paper feel. */
                        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.04);
                    }
                    .stat-eyebrow {
                        font-size: 0.6875rem; font-weight: 700;
                        text-transform: uppercase; letter-spacing: 0.18em;
                        color: var(--ink-faint);
                    }
                    .stat-value {
                        font-family: 'Fraunces', serif; font-weight: 700;
                        font-size: 2.5rem; line-height: 1; letter-spacing: -0.02em;
                        color: var(--ink);
                    }
                    .stat-card.has-attention .stat-value { color: var(--primary); }
                    .stat-help { font-size: 0.8125rem; color: var(--ink-soft); }
                    .tenant-section {
                        background: var(--surface-card);
                        border: 1px solid var(--line);
                        border-radius: 16px;
                        margin-bottom: 1rem;
                        overflow: hidden;
                    }
                    .tenant-header {
                        display: flex; align-items: center; gap: 0.75rem;
                        padding: 1rem 1.25rem;
                        cursor: pointer;
                        background: var(--surface);
                        border-bottom: 1px solid var(--line);
                    }
                    .tenant-band {
                        width: 4px; align-self: stretch;
                        border-radius: 2px;
                        background: var(--primary);
                    }
                    .tenant-name {
                        font-family: 'Fraunces', serif; font-weight: 700;
                        font-size: 1rem; letter-spacing: -0.01em;
                    }
                    .tenant-meta {
                        margin-left: auto;
                        font-size: 0.75rem; color: var(--ink-faint);
                        font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em;
                    }
                    .tenant-toggle {
                        font-size: 0.75rem; color: var(--ink-faint);
                        transition: transform 0.15s;
                    }
                    .tenant-section[data-open="false"] .tenant-toggle { transform: rotate(-90deg); }
                    .tenant-section[data-open="false"] .referrals { display: none; }
                    .referrals { display: flex; flex-direction: column; }
                    .referral-row {
                        display: grid;
                        grid-template-columns: 1fr 220px auto;
                        gap: 1rem; align-items: center;
                        padding: 1rem 1.25rem;
                        border-bottom: 1px solid var(--line);
                    }
                    .referral-row:last-child { border-bottom: 0; }
                    .referral-row:hover { background: var(--surface); }
                    .referral-main { min-width: 0; }
                    .referral-address {
                        font-weight: 600; font-size: 0.9375rem;
                        margin-bottom: 0.25rem;
                        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                    }
                    .referral-meta {
                        font-size: 0.75rem; color: var(--ink-soft);
                        display: flex; gap: 0.5rem; flex-wrap: wrap;
                    }
                    .referral-meta .sep { color: var(--ink-faint); }
                    .sparkline {
                        display: flex; align-items: center; gap: 0.25rem;
                    }
                    .sparkline-step {
                        width: 28px; height: 6px; border-radius: 3px;
                        background: var(--line);
                        transition: background 0.15s;
                    }
                    .sparkline-step.on { background: var(--primary); }
                    .sparkline-step.on.paid { background: var(--good); }
                    .sparkline-label {
                        font-size: 0.6875rem; font-weight: 700;
                        text-transform: uppercase; letter-spacing: 0.12em;
                        color: var(--ink-faint); margin-left: 0.5rem;
                    }
                    .row-cta {
                        font-size: 0.8125rem; font-weight: 600;
                        color: var(--primary); text-decoration: none;
                        padding: 0.375rem 0.75rem; border-radius: 8px;
                        border: 1px solid var(--line);
                        transition: border-color 0.15s, background 0.15s;
                    }
                    .row-cta:hover { border-color: var(--primary); background: var(--primary-soft); }
                    .row-cta.disabled {
                        color: var(--ink-faint); cursor: default;
                        pointer-events: none;
                    }
                    .empty-card {
                        background: var(--surface-card);
                        border: 1px dashed var(--line);
                        border-radius: 16px;
                        padding: 3rem 2rem;
                        text-align: center;
                        color: var(--ink-soft);
                    }
                    .empty-card h3 {
                        font-family: 'Fraunces', serif; font-weight: 700;
                        font-size: 1.25rem; color: var(--ink);
                        margin-bottom: 0.5rem;
                    }
                    @media (max-width: 700px) {
                        .referral-row {
                            grid-template-columns: 1fr;
                            gap: 0.5rem;
                        }
                        .sparkline { order: 2; }
                        .row-cta { justify-self: start; }
                    }
                ` }} />
            </head>
            <body>
                <header class="topbar">
                    <div class="brand-row">
                        {branding?.logoUrl ? <img src={branding.logoUrl} alt={siteName} /> : null}
                        <span class="brand-name">{siteName}</span>
                    </div>
                    <nav class="topbar-actions">
                        <a class="topbar-link" href="/agent-inspectors">Inspectors</a>
                        <a class="topbar-link" href="/agent-settings/profile">Settings</a>
                        <button id="signoutBtn" class="topbar-link" type="button">Sign out</button>
                    </nav>
                </header>

                <main class="shell">
                    <h1 class="editorial-h1">
                        Welcome, <em>{greetingName}</em>.
                    </h1>
                    <p class="lede">
                        Here are the inspections you've referred across every team you partner with.
                    </p>

                    <section class="stats" aria-label="Dashboard stats">
                        <article class="stat-card" data-testid="agent-stat-active-referrals">
                            <span class="stat-eyebrow">Active referrals</span>
                            <span class="stat-value">{totalReferrals}</span>
                            <span class="stat-help">Across {tenantSections.length} {tenantSections.length === 1 ? 'team' : 'teams'}</span>
                        </article>
                        <article
                            class={`stat-card${unreadReports > 0 ? ' has-attention' : ''}`}
                            data-testid="agent-stat-reports-ready"
                        >
                            <span class="stat-eyebrow">Reports ready to read</span>
                            <span class="stat-value">{unreadReports}</span>
                            <span class="stat-help">
                                {unreadReports === 0 ? 'You\'re all caught up' : 'Tap a row below to open'}
                            </span>
                        </article>
                    </section>

                    {tenantSections.length === 0 ? (
                        <div class="empty-card" data-testid="agent-dashboard-empty">
                            <h3>No referrals yet</h3>
                            <p>
                                Inspections you refer will land here within minutes. Visit
                                {' '}<a href="/agent-inspectors" style="color: var(--primary); font-weight: 600;">your inspectors</a>{' '}
                                to copy a booking link to share with clients.
                            </p>
                        </div>
                    ) : (
                        tenantSections.map((section) => (
                            <article
                                class="tenant-section"
                                data-tenant-section={section.tenantId}
                                data-open="true"
                            >
                                <header
                                    class="tenant-header"
                                    role="button"
                                    tabindex={0}
                                    data-tenant-toggle={section.tenantId}
                                >
                                    <span class="tenant-band" aria-hidden="true"></span>
                                    <span class="tenant-name">{section.tenantName}</span>
                                    <span class="tenant-meta">{section.rows.length} {section.rows.length === 1 ? 'referral' : 'referrals'}</span>
                                    <span class="tenant-toggle" aria-hidden="true">▾</span>
                                </header>
                                <div class="referrals">
                                    {section.rows.map((r) => {
                                        const steps = computeSteps(r);
                                        const canViewReport = steps.published;
                                        return (
                                            <div class="referral-row">
                                                <div class="referral-main">
                                                    <div class="referral-address">{r.propertyAddress}</div>
                                                    <div class="referral-meta">
                                                        <span>{r.clientName ?? 'No client name'}</span>
                                                        <span class="sep">·</span>
                                                        <span>{r.date}</span>
                                                        <span class="sep">·</span>
                                                        <span>{statusLabel(r.status)}</span>
                                                        {r.inspectorName ? (
                                                            <>
                                                                <span class="sep">·</span>
                                                                <span>w/ {r.inspectorName}</span>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <div
                                                    class="sparkline"
                                                    data-testid={`referral-sparkline-${r.id}`}
                                                    data-step1-on={String(steps.booked)}
                                                    data-step2-on={String(steps.confirmed)}
                                                    data-step3-on={String(steps.onSite)}
                                                    data-step4-on={String(steps.published)}
                                                    data-step5-on={String(steps.paid)}
                                                    aria-label={`Lifecycle: booked${steps.confirmed ? ', confirmed' : ''}${steps.onSite ? ', on-site' : ''}${steps.published ? ', published' : ''}${steps.paid ? ', paid' : ''}`}
                                                >
                                                    <span class={`sparkline-step${steps.booked ? ' on' : ''}`} title="Booked"></span>
                                                    <span class={`sparkline-step${steps.confirmed ? ' on' : ''}`} title="Confirmed"></span>
                                                    <span class={`sparkline-step${steps.onSite ? ' on' : ''}`} title="On site"></span>
                                                    <span class={`sparkline-step${steps.published ? ' on' : ''}`} title="Published"></span>
                                                    <span class={`sparkline-step${steps.paid ? ' on paid' : ''}`} title="Paid"></span>
                                                </div>
                                                {canViewReport ? (
                                                    <a class="row-cta" href={`/report/${r.id}?view=agent`}>View report</a>
                                                ) : (
                                                    <span class="row-cta disabled" aria-disabled="true">Awaiting report</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </article>
                        ))
                    )}
                </main>

                <script src="/js/agent-dashboard.js"></script>
            </body>
        </html>
    );
};
