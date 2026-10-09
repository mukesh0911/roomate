#!/usr/bin/env node
const assert = require('node:assert/strict');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { BY_KEY: P, IDS } = require('../data/emulator-universe.cjs');

const PROJECT_ID = 'demo-nestmate';

function requireLocalEmulators() {
  for (const name of ['FIREBASE_AUTH_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
    assert.match(process.env[name] || '', /^(127\.0\.0\.1|localhost):\d+$/, `${name} must be a local emulator`);
  }
  assert.equal(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT, PROJECT_ID);
}

async function signIn(persona) {
  const response = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: persona.email, password: persona.password, returnSecureToken: true }),
    }
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  return body.idToken;
}

async function callDeletion(idToken, confirmation) {
  return fetch(`http://127.0.0.1:5001/${PROJECT_ID}/us-central1/requestAccountDeletion`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ data: { confirmation } }),
  });
}

async function main() {
  requireLocalEmulators();
  const app = getApps()[0] || initializeApp({ projectId: PROJECT_ID, storageBucket: `${PROJECT_ID}.appspot.com` });
  const db = getFirestore(app);
  const auth = getAuth(app);
  const bucket = getStorage(app).bucket();
  const user = P.DISPOSABLE_USER;

  assert.equal((await db.doc(`users/${user.uid}`).get()).exists, true, 'fixture user must exist');
  assert.equal((await db.doc(`chatRooms/${IDS.CHAT_DELETE}/messages/qa_msg_delete`).get()).exists, true, 'nested message fixture must exist');
  assert.equal((await bucket.file(`profiles/${user.uid}/qa-delete-fixture.txt`).exists())[0], true, 'storage fixture must exist');

  const idToken = await signIn(user);
  const invalid = await callDeletion(idToken, 'delete');
  const invalidBody = await invalid.json();
  assert.equal(invalid.status, 400, `invalid confirmation should fail: ${JSON.stringify(invalidBody)}`);
  assert.equal((await db.doc(`users/${user.uid}`).get()).exists, true, 'invalid request must not mutate account');

  const response = await callDeletion(idToken, 'DELETE');
  const responseBody = await response.json();
  assert.equal(response.status, 200, JSON.stringify(responseBody));
  assert.deepEqual(responseBody, { result: { deleted: true } });

  await assert.rejects(() => auth.getUser(user.uid), error => error.code === 'auth/user-not-found');

  const directPaths = [
    `users/${user.uid}`,
    `privateUserData/${user.uid}`,
    `userContacts/${user.uid}`,
    `connections/${IDS.CONNECTION_DELETE}`,
    `acceptedPairs/${user.uid}_${P.OWNER_A.uid}`,
    `acceptedPairs/${P.OWNER_A.uid}_${user.uid}`,
    `chatRooms/${IDS.CHAT_DELETE}`,
    `chatRooms/${IDS.CHAT_DELETE}/messages/qa_msg_delete`,
    'notifications/qa_notif_delete',
    'reports/qa_report_delete',
    'reviews/qa_review_delete',
  ];
  for (const path of directPaths) {
    assert.equal((await db.doc(path).get()).exists, false, `${path} should be deleted`);
  }

  assert.equal((await bucket.file(`profiles/${user.uid}/qa-delete-fixture.txt`).exists())[0], false, 'profile files should be deleted');

  const retry = await callDeletion(idToken, 'DELETE');
  const retryBody = await retry.json();
  assert.equal(retry.status, 200, JSON.stringify(retryBody));
  assert.deepEqual(retryBody, { result: { deleted: true } }, 'lost-response retry should be idempotent');

  console.log(`ACCOUNT_DELETION_OK uid=${user.uid} firestore=${directPaths.length} auth=deleted storage=deleted retry=idempotent`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
