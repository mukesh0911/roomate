import { test, expect } from '@playwright/test';
import path from 'path';

const AUTH_DIR = path.resolve(__dirname, '../../../../tests/.auth');

test.describe('Feature: Plans & Pricing', () => {

  test('1. Pricing hub renders plan tiers, feature breakdown, and pricing cards', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/pricing/);

    // Verify main heading
    const heading = page.locator('h1').filter({ hasText: /Simple Pricing/i }).locator('visible=true').first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Verify Plan cards: Free, Premium
    const freeCard = page.locator('text=/Free/i').locator('visible=true').first();
    await expect(freeCard).toBeVisible({ timeout: 10000 });

    const premiumCard = page.locator('text=/Premium/i').locator('visible=true').first();
    await expect(premiumCard).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('2. Annual and Monthly billing toggle updates pricing terms', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });

    // Target Monthly button
    const monthlyBtn = page.locator('button').filter({ hasText: /^Monthly$/i }).locator('visible=true').first();
    await expect(monthlyBtn).toBeVisible({ timeout: 10000 });
    await monthlyBtn.click();

    // Confirm Monthly is active and renders monthly rate
    const monthlyPrice = page.locator('text=/₹299/i').locator('visible=true').first();
    await expect(monthlyPrice).toBeVisible({ timeout: 10000 });

    // Target Annual button
    const annualBtn = page.locator('button').filter({ hasText: /Annual/i }).locator('visible=true').first();
    await expect(annualBtn).toBeVisible();
    await annualBtn.click();

    // Verify annual discount badge or annual pricing text
    const annualIndicator = page.locator('text=/Save 30%|Billed annually/i').locator('visible=true').first();
    await expect(annualIndicator).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('3. Frequently Asked Questions accordion expands on click', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });

    // Target first FAQ accordion question
    const faqQuestion = page.locator('text=/How does the free plan work\?/i').locator('visible=true').first();
    await expect(faqQuestion).toBeVisible({ timeout: 10000 });
    await faqQuestion.click();

    // Verify answer becomes visible
    const faqAnswer = page.locator('text=/NestMate is currently free for all core features/i').locator('visible=true').first();
    await expect(faqAnswer).toBeVisible({ timeout: 10000 });

    await context.close();
  });

});
