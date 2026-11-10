import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  getDocs: vi.fn(), getDoc: vi.fn(), addDoc: vi.fn(), updateDoc: vi.fn(),
  deleteDoc: vi.fn(), transaction: vi.fn(), batch: vi.fn(),
  upload: vi.fn(), getDownloadURL: vi.fn(), getBlob: vi.fn(),
  onSnapshot: vi.fn(), context: vi.fn(), gatewayPage: vi.fn(),
  auth: { currentUser: { uid: 'me', displayName: 'Me' } },
}));
vi.mock('./discoveryGateway', async original => ({
  ...await original<typeof import('./discoveryGateway')>(),
  gatewayPage: fake.gatewayPage, getInteractionContext: fake.context,
}));
vi.mock('./firebase', () => ({ db: {}, storage: {}, auth: fake.auth }));
vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => ({ fullPath: path }),
  uploadBytesResumable: fake.upload, getDownloadURL: fake.getDownloadURL, getBlob: fake.getBlob,
}));
vi.mock('firebase/firestore', async (original) => ({
  ...await original<typeof import('firebase/firestore')>(),
  collection: (...args: unknown[]) => args.slice(1).join('/'),
  doc: (...args: unknown[]) => args.length === 1 ? { id: 'new', path: `${args[0]}/new` } : args.slice(1).join('/'),
  query: (source: unknown, ...constraints: unknown[]) => ({ source, constraints }),
  where: (...args: unknown[]) => ({ where: args }), orderBy: vi.fn(),
  startAfter: (cursor: unknown) => ({ cursor }), limit: (count: number) => ({ limit: count }),
  getDocs: fake.getDocs, getDoc: fake.getDoc, addDoc: fake.addDoc,
  updateDoc: fake.updateDoc, deleteDoc: fake.deleteDoc,
  runTransaction: (_db: unknown, callback: unknown) => fake.transaction(callback),
  writeBatch: fake.batch, serverTimestamp: () => 'server-time',
  onSnapshot: fake.onSnapshot,
}));
import {
  fetchBoundedExploreListings, fetchBoundedExploreRoommates, markConversationReadBackend, mapFirestoreListing,
  mapFirestorePG, mapFirestoreUser, sendConnectionRequestBackend, sendMessageBackend,
  verifyUserGovernmentIdBackend, updateListingBackend,
  adminApproveVerificationBackend, adminRejectVerificationBackend, createNewListingBackend,
  submitManualKycBackend, getVerificationDocumentBlobBackend,
  getOrCreateChatRoomBackend, subscribeLiveUserChats,
} from './nestmateBackend';

const person = (id: string, intent = 'team_up') => ({
  id, data: () => ({ name: id, housingIntent: intent, status: 'active', role: 'seeker' }),
});
const page = (docs: unknown[]) => ({ docs, empty: docs.length === 0 });

beforeEach(() => {
  vi.clearAllMocks();
  fake.context.mockResolvedValue({active:true,blocked:false,accepted:true,identity:{uid:'peer',name:'Peer'}});
  fake.gatewayPage.mockImplementation(async (_action, _cursor, size) => { const result = await fake.getDocs({constraints:[{limit:size}]}); return {...result,scanned:result.docs.length,cursor:result.docs.at(-1)?.id,hasMore:result.docs.length >= size}; });
});

