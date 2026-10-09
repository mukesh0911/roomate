import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';

const AUTH_DIR = path.resolve(__dirname, '../.auth');
const state = (name: string) => path.join(AUTH_DIR, name);

async function persistedFirebaseUid(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const open = indexedDB.open('firebaseLocalStorageDb');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    if (!db.objectStoreNames.contains('firebaseLocalStorage')) return null;
    const tx = db.transaction('firebaseLocalStorage', 'readonly');
    const request = tx.objectStore('firebaseLocalStorage').getAll();
    const rows = await new Promise<any[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    for (const row of rows) {
      const value = typeof row?.value === 'string' ? JSON.parse(row.value) : row?.value;
      if (value?.uid) return value.uid;
    }
    return null;
  });
}

test.describe('Real Firebase Auth emulator foundation', () => {
  test('seeker session is real, persisted, and contains no mock-auth keys', async ({ browser }) => {
    const context = await browser.newContext({ storageState: state('seekerA.json') });
    const page = await context.newPage();
    await page.goto('/explore?tab=rooms');
    await expect(page).toHaveURL(/\/explore/);
    await expect.poll(() => persistedFirebaseUid(page)).toBe('qa_seeker_a');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('nestmate_auth_session'))).toBeNull();
    await context.close();
  });

  test('owner and admin sessions reach only their authorized surfaces', async ({ browser }) => {
    const ownerContext = await browser.newContext({ storageState: state('ownerA.json') });
    const adminContext = await browser.newContext({ storageState: state('admin.json') });
    const owner = await ownerContext.newPage();
    const admin = await adminContext.newPage();
    await Promise.all([owner.goto('/owner-dashboard'), admin.goto('/admin')]);
    await expect(owner).toHaveURL(/\/owner-dashboard/);
    await expect(admin).toHaveURL(/\/admin/);
    await expect.poll(() => persistedFirebaseUid(owner)).toBe('qa_owner_a');
    await expect.poll(() => persistedFirebaseUid(admin)).toBe('qa_admin');
    await ownerContext.close();
    await adminContext.close();
  });

  test('session survives hard reload and stays isolated across contexts', async ({ browser }) => {
    const seekerContext = await browser.newContext({ storageState: state('seekerB.json') });
    const ownerContext = await browser.newContext({ storageState: state('ownerA.json') });
    const seeker = await seekerContext.newPage();
    const owner = await ownerContext.newPage();
    await Promise.all([seeker.goto('/explore'), owner.goto('/owner-dashboard')]);
    await Promise.all([seeker.reload(), owner.reload()]);
    await expect.poll(() => persistedFirebaseUid(seeker)).toBe('qa_seeker_b');
    await expect.poll(() => persistedFirebaseUid(owner)).toBe('qa_owner_a');
    await seekerContext.close();
    await ownerContext.close();
  });

  test('logout clears Firebase persistence and returns to an unauthenticated route', async ({ browser }) => {
    const context = await browser.newContext({ storageState: state('seekerA.json') });
    const page = await context.newPage();
    await page.goto('/settings');
    await page.getByRole('button', { name: /Log Out of NestMate/i }).click();
    await expect.poll(() => persistedFirebaseUid(page)).toBeNull();
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('incomplete, suspended, and banned accounts are intercepted', async ({ browser }) => {
    for (const [file, expected] of [
      ['onboardingPending.json', /\/role-select/],
      ['suspendedUser.json', /\/profile/],
      ['bannedUser.json', /\/profile/],
    ] as const) {
      const context = await browser.newContext({ storageState: state(file) });
      const page = await context.newPage();
      await page.goto('/profile');
      if (file === 'onboardingPending.json') await expect(page).toHaveURL(expected);
      else await expect(page.getByText('Account Restricted')).toBeVisible();
      await context.close();
    }
  });

  test('non-admin cannot enter the admin portal', async ({ browser }) => {
    const context = await browser.newContext({ storageState: state('seekerA.json') });
    const page = await context.newPage();
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin(?:\/)?$/);
    await context.close();
  });
});
