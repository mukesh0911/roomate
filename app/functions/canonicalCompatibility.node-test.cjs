const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createDiscoveryGateway } = require('./discoveryGateway');
const { createApplicationChatService } = require('./applicationChatService');
const {
  calculateCanonicalRoomCompatibility,
  calculateProfileCompatibility,
  COMPATIBILITY_ENGINE_VERSION,
} = require('./sharedMatching');

class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function makeUnifiedHarness(initial = {}) {
  const store = new Map(Object.entries(initial).map(([k, v]) => [k, structuredClone(v)]));
  let seq = 0;

  const resolveTokens = (val) => {
    if (val && typeof val === 'object' && val.__serverTimestamp) return { seconds: Math.floor(1700000000 + (++seq)), nanoseconds: 0 };
    if (Array.isArray(val)) return val.map(resolveTokens);
    if (val && typeof val === 'object') {
      return Object.fromEntries(Object.entries(val).map(([k, v]) => [k, resolveTokens(v)]));
    }
    return val;
  };

  const makeSnap = (path) => {
    const val = store.has(path) ? structuredClone(store.get(path)) : undefined;
    return {
      id: path.split('/').pop(),
      ref: {
        id: path.split('/').pop(),
        path,
        set: async (data, opts = {}) => {
          const resolved = resolveTokens(structuredClone(data));
          if (opts.merge && store.has(path)) {
            store.set(path, { ...store.get(path), ...resolved });
          } else {
            store.set(path, resolved);
          }
        },
      },
      exists: val !== undefined,
      data: () => val,
    };
  };

  const makeQuery = (colPath, filters = [], after = null, cap = null) => ({
    where: (field, op, val) => makeQuery(colPath, [...filters, [field, op, val]], after, cap),
    orderBy: () => makeQuery(colPath, filters, after, cap),
    startAfter: (cursor) => makeQuery(colPath, filters, cursor.id, cap),
    limit: (n) => makeQuery(colPath, filters, after, n),
    get: async () => {
      const prefix = `${colPath}/`;
      let paths = [...store.keys()].filter((p) => {
        if (!p.startsWith(prefix)) return false;
        if (p.slice(prefix.length).includes('/')) return false;
        const data = store.get(p);
        return filters.every(([f, op, v]) => {
          if (op === '==') return data[f] === v;
          if (op === 'in' && Array.isArray(v)) return v.includes(data[f]);
          return false;
        });
      });
      if (after) {
        const idx = paths.indexOf(`${colPath}/${after}`);
        paths = idx >= 0 ? paths.slice(idx + 1) : paths;
      }
      if (cap != null) paths = paths.slice(0, cap);
      const docs = paths.map(makeSnap);
      return { docs, empty: docs.length === 0, size: docs.length };
    },
  });

  const db = {
    doc: (path) => ({
      id: path.split('/').pop(),
      path,
      get: async () => makeSnap(path),
      set: async (data, opts = {}) => {
        const resolved = resolveTokens(structuredClone(data));
        if (opts.merge && store.has(path)) {
          store.set(path, { ...store.get(path), ...resolved });
        } else {
          store.set(path, resolved);
        }
      },
    }),
    collection: (colPath) => ({
      ...makeQuery(colPath),
      doc: (id) => {
        const path = `${colPath}/${id || `gen_${++seq}`}`;
        return db.doc(path);
      },
    }),
    runTransaction: async (fn) => {
      const staged = new Map();
      const tx = {
        get: async (ref) => makeSnap(ref.path),
        set: (ref, data, opts = {}) => staged.set(ref.path, { op: 'set', data, merge: !!opts.merge }),
        update: (ref, data) => staged.set(ref.path, { op: 'update', data }),
        delete: (ref) => staged.set(ref.path, { op: 'delete' }),
      };
      const result = await fn(tx);
      for (const [path, action] of staged.entries()) {
        if (action.op === 'delete') store.delete(path);
        else if (action.op === 'set') {
          const resolved = resolveTokens(structuredClone(action.data));
          if (action.merge && store.has(path)) store.set(path, { ...store.get(path), ...resolved });
          else store.set(path, resolved);
        }
      }
      return result;
    },
  };

