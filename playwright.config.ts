import { defineConfig } from '@playwright/test';

export default defineConfig({
    globalSetup: './tests/global-setup.ts',
    testDir: './tests',
    testIgnore: '**/*.integration.spec.ts',
    timeout: 30000,
    use: { 
        headless: true,
        baseURL: 'http://127.0.0.1:8789',
    },
    webServer: {
        command: 'npx wrangler dev --port 8789',
        url: 'http://127.0.0.1:8789/status',
        reuseExistingServer: false,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 60000,
    },
});
