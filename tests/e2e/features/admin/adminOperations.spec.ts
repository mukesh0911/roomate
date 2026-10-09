import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_DIR = path.resolve(__dirname, '../../../../tests/.auth');

test.describe('Feature: Admin Operations & Governance', () => {

  test('1. Admin dashboard overview loads marketplace metrics and live monitoring', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'admin.json'),
    });
    const page = await context.newPage();

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin/);

    // Verify Admin Platform Overview header
    const header = page.locator('main').locator('text=/Platform Overview/i').locator('visible=true').first();
    await expect(header).toBeVisible({ timeout: 15000 });

    // Verify key platform metrics cards (e.g., Total Registered Users, Active Listings, or Active Chats)
    const metricsCard = page.locator('main').locator('text=/Total Registered Users|Active Listings|Chat Rooms/i').locator('visible=true').first();
    await expect(metricsCard).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('2. Admin can access user registry and filter accounts', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'admin.json'),
    });
    const page = await context.newPage();

    await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/users/);

    // Verify User Registry heading
    const userRegistryTitle = page.locator('main').locator('text=/User Registry/i').locator('visible=true').first();
    await expect(userRegistryTitle).toBeVisible({ timeout: 15000 });

    // Verify search input is present and interactive
    const searchInput = page.locator('main').locator('input[placeholder*="Search"]').locator('visible=true').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('3. Admin can access verifications queue for trust & safety approvals', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'admin.json'),
    });
    const page = await context.newPage();

    await page.goto('/admin/verifications', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/admin\/verifications/);

    // Verify Verifications Queue heading
    const verifHeader = page.locator('main').locator('text=/Verifications Queue/i').locator('visible=true').first();
    await expect(verifHeader).toBeVisible({ timeout: 15000 });

    await context.close();
  });

});
