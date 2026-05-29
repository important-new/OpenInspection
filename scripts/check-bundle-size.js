import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

const LIMIT_KB = 1024;
const isWin = os.platform() === 'win32';
const cmd = isWin ? 'npx.cmd' : 'npx';

function checkBundle({ label, cwd, args }) {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, {
            cwd,
            env: { ...process.env, CI: 'true' },
            shell: isWin,
            detached: !isWin,
        });
        let output = '';
        let killed = false;
        const finish = (ok, line) => {
            killed = true;
            try {
                if (isWin) execSync(`taskkill /pid ${child.pid} /T /F >nul 2>&1`);
                else process.kill(-child.pid);
            } catch {}
            console.log(line);
            resolve(ok);
        };

        child.stdout.on('data', (data) => {
            if (killed) return;
            output += data.toString();
            const match = output.match(/Total Upload:.*?gzip:\s*([\d.]+)/);
            if (match) {
                const sizeKb = parseFloat(match[1]);
                if (sizeKb >= LIMIT_KB) {
                    finish(false, `  ✗  ${label}: ${sizeKb} KiB gzip exceeds ${LIMIT_KB} KiB limit`);
                } else {
                    finish(true, `  ✓  ${label}: ${sizeKb} KiB gzip (limit ${LIMIT_KB} KiB)`);
                }
            }
        });

        child.stderr.on('data', (data) => {
            if (!killed) output += data.toString();
        });

        child.on('close', () => {
            if (!killed) {
                console.error(`  ✗  ${label}: wrangler dry-run failed or "Total Upload" line not found`);
                resolve(false);
            }
        });

        child.on('error', (err) => {
            console.error(`  ✗  ${label}: wrangler spawn error:`, err.message);
            resolve(false);
        });
    });
}

(async () => {
    console.log('  →  Bundle size: API');
    const apiOk = await checkBundle({
        label: 'API',
        cwd: process.cwd(),
        args: ['wrangler', 'deploy', '--dry-run', '--outdir', 'dist', '--config', 'api/wrangler.toml'],
    });

    console.log('  →  Bundle size: Web');
    const frontendDir = join(process.cwd(), 'frontend');
    const frontendBuild = join(frontendDir, 'build', 'client');
    let webOk = true;
    if (!existsSync(frontendBuild)) {
        console.log('  ⚠  Web: frontend/build/client missing — run `cd frontend && npx react-router build` for an accurate measurement (skipped).');
    } else {
        webOk = await checkBundle({
            label: 'Web',
            cwd: frontendDir,
            args: ['wrangler', 'deploy', '--dry-run', '--outdir', 'dist'],
        });
    }

    process.exit(apiOk && webOk ? 0 : 1);
})();
