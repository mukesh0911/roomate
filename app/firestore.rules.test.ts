/**
 * Sprint 3C — Firestore Security Rules emulator tests.
 *
 * MANDATORY production-readiness gate: these tests exercise the REAL
 * security rules against the Firebase Firestore Emulator — not source-code
 * inspection. They cover positive AND negative cases for the highest-risk
 * authorization boundaries:
 *
 *   - connections: creation, listing attribution ownership enforcement
 *   - users: trust fields (isVerified etc.) admin-only writes
 *   - reports: reporter identity binding, admin-only reads
 *   - listings: suspended/banned owners blocked
 *   - chat: participant authorization
 *
 * Run with:  npm run test:rules   (starts the Firestore emulator)
 * The suite is SKIPPED unless RUN_RULES_TESTS=1 so plain `npm test`
 * never fails due to a missing emulator.
 */
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
    writeBatch,
    serverTimestamp,
    type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const runRules = process.env.RUN_RULES_TESTS === '1';
const d = runRules ? describe : describe.skip;

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-nestmate';
const RULES_PATH = resolve(__dirname, 'firestore.rules');

const ADMIN_EMAIL = 'admin@nestmate.test';

// Fixture UIDs
const SEEKER = 'seeker-1';
const OWNER = 'owner-1';
const OTHER_OWNER = 'owner-2';
const ATTACKER = 'attacker-1';

let env: RulesTestEnvironment;

// rules-unit-testing bundles its own firebase types; cast to the app's
// Firestore so the shared firebase/firestore helpers type-check.
function fsOf(raw: ReturnType<RulesTestEnvironment['authenticatedContext']> extends never ? never : { firestore(): unknown }): Firestore {
    return raw.firestore() as unknown as Firestore;
}

/**
 * Rules-DISABLED fixture writes. The temporary context is terminated when
 * the callback returns, so ALL writes must happen inside `fn`.
 * Needed because the admins registry cannot bootstrap itself through the
 * rules (chicken-and-egg).
 */
async function seedDisabled<T = void>(fn: (db: Firestore) => Promise<T>): Promise<T> {
    return await env.withSecurityRulesDisabled(async (ctx) => {
        return await fn(fsOf(ctx));
    });
}

/** Admin context THROUGH THE RULES (requires admins/{email} to exist). */
function adminDb(): Firestore {
    return fsOf(env.authenticatedContext('seed-admin', { email: ADMIN_EMAIL }));
}
function seekerDb(): Firestore {
    return fsOf(env.authenticatedContext(SEEKER));
}
function ownerDb(): Firestore {
    return fsOf(env.authenticatedContext(OWNER));
}
function attackerDb(): Firestore {
    return fsOf(env.authenticatedContext(ATTACKER));
}
function bannedDb(): Firestore {
    return fsOf(env.authenticatedContext('banned-1'));
}

async function seed() {
    await seedDisabled(async (db) => {
        // Admin registry entry (email-keyed, per ADMIN_BOOTSTRAP.md)
        await setDoc(doc(db, 'admins', ADMIN_EMAIL), { addedAt: Date.now() });
        // Users
        await setDoc(doc(db, 'users', SEEKER), { name: 'Seeker', role: 'seeker', status: 'active', onboardingComplete: true });
        await setDoc(doc(db, 'users', OWNER), { name: 'Owner', role: 'owner', status: 'active', onboardingComplete: true });
        await setDoc(doc(db, 'users', OTHER_OWNER), { name: 'Other Owner', role: 'owner', status: 'active', onboardingComplete: true });
        await setDoc(doc(db, 'users', ATTACKER), { name: 'Attacker', role: 'seeker', status: 'active', onboardingComplete: true });
        await setDoc(doc(db, 'users', 'banned-1'), { name: 'Banned', role: 'owner', status: 'banned', onboardingComplete: true });
        // Listings
        await setDoc(doc(db, 'listings', 'listing-owned-by-owner'), { title: 'Room A', ownerId: OWNER, city: 'Chennai', status: 'active' });
        await setDoc(doc(db, 'listings', 'listing-owned-by-other'), { title: 'Room B', ownerId: OTHER_OWNER, city: 'Chennai', status: 'active' });
    });
}

