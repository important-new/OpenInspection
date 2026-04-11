# Reports & Payment

When an inspection is marked complete, OpenInspection sends the client a link to their digital report. The client can view a summary for free, sign the inspection agreement, and pay to unlock the full report.

---

## The Report Page

The report at `/inspections/:id/report` (or `/api/inspections/:id/report`) is publicly accessible — no login required. Share the link directly with clients, or let the system email it automatically.

A demo report is always available at `/inspections/demo/report` — useful for showing clients what to expect before their inspection.

**The report shows:**

- Property address, inspection date, and inspector name
- Summary statistics: total items checked, OK / Monitor / Defect counts
- Full checklist results section-by-section, with:
  - Color-coded status badges (green / amber / red)
  - Inspector notes
  - Photo thumbnails (click to enlarge)
- Inspection agreement (shown before the full report is unlocked)
- Payment unlock button

---

## Email Delivery

When you mark an inspection complete from the dashboard, the system automatically emails the client if a `clientEmail` was set on the inspection.

The email contains:
- A short message with the property address
- A **View Interactive Report** button linking directly to the report

Email is sent via [Resend](https://resend.com). If `RESEND_API_KEY` is not configured, email is silently skipped and the API still returns `{ "success": true }`.

### Setting up email

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month).
2. Verify your sending domain.
3. Add your API key and sender address:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put SENDER_EMAIL   # e.g. "Reports <reports@yourdomain.com>"
```

---

## Inspection Agreement & E-Signature

Before the full report is unlocked, clients are shown your inspection agreement and prompted to sign it digitally.

**The agreement flow:**
1. Client opens the report link.
2. If they haven't signed, the agreement text is displayed (fetched from `GET /api/inspections/:id/agreement`).
3. Client reads the terms and draws their signature in the canvas box.
4. They click **Sign** — the signature image is posted to `POST /api/inspections/:id/sign` and stored in `inspection_agreements`.
5. After signing, the payment prompt appears.

The signature is stored as a base64 PNG along with the timestamp, IP address, and user-agent for legal record-keeping.

### Customizing the Agreement

Agreement text is stored in the `agreements` table. The default fallback text is a basic terms-of-service. To use your own:

```sql
-- Run in your D1 database
INSERT INTO agreements (id, tenant_id, name, content, version, created_at)
VALUES (
    'agr-001',
    'your-tenant-id',
    'Standard Home Inspection Agreement',
    '# Home Inspection Agreement

By signing below, you agree to the following terms:

**1. Scope of Inspection**
This is a visual inspection of accessible components...

**2. Limitations**
The inspector is not liable for concealed defects...

**3. Payment**
Payment is due prior to report release.',
    1,
    unixepoch()
);
```

---

## Pay-to-Unlock Report

After signing the agreement, clients see a **Unlock Full Report** button. Clicking it initiates payment.

**Current state:** Payment is mocked for development. The mock flow:
1. Client clicks **Unlock Full Report**
2. A POST to `/api/inspections/:id/checkout` returns a redirect URL
3. The client is redirected, which immediately sets `paymentStatus = 'paid'`
4. The full report renders

**Setting the price:** The `price` column on inspections stores the amount in cents (e.g., `45000` = $450.00). The default for bookings submitted via `/api/public/book` is $450.00. Adjust this in `src/api/bookings.ts`:

```ts
price: 45000  // → change to your standard rate in cents
```

**Integrating real Stripe payments:** See [Customization Guide — Payment Integration](../developers/04_customization.md#payment-integration).

---

## Sharing Reports

The report URL is shareable and permanent. You can send it:
- Via the automated email (triggered by marking complete)
- Manually by copying the URL from the dashboard
- By embedding the link in your own client portal

There is no expiry on report links. If the `paymentStatus` is `'paid'`, the full report is always accessible to anyone with the link.

---

## Data Export

To download all your inspection data as JSON (for backup or migration):

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-domain.com/api/admin/export
```

The response includes all inspections, field results, templates, agreements, and signatures for your workspace. See [API Reference — Data Export](../developers/02_api_reference.md#get-apiadminexport).
