const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApplicationChatService } = require('./applicationChatService');

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function makeFakeDb(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  let seq = 0;

  const setNested = (obj, path, value) => {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  };

  const resolveTokens = (val) => {
    if (val && typeof val === 'object' && val.__serverTimestamp) return { seconds: Math.floor(1700000000 + (++seq)) };
    if (Array.isArray(val)) return val.map(resolveTokens);
    if (val && typeof val === 'object') {
      return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, resolveTokens(v)]));
    }
    return val;
  };

  const docRef = (path) => ({
    id: path.split('/').pop(),
    path,
  });

  const db = {
    doc: (path) => docRef(path),
    collection: (colPath) => ({
      doc: (id) => docRef(`${colPath}/${id || `gen_${++seq}`}`),
    }),
    runTransaction: async (fn) => {
      const staged = new Map();
      const tx = {
        get: async (ref) => {
          const val = store.has(ref.path) ? structuredClone(store.get(ref.path)) : undefined;
          return {
            id: ref.id,
            exists: val !== undefined,
            data: () => val,
          };
        },
        set: (ref, data, opts = {}) => staged.set(ref.path, { op: 'set', data, merge: !!opts.merge }),
        update: (ref, data) => staged.set(ref.path, { op: 'update', data }),
        delete: (ref) => staged.set(ref.path, { op: 'delete' }),
      };
      const result = await fn(tx);
      for (const [path, action] of staged.entries()) {
        if (action.op === 'delete') {
          store.delete(path);
        } else if (action.op === 'set') {
          const resolved = resolveTokens(structuredClone(action.data));
          if (action.merge && store.has(path)) {
            store.set(path, { ...store.get(path), ...resolved });
          } else {
            store.set(path, resolved);
          }
        } else if (action.op === 'update') {
          const existing = store.get(path);
          if (!existing) throw new Error(`Missing document for update: ${path}`);
          const next = structuredClone(existing);
          for (const [k, v] of Object.entries(action.data)) {
            setNested(next, k, resolveTokens(structuredClone(v)));
          }
          store.set(path, next);
        }
      }
      return result;
    },
  };

  return {
    store,
    db,
    service: createApplicationChatService({
      getDb: () => db,
      fieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) },
      HttpsError,
    }),
  };
}

function baseFixture() {
  return {
    'users/seeker': { name: 'Riya', status: 'active', city: 'Bengaluru', budgetMax: 18000, isVerified: true, quizAnswers: { smoking: 'never', pets: 'no' } },
    'users/host': { name: 'Aarav', status: 'active', city: 'Bengaluru', isVerified: true, quizAnswers: { smoking: 'never' } },
    'listings/room1': {
      ownerId: 'host',
      status: 'active',
      title: 'Sunlit 2BHK in Indiranagar',
      rent: 15000,
      deposit: 30000,
      locality: 'Indiranagar',
      city: 'Bengaluru',
      roomType: 'Private Room',
      screeningQuestions: ['Do you smoke?', 'When do you move in?'],
    },
  };
}

test('submitRoomApplication atomically creates application, chatRoom, application_card message, and notification', async () => {
  const { store, service } = makeFakeDb(baseFixture());
  const res = await service.submitRoomApplication({
    auth: { uid: 'seeker' },
    data: {
      listingId: 'room1',
      answers: { 'Do you smoke?': 'No', 'When do you move in?': '1st next month' },
      note: 'Working nearby, quiet and tidy.',
      moveIn: 'Immediate',
    },
  });

  assert.equal(res.status, 'pending');
  assert.equal(res.unlocked, false);
  assert.equal(res.inboxBox, 'requests');
  assert.equal(res.alreadyExists, false);
  assert.equal(res.roomId, 'host___seeker');

  const app = store.get(`applications/${res.applicationId}`);
  assert.equal(app.listingId, 'room1');
  assert.equal(app.applicantId, 'seeker');
  assert.equal(app.ownerId, 'host');
  assert.equal(app.roomId, res.roomId);
  assert.equal(app.status, 'pending');

  const room = store.get(`chatRooms/${res.roomId}`);
  assert.equal(room.threadType, 'application');
  assert.equal(room.unlocked, false);
  assert.deepEqual(room.inboxBucketByUser, { seeker: 'requests', host: 'requests' });
  assert.equal(room.listingSnapshot.title, 'Sunlit 2BHK in Indiranagar');
  assert.equal(room.unreadBy.host, 1);

  const cardMsg = store.get(`chatRooms/${res.roomId}/messages/app_${res.applicationId}_card`);
  assert.equal(cardMsg.kind, 'application_card');
  assert.equal(cardMsg.senderId, 'seeker');
  assert.equal(cardMsg.payload.status, 'pending');
  assert.equal(cardMsg.payload.note, 'Working nearby, quiet and tidy.');
  assert.equal(cardMsg.payload.answers['Do you smoke?'], 'No');

  const notif = store.get(`notifications/${res.applicationId}_pending`);
  assert.equal(notif.userId, 'host');
  assert.equal(notif.roomId, res.roomId);
  assert.equal(notif.applicationId, res.applicationId);
  assert.equal(notif.inboxBox, 'requests');
  assert.ok(notif.actionUrl.includes(`/messages?box=requests&chat=${encodeURIComponent(res.roomId)}`));
});

