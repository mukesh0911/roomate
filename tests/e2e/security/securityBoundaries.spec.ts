import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_DIR = path.resolve(__dirname, '../../../tests/.auth');

test.describe('Security & Authorization Regression', () => {

  test('1. Non-admin seeker attempting to access /admin is redirected away', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    // Must NOT stay on /admin or see Platform Overview
    await expect(page).not.toHaveURL(/\/admin$/);
    await expect(page.locator('text=/Platform Overview/i')).not.toBeVisible();

    await context.close();
  });

  test('2. Suspended user session is halted with Account Restricted gate', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'suspendedUser.json'),
    });
    const page = await context.newPage();

    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    // Must be blocked by BlockedAccountScreen
    const restrictedHeading = page.locator('h1').filter({ hasText: /Account Restricted/i }).locator('visible=true').first();
    await expect(restrictedHeading).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('3. Banned user session is strictly intercepted', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'bannedUser.json'),
    });
    const page = await context.newPage();

    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    // Must display account restriction screen
    const restrictedHeading = page.locator('h1').filter({ hasText: /Account Restricted/i }).locator('visible=true').first();
    await expect(restrictedHeading).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('4. Incomplete onboarding profile is intercepted before interactive surfaces', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'onboardingPending.json'),
    });
    const page = await context.newPage();

    await page.goto('/chat', { waitUntil: 'domcontentloaded' });

    // Guard intercepts and redirects to onboarding flow or role selection
    await expect(page).toHaveURL(/\/(role-select|onboarding|login)/);

    await context.close();
  });

  test('5. Non-admin owner attempting to access /admin is redirected to owner dashboard', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'ownerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });

    // Must NOT stay on /admin
    await expect(page).not.toHaveURL(/\/admin$/);
    await expect(page.locator('text=/Platform Overview/i')).not.toBeVisible();

    await context.close();
  });

});
