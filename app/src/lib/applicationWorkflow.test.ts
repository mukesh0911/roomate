import { beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  transaction: vi.fn(),
  onSnapshot: vi.fn(),
  context: vi.fn(),
  readDiscovery: vi.fn(),
  submitAppCallable: vi.fn(),
  decideAppCallable: vi.fn(),
  auth: { currentUser: { uid: 'seeker_1', displayName: 'Mukesh' } },
}));

vi.mock('./discoveryGateway', async (original) => ({
  ...(await original<typeof import('./discoveryGateway')>()),
  getInteractionContext: fake.context,
  readDiscovery: fake.readDiscovery,
  submitRoomApplicationCallable: fake.submitAppCallable,
  decideRoomApplicationCallable: fake.decideAppCallable,
}));

vi.mock('./firebase', () => ({ db: {}, storage: {}, auth: fake.auth }));

vi.mock('firebase/storage', () => ({
  ref: (_storage: unknown, path: string) => ({ fullPath: path }),
  uploadBytesResumable: vi.fn(),
  getDownloadURL: vi.fn(),
  getBlob: vi.fn(),
}));

vi.mock('firebase/firestore', async (original) => ({
  ...(await original<typeof import('firebase/firestore')>()),
  collection: (...args: unknown[]) => args.slice(1).join('/'),
  doc: (...args: unknown[]) =>
    args.length === 1
      ? { id: 'app_generated_1', path: `${args[0]}/app_generated_1` }
      : args.slice(1).join('/'),
  query: (source: unknown, ...constraints: unknown[]) => ({ source, constraints }),
  where: (...args: unknown[]) => ({ where: args }),
  orderBy: vi.fn(),
  limit: (count: number) => ({ limit: count }),
  getDocs: fake.getDocs,
  getDoc: fake.getDoc,
  addDoc: fake.addDoc,
  updateDoc: fake.updateDoc,
  runTransaction: (_db: unknown, callback: unknown) => fake.transaction(callback),
  serverTimestamp: () => 'server-time',
  onSnapshot: fake.onSnapshot,
}));

import {
  submitApplicationBackend,
  submitApplicationChatBackend,
  decideApplicationChatBackend,
  getSubmittedApplicationRoom,
  subscribeActiveChatMessages,
  subscribeLiveNotifications,
  subscribeOwnerListings,
  subscribeUserApplications,
} from './nestmateBackend';

beforeEach(() => {
  vi.clearAllMocks();
  fake.context.mockResolvedValue({
    active: true,
    blocked: false,
    accepted: false,
    identity: { uid: 'owner_1', name: 'Host Owner', status: 'active' },
  });
});

