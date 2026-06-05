import { describe, it, expect } from 'vitest';

describe('Sidebar', () => {
  it('exports Sidebar and MobileHeader', async () => {
    // Basic smoke test that the module loads
    const mod = await import('~/components/Sidebar');
    expect(mod.Sidebar).toBeDefined();
    expect(mod.MobileHeader).toBeDefined();
  });

  it('WORKSPACE_ITEMS includes Reports and Team, not Marketplace', async () => {
    // Import the raw module source to verify the nav arrays.
    // We inspect the module text so we don't have to render the component.
    const src = await import('~/components/Sidebar?raw');
    const text = (src as unknown as { default: string }).default;
    expect(text).toContain('"/reports"');
    expect(text).toContain('"Reports"');
    expect(text).toContain('"/team"');
    expect(text).toContain('"Team"');
    // Marketplace must not appear in LIBRARY_ITEMS (defensive de-listing).
    // It may still be referenced elsewhere, so we check that the LIBRARY_ITEMS
    // array block does not contain the marketplace entry.
    const libraryBlock = text.slice(
      text.indexOf('const LIBRARY_ITEMS'),
      text.indexOf('function SidebarNavItem'),
    );
    expect(libraryBlock).not.toContain('"/marketplace"');
  });
});
