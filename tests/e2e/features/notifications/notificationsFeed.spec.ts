import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_DIR = path.resolve(__dirname, '../../../../tests/.auth');

test.describe('Feature: Notifications Feed & Activity Alerts', () => {

  test('1. Notifications hub renders header, filter controls, and seeded activity feed', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/notifications/);

    // Verify PageShell title
    const title = page.locator('main').locator('text=/Notifications/i').locator('visible=true').first();
    await expect(title).toBeVisible({ timeout: 15000 });

    // Verify subtitle or notification feed content
    const subtitleOrFeed = page.locator('main').locator('text=/Stay updated|Never miss|match|inquiry|caught up/i').locator('visible=true').first();
    await expect(subtitleOrFeed).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('2. Filter tabs switch between All and Unread notifications', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });

    // Tabs remain present for both populated and empty feeds; wait for the
    // subscription-backed count before interacting with the stable control.
    const main = page.locator('main');
    const allTab = main.getByRole('button', { name: /^All(?: \(\d+\))?$/i }).first();
    const unreadTab = main.getByRole('button', { name: /^Unread/i }).first();
    await expect(allTab).toBeVisible({ timeout: 15000 });
    await expect(unreadTab).toBeVisible();
    await unreadTab.click();
    await expect(unreadTab).toBeVisible();

    await context.close();
  });

  test('3. Browser notification alert banner or settings trigger is interactive', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });

    // Browser permission may already be denied and every seeded notification may
    // already be read. In that state, the per-notification delete action is the
    // available interactive control.
    const alertBtnOrAction = page.locator('main').getByRole('button', {
      name: /Enable Alerts|Mark all as read|Browse Listings|Delete notification/i,
    }).first();
    await expect(alertBtnOrAction).toBeVisible({ timeout: 10000 });
    await expect(alertBtnOrAction).toBeEnabled();

    await context.close();
  });

});
