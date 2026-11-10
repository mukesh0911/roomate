import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: { currentUser: null as null | { uid: string } },
  listener: null as null | ((user: { uid: string } | null) => Promise<void>),
  getDoc: vi.fn(),
  createUser: vi.fn(),
  setDoc: vi.fn(),
}));
vi.mock('react', () => ({
  useState: vi.fn(), useEffect: vi.fn(),
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('firebase/auth', () => ({
  signOut: vi.fn(), GoogleAuthProvider: vi.fn(), signInWithPopup: vi.fn(),
  getAdditionalUserInfo: vi.fn(), signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: state.createUser, sendPasswordResetEmail: vi.fn(),
  onAuthStateChanged: (_auth: unknown, callback: typeof state.listener) => { state.listener = callback; },
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(), setDoc: state.setDoc, updateDoc: vi.fn(), serverTimestamp: vi.fn(),
  getDoc: state.getDoc,
}));
vi.mock('./firebase', () => ({ auth: state.auth, db: {} }));
vi.mock('./privateUserData', () => ({ hydrateOwnProfile: async (data: unknown) => data, savePrivateUserData: vi.fn() }));
vi.mock('../store/useStore', () => ({ useStore: { getState: () => ({ resetAll: vi.fn() }) } }));

import { useAuth } from '../hooks/useAuth';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const profileSnapshot = (name: string) => ({ exists: () => true, data: () => ({ name, avatar: '' }) });

describe('shared auth profile isolation', () => {
  it('cannot restore a profile after sign-out while its read is pending', async () => {
    useAuth();
    const pending = deferred<ReturnType<typeof profileSnapshot>>();
    state.getDoc.mockReturnValueOnce(pending.promise);
    state.auth.currentUser = { uid: 'a' };
    const oldLoad = state.listener!(state.auth.currentUser);
    expect(useAuth().profile).toBeNull();
    expect(useAuth().isLoading).toBe(true);
    state.auth.currentUser = null;
    await state.listener!(null);
    pending.resolve(profileSnapshot('User A'));
    await oldLoad;
    expect(useAuth().user).toBeNull();
    expect(useAuth().profile).toBeNull();
  });

  it('ignores a failed read from an old account after a new account loads', async () => {
    const pending = deferred<ReturnType<typeof profileSnapshot>>();
    state.getDoc.mockReturnValueOnce(pending.promise);
    state.auth.currentUser = { uid: 'a' };
    const oldLoad = state.listener!(state.auth.currentUser);
    state.getDoc.mockResolvedValueOnce(profileSnapshot('User B'));
    state.auth.currentUser = { uid: 'b' };
    await state.listener!(state.auth.currentUser);
    pending.reject(new Error('old permission failure'));
    await oldLoad;
    expect(useAuth().profile).toMatchObject({ uid: 'b', name: 'User B' });
    expect(useAuth().error).toBeNull();
    expect(useAuth().isLoading).toBe(false);
  });

  it('does not hydrate another user as the signed-in profile during refresh', async () => {
    state.getDoc.mockClear();
    expect(await useAuth().refreshProfile('a')).toBeNull();
    expect(state.getDoc).not.toHaveBeenCalled();
  });
  it('an earlier missing-profile read cannot erase a completed signup profile', async () => {
    const pending = deferred<{ exists: () => boolean }>();
    state.getDoc.mockReturnValueOnce(pending.promise);
    state.auth.currentUser = { uid: 'new' };
    const load = state.listener!(state.auth.currentUser);
    state.createUser.mockResolvedValue({ user: { uid: 'new', email: 'new@example.test' } });
    await useAuth().signUpWithEmail('new@example.test', 'EmulatorOnly!2026');
    expect(useAuth().profile?.uid).toBe('new');
    pending.resolve({ exists: () => false });
    await load;
    expect(useAuth().profile).toMatchObject({ uid: 'new', email: 'new@example.test' });
    expect(useAuth().isLoading).toBe(false);
  });
  it('loading or refreshing a Google photo never writes or clears legacy contact data', async () => {
    state.setDoc.mockClear();
    const googleUser = { uid: 'legacy', photoURL: 'https://lh3.googleusercontent.com/photo=s96-c' };
    state.auth.currentUser = googleUser;
    state.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ name: 'Legacy', avatar: '', phone: 'legacy-contact', email: 'legacy@example.test' }) });
    await state.listener!(googleUser);
    expect(useAuth().profile).toMatchObject({ uid: 'legacy', phone: 'legacy-contact', email: 'legacy@example.test' });
    await useAuth().refreshProfile();
    expect(state.setDoc).not.toHaveBeenCalled();
  });
});
