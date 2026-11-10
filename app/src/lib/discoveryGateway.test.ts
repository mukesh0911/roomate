import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string } | null },
  invoke: vi.fn(), listen: vi.fn(),
}));
vi.mock('./firebase', () => ({ functions: {}, db: {}, auth: fake.auth }));
vi.mock('firebase/functions', () => ({ httpsCallable: () => fake.invoke }));
vi.mock('firebase/firestore', async original => ({
  ...await original<typeof import('firebase/firestore')>(),
  doc: () => 'discoverySignals/global', onSnapshot: fake.listen,
}));
import { readDiscovery, getInteractionContext, gatewayPage, subscribeDiscovery } from './discoveryGateway';

beforeEach(() => { vi.clearAllMocks(); fake.auth.currentUser = null; });
afterEach(() => vi.useRealTimers());

describe('discovery request isolation and recovery', () => {
  it('shares concurrent identical reads but fetches fresh data afterwards', async () => {
    let finish!: (value: unknown) => void;
    fake.invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = readDiscovery({ action: 'places', limit: 12 });
    const second = readDiscovery({ limit: 12, action: 'places' });
    await vi.waitFor(() => expect(fake.invoke).toHaveBeenCalledTimes(1));
    finish({ data: { records: [] } });
    expect(await first).toEqual(await second);
    fake.invoke.mockResolvedValueOnce({ data: { records: ['fresh'] } });
    expect(await readDiscovery({ action: 'places', limit: 12 })).toEqual({ records: ['fresh'] });
    expect(fake.invoke).toHaveBeenCalledTimes(2);
  });

  it('never shares a private request or response across account changes', async () => {
    let finish!: (value: unknown) => void;
    fake.auth.currentUser = { uid: 'first' };
    fake.invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = getInteractionContext('peer');
    const rejected = expect(first).rejects.toMatchObject({ code: 'functions/cancelled' });
    await vi.waitFor(() => expect(fake.invoke).toHaveBeenCalledTimes(1));
    fake.auth.currentUser = { uid: 'second' };
    fake.invoke.mockResolvedValueOnce({ data: { identity: { name: 'Second member context' } } });
    expect(await getInteractionContext('peer')).toEqual({ identity: { name: 'Second member context' } });
    finish({ data: { identity: { name: 'First member private context' } } });
    await rejected;
    expect(fake.invoke).toHaveBeenCalledTimes(2);
  });

  it('retries a transient read once and does not retry permission denials', async () => {
    fake.invoke.mockRejectedValueOnce({ code: 'functions/unavailable' }).mockResolvedValueOnce({ data: 'recovered' });
    expect(await readDiscovery({ action: 'places' })).toBe('recovered');
    expect(fake.invoke).toHaveBeenCalledTimes(2);
    fake.invoke.mockRejectedValueOnce({ code: 'functions/permission-denied' });
    await expect(readDiscovery({ action: 'people' })).rejects.toMatchObject({ code: 'functions/permission-denied' });
    expect(fake.invoke).toHaveBeenCalledTimes(3);
  });

  it('rejects malformed pagination instead of looping or declaring a false empty feed', async () => {
    fake.invoke.mockResolvedValueOnce({ data: { records: [], scanned: 12, hasMore: true, cursor: null } });
    await expect(gatewayPage('places', null, 12)).rejects.toThrow('incomplete response');
  });

  it('treats the signal listener as optional and preserves normal polling', async () => {
    vi.useFakeTimers();
    let changed!: () => void, denied!: (error: unknown) => void;
    const unlisten = vi.fn();
    fake.listen.mockImplementation((_ref, update, error) => { changed = update; denied = error; return unlisten; });
    const read = vi.fn().mockResolvedValue(['listing']);
    const update = vi.fn(), fail = vi.fn();
    const stop = subscribeDiscovery(read, update, fail);
    await vi.waitFor(() => expect(fake.listen).toHaveBeenCalledTimes(1));
    changed(); // Initial snapshot is not a second fetch.
    denied({ code: 'permission-denied' });
    expect(read).toHaveBeenCalledTimes(1);
    expect(fail).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000);
    expect(read).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(['listing']);
    stop(); expect(unlisten).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not publish a read that finishes after the view is disposed', async () => {
    let finish!: (value: unknown) => void;
    fake.listen.mockReturnValue(vi.fn());
    const read = () => new Promise(resolve => { finish = resolve; });
    const update = vi.fn(), fail = vi.fn();
    const stop = subscribeDiscovery(read, update, fail);
    stop(); finish(['late']);
    await Promise.resolve(); await Promise.resolve();
    expect(update).not.toHaveBeenCalled(); expect(fail).not.toHaveBeenCalled();
  });
});