  const gateway = createDiscoveryGateway({ getDb: () => db, HttpsError });
  const appChat = createApplicationChatService({
    getDb: () => db,
    fieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) },
    HttpsError,
  });

  return { store, db, gateway, appChat };
}

function bugReproductionFixture() {
  return {
    'users/seeker_a': {
      name: 'Seeker A',
      role: 'seeker',
      status: 'active',
      onboardingComplete: true,
      roommateDiscoveryEnabled: true,
      city: 'Bengaluru',
      localities: ['Koramangala'],
      budget: 35000,
      gender: 'Male',
      preferredRoomTypes: ['Private room'],
      quizAnswers: {
        food_pref: 'non_veg',
        smoking: 'never',
        pets: 'no',
        sleep_time: 'after_12',
      },
    },
    'users/owner_b': {
      name: 'Owner B',
      role: 'owner',
      status: 'active',
      onboardingComplete: true,
      roommateDiscoveryEnabled: false,
      city: 'Mumbai', // Deliberately different personal profile city/quiz so Owner-vs-Seeker differs wildly (~34% bug)
      budget: 9000,
      gender: 'Female',
      quizAnswers: {
        food_pref: 'veg',
        smoking: 'regularly',
        pets: 'love',
        sleep_time: 'before_10',
      },
    },
    'listings/room_koramangala': {
      ownerId: 'owner_b',
      status: 'active',
      title: '2 BHK Full flat in Koramangala',
      city: 'Bengaluru',
      locality: 'Koramangala',
      monthlyRent: 14000,
      partnerShare: 14000,
      deposit: 14000,
      roomType: 'Private room',
      preferredGender: 'Any',
      houseRules: ['Non-smoker', 'No parties'],
      screeningQuestions: ['Do you smoke or drink?', 'Do you have pets or plan to?'],
      isOwnerVerified: true,
    },
  };
}

test('Scenario A: Seeker Explore, Application Card, Owner Applicants & Owner Inbox resolve the exact same canonical score (never owner-vs-seeker)', async () => {
  const { store, gateway, appChat } = makeUnifiedHarness(bugReproductionFixture());

  const personVsPersonBuggy = calculateProfileCompatibility(
    store.get('users/owner_b'),
    store.get('users/seeker_a')
  ).score;

  // 1. Seeker reads Explore / Room Detail via gateway
  const placesRes = await gateway.read({ auth: { uid: 'seeker_a' }, data: { action: 'places' } });
  const placeRes = await gateway.read({ auth: { uid: 'seeker_a' }, data: { action: 'place', id: 'room_koramangala' } });
  const seekerExploreScore = placesRes.records[0].viewerCompatibility.score;
  const seekerDetailScore = placeRes.record.viewerCompatibility.score;

  const expectedCanonical = calculateCanonicalRoomCompatibility(
    store.get('users/seeker_a'),
    store.get('listings/room_koramangala'),
    store.get('users/owner_b')
  ).score;

  assert.equal(seekerExploreScore, expectedCanonical);
  assert.equal(seekerDetailScore, expectedCanonical);
  assert.notEqual(seekerExploreScore, personVsPersonBuggy);

  // 2. Seeker submits application -> application doc & chat application_card message
  const submitted = await appChat.submitRoomApplication({
    auth: { uid: 'seeker_a' },
    data: {
      listingId: 'room_koramangala',
      moveIn: 'Immediately',
      note: 'hi',
      answers: { 'Do you smoke or drink?': 'no', 'Do you have pets or plan to?': 'no' },
    },
  });

  const appDoc = store.get(`applications/${submitted.applicationId}`);
  const cardMsg = store.get(`chatRooms/${submitted.roomId}/messages/app_${submitted.applicationId}_card`);
  assert.equal(appDoc.matchScore, seekerExploreScore);
  assert.equal(appDoc.scoringVersion, COMPATIBILITY_ENGINE_VERSION);
  assert.equal(cardMsg.payload.matchScore, seekerExploreScore);

  // 3. Owner queries Applicants batch compatibility & single thread compatibility
  const ownerApplicants = await gateway.read({
    auth: { uid: 'owner_b' },
    data: { action: 'listingApplicantsCompatibility', listingId: 'room_koramangala' },
  });
  const ownerThreadCompat = await gateway.read({
    auth: { uid: 'owner_b' },
    data: { action: 'listingCompatibility', listingId: 'room_koramangala', applicantId: 'seeker_a' },
  });

  assert.equal(ownerApplicants.applicants.seeker_a.compatibility.score, seekerExploreScore);
  assert.equal(ownerThreadCompat.compatibility.score, seekerExploreScore);
  assert.equal(ownerApplicants.applicants.seeker_a.applicantSummary.budget, 35000);
});

