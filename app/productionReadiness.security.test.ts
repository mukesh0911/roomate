import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, deleteField, doc, getDoc, runTransaction, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { readFileSync } from 'node:fs';

// Deliberately isolated from production. Never reset the startup/browser project.
const projectId = 'demo-nestmate-production-readiness';
const enabled = process.env.RUN_PRODUCTION_READINESS_RULES === '1';
const suite = enabled ? describe : describe.skip;
let env: RulesTestEnvironment;
let storageEnv: RulesTestEnvironment;
const adminEmail = 'readiness-admin@example.test';
const png = new Uint8Array([137, 80, 78, 71]);

function endpoint(value: string | undefined, port: number) {
  const [host, selectedPort] = (value || `127.0.0.1:${port}`).split(':');
  if (!['127.0.0.1', 'localhost'].includes(host)) throw new Error('Only loopback demo emulators are allowed.');
  return { host, port: Number(selectedPort) };
}
const db = (uid: string) => env.authenticatedContext(uid).firestore();
const storage = (uid: string) => storageEnv.authenticatedContext(`productionReadiness-${uid}`).storage('gs://demo-nestmate.appspot.com');

suite('production readiness: real rules attack regressions', () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId,
      firestore: { ...endpoint(process.env.FIRESTORE_EMULATOR_HOST, 18080), rules: readFileSync('firestore.rules', 'utf8') },
      storage: { ...endpoint(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 19199), rules: readFileSync('storage.rules', 'utf8') },
    });
    // Firestore supports isolated projects; Storage cross-service lookups use
    // the emulator's startup project. Use unique fixtures there, never clear it.
    storageEnv = await initializeTestEnvironment({
      projectId: 'demo-nestmate',
      firestore: endpoint(process.env.FIRESTORE_EMULATOR_HOST, 18080),
      storage: endpoint(process.env.FIREBASE_STORAGE_EMULATOR_HOST, 19199),
    });
    await env.clearFirestore(); // only the hardcoded readiness project
    await storageEnv.withSecurityRulesDisabled(async context => {
      const database = context.firestore();
      await setDoc(doc(database, 'admins', adminEmail), { role: 'admin' });
      await setDoc(doc(database, 'admins/disabled-admin@example.test'), { role: 'admin', enabled: false });
      await setDoc(doc(database, 'agreements/productionReadiness-owned'), { landlordId: 'productionReadiness-alice', tenantId: 'productionReadiness-bob' });
      await setDoc(doc(database, 'listings/productionReadiness-owned'), { ownerId: 'productionReadiness-alice' });
      await setDoc(doc(database, 'chatRooms/productionReadiness-owned'), { participants: ['productionReadiness-alice', 'productionReadiness-bob'] });
      await setDoc(doc(database, 'users/productionReadiness-alice'), { status: 'active' });
      await setDoc(doc(database, 'users/productionReadiness-bob'), { status: 'active' });
      await setDoc(doc(database, 'connections/productionReadiness-storage'), { fromUserId: 'productionReadiness-alice', toUserId: 'productionReadiness-bob', status: 'accepted' });
      await setDoc(doc(database, 'acceptedPairs/productionReadiness-alice_productionReadiness-bob'), { user1: 'productionReadiness-alice', user2: 'productionReadiness-bob', connectionId: 'productionReadiness-storage' });
    });
    await env.withSecurityRulesDisabled(async context => {
      const database = context.firestore();
      const fixtures: Record<string, object> = {
        [`admins/${adminEmail}`]: { role: 'admin' },
        'admins/disabled-admin@example.test': { role: 'admin', enabled: false },
        'admins/inactive-admin@example.test': { role: 'admin', active: false },
        'users/alice': { name: 'Alice', status: 'active', connectsUsed: 0 },
        'users/bob': { name: 'Bob', status: 'active', connectsUsed: 0 },
        'users/chatAlice': { name: 'Chat Alice', status: 'active' },
        'users/chatBob': { name: 'Chat Bob', status: 'active' },
        'users/banned': { name: 'Banned', status: 'banned', connectsUsed: 5 },
        'users/exhausted': { name: 'Exhausted', status: 'active', connectsUsed: 5 },
        'listings/owned': { ownerId: 'alice', ownerVerified: false, status: 'pending_verification' },
        'connections/blocked': { fromUserId: 'alice', toUserId: 'bob', status: 'blocked' },
        'connections/pending': { fromUserId: 'alice', toUserId: 'bob', status: 'pending' },
        'acceptedPairs/bob_alice': { user1: 'bob', user2: 'alice', connectionId: 'blocked' },
        'userContacts/alice': { phone: '+91000000000' },
        'connections/accepted-chat': { fromUserId: 'chatAlice', toUserId: 'chatBob', status: 'accepted' },
        'acceptedPairs/chatAlice_chatBob': { user1: 'chatAlice', user2: 'chatBob', connectionId: 'accepted-chat' },
        'notifications/owned': { userId: 'alice', actorId: 'bob', read: false, title: 'Original' },
        'reviews/owned': { reviewerId: 'alice', targetUserId: 'bob', rating: 4, text: 'Good' },
        'agreementOTPs/secret': { otp: '123456', tenantId: 'bob', landlordId: 'alice' },
        'agreements/owned': { landlordId: 'alice', tenantId: 'bob', status: 'draft' },
        'privateUserData/alice': { phone: '+91000000000' },
        'chatRooms/owned': { participants: ['alice', 'bob'] },
      };
      for (const [path, data] of Object.entries(fixtures)) await setDoc(doc(database, path), data);
    });
  }, 60_000);
  afterAll(async () => { if (env) await env.cleanup(); if (storageEnv) await storageEnv.cleanup(); });

  it('denies admin privilege to an unverified matching email', async () => {
    const unverified = env.authenticatedContext('impostor', { email: adminEmail, email_verified: false }).firestore();
    await assertFails(setDoc(doc(unverified, 'admins/escalated@example.test'), { role: 'admin' }));
    await assertFails(getDoc(doc(unverified, 'privateUserData/alice')));
  });
  it('allows verified registered admin and denies verified non-admin', async () => {
    await assertSucceeds(getDoc(doc(env.authenticatedContext('admin', { email: adminEmail, email_verified: true }).firestore(), 'privateUserData/alice')));
    await assertFails(getDoc(doc(env.authenticatedContext('other', { email: 'other@example.test', email_verified: true }).firestore(), 'privateUserData/alice')));
  });
  it('denies disabled or inactive admin registry entries even with verified email', async () => {
    for (const email of ['disabled-admin@example.test', 'inactive-admin@example.test']) {
      const database = env.authenticatedContext('inactive-admin', { email, email_verified: true }).firestore();
      await assertFails(getDoc(doc(database, 'privateUserData/alice')));
      await assertFails(setDoc(doc(database, 'admins/escalated@example.test'), { role: 'admin' }));
    }
  });
  it('denies deleting a banned account workflow record', async () => {
    await assertFails(deleteDoc(doc(db('banned'), 'users/banned')));
    await assertFails(updateDoc(doc(db('banned'), 'users/banned'), { status: 'active' }));
  });
  it('denies removing or decrementing quota', async () => {
    await assertFails(updateDoc(doc(db('exhausted'), 'users/exhausted'), { connectsUsed: deleteField() }));
    await assertFails(updateDoc(doc(db('exhausted'), 'users/exhausted'), { connectsUsed: 0 }));
  });
  it('denies an uncounted connection, accepts atomic creation and increment', async () => {
    const database = db('alice');
    const data = { fromUserId: 'alice', toUserId: 'bob', status: 'pending' };
    await assertFails(setDoc(doc(database, 'connections/uncounted'), data));
    const batch = writeBatch(database);
    batch.set(doc(database, 'connections/counted'), data);
    batch.update(doc(database, 'users/alice'), { connectsUsed: 1, lastConnectionId: 'counted' });
    await assertSucceeds(batch.commit());
  });
  it('denies a sixth request even with an atomic increment', async () => {
    const database = db('exhausted');
    const batch = writeBatch(database);
    batch.set(doc(database, 'connections/sixth'), { fromUserId: 'exhausted', toUserId: 'bob', status: 'pending' });
    batch.update(doc(database, 'users/exhausted'), { connectsUsed: 6, lastConnectionId: 'sixth' });
    await assertFails(batch.commit());
  });
  it('denies charging multiple requests to a single counter increment', async () => {
    const database = db('bob');
    const batch = writeBatch(database);
    const data = { fromUserId: 'bob', toUserId: 'alice', status: 'pending' };
    batch.set(doc(database, 'connections/batch-first'), data);
    batch.set(doc(database, 'connections/batch-second'), data);
    batch.update(doc(database, 'users/bob'), { connectsUsed: 1, lastConnectionId: 'batch-first' });
    await assertFails(batch.commit());
  });
  it('denies transferring listing ownership', async () => {
    await assertFails(updateDoc(doc(db('alice'), 'listings/owned'), { ownerId: 'bob' }));
    await assertSucceeds(updateDoc(doc(db('alice'), 'listings/owned'), { title: 'Updated room' }));
  });
  it('denies resurrecting a blocked connection and allows accepting pending', async () => {
    await assertFails(updateDoc(doc(db('bob'), 'connections/blocked'), { status: 'accepted' }));
    await assertSucceeds(updateDoc(doc(db('bob'), 'connections/pending'), { status: 'accepted' }));
  });
  it('revokes contact access even when a blocked relationship has a stale pair registry', async () => {
    await assertFails(getDoc(doc(db('bob'), 'userContacts/alice')));
    await assertSucceeds(getDoc(doc(db('alice'), 'userContacts/alice')));
    await assertFails(setDoc(doc(db('bob'), 'chatRooms/stale-pair'), { participants: ['bob', 'alice'] }));
  });
  it('supports concurrent deterministic chat creation while denying unrelated reads', async () => {
    async function ensureChat(uid: string) {
      const database = db(uid);
      const room = doc(database, 'chatRooms/chatAlice___chatBob');
      await runTransaction(database, async transaction => {
        const current = await transaction.get(room);
        if (!current.exists()) transaction.set(room, { participants: ['chatAlice', 'chatBob'] });
      });
    }
    await Promise.all([ensureChat('chatAlice'), ensureChat('chatBob')]);
    await assertSucceeds(getDoc(doc(db('chatAlice'), 'chatRooms/chatAlice___chatBob')));
    await assertSucceeds(getDoc(doc(db('chatBob'), 'chatRooms/chatAlice___chatBob')));
    await assertFails(getDoc(doc(db('mallory'), 'chatRooms/chatAlice___chatBob')));
  });
  it('limits notification edits to the read flag', async () => {
    await assertFails(updateDoc(doc(db('alice'), 'notifications/owned'), { userId: 'bob', title: 'Spoofed system message' }));
    await assertSucceeds(updateDoc(doc(db('alice'), 'notifications/owned'), { read: true }));
  });
  it('revokes existing message sends, edits and metadata after blocking or either account suspension', async () => {
    const database = db('chatAlice');
    const room = doc(database, 'chatRooms/chatAlice___chatBob');
    const message = doc(database, 'chatRooms/chatAlice___chatBob/messages/confirmed');
    await assertSucceeds(setDoc(message, { senderId: 'chatAlice', content: 'Before block', read: false }));
    await assertSucceeds(updateDoc(room, { lastMessage: 'Before block' }));
    await env.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'connections/accepted-chat'), { status: 'blocked' });
    });
    await assertFails(setDoc(doc(database, 'chatRooms/chatAlice___chatBob/messages/after-block'), { senderId: 'chatAlice', content: 'After block' }));
    await assertFails(updateDoc(message, { content: 'Edited after block' }));
    await assertFails(updateDoc(room, { lastMessage: 'Forged after block' }));
    await assertSucceeds(updateDoc(doc(db('chatBob'), 'chatRooms/chatAlice___chatBob/messages/confirmed'), { read: true }));
    await assertFails(deleteDoc(doc(database, 'connections/accepted-chat')));
    await env.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'connections/accepted-chat'), { status: 'accepted' });
      await updateDoc(doc(context.firestore(), 'users/chatBob'), { status: 'suspended' });
    });
    await assertFails(setDoc(doc(database, 'chatRooms/chatAlice___chatBob/messages/to-suspended'), { senderId: 'chatAlice', content: 'Recipient suspended' }));
    await assertFails(setDoc(doc(db('chatBob'), 'chatRooms/chatAlice___chatBob/messages/from-suspended'), { senderId: 'chatBob', content: 'Sender suspended' }));
  });
  it('only the sender may withdraw a still-pending request', async () => {
    await env.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), 'connections/withdrawal'), { fromUserId: 'alice', toUserId: 'bob', status: 'pending' });
    });
    await assertFails(deleteDoc(doc(db('bob'), 'connections/withdrawal')));
    await assertSucceeds(deleteDoc(doc(db('alice'), 'connections/withdrawal')));
    await assertFails(deleteDoc(doc(db('alice'), 'connections/blocked')));
  });
  it('cannot bypass another user block with a fresh request ID or accept while suspended', async () => {
    await env.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'users/bob'), { blockedUserIds: ['alice'] });
      await setDoc(doc(context.firestore(), 'connections/suspended-pending'), { fromUserId: 'alice', toUserId: 'banned', status: 'pending' });
    });
    const database = db('alice');
    const batch = writeBatch(database);
    batch.set(doc(database, 'connections/block-bypass'), { fromUserId: 'alice', toUserId: 'bob', status: 'pending' });
    batch.update(doc(database, 'users/alice'), { connectsUsed: 2, lastConnectionId: 'block-bypass' });
    await assertFails(batch.commit());
    await assertFails(updateDoc(doc(db('banned'), 'connections/suspended-pending'), { status: 'accepted' }));
  });
  it('preserves review identity and score bounds during edits', async () => {
    await assertFails(updateDoc(doc(db('alice'), 'reviews/owned'), { reviewerId: 'bob' }));
    await assertFails(updateDoc(doc(db('alice'), 'reviews/owned'), { rating: 500 }));
    await assertSucceeds(updateDoc(doc(db('alice'), 'reviews/owned'), { rating: 5 }));
  });
  it('denies reading or replacing signing OTP secrets', async () => {
    await assertFails(getDoc(doc(db('alice'), 'agreementOTPs/secret')));
    await assertFails(setDoc(doc(db('mallory'), 'agreementOTPs/secret'), { otp: '000000' }));
  });
  it('binds agreement creation and edits to stable participants', async () => {
    await assertFails(setDoc(doc(db('mallory'), 'agreements/forged'), { landlordId: 'alice', tenantId: 'bob' }));
    await assertFails(setDoc(doc(db('alice'), 'agreements/forged-signature'), { landlordId: 'alice', tenantId: 'bob', status: 'signed' }));
    await assertFails(setDoc(doc(db('alice'), 'agreements/forged-signature-field'), { landlordId: 'alice', tenantId: 'bob', tenantSignature: 'forged' }));
    await assertSucceeds(setDoc(doc(db('alice'), 'agreements/new-draft'), { landlordId: 'alice', tenantId: 'bob', status: 'draft' }));
    await assertFails(updateDoc(doc(db('alice'), 'agreements/owned'), { tenantId: 'mallory' }));
    await assertFails(updateDoc(doc(db('alice'), 'agreements/owned'), { status: 'signed' }));
    await assertSucceeds(updateDoc(doc(db('alice'), 'agreements/owned'), { content: 'Draft terms' }));
  });
  it('denies cross-user private data reads and writes', async () => {
    await assertFails(getDoc(doc(db('bob'), 'privateUserData/alice')));
    await assertFails(setDoc(doc(db('bob'), 'privateUserData/alice'), { phone: 'spoof' }));
    await assertSucceeds(getDoc(doc(db('alice'), 'privateUserData/alice')));
  });
  it('supports private KYC submission and rejected resubmission without self-approval', async () => {
    const database = db('alice');
    const path = doc(database, 'verifications/alice');
    await assertSucceeds(getDoc(path)); // first submission must be able to read absence
    const submission = { userId: 'alice', status: 'PENDING', consentGiven: true, documentPath: 'verificationDocs/alice/id.png' };
    await assertFails(setDoc(path, { ...submission, status: 'APPROVED' }));
    await assertFails(setDoc(path, { ...submission, documentUrl: 'https://example.test/token' }));
    await assertFails(setDoc(path, { ...submission, documentPath: 'verificationDocs/bob/id.png' }));
    await assertSucceeds(setDoc(path, submission));
    await assertFails(updateDoc(path, { status: 'APPROVED' }));
    const admin = env.authenticatedContext('admin', { email: adminEmail, email_verified: true }).firestore();
    await assertSucceeds(updateDoc(doc(admin, 'verifications/alice'), { status: 'REJECTED', reviewedBy: 'admin' }));
    await assertSucceeds(updateDoc(path, { status: 'PENDING', reviewedBy: deleteField(), documentPath: 'verificationDocs/alice/replacement.png' }));
    await assertFails(setDoc(doc(database, 'verifications/bob'), submission));
  });
  it('restricts agreement storage to participants and document formats', async () => {
    const path = 'agreements/productionReadiness-owned/document.pdf';
    await assertSucceeds(uploadBytes(ref(storage('alice'), path), png, { contentType: 'application/pdf' }));
    await assertSucceeds(getBytes(ref(storage('bob'), path)));
    await assertFails(getBytes(ref(storage('mallory'), path)));
    await assertFails(uploadBytes(ref(storage('mallory'), path), png, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(storage('alice'), 'agreements/productionReadiness-owned/script.html'), png, { contentType: 'text/html' }));
    await assertSucceeds(deleteObject(ref(storage('alice'), path)));
  });
  it('denies unverified admin access to private identity storage', async () => {
    const path = 'verificationDocs/productionReadiness-alice/id.png';
    await assertSucceeds(uploadBytes(ref(storage('alice'), path), png, { contentType: 'image/png' }));
    const unverified = storageEnv.authenticatedContext('productionReadiness-impostor', { email: adminEmail, email_verified: false }).storage('gs://demo-nestmate.appspot.com');
    await assertFails(getBytes(ref(unverified, path)));
    const verified = storageEnv.authenticatedContext('productionReadiness-admin', { email: adminEmail, email_verified: true }).storage('gs://demo-nestmate.appspot.com');
    await assertSucceeds(getBytes(ref(verified, path)));
    const disabled = storageEnv.authenticatedContext('productionReadiness-disabled', { email: 'disabled-admin@example.test', email_verified: true }).storage('gs://demo-nestmate.appspot.com');
    await assertFails(getBytes(ref(disabled, path)));
  });
  it('denies cross-user listing and chat file uploads', async () => {
    await assertFails(uploadBytes(ref(storage('mallory'), 'listings/productionReadiness-owned/room.png'), png, { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage('mallory'), 'chats/productionReadiness-owned/chat.png'), png, { contentType: 'image/png' }));
    await assertSucceeds(uploadBytes(ref(storage('alice'), 'chats/productionReadiness-owned/chat.png'), png, { contentType: 'image/png' }));
  });
  it('identity storage accepts only inert image/PDF formats, including direct SDK writes', async () => {
    await assertSucceeds(uploadBytes(ref(storage('alice'), 'verificationDocs/productionReadiness-alice/manual.pdf'), png, { contentType: 'application/pdf' }));
    await assertFails(uploadBytes(ref(storage('alice'), 'verificationDocs/productionReadiness-alice/attack.html'), png, { contentType: 'text/html' }));
    await assertFails(uploadBytes(ref(storage('alice'), 'verifications/productionReadiness-alice/attack.svg'), png, { contentType: 'image/svg+xml' }));
  });
  it('blocks new chat attachments after blocking while retaining participant history', async () => {
    await assertSucceeds(uploadBytes(ref(storage('alice'), 'chats/productionReadiness-owned/history.png'), png, { contentType: 'image/png' }));
    await storageEnv.withSecurityRulesDisabled(async context => {
      await updateDoc(doc(context.firestore(), 'connections/productionReadiness-storage'), { status: 'blocked' });
    });
    await assertFails(uploadBytes(ref(storage('alice'), 'chats/productionReadiness-owned/blocked.png'), png, { contentType: 'image/png' }));
    await assertSucceeds(getBytes(ref(storage('bob'), 'chats/productionReadiness-owned/history.png')));
  });
});
