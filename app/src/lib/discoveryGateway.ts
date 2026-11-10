import { Timestamp } from 'firebase/firestore';

function revive(value: any): any {
  if (value && value.__timestamp === true && Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds)) {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, revive(item)]));
  return value;
}
// Share only concurrent reads. Never retain permission/profile responses after
// completion, or share a request between Firebase User instances.
const memberReads = new WeakMap<object, Map<string, Promise<any>>>();
const anonymousReads = new Map<string, Promise<any>>();
let transport: Promise<[typeof import('./firebase'), typeof import('firebase/functions')]> | undefined;
async function call(name: string, data: Record<string, unknown>): Promise<any> {
  transport ??= Promise.all([import('./firebase'), import('firebase/functions')]);
  const [{ functions, auth }, { httpsCallable }] = await transport;
  const member = auth.currentUser;
  let reads = member ? memberReads.get(member) : anonymousReads;
  if (!reads) { reads = new Map(); memberReads.set(member!, reads); }
  const key = JSON.stringify([name, Object.entries(data).sort(([a], [b]) => a.localeCompare(b))]);
  const existing = reads.get(key);
  if (existing) return existing;
  const request = (async () => {
    const invoke = httpsCallable(functions, name, { timeout: 20000 });
    let response;
    try { response = await invoke(data); }
    catch (error: any) {
      if (!['functions/unavailable', 'functions/deadline-exceeded'].includes(error?.code) || auth.currentUser !== member) throw error;
      response = await invoke(data); // One retry, only for idempotent transient reads.
    }
    if (auth.currentUser !== member) throw Object.assign(new Error('Your account changed. Please try again.'), { code: 'functions/cancelled' });
    return revive(response.data);
  })();
  reads.set(key, request);
  try { return await request; }
  finally { if (reads.get(key) === request) reads.delete(key); }
}
export const readDiscovery = (data: Record<string, unknown>) => call('readDiscovery', data);
export const getInteractionContext = (targetUid: string, listingId?: string, roomId?: string) => call('getInteractionContext', { targetUid, ...(listingId ? { listingId } : {}), ...(roomId ? { roomId } : {}) });
export function gatewayDocument(record: any): any {
  return { id: record.id || record.uid, uid: record.uid, exists: () => true, data: () => record };
}
export async function gatewayPage(action: 'places' | 'people', cursor: any, size: number, city?: string): Promise<any> {
  const page = await readDiscovery({ action, limit: size, ...(cursor ? { cursor: typeof cursor === 'string' ? cursor : cursor.id } : {}), ...(city ? { city } : {}) });
  if (!Array.isArray(page?.records) || !Number.isInteger(page.scanned) || page.scanned < 0 || typeof page.hasMore !== 'boolean'
    || (page.hasMore && (typeof page.cursor !== 'string' || !page.cursor))) {
    throw new Error('Discovery returned an incomplete response. Please try again.');
  }
  return { docs: page.records.map(gatewayDocument), empty: page.scanned === 0,
    scanned: page.scanned, cursor: page.cursor, hasMore: page.hasMore };
}
/** Public invalidation signal contains no account/listing IDs or source fields. */
export function subscribeDiscovery<T>(read: () => Promise<T>, update: (data: T) => void, fail: (error: unknown) => void): () => void {
  let disposed = false, busy = false, pending = false;
  let stop: (() => void) | undefined;
  const refresh = async () => {
    if (disposed) return;
    if (busy) { pending = true; return; }
    busy = true;
    try { const data = await read(); if (!disposed) update(data); }
    catch (error) { if (!disposed) fail(error); }
    finally { busy = false; if (!disposed && pending) { pending = false; void refresh(); } }
  };
  void refresh();
  void Promise.all([import('./firebase'), import('firebase/firestore')]).then(([{ db }, { doc, onSnapshot }]) => {
    // The initial query is already running. A listener's initial snapshot is a
    // baseline, not a second refresh. Missing legacy signal permissions must not
    // erase a successful feed; the fallback timer remains active.
    let baseline = true;
    if (!disposed) stop = onSnapshot(doc(db, 'discoverySignals', 'global'), () => {
      if (baseline) { baseline = false; return; }
      void refresh();
    }, () => {});
  }).catch(() => { /* Optional invalidation; polling still refreshes the feed. */ });
  const timer = setInterval(() => void refresh(), 60000);
  return () => { disposed = true; clearInterval(timer); stop?.(); };
}
