const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function harness() {
  const removed = [];
  const prefixes = [];
  const initialization = [];
  let dbAccesses = 0;
  const ref = path => ({ path, id: path.split('/').at(-1), parent: { id: path.split('/')[0] } });
  const db = {
    doc: ref,
    collection: collection => ({ where: (field, operator, value) => ({ get: async () => ({
      docs: collection === 'listings' && field === 'ownerId' && value === 'alice'
        ? [{ ref: ref('listings/alice-room'), id: 'alice-room' }] : [],
    }) }) }),
    recursiveDelete: async document => { removed.push(document.path); },
  };
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const stubs = {
    'firebase-admin/app': { initializeApp(options) { initialization.push(options); } },
    'firebase-admin/auth': { getAuth: () => ({ deleteUser: async () => {} }) },
    'firebase-admin/firestore': { FieldValue:{serverTimestamp:()=>0},FieldPath:{documentId:()=> '__name__'}, getFirestore: () => { dbAccesses++; return db; } },
    'firebase-admin/storage': { getStorage: () => ({ bucket: () => ({ deleteFiles: async options => { prefixes.push(options.prefix); } }) }) },
    'firebase-functions/v2/https': { HttpsError, onCall: (_options, handler) => handler },
    'firebase-functions/v2/firestore': { onDocumentCreated: (_options, handler) => handler, onDocumentWritten: (_options, handler) => handler },
    'firebase-functions/v2/scheduler': {onSchedule:(_options,handler)=>handler},
    './accountJobs':require('./accountJobs'),
    './discoveryGateway': require('./discoveryGateway'),
    './accountDeletionService': require('./accountDeletionService'),
    './privacyCompatibility': { deriveCompatibilitySummary: () => ({ band: 'high' }) },
  };
  const exports = {};
  vm.runInNewContext(readFileSync(`${__dirname}/index.js`, 'utf8'), {
    require: name => { if (!stubs[name]) throw new Error(`Unexpected dependency ${name}`); return stubs[name]; },
    exports, process: { env: { GCLOUD_PROJECT: 'demo-nestmate-production-readiness' } },
    Date, console,
  });
  return { handlers: exports, removed, prefixes, initialization, dbAccesses: () => dbAccesses };
}
const auth = overrides => ({ uid: 'alice', token: { auth_time: Math.floor(Date.now() / 1000), ...overrides } });

test('Functions uses the configured default bucket without substituting an appspot bucket', async () => {
  const { initialization } = harness();
  assert.equal(initialization.length, 1);
  assert.equal(initialization[0], undefined);
  const { initializeApp, deleteApp } = require('firebase-admin/app');
  const previous = process.env.FIREBASE_CONFIG;
  process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'demo-configured-bucket', storageBucket: 'demo-configured-bucket.firebasestorage.app' });
  const app = initializeApp(undefined, 'workflow-bucket-regression');
  try { assert.equal(app.options.storageBucket, 'demo-configured-bucket.firebasestorage.app'); }
  finally { await deleteApp(app); if (previous === undefined) delete process.env.FIREBASE_CONFIG; else process.env.FIREBASE_CONFIG = previous; }
});

test('account deletion rejects unauthenticated, unconfirmed, stale and future sessions', async () => {
  const { handlers, dbAccesses } = harness();
  await assert.rejects(handlers.requestAccountDeletion({ data: { confirmation: 'DELETE' } }), { code: 'unauthenticated' });
  await assert.rejects(handlers.requestAccountDeletion({ auth: auth(), data: {} }), { code: 'invalid-argument' });
  await assert.rejects(handlers.requestAccountDeletion({ auth: auth({ auth_time: 1 }), data: { confirmation: 'DELETE' } }), { code: 'failed-precondition' });
  await assert.rejects(handlers.requestAccountDeletion({ auth: auth({ auth_time: Math.floor(Date.now() / 1000) + 600 }), data: { confirmation: 'DELETE' } }), { code: 'failed-precondition' });
  assert.equal(dbAccesses(), 0);
});
test('gated deletion cannot erase any data or staff row even with a valid recent session', async () => {
  const { handlers, removed, prefixes, dbAccesses } = harness();
  await assert.rejects(handlers.requestAccountDeletion({ auth: auth({ email: 'admin@example.test', email_verified: false }), data: { confirmation: 'DELETE' } }), { code: 'failed-precondition' });
  assert.equal(dbAccesses(), 0);
  assert.deepEqual(removed, []);
  assert.deepEqual(prefixes, []);
});
test('discovery rejects invalid document paths before reading private accounts', async () => {
  const { handlers, dbAccesses } = harness();
  for (const candidateId of ['', 'alice', 'other/path', 'a'.repeat(129)]) {
    await assert.rejects(handlers.getDiscoveryCompatibility({ auth: auth(), data: { candidateId } }), { code: 'invalid-argument' });
  }
  assert.equal(dbAccesses(), 0);
});
test('disabled deletion capabilities and job events cannot access privileged services', async () => {
  const { handlers, dbAccesses } = harness();
  const capability = await handlers.requestAccountDeletion({ auth: auth(), data: { action: 'capabilities' } });
  assert.equal(capability.available, false);
  assert.equal(capability.sharedHistory, 'retained_with_removed_account_identity');
  assert.deepEqual(await handlers.processAccountDeletionJob({ params: { uid: 'alice' } }), { blocked: true });
  assert.equal(dbAccesses(), 0);
});
