import { describe, it, expect } from 'vitest';
import { CommandPalette } from '../../src/templates/components/command-palette';

function render(node: JSX.Element): string {
    return String(node as unknown as { toString(): string });
}

describe('CommandPalette — Copy my booking link action (Sprint B-1)', () => {
    it('exposes data-current-user-slug + data-booking-host on the palette root for slug-aware actions', () => {
        const html = render(CommandPalette({ currentUserSlug: 'mike', bookingHost: 'acme.inspectorhub.io' }));
        expect(html).toMatch(/data-current-user-slug="mike"/);
        expect(html).toMatch(/data-booking-host="acme\.inspectorhub\.io"/);
    });

    it('omits both attrs when slug is null', () => {
        const html = render(CommandPalette({ currentUserSlug: null, bookingHost: 'acme.inspectorhub.io' }));
        expect(html).not.toMatch(/data-current-user-slug/);
        expect(html).not.toMatch(/data-booking-host/);
    });

    it('renders without props (legacy callers — no booking action)', () => {
        const html = render(CommandPalette());
        expect(html).not.toMatch(/data-current-user-slug/);
        expect(html).not.toMatch(/data-booking-host/);
        // Sanity: palette markup still renders.
        expect(html).toMatch(/x-data="commandPalette"/);
    });
});
