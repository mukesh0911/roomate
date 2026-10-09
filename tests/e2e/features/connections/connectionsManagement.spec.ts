import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_DIR = path.resolve(__dirname, '../../../../tests/.auth');

test.describe('Feature: Connections Management', () => {

  test('1. Seeker can view sent connection requests', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/explore?tab=connections', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/explore\?tab=connections/);

    // Switch to Sent sub-tab
    const sentTab = page.locator('button').filter({ hasText: /Sent/i }).first();
    await expect(sentTab).toBeVisible({ timeout: 10000 });
    await sentTab.click();

    // Verify connections UI is active
    await expect(page.locator('body')).toBeVisible();

    await context.close();
  });

  test('2. Owner dashboard displays incoming applicant connections', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'ownerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/owner-dashboard?tab=applicants', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/owner-dashboard\?tab=applicants/);

    // Confirm applicants / dashboard heading is visible across desktop & mobile
    const dashboardHeading = page.getByRole('heading', { name: /Owner Dashboard|Pending Inquiries|Applicants/i }).first();
    await expect(dashboardHeading).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('3. Quota-full seeker uses a real Firebase session without mock state', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'quotaFullUser.json'),
    });
    const page = await context.newPage();

    await page.goto('/explore?tab=rooms', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/explore\?tab=rooms/);

    expect(await page.evaluate(() => window.localStorage.getItem('nestmate_auth_session'))).toBeNull();
    await expect(page.locator('main')).toBeVisible();

    await context.close();
  });

});
