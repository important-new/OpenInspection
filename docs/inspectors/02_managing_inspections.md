# Managing Inspections

The **Dashboard** at `/dashboard` is your home base. It shows all inspection jobs for your workspace, lets you create new ones, and tracks status through the workflow.

---

## Dashboard Overview

The dashboard loads your inspection list from the API on page load. Each row shows:

- **Property address** — where the inspection is
- **Client** — client name and email
- **Inspector** — who is assigned
- **Date** — scheduled inspection date
- **Status** — current stage (`draft`, `completed`, or `delivered`)
- **Actions** — links to the field form and report

The dashboard uses your JWT token (stored in `localStorage`) to authenticate API requests. If you're not logged in, you'll be redirected to `/setup` or a login prompt.

---

## Creating an Inspection

From the dashboard, click **New Inspection** (or call `POST /api/inspections` directly).

**Required fields:**
- **Property Address** — full street address (e.g., `456 Oak Ave, Portland OR 97201`)
- **Template** — the checklist to use (select from your saved templates)

**Optional fields:**
- **Client Name** — used on the report and in the confirmation email
- **Client Email** — the report link is emailed here when the inspection is marked complete
- **Inspector** — which team member is doing the job (defaults to you)
- **Date/Time** — when the inspection is scheduled
- **Referred By** — agent ID if this job came from a referral (see [Agent CRM](./06_booking_system.md))

---

## Inspection Status Workflow

```
[Booking submitted] → draft
       │
       ▼
[Inspector completes field form] → (still draft until explicitly completed)
       │
       ▼
[Mark as Complete] → completed  (triggers email to client)
       │
       ▼
[Client pays to unlock] → paymentStatus: paid
```

| Status | Meaning |
|---|---|
| `draft` | Job created, field data may or may not be collected |
| `completed` | Inspector has submitted field data and marked the job done |
| `delivered` | Report has been accessed and payment received |

---

## Completing an Inspection

Once the inspector has finished collecting field data on-site:

1. On the dashboard, find the inspection and click **Mark Complete**.
2. This sets `status` to `'completed'` and sends the report link to the client's email.
3. The email contains a direct link to `/inspections/:id/report`.

> If no `clientEmail` was set, completion still succeeds but no email is sent.

---

## Viewing the Report

Click **View Report** on any inspection to open the client-facing report at `/inspections/:id/report`.

This is the same page your client sees. It shows:
- Inspection summary (address, date, inspector)
- Full checklist results with status badges and photos
- E-signature area (if client hasn't signed yet)
- Payment unlock gate (if `paymentStatus` is still `'unpaid'`)

---

## Editing Field Data After the Fact

Field data can be updated at any time by re-opening the field form at `/inspections/:id/form`. The form performs an upsert — re-saving overwrites the previous data.

> **Note:** There is no per-field change history. Save carefully before navigating away.

---

## Deleting Inspections

There is no delete endpoint in the current version. To remove a record, delete it directly from D1:

```bash
# Using wrangler
npx wrangler d1 execute openinspection-db --command \
  "DELETE FROM inspections WHERE id = 'your-inspection-id';"
```

---

## Filtering and Searching

The current dashboard loads all inspections for the tenant. Browser-side filtering (by status, date, or inspector) can be added to `src/templates/pages/dashboard.template.ts` — see the [Customization Guide](../developers/04_customization.md).
