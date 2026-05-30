#!/usr/bin/env node
/**
 * Fold the API's static assets into the React Router client build so the single
 * worker can serve the API-rendered HTML pages (/sign, /observe, /book data
 * pages…) with their CSS/vendor libs. Run after `react-router build`.
 *
 * Only copies what the RR client build doesn't already produce — styles.css and
 * vendor/ — to avoid clobbering the frontend's own favicon/fonts/logo.
 */
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "api", "public");
const dest = join(root, "frontend", "build", "client");

for (const item of ["styles.css", "vendor"]) {
  const from = join(src, item);
  if (existsSync(from)) cpSync(from, join(dest, item), { recursive: true });
}
console.log("✓ merged api/public {styles.css,vendor} into frontend/build/client");