test('submitRoomApplication is idempotent for active lock and preserves existing unlocked chats', async () => {
  const fixture = {
    ...baseFixture(),
    'acceptedPairs/host_seeker': { user1: 'host', user2: 'seeker', connectionId: 'c1' },
  };
  const { service } = makeFakeDb(fixture);
  const first = await service.submitRoomApplication({
    auth: { uid: 'seeker' },
    data: { listingId: 'room1', answers: { 'Do you smoke?': 'No', 'When do you move in?': 'Now' } },
  });
  assert.equal(first.unlocked, true);
  assert.equal(first.inboxBox, 'chats');

  const second = await service.submitRoomApplication({
    auth: { uid: 'seeker' },
    data: { listingId: 'room1', answers: { 'Do you smoke?': 'No', 'When do you move in?': 'Now' } },
  });
  assert.equal(second.alreadyExists, true);
  assert.equal(second.applicationId, first.applicationId);
  assert.equal(second.roomId, first.roomId);
});

test('decideRoomApplication handles shortlist, accept/unlock, and reject/decline lock removal', async () => {
  const { store, service } = makeFakeDb(baseFixture());
  const submitted = await service.submitRoomApplication({
    auth: { uid: 'seeker' },
    data: { listingId: 'room1', answers: { 'Do you smoke?': 'No', 'When do you move in?': 'Now' } },
  });

  // Seeker cannot shortlist/select own application
  await assert.rejects(
    service.decideRoomApplication({
      auth: { uid: 'seeker' },
      data: { applicationId: submitted.applicationId, nextStatus: 'selected' },
    }),
    { code: 'failed-precondition' }
  );

  // Host shortlists inline -> stays in requests, unlocked=false, inserts system event
  const shortlisted = await service.decideRoomApplication({
    auth: { uid: 'host' },
    data: { applicationId: submitted.applicationId, nextStatus: 'shortlisted' },
  });
  assert.equal(shortlisted.unlocked, false);
  assert.equal(shortlisted.inboxBox, 'requests');
  assert.equal(store.get(`chatRooms/${submitted.roomId}/messages/sys_${submitted.applicationId}_shortlisted`).kind, 'system_event');
  assert.equal(store.get(`chatRooms/${submitted.roomId}/messages/app_${submitted.applicationId}_card`).payload.status, 'shortlisted');

  // Host accepts -> unlocks listingPairs, moves to chats, inserts system event & notification
  const accepted = await service.decideRoomApplication({
    auth: { uid: 'host' },
    data: { applicationId: submitted.applicationId, nextStatus: 'selected' },
  });
  assert.equal(accepted.unlocked, true);
  assert.equal(accepted.inboxBox, 'chats');
  assert.equal(store.get('listingPairs/seeker_host').applicationId, submitted.applicationId);
  assert.equal(store.get('listingPairs/host_seeker').applicationId, submitted.applicationId);
  assert.equal(store.get(`chatRooms/${submitted.roomId}`).unlocked, true);
  assert.deepEqual(store.get(`chatRooms/${submitted.roomId}`).inboxBucketByUser, { seeker: 'chats', host: 'chats' });
  assert.equal(store.get(`chatRooms/${submitted.roomId}/messages/sys_${submitted.applicationId}_selected`).senderId, 'system');
  assert.equal(store.get(`notifications/${submitted.applicationId}_selected`).inboxBox, 'chats');

  // Host rejects after selection -> removes listingPairs grant, moves to closed with reason
  const rejected = await service.decideRoomApplication({
    auth: { uid: 'host' },
    data: { applicationId: submitted.applicationId, nextStatus: 'rejected', reason: 'Room filled' },
  });
  assert.equal(rejected.unlocked, false);
  assert.equal(rejected.inboxBox, 'closed');
  assert.equal(store.has('listingPairs/seeker_host'), false);
  assert.equal(store.has('listingPairs/host_seeker'), false);
  assert.ok(store.get(`chatRooms/${submitted.roomId}/messages/sys_${submitted.applicationId}_rejected`).content.includes('Room filled'));
});

test('applicant can re-apply after rejection and get fresh application card', async () => {
  const { service } = makeFakeDb(baseFixture());
  const first = await service.submitRoomApplication({
    auth: { uid: 'seeker' },
    data: { listingId: 'room1', answers: { 'Do you smoke?': 'No', 'When do you move in?': 'Now' } },
  });
  await service.decideRoomApplication({
    auth: { uid: 'host' },
    data: { applicationId: first.applicationId, nextStatus: 'rejected', reason: 'Schedule conflict' },
  });
  const second = await service.submitRoomApplication({
    auth: { uid: 'seeker' },
    data: { listingId: 'room1', answers: { 'Do you smoke?': 'No', 'When do you move in?': 'Next month' } },
  });
  assert.equal(second.alreadyExists, false);
  assert.notEqual(second.applicationId, first.applicationId);
  assert.equal(second.roomId, first.roomId);
});
