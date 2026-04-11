import { execSync } from 'child_process';
import { writeFileSync, existsSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright globalSetup — runs once before the test suite.
 *
 * Clears all rows from every table in the local D1 database so that
 * POST /setup always returns 200 (fresh workspace) and every test
 * that requires a real token runs instead of being skipped.
 *
 * Requires the dev server to be running (`npm run dev` in apps/core).
 * The setup wizard no longer uses a module-level cache, so the cleared
 * DB is reflected immediately without restarting the dev server.
 */
export default function globalSetup() {
    const appDir = path.resolve(__dirname, '..');
    const sqlFile = path.join(appDir, 'tests', '.reset-core-db.sql');

    // Delete in FK-safe order (child tables first)
    const sql = [
        'PRAGMA foreign_keys=OFF;',
        'DELETE FROM inspection_agreements;',
        'DELETE FROM inspection_results;',
        'DELETE FROM inspections;',
        'DELETE FROM availability_overrides;',
        'DELETE FROM availability;',
        'DELETE FROM tenant_invites;',
        'DELETE FROM agreements;',
        'DELETE FROM templates;',
        'DELETE FROM users;',
        'DELETE FROM tenant_configs;',
        'DELETE FROM tenants;',
        'PRAGMA foreign_keys=ON;',
    ].join('\n');

    writeFileSync(sqlFile, sql, 'utf8');

    try {
        // Ensure all schema migrations are applied (idempotent)
        execSync('npm run db:migrate', { cwd: appDir, stdio: 'pipe' });

        // Clear all data rows (schema stays intact)
        execSync(
            'npx wrangler d1 execute openinspection-db --local --file "tests/.reset-core-db.sql"',
            { cwd: appDir, stdio: 'pipe' },
        );
        console.info('\n[globalSetup] Local D1 cleared — all tests will run against a fresh workspace.\n');
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
            `\n[globalSetup] WARNING: Could not reset local D1 (${msg.split('\n')[0]}).\n` +
            '  Ensure wrangler is installed and the DB was created: npx wrangler d1 create openinspection-db\n',
        );
    } finally {
        if (existsSync(sqlFile)) rmSync(sqlFile);
    }
}
