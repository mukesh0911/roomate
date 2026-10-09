import { test, expect } from '@playwright/test';
import path from 'path';
import { TEST_LISTINGS } from '../../../helpers/testDataRegistry';

const AUTH_DIR = path.resolve(__dirname, '../../../../tests/.auth');

test.describe('Feature: Room Detail & Listing Inspection', () => {

  test('1. Seeker can inspect verified active room listing details', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto(`/room/${TEST_LISTINGS.ACTIVE_KORAMANGALA}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/room/${TEST_LISTINGS.ACTIVE_KORAMANGALA}`));

    // Verify room title is rendered
    const titleLocator = page.getByRole('heading', { name: /Sunny room in Koramangala/i }).first();
    await expect(titleLocator).toBeVisible({ timeout: 10000 });

    // Verify pricing and locality details are displayed
    await expect(page.locator('text=/₹|Rent|Deposit|Koramangala/i').first()).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('2. Room detail shows verified owner status and key amenities', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto(`/room/${TEST_LISTINGS.ACTIVE_KORAMANGALA}`, { waitUntil: 'domcontentloaded' });

    // Verify amenities or property features section is present
    const amenitiesSection = page.locator('text=/Amenities|Features|WiFi|Furnished|Balcony|AC/i').first();
    await expect(amenitiesSection).toBeVisible({ timeout: 10000 });

    // Verify verified badge or owner information
    const ownerInfo = page.locator('text=/Verified|Ramesh|Host|Owner/i').first();
    await expect(ownerInfo).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('3. Non-existent room ID shows appropriate not found or fallback state', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerA.json'),
    });
    const page = await context.newPage();

    await page.goto('/room/non_existent_fake_room_99999', { waitUntil: 'domcontentloaded' });

    // Verify error state, not found message, or redirect back
    const notFoundIndicator = page.locator('text=/not found|unavailable|Listing Not Found|No listing/i').or(page.locator('button:has-text("Browse")')).first();
    await expect(notFoundIndicator).toBeVisible({ timeout: 10000 });

    await context.close();
  });

});