test('Scenario B & C: Profile update and Listing update recalculate and synchronize scores across all surfaces', async () => {
  const { store, gateway, appChat } = makeUnifiedHarness(bugReproductionFixture());

  const submitted = await appChat.submitRoomApplication({
    auth: { uid: 'seeker_a' },
    data: {
      listingId: 'room_koramangala',
      answers: { 'Do you smoke or drink?': 'no', 'Do you have pets or plan to?': 'no' },
    },
  });
  const initialScore = store.get(`applications/${submitted.applicationId}`).matchScore;

  // Scenario B: Seeker drops budget below rent & moves to Hyderabad
  store.set('users/seeker_a', {
    ...store.get('users/seeker_a'),
    city: 'Hyderabad',
    localities: ['Gachibowli'],
    budget: 8000,
  });
  await appChat.syncCompatibilityForEntity({ userId: 'seeker_a' });

  const afterProfilePlace = await gateway.read({ auth: { uid: 'seeker_a' }, data: { action: 'place', id: 'room_koramangala' } });
  const afterProfileOwner = await gateway.read({ auth: { uid: 'owner_b' }, data: { action: 'listingApplicantsCompatibility', listingId: 'room_koramangala' } });
  const afterProfileApp = store.get(`applications/${submitted.applicationId}`);
  const afterProfileCard = store.get(`chatRooms/${submitted.roomId}/messages/app_${submitted.applicationId}_card`);

  const updatedScoreB = afterProfilePlace.record.viewerCompatibility.score;
  assert.notEqual(updatedScoreB, initialScore);
  assert.equal(afterProfileOwner.applicants.seeker_a.compatibility.score, updatedScoreB);
  assert.equal(afterProfileApp.matchScore, updatedScoreB);
  assert.equal(afterProfileCard.payload.matchScore, updatedScoreB);

  // Scenario C: Owner changes listing city to Hyderabad & lowers rent to 7500
  store.set('listings/room_koramangala', {
    ...store.get('listings/room_koramangala'),
    city: 'Hyderabad',
    locality: 'Gachibowli',
    monthlyRent: 7500,
    partnerShare: 7500,
  });
  await appChat.syncCompatibilityForEntity({ listingId: 'room_koramangala' });

  const afterListingPlace = await gateway.read({ auth: { uid: 'seeker_a' }, data: { action: 'place', id: 'room_koramangala' } });
  const afterListingOwner = await gateway.read({ auth: { uid: 'owner_b' }, data: { action: 'listingCompatibility', listingId: 'room_koramangala', applicantId: 'seeker_a' } });
  const afterListingCard = store.get(`chatRooms/${submitted.roomId}/messages/app_${submitted.applicationId}_card`);

  const updatedScoreC = afterListingPlace.record.viewerCompatibility.score;
  assert.ok(updatedScoreC > updatedScoreB);
  assert.equal(afterListingOwner.compatibility.score, updatedScoreC);
  assert.equal(afterListingCard.payload.matchScore, updatedScoreC);
  assert.equal(afterListingCard.payload.listingRent, 7500);
});

