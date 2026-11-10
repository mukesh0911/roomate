const { randomUUID, createHash } = require('node:crypto');

const POLICY_VERSION = 'keep-shared-history-remove-account-identity-v1';
const OWNED_FIELDS = [
  ['listings', 'ownerId'],
  ['connections', 'fromUserId'], ['connections', 'toUserId'],
  ['acceptedPairs', 'user1'], ['acceptedPairs', 'user2'],
  ['listingPairs', 'user1'], ['listingPairs', 'user2'],
  ['applications', 'applicantId'], ['applications', 'ownerId'],
  ['applicationLocks', 'applicantId'],
  ['notifications', 'userId'], ['notifications', 'actorId'],
  ['listingViews', 'ownerId'],
  ['ratings', 'userId'], ['ratings', 'targetUserId'], ['ratings', 'raterId'], ['ratings', 'ratedUserId'],
  ['reviews', 'reviewerId'], ['reviews', 'targetUserId'], ['reviews', 'authorId'], ['reviews', 'targetId'],
  ['matches', 'userId'], ['matches', 'matchedUserId'],
  ['skippedUsers', 'userId'], ['skippedUsers', 'skippedUserId'],
  ['agreementOTPs', 'userId'], ['agreementOTPs', 'landlordId'], ['agreementOTPs', 'tenantId'],
  ['agreements', 'landlordId'], ['agreements', 'tenantId'],
  ['verifications', 'userId'], ['ownerVerifications', 'userId'], ['ownerVerifications', 'ownerId'],
  ['reports', 'reporterId'], ['reports', 'reportedBy'], ['reports', 'targetId'],
  ['supportTickets', 'userId'], ['analyticsEvents', 'actorId'], ['analytics', 'actorId'],
  ['broadcasts', 'sentBy'],
];
const PRIVATE_ROOTS = ['accountExports', 'publicProfiles', 'privateUserData', 'userContacts', 'verifications', 'ownerVerifications'];
const keyFor = value => createHash('sha256').update(value).digest('hex');

/** Shared message content and attachments are retained under the founder's D17
 * decision. Stable opaque IDs remain history references; account identity and
 * metadata are removed. This is not a claim of semantic redaction of content
 * that someone deliberately shared in a message. */
function messageIdentityUpdate(message, uid, fieldValue) {
  if (message.senderId !== uid) return null;
  const update = { senderName: 'Deleted member', senderAvatar: '', deletedSender: true };
  for (const field of ['senderEmail', 'senderPhone', 'senderPhotoURL', 'senderDisplayName']) {
    if (Object.prototype.hasOwnProperty.call(message, field)) update[field] = fieldValue.delete();
  }
  return update;
}

function ownedStoragePrefixes(uid, listingIds) {
  // Never include chats/{roomId}: those files are shared retained content.
  return [`accountExports/${uid}/`, `profiles/${uid}/`, `verificationDocs/${uid}/`, `verifications/${uid}/`,
    ...listingIds.map(id => `listings/${id}/`)];
}

/** Dependency injection keeps the actual worker testable against local Admin
 * SDK emulators without running any production account operation. */
