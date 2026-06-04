import { describe, it, expect } from 'vitest';
import { buildWizardSteps, todayLocalISO, formatPriceCents } from '~/lib/wizard-steps';

/**
 * FE-7 — services.price is stored in CENTS (schema comment, and every other
 * consumer divides by 100); the wizard rendered the raw integer ("$40000"
 * for a $400 inspection).
 */
describe('formatPriceCents', () => {
  it('formats cents as dollars with two decimals', () => {
    expect(formatPriceCents(40000)).toBe('$400.00');
    expect(formatPriceCents(15000)).toBe('$150.00');
    expect(formatPriceCents(9950)).toBe('$99.50');
  });

  it('handles zero and null-ish safely', () => {
    expect(formatPriceCents(0)).toBe('$0.00');
    expect(formatPriceCents(null)).toBe('$0.00');
    expect(formatPriceCents(undefined)).toBe('$0.00');
  });
});

/**
 * B-21 — the New Inspection wizard always walked Property → Services →
 * Schedule → Team even when Services was an empty "nothing configured"
 * placeholder and Team had no choices beyond Solo. Steps with nothing to
 * decide are skipped; the date defaults to today instead of blank.
 */
describe('buildWizardSteps', () => {
  it('keeps all four steps when services + team choices exist', () => {
    expect(buildWizardSteps({ hasServiceCatalog: true, hasTeamChoices: true }))
      .toEqual(['property', 'services', 'schedule', 'team']);
  });

  it('skips Services when the tenant has no service catalog', () => {
    expect(buildWizardSteps({ hasServiceCatalog: false, hasTeamChoices: true }))
      .toEqual(['property', 'schedule', 'team']);
  });

  it('skips Team when there is nobody to choose (solo workspace)', () => {
    expect(buildWizardSteps({ hasServiceCatalog: true, hasTeamChoices: false }))
      .toEqual(['property', 'services', 'schedule']);
  });

  it('collapses to Property → Schedule for the common solo/no-services tenant', () => {
    expect(buildWizardSteps({ hasServiceCatalog: false, hasTeamChoices: false }))
      .toEqual(['property', 'schedule']);
  });
});

describe('todayLocalISO', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(todayLocalISO(new Date(2026, 5, 4, 9, 30))).toBe('2026-06-04');
  });

  it('pads single-digit month/day', () => {
    expect(todayLocalISO(new Date(2026, 0, 7))).toBe('2026-01-07');
  });

  it('uses local time, not UTC (23:30 local on the 4th stays the 4th)', () => {
    expect(todayLocalISO(new Date(2026, 5, 4, 23, 30))).toBe('2026-06-04');
  });
});