test('Scenario D & F: Multi-user / multi-listing isolation and lifecycle transitions preserve canonical scores', async () => {
  const { store, gateway, appChat } = makeUnifiedHarness({
    ...bugReproductionFixture(),
    'users/seeker_low': {
      name: 'Seeker Low',
      role: 'seeker',
      status: 'active',
      onboardingComplete: true,
      city: 'Delhi',
      budget: 5000,
      gender: 'Male',
      quizAnswers: { smoking: 'regularly' },
    },
    'listings/room_whitefield': {
      ownerId: 'owner_b',
      status: 'active',
      title: 'Luxury Whitefield Studio',
      city: 'Bengaluru',
      locality: 'Whitefield',
      monthlyRent: 45000,
      partnerShare: 45000,
      roomType: 'Studio',
      preferredGender: 'Female',
      houseRules: ['Veg only kitchen', 'No pets'],
      screeningQuestions: [],
      isOwnerVerified: true,
    },
  });

  const appA1 = await appChat.submitRoomApplication({
    auth: { uid: 'seeker_a' },
    data: { listingId: 'room_koramangala', answers: { 'Do you smoke or drink?': 'no', 'Do you have pets or plan to?': 'no' } },
  });
  await appChat.submitRoomApplication({
    auth: { uid: 'seeker_a' },
    data: { listingId: 'room_whitefield', answers: {} },
  });
  await appChat.submitRoomApplication({
    auth: { uid: 'seeker_low' },
    data: { listingId: 'room_koramangala', answers: { 'Do you smoke or drink?': 'yes', 'Do you have pets or plan to?': 'no' } },
  });

  const compatKoramangala = await gateway.read({ auth: { uid: 'owner_b' }, data: { action: 'listingApplicantsCompatibility', listingId: 'room_koramangala' } });
  const compatWhitefield = await gateway.read({ auth: { uid: 'owner_b' }, data: { action: 'listingApplicantsCompatibility', listingId: 'room_whitefield' } });

  const scoreA_K = compatKoramangala.applicants.seeker_a.compatibility.score;
  const scoreLow_K = compatKoramangala.applicants.seeker_low.compatibility.score;
  const scoreA_W = compatWhitefield.applicants.seeker_a.compatibility.score;

  assert.ok(scoreA_K > scoreLow_K);
  assert.notEqual(scoreA_K, scoreA_W);

  // Lifecycle: pending -> shortlisted -> selected -> rejected preserves canonical score
  for (const decision of ['shortlisted', 'selected', 'rejected']) {
    await appChat.decideRoomApplication({
      auth: { uid: 'owner_b' },
      data: { applicationId: appA1.applicationId, nextStatus: decision },
    });
    assert.equal(store.get(`applications/${appA1.applicationId}`).matchScore, scoreA_K);
    assert.equal(store.get(`chatRooms/${appA1.roomId}/messages/app_${appA1.applicationId}_card`).payload.matchScore, scoreA_K);
  }
});

test('Scenario E & G: Missing/incomplete data safety and security/privacy isolation', async () => {
  const { gateway, appChat } = makeUnifiedHarness({
    ...bugReproductionFixture(),
    'users/uncalibrated': {
      name: 'Newbie',
      status: 'active',
      onboardingComplete: false,
    },
    'users/intruder': {
      name: 'Intruder',
      status: 'active',
      onboardingComplete: true,
      city: 'Bengaluru',
      budget: 20000,
    },
  });

  // Incomplete / invalid data never returns NaN, undefined, or out-of-range
  const emptyCompat = calculateCanonicalRoomCompatibility({}, {}, {});
  assert.equal(emptyCompat.score, 0);
  assert.equal(emptyCompat.calibrated, false);
  const nanCompat = calculateCanonicalRoomCompatibility({ budget: NaN, onboardingComplete: true }, { partnerShare: -100 });
  assert.equal(Number.isFinite(nanCompat.score), true);
  assert.ok(nanCompat.score >= 0 && nanCompat.score <= 100);

  // Submit application by seeker_a
  await appChat.submitRoomApplication({
    auth: { uid: 'seeker_a' },
    data: { listingId: 'room_koramangala', answers: { 'Do you smoke or drink?': 'no', 'Do you have pets or plan to?': 'no' } },
  });

  // Intruder cannot read Seeker A's compatibility or owner batch endpoint
  await assert.rejects(
    gateway.read({ auth: { uid: 'intruder' }, data: { action: 'listingCompatibility', listingId: 'room_koramangala', applicantId: 'seeker_a' } }),
    { code: 'permission-denied' }
  );
  await assert.rejects(
    gateway.read({ auth: { uid: 'intruder' }, data: { action: 'listingApplicantsCompatibility', listingId: 'room_koramangala' } }),
    { code: 'permission-denied' }
  );

  // Gateway responses never leak raw quizAnswers
  const placeView = await gateway.read({ auth: { uid: 'seeker_a' }, data: { action: 'place', id: 'room_koramangala' } });
  const ownerBatch = await gateway.read({ auth: { uid: 'owner_b' }, data: { action: 'listingApplicantsCompatibility', listingId: 'room_koramangala' } });
  assert.equal(Object.hasOwn(placeView.record, 'quizAnswers'), false);
  assert.equal(Object.hasOwn(placeView.record, 'ownerQuizAnswers'), false);
  assert.equal(Object.hasOwn(ownerBatch.applicants.seeker_a.applicantSummary, 'quizAnswers'), false);
});

