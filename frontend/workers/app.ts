// Single-worker entry (cloudflare/react-router-hono-fullstack-template shape):
// Hono is the worker entry; it mounts the full OpenInspection API and delegates
// every other path to the React Router SSR handler. Replaces the dual-worker
// (API worker + web worker + Service Binding) topology with one deployable.
import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import apiHandler, { app as apiApp } from "../../api/src/index";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

interface Env {
  ASSETS?: Fetcher;
  API_URL?: string;
  SESSION_SECRET?: string;
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ssr = (c: any) =>
  requestHandler(c.req.raw, { cloudflare: { env: c.env, ctx: c.executionCtx } });

// Delegate to the FULL API app (all its global `app.use('*')` middleware — CSRF,
// tenant routing, DI, branding, … — runs INSIDE this call). By only routing
// API-owned paths here, that middleware never blankets frontend routes, which is
// what caused the CSRF 403 on the frontend's /login POST when the API was mounted
// at "/". Mirrors the CF template's "explicit API routes before the catch-all".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toApi = (c: any) => apiApp.fetch(c.req.raw, c.env, c.executionCtx);

const app = new Hono();

// --- API-owned paths → the API app (with its middleware) ---
// Genuine API endpoints with no React Router page counterpart.
app.all("/api/*", toApi);
app.all("/status", toApi);
app.all("/m2m/*", toApi);
app.all("/photos/*", toApi);
app.all("/.well-known/*", toApi);
app.get("/ui", toApi);
// TODO(routing audit): these prefixes have BOTH an API handler and a React Router
// page (the RR migration superseded the API-rendered HTML). They currently fall to
// RR below. Confirm none still need the API response, or delegate selectively:
//   /book/* /report/* /verify/* /sign/* /agreements/sign/* /observe/* /r/*
//   /messages/* /inspector/*  (e.g. /inspector/*/calendar.ics is API-only)

// --- Everything else → React Router SSR (all pages incl. "/" and /login) ---
// Static assets (/favicon.svg, /styles.css, /vendor/*, /fonts/*) are served by the
// Cloudflare assets layer from build/client before the worker runs.
app.all("*", ssr);

// fetch from the merged Hono app; scheduled (cron) reused from the API handler.
export default {
  fetch: app.fetch,
  scheduled: apiHandler.scheduled,
};

// Re-export Durable Objects + Workflow so wrangler can bind them on the single
// worker (their class names are referenced by the combined wrangler config).
export { InspectionPresenceDO } from "../../api/src/durable-objects/inspection-presence";
export { TenantPresenceDO } from "../../api/src/durable-objects/tenant-presence";
export { SignCompletionWorkflow } from "../../api/src/workflows/sign-completion-workflow";
