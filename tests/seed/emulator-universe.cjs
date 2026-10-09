#!/usr/bin/env node
/* eslint-disable no-console */
const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { PERSONAS, BY_KEY: P, IDS } = require('../data/emulator-universe.cjs');

const PROJECT_ID = 'demo-nestmate';
const SCENARIO_CLOCK_ISO = '2026-10-01T06:00:00.000Z';
const command = process.argv[2] || 'seed';

function failClosed() {
  const required = ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST'];
  for (const name of required) {
    const value = process.env[name];
    if (!value || !/^(127\.0\.0\.1|localhost):\d+$/.test(value)) {
      throw new Error(`${name} must explicitly target a localhost emulator; received ${value || '<unset>'}`);
    }
  }
  const actualProject = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (actualProject !== PROJECT_ID) {
    throw new Error(`Refusing to run for project ${actualProject || '<unset>'}; only ${PROJECT_ID} is allowed.`);
  }
}

function emulatorUrl(hostName, path) {
  return `http://${process.env[hostName]}${path}`;
}

async function reset() {
  const authResponse = await fetch(emulatorUrl('FIREBASE_AUTH_EMULATOR_HOST', `/emulator/v1/projects/${PROJECT_ID}/accounts`), { method: 'DELETE' });
  if (!authResponse.ok) throw new Error(`Auth emulator reset failed: ${authResponse.status} ${await authResponse.text()}`);
  const firestoreResponse = await fetch(emulatorUrl('FIRESTORE_EMULATOR_HOST', `/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`), { method: 'DELETE' });
  if (!firestoreResponse.ok) throw new Error(`Firestore emulator reset failed: ${firestoreResponse.status} ${await firestoreResponse.text()}`);
  console.log('RESET_OK auth=purged firestore=purged');
}

const sameQuiz = {
  sleep_time: '10_to_12', wake_time: '6_to_8', food_pref: 'veg', smoking: 'never',
  drinking: 'socially', guests: 'sometimes', cleanliness: 'very', work_mode: 'hybrid',
  pets: 'ok', roommate_gender: 'any',
};
const weakQuiz = {
  sleep_time: 'after_12', wake_time: '10_to_12', food_pref: 'non_veg', smoking: 'regularly',
  drinking: 'regularly', guests: 'often', cleanliness: 'relaxed', work_mode: 'wfh',
  pets: 'no', roommate_gender: 'any',
};

function profile(persona, now, createdAt) {
  const quizAnswers = persona.key === 'SEEKER_WEAK' ? weakQuiz : sameQuiz;
  const complete = persona.key !== 'ONBOARDING_INCOMPLETE';
  return {
    name: persona.name,
    role: persona.role,
    status: persona.status,
    city: persona.city,
    localities: persona.city === 'Chennai' ? ['Adyar'] : ['Koramangala', 'Indiranagar'],
    budget: 18000,
    gender: persona.role === 'owner' ? 'male' : 'female',
    age: 27,
    profession: persona.role === 'owner' ? 'Property Manager' : 'Software Engineer',
    company: 'NestMate QA',
    bio: complete ? `Deterministic QA profile for ${persona.key}.` : '',
    avatar: '',
    housingIntent: persona.role === 'owner' ? 'offer_room' : 'find_room',
    moveInDate: 'Within 2 weeks',
    onboardingComplete: complete,
    isVerified: persona.verified,
    phoneVerified: persona.verified,
    verificationLevel: persona.verified ? 3 : 0,
    isPremium: persona.premium,
    connectsUsed: persona.key === 'QUOTA_EXHAUSTED' || persona.key === 'PREMIUM_USER' ? 5 : 0,
    connectsLimit: 5,
    savedProfileIds: persona.key === 'SEEKER_A' ? [P.SEEKER_B.uid] : [],
    savedRoomIds: persona.key === 'SEEKER_A' ? [IDS.LISTING_ACTIVE] : [],
    ...(complete ? { quizAnswers } : {}),
    createdAt,
    updatedAt: now,
    lastActiveAt: now,
  };
}

