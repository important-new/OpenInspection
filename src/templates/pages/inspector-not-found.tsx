import { raw } from 'hono/html';

interface Props {
    slug: string;
    companyName?: string | undefined;
}

const NOT_FOUND_STYLES = `
body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #fafaf7; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
.card { max-width: 420px; text-align: center; }
.title { font-family: 'Fraunces', Georgia, serif; font-size: 32px; margin: 0 0 16px; font-weight: 600; }
.body { color: #475569; line-height: 1.6; font-size: 15px; }
code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 13px; }
`;

/**
 * Booking #7 Sprint C-1 — friendly 404 served when /inspector/<slug> doesn't
 * resolve to a real user. The slug echo helps customers spot typos at a glance.
 */
export const InspectorNotFoundPage = ({ slug, companyName }: Props): JSX.Element => (
    <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Inspector not found</title>
            <link rel="stylesheet" href="/fonts.css" />
            {raw(`<style>${NOT_FOUND_STYLES}</style>`)}
        </head>
        <body>
            <div class="card">
                <h1 class="title">Inspector not found</h1>
                <p class="body">
                    We couldn't find an inspector with the link <code>/inspector/{slug}</code>
                    {companyName ? ` at ${companyName}` : ''}. Double-check with whoever shared the link.
                </p>
            </div>
        </body>
    </html>
);
