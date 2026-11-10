const { POLICY_VERSION, createDeletionWorker } = require('./accountDeletion');

/** Production availability is supplied by the reviewed entry point. Tests can
 * exercise the same handlers against local emulators without a production
 * environment-variable bypass. */
function createAccountDeletionService({ available, getDb, getBucket, getAuth, fieldValue, FieldPath, HttpsError, now = Date.now }) {
  const capabilities = () => ({ available, policyVersion: POLICY_VERSION, sharedHistory: 'retained_with_removed_account_identity' });
  async function requestDeletion(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before deleting your account.');
    if (request.data?.action === 'capabilities') return capabilities();
    if (request.data?.confirmation !== 'DELETE') throw new HttpsError('invalid-argument', 'Type DELETE to confirm permanent account deletion.');
    const authTime = Number(request.auth.token.auth_time || 0), seconds = Math.floor(now() / 1000);
    if (!Number.isFinite(authTime) || authTime <= 0 || authTime > seconds + 60 || seconds - authTime > 15 * 60) {
      throw new HttpsError('failed-precondition', 'Please sign out and sign in again before deleting your account.');
    }
    if (!available) throw new HttpsError('failed-precondition', 'Account deletion is not available until deletion coverage is finalized.');
    const uid = request.auth.uid;
    if (!uid || uid.length > 128 || uid.includes('/') || uid === '.' || uid === '..') throw new HttpsError('invalid-argument', 'Invalid account ID.');
    const db = getDb(), job = db.collection('accountDeletionJobs').doc(uid);
    const email = request.auth.token.email_verified === true && typeof request.auth.token.email === 'string'
      ? request.auth.token.email.toLowerCase() : '';
    return db.runTransaction(async transaction => {
      const current = await transaction.get(job);
      if (current.exists) {
        const state = current.data();
        if (state.policyVersion !== POLICY_VERSION) throw new HttpsError('failed-precondition', 'This deletion job requires staff review.');
        return { jobId: uid, status: state.status, deleted: state.status === 'complete' };
      }
      transaction.set(job, { status: 'queued', phase: 'prepare', policyVersion: POLICY_VERSION,
        requestedAt: fieldValue.serverTimestamp(), ...(email ? { staffRegistryKey: email } : {}) });
      transaction.set(db.collection('users').doc(uid), { name: 'Deleted member', avatar: '', status: 'deleting', deletionRequestedAt: fieldValue.serverTimestamp() });
      transaction.delete(db.collection('publicProfiles').doc(uid));
      transaction.delete(db.collection('privateUserData').doc(uid));
      transaction.delete(db.collection('userContacts').doc(uid));
      if (email) transaction.delete(db.collection('admins').doc(email));
      return { jobId: uid, status: 'queued', deleted: false };
    });
  }
  async function processJob(uid) {
    if (!available) return { blocked: true };
    const worker = createDeletionWorker({ db: getDb(), bucket: getBucket(), auth: getAuth(),
      fieldValue, FieldPath, documentId: FieldPath.documentId(), now });
    return worker(uid);
  }
  return { capabilities, requestDeletion, processJob };
}

module.exports = { createAccountDeletionService };
