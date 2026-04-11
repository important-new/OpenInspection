# OpenInspection Development Standards

Welcome to the OpenInspection core repository. To maintain industrial-grade quality and a premium user experience, all contributions must adhere to the following standards.

## 🎨 UI & Design Standards

We follow a **Glassmorphism** design language.

- **Tokens**:
    - **Backdrop Blur**: `backdrop-blur-md` or `backdrop-blur-xl`.
    - **Borders**: `border-white/20` or `border-slate-200/50`.
    - **Shadows**: Large, soft shadows (e.g., `shadow-2xl shadow-indigo-100/30`).
- **Typography**: Primary font is **Inter**, fallback is **Outfit**. Avoid system defaults.
- **Tailwind Class Ordering**: We enforce a standard sequence: **Layout → Box Model → Typography → Visual Styles → Interaction/States**. Use the official Prettier plugin for automatic sorting.
- **Interactivity**: Every button must have a hover/active state (e.g., `active:scale-95`). Use `animate-fade-in` for new entries.

## 📡 API Development

All API endpoints must be defined using **OpenAPIHono**.

- **Contract-First**: Define Zod schemas in `src/lib/validations/` before writing the controller.
- **Type Safety**: Routes must be registered using `.openapi()`.
- **Validation Errors**: Ensure frontend handlers can parse detailed Zod errors. Use the helper logic from `public/js/setup.js`.

## 🏗 Infrastructure & Scripts

The `scripts/` directory contains mission-critical automation.

- **Idempotency**: Scripts must be able to run multiple times without side effects (e.g., skip resource creation if ID already exists).
- **Fault Tolerance**: Any network request must have a **3-retry mechanism with backoff**.
- **Hygiene**:
    - Do not commit hardcoded Cloudflare IDs to the repo's base `wrangler.toml` (template).
    - Use the setup script to patch IDs locally.

## ✅ Quality Checklist

- **Hard Blocks**: We have a zero-tolerance policy for:
    - `any` types (unless explicitly justified and suppressed with comment).
    - Unused variables or imports (`no-unused-vars`).
    - TypeScript compilation errors (`npm run type-check`).
    - Lint warnings (`npm run lint`).
  All of the above MUST be resolved before pushing or opening a PR.
- **Logging**: Ensure no `console.trace` or `console.log` remains in production code (use `src/lib/logger.ts` instead).

## 🧪 Testing

- **E2E**: New routes should have an equivalent test case in `tests/e2e/`.
- **Unit**: Complex logic in `src/lib/` requires `vitest` unit tests.

---
*OpenInspection 1.0.0-rc.1 — Professionalizing the Open-Source Inspection Engine.*
