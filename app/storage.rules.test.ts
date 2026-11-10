/**
 * Sprint FINAL — Firebase Storage Security Rules emulator tests.
 *
 * Exercises the REAL storage.rules against the Storage Emulator.
 * Covers: unauthenticated access, owner upload, unauthorized upload,
 * private identity-document reads, MIME restrictions, size caps,
 * deletion authorization.
 *
 * Run with:  npm run test:storage-rules   (starts the emulators)
 * Skipped unless RUN_STORAGE_RULES_TESTS=1 so plain `npm test` never
 * requires a running emulator.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    assertSucceeds,
    assertFails,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const runStorage = process.env.RUN_STORAGE_RULES_TESTS === '1';
const d = runStorage ? describe : describe.skip;

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-nestmate';
// The Storage emulator derives the default bucket from the projectId.
const BUCKET = `${PROJECT_ID}.appspot.com`;
const RULES_PATH = resolve(__dirname, 'storage.rules');
const FIRESTORE_RULES_PATH = resolve(__dirname, 'firestore.rules');

const ALICE = 'alice-1';
const MALLORY = 'mallory-1';

let env: RulesTestEnvironment;

function aliceStorage() {
    return env.authenticatedContext(ALICE).storage(`gs://${BUCKET}`);
}
function malloryStorage() {
    return env.authenticatedContext(MALLORY).storage(`gs://${BUCKET}`);
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TEXT_BYTES = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]); // "hello"

d('Firebase Storage security rules (emulator)', () => {
    beforeAll(async () => {
        const hostAndPort = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
        const [host, portStr] = hostAndPort.split(':');
        const port = Number(portStr || 9199);
        const firestoreHostAndPort = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
        const [firestoreHost, firestorePortStr] = firestoreHostAndPort.split(':');
        env = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                host: firestoreHost,
                port: Number(firestorePortStr || 8080),
                rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
            },
            storage: {
                host,
                port,
                rules: readFileSync(RULES_PATH, 'utf8'),
            },
        });
        await env.withSecurityRulesDisabled(async ctx => {
            const db = ctx.firestore() as unknown as Firestore;
            await setDoc(doc(db, 'users', ALICE), { name: 'Alice', status: 'active' });
            await setDoc(doc(db, 'users', 'bob-1'), { name: 'Bob', status: 'active' });
            await setDoc(doc(db, 'users', MALLORY), { name: 'Mallory', status: 'active' });
            await setDoc(doc(db, 'listings', 'listing-1'), { ownerId: ALICE, status: 'active' });
            await setDoc(doc(db, 'chatRooms', 'room-1'), { participants: [ALICE, 'bob-1'] });
            await setDoc(doc(db, 'connections', 'storage-accepted'), { fromUserId: ALICE, toUserId: 'bob-1', status: 'accepted' });
            await setDoc(doc(db, 'acceptedPairs', `${ALICE}_bob-1`), { user1: ALICE, user2: 'bob-1', connectionId: 'storage-accepted' });
        });
    }, 90_000);

    afterAll(async () => {
        if (env) {
            await env.cleanup();
        }
    });

    // A. Unauthenticated access
    it('UNAUTHENTICATED user CANNOT read a profile image', async () => {
        await assertSucceeds(
            uploadBytes(ref(aliceStorage(), `profiles/${ALICE}/avatar.png`), PNG_BYTES, { contentType: 'image/png' })
        );
        await assertFails(getBytes(ref(env.unauthenticatedContext().storage(`gs://${BUCKET}`), `profiles/${ALICE}/avatar.png`)));
    });

    // B. Legitimate owner upload
    it('owner CAN upload a profile image to their own path', async () => {
        await assertSucceeds(
            uploadBytes(ref(aliceStorage(), `profiles/${ALICE}/avatar2.png`), PNG_BYTES, { contentType: 'image/png' })
        );
    });

    // C. Unauthorized user upload
    it('another user CANNOT upload into someone else profile path', async () => {
        await assertFails(
            uploadBytes(ref(malloryStorage(), `profiles/${ALICE}/evil.png`), PNG_BYTES, { contentType: 'image/png' })
        );
    });

    // D. Owner read of private identity document
    it('owner CAN read their own verification document', async () => {
        await assertSucceeds(
            uploadBytes(ref(aliceStorage(), `verifications/${ALICE}/gov-id.png`), PNG_BYTES, { contentType: 'image/png' })
        );
        await assertSucceeds(getBytes(ref(aliceStorage(), `verifications/${ALICE}/gov-id.png`)));
    });

    // E. Unauthorized read of private identity document
    it('ANOTHER USER CANNOT read a private identity document', async () => {
        await assertFails(getBytes(ref(malloryStorage(), `verifications/${ALICE}/gov-id.png`)));
    });

    it('UNAUTHENTICATED user CANNOT read a private identity document', async () => {
        await assertFails(getBytes(ref(env.unauthenticatedContext().storage(`gs://${BUCKET}`), `verifications/${ALICE}/gov-id.png`)));
    });

    // F. Invalid MIME/type restriction
    it('non-image upload to listings is REJECTED', async () => {
        await assertFails(
            uploadBytes(ref(malloryStorage(), 'listings/listing-1/not-image.txt'), TEXT_BYTES, { contentType: 'text/plain' })
        );
    });

    it('listing owner CAN upload a valid listing image', async () => {
        await assertSucceeds(
            uploadBytes(ref(aliceStorage(), 'listings/listing-1/room.png'), PNG_BYTES, { contentType: 'image/png' })
        );
    }, 90_000);

    it('non-owner CANNOT upload a valid image to another owner listing', async () => {
        await assertFails(
            uploadBytes(ref(malloryStorage(), 'listings/listing-1/evil.png'), PNG_BYTES, { contentType: 'image/png' })
        );
    });

    // G. Oversized file restriction (>10MB cap)
    it('oversized listing image is REJECTED', async () => {
        const big = new Uint8Array(10 * 1024 * 1024 + 1);
        await assertFails(
            uploadBytes(ref(aliceStorage(), 'listings/listing-1/big.png'), big, { contentType: 'image/png' })
        );
    });

    // H/I. Deletion authorization
    it('UNAUTHENTICATED user CANNOT delete a listing image', async () => {
        await assertFails(deleteObject(ref(env.unauthenticatedContext().storage(`gs://${BUCKET}`), 'listings/listing-1/room.png')));
    });

    it('non-owner CANNOT delete another owner listing image', async () => {
        await assertFails(deleteObject(ref(malloryStorage(), 'listings/listing-1/room.png')));
    });

    it('listing owner CAN delete their listing image', async () => {
        await assertSucceeds(deleteObject(ref(aliceStorage(), 'listings/listing-1/room.png')));
    });

    it('chat participant CAN upload/read chat media; unrelated user CANNOT', async () => {
        await assertSucceeds(
            uploadBytes(ref(aliceStorage(), `chats/room-1/${ALICE}/photo.png`), PNG_BYTES, { contentType: 'image/png' })
        );
        await assertSucceeds(getBytes(ref(aliceStorage(), `chats/room-1/${ALICE}/photo.png`)));
        await assertFails(getBytes(ref(malloryStorage(), `chats/room-1/${ALICE}/photo.png`)));
        await assertFails(
            uploadBytes(ref(malloryStorage(), `chats/room-1/${MALLORY}/evil.png`), PNG_BYTES, { contentType: 'image/png' })
        );
    });
});
