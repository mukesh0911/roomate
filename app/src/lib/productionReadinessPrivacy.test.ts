import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getDoc: vi.fn(), setDoc: vi.fn(), doc: vi.fn(() => 'ref') }));
vi.mock('firebase/firestore', () => ({
  ...mocks,
  serverTimestamp: () => 'server-time',
}));
vi.mock('./firebase', () => ({ db: {} }));

import { hydrateOwnProfile, savePrivateUserData, stripPiiFromWrite } from './privateUserData';

beforeEach(() => vi.clearAllMocks());

describe('profile reads never migrate production data', () => {
  it('hydrates private fields without copying or deleting legacy public data', async () => {
    mocks.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ email: 'private@example.test' }) });
    const result = await hydrateOwnProfile({ uid: 'owner', email: 'legacy@example.test', phone: '123' });
    expect(result).toEqual({ uid: 'owner', email: 'private@example.test', phone: '123', workEmail: '', whatsappNumber: '' });
    expect(mocks.getDoc).toHaveBeenCalledTimes(1);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('preserves owner profile on private read failure without performing writes', async () => {
    mocks.getDoc.mockRejectedValue(new Error('offline'));
    const profile = { uid: 'owner', email: 'legacy@example.test' };
    expect(await hydrateOwnProfile(profile)).toBe(profile);
    expect(mocks.setDoc).not.toHaveBeenCalled();
  });

  it('allows explicit saves only for private contact keys', async () => {
    await savePrivateUserData('owner', { phone: '', email: 'a@example.test' });
    expect(mocks.setDoc).toHaveBeenCalledWith('ref', { phone: '', email: 'a@example.test', updatedAt: 'server-time' }, { merge: true });
    expect(stripPiiFromWrite({ name: 'A', email: 'a', phone: 'b', workEmail: 'c', whatsappNumber: 'd' })).toEqual({ name: 'A' });
  });
});
