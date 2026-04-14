/**
 * Cross-platform pre-commit hook (Windows/macOS/Linux)
 */
import { execSync } from 'child_process';
import { rmSync, existsSync } from 'fs';
import path from 'path';

const PASS = '✓';
const FAIL = '✗';
const WARN = '⚠';
let failed = false;

function step(msg) {
  console.log(`\n  → ${msg}`);
}

function pass(msg) {
  console.log(`  ${PASS}  ${msg}`);
}

function fail(msg) {
  console.log(`  ${FAIL}  ${msg}`);
  failed = true;
}

function run(cmd, options = {}) {
  try {
    execSync(cmd, {
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '1' },
    });
    return true;
  } catch {
    return false;
  }
}

console.log('── OpenInspection (Pre-commit Checks) ───────────────────────────');

// 1. Type check
step('Type check');
if (run('npm run type-check', { silent: true })) {
  pass('Type check passed');
} else {
  fail('Type check failed → npm run type-check');
}

// 2. Lint & Fix
step('Lint & Fix');
if (run('npx lint-staged', { silent: false })) {
  pass('Lint & Fix passed');
} else {
  fail('Lint failed → npx lint-staged');
}

// 3. Bundle size check
step('Bundle size check');
const distPath = path.join(process.cwd(), '.dist-pre-commit');
if (existsSync(distPath)) rmSync(distPath, { recursive: true, force: true });

// Wrangler dry-run may hang on exit; spawn it and watch for output directory
const { spawn } = await import('child_process');
const wrangler = spawn('npx', ['wrangler', 'deploy', '--dry-run', '--outdir', distPath], {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: { ...process.env, FORCE_COLOR: '1' },
});

let wranglerDone = false;
const killTimer = setTimeout(() => {
  if (!wranglerDone) {
    wrangler.kill();
  }
}, 60000); // 60s kill timeout

// Watch for output directory
let bundleOk = false;
const watchInterval = setInterval(() => {
  if (existsSync(distPath)) {
    try {
      const files = require('fs').readdirSync(distPath);
      if (files.some(f => f.endsWith('.js') || f.endsWith('.map'))) {
        bundleOk = true;
        wrangler.kill();
        clearInterval(watchInterval);
        clearTimeout(killTimer);
        wranglerDone = true;
      }
    } catch { /* ignore */ }
  }
}, 500);

await new Promise((resolve) => {
  wrangler.on('close', () => { wranglerDone = true; resolve(); });
  wrangler.on('error', () => { wranglerDone = true; resolve(); });
  // Fallback: resolve after kill timer
  killTimer.ref && killTimer.unref && killTimer.unref();
});

clearInterval(watchInterval);
clearTimeout(killTimer);
if (!wranglerDone) { wrangler.kill(); await new Promise(r => setTimeout(r, 500)); }

if (bundleOk) {
  pass('Bundle build success');
} else {
  fail('Bundle build failed (no output)');
}
if (existsSync(distPath)) rmSync(distPath, { recursive: true, force: true });

// Final result
if (failed) {
  console.log('\nPre-commit checks failed. Fix the errors before committing.');
  process.exit(1);
}

console.log('\nAll pre-commit checks passed.');
process.exit(0);
