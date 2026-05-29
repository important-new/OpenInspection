import { createRequestHandler } from "react-router";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

// Minimal Env shape — bindings we read from React Router loaders/actions
// flow through `context.cloudflare.env`. The full set is declared in
// frontend/wrangler.toml ([[services]] API_WORKER, [vars] API_URL +
// SESSION_SECRET, [assets] ASSETS).
interface Env {
  API_WORKER?: Fetcher;
  ASSETS?: Fetcher;
  API_URL?: string;
  SESSION_SECRET?: string;
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    // Transitional globalThis bridge — kept while api.server.ts still reads
    // bindings off __API_WORKER. L2 of the canonical-deploy refactor swaps
    // every loader/action to read from `context.cloudflare.env` and removes
    // these three lines.
    if (env.API_WORKER) (globalThis as Record<string, unknown>).__API_WORKER = env.API_WORKER;
    if (env.API_URL) (globalThis as Record<string, unknown>).__API_URL = env.API_URL;
    if (env.SESSION_SECRET) (globalThis as Record<string, unknown>).__SESSION_SECRET = env.SESSION_SECRET;

    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
} satisfies ExportedHandler<Env>;
