# Customization Guide

OpenInspection is designed to be edited directly — there is no plugin system or admin theme panel. All public-facing content lives in TypeScript template files. Edit the strings, rebuild CSS, and redeploy.

---

## Branding

OpenInspection uses a dynamic branding system that supports both environment-level defaults and tenant-specific overrides.

### 1. Simple Branding (Env Vars & UI)
The easiest way to change branding without editing code:
- **Environment Variables**: Set `APP_NAME`, `PRIMARY_COLOR`, and `SUPPORT_EMAIL` in your `.dev.vars` or Cloudflare dashboard. This sets the global default for your instance.
- **Settings UI**: Log in as an admin and navigate to `/settings`. You can upload a logo and change the site name/colors directly. These values are stored in the database and override the environment defaults for that workspace.

### 2. Code Customization (Templates)
If you need to change the **structure** or **layout** of the branding (e.g., adding a specific icon next to the title), edit `src/templates/layouts/main-layout.tsx` or `src/templates/components/header.tsx`.

> [!NOTE]
> For a single-codebase experience, prefer using the **Settings UI** for content changes and only edit **Templates** for structural design changes.

### Fonts

Fonts are loaded from Google Fonts in the layout files. `renderMainLayout` (public pages) loads both Inter and Playfair Display. `renderBareLayout` (authenticated pages) loads Inter only.

To change the font, update the Google Fonts `<link>` in `src/templates/layouts/main-layout.template.ts` and set the matching `font-family` in `src/styles/input.css`:

```css
/* src/styles/input.css */
body {
    font-family: 'Your Font', sans-serif;
}
```

Then rebuild CSS: `npm run css:build`.

### Shared CSS & Design Tokens

All custom utilities and shared styles live in `src/styles/input.css`. This is the single source of truth for:

- `.glass` / `.glass-dark` — frosted-glass card effect
- `.btn-primary` — indigo gradient button with hover lift
- `.gradient-text` — purple gradient text
- `.table-row-hover` — subtle table row hover animation
- `.animate-slide-in` / `.fade-in` — entrance animations
- `.blur-content`, `.signature-pad-wrap` — report viewer components
- `.scrollbar-hide` — hide scrollbar on photo galleries
- Print rules (`@media print`) — report PDF export styling

To change the brand color, find and replace `#6366f1` / `#4f46e5` (indigo-500/600) throughout `input.css`, then run `npm run css:build`.

The compiled output is served as a static file at `/styles.css` via Cloudflare Workers Assets (`[assets] directory = "./public"` in `wrangler.toml`).

### Header & Footer

The header and footer are intentionally empty stubs — add your logo, phone number, navigation, and legal text here:

- `src/templates/components/header.template.ts`
- `src/templates/components/footer.template.ts`

Example header:

```ts
export const renderHeader = () => `
  <header class="bg-white shadow-sm">
    <div class="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
      <a href="/" class="text-xl font-bold text-slate-900">Smith Home Inspections</a>
      <nav class="flex gap-6 text-sm">
        <a href="/book" class="text-indigo-600 font-medium">Book Now</a>
        <a href="tel:+15551234567">(555) 123-4567</a>
      </nav>
    </div>
  </header>
`;
```

Example footer:

```ts
export const renderFooter = () => `
  <footer class="border-t border-slate-200 mt-16 py-8 text-sm text-slate-500 text-center">
    <p>Smith Home Inspections — Licensed &amp; Insured — ASHI Member #12345</p>
    <p class="mt-1">123 Elm Street, Portland OR · (555) 123-4567 · info@smithinspections.com</p>
  </footer>
`;
```

---

## Homepage

The homepage is `src/templates/pages/home.template.ts`. Edit the hero headline, subheading, service cards, and any other sections directly in the template string.

Key areas to customize:
- Hero headline and subheading
- Service card titles and descriptions
- Testimonials (add a new section anywhere)
- Service area and certifications
- CTA button text and booking link

---

## Inspection Checklists (Templates)