function listing(id, owner, status, ownerVerified, lastConfirmedAt, overrides = {}) {
  return {
    ownerId: owner.uid,
    ownerName: owner.name,
    ownerAvatar: '',
    title: `${owner.name || owner.key} QA room`,
    description: `Deterministic ${id} listing used by the NestMate browser audit.`,
    flatType: '2 BHK',
    furnishing: 'Fully Furnished',
    city: 'Bengaluru',
    locality: 'Koramangala',
    address: '80 Feet Road, Koramangala, Bengaluru',
    totalRent: 26000,
    monthlyRent: 13000,
    partnerShare: 13000,
    partnersNeeded: 1,
    deposit: 50000,
    amenities: ['WiFi', 'Power Backup', 'Washing Machine'],
    houseRules: ['No smoking indoors'],
    screeningQuestions: [{
      id: 'qa_move_in_window',
      type: 'SINGLE_CHOICE',
      title: 'What is your preferred move-in window?',
      category: 'schedule',
      options: ['Within 2 weeks', 'Within a month'],
      required: true,
    }],
    images: ['https://placehold.co/1200x800/png?text=NestMate+QA+Room'],
    availableFrom: '2026-10-15',
    lat: 12.9352,
    lng: 77.6245,
    status,
    applicants: 0,
    views: 12,
    lastConfirmedAt,
    ownerVerified,
    preferredGender: 'any',
    genderPreference: 'any',
    state: 'Karnataka',
    createdAt: lastConfirmedAt,
    updatedAt: lastConfirmedAt,
    ...overrides,
  };
}

