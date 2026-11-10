const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue, FieldPath } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { deriveCompatibilitySummary } = require('./privacyCompatibility');
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { createAccountDeletionService } = require('./accountDeletionService');

// Functions supplies FIREBASE_CONFIG, including the actual default bucket.
// Deriving an appspot.com bucket from the project ID targets the wrong bucket
// for projects provisioned with a firebasestorage.app bucket.
initializeApp();

// Founder D17 decision: retain shared history and remove account identity.
// Coverage and deployment review remain prerequisites for availability.
const ACCOUNT_DELETION_AVAILABLE = false;
const deletionService = createAccountDeletionService({
  available: ACCOUNT_DELETION_AVAILABLE,
  getDb: getFirestore, getAuth, getBucket: () => getStorage().bucket(),
  fieldValue: FieldValue, FieldPath, HttpsError,
});
exports.requestAccountDeletion = onCall({ region: 'us-central1' }, deletionService.requestDeletion);
exports.processAccountDeletionJob = onDocumentCreated({
  document: 'accountDeletionJobs/{uid}', region: 'us-central1',
  timeoutSeconds: 540, retry: true,
}, event => deletionService.processJob(event.params.uid));

// Privacy Phase 5.2 prototype: the function reads private accounts with the
// Admin SDK and releases only a reviewed score band plus fixed reason codes.
// It has no public client access to either account's raw quiz answers.
exports.getDiscoveryCompatibility = onCall({ region: 'us-central1' }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to compare discovery profiles.');
  const candidateId = typeof request.data?.candidateId === 'string' ? request.data.candidateId : '';
  if (!candidateId || candidateId.includes('/') || candidateId.length > 128 || candidateId === request.auth.uid) {
    throw new HttpsError('invalid-argument', 'A different candidateId is required.');
  }
  const db = getFirestore();
  const [viewerAccount, candidateAccount, viewerCard, candidateCard] = await Promise.all([
    db.doc(`users/${request.auth.uid}`).get(),
    db.doc(`users/${candidateId}`).get(),
    db.doc(`publicProfiles/${request.auth.uid}`).get(),
    db.doc(`publicProfiles/${candidateId}`).get(),
  ]);
  if (!viewerAccount.exists || !candidateAccount.exists || !viewerCard.exists || !candidateCard.exists) {
    throw new HttpsError('failed-precondition', 'Both users must have active discovery profiles.');
  }
  const viewer = viewerAccount.data();
  const candidate = candidateAccount.data();
  if (viewer?.onboardingComplete !== true || candidate?.onboardingComplete !== true
    || viewer?.roommateDiscoveryEnabled !== true || candidate?.roommateDiscoveryEnabled !== true
    || (viewer?.status || 'active') !== 'active' || (candidate?.status || 'active') !== 'active'
    || (viewer.blockedUserIds || []).includes(candidateId) || (candidate.blockedUserIds || []).includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'Discovery eligibility is required.');
  }
  return { candidateId, ...deriveCompatibilitySummary(viewer, candidate) };
});

// Trusted read adapter serves existing records through explicit projections.
// No backfill, login migration, private-source client fallback or data rewrite.
const { createDiscoveryGateway } = require('./discoveryGateway');
const discoveryGateway = createDiscoveryGateway({ getDb: getFirestore, HttpsError });
exports.readDiscovery = onCall({ region: 'us-central1' }, discoveryGateway.read);
exports.getInteractionContext = onCall({ region: 'us-central1' }, discoveryGateway.interaction);
const invalidateDiscovery = () => getFirestore().doc('discoverySignals/global').set({ updatedAt: FieldValue.serverTimestamp() });
exports.invalidateListingDiscovery = onDocumentWritten({ document: 'listings/{id}', region: 'us-central1' }, invalidateDiscovery);
exports.invalidateMemberDiscovery = onDocumentWritten({ document: 'users/{uid}', region: 'us-central1' }, invalidateDiscovery);

const { createAccountJobs } = require('./accountJobs');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const accountJobs = createAccountJobs({ getDb: getFirestore, getBucket: () => getStorage().bucket(), HttpsError, fieldValue: FieldValue, documentId: FieldPath.documentId() });
exports.requestAccountExport = onCall({ region: 'us-central1' }, accountJobs.exportRequest);
exports.queueBroadcast = onCall({ region: 'us-central1' }, accountJobs.broadcastRequest);
exports.processAccountExport = onDocumentWritten({document:'accountExports/{uid}',region:'us-central1',timeoutSeconds:540,retry:true}, event => event.data?.after?.data()?.status === 'queued' ? accountJobs.runExport(event.params.uid) : null);
exports.deliverBroadcast = onDocumentWritten({document:'broadcasts/{id}',region:'us-central1',timeoutSeconds:540,retry:true}, event => event.data?.after?.data()?.status === 'queued' ? accountJobs.runBroadcast(event.params.id) : null);
exports.cleanupAccountExports = onSchedule({schedule:'every 24 hours',region:'us-central1',timeoutSeconds:540}, accountJobs.cleanupExports);
