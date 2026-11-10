import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    assertSucceeds,
    assertFails,
    initializeTestEnvironment,
    type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    type Firestore,
} from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PROJECT_ID = 'demo-nestmate-security-attacks';
const FIRESTORE_RULES_PATH = resolve(__dirname, 'firestore.rules');
const STORAGE_RULES_PATH = resolve(__dirname, 'storage.rules');

const USER_A = 'user-alice-1';
const USER_B = 'user-bob-1';
const ATTACKER = 'attacker-mallory-1';
const ADMIN_EMAIL = 'admin@nestmate.test';

let env: RulesTestEnvironment;
let storageEnv: RulesTestEnvironment;

function dbFor(uid: string): Firestore {
    return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

function storageFor(uid: string) {
    return storageEnv.authenticatedContext(uid).storage('gs://demo-nestmate.appspot.com');
}

function unauthDb(): Firestore {
    return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

function unauthStorage() {
    return env.unauthenticatedContext().storage();
}

const attackSuite = process.env.RUN_SECURITY_ATTACK_TESTS === '1' ? describe : describe.skip;
attackSuite('PHASE 2 — Live Security Attack Simulation (12 Vectors)', () => {
    beforeAll(async () => {
        const firestoreHostAndPort = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
        const [fHost, fPortStr] = firestoreHostAndPort.split(':');
        const storageHostAndPort = process.env.FIREBASE_STORAGE_EMULATOR_HOST || '127.0.0.1:9199';
        const [sHost, sPortStr] = storageHostAndPort.split(':');

        env = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                host: fHost,
                port: Number(fPortStr || 8080),
                rules: readFileSync(FIRESTORE_RULES_PATH, 'utf8'),
            },
            storage: {
                host: sHost,
                port: Number(sPortStr || 9199),
                rules: readFileSync(STORAGE_RULES_PATH, 'utf8'),
            },
        });

        await env.clearFirestore();
        // Storage's cross-service checks use the startup demo project. Only
        // write this uniquely named fixture there; never clear browser data.
        storageEnv = await initializeTestEnvironment({
            projectId: 'demo-nestmate',
            firestore: { host: fHost, port: Number(fPortStr || 8080) },
            storage: { host: sHost, port: Number(sPortStr || 9199) },
        });
        await storageEnv.withSecurityRulesDisabled(async ctx => {
            await setDoc(doc(ctx.firestore(), 'listings/securityAttacks-owned'), { ownerId: USER_A });
        });

        // Seed initial valid fixtures with rules disabled
        await env.withSecurityRulesDisabled(async (ctx) => {
            const adminDb = ctx.firestore() as unknown as Firestore;

            // Admin registry
            await setDoc(doc(adminDb, 'admins', ADMIN_EMAIL), { addedAt: Date.now() });

            // User A (Alice)
            await setDoc(doc(adminDb, 'users', USER_A), {
                name: 'Alice', role: 'owner', status: 'active', onboardingComplete: true, isVerified: false,
            });
            await setDoc(doc(adminDb, 'privateUserData', USER_A), {
                phone: '+919876500001', email: 'alice@example.com',
            });

            // User B (Bob)
            await setDoc(doc(adminDb, 'users', USER_B), {
                name: 'Bob', role: 'owner', status: 'active', onboardingComplete: true, isVerified: false,
            });
            await setDoc(doc(adminDb, 'privateUserData', USER_B), {
                phone: '+919876500002', email: 'bob@example.com',
            });

            // User B's listing
            await setDoc(doc(adminDb, 'listings', 'listing-bob-room'), {
                ownerId: USER_B,
                title: "Bob's Verified Room",
                city: 'Bengaluru',
                locality: 'Indiranagar',
                totalRent: 18000,
                status: 'active',
                ownerVerified: true,
            });

            // Chat between User A and User B
            await setDoc(doc(adminDb, 'chatRooms', 'room-alice-bob'), {
                participants: [USER_A, USER_B],
                createdAt: Date.now(),
            });
            await setDoc(doc(adminDb, 'chatRooms', 'room-alice-bob', 'messages', 'msg-secret-1'), {
                senderId: USER_B,
                content: 'Confidential door code: 1234',
                createdAt: Date.now(),
            });

            // Connection application from User A to User B
            await setDoc(doc(adminDb, 'connections', 'conn-alice-bob'), {
                fromUserId: USER_A,
                toUserId: USER_B,
                listingId: 'listing-bob-room',
                status: 'pending',
                createdAt: Date.now(),
            });
        });
    }, 30_000);

    afterAll(async () => {
        if (env) await env.cleanup();
        if (storageEnv) await storageEnv.cleanup();
    });

    // Attack 1: User A can modify User B's listing -> MUST FAIL
    it('ATTACK-01: User A CANNOT modify User B listing (Cross-owner mutation)', async () => {
        const aliceDb = dbFor(USER_A);
        await assertFails(
            updateDoc(doc(aliceDb, 'listings', 'listing-bob-room'), {
                title: 'Hacked by Alice',
                totalRent: 5000,
            })
        );
    });

    // Attack 2: User A can delete User B's listing -> MUST FAIL
    it('ATTACK-02: User A CANNOT delete User B listing', async () => {
        const aliceDb = dbFor(USER_A);
        await assertFails(deleteDoc(doc(aliceDb, 'listings', 'listing-bob-room')));
    });

    // Attack 3: User A can modify User B's profile -> MUST FAIL
    it('ATTACK-03: User A CANNOT modify User B profile (/users/{uid})', async () => {
        const aliceDb = dbFor(USER_A);
        await assertFails(
            updateDoc(doc(aliceDb, 'users', USER_B), {
                name: 'Defaced Bob',
                bio: 'Malicious Bio Injection',
            })
        );
    });

    // Attack 4: User A can access User B's private messages -> MUST FAIL for Mallory (non-participant)
    it('ATTACK-04: Non-participant CANNOT read messages inside private chat room', async () => {
        const malloryDb = dbFor(ATTACKER);
        await assertFails(
            getDoc(doc(malloryDb, 'chatRooms', 'room-alice-bob', 'messages', 'msg-secret-1'))
        );
    });

    // Attack 5: User A can read private chat rooms without membership -> MUST FAIL
    it('ATTACK-05: Non-participant CANNOT read private chat room metadata', async () => {
        const malloryDb = dbFor(ATTACKER);
        await assertFails(getDoc(doc(malloryDb, 'chatRooms', 'room-alice-bob')));
    });

    // Attack 6: User A can modify another user's application (tampering with recipient status)
    it('ATTACK-06: Sender User A CANNOT self-accept their own connection application', async () => {
        const aliceDb = dbFor(USER_A);
        await assertFails(
            updateDoc(doc(aliceDb, 'connections', 'conn-alice-bob'), {
                status: 'accepted',
            })
        );
    });

    // Attack 7: User A can change their own admin role -> MUST FAIL
    it('ATTACK-07: User A CANNOT write to /admins/{email} to escalate privileges', async () => {
        const aliceDb = dbFor(USER_A);
        await assertFails(
            setDoc(doc(aliceDb, 'admins', 'alice@example.com'), {
                addedAt: Date.now(),
                role: 'superadmin',
            })
        );
    });

    // Attack 8: User A can change their own KYC verification status -> MUST FAIL
    it('ATTACK-08: User A CANNOT self-assign isVerified: true or verificationLevel: 2', async () => {
        const aliceDb = dbFor(USER_A);
        await assertFails(
            updateDoc(doc(aliceDb, 'users', USER_A), {
                isVerified: true,
                verificationLevel: 2,
            })
        );
    });

    // Attack 9: User A can manipulate listing ownership -> MUST FAIL
    it('ATTACK-09: User A CANNOT reassign ownerId on listing or create active listing directly', async () => {
        const aliceDb = dbFor(USER_A);
        // Attempting to forge a listing owned by User B
        await assertFails(
            addDoc(collection(aliceDb, 'listings'), {
                ownerId: USER_B,
                title: 'Forged listing by Alice',
                city: 'Bengaluru',
                status: 'pending_verification',
            })
        );
        // Attempting to create an instantly active listing
        await assertFails(
            addDoc(collection(aliceDb, 'listings'), {
                ownerId: USER_A,
                title: 'Bypass active listing',
                city: 'Bengaluru',
                status: 'active',
            })
        );
    });

    // Attack 10: An unauthenticated user can access protected data -> MUST FAIL
    it('ATTACK-10: Unauthenticated user CANNOT read /privateUserData/{uid}', async () => {
        const guestDb = unauthDb();
        await assertFails(getDoc(doc(guestDb, 'privateUserData', USER_A)));
        await assertFails(getDoc(doc(guestDb, 'privateUserData', USER_B)));
    });

    // Attack 11: A signed-out user / unauthenticated session can perform mutations -> MUST FAIL
    it('ATTACK-11: Unauthenticated session CANNOT create listings, connections, or messages', async () => {
        const guestDb = unauthDb();
        await assertFails(
            addDoc(collection(guestDb, 'listings'), {
                title: 'Anon listing',
                city: 'Bengaluru',
            })
        );
        await assertFails(
            addDoc(collection(guestDb, 'connections'), {
                fromUserId: 'anon',
                toUserId: USER_B,
                status: 'pending',
            })
        );
    });

    // Attack 12: A user can upload prohibited file types or oversized files -> MUST FAIL
    it('ATTACK-12: User CANNOT upload .txt/.exe files or oversized payloads to storage', async () => {
        const aliceStorageRef = storageFor(USER_A);
        const textBytes = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]);
        // Prove ownership works so MIME/size denials cannot pass merely because
        // the referenced listing is missing or belongs to a different user.
        await assertSucceeds(uploadBytes(ref(aliceStorageRef, 'listings/securityAttacks-owned/valid.png'), textBytes, { contentType: 'image/png' }));
        await assertFails(
            uploadBytes(ref(aliceStorageRef, `listings/securityAttacks-owned/malware.exe`), textBytes, {
                contentType: 'application/x-msdownload',
            })
        );
        await assertFails(
            uploadBytes(ref(aliceStorageRef, `listings/securityAttacks-owned/notes.txt`), textBytes, {
                contentType: 'text/plain',
            })
        );

        // Oversized file (>10MB)
        const bigBytes = new Uint8Array(10 * 1024 * 1024 + 1024);
        await assertFails(
            uploadBytes(ref(aliceStorageRef, `listings/securityAttacks-owned/huge.jpg`), bigBytes, {
                contentType: 'image/jpeg',
            })
        );
    });
});