test('Person discovery & single person lookup return canonical room compatibility for BOTH Room Seeking and Room Listing users', async () => {
  const fixture = bugReproductionFixture();
  // Remove explicit roles so ownership is inferred purely from listing.ownerId (mirroring real Firestore docs)
  delete fixture['users/seeker_a'].role;
  delete fixture['users/owner_b'].role;
  fixture['users/seeker_a'].roommateDiscoveryEnabled = true;
  fixture['users/owner_b'].roommateDiscoveryEnabled = true;
  fixture['users/seeker_a'].housingPreferences = { activeIntents: ['find_room', 'team_up'] };
  fixture['users/owner_b'].housingPreferences = { activeIntents: ['have_room', 'team_up'] };

  const { store, gateway } = makeUnifiedHarness(fixture);
  const canonicalScore = calculateCanonicalRoomCompatibility(
    store.get('users/seeker_a'),
    store.get('listings/room_koramangala'),
    store.get('users/owner_b')
  ).score;

  // Room Seeker viewing Room Owner (both 'people' and 'person')
  const seekerPeople = await gateway.read({ auth: { uid: 'seeker_a' }, data: { action: 'people' } });
  const seekerPersonOwner = await gateway.read({ auth: { uid: 'seeker_a' }, data: { action: 'person', id: 'owner_b' } });
  assert.equal(seekerPeople.records.find(r => r.uid === 'owner_b')?.compatibilityScore, canonicalScore);
  assert.equal(seekerPersonOwner.record.compatibilityScore, canonicalScore);

  // Room Owner viewing Room Seeker (both 'people' and 'person')
  const ownerPeople = await gateway.read({ auth: { uid: 'owner_b' }, data: { action: 'people' } });
  const ownerPersonSeeker = await gateway.read({ auth: { uid: 'owner_b' }, data: { action: 'person', id: 'seeker_a' } });
  assert.equal(ownerPeople.records.find(r => r.uid === 'seeker_a')?.compatibilityScore, canonicalScore);
  assert.equal(ownerPersonSeeker.record.compatibilityScore, canonicalScore);
});

test('Direct listing inquiry chat (no formal application) resolves exact canonical score for BOTH Seeker and Owner', async () => {
  const fixture = bugReproductionFixture();
  fixture['chatRooms/owner_b___seeker_a'] = {
    participants: ['owner_b', 'seeker_a'],
    listingId: 'room_koramangala',
    listingContexts: ['room_koramangala'],
    lastMessage: 'Is it still available?',
  };
  const { store, gateway } = makeUnifiedHarness(fixture);
  const canonicalScore = calculateCanonicalRoomCompatibility(
    store.get('users/seeker_a'),
    store.get('listings/room_koramangala'),
    store.get('users/owner_b')
  ).score;

  // Owner opens inquiry chat using peerId (even when applicantId/ownerId are absent on legacy inquiry chatRoom)
  const ownerRes = await gateway.read({
    auth: { uid: 'owner_b' },
    data: { action: 'listingCompatibility', listingId: 'room_koramangala', peerId: 'seeker_a' },
  });
  // Seeker opens same inquiry chat / listing
  const seekerRes = await gateway.read({
    auth: { uid: 'seeker_a' },
    data: { action: 'listingCompatibility', listingId: 'room_koramangala' },
  });
  assert.equal(ownerRes.compatibility.score, canonicalScore);
  assert.equal(seekerRes.compatibility.score, canonicalScore);

  // Unrelated member still denied
  await assert.rejects(
    gateway.read({
      auth: { uid: 'owner_b' },
      data: { action: 'listingCompatibility', listingId: 'room_koramangala', applicantId: 'random_stranger' },
    }),
    { code: 'permission-denied' }
  );
});