describe('production readiness backend behavior', () => {
  it('keeps a newly arrived unseen message unread when an older thread was rendered', async () => {
    const update = vi.fn();
    const tx = {get:async()=>({exists:()=>true,data:()=>({participants:['me','peer'],lastMessageId:'newer',unreadBy:{me:2}})}),update};
    fake.transaction.mockImplementationOnce(callback => callback(tx));
    expect(await markConversationReadBackend('room','older')).toBe(false);
    expect(update).not.toHaveBeenCalled();
    fake.transaction.mockImplementationOnce(callback => callback(tx));
    expect(await markConversationReadBackend('room','newer')).toBe(true);
    expect(update).toHaveBeenCalledWith('chatRooms/room',{unreadBy:{me:0}});
  });

  it('reports a live chat subscription failure without replacing known conversations with an empty list', () => {
    let fail!: (error: unknown) => void;
    fake.onSnapshot.mockImplementation((_query, _callback, onError) => { fail = onError; return vi.fn(); });
    const update = vi.fn(), error = vi.fn();
    const stop = subscribeLiveUserChats('me', update, error);
    const denied = new Error('permission-denied'); fail(denied);
    expect(error).toHaveBeenCalledWith(denied); expect(update).not.toHaveBeenCalled(); stop();
  });

  it('flags unavailable message history instead of treating it as an empty successful conversation', async () => {
    let emit!: (snapshot: ReturnType<typeof page>) => Promise<void>;
    fake.onSnapshot.mockImplementation((_query, callback) => { emit = callback; return vi.fn(); });
    fake.getDocs.mockRejectedValueOnce(new Error('offline'));
    const update = vi.fn(), stop = subscribeLiveUserChats('me', update);
    await emit(page([{id:'room',data:()=>({participants:['me','peer'],unreadBy:{me:3}})}]));
    const room=update.mock.calls[0][0][0];
    expect(room.historyError).toBe(true);expect(room.un).toBe(3);stop();
  });

  it('hydrates several conversations concurrently with bounded requests and stable order', async () => {
    let emit!: (snapshot: ReturnType<typeof page>) => Promise<void>;
    fake.onSnapshot.mockImplementation((_query, callback) => { emit = callback; return vi.fn(); });
    const waiting = new Map<string,(value: unknown)=>void>();
    fake.context.mockImplementation(peer => new Promise(resolve => waiting.set(peer,resolve)));
    fake.getDocs.mockResolvedValue(page([]));
    const update = vi.fn(), stop = subscribeLiveUserChats('me',update);
    const loading = emit(page(Array.from({length:5},(_,i)=>({id:'room'+i,data:()=>({participants:['me','peer'+i]})}))));
    expect(waiting.size).toBe(4);
    for (const [id,resolve] of waiting) resolve({active:true,accepted:true,blocked:false,identity:{uid:id}});
    await vi.waitFor(()=>expect(waiting.size).toBe(5));
    waiting.get('peer4')!({active:true,accepted:true,blocked:false,identity:{uid:'peer4'}});
    await loading;
    expect(update.mock.calls[0][0].map((room: {id:string})=>room.id)).toEqual(['room0','room1','room2','room3','room4']);
    stop(); fake.context.mockResolvedValue({active:true,blocked:false,accepted:true,identity:{uid:'peer',name:'Peer'}});
  });

  it('uses one current peer context for identity and communication permission', async () => {
    let emit!: (snapshot: ReturnType<typeof page>) => Promise<void>;
    fake.onSnapshot.mockImplementation((_query, callback) => { emit = callback; return vi.fn(); });
    fake.getDocs.mockResolvedValue(page([]));
    const update = vi.fn(), stop = subscribeLiveUserChats('me', update);
    await emit(page([{id:'room',data:()=>({participants:['me','peer']})}]));
    expect(fake.context).toHaveBeenCalledTimes(1);
    expect(fake.context).toHaveBeenCalledWith('peer', undefined, 'room');
    expect(update.mock.calls[0][0][0].authorized).toBe(true);stop();
  });

  it('ignores an older chat hydration that finishes after a newer snapshot', async () => {
    let emit!: (snapshot: ReturnType<typeof page>) => Promise<void>;
    fake.onSnapshot.mockImplementation((_query, callback) => { emit = callback; return vi.fn(); });
    let resume!: (value: unknown) => void;
    fake.context.mockImplementationOnce(() => new Promise(resolve => { resume = resolve; }))
      .mockResolvedValue({identity:{uid:'peer',name:'Peer'}});
    fake.getDocs.mockResolvedValue(page([]));
    const update = vi.fn();
    const stop = subscribeLiveUserChats('me', update);
    const room = (id: string) => ({ id, data: () => ({ participants: ['me', 'peer'] }) });
    const older = emit(page([room('old')]));
    await emit(page([room('new')]));
    expect(update.mock.calls[0][0][0].id).toBe('new');
    resume({identity:{uid:'peer',name:'Peer'}});
    await older;
    expect(update).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not deliver async chat hydration after unsubscribe', async () => {
    let emit!: (snapshot: ReturnType<typeof page>) => Promise<void>;
    const unsubscribe = vi.fn();
    fake.onSnapshot.mockImplementation((_query, callback) => { emit = callback; return unsubscribe; });
    let resume!: (value: unknown) => void;
    fake.context.mockImplementationOnce(() => new Promise(resolve => { resume = resolve; }));
    fake.getDocs.mockResolvedValue(page([]));
    const update = vi.fn();
    const stop = subscribeLiveUserChats('me', update);
    const pending = emit(page([{ id: 'room', data: () => ({ participants: ['me', 'peer'] }) }]));
    stop();
    resume({identity:{uid:'peer',name:'Peer'}});
    await pending;
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it('continues after the last consumed user when a later batch fills the page early', async () => {
    const first = person('a'); const excluded = person('b', 'find_room');
    const second = person('c'); const remainder = person('d');
    fake.getDocs.mockResolvedValueOnce(page([first, excluded])).mockResolvedValueOnce(page([second, remainder]));
    const result = await fetchBoundedExploreRoommates({ currentUid: 'me', pageSize: 2, maxReadBudget: 8 });
    expect(result.roommates.map((p) => p.uid)).toEqual(['a', 'c']);
    expect(result.cursorDoc).toBe(second);
    expect(result.hasMore).toBe(true);
    fake.getDocs.mockResolvedValueOnce(page([remainder]));
    const continuation = await fetchBoundedExploreRoommates({ currentUid: 'me', pageSize: 2, cursorDoc: result.cursorDoc });
    expect(continuation.roommates.map((p) => p.uid)).toEqual(['d']);
    expect(continuation.hasMore).toBe(false);
  });

  it('read budget limits scan size and exhaustion preserves continuation', async () => {
    fake.getDocs.mockResolvedValueOnce(page([person('a', 'find_room'), person('b', 'find_room')]));
    const result = await fetchBoundedExploreRoommates({ currentUid: 'me', pageSize: 12, maxReadBudget: 2 });
    expect(fake.getDocs.mock.calls[0][0].constraints).toContainEqual({ limit: 2 });
    expect(result.totalDocsRead).toBe(2);
    expect(result.hasMore).toBe(true);
  });

  it('hydrates a canonical have-room candidate even when role is seeker and legacy intent is absent', async () => {
    const host = { id: 'host', data: () => ({ name: 'Host', role: 'seeker', status: 'active', serverResolvedIntent:{isDiscoveryEligible:true,isLiveInHost:true}, housingPreferences: { activeIntents: ['have_room'], associatedListingId: 'room' } }) };
    fake.getDocs.mockResolvedValueOnce(page([host]));
    const result = await fetchBoundedExploreRoommates({ currentUid: 'me', pageSize: 2 });
    expect(result.roommates.map((p) => p.uid)).toEqual(['host']);
    expect(result.roommates[0].resolvedIntent?.isLiveInHost).toBe(true);
  });

  it('continues past a server page containing only hidden records', async () => {
    const visible = person('visible');
    fake.gatewayPage.mockResolvedValueOnce({docs:[],empty:false,scanned:2,cursor:'hidden',hasMore:true})
      .mockResolvedValueOnce({docs:[visible],empty:false,scanned:1,cursor:'visible',hasMore:false});
    const result = await fetchBoundedExploreRoommates({currentUid:'me',pageSize:2});
    expect(result.roommates.map(person => person.uid)).toEqual(['visible']);
    expect(result.totalDocsRead).toBe(3);expect(result.hasMore).toBe(false);
    expect(fake.gatewayPage).toHaveBeenNthCalledWith(2,'people',{id:'hidden'},2);
  });

  it('applies category and city text predicates before collecting the page', async () => {
    const records = [
      { id: 'private', data: () => ({ title: 'Room', city: 'Pune', roomType: 'Private room', monthlyRent: 12000 }) },
      { id: 'shared', data: () => ({ title: 'Room', city: 'Pune', roomType: 'Shared room', monthlyRent: 10000 }) },
      { id: 'coliving', data: () => ({ title: 'Stay', city: 'Pune', flatType: 'Coliving', monthlyRent: 8000 }) },
      { id: 'hostel', data: () => ({ title: 'Stay', city: 'Pune', flatType: 'Hostel', monthlyRent: 7000 }) },
    ];
    fake.getDocs.mockResolvedValue(page(records));
    const rooms = await fetchBoundedExploreListings({ category: 'rooms', filters: { q: 'Pune', types: ['Private room'] } });
    expect(rooms.rooms.map(room => room.id)).toEqual(['private']);
    const coliving = await fetchBoundedExploreListings({ category: 'pg', filters: { propertyType: 'coliving' } });
    expect(coliving.pgs.map(place => place.id)).toEqual(['coliving']);
    const managed = await fetchBoundedExploreListings({ category: 'pg' });
    expect(managed.pgs.map(place => place.id)).toEqual(['coliving', 'hostel']);
  });

  it('a failed discovery query rejects instead of reporting an empty final page', async () => {
    fake.getDocs.mockRejectedValue(new Error('permission-denied'));
    await expect(fetchBoundedExploreListings({})).rejects.toThrow('permission-denied');
    await expect(fetchBoundedExploreRoommates({ currentUid: 'me',})).rejects.toThrow('permission-denied');
  });

  it('does not fabricate visitor compatibility, budget uplift, location or availability', () => {
    const user = mapFirestoreUser({ id: 'p', name: 'P', budget: 10000 });
    expect(user.matchPct).toBe(0);
    expect(user.budgetStr).toContain('10,000');
    expect(user.budgetStr).not.toContain('13');
    expect(user.city).toBe('');
    expect(user.moveInStr).toBe('Not provided');
    expect(mapFirestoreListing({ id: 'r' }).matchPct).toBe(0);
    expect(mapFirestorePG({ id: 'g' }).matchPct).toBe(0);
    expect(mapFirestoreUser({ name: 'P', householdExpectations: { dietPref: 'non-veg' } }).tags).not.toContain('Vegetarian');
  });

  it('preserves stored room type and permits removing the last image', async () => {
    expect(mapFirestoreListing({ flatType: '2BHK', roomType: 'Shared room' }).roomType).toBe('Shared room');
    await updateListingBackend('r', { ph: [] });
    expect(fake.updateDoc).toHaveBeenCalledWith('listings/r', expect.objectContaining({ images: [] }));
  });

  it('commits quota, new history and recipient event in one transaction', async () => {
    fake.getDocs.mockResolvedValue(page([]));
    const transaction = { get: vi.fn(async (ref: string) => ref.startsWith('users/') ? {exists:()=>true, data:()=>({connectsUsed:0,status:'active'})} : {exists:()=>false}), set:vi.fn(), update:vi.fn() };
    fake.transaction.mockImplementation(callback=>callback(transaction));
    await expect(sendConnectionRequestBackend('other')).resolves.toBe('new');
    expect(transaction.update).toHaveBeenCalledWith('users/me',expect.objectContaining({connectsUsed:1,lastConnectionId:'new'}));
    expect(transaction.set).toHaveBeenCalledWith('notifications/new_pending',expect.objectContaining({userId:'other',connectionId:'new'}));
    expect(fake.addDoc).not.toHaveBeenCalled();
    expect(fake.deleteDoc).not.toHaveBeenCalled();
  });

  it('reconciles a losing request transaction without charging another allowance', async () => {
    fake.getDocs.mockResolvedValue(page([]));
    const existing = { id: 'reverse-winner', exists: () => true, data: () => ({ fromUserId: 'other', toUserId: 'me', status: 'pending' }) };
    const tx = { get: vi.fn(async (ref: string) => ref.startsWith('users/')
      ? { exists: () => true, data: () => ({ status: 'active', connectsUsed: 0 }) }
      : ref.startsWith('connectionPairs/') ? { exists: () => true, data: () => ({ connectionId: 'reverse-winner' }) } : existing), set: vi.fn(), update: vi.fn() };
    fake.transaction.mockRejectedValueOnce(Object.assign(new Error('Competing request committed'), { code: 'permission-denied' }))
      .mockImplementationOnce(callback => callback(tx));
    await expect(sendConnectionRequestBackend('other')).resolves.toBe('reverse-winner');
    expect(fake.transaction).toHaveBeenCalledTimes(2);
    expect(tx.set).not.toHaveBeenCalled(); expect(tx.update).not.toHaveBeenCalled();
  });

  it('commits a message, unread summary and deterministic recipient event together', async () => {
    const transaction = {get:vi.fn(async (ref:string)=>ref==='chatRooms/chat'?{exists:()=>true,data:()=>({participants:['me','other'],unreadBy:{other:2}})}:{exists:()=>false}),set:vi.fn(),update:vi.fn()};
    fake.transaction.mockImplementation(callback=>callback(transaction));
    await sendMessageBackend('chat','Hello','','message-1');
    expect(transaction.set).toHaveBeenCalledWith('chatRooms/chat/messages/message-1',expect.objectContaining({senderId:'me',content:'Hello'}));
    expect(transaction.update).toHaveBeenCalledWith('chatRooms/chat',expect.objectContaining({unreadBy:{other:3}}));
    expect(transaction.set).toHaveBeenCalledWith('notifications/chat_message-1',expect.objectContaining({userId:'other'}));
    await expect(sendMessageBackend('chat','  ')).rejects.toThrow('Enter a message');
    await expect(sendMessageBackend('chat','','data:image/png;base64,bypass')).rejects.toThrow('Upload an authorized attachment');
  });

  it('cannot self grant identity verification through deprecated helper', async () => {
    await expect(verifyUserGovernmentIdBackend()).rejects.toThrow('manual administrator review');
    expect(fake.updateDoc).not.toHaveBeenCalled();
  });

  it('new listings enter review without self-granted trust or fabricated views', async () => {
    fake.addDoc.mockResolvedValue({ id: 'new-listing' });
    await createNewListingBackend({ title: 'Room', rent: 10000, loc: 'Central', city: 'Pune', isLiveInRoom: true, qs: ['Preferred move date?'] }, fake.auth.currentUser);
    expect(fake.addDoc).toHaveBeenCalledWith('listings', expect.objectContaining({
      status: 'pending_verification', ownerVerified: false, isOwnerVerified: false, views: 0,
      isLiveInRoom: true, screeningQuestions: ['Preferred move date?'],
    }));
    await createNewListingBackend({ title: 'Room', rent: 10000, loc: 'Central', city: 'Pune' }, fake.auth.currentUser);
    expect(fake.addDoc).toHaveBeenLastCalledWith('listings', expect.objectContaining({ isLiveInRoom: false }));
  });

  it('reviews exactly the inspected identity and commits trust, evidence and notification together', async () => {
    fake.getDocs.mockResolvedValue(page([{ref:'listings/r'}]));
    const tx={get:vi.fn().mockResolvedValue({exists:()=>true,data:()=>({status:'PENDING',documentPath:'verificationDocs/p/version.jpg'})}),set:vi.fn(),update:vi.fn()};
    fake.transaction.mockImplementation(callback=>callback(tx));
    await adminApproveVerificationBackend('p','admin@example.invalid','Reviewed','verificationDocs/p/version.jpg');
    expect(tx.update).toHaveBeenCalledWith('users/p',expect.objectContaining({isVerified:true,isAadhaarVerified:false}));
    expect(tx.update).toHaveBeenCalledWith('listings/r',expect.objectContaining({ownerVerified:true}));
    expect(tx.set).toHaveBeenCalledWith('notifications/p_identity_version.jpg_APPROVED',expect.objectContaining({userId:'p',type:'verification'}));
    expect(tx.update).not.toHaveBeenCalledWith('listings/r',expect.objectContaining({status:'active'}));
    tx.set.mockClear();tx.update.mockClear();
    await expect(adminApproveVerificationBackend('p','admin@example.invalid','Reviewed','verificationDocs/p/old.jpg')).rejects.toThrow('changed');
    expect(tx.set).not.toHaveBeenCalled();expect(tx.update).not.toHaveBeenCalled();
    await adminRejectVerificationBackend('p','admin@example.invalid','Unreadable','verificationDocs/p/version.jpg');
    expect(tx.update).toHaveBeenCalledWith('users/p',expect.objectContaining({isVerified:false,verificationLevel:0}));
  });
  it('large portfolios and uninspected submissions fail before any review writes', async () => {
    fake.getDocs.mockResolvedValue(page(Array.from({length:498},()=>({ref:'r'}))));
    await expect(adminApproveVerificationBackend('p','admin@example.invalid','Review','verificationDocs/p/version.jpg')).rejects.toThrow('server-side');
    expect(fake.transaction).not.toHaveBeenCalled();
    await expect(adminApproveVerificationBackend('p','admin@example.invalid')).rejects.toThrow('Open the current');
  });

  it('resubmits rejected identity privately and commits both submission mirrors together', async () => {
    fake.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ status: 'REJECTED', resubmissionCount: 1 }) });
    fake.upload.mockResolvedValue(undefined);
    const batch = { set: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    fake.batch.mockReturnValue(batch);
    await submitManualKycBackend(new File(['identity'], 'id.pdf', { type: 'application/pdf' }), 'passport', 'Example Person', true);
    expect(batch.set).toHaveBeenCalledWith('verifications/me', expect.objectContaining({
      documentPath: expect.stringMatching(/^verificationDocs\/me\//), status: 'PENDING', resubmissionCount: 2,
    }), { merge: true });
    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledOnce();
    expect(fake.getDownloadURL).not.toHaveBeenCalled();
  });

  it('pending identity cannot be overwritten, and previews fetch authenticated bytes only', async () => {
    fake.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ status: 'PENDING' }) });
    await expect(submitManualKycBackend(new File(['identity'], 'id.pdf', { type: 'application/pdf' }), 'passport', 'Example Person', true)).rejects.toThrow('awaiting review');
    expect(fake.upload).not.toHaveBeenCalled();
    fake.getBlob.mockResolvedValue(new Blob(['private'], { type: 'application/pdf' }));
    await getVerificationDocumentBlobBackend('verificationDocs/me/id.pdf');
    expect(fake.getBlob).toHaveBeenCalledWith({ fullPath: 'verificationDocs/me/id.pdf' }, 5 * 1024 * 1024);
    await expect(getVerificationDocumentBlobBackend('https://public.example/doc')).rejects.toThrow('private document path');
    fake.getBlob.mockResolvedValue(new Blob(['<script>unsafe</script>'], { type: 'text/html' }));
    await expect(getVerificationDocumentBlobBackend('verificationDocs/me/legacy.html')).rejects.toThrow('Unsupported identity document format');
    expect(fake.getDownloadURL).not.toHaveBeenCalled();
  });

  const permittedUser = async (ref:string) => ref.startsWith('users/') ? {exists:()=>true,data:()=>({status:'active'})} : ref.startsWith('acceptedPairs/') ? {exists:()=>true,data:()=>({connectionId:'consent'})} : ref.startsWith('connections/') ? {exists:()=>true,data:()=>({status:'accepted',fromUserId:'me',toUserId:'other'})} : {exists:()=>false};
  it('serializes new room identity and keeps concurrent metadata intact', async () => {
    fake.getDoc.mockImplementation(permittedUser);fake.getDocs.mockResolvedValue(page([]));
    const tx={get:vi.fn().mockResolvedValue({exists:()=>false}),set:vi.fn(),update:vi.fn()};
    fake.transaction.mockImplementation(callback=>callback(tx));
    await expect(getOrCreateChatRoomBackend('other')).resolves.toBe('me___other');
    expect(tx.set).toHaveBeenCalledWith('chatRooms/me___other',expect.objectContaining({participants:['me','other']}));
    expect(tx.set).toHaveBeenCalledWith('conversationPairs/me___other',expect.objectContaining({roomId:'me___other'}));
    tx.set.mockClear();tx.get.mockImplementation(async(ref:string)=>ref.startsWith('conversationPairs/')?{exists:()=>true,data:()=>({roomId:'me___other'})}:{exists:()=>true,data:()=>({participants:['me','other'],lastMessage:'existing'})});
    await expect(getOrCreateChatRoomBackend('other')).resolves.toBe('me___other');expect(tx.set).not.toHaveBeenCalled();
  });
  it('indexes an authorized legacy room without rewriting its history or identity', async () => {
    fake.getDoc.mockImplementation(permittedUser);fake.getDocs.mockResolvedValue(page([{id:'legacy-random',data:()=>({participants:['me','other']})}]));
    const tx={get:vi.fn(async(ref:string)=>ref.startsWith('conversationPairs/')?{exists:()=>false}:{exists:()=>true,data:()=>({participants:['me','other']})}),set:vi.fn(),update:vi.fn()};
    fake.transaction.mockImplementation(callback=>callback(tx));
    await expect(getOrCreateChatRoomBackend('other')).resolves.toBe('legacy-random');
    expect(tx.set).toHaveBeenCalledTimes(2);expect(tx.set).toHaveBeenCalledWith('conversationPairs/me___other',expect.objectContaining({roomId:'legacy-random'}));
    expect(tx.update).not.toHaveBeenCalled();
  });

  it('reserves an owned draft before photos upload under the listing ID, then submits real URLs', async () => {
    fake.addDoc.mockResolvedValue({ id: 'owned-listing' });
    fake.upload.mockImplementation(async reference => ({ ref: reference }));
    fake.getDownloadURL.mockImplementation(async reference => `https://storage.example/${reference.fullPath}`);
    const result = await createNewListingBackend({ title: 'Room', rent: 10000, loc: 'Central', city: 'Pune', type: 'Full flat', ph: ['data:image/png;base64,iVBORw0KGgo='] }, fake.auth.currentUser);
    expect(fake.addDoc).toHaveBeenCalledWith('listings', expect.objectContaining({ status: 'draft', images: [], roomType: 'Full flat' }));
    expect(fake.upload.mock.calls[0][0].fullPath).toMatch(/^listings\/owned-listing\//);
    expect(fake.updateDoc).toHaveBeenCalledWith({ id: 'owned-listing' }, expect.objectContaining({ status: 'pending_verification', images: [expect.stringMatching(/^https:\/\/storage.example\/listings\/owned-listing\//)] }));
    expect(result.status).toBe('pending_verification');
  });

  it('failed photo upload leaves a recoverable draft and never confirms submission', async () => {
    fake.addDoc.mockResolvedValue({ id: 'failed-photo-draft' });
    fake.upload.mockRejectedValue(new Error('storage unavailable'));
    await expect(createNewListingBackend({ title: 'Room', rent: 10000, loc: 'Central', city: 'Pune', ph: ['data:image/png;base64,iVBORw0KGgo='] }, fake.auth.currentUser)).rejects.toMatchObject({ draftListingId: 'failed-photo-draft' });
    expect(fake.addDoc).toHaveBeenCalledWith('listings', expect.objectContaining({ status: 'draft' }));
    expect(fake.updateDoc).not.toHaveBeenCalled();
  });

  it('editing listing photos uploads data URLs instead of writing them to Firestore', async () => {
    fake.upload.mockImplementation(async reference => ({ ref: reference }));
    fake.getDownloadURL.mockResolvedValue('https://storage.example/replacement.png');
    await updateListingBackend('owned-listing', { ph: ['https://storage.example/kept.png', 'data:image/png;base64,iVBORw0KGgo='] });
    expect(fake.updateDoc).toHaveBeenCalledWith('listings/owned-listing', expect.objectContaining({ images: ['https://storage.example/kept.png', 'https://storage.example/replacement.png'] }));
  });
});
