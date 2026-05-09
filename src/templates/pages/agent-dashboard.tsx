import type { BrandingConfig } from '../../types/auth';

export interface AgentDashboardProps {
    branding?: BrandingConfig | undefined;
    agentName?: string | undefined;
}

/**
 * Agent Accounts A1 — placeholder /agent-dashboard.
 *
 * A1 ships the foundations: account model, invite + accept, signup, JWT split.
 * The real cross-tenant dashboard arrives in A2 (referrals list, inspector
 * directory, settings). For now we render a friendly preview card so the
 * post-accept and post-signup redirects don't land on a 404.
 *
 * Frontend-design: surface / ink / blueprint Sprint 1 tokens. Fraunces serif
 * headline for editorial weight, DM Sans for body, generous whitespace.
 */
export const AgentDashboardPage = ({ branding, agentName }: AgentDashboardProps = {}): JSX.Element => {
    const siteName = branding?.siteName || 'OpenInspection';
    const primaryColor = branding?.primaryColor || '#4f46e5';
    const greetingName = agentName?.trim() || 'partner';

    return (
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>{`Agent dashboard preview | ${siteName}`}</title>
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
                        max-width: 1080px;
                        margin: 0 auto;
                        padding: 1.75rem 1.5rem;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    }
                    .brand-row { display: flex; align-items: center; gap: 0.75rem; }
                    .brand-row img { width: 32px; height: 32px; object-fit: contain; }
                    .brand-name {
                        font-family: 'Fraunces', serif;
                        font-weight: 700;
                        font-size: 1.125rem;
                        letter-spacing: -0.02em;
                    }
                    .signout-btn {
                        background: transparent;
                        border: 1.5px solid var(--line);
                        color: var(--ink);
                        padding: 0.5rem 1rem;
                        font-family: inherit;
                        font-size: 0.8125rem;
                        font-weight: 600;
                        border-radius: 10px;
                        cursor: pointer;
                        transition: border-color 0.15s;
                    }
                    .signout-btn:hover { border-color: var(--ink-faint); }
                    .shell {
                        max-width: 720px;
                        margin: 0 auto;
                        padding: 2rem 1.5rem 4rem;
                    }
                    .badge {
                        display: inline-flex;
                        align-items: center;
                        gap: 0.375rem;
                        padding: 0.375rem 0.875rem;
                        background: var(--primary-soft);
                        color: var(--primary);
                        border-radius: 999px;
                        font-size: 0.75rem;
                        font-weight: 600;
                        text-transform: uppercase;
                        letter-spacing: 0.06em;
                        margin-bottom: 1rem;
                    }
                    .editorial-h1 {
                        font-family: 'Fraunces', serif;
                        font-weight: 700;
                        font-size: 2.5rem;
                        line-height: 1.1;
                        letter-spacing: -0.025em;
                        margin-bottom: 0.875rem;
                    }
                    .editorial-h1 em {
                        font-style: italic;
                        color: var(--primary);
                    }
                    .lede {
                        font-size: 1.0625rem;
                        line-height: 1.55;
                        color: var(--ink-soft);
                        margin-bottom: 2.25rem;
                    }
                    .preview-card {
                        background: #ffffff;
                        border: 1px solid var(--line);
                        border-radius: 18px;
                        padding: 2rem;
                        margin-bottom: 1.5rem;
                    }
                    .preview-h3 {
                        font-size: 1rem;
                        font-weight: 700;
                        margin-bottom: 0.75rem;
                    }
                    .preview-list { list-style: none; }
                    .preview-item {
                        display: flex;
                        gap: 0.75rem;
                        align-items: flex-start;
                        padding: 0.5rem 0;
                        font-size: 0.9375rem;
                        line-height: 1.5;
                        color: var(--ink-soft);
                    }
                    .preview-bullet {
                        flex-shrink: 0;
                        margin-top: 0.375rem;
                        width: 6px;
                        height: 6px;
                        border-radius: 50%;
                        background: var(--primary);
                    }
                    .preview-foot {
                        font-size: 0.875rem;
                        color: var(--ink-faint);
                        text-align: center;
                        line-height: 1.55;
                    }
                ` }} />
            </head>
            <body>
                <header class="topbar">
                    <div class="brand-row">
                        {branding?.logoUrl ? <img src={branding.logoUrl} alt={siteName} /> : null}
                        <span class="brand-name">{siteName}</span>
                    </div>
                    <button id="signoutBtn" class="signout-btn" type="button">Sign out</button>
                </header>

                <main class="shell">
                    <span class="badge">Preview · A1 foundations</span>
                    <h1 class="editorial-h1">
                        Welcome, <em>{greetingName}</em>.
                    </h1>
                    <p class="lede">
                        Your agent account is set up. The cross-tenant referral dashboard ships
                        next sprint — for now, here's a preview of what's coming.
                    </p>

                    <div class="preview-card">
                        <h3 class="preview-h3">Coming in the next release</h3>
                        <ul class="preview-list">
                            <li class="preview-item">
                                <span class="preview-bullet"></span>
                                <span>
                                    <strong>Cross-tenant referrals.</strong> Every inspection your
                                    inspectors completed for clients you referred — across every
                                    inspector you partner with — in one list.
                                </span>
                            </li>
                            <li class="preview-item">
                                <span class="preview-bullet"></span>
                                <span>
                                    <strong>Inspector directory.</strong> See every inspector you're
                                    linked to, copy their booking link, subscribe to their availability.
                                </span>
                            </li>
                            <li class="preview-item">
                                <span class="preview-bullet"></span>
                                <span>
                                    <strong>Settings + slug.</strong> Pick your own URL slug for sharing
                                    referral links, manage notification preferences.
                                </span>
                            </li>
                        </ul>
                    </div>

                    <p class="preview-foot">
                        Questions? Reach out to your inspector — they'll see all your activity in
                        their referral feed once A2 ships.
                    </p>
                </main>

                <script dangerouslySetInnerHTML={{ __html: `
                    (function () {
                        const btn = document.getElementById('signoutBtn');
                        if (!btn) return;
                        btn.addEventListener('click', async function () {
                            try {
                                await fetch('/api/auth/logout', {
                                    method: 'POST',
                                    credentials: 'same-origin',
                                });
                            } catch (e) { /* fall through to redirect */ }
                            window.location.href = '/login';
                        });
                    })();
                ` }} />
            </body>
        </html>
    );
};
