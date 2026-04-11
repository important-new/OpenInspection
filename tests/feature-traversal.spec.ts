import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:8789';
const NAV_TIMEOUT = 10000;

test.describe.serial('Feature Traversal: Fresh Workspace', () => {
    
    test('1. Setup Wizard', async ({ page }) => {
        // Start from home, should redirect to /setup if DB is clean
        await page.goto(`${BASE_URL}/setup`, { timeout: NAV_TIMEOUT });
        
        // Fill the setup form
        await page.fill('#companyName', 'Automation Test Corp');
        await page.fill('#subdomain', 'autotest');
        await page.fill('#adminEmail', 'admin@autotest.com');
        await page.fill('#adminPassword', 'Password123!');
        
        // Submit
        await page.click('button[type="submit"]');
        
        // Should redirect to dashboard
        await page.waitForURL(`${BASE_URL}/dashboard`);
        await expect(page).toHaveURL(`${BASE_URL}/dashboard`);
        
        // Verify Stat Cards are present
        await expect(page.locator('#statTotal')).toBeVisible();
        await expect(page.locator('#statDrafts')).toBeVisible();
        await expect(page.locator('#statCompleted')).toBeVisible();
    });

    test('2. Dashboard & Session Persistence', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard`);
        
        // Verify Header Avatar shows the correct initials/identity hints
        const avatar = page.locator('nav img[alt="admin"]');
        await expect(avatar).toBeVisible();
        
        // Verify stats are rendered (should be 0 or 1 depending on setup defaults)
        const totalText = await page.locator('#statTotal').innerText();
        expect(Number(totalText)).toBeGreaterThanOrEqual(0);
    });

    test('3. Template Management (CRUD)', async ({ page }) => {
        await page.goto(`${BASE_URL}/templates`);
        
        // Create new template
        await page.click('button:has-text("New Template")');
        await expect(page.locator('#createModal')).toBeVisible();
        
        const templateName = `Test Template ${Date.now()}`;
        await page.fill('#tplName', templateName);
        await page.fill('#tplSchema', JSON.stringify([
            { id: 'item1', label: 'Test Item', type: 'pass_fail' }
        ]));
        
        await page.click('#submitTplBtn');
        
        // Verify it appears in the list
        await expect(page.locator(`text=${templateName}`)).toBeVisible();
        
        // Delete the template
        page.on('dialog', dialog => dialog.accept()); // Handle confirmation dialog
        await page.locator('tr', { hasText: templateName }).locator('button:has-text("Delete")').click();
        
        // Verify it's gone
        await expect(page.locator(`text=${templateName}`)).not.toBeVisible();
    });

    test('4. Settings Page', async ({ page }) => {
        await page.goto(`${BASE_URL}/settings`);
        
        // Verify profile details
        await expect(page.locator('#profileEmail')).toHaveText('admin@autotest.com');
        await expect(page.locator('#profileRole')).toHaveText('admin');
        
        // Verify Change Password form presence
        await expect(page.locator('#pwForm')).toBeVisible();
        await expect(page.locator('#currentPassword')).toBeVisible();
        await expect(page.locator('#newPassword')).toBeVisible();
    });
});
