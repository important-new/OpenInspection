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

const app = new Hono();

// Routing ownership in the merged worker:
// - Static assets (/favicon.svg, /logo.svg, /styles.css, /vendor/*, /fonts/*) are
//   served by the Cloudflare assets layer from build/client BEFORE the worker runs,
//   so the API's serveStatic routes for them become unreachable (auto-resolved).
// - The frontend owns "/" — without this explicit override the API's
//   `app.get('/', redirect('/dashboard'))` would shadow the home route.
// - The API owns its real paths (/api/*, /status, /m2m/*, /photos/*, /sign/*,
//   /observe/:token, /inspector/*/calendar.ics, …), mounted at root.
// - Everything else falls through to React Router SSR.
// TODO(routing audit): confirm /sign/:tenant/:id, /agreement-sign and
// /observe/:token do not need to render as RR pages instead of API responses.
app.get("/", ssr);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.route("/", apiApp as any);
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