Inspection templates are stored in the `templates` database table. The `schema` column is a JSON object with this structure:

```json
{
  "sections": [
    {
      "title": "Roof & Structure",
      "items": [
        { "id": "roof_shingles", "label": "Shingles Condition" },
        { "id": "roof_flashing", "label": "Flashing & Seals" },
        { "id": "roof_gutters",  "label": "Gutters & Downspouts" }
      ]
    },
    {
      "title": "Electrical",
      "items": [
        { "id": "elec_panel", "label": "Main Panel" },
        { "id": "elec_outlets", "label": "Outlets & Switches" }
      ]
    }
  ]
}
```

Each item gets a `status` dropdown (OK / Monitor / Defect), a `notes` text field, and a photo upload button in the field form automatically.

**To create or edit templates:** Insert or update rows directly in D1 via the Cloudflare dashboard, or add a migration file:

```sql
-- migrations/0004_custom_template.sql
INSERT INTO templates (id, tenant_id, name, version, schema, created_at)
VALUES (
    'residential-v2',
    'your-tenant-id',
    'Residential Inspection v2',
    1,
    '{"sections":[...]}',
    unixepoch()
);
```

---

## Adding a New Page

1. Create `src/templates/pages/your-page.template.ts`:

```ts
export function renderYourPage(): string {
    return `
        <div class="max-w-4xl mx-auto px-4 py-16">
            <h1 class="text-3xl font-bold text-slate-900 mb-6">About Us</h1>
            <p class="text-slate-600">...</p>
        </div>
    `;
}
```

2. Register the route in `src/index.ts`:

```ts
import { renderYourPage } from './templates/pages/your-page.template';

app.get('/about', (c) => c.html(renderMainLayout({
    title: 'About Us',
    children: renderYourPage()
})));
```

---

## Removing or Renaming Routes

All routes are defined in `src/index.ts`. You can change paths or remove pages freely. The routes required for the core inspection workflow are:

- `GET /book` — client booking form
- `GET /inspections/:id/form` — inspector field form
- `GET /api/inspections/:id/report` — client report viewer
- All `/api/*` handlers — backend logic

---

## Google Analytics

Uncomment and configure `src/templates/components/google-analytics.template.ts` and include it in `main-layout.template.ts`:

```ts
import { renderGoogleAnalytics } from '../components/google-analytics.template';

// Inside the <head> section:
${renderGoogleAnalytics('G-XXXXXXXXXX')}
```

---

## Cookie Consent

A cookie consent banner component is available at `src/templates/components/cookie-consent.template.ts`. Include it in the layout if required by your jurisdiction:

```ts
import { renderCookieConsent } from '../components/cookie-consent.template';

// At the bottom of <body>:
${renderCookieConsent()}
```

---

## Report Styling

The client report viewer is `src/templates/pages/report.template.ts`. The report renders the checklist results in a professional layout with:

- Color-coded status badges (OK / Monitor / Defect)
- Photo thumbnails for each item
- Summary statistics section
- E-signature capture area
- Pay-to-unlock gate for the full report

Edit the template directly to change colors, layout, or add your company logo.

---

## Payment Integration

The checkout flow is currently mocked. To integrate real Stripe payments:

1. Add `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` to your secrets.
2. In `src/api/inspections.ts`, replace the mock URL in `POST /:id/checkout` with a real Stripe Checkout session:

```ts
// Replace the mock section with:
import Stripe from 'stripe';
const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);
const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price_data: { currency: 'usd', unit_amount: inspection.price, product_data: { name: `Inspection Report: ${inspection.propertyAddress}` } }, quantity: 1 }],
    success_url: `${protocol}://${host}/api/inspections/${id}/payment-success`,
    cancel_url: `${protocol}://${host}/api/inspections/${id}/report`
});
return c.json({ url: session.url });
```

3. Add a real `GET /:id/payment-success` handler that verifies the Stripe session and updates `paymentStatus` to `'paid'`.
