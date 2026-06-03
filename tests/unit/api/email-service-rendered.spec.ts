import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailService } from '../../../server/services/email.service';
import { EmailTemplateRenderer } from '../../../server/lib/email-templates/renderer';

const renderer = new EmailTemplateRenderer({
  tenantBrand: { name: 'Acme', logoUrl: null, primaryColor: '#F55A1A' },
  platformBrand: { name: 'OpenInspection', logoUrl: null, primaryColor: '#4f46e5' },
});

describe('EmailService rendered path', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => { fetchMock = vi.fn(async () => new Response('{}', { status: 200 })); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it('sends a branded, variable-substituted report-ready email', async () => {
    const svc = new EmailService('re_test', 'reports@acme.com', 'Acme', undefined, renderer);
    await svc.sendReportReady('c@x.com', '12 Elm St', 'https://x/report');
    const body = JSON.parse((fetchMock.mock.calls.at(-1)![1] as RequestInit).body as string);
    expect(body.subject).toBe('Property Inspection Report: 12 Elm St');
    expect(body.html).toContain('12 Elm St');
    expect(body.html).toContain('https://x/report');
    expect(body.html).toContain('Acme');
  });

  it('without a renderer, still sends via the inline fallback (no throw)', async () => {
    const svc = new EmailService('re_test', 'reports@acme.com', 'Acme');
    await svc.sendReportReady('c@x.com', '9 Oak', 'https://x/r2');
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse((fetchMock.mock.calls.at(-1)![1] as RequestInit).body as string);
    expect(body.subject).toBe('Property Inspection Report: 9 Oak');
  });
});