describe('Room application send/receive workflows', () => {
  it('throws clear Listing unavailable error when listing record is missing', async () => {
    fake.readDiscovery.mockResolvedValueOnce({ record: null });
    await expect(
      submitApplicationBackend('missing_listing', {})
    ).rejects.toThrow('Listing unavailable.');
  });

  it('requires verbatim screening question keys and persists answers, moveIn, note, lock, and owner notification', async () => {
    const placeData = {
      id: 'room_123',
      ownerId: 'owner_1',
      title: '2 BHK Full flat in Koramangala',
      status: 'active',
      isDeleted: false,
      screeningQuestions: ['Do you smoke or drink?', 'Do you have pets or plan to?'],
      updatedAt: 'ts_1',
    };
    fake.readDiscovery.mockResolvedValue({
      record: placeData,
    });

    const tx = {
      get: vi.fn(async (ref: string) => {
        if (ref === 'users/seeker_1') {
          return { exists: () => true, data: () => ({ status: 'active', name: 'Mukesh' }) };
        }
        return { exists: () => false, data: () => null };
      }),
      set: vi.fn(),
    };
    fake.transaction.mockImplementation((cb) => cb(tx));

    // Legacy index-keyed answers fail cleanly
    await expect(
      submitApplicationBackend('room_123', { q_0: 'No', q_1: 'No pets' })
    ).rejects.toThrow('Answer every screening question (up to 2000 characters each).');

    // Exact screening question keys succeed with note + moveIn
    const appId = await submitApplicationBackend(
      'room_123',
      {
        'Do you smoke or drink?': 'Non-smoker',
        'Do you have pets or plan to?': 'No pets',
      },
      { note: 'Software engineer, clean and quiet.', moveIn: 'Within 15 days' }
    );

    expect(appId).toBe('app_generated_1');
    expect(tx.set).toHaveBeenCalledWith(
      { id: 'app_generated_1', path: 'applications/app_generated_1' },
      expect.objectContaining({
        listingId: 'room_123',
        applicantId: 'seeker_1',
        ownerId: 'owner_1',
        status: 'pending',
        screeningAnswers: {
          'Do you smoke or drink?': 'Non-smoker',
          'Do you have pets or plan to?': 'No pets',
        },
        note: 'Software engineer, clean and quiet.',
        moveIn: 'Within 15 days',
      })
    );
    expect(tx.set).toHaveBeenCalledWith(
      'applicationLocks/room_123___seeker_1',
      { listingId: 'room_123', applicantId: 'seeker_1', applicationId: 'app_generated_1' }
    );
    expect(tx.set).toHaveBeenCalledWith(
      'notifications/app_generated_1_pending',
      expect.objectContaining({
        userId: 'owner_1',
        actorId: 'seeker_1',
        type: 'application',
        applicationId: 'app_generated_1',
        listingId: 'room_123',
      })
    );
  });

  it('keeps owner listing subscription resilient when an applicant person lookup throws', async () => {
    const callbacks: Array<(snap: any) => void> = [];
    fake.onSnapshot.mockImplementation((_q: unknown, cb: (snap: any) => void) => {
      callbacks.push(cb);
      return vi.fn();
    });

    fake.readDiscovery.mockRejectedValue(new Error('gateway lookup failed'));

    const updates: any[][] = [];
    const unsub = subscribeOwnerListings('owner_1', (items) => {
      updates.push(items);
    });

    expect(callbacks).toHaveLength(3);
    // 1. Owner listings snapshot
    callbacks[0]({
      docs: [
        {
          id: 'room_123',
          data: () => ({
            title: '2 BHK Full flat in Koramangala',
            locality: 'Koramangala',
            monthlyRent: 14000,
            status: 'active',
            images: [],
          }),
        },
      ],
    });
    // 2. Owner applications snapshot
    callbacks[1]({
      docs: [
        {
          id: 'app_1',
          data: () => ({
            listingId: 'room_123',
            applicantId: 'seeker_1',
            ownerId: 'owner_1',
            status: 'pending',
            note: 'Hello host!',
            moveIn: 'Immediate',
            screeningAnswers: { 'Do you smoke or drink?': 'No' },
            createdAt: { toMillis: () => 1700000000000 },
          }),
        },
      ],
    });
    // 3. Legacy connections snapshot
    callbacks[2]({ docs: [] });

    await vi.waitFor(() => expect(updates.length).toBeGreaterThanOrEqual(1));
    const latest = updates[updates.length - 1];
    expect(latest).toHaveLength(1);
    expect(latest[0].ap).toHaveLength(1);
    expect(latest[0].ap[0]).toMatchObject({
      applicationId: 'app_1',
      fromUserId: 'seeker_1',
      applicantStage: 'pending',
      note: 'Hello host!',
      moveIn: 'Immediate',
      screeningAnswers: { 'Do you smoke or drink?': 'No' },
      user: null,
    });

    unsub();
  });

  it('subscribes to seeker applications sorted newest-first and tolerates unavailable listing metadata', async () => {
    let appCallback: ((snap: any) => Promise<void> | void) | null = null;
    const unsubMock = vi.fn();
    fake.onSnapshot.mockImplementation((q: any, cb: (snap: any) => Promise<void> | void) => {
      expect(q).toEqual({ source: 'applications', constraints: [{ where: ['applicantId', '==', 'seeker_1'] }] });
      appCallback = cb;
      return unsubMock;
    });

    fake.readDiscovery.mockImplementation(async ({ id }: { action: string; id: string }) => {
      if (id === 'room_123') {
        return {
          record: {
            id: 'room_123',
            title: '2 BHK Full flat in Koramangala',
            locality: 'Koramangala',
            monthlyRent: 14000,
            ownerId: 'owner_1',
            ownerName: 'Mukeshram G',
            isOwnerVerified: true,
            images: ['https://example.com/room.jpg'],
          },
        };
      }
      throw new Error('listing removed');
    });

    const received: any[][] = [];
    const unsub = subscribeUserApplications('seeker_1', (items) => received.push(items));
    expect(appCallback).toBeTypeOf('function');

    await appCallback!({
      docs: [
        {
          id: 'app_old',
          data: () => ({
            listingId: 'removed_room',
            ownerId: 'owner_2',
            status: 'shortlisted',
            createdAt: { toMillis: () => 1000 },
            updatedAt: { toMillis: () => 2000 },
          }),
        },
        {
          id: 'app_new',
          data: () => ({
            listingId: 'room_123',
            ownerId: 'owner_1',
            status: 'pending',
            note: 'Excited to visit!',
            moveIn: 'Within 15 days',
            screeningAnswers: { 'Do you smoke or drink?': 'No' },
            createdAt: { toMillis: () => 5000 },
            updatedAt: { toMillis: () => 5000 },
          }),
        },
      ],
    });

    expect(received).toHaveLength(1);
    expect(received[0].map((a) => a.id)).toEqual(['app_new', 'app_old']);
    expect(received[0][0]).toMatchObject({
      id: 'app_new',
      listingId: 'room_123',
      listingTitle: '2 BHK Full flat in Koramangala',
      listingLocality: 'Koramangala',
      listingRent: 14000,
      ownerName: 'Mukeshram G',
      ownerVerified: true,
      status: 'pending',
      moveIn: 'Within 15 days',
      note: 'Excited to visit!',
    });
    expect(received[0][1]).toMatchObject({
      id: 'app_old',
      listingId: 'removed_room',
      listingTitle: 'Room Listing',
      status: 'shortlisted',
    });

    unsub();
    expect(unsubMock).toHaveBeenCalledTimes(1);
  });

  it('tracks chat-first application submission, decision, live messages, and deep-linked notifications', async () => {
    fake.submitAppCallable.mockResolvedValue({
      applicationId: 'app_chat_9',
      roomId: 'owner_1___seeker_1',
      status: 'pending',
      unlocked: false,
      inboxBox: 'requests',
    });
    const submitRes = await submitApplicationChatBackend('room_123', { 'Smoking?': 'No' }, { note: 'Clean', moveIn: 'Now' });
    expect(submitRes).toMatchObject({
      applicationId: 'app_chat_9',
      roomId: 'owner_1___seeker_1',
      unlocked: false,
      inboxBox: 'requests',
    });
    expect(getSubmittedApplicationRoom('app_chat_9')).toEqual({
      applicationId: 'app_chat_9',
      roomId: 'owner_1___seeker_1',
      unlocked: false,
      inboxBox: 'requests',
    });

    fake.decideAppCallable.mockResolvedValue({
      applicationId: 'app_chat_9',
      roomId: 'owner_1___seeker_1',
      status: 'selected',
      unlocked: true,
      inboxBox: 'chats',
    });
    const decideRes = await decideApplicationChatBackend('app_chat_9', 'selected', '');
    expect(decideRes.unlocked).toBe(true);
    expect(getSubmittedApplicationRoom('app_chat_9')?.inboxBox).toBe('chats');

    let activeMsgCb: ((snap: any) => Promise<void> | void) | null = null;
    fake.onSnapshot.mockImplementation((_q: unknown, cb: (snap: any) => Promise<void> | void) => {
      activeMsgCb = cb;
      return vi.fn();
    });
    const receivedBatches: any[] = [];
    const unsubMsgs = subscribeActiveChatMessages('owner_1___seeker_1', 'seeker_1', (res) => receivedBatches.push(res));
    await activeMsgCb!({
      docs: [
        {
          id: 'sys_app_chat_9_selected',
          data: () => ({
            senderId: 'system',
            kind: 'system_event',
            content: 'Application accepted! You can now chat directly.',
            payload: { applicationId: 'app_chat_9', status: 'selected', text: 'Application accepted! You can now chat directly.' },
            createdAt: { toMillis: () => 2000, toDate: () => new Date(2000) },
          }),
        },
        {
          id: 'app_app_chat_9_card',
          data: () => ({
            senderId: 'seeker_1',
            kind: 'application_card',
            content: 'Applied for Room',
            payload: { applicationId: 'app_chat_9', status: 'pending', moveIn: 'Now' },
            createdAt: { toMillis: () => 1000, toDate: () => new Date(1000) },
          }),
        },
      ],
    });
    await vi.waitFor(() => expect(receivedBatches).toHaveLength(1));
    expect(receivedBatches[0].messages).toHaveLength(2);
    expect(receivedBatches[0].messages[0][7]).toBe('application_card');
    expect(receivedBatches[0].messages[1][0]).toBe('sys');
    expect(receivedBatches[0].messages[1][7]).toBe('system_event');
    unsubMsgs();

    let notifCb: ((snap: any) => void) | null = null;
    fake.onSnapshot.mockImplementation((_q: unknown, cb: (snap: any) => void) => {
      notifCb = cb;
      return vi.fn();
    });
    const notifs: any[][] = [];
    const unsubNotif = subscribeLiveNotifications('owner_1', (items) => notifs.push(items));
    notifCb!({
      docs: [
        {
          id: 'n1',
          data: () => ({
            type: 'application',
            title: 'New Room Application',
            description: 'Mukesh applied for Sunny 2BHK',
            roomId: 'owner_1___seeker_1',
            applicationId: 'app_chat_9',
            inboxBox: 'requests',
            listingId: 'room_123',
            read: false,
            createdAt: { toDate: () => new Date() },
          }),
        },
      ],
    });
    expect(notifs[0][0]).toMatchObject({
      ty: 'app',
      roomId: 'owner_1___seeker_1',
      applicationId: 'app_chat_9',
      inboxBox: 'requests',
      listingId: 'room_123',
    });
    unsubNotif();
  });
});

