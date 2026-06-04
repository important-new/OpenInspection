/**
 * B-21 — New Inspection wizard step plan + date default.
 *
 * Steps with nothing to decide are skipped instead of rendered as empty
 * placeholders the inspector has to click through: Services disappears when
 * the tenant has no service catalog, Team disappears when there is nobody to
 * pick (solo workspace). The Schedule date defaults to "today" in the
 * inspector's local timezone — on-site creation is overwhelmingly same-day.
 */

export type WizardStepId = 'property' | 'services' | 'schedule' | 'team';

export function buildWizardSteps(opts: {
  hasServiceCatalog: boolean;
  hasTeamChoices: boolean;
}): WizardStepId[] {
  const steps: WizardStepId[] = ['property'];
  if (opts.hasServiceCatalog) steps.push('services');
  steps.push('schedule');
  if (opts.hasTeamChoices) steps.push('team');
  return steps;
}

export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
