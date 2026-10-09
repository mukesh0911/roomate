import { test, expect } from '@playwright/test';
import { TEST_PERSONAS } from '../../../helpers/testDataRegistry';

test.describe('Settings: permanent account deletion', () => {
  test('freshly authenticated user deletes all account data through the UI', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'The disposable account is deleted once across the shared emulator suite.');
    const disposable = TEST_PERSONAS.DISPOSABLE_USER;

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const emailInput = page.getByLabel('Email address').first();
    if (!(await emailInput.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /Sign in with Email/i }).first().click();
    }
    await emailInput.fill(disposable.email);
    await page.getByLabel('Password').first().fill(disposable.password);
    await page.getByRole('button', { name: /Continue with Email/i }).first().click();
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Delete Account Permanently/i }).click();
    await expect(page.getByRole('heading', { name: 'Delete Account?' })).toBeVisible();
    await expect(page.getByText(/shared chats and messages/i)).toBeVisible();
    await page.getByPlaceholder('DELETE').fill('DELETE');
    await page.getByRole('button', { name: 'Confirm Delete' }).click();

    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByText('Your account has been deleted.')).toBeVisible();

    await page.goto('/settings', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });
});
