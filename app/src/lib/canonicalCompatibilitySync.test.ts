import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateCanonicalRoomCompatibility,
  calculateProfileCompatibility,
  canonicalSeekerFingerprint,
  resolveCanonicalRoomCompatibility,
  COMPATIBILITY_ENGINE_VERSION,
} from './matching';

const fake = vi.hoisted(() => ({
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  readDiscovery: vi.fn(),
  context: vi.fn(),
  auth: { currentUser: { uid: 'owner_b', displayName: 'Owner B' } },
}));

vi.mock('./discoveryGateway', async (original) => ({
  ...(await original<typeof import('./discoveryGateway')>()),
  readDiscovery: fake.readDiscovery,
  getInteractionContext: fake.context,
}));

vi.mock('./firebase', () => ({ db: {}, storage: {}, auth: fake.auth }));

vi.mock('firebase/firestore', async (original) => ({
  ...(await original<typeof import('firebase/firestore')>()),
  collection: (...args: unknown[]) => args.slice(1).join('/'),
  doc: (...args: unknown[]) => args.slice(1).join('/'),
  query: (source: unknown, ...constraints: unknown[]) => ({ source, constraints }),
  where: (...args: unknown[]) => ({ where: args }),
  orderBy: vi.fn(),
  limit: (n: number) => ({ limit: n }),
  getDocs: fake.getDocs,
  getDoc: fake.getDoc,
  onSnapshot: fake.onSnapshot,
}));

import {
  fetchListingApplicantsBackend,
  mapFirestoreListing,
  subscribeLiveConnections,
  subscribeLiveUserChats,
  subscribeOwnerListings,
} from './nestmateBackend';

const seekerA = {
  uid: 'seeker_a',
  onboardingComplete: true,
  city: 'Bengaluru',
  localities: ['Koramangala'],
  budget: 35000,
  gender: 'Male',
  preferredRoomTypes: ['Private room'],
  quizAnswers: { food_pref: 'non_veg', smoking: 'never', pets: 'no', sleep_time: 'after_12' },
};

const listingL = {
  id: 'room_1',
  ownerId: 'owner_b',
  title: '2 BHK Full flat in Koramangala',
  city: 'Bengaluru',
  locality: 'Koramangala',
  monthlyRent: 14000,
  partnerShare: 14000,
  roomType: 'Private room',
  preferredGender: 'Any',
  houseRules: ['Non-smoker', 'No parties'],
};

