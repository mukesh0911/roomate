import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/production-readiness',
  timeout: 180000,
  expect: { timeout: 45000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.NESTMATE_READINESS_RESULT_FILE || 'docs/production-readiness/evidence/browser-results.json' }]],
  outputDir: process.env.NESTMATE_READINESS_ARTIFACT_DIR || 'docs/production-readiness/evidence/browser-artifacts',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'readiness-chromium', use: { ...devices['Desktop Chrome'] } }],
});
