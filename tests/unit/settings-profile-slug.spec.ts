import { describe, it, expect } from 'vitest';
import { SettingsProfilePage } from '../../src/templates/pages/settings-profile';

/**
 * Booking #7 Sprint A — Settings → Profile booking slug card.
 *
 * The Hono JSX runtime returns a Promise<HtmlEscapedString> for async
 * components, but `SettingsProfilePage` itself is synchronous. We coerce its
 * return value to a string via `String()` so the test can run pure regex
 * assertions over the rendered HTML.
 */
function renderToString(node: JSX.Element): string {
    return String(node as unknown as { toString(): string });
}

describe('SettingsProfilePage — slug card', () => {
    it('renders booking slug input populated when user has slug', () => {
        const html = renderToString(
            SettingsProfilePage({ branding: undefined, currentSlug: 'john', tenantSubdomain: 'acme' }),
        );
        expect(html).toMatch(/data-testid="settings-slug-input"/);
        expect(html).toMatch(/value="john"/);
        // The booking link copy + the live link itself should both render.
        expect(html).toMatch(/\/book\/john/);
        expect(html).toMatch(/data-testid="settings-slug-link"/);
        expect(html).toMatch(/data-testid="settings-slug-copy"/);
    });

    it('renders empty slug input + helper hint when user has none', () => {
        const html = renderToString(
            SettingsProfilePage({ branding: undefined, currentSlug: null, tenantSubdomain: 'acme' }),
        );
        expect(html).toMatch(/data-testid="settings-slug-input"/);
        expect(html).toMatch(/data-testid="settings-slug-empty-hint"/);
    });

    it('loads the slug-check JS bundle', () => {
        const html = renderToString(
            SettingsProfilePage({ branding: undefined, currentSlug: null, tenantSubdomain: 'acme' }),
        );
        expect(html).toMatch(/\/js\/settings-profile-slug\.js/);
    });
});