async function seed() {
  await reset();
  const app = getApps()[0];
  const auth = getAuth(app);
  const db = getFirestore(app);
  const clock = Timestamp.fromDate(new Date(SCENARIO_CLOCK_ISO));
  const daysAgo = days => Timestamp.fromMillis(clock.toMillis() - days * 86_400_000);

  for (const persona of PERSONAS) {
    await auth.createUser({
      uid: persona.uid, email: persona.email, password: persona.password,
      emailVerified: true, displayName: persona.name || persona.key,
    });
  }

  const docs = new Map();
  const put = (path, data) => docs.set(path, data);
  put('qaMetadata/universe', { projectId: PROJECT_ID, scenarioClock: clock, schemaVersion: 1, personaCount: PERSONAS.length });
  for (const persona of PERSONAS) {
    put(`users/${persona.uid}`, profile(persona, clock, daysAgo(90)));
    put(`privateUserData/${persona.uid}`, { email: persona.email, phone: '+919900000001', workEmail: persona.email, updatedAt: clock });
    put(`userContacts/${persona.uid}`, { whatsappNumber: '+919900000001', updatedAt: clock });
  }
  put(`admins/${P.ADMIN.email}`, { uid: P.ADMIN.uid, email: P.ADMIN.email, role: 'admin', addedAt: clock });

  put(`listings/${IDS.LISTING_DRAFT}`, listing(IDS.LISTING_DRAFT, P.OWNER_PENDING, 'draft', false, clock));
  put(`listings/${IDS.LISTING_PENDING}`, listing(IDS.LISTING_PENDING, P.OWNER_PENDING, 'pending_verification', false, clock));
  put(`listings/${IDS.LISTING_ACTIVE}`, listing(IDS.LISTING_ACTIVE, P.OWNER_A, 'active', true, clock, { title: 'Sunny room in Koramangala' }));
  put(`listings/${IDS.LISTING_OWNER_B}`, listing(IDS.LISTING_OWNER_B, P.OWNER_B, 'active', true, clock, { locality: 'Indiranagar', monthlyRent: 17000, partnerShare: 17000 }));
  put(`listings/${IDS.LISTING_PAUSED}`, listing(IDS.LISTING_PAUSED, P.OWNER_A, 'paused', true, clock));
  put(`listings/${IDS.LISTING_FILLED}`, listing(IDS.LISTING_FILLED, P.OWNER_A, 'filled', true, clock));
  put(`listings/${IDS.LISTING_CLOSED}`, listing(IDS.LISTING_CLOSED, P.OWNER_A, 'closed', true, clock));
  put(`listings/${IDS.LISTING_STALE}`, listing(IDS.LISTING_STALE, P.OWNER_A, 'active', true, daysAgo(15)));
  put(`listings/${IDS.LISTING_EXPIRED}`, listing(IDS.LISTING_EXPIRED, P.OWNER_A, 'active', true, daysAgo(46)));

  const connections = [
    [IDS.CONNECTION_PENDING, P.SEEKER_A.uid, P.OWNER_A.uid, 'pending', IDS.LISTING_ACTIVE],
    [IDS.CONNECTION_ACCEPTED, P.SEEKER_B.uid, P.OWNER_A.uid, 'accepted', IDS.LISTING_ACTIVE],
    [IDS.CONNECTION_REJECTED, P.SEEKER_WEAK.uid, P.OWNER_A.uid, 'rejected', IDS.LISTING_ACTIVE],
    [IDS.CONNECTION_BLOCKED, P.SUSPENDED_USER.uid, P.OWNER_A.uid, 'blocked', IDS.LISTING_ACTIVE],
    [IDS.CONNECTION_OWNER_B, P.SEEKER_A.uid, P.OWNER_B.uid, 'accepted', IDS.LISTING_OWNER_B],
    [IDS.CONNECTION_EMPTY_CHAT, P.PREMIUM_USER.uid, P.OWNER_B.uid, 'accepted', IDS.LISTING_OWNER_B],
    [IDS.CONNECTION_DELETE, P.DISPOSABLE_USER.uid, P.OWNER_A.uid, 'accepted', IDS.LISTING_ACTIVE],
  ];
  for (const [id, fromUserId, toUserId, status, listingId] of connections) {
    put(`connections/${id}`, { fromUserId, toUserId, status, listingId, screeningAnswers: { moveIn: 'Within 2 weeks' }, createdAt: clock, updatedAt: clock });
    if (status === 'accepted') {
      put(`acceptedPairs/${fromUserId}_${toUserId}`, { user1: fromUserId, user2: toUserId, connectionId: id, createdAt: clock });
      put(`acceptedPairs/${toUserId}_${fromUserId}`, { user1: toUserId, user2: fromUserId, connectionId: id, createdAt: clock });
    }
  }

  put(`chatRooms/${IDS.CHAT_EXISTING}`, { participants: [P.SEEKER_B.uid, P.OWNER_A.uid], matchId: IDS.CONNECTION_ACCEPTED, lastMessage: 'See you at 5 PM.', lastMessageAt: clock, createdAt: daysAgo(2), typingStatus: {} });
  put(`chatRooms/${IDS.CHAT_EMPTY}`, { participants: [P.PREMIUM_USER.uid, P.OWNER_B.uid], matchId: IDS.CONNECTION_EMPTY_CHAT, lastMessage: '', lastMessageAt: null, createdAt: clock, typingStatus: {} });
  put(`chatRooms/${IDS.CHAT_DELETE}`, { participants: [P.DISPOSABLE_USER.uid, P.OWNER_A.uid], matchId: IDS.CONNECTION_DELETE, lastMessage: 'Disposable fixture', lastMessageAt: clock, createdAt: clock, typingStatus: {} });
  const messages = [
    ['qa_msg_01', P.SEEKER_B.uid, 'Hello, is the room available?', true, daysAgo(2)],
    ['qa_msg_02', P.OWNER_A.uid, 'Yes, would you like a visit?', true, daysAgo(1)],
    ['qa_msg_read', P.SEEKER_B.uid, 'Tomorrow evening works.', true, Timestamp.fromMillis(clock.toMillis() - 60_000)],
    ['qa_msg_unread', P.OWNER_A.uid, 'See you at 5 PM.', false, clock],
  ];
  for (const [id, senderId, content, read, createdAt] of messages) put(`chatRooms/${IDS.CHAT_EXISTING}/messages/${id}`, { senderId, content, read, createdAt });
  put(`chatRooms/${IDS.CHAT_DELETE}/messages/qa_msg_delete`, { senderId: P.DISPOSABLE_USER.uid, content: 'Delete me', read: false, createdAt: clock });

  const notifications = [
    ['qa_notif_connect', P.OWNER_A.uid, P.SEEKER_A.uid, 'connect', false, 'New interest', 'Aditi is interested in your room.', '/owner-dashboard?tab=applicants', IDS.CONNECTION_PENDING],
    ['qa_notif_message', P.SEEKER_B.uid, P.OWNER_A.uid, 'message', false, 'New message', 'You have a new message.', `/chat/${IDS.CHAT_EXISTING}`, IDS.CONNECTION_ACCEPTED],
    ['qa_notif_verification', P.OWNER_PENDING.uid, P.ADMIN.uid, 'verification', true, 'Verification received', 'Your documents are under review.', '/owner-dashboard?tab=listings', null],
    ['qa_notif_system', P.SEEKER_A.uid, P.ADMIN.uid, 'system', true, 'Safety reminder', 'Keep communication in NestMate until trust is established.', '/safety', null],
    ['qa_notif_delete', P.DISPOSABLE_USER.uid, P.ADMIN.uid, 'system', false, 'Disposable', 'Delete-account fixture.', '/settings', null],
  ];
  for (const [id, userId, actorId, type, read, title, description, actionUrl, connectionId] of notifications) {
    put(`notifications/${id}`, { userId, actorId, type, read, title, description, actionUrl, ...(connectionId ? { connectionId } : {}), createdAt: clock });
  }

  put(`reports/qa_report_pending`, { reporterId: P.SEEKER_A.uid, targetId: P.SUSPENDED_USER.uid, reason: 'harassment', description: 'Deterministic pending moderation report.', status: 'pending', createdAt: clock });
  put(`reports/qa_report_resolved`, { reporterId: P.SEEKER_B.uid, targetId: P.BANNED_USER.uid, reason: 'scam', description: 'Resolved deterministic report.', status: 'resolved', resolutionNote: 'Evidence reviewed.', resolvedBy: P.ADMIN.uid, resolvedAt: clock, createdAt: daysAgo(2) });
  put(`reports/qa_report_dismissed`, { reporterId: P.OWNER_A.uid, targetId: P.SEEKER_WEAK.uid, reason: 'other', description: 'Dismissed deterministic report.', status: 'dismissed', resolutionNote: 'No policy breach.', resolvedBy: P.ADMIN.uid, resolvedAt: clock, createdAt: daysAgo(1) });
  put(`reports/qa_report_delete`, { reporterId: P.DISPOSABLE_USER.uid, targetId: P.OWNER_A.uid, reason: 'other', description: 'Disposable report.', status: 'pending', createdAt: clock });

  const verification = (owner, status, extra = {}) => ({ userId: owner.uid, ownerId: owner.uid, status, documentType: 'aadhaar', documentUrl: 'https://placehold.co/800x500/png?text=QA+Document', submittedAt: daysAgo(2), updatedAt: clock, history: [{ status, timestamp: SCENARIO_CLOCK_ISO, actorId: owner.uid }], ...extra });
  put(`ownerVerifications/${P.OWNER_A.uid}`, verification(P.OWNER_A, 'APPROVED', { reviewedBy: P.ADMIN.uid, reviewedAt: clock }));
  put(`ownerVerifications/${P.OWNER_PENDING.uid}`, verification(P.OWNER_PENDING, 'SUBMITTED'));
  put(`ownerVerifications/${P.OWNER_REJECTED.uid}`, verification(P.OWNER_REJECTED, 'REJECTED', { reviewNote: 'Document image is unreadable.', reviewedBy: P.ADMIN.uid, reviewedAt: clock }));
  put(`ownerVerifications/${P.OWNER_RESUBMIT.uid}`, verification(P.OWNER_RESUBMIT, 'RESUBMISSION_REQUIRED', { reviewNote: 'Upload the reverse side.', resubmissionCount: 1, reviewedBy: P.ADMIN.uid, reviewedAt: clock }));

  put('broadcasts/qa_broadcast_01', { title: 'Welcome to the QA universe', description: 'Deterministic broadcast history record.', sentBy: P.ADMIN.uid, recipientCount: PERSONAS.length, createdAt: clock });
  put('analytics/qa_event_view', { type: 'listing_view', actorId: P.SEEKER_A.uid, entityId: IDS.LISTING_ACTIVE, createdAt: daysAgo(1) });
  put('analytics/qa_event_connect', { type: 'connect_sent', actorId: P.SEEKER_A.uid, entityId: IDS.CONNECTION_PENDING, createdAt: clock });
  put('reviews/qa_review_delete', { authorId: P.DISPOSABLE_USER.uid, targetId: P.OWNER_A.uid, rating: 4, description: 'Disposable review.', createdAt: clock });

  let batch = db.batch();
  let count = 0;
  for (const [path, data] of docs) {
    batch.set(db.doc(path), data);
    count += 1;
    if (count % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();

  const bucket = getStorage(app).bucket(`${PROJECT_ID}.appspot.com`);
  await bucket.file(`profiles/${P.DISPOSABLE_USER.uid}/qa-delete-fixture.txt`).save('emulator-only fixture', { contentType: 'text/plain' });
  console.log(`SEED_OK personas=${PERSONAS.length} firestoreDocuments=${docs.size} scenarioClock=${SCENARIO_CLOCK_ISO}`);
}

async function verify() {
  const app = getApps()[0];
  const auth = getAuth(app);
  const db = getFirestore(app);
  const errors = [];
  const authResult = await auth.listUsers(1000);
  const authByUid = new Map(authResult.users.map(user => [user.uid, user]));
  for (const persona of PERSONAS) {
    if (!authByUid.has(persona.uid)) errors.push(`missing Auth user ${persona.uid}`);
    const [publicSnap, privateSnap] = await Promise.all([db.doc(`users/${persona.uid}`).get(), db.doc(`privateUserData/${persona.uid}`).get()]);
    if (!publicSnap.exists) errors.push(`missing users/${persona.uid}`);
    if (!privateSnap.exists) errors.push(`missing privateUserData/${persona.uid}`);
    if (publicSnap.exists && (publicSnap.get('email') || publicSnap.get('phone'))) errors.push(`public PII leak in users/${persona.uid}`);
    if (privateSnap.exists && privateSnap.get('email') !== persona.email) errors.push(`private email mismatch for ${persona.uid}`);
  }
  if (authResult.users.length !== PERSONAS.length) errors.push(`Auth account count ${authResult.users.length} != ${PERSONAS.length}`);

  const userIds = new Set(PERSONAS.map(p => p.uid));
  const listings = await db.collection('listings').get();
  const requiredListingFields = ['ownerId', 'title', 'description', 'city', 'locality', 'totalRent', 'partnerShare', 'deposit', 'amenities', 'images', 'status', 'createdAt', 'updatedAt'];
  for (const doc of listings.docs) {
    const data = doc.data();
    if (!userIds.has(data.ownerId)) errors.push(`orphan listing ${doc.id}`);
    for (const field of requiredListingFields) if (data[field] === undefined) errors.push(`listing ${doc.id} missing ${field}`);
    if (data.status === 'active' && data.ownerVerified !== true) errors.push(`active unverified listing ${doc.id}`);
  }
  const expired = await db.doc(`listings/${IDS.LISTING_EXPIRED}`).get();
  const metadata = await db.doc('qaMetadata/universe').get();
  if (!metadata.exists) errors.push('missing qaMetadata/universe');
  else if (metadata.get('scenarioClock').toMillis() - expired.get('lastConfirmedAt').toMillis() !== 46 * 86_400_000) errors.push('expired listing is not exactly 46 days old');

  const connections = await db.collection('connections').where('status', '==', 'accepted').get();
  for (const connection of connections.docs) {
    const data = connection.data();
    for (const pairId of [`${data.fromUserId}_${data.toUserId}`, `${data.toUserId}_${data.fromUserId}`]) {
      const pair = await db.doc(`acceptedPairs/${pairId}`).get();
      if (!pair.exists || pair.get('connectionId') !== connection.id) errors.push(`missing/mismatched accepted pair ${pairId}`);
    }
  }
  const rooms = await db.collection('chatRooms').get();
  for (const room of rooms.docs) {
    const participants = room.get('participants') || [];
    if (participants.length !== 2 || new Set(participants).size !== 2) errors.push(`invalid participants in chat ${room.id}`);
    const messageSnap = await room.ref.collection('messages').get();
    for (const message of messageSnap.docs) if (!participants.includes(message.get('senderId'))) errors.push(`message ${room.id}/${message.id} sender is not a participant`);
  }
  const notifications = await db.collection('notifications').get();
  for (const notification of notifications.docs) {
    const data = notification.data();
    if (!data.userId || !data.actorId || !data.type || !data.title || !data.description || !data.actionUrl || typeof data.read !== 'boolean') errors.push(`invalid notification ${notification.id}`);
    if ('message' in data || 'link' in data) errors.push(`legacy notification fields in ${notification.id}`);
  }
  const reports = await db.collection('reports').get();
  for (const report of reports.docs) if (!['pending', 'resolved', 'dismissed'].includes(report.get('status'))) errors.push(`invalid report state ${report.id}`);
  for (const owner of [P.OWNER_A, P.OWNER_PENDING, P.OWNER_REJECTED, P.OWNER_RESUBMIT]) {
    const verification = await db.doc(`ownerVerifications/${owner.uid}`).get();
    if (!verification.exists || verification.get('userId') !== owner.uid) errors.push(`invalid owner verification key ${owner.uid}`);
  }
  const admin = await db.doc(`admins/${P.ADMIN.email}`).get();
  if (!admin.exists || admin.get('uid') !== P.ADMIN.uid) errors.push('admin registry mismatch');

  if (errors.length) throw new Error(`VERIFY_FAILED (${errors.length})\n- ${errors.join('\n- ')}`);
  console.log(`VERIFY_OK authUsers=${authResult.users.length} listings=${listings.size} acceptedConnections=${connections.size} chatRooms=${rooms.size} notifications=${notifications.size} reports=${reports.size}`);
}

async function main() {
  failClosed();
  const app = initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` });
  try {
    if (command === 'reset') await reset();
    else if (command === 'seed') await seed();
    else if (command === 'verify') await verify();
    else if (command === 'reset-seed-verify') { await seed(); await verify(); }
    else throw new Error(`Unknown command ${command}`);
  } finally {
    await deleteApp(app);
  }
}

if (require.main === module) {
  main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
}

module.exports = { failClosed, reset, seed, verify, main, PROJECT_ID, SCENARIO_CLOCK_ISO };