describe('Canonical compatibility consistency across Seeker Explore, Owner Applicants, and Owner Inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.auth.currentUser = { uid: 'owner_b', displayName: 'Owner B' };
  });

  it('keeps Explore, Server viewerCompatibility, and Profile Fingerprint invalidation in exact sync', () => {
    const serverCompat = {
      ...calculateCanonicalRoomCompatibility(seekerA, listingL, { city: 'Bengaluru', quizAnswers: { smoking: 'never' } }),
      seekerFingerprint: canonicalSeekerFingerprint(seekerA),
    };

    const exploreItem = mapFirestoreListing(
      { id: 'room_1', data: () => ({ ...listingL, viewerCompatibility: serverCompat }) },
      seekerA
    );
    expect(exploreItem.matchPct).toBe(serverCompat.score);

    // Profile preference update immediately invalidates old viewerCompatibility fingerprint on client
    const updatedSeeker = { ...seekerA, city: 'Chennai', budget: 9000 };
    const expectedUpdated = calculateCanonicalRoomCompatibility(updatedSeeker, listingL).score;
    const recalculatedItem = mapFirestoreListing(
      { id: 'room_1', data: () => ({ ...listingL, viewerCompatibility: serverCompat }) },
      updatedSeeker
    );
    expect(recalculatedItem.matchPct).toBe(expectedUpdated);
    expect(recalculatedItem.matchPct).not.toBe(serverCompat.score);
  });

  it('never uses wrong owner-vs-seeker person score (34%) in Owner Applicants or Owner Inbox', async () => {
    const canonical = calculateCanonicalRoomCompatibility(seekerA, listingL);

    fake.readDiscovery.mockImplementation(async (params: any) => {
      if (params.action === 'listingApplicantsCompatibility') {
        return {
          listingId: 'room_1',
          applicants: {
            seeker_a: {
              compatibility: canonical,
              applicantSummary: {
                uid: 'seeker_a',
                name: 'Seeker A',
                city: 'Bengaluru',
                locality: 'Koramangala',
                budget: 35000,
                moveInDate: 'Immediately',
                isVerified: true,
              },
            },
          },
        };
      }
      if (params.action === 'listingCompatibility') {
        return {
          listingId: 'room_1',
          applicantId: 'seeker_a',
          compatibility: canonical,
          applicantSummary: { uid: 'seeker_a', name: 'Seeker A', budget: 35000 },
        };
      }
      if (params.action === 'person') {
        // Simulated buggy person-to-person score (34%) that previously leaked into Applicants!
        return {
          record: {
            uid: 'seeker_a',
            name: 'Seeker A',
            city: 'Bengaluru',
            localities: ['Koramangala'],
            compatibilityScore: 34,
          },
        };
      }
      return { record: null };
    });

    const ownerCallbacks: any[] = [];
    fake.onSnapshot.mockImplementation((_q: any, cb: any) => {
      ownerCallbacks.push(cb);
      return () => {};
    });

    const updates: any[] = [];
    const unsubOwner = subscribeOwnerListings('owner_b', (items) => updates.push(items));
    ownerCallbacks[0]({
      docs: [{ id: 'room_1', data: () => ({ ...listingL, status: 'active' }) }],
    });
    ownerCallbacks[1]({
      docs: [{ id: 'app_1', data: () => ({ listingId: 'room_1', applicantId: 'seeker_a', ownerId: 'owner_b', status: 'pending', matchScore: 34 }) }],
    });
    ownerCallbacks[2]({ docs: [] });

    await vi.waitFor(() => expect(updates.length).toBeGreaterThanOrEqual(1));
    const ownerApp = updates[updates.length - 1][0].ap[0];
    expect(ownerApp.matchScore).toBe(canonical.score);
    expect(ownerApp.user.matchPct).toBe(canonical.score);
    expect(ownerApp.user.matchPct).not.toBe(34);
    unsubOwner();

    // Also verify fetchListingApplicantsBackend overrides person 34% with canonical score
    fake.getDocs.mockImplementation(async (q: any) => {
      if (q.source === 'applications') {
        return { docs: [{ id: 'app_1', data: () => ({ listingId: 'room_1', applicantId: 'seeker_a', ownerId: 'owner_b', status: 'pending', matchScore: 34 }) }] };
      }
      return { docs: [] };
    });
    const directApplicants = await fetchListingApplicantsBackend('room_1');
    expect(directApplicants[0].matchScore).toBe(canonical.score);
    expect(directApplicants[0].user.matchPct).toBe(canonical.score);

    // Also verify subscribeLiveUserChats overrides stale application_card matchScore (34%) with canonical score
    fake.context.mockResolvedValue({ active: true, blocked: false, accepted: false, identity: { uid: 'seeker_a', name: 'Seeker A', isVerified: true } });
    fake.getDocs.mockResolvedValueOnce({
      docs: [{
        id: 'app_app_1_card',
        data: () => ({
          kind: 'application_card',
          senderId: 'seeker_a',
          text: 'Applied for room',
          payload: { applicationId: 'app_1', listingId: 'room_1', matchScore: 34 },
        }),
      }],
    });
    let chatCb: any = null;
    fake.onSnapshot.mockImplementation((_q: any, cb: any) => {
      chatCb = cb;
      return () => {};
    });
    const chatUpdates: any[] = [];
    const unsubChats = subscribeLiveUserChats('owner_b', (rooms) => chatUpdates.push(rooms));
    chatCb({
      docs: [{
        id: 'owner_b___seeker_a',
        data: () => ({
          participants: ['owner_b', 'seeker_a'],
          listingId: 'room_1',
          listingSnapshot: { id: 'room_1', title: listingL.title, rent: 14000, locality: 'Koramangala' },
          threadType: 'application',
          latestApplicationId: 'app_1',
          latestApplicationStatus: 'pending',
          applicantId: 'seeker_a',
          ownerId: 'owner_b',
        }),
      }],
    });
    await vi.waitFor(() => expect(chatUpdates.length).toBeGreaterThanOrEqual(1));
    const thread = chatUpdates[chatUpdates.length - 1][0];
    expect(thread.liveMatchScore).toBe(canonical.score);
    expect(thread.m[0][8].matchScore).toBe(canonical.score);
    unsubChats();
  });

  it('handles missing/invalid inputs safely and exposes consistent engine version', () => {
    const empty = resolveCanonicalRoomCompatibility({}, {}, {});
    expect(empty.score).toBe(0);
    expect(empty.calibrated).toBe(false);
    expect(empty.engineVersion).toBe(COMPATIBILITY_ENGINE_VERSION);

    const malformed = calculateCanonicalRoomCompatibility(
      { budget: Number.NaN, onboardingComplete: true } as any,
      { monthlyRent: -500 } as any
    );
    expect(Number.isFinite(malformed.score)).toBe(true);
    expect(malformed.score).toBeGreaterThanOrEqual(0);
    expect(malformed.score).toBeLessThanOrEqual(100);
  });

  it('infers listing ownership in calculateProfileCompatibility when role is omitted and enriches subscribeLiveConnections with canonical matchScore', async () => {
    const ownerProfile = { uid: 'owner_b', onboardingComplete: true, city: 'Bengaluru', quizAnswers: { smoking: 'never' } };
    const seekerProfile = { ...seekerA, onboardingComplete: true };
    const canonical = calculateCanonicalRoomCompatibility(seekerProfile, listingL, ownerProfile);

    expect(calculateProfileCompatibility(ownerProfile, seekerProfile, listingL).score).toBe(canonical.score);
    expect(calculateProfileCompatibility(seekerProfile, ownerProfile, listingL).score).toBe(canonical.score);

    fake.readDiscovery.mockResolvedValueOnce({
      listingId: 'room_1',
      applicantId: 'seeker_a',
      compatibility: canonical,
    });
    const connCallbacks: any[] = [];
    fake.onSnapshot.mockImplementation((_q: any, cb: any) => {
      connCallbacks.push(cb);
      return () => {};
    });

    const connUpdates: any[] = [];
    const unsub = subscribeLiveConnections('owner_b', (c) => connUpdates.push(c));
    connCallbacks[0]({ docs: [] });
    connCallbacks[1]({
      docs: [{ id: 'conn_1', data: () => ({ fromUserId: 'seeker_a', toUserId: 'owner_b', status: 'pending', listingId: 'room_1' }) }],
    });

    await vi.waitFor(() => expect(connUpdates.some((u) => u.received[0]?.matchScore === canonical.score)).toBe(true));
    expect(connUpdates[connUpdates.length - 1].received[0].matchScore).toBe(canonical.score);
    unsub();

    // Direct listing inquiry chat (no threadType: 'application', no applicantId/ownerId fields) still resolves canonical liveMatchScore
    fake.readDiscovery.mockResolvedValueOnce({
      listingId: 'room_1',
      applicantId: 'seeker_a',
      compatibility: canonical,
    });
    fake.context.mockResolvedValueOnce({ active: true, blocked: false, accepted: true, identity: { uid: 'seeker_a', name: 'Seeker A', isVerified: true } });
    fake.getDocs.mockResolvedValueOnce({
      docs: [{ id: 'm1', data: () => ({ senderId: 'seeker_a', content: 'Is it still available?' }) }],
    });
    let inquiryCb: any = null;
    fake.onSnapshot.mockImplementation((_q: any, cb: any) => {
      inquiryCb = cb;
      return () => {};
    });
    const inquiryUpdates: any[] = [];
    const unsubInquiry = subscribeLiveUserChats('owner_b', (rooms) => inquiryUpdates.push(rooms));
    inquiryCb({
      docs: [{
        id: 'owner_b___seeker_a',
        data: () => ({
          participants: ['owner_b', 'seeker_a'],
          listingId: 'room_1',
          lastMessage: 'Is it still available?',
        }),
      }],
    });
    await vi.waitFor(() => expect(inquiryUpdates.length).toBeGreaterThanOrEqual(1));
    expect(inquiryUpdates[inquiryUpdates.length - 1][0].liveMatchScore).toBe(canonical.score);
    expect(fake.readDiscovery).toHaveBeenCalledWith({
      action: 'listingCompatibility',
      listingId: 'room_1',
      peerId: 'seeker_a',
    });
    unsubInquiry();
  });

  it('guarantees identical match score between Room Seeker Explore and Room Owner Inbox Requests, auto-healing legacy 34%', async () => {
    const ownerProfile = { uid: 'owner_b', onboardingComplete: true, city: 'Bengaluru', quizAnswers: { smoking: 'never' } };
    const seekerProfile = { ...seekerA, onboardingComplete: true };
    const canonical = calculateCanonicalRoomCompatibility(seekerProfile, listingL, ownerProfile);
    expect(canonical.score).toBeGreaterThan(50);

    const serverCompat = {
      ...canonical,
      seekerFingerprint: canonicalSeekerFingerprint(seekerProfile),
    };

    // 1. Seeker sees canonical score on explore listing
    const exploreListing = mapFirestoreListing(
      { id: 'room_1', data: () => ({ ...listingL, ownerId: 'owner_b', viewerCompatibility: serverCompat }) },
      seekerProfile
    );
    expect(exploreListing.matchPct).toBe(canonical.score);

    // 2. Incoming connection created with legacy/buggy 34% or missing score is auto-healed for Owner
    fake.readDiscovery.mockResolvedValueOnce({
      listingId: 'room_1',
      applicantId: 'seeker_a',
      compatibility: canonical,
    });
    const connCallbacks: any[] = [];
    fake.onSnapshot.mockImplementation((_q: any, cb: any) => {
      connCallbacks.push(cb);
      return () => {};
    });

    const connUpdates: any[] = [];
    const unsub = subscribeLiveConnections('owner_b', (c) => connUpdates.push(c));
    connCallbacks[0]({ docs: [] });
    // Simulate legacy connection with 34% received by owner
    connCallbacks[1]({
      docs: [{
        id: 'conn_legacy_34',
        data: () => ({
          fromUserId: 'seeker_a',
          toUserId: 'owner_b',
          status: 'pending',
          listingId: 'room_1',
          matchScore: 34,
        }),
      }],
    });

    await vi.waitFor(() => {
      const latest = connUpdates[connUpdates.length - 1];
      expect(latest?.received[0]?.matchScore).toBe(canonical.score);
      expect(latest?.received[0]?.matchScore).not.toBe(34);
    });
    unsub();
  });
});

