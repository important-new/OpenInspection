import { getDescriptor } from './registry';
import { interpolate, escapeHtml } from './interpolate';
import { EmailLayout } from './layout';
import type { TemplateBrand, RenderResult, EmailTemplateDescriptor } from './types';

export interface RendererBrands {
  tenantBrand: TemplateBrand;
  platformBrand: TemplateBrand;
}

/**
 * Email-template Phase 2 — render a trigger to { subject, html, enabled }
 * from registry DEFAULTS (no per-tenant override yet — Phase 3 adds that).
 */
export class EmailTemplateRenderer {
  constructor(private brands: RendererBrands) {}

  render(trigger: string, data: Record<string, unknown>): RenderResult {
    const d = getDescriptor(trigger);
    if (!d) throw new Error(`Unknown email template trigger: ${trigger}`);

    const allowed = d.variables.map(v => v.name);
    const resolve = (s: string) => interpolate(s, data, allowed);

    const subject = stripTags(resolve(d.defaultSubject));
    const blockValues = new Map(d.blocks.map(b => [b.key, resolve(b.default)]));

    const heading = blockValues.get('heading') ?? '';
    const ctaLabelKey = d.cta?.labelBlockKey;
    const paragraphs = d.blocks
      .filter(b => b.key !== 'heading' && b.key !== ctaLabelKey)
      .map(b => blockValues.get(b.key) ?? '');

    let cta: { label: string; url: string } | undefined;
    if (d.cta) {
      const label = blockValues.get(d.cta.labelBlockKey) ?? '';
      const url = escapeHtml(String(data[d.cta.urlVar] ?? ''));
      if (url) cta = { label, url };
    }

    const brand = d.brand === 'platform' ? this.brands.platformBrand : this.brands.tenantBrand;
    const systemHtml = this.buildSystemBlocks(d, data);

    const html = EmailLayout({ brand, heading, paragraphs, ...(cta ? { cta } : {}), ...(systemHtml !== undefined ? { systemHtml } : {}) });
    return { subject, html, enabled: true };
  }

  private buildSystemBlocks(d: EmailTemplateDescriptor, data: Record<string, unknown>): string | undefined {
    if (!d.systemBlocks?.length) return undefined;
    const esc = (v: unknown) => escapeHtml(String(v ?? ''));
    const parts: string[] = [];
    for (const kind of d.systemBlocks) {
      if (kind === 'auditMetadata') {
        parts.push(`<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px 16px;margin:8px 0;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#94a3b8;line-height:1.6;">Signed: ${esc(data.signedAtUtc)}<br>IP: ${esc(data.ipAddress) || 'recorded'}<br>Confirmation: ${esc(data.confirmationId)}</div>`);
      } else if (kind === 'attachmentManifest') {
        parts.push(`<p style="margin:8px 0;font-size:13px;color:#64748b;">The full document is attached to this email.</p>`);
      } else if (kind === 'icsHint') {
        parts.push(`<p style="margin:8px 0;font-size:13px;color:#64748b;">A calendar invite (<strong>inspection.ics</strong>) is attached — open it to add this to your calendar.</p>`);
      }
    }
    return parts.join('\n');
  }
}

/** Subjects are plain text; un-escape the entities the interpolator added. */
function stripTags(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
