import { test, expect } from '@playwright/test';
import path from 'path';
import { TEST_LISTINGS } from '../../helpers/testDataRegistry';

const AUTH_DIR = path.resolve(__dirname, '../../../tests/.auth');

test.describe('Workflow: listing interest → owner acceptance → two-way chat', () => {
  test('two isolated users complete the real workflow and receive live updates', async ({ browser }, testInfo) => {
    const seekerState = testInfo.project.name === 'mobile-chrome' ? 'unrelatedUser.json' : 'seekerWeak.json';
    const seekerName = testInfo.project.name === 'mobile-chrome' ? 'Unaffiliated User' : 'Karan Mehra';
    const seekerContext = await browser.newContext({
      storageState: path.join(AUTH_DIR, seekerState),
    });
    const ownerContext = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'ownerB.json'),
    });
    const seeker = await seekerContext.newPage();
    const owner = await ownerContext.newPage();

    try {
      await Promise.all([
        seeker.goto(`/room/${TEST_LISTINGS.ACTIVE_INDIRANAGAR}`, { waitUntil: 'domcontentloaded' }),
        owner.goto('/owner-dashboard?tab=applicants', { waitUntil: 'domcontentloaded' }),
      ]);

      await seeker.getByRole('button', { name: /Express Interest/i }).first().click();
      const questionnaire = seeker.getByRole('dialog');
      await expect(questionnaire.getByText('What is your preferred move-in window?')).toBeVisible();
      await questionnaire.getByRole('button', { name: 'Within 2 weeks' }).click();
      await questionnaire.getByRole('button', { name: /Submit & Express Interest/i }).click();
      await expect(seeker.getByText(/Interest Sent to Owner|Interest Sent/i).first()).toBeVisible({ timeout: 15_000 });

      const requestCard = owner.locator('[id^="request-"]').filter({ hasText: seekerName, visible: true });
      await expect(requestCard).toBeVisible({ timeout: 15_000 });
      await expect(requestCard.getByText(/Siddharth Rao QA room/i)).toBeVisible();
      await expect(requestCard.getByRole('button', { name: /Answers/i })).toBeVisible();
      await requestCard.getByRole('button', { name: /^Accept$/i }).click();

      await expect(owner).toHaveURL(/\/chat\//, { timeout: 15_000 });
      const chatUrl = owner.url();

      await seeker.goto('/notifications', { waitUntil: 'domcontentloaded' });
      await expect(seeker.getByText('Connection Accepted!', { exact: true })).toBeVisible({ timeout: 15_000 });
      await seeker.goto(chatUrl, { waitUntil: 'domcontentloaded' });

      const seekerMessage = `QA seeker message ${Date.now()}`;
      await seeker.getByPlaceholder('Type a message...').fill(seekerMessage);
      await seeker.getByRole('button', { name: /send/i }).last().click();
      await expect(owner.getByText(seekerMessage, { exact: true })).toBeVisible({ timeout: 15_000 });

      const ownerMessage = `QA owner reply ${Date.now()}`;
      await owner.getByPlaceholder('Type a message...').fill(ownerMessage);
      await owner.getByRole('button', { name: /send/i }).last().click();
      await expect(seeker.getByText(ownerMessage, { exact: true })).toBeVisible({ timeout: 15_000 });
    } finally {
      await seekerContext.close();
      await ownerContext.close();
    }
  });
});
