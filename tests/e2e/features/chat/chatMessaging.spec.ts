import { test, expect } from '@playwright/test';
import path from 'path';
import { TEST_CHAT_ROOMS } from '../../../helpers/testDataRegistry';

const AUTH_DIR = path.resolve(__dirname, '../../../../tests/.auth');

test.describe('Feature: Chat & Messaging', () => {

  test('1. Chat hub displays conversation list for active participant', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerB.json'),
    });
    const page = await context.newPage();

    await page.goto('/chat', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/chat/);

    // Verify conversation list header
    await expect(page.getByRole('heading', { name: /Messages/i })).toBeVisible({ timeout: 10000 });

    // Verify partner name or conversation appears in conversation list
    const conversationPartner = page.locator('button, div').filter({ hasText: /Pooja|Iyer|Ramesh|Gupta|Sounds great/i }).first();
    await expect(conversationPartner).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('2. Opening active chat room displays message thread', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerB.json'),
    });
    const page = await context.newPage();

    await page.goto(`/chat/${TEST_CHAT_ROOMS.DEFAULT_ROOM}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/chat/${TEST_CHAT_ROOMS.DEFAULT_ROOM}`));

    // Verify message input is available
    const messageInput = page.locator('input[placeholder*="Type a message" i], input[aria-label="Message"]').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });

    // Verify seeded messages are visible in thread
    // The conversation preview and thread contain the same text. The thread
    // copy is last in DOM order and remains visible on both split and mobile UI.
    const messageText = page.locator('main').getByText('See you at 5 PM.', { exact: true }).last();
    await expect(messageText).toBeVisible({ timeout: 10000 });

    await context.close();
  });

  test('3. Participant can send a new message in thread', async ({ browser }) => {
    const context = await browser.newContext({
      storageState: path.join(AUTH_DIR, 'seekerB.json'),
    });
    const page = await context.newPage();

    await page.goto(`/chat/${TEST_CHAT_ROOMS.DEFAULT_ROOM}`, { waitUntil: 'domcontentloaded' });

    const messageInput = page.locator('input[placeholder*="Type a message" i], input[aria-label="Message"]').first();
    await expect(messageInput).toBeVisible({ timeout: 10000 });

    const testMsg = 'Sounds great, confirmed! chatMessaging-send-01';
    await messageInput.fill(testMsg);

    // Click send button
    const sendBtn = page.locator('button[aria-label="Send message"], button:has(svg.lucide-send)').first();
    await expect(sendBtn).toBeEnabled({ timeout: 10000 });
    await sendBtn.click();

    // Verify new message bubble rendered in thread
    await expect(page.locator(`text=${testMsg}`).last()).toBeVisible({ timeout: 10000 });

    await context.close();
  });

});
