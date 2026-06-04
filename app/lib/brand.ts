import type { CSSProperties } from "react";

/**
 * A-10 — tenant brand shared by every public surface (profile / booking /
 * report / invoice). Nullable fields mean "tenant hasn't set it": a null
 * primaryColor keeps the platform design tokens untouched.
 */
export interface TenantBrand {
  siteName: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
}

export const EMPTY_BRAND: TenantBrand = { siteName: null, primaryColor: null, logoUrl: null };

/**
 * Re-points the Design System 0523 primary tokens at the tenant's accent on a
 * surface root. Every existing `bg-ih-primary` / `text-ih-primary` /
 * `shadow-ih-focus` consumer downstream picks the brand up automatically —
 * no per-component class changes. Derived shades come from `color-mix()`
 * mirroring the stock ratios (tailwind.css `:root`).
 *
 * Returns `{}` when no tenant color is set so the platform default applies.
 */
export function brandTokens(primaryColor: string | null | undefined): CSSProperties {
  if (!primaryColor) return {};
  return {
    "--ih-primary": primaryColor,
    "--ih-primary-600": `color-mix(in srgb, ${primaryColor} 88%, #000)`,
    "--ih-primary-700": `color-mix(in srgb, ${primaryColor} 76%, #000)`,
    "--ih-primary-tint": `color-mix(in srgb, ${primaryColor} 10%, transparent)`,
    "--ih-primary-glow": `color-mix(in srgb, ${primaryColor} 25%, transparent)`,
  } as CSSProperties;
}