function createDeletionWorker({ db, bucket, auth, fieldValue, FieldPath, documentId, now = Date.now }) {
  async function manifest(job, group, value, data = {}) {
    await job.collection(group).doc(keyFor(value)).set({ value, ...data }, { merge: true });
  }
  async function scan(query, visit) {
    let cursor;
    for (;;) {
      let page = query.orderBy(documentId).limit(200);
      if (cursor) page = page.startAfter(cursor);
      const snapshot = await page.get();
      for (const document of snapshot.docs) await visit(document);
      if (snapshot.size < 200) return;
      cursor = snapshot.docs.at(-1);
    }
  }
  async function phase(job, leaseId, value) {
    await job.update({ phase: value, leaseId, leaseUntil: now() + 600000, updatedAt: fieldValue.serverTimestamp() });
  }
  async function prepare(job, uid, state) {
    for (const root of PRIVATE_ROOTS) await manifest(job, 'records', `${root}/${uid}`);
    if (state.staffRegistryKey) await manifest(job, 'records', `admins/${state.staffRegistryKey}`);
    for (const [collection, field] of OWNED_FIELDS) {
      await scan(db.collection(collection).where(field, '==', uid), async document => {
        await manifest(job, 'records', document.ref.path);
        if (collection === 'listings') {
          await manifest(job, 'listings', document.id);
          await manifest(job, 'records', `publicListings/${document.id}`);
          await document.ref.update({ status: 'closed', updatedAt: fieldValue.serverTimestamp() });
          await scan(db.collection('applicationLocks').where('listingId', '==', document.id), lock => manifest(job, 'records', lock.ref.path));
        }
      });
    }
    for (const collection of ['connectionPairs', 'conversationPairs']) {
      await scan(db.collection(collection).where('participants', 'array-contains', uid), document => manifest(job, 'records', document.ref.path));
    }
    await scan(db.collection('chatRooms').where('participants', 'array-contains', uid), room => manifest(job, 'rooms', room.id));
  }
  async function retainedHistory(job, uid) {
    await scan(job.collection('rooms'), async entry => {
      if (entry.data().done) return;
      const room = db.collection('chatRooms').doc(entry.data().value);
      if (!(await room.get()).exists) { await entry.ref.update({ done: true }); return; }
      let cursor = entry.data().cursor;
      for (;;) {
        let query = room.collection('messages').orderBy(documentId).limit(200);
        if (cursor) query = query.startAfter(cursor);
        const messages = await query.get(), batch = db.batch();
        for (const message of messages.docs) {
          const update = messageIdentityUpdate(message.data(), uid, fieldValue);
          if (update) batch.update(message.ref, update);
        }
        if (messages.size) {
          cursor = messages.docs.at(-1).id;
          batch.update(entry.ref, { cursor });
          await batch.commit();
        }
        if (messages.size < 200) break;
      }
      await room.update('deletedParticipants', fieldValue.arrayUnion(uid),
        new FieldPath('participantNames', uid), 'Deleted member',
        new FieldPath('participantAvatars', uid), fieldValue.delete(),
        new FieldPath('participantProfiles', uid), { name: 'Deleted member', avatar: '' },
        new FieldPath('unreadBy', uid), fieldValue.delete());
      await entry.ref.update({ done: true });
    });
  }
  async function eraseRecords(job, uid) {
    await scan(job.collection('records'), async entry => {
      if (entry.data().done) return;
      const path = entry.data().value;
      // Guard the manifest executor against accidental deletion of shared chat
      // trees or the frozen account barrier, even if a planner regresses.
      if (path.startsWith('chatRooms/') || path === `users/${uid}`) throw new Error('Unsafe deletion manifest path');
      await db.recursiveDelete(db.doc(path));
      await entry.ref.update({ done: true });
    });
    const user = db.collection('users').doc(uid);
    for (const collection of await user.listCollections()) await db.recursiveDelete(collection);
  }
  return async function run(uid) {
    if (typeof uid !== 'string' || !uid || uid.length > 128 || uid.includes('/') || uid === '.' || uid === '..') throw new Error('Invalid account ID');
    const job = db.collection('accountDeletionJobs').doc(uid), leaseId = randomUUID();
    const state = await db.runTransaction(async transaction => {
      const snapshot = await transaction.get(job);
      if (!snapshot.exists) throw new Error('Deletion job missing');
      const data = snapshot.data();
      if (data.status === 'complete') return null;
      if (data.policyVersion !== POLICY_VERSION) throw new Error('Deletion policy version mismatch');
      if (data.leaseUntil > now()) throw new Error('Deletion job is already processing');
      transaction.update(job, { status: 'processing', leaseId, leaseUntil: now() + 600000, updatedAt: fieldValue.serverTimestamp() });
      if (data.phase !== 'cleanup') transaction.set(db.collection('users').doc(uid), {
        name: 'Deleted member', avatar: '', status: 'deleting', deletionRequestedAt: fieldValue.serverTimestamp(),
      });
      if (data.phase !== 'cleanup') {
        for (const collection of ['publicProfiles', 'privateUserData', 'userContacts']) transaction.delete(db.collection(collection).doc(uid));
      }
      if (data.staffRegistryKey) transaction.delete(db.collection('admins').doc(data.staffRegistryKey));
      return data;
    });
    if (!state) return { deleted: true };
    const steps = ['prepare', 'shared_history', 'owned_records', 'storage', 'identity', 'cleanup'];
    try {
      let start = Math.max(0, steps.indexOf(state.phase));
      for (let index = start; index < steps.length; index++) {
        const step = steps[index]; await phase(job, leaseId, step);
        if (step === 'prepare') await prepare(job, uid, state);
        if (step === 'shared_history') await retainedHistory(job, uid);
        if (step === 'owned_records') await eraseRecords(job, uid);
        if (step === 'storage') {
          const listings = await job.collection('listings').get();
          for (const prefix of ownedStoragePrefixes(uid, listings.docs.map(document => document.data().value))) {
            await bucket.deleteFiles({ prefix, force: true });
          }
        }
        if (step === 'identity') {
          // Preserve a non-discoverable identity-free barrier and stable history
          // reference. An old ID token cannot recreate this account document.
          await db.collection('users').doc(uid).set({ name: 'Deleted member', avatar: '', status: 'deleted', deletedAt: fieldValue.serverTimestamp() });
          try { await auth.deleteUser(uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
        }
        if (step === 'cleanup') {
          for (const collection of ['records', 'rooms', 'listings']) await db.recursiveDelete(job.collection(collection));
        }
      }
      await job.set({ status: 'complete', phase: 'complete', policyVersion: POLICY_VERSION, completedAt: fieldValue.serverTimestamp() });
      return { deleted: true };
    } catch (error) {
      await job.update({ status: 'failed', leaseUntil: 0, errorCode: 'deletion-step-failed', updatedAt: fieldValue.serverTimestamp() });
      throw error;
    }
  };
}

module.exports = { POLICY_VERSION, OWNED_FIELDS, PRIVATE_ROOTS, messageIdentityUpdate, ownedStoragePrefixes, createDeletionWorker };
