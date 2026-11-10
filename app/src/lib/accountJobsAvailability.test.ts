import { afterEach, expect, it, vi } from 'vitest';

vi.mock('./firebase', () => { throw new Error('A disabled service must not initialize network access.'); });
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it('rejects unavailable export/broadcast actions before making a backend request', async () => {
  vi.stubEnv('VITE_ACCOUNT_EXPORT_ENABLED', 'false');
  vi.stubEnv('VITE_BROADCASTS_ENABLED', 'false');
  const jobs = await import('./accountJobs');
  await expect(jobs.prepareAccountExportBackend()).rejects.toThrow('temporarily unavailable');
  await expect(jobs.queueBroadcastBackend({ action: 'create' })).rejects.toThrow('temporarily unavailable');
});