d('Firestore security rules (emulator)', () => {
    beforeAll(async () => {
        const hostAndPort = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
        const [host, portStr] = hostAndPort.split(':');
        const port = Number(portStr || 8080);
        env = await initializeTestEnvironment({
            projectId: PROJECT_ID,
            firestore: {
                host,
                port,
                rules: readFileSync(RULES_PATH, 'utf8'),
            },
        });
        await seed();
    }, 30_000);

    afterAll(async () => {
        if (env) {
            await env.cleanup();
        }
    });

    // ── Connections ────────────────────────────────────────────────
    it('UNAUTHENTICATED user CANNOT create a connection', async () => {
        await assertFails(
            addDoc(collection(env.unauthenticatedContext().firestore() as unknown as Firestore, 'connections'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending', createdAt: serverTimestamp(),
            })
        );
    });

    it('seeker CAN create a pending connection (no listingId — legacy shape)', async () => {
        await assertSucceeds(
            addDoc(collection(seekerDb(), 'connections'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending', createdAt: serverTimestamp(),
            })
        );
    });

    it('seeker CAN create a connection attributed to a listing OWNED BY THE RECIPIENT', async () => {
        await assertSucceeds(
            addDoc(collection(seekerDb(), 'connections'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending',
                listingId: 'listing-owned-by-owner', createdAt: serverTimestamp(),
            })
        );
    });

    it('ATTACKER CANNOT claim a listing owned by someone else on a connection', async () => {
        // Attacker sends interest to OWNER but attributes OTHER_OWNER's listing.
        await assertFails(
            addDoc(collection(attackerDb(), 'connections'), {
                fromUserId: ATTACKER, toUserId: OWNER, status: 'pending',
                listingId: 'listing-owned-by-other', createdAt: serverTimestamp(),
            })
        );
    });

    it('connection attributed to a CLOSED listing is REJECTED', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'listings', 'listing-closed'), { title: 'Closed Room', ownerId: OWNER, city: 'Chennai', status: 'closed' });
        });
        await assertFails(
            addDoc(collection(seekerDb(), 'connections'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending',
                listingId: 'listing-closed', createdAt: serverTimestamp(),
            })
        );
    });

    it('connection attributed to a PAUSED listing is REJECTED', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'listings', 'listing-paused'), { title: 'Paused Room', ownerId: OWNER, city: 'Chennai', status: 'paused' });
        });
        await assertFails(
            addDoc(collection(seekerDb(), 'connections'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending',
                listingId: 'listing-paused', createdAt: serverTimestamp(),
            })
        );
    });

    it('connection attributed to a FILLED listing is REJECTED', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'listings', 'listing-filled'), { title: 'Filled Room', ownerId: OWNER, city: 'Chennai', status: 'filled' });
        });
        await assertFails(
            addDoc(collection(seekerDb(), 'connections'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending',
                listingId: 'listing-filled', createdAt: serverTimestamp(),
            })
        );
    });

    it('connection with NONEXISTENT listingId is REJECTED', async () => {
        await assertFails(
            addDoc(collection(seekerDb(), 'connections'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending',
                listingId: 'no-such-listing', createdAt: serverTimestamp(),
            })
        );
    });

    it('sender CANNOT self-accept their own pending request', async () => {
        const ref = await assertSucceeds(
            addDoc(collection(seekerDb(), 'connections'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending', createdAt: serverTimestamp(),
            })
        );
        await assertFails(
            updateDoc(doc(env.authenticatedContext(SEEKER).firestore() as unknown as Firestore, 'connections', ref.id), { status: 'accepted' })
        );
    });

    // ── Server-Side Free Connection Quota (FREE_CONNECT_LIMIT = 5) ──
    it('non-premium seeker CAN create connections 1 to 5 when quota is available', async () => {
        const USER_FIVE = 'seeker-limit-5';
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'users', USER_FIVE), {
                name: 'Five Connections Seeker', role: 'seeker', status: 'active',
                onboardingComplete: true, isPremium: false, connectsUsed: 0,
            });
        });
        const userDb = fsOf(env.authenticatedContext(USER_FIVE));
        for (let i = 1; i <= 5; i++) {
            await assertSucceeds(
                addDoc(collection(userDb, 'connections'), {
                    fromUserId: USER_FIVE, toUserId: `owner-${i}`, status: 'pending', createdAt: serverTimestamp(),
                })
            );
            // Simulate counter update on user doc
            await seedDisabled(async (db) => {
                await updateDoc(doc(db, 'users', USER_FIVE), { connectsUsed: i });
            });
        }
    });

    it('attempting 6th connection via direct Firestore addDoc is REJECTED with PERMISSION_DENIED', async () => {
        const USER_EXHAUSTED = 'seeker-exhausted';
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'users', USER_EXHAUSTED), {
                name: 'Exhausted Seeker', role: 'seeker', status: 'active',
                onboardingComplete: true, isPremium: false, connectsUsed: 5,
            });
        });
        const userDb = fsOf(env.authenticatedContext(USER_EXHAUSTED));
        // Direct Firestore bypass attempt: Calling addDoc on connections
        await assertFails(
            addDoc(collection(userDb, 'connections'), {
                fromUserId: USER_EXHAUSTED, toUserId: OWNER, status: 'pending', createdAt: serverTimestamp(),
            })
        );
    });

    it('PREMIUM seeker CAN create connections beyond 5 without quota restriction', async () => {
        const USER_PREMIUM = 'seeker-pro-user';
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'users', USER_PREMIUM), {
                name: 'Pro Seeker', role: 'seeker', status: 'active',
                onboardingComplete: true, isPremium: true, connectsUsed: 10,
            });
        });
        const userDb = fsOf(env.authenticatedContext(USER_PREMIUM));
        await assertSucceeds(
            addDoc(collection(userDb, 'connections'), {
                fromUserId: USER_PREMIUM, toUserId: OWNER, status: 'pending', createdAt: serverTimestamp(),
            })
        );
    });

    it('seeker CANNOT decrement connectsUsed on user document to reset quota', async () => {
        const USER_TAMPER = 'seeker-tamperer';
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'users', USER_TAMPER), {
                name: 'Tamper Seeker', role: 'seeker', status: 'active',
                onboardingComplete: true, isPremium: false, connectsUsed: 5,
            });
        });
        const userDb = fsOf(env.authenticatedContext(USER_TAMPER));
        await assertFails(
            updateDoc(doc(userDb, 'users', USER_TAMPER), {
                connectsUsed: 0,
            })
        );
    });

    // ── Trust fields ───────────────────────────────────────────────
    it('NORMAL USER CANNOT grant themselves isVerified', async () => {
        await assertFails(
            setDoc(doc(seekerDb(), 'users', SEEKER), { isVerified: true }, { merge: true })
        );
    });

    it('ADMIN CAN set isVerified', async () => {
        await assertSucceeds(
            setDoc(doc(adminDb(), 'users', SEEKER), { isVerified: true }, { merge: true })
        );
        const snap = await assertSucceeds(getDoc(doc(seekerDb(), 'users', SEEKER)));
        expect(snap.data()?.isVerified).toBe(true);
    });

    // ── Reports ────────────────────────────────────────────────────
    it('user CANNOT spoof another reporter identity', async () => {
        await assertFails(
            addDoc(collection(seekerDb(), 'reports'), {
                reporterId: OWNER, targetId: ATTACKER, reason: 'spam', status: 'pending',
            })
        );
    });

    it('authenticated user CANNOT read reports; ADMIN CAN', async () => {
        await assertFails(getDoc(doc(seekerDb(), 'reports', 'some-report')));
        await assertSucceeds(getDoc(doc(adminDb(), 'reports', 'some-report')));
    }, 30_000);

    it('a formerly hard-coded email is NOT admin without an admins registry document', async () => {
        const unregistered = fsOf(env.authenticatedContext('not-an-admin', { email: 'admin@nestmate.in' }));
        await assertFails(getDoc(doc(unregistered, 'reports', 'some-report')));
    });

    it('user CANNOT write contact PII into their public profile', async () => {
        await assertFails(
            setDoc(doc(seekerDb(), 'users', SEEKER), {
                phone: '+919876543210',
                email: 'private@example.test',
            }, { merge: true })
        );
    });

    it('user CAN clear legacy public PII while updating their profile', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'users', SEEKER), {
                phone: '+919876543210', email: 'legacy@example.test',
            }, { merge: true });
        });
        await assertSucceeds(
            setDoc(doc(seekerDb(), 'users', SEEKER), {
                phone: '', email: '', workEmail: '', whatsappNumber: '', bio: 'Updated safely',
            }, { merge: true })
        );
    });

    // Accepted-pair integrity
    it('participant CANNOT fabricate an acceptedPairs record for a pending connection', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'connections', 'pending-pair-attack'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending', createdAt: Date.now(),
            });
        });
        await assertFails(setDoc(doc(seekerDb(), 'acceptedPairs', `${SEEKER}_${OWNER}`), {
            user1: SEEKER, user2: OWNER, connectionId: 'pending-pair-attack', createdAt: serverTimestamp(),
        }));
    });

    it('recipient CAN atomically accept a connection and create both directional accepted pairs', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'connections', 'atomic-accept'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'pending', createdAt: Date.now(),
            });
        });
        const db = ownerDb();
        const batch = writeBatch(db);
        batch.update(doc(db, 'connections', 'atomic-accept'), { status: 'accepted' });
        batch.set(doc(db, 'acceptedPairs', `${SEEKER}_${OWNER}`), {
            user1: SEEKER, user2: OWNER, connectionId: 'atomic-accept', createdAt: serverTimestamp(),
        });
        batch.set(doc(db, 'acceptedPairs', `${OWNER}_${SEEKER}`), {
            user1: OWNER, user2: SEEKER, connectionId: 'atomic-accept', createdAt: serverTimestamp(),
        });
        await assertSucceeds(batch.commit());
    });

    // ── Suspended / banned enforcement ─────────────────────────────
    it('BANNED user CANNOT create a listing', async () => {
        await assertFails(
            addDoc(collection(bannedDb(), 'listings'), {
                title: 'Sneaky Room', ownerId: 'banned-1', city: 'Chennai', status: 'active',
            })
        );
    });

    // ── Chat ───────────────────────────────────────────────────────
    it('non-participant CANNOT read a chat room', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'chatRooms', 'room-x'), { participants: [SEEKER, OWNER] });
        });
        await assertFails(getDoc(doc(attackerDb(), 'chatRooms', 'room-x')));
        await assertSucceeds(getDoc(doc(seekerDb(), 'chatRooms', 'room-x')));
    });

    it('user CANNOT create a chat without an accepted relationship', async () => {
        await assertFails(setDoc(doc(seekerDb(), 'chatRooms', 'unaccepted-room'), {
            participants: [SEEKER, OTHER_OWNER], createdAt: serverTimestamp(),
        }));
    });

    it('accepted participant CAN create a two-person chat', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'connections', 'accepted-chat-connection'), {
                fromUserId: SEEKER, toUserId: OWNER, status: 'accepted', createdAt: Date.now(),
            });
            await setDoc(doc(db, 'acceptedPairs', `${SEEKER}_${OWNER}`), {
                user1: SEEKER, user2: OWNER, connectionId: 'accepted-chat-connection', createdAt: Date.now(),
            });
        });
        await assertSucceeds(setDoc(doc(seekerDb(), 'chatRooms', 'accepted-room'), {
            participants: [SEEKER, OWNER], createdAt: serverTimestamp(), lastMessage: '', lastMessageAt: null,
        }));
    });

    it('chat participant CANNOT add a third participant', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'chatRooms', 'fixed-membership-room'), {
                participants: [SEEKER, OWNER], createdAt: Date.now(), lastMessage: '',
            });
        });
        await assertFails(updateDoc(doc(seekerDb(), 'chatRooms', 'fixed-membership-room'), {
            participants: [SEEKER, OWNER, ATTACKER],
        }));
    });

    it('chat participant CANNOT spoof another message sender', async () => {
        await seedDisabled(async (db) => {
            await setDoc(doc(db, 'chatRooms', 'message-room'), { participants: [SEEKER, OWNER] });
        });
        await assertFails(addDoc(collection(seekerDb(), 'chatRooms', 'message-room', 'messages'), {
            senderId: OWNER, content: 'spoofed', read: false, createdAt: serverTimestamp(),
        }));
        await assertSucceeds(addDoc(collection(seekerDb(), 'chatRooms', 'message-room', 'messages'), {
            senderId: SEEKER, content: 'authentic', read: false, createdAt: serverTimestamp(),
        }));
    });

    // Notification integrity
    it('user CANNOT create an arbitrary notification for an unrelated recipient', async () => {
        await assertFails(addDoc(collection(attackerDb(), 'notifications'), {
            userId: OWNER, actorId: ATTACKER, type: 'system', title: 'Fake admin',
            description: 'Spoofed notice', read: false, createdAt: serverTimestamp(),
        }));
    });

    it('user CAN create a bounded self-notification', async () => {
        await assertSucceeds(addDoc(collection(seekerDb(), 'notifications'), {
            userId: SEEKER, actorId: SEEKER, type: 'verification', title: 'Complete verification',
            description: 'Verify your profile.', read: false, createdAt: serverTimestamp(),
        }));
    });

    it('anonymous visitor CAN create a bounded support ticket but CANNOT read it', async () => {
        const anonDb = env.unauthenticatedContext().firestore() as unknown as Firestore;
        const ticket = await assertSucceeds(addDoc(collection(anonDb, 'supportTickets'), {
            userId: 'anonymous', userEmail: null, userPhone: null, userName: 'Anonymous User',
            topic: 'other', message: 'Please help', status: 'open', createdAt: serverTimestamp(),
        }));
        await assertFails(getDoc(doc(anonDb, 'supportTickets', ticket.id)));
    });

    // ── Owner Verification Security Gate ───────────────────────────
    describe('Owner Verification Security Gate Rules', () => {
        it('Owner CAN submit identity verification (SUBMITTED status)', async () => {
            await assertSucceeds(
                setDoc(doc(ownerDb(), 'ownerVerifications', OWNER), {
                    userId: OWNER,
                    status: 'SUBMITTED',
                    documentType: 'AADHAAR',
                    documentUrl: 'https://storage.googleapis.com/test-bucket/aadhaar.png',
                    declaredName: 'Test Owner',
                    submittedAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    resubmissionCount: 0,
                })
            );
        });

        it('Owner CANNOT self-approve verification (status=APPROVED)', async () => {
            await assertFails(
                setDoc(doc(ownerDb(), 'ownerVerifications', OWNER), {
                    userId: OWNER,
                    status: 'APPROVED',
                    documentType: 'AADHAAR',
                    documentUrl: 'https://storage.googleapis.com/test-bucket/aadhaar.png',
                    declaredName: 'Test Owner',
                })
            );
        });

        it('Admin CAN approve owner verification (status=APPROVED)', async () => {
            await assertSucceeds(
                setDoc(doc(adminDb(), 'ownerVerifications', OWNER), {
                    status: 'APPROVED',
                    reviewedBy: 'seed-admin',
                    reviewedAt: serverTimestamp(),
                }, { merge: true })
            );
        });

        it('Owner CANNOT create a listing with status=active', async () => {
            await assertFails(
                addDoc(collection(ownerDb(), 'listings'), {
                    title: 'Bypass Room',
                    ownerId: OWNER,
                    city: 'Chennai',
                    status: 'active',
                    ownerVerified: false,
                })
            );
        });

        it('Owner CANNOT create a listing with ownerVerified=true', async () => {
            await assertFails(
                addDoc(collection(ownerDb(), 'listings'), {
                    title: 'Bypass Room 2',
                    ownerId: OWNER,
                    city: 'Chennai',
                    status: 'pending_verification',
                    ownerVerified: true,
                })
            );
        });

        it('Owner CAN create a listing with status=pending_verification and ownerVerified=false', async () => {
            await assertSucceeds(
                addDoc(collection(ownerDb(), 'listings'), {
                    title: 'Legitimate Pending Room',
                    ownerId: OWNER,
                    city: 'Chennai',
                    status: 'pending_verification',
                    ownerVerified: false,
                })
            );
        });

        it('Owner CANNOT activate an unverified listing via updateDoc', async () => {
            const listingId = 'unverified-room-owner-update';
            await seedDisabled(async (db) => {
                await setDoc(doc(db, 'listings', listingId), {
                    title: 'Unverified Room',
                    ownerId: OWNER,
                    city: 'Chennai',
                    status: 'pending_verification',
                    ownerVerified: false,
                });
            });
            await assertFails(
                updateDoc(doc(ownerDb(), 'listings', listingId), {
                    status: 'active',
                })
            );
        });

        it('Admin CAN activate an unverified listing and set ownerVerified=true', async () => {
            const listingId = 'unverified-room-admin-update';
            await seedDisabled(async (db) => {
                await setDoc(doc(db, 'listings', listingId), {
                    title: 'Admin Unlocked Room',
                    ownerId: OWNER,
                    city: 'Chennai',
                    status: 'pending_verification',
                    ownerVerified: false,
                });
            });
            await assertSucceeds(
                updateDoc(doc(adminDb(), 'listings', listingId), {
                    status: 'active',
                    ownerVerified: true,
                })
            );
        });
    });
});
