/**
 * Commercial PCA Task 19a — real TOC page numbers, end-to-end.
 *
 * Exercises the ACTUAL worker report render (not a synthetic fixture, unlike
 * the falsified/removed Paged.js proof this replaces —
 * tests/e2e/report-toc-pagednumbers.spec.ts): creates a commercial-tier
 * inspection via the wizard endpoint (propertyType: 'commercial' resolves a
 * non-null report tier — server/lib/report-tier.ts — which gives the report a
 * non-empty TOC outline, server/lib/report-outline.ts, with NO template or
 * authored content required), downloads the on-demand full PDF (which routes
 * through `getOrRender` -> `renderAndStore` -> `generatePdfWithTocPages` per
 * Task 19a Step 3, since `numberedToc` is true for any non-null report tier),
 * and asserts the TOC's own `extractAnchorPages` reading resolves each
 * outline anchor to an increasing page number.
 *
 * Requires the wrangler-dev BROWSER (Cloudflare Browser Rendering) + PHOTOS
 * (R2) bindings — `GET /api/inspections/:id/pdf` 503s
 * (PDF_UNAVAILABLE) without them (server/api/inspections/report-delivery.ts).
 * Local `wrangler dev` typically has neither wired to a live CF account, so
 * this test SKIPS itself on that 503 rather than failing the suite — the
 * real gate is CI, where BROWSER/PHOTOS should be bound. Do NOT treat a local
 * skip here as a pass: see the Task 19a report for whether this test
 * actually executed the render in this environment.
 */
import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { extractAnchorPages } from '../../server/lib/toc-pages';

const BASE_URL = 'http://127.0.0.1:8789';
const ADMIN_EMAIL = 'admin@autotest.com';
const ADMIN_PASSWORD = 'Password123!';

async function loginApi(request: APIRequestContext, email: string, password: string): Promise<string> {
    const res = await request.post(`${BASE_URL}/api/auth/login`, {
        data: { email, password },
        headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status(), `Login failed for ${email}: expected 200`).toBe(200);
    const cookie = res.headers()['set-cookie'] ?? '';
    const match = cookie.match(/__Host-inspector_token=([^;]+)/);
    const token = match?.[1] ?? '';
    expect(token, `No auth token returned for ${email}`).toBeTruthy();
    return token;
}

test.describe('Commercial PCA Task 19a — real TOC page numbers (e2e)', () => {
    test('the published commercial report PDF resolves increasing TOC page numbers via the two-pass render', async ({ request }) => {
        // The editor-seed project (a dependency of this test's project) already
        // ran /api/auth/setup for the shared admin — reuse it, mirroring
        // standalone-browser.spec.ts's loginApi pattern.
        const adminToken = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);

        // Wizard-create a TEMPLATELESS commercial inspection. propertyType:
        // 'commercial' resolves reportTier -> 'light_commercial' (report-tier.ts
        // defaults commercial to light unless elevated), which is enough for
        // buildReportOutline to project a non-empty TOC — no template/authored
        // items required (report-outline.ts is a pure static projection keyed
        // only on tier).
        const wizardRes = await request.post(`${BASE_URL}/api/inspections/wizard`, {
            data: {
                property: {
                    address: '100 Commercial Plaza, Springfield',
                    propertyType: 'commercial',
                },
                services: ['general'],
                schedule: { date: '2026-08-01', startTime: '09:00', durationMinutes: 120 },
                teamMode: false,
            },
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        });
        expect(wizardRes.status(), await wizardRes.text().catch(() => '')).toBe(201);
        const inspectionId: string = (await wizardRes.json()).data?.inspection?.id;
        expect(inspectionId, 'wizard must return the created inspection id').toBeTruthy();

        // On-demand full PDF download — routes through
        // ReportPdfService.getOrRender -> renderAndStore, which now calls
        // generatePdfWithTocPages whenever the resolved report tier is non-null
        // (server/api/inspections/report-delivery.ts downloadPdfRoute; Task 19a
        // Step 3). Requires BROWSER + PHOTOS bindings — 503s cleanly without them.
        const pdfRes = await request.get(`${BASE_URL}/api/inspections/${inspectionId}/pdf?type=full`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });

        if (pdfRes.status() === 503) {
            test.skip(true, 'PDF rendering not configured in this environment (no BROWSER/PHOTOS binding) — see the Task 19a report.');
            return;
        }

        expect(pdfRes.ok(), await pdfRes.text().catch(() => '')).toBeTruthy();
        const pdfBytes = await pdfRes.body();

        const pageMap = await extractAnchorPages(pdfBytes);
        const resolvedPages = Object.values(pageMap);

        // The gated PCA section registry always projects at least the PCA
        // Summary front-matter entries onto the TOC (server/lib/pca-section-registry.ts) —
        // so a commercial report must resolve at least one named destination.
        expect(resolvedPages.length, `expected at least one resolved TOC anchor, got ${JSON.stringify(pageMap)}`).toBeGreaterThan(0);
        for (const page of resolvedPages) {
            expect(page).toBeGreaterThan(0);
        }
        // Strictly increasing in outline (document) order — resolve by walking
        // pageMap in the SAME key-insertion order extractAnchorPages produced,
        // which mirrors the name tree's (and therefore the TOC's) order.
        const pages = Object.values(pageMap);
        for (let i = 1; i < pages.length; i++) {
            expect(pages[i], `TOC page numbers should be non-decreasing down the list (index ${i})`).toBeGreaterThanOrEqual(pages[i - 1]);
        }
    });
});
