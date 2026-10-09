const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { HttpsError, onCall } = require('firebase-functions/v2/https');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
initializeApp({
  projectId,
  storageBucket: projectId ? `${projectId}.appspot.com` : undefined,
});

const RECENT_LOGIN_SECONDS = 15 * 60;

async function collectByField(db, collectionName, field, value, targets) {
  const snapshot = await db.collection(collectionName).where(field, '==', value).get();
  for (const document of snapshot.docs) targets.set(document.ref.path, document.ref);
}

async function collectAccountDocuments(db, uid, email) {
  const targets = new Map();
  const add = ref => targets.set(ref.path, ref);

  const relationships = [
    ['listings', 'ownerId'],
    ['connections', 'fromUserId'], ['connections', 'toUserId'],
    ['acceptedPairs', 'user1'], ['acceptedPairs', 'user2'],
    ['notifications', 'userId'], ['notifications', 'actorId'],
    ['listingViews', 'ownerId'],
    ['ratings', 'userId'], ['ratings', 'targetUserId'], ['ratings', 'raterId'], ['ratings', 'ratedUserId'],
    ['matches', 'userId'], ['matches', 'matchedUserId'],
    ['reviews', 'reviewerId'], ['reviews', 'targetUserId'], ['reviews', 'authorId'], ['reviews', 'targetId'],
    ['skippedUsers', 'userId'], ['skippedUsers', 'skippedUserId'],
    ['agreementOTPs', 'userId'], ['agreementOTPs', 'landlordId'], ['agreementOTPs', 'tenantId'],
    ['agreements', 'landlordId'], ['agreements', 'tenantId'],
    ['verifications', 'userId'],
    ['ownerVerifications', 'userId'], ['ownerVerifications', 'ownerId'],
    ['reports', 'reporterId'], ['reports', 'targetId'],
    ['supportTickets', 'userId'],
    ['analyticsEvents', 'actorId'], ['analytics', 'actorId'],
    ['broadcasts', 'sentBy'],
  ];

  await Promise.all(relationships.map(([collectionName, field]) =>
    collectByField(db, collectionName, field, uid, targets)
  ));

  const rooms = await db.collection('chatRooms').where('participants', 'array-contains', uid).get();
  const roomIds = rooms.docs.map(room => room.id);
  for (const room of rooms.docs) add(room.ref);

  const listingIds = [...targets.values()]
    .filter(ref => ref.parent.id === 'listings')
    .map(ref => ref.id);

  add(db.doc(`users/${uid}`));
  add(db.doc(`privateUserData/${uid}`));
  add(db.doc(`userContacts/${uid}`));
  add(db.doc(`ownerVerifications/${uid}`));
  if (email) add(db.doc(`admins/${email.toLowerCase()}`));

  return { targets, roomIds, listingIds };
}

async function deleteStoragePrefixes(uid, roomIds, listingIds) {
  const bucket = getStorage().bucket();
  const prefixes = [
    `profiles/${uid}/`,
    `verificationDocs/${uid}/`,
    ...roomIds.map(id => `chats/${id}/`),
    ...listingIds.map(id => `listings/${id}/`),
  ];
  await Promise.all(prefixes.map(prefix => bucket.deleteFiles({ prefix, force: true })));
}

exports.requestAccountDeletion = onCall({ region: 'us-central1' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before deleting your account.');
  if (request.data?.confirmation !== 'DELETE') {
    throw new HttpsError('invalid-argument', 'Type DELETE to confirm permanent account deletion.');
  }

  const authTime = Number(request.auth.token.auth_time || 0);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!authTime || nowSeconds - authTime > RECENT_LOGIN_SECONDS) {
    throw new HttpsError('failed-precondition', 'Please sign out and sign in again before deleting your account.');
  }

  const uid = request.auth.uid;
  const email = typeof request.auth.token.email === 'string' ? request.auth.token.email : '';
  const db = getFirestore();

  try {
    const { targets, roomIds, listingIds } = await collectAccountDocuments(db, uid, email);

    // Storage is removed first. Firestore and Auth remain available for a safe retry
    // if a transient file deletion error occurs.
    await deleteStoragePrefixes(uid, roomIds, listingIds);

    // recursiveDelete also removes nested message documents from chat rooms.
    await Promise.all([...targets.values()].map(ref => db.recursiveDelete(ref)));

    // Delete the identity last so any prior failure remains retryable by the user.
    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      // A caller may retry with its still-valid ID token after the first call
      // completed but its response was lost. That state is already erased.
      if (error?.code !== 'auth/user-not-found') throw error;
    }
    return { deleted: true };
  } catch (error) {
    console.error('Account deletion failed', { uid, error });
    throw new HttpsError('internal', 'Account deletion could not be completed. Please retry.');
  }
});
