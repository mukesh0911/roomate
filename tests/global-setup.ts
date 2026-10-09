import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// CommonJS is intentional: the same runtime registry is consumed by the
// Firebase Admin seed runner and this browser setup without duplicating IDs.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PERSONAS } = require('./data/emulator-universe.cjs') as {
  PERSONAS: Array<{ key: string; email: string; password: string; storageStatePath: string }>;
};

export default async function globalSetup(config: FullConfig) {
  const baseURL = String(config.projects[0]?.use?.baseURL || 'http://127.0.0.1:4173');
  mkdirSync(path.resolve('tests/.auth'), { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const persona of PERSONAS) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });

      const emailInput = page.getByLabel('Email address').first();
      if (!(await emailInput.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: /Sign in with Email/i }).first().click();
      }
      await emailInput.fill(persona.email);
      await page.getByLabel('Password').first().fill(persona.password);
      await page.getByRole('button', { name: /Continue with Email/i }).first().click();
      await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });

      // Firebase Auth persists the real emulator session in IndexedDB. The
      // indexedDB option is essential; localStorage-only states are invalid.
      await context.storageState({
        path: path.resolve(persona.storageStatePath),
        indexedDB: true,
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}
