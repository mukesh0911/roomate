import { describe, it, expect } from 'vitest';
import {
  resolveUserHousingIntent,
  validateLiveInListingRelationship,
  type ListingVerificationContext,
} from './userIntent';
import { mapFirestoreUser, type RoommateItem } from './nestmateBackend';

describe('Phase 2 — Final Security & Occupancy Verification Regression Suite', () => {
  const currentUserId = 'auth_user_mukesh';

  // Valid listing context with reliable occupancy evidence (isLiveInRoom === true)
  const verifiedLiveInListingContext: ListingVerificationContext = {
    id: 'list_livein_active',
    ownerId: 'host_uid_01',
    status: 'active',
    isDeleted: false,
    flatType: '2BHK',
    roomType: 'Private room',
    partnersNeeded: 1,
    isLiveInRoom: true,
  };

  // ---------------------------------------------------------------------------
  // Req 3.1: Team-Up seeker eligibility
  // ---------------------------------------------------------------------------
  it('Req 3.1: Team-Up seeker is eligible for roommate discovery without owning a listing', () => {
    const teamUpSeeker = {
      uid: 'teamup_seeker_1',
      name: 'Aarav Patel',
      role: 'seeker',
      status: 'active',
      housingPreferences: {
        activeIntents: ['team_up' as const],
      },
    };

    const resolved = resolveUserHousingIntent(teamUpSeeker);
    expect(resolved.isTeamUpSeeker).toBe(true);
    expect(resolved.isDiscoveryEligible).toBe(true);
    expect(resolved.displayBadge.text).toBe('Teaming Up for a Room');
  });

  // ---------------------------------------------------------------------------
  // Req 3.2: Live-in Host eligibility with reliable occupancy evidence
  // ---------------------------------------------------------------------------
  it('Req 3.2: Live-in Host with explicit association and reliable occupancy evidence (isLiveInRoom) is eligible', () => {
    const liveInHostUser = {
      uid: 'host_uid_01',
      name: 'Gowtham Pavan',
      role: 'owner',
      status: 'active',
      housingPreferences: {
        activeIntents: ['have_room' as const],
        associatedListingId: 'list_livein_active',
      },
    };

    const resolved = resolveUserHousingIntent(liveInHostUser, [verifiedLiveInListingContext]);
    expect(resolved.isLiveInHost).toBe(true);
    expect(resolved.isDiscoveryEligible).toBe(true);
    expect(resolved.associatedListingId).toBe('list_livein_active');
    expect(resolved.displayBadge.text).toBe('Room Available');
  });

  // ---------------------------------------------------------------------------
  // Req 3.3: Unverified resident declaration excluded
  // ---------------------------------------------------------------------------
  it('Req 3.3: Unverified resident declaration (owner_flatmate role or have_room without isLiveInRoom) is excluded', () => {
    const unverifiedListing: ListingVerificationContext = {
      id: 'list_unverified_decl',
      ownerId: 'host_decl_01',
      status: 'active',
      isDeleted: false,
      flatType: '2BHK',
      roomType: 'Private room',
      // isLiveInRoom is absent / false (no verified occupancy evidence)
    };

    const hostWithOnlyDeclaration = {
      uid: 'host_decl_01',
      name: 'Rohan DeclaredResident',
      role: 'owner',
      ownerType: 'owner_flatmate', // Merely a user-declared value
      status: 'active',
      housingPreferences: {
        activeIntents: ['have_room' as const],
        associatedListingId: 'list_unverified_decl',
      },
    };

    const resolved = resolveUserHousingIntent(hostWithOnlyDeclaration, [unverifiedListing]);
    expect(resolved.isLiveInHost).toBe(false);
    expect(resolved.isDiscoveryEligible).toBe(false);
    expect(resolved.associatedListingId).toBeUndefined();
    expect(resolved.discoveryIneligibilityReason).toBe('have_room_unverified_listing');
  });

  // ---------------------------------------------------------------------------
  // Req 3.4: Commercial landlord excluded even with a private-room listing
  // ---------------------------------------------------------------------------
  it('Req 3.4: Commercial landlord is excluded even with a private-room listing', () => {
    const privateRoomListing: ListingVerificationContext = {
      id: 'list_commercial_pvt',
      ownerId: 'commercial_landlord_uid',
      status: 'active',
      isDeleted: false,
      roomType: 'Private room',
      partnersNeeded: 1,
      isLiveInRoom: true, // Even if landlord claims live-in room
    };

    const commercialLandlord = {
      uid: 'commercial_landlord_uid',
      name: 'Commercial Real Estate Owner',
      role: 'owner',
      ownerType: 'landlord',
      status: 'active',
      housingPreferences: {
        activeIntents: ['have_room' as const],
        associatedListingId: 'list_commercial_pvt',
      },
    };

    const resolved = resolveUserHousingIntent(commercialLandlord, [privateRoomListing]);
    expect(resolved.isPropertyHost).toBe(true);
    expect(resolved.isLiveInHost).toBe(false);
    expect(resolved.isDiscoveryEligible).toBe(false);
    expect(resolved.discoveryIneligibilityReason).toBe('commercial_landlord_only');
  });

  // ---------------------------------------------------------------------------
  // Req 3.5: Commercial landlord with genuine Team-Up intent remains eligible as Team-Up seeker
  // ---------------------------------------------------------------------------
  it('Req 3.5: Commercial landlord with genuine Team-Up intent remains eligible as Team-Up seeker', () => {
    const commercialLandlordWithTeamUp = {
      uid: 'landlord_teamup_uid',
      name: 'Sunil Verma',
      role: 'owner',
      ownerType: 'landlord',
      status: 'active',
      housingPreferences: {
        activeIntents: ['team_up' as const],
      },
    };

    const resolved = resolveUserHousingIntent(commercialLandlordWithTeamUp);
    expect(resolved.isTeamUpSeeker).toBe(true);
    expect(resolved.isDiscoveryEligible).toBe(true);
    expect(resolved.displayBadge.text).toBe('Teaming Up for a Room');
  });

  // ---------------------------------------------------------------------------
  // Req 3.6: Ambiguous listing association excluded
  // ---------------------------------------------------------------------------
  it('Req 3.6: Multiple candidate listings without explicit association are marked ambiguous and excluded', () => {
    const listingA: ListingVerificationContext = {
      id: 'listing_alpha',
      ownerId: 'multi_host_uid',
      status: 'active',
      isDeleted: false,
      flatType: '2BHK',
      isLiveInRoom: true,
    };
    const listingB: ListingVerificationContext = {
      id: 'listing_beta',
      ownerId: 'multi_host_uid',
      status: 'active',
      isDeleted: false,
      flatType: '3BHK',
      isLiveInRoom: true,
    };

    const userWithMultipleListings = {
      uid: 'multi_host_uid',
      name: 'Multi Property User',
      role: 'owner',
      ownerType: 'owner_flatmate',
      status: 'active',
      housingPreferences: {
        activeIntents: ['have_room' as const],
        // No explicit associatedListingId provided!
      },
    };

    const resolved = resolveUserHousingIntent(userWithMultipleListings, [listingA, listingB]);
    expect(resolved.isLiveInHost).toBe(false);
    expect(resolved.isDiscoveryEligible).toBe(false);
    expect(resolved.associatedListingId).toBeUndefined();
    expect(resolved.discoveryIneligibilityReason).toBe('have_room_ambiguous_listings');
  });

  // ---------------------------------------------------------------------------
  // Req 3.7: Foreign, deleted and inactive listing associations excluded
  // ---------------------------------------------------------------------------
  it('Req 3.7a: Foreign listing association (owned by another UID) is excluded', () => {
    const foreignListing: ListingVerificationContext = {
      id: 'list_other_owner',
      ownerId: 'real_owner_uid',
      status: 'active',
      isDeleted: false,
      isLiveInRoom: true,
    };

    const imposterUser = {
      uid: 'imposter_uid',
      name: 'Imposter Seeker',
      role: 'seeker',
      status: 'active',
      housingPreferences: {
        activeIntents: ['have_room' as const],
        associatedListingId: 'list_other_owner',
      },
    };

    const resolved = resolveUserHousingIntent(imposterUser, [foreignListing]);
    expect(resolved.isLiveInHost).toBe(false);
    expect(resolved.isDiscoveryEligible).toBe(false);
    expect(resolved.discoveryIneligibilityReason).toBe('have_room_unverified_listing');
  });

  it('Req 3.7b: Deleted listing association is excluded', () => {
    const deletedListing: ListingVerificationContext = {
      id: 'list_deleted_01',
      ownerId: 'host_uid_01',
      status: 'active',
      isDeleted: true,
      isLiveInRoom: true,
    };

    const hostWithDeleted = {
      uid: 'host_uid_01',
      name: 'Gowtham Pavan',
      role: 'owner',
      status: 'active',
      housingPreferences: {
        activeIntents: ['have_room' as const],
        associatedListingId: 'list_deleted_01',
      },
    };

    const resolved = resolveUserHousingIntent(hostWithDeleted, [deletedListing]);
    expect(resolved.isLiveInHost).toBe(false);
    expect(resolved.isDiscoveryEligible).toBe(false);
    expect(resolved.discoveryIneligibilityReason).toBe('have_room_unverified_listing');
  });

  it('Req 3.7c: Inactive listing association (closed/paused/draft) is excluded', () => {
    const closedListing: ListingVerificationContext = {
      id: 'list_closed_01',
      ownerId: 'host_uid_01',
      status: 'closed',
      isDeleted: false,
      isLiveInRoom: true,
    };

    const hostWithClosed = {
      uid: 'host_uid_01',
      name: 'Gowtham Pavan',
      role: 'owner',
      status: 'active',
      housingPreferences: {
        activeIntents: ['have_room' as const],
        associatedListingId: 'list_closed_01',
      },
    };

    const resolved = resolveUserHousingIntent(hostWithClosed, [closedListing]);
    expect(resolved.isLiveInHost).toBe(false);
    expect(resolved.isDiscoveryEligible).toBe(false);
    expect(resolved.discoveryIneligibilityReason).toBe('have_room_unverified_listing');
  });

  // ---------------------------------------------------------------------------
  // Req 3.8: Logged-in user's own profile excluded while other candidates remain
  // ---------------------------------------------------------------------------
  it('Req 3.8: Discovery processing pipeline excludes own profile while admitting eligible peers', () => {
    const activeListings: ListingVerificationContext[] = [
      {
        id: 'list_peer_livein',
        ownerId: 'peer_livein_uid',
        status: 'active',
        isDeleted: false,
        isLiveInRoom: true,
      },
    ];

    const rawCandidatePool = [
      // 1. Current logged-in user (Must be excluded by UID)
      {
        id: currentUserId,
        uid: currentUserId,
        name: 'Mukesh Ram',
        role: 'owner',
        status: 'active',
        housingPreferences: { activeIntents: ['team_up' as const] },
      },
      // 2. Eligible Team-Up Seeker
      {
        id: 'peer_teamup_uid',
        uid: 'peer_teamup_uid',
        name: 'Aarav Patel',
        role: 'seeker',
        status: 'active',
        housingPreferences: { activeIntents: ['team_up' as const] },
      },
      // 3. Eligible Live-in Host
      {
        id: 'peer_livein_uid',
        uid: 'peer_livein_uid',
        name: 'Sneha Rao',
        role: 'owner',
        status: 'active',
        housingPreferences: {
          activeIntents: ['have_room' as const],
          associatedListingId: 'list_peer_livein',
        },
      },
      // 4. Ineligible: Find Room Only
      {
        id: 'peer_findroom_uid',
        uid: 'peer_findroom_uid',
        name: 'Aditi Sharma',
        role: 'seeker',
        status: 'active',
        housingPreferences: { activeIntents: ['find_room' as const] },
      },
      // 5. Ineligible: Commercial Landlord
      {
        id: 'peer_landlord_uid',
        uid: 'peer_landlord_uid',
        name: 'Commercial Landlord',
        role: 'owner',
        ownerType: 'landlord',
        status: 'active',
      },
    ];

    const listingsByOwner: Record<string, ListingVerificationContext[]> = {};
    activeListings.forEach((l) => {
      if (!listingsByOwner[l.ownerId]) listingsByOwner[l.ownerId] = [];
      listingsByOwner[l.ownerId].push(l);
    });

    // Run exact pipeline from subscribeLiveRoommates
    const discoveredCandidates = rawCandidatePool
      .filter((d) => {
        const uid = d.id || d.uid;
        if (currentUserId && uid === currentUserId) return false;
        if (!d.name || d.name.trim() === '') return false;
        return true;
      })
      .map((d) => {
        const userListings = listingsByOwner[d.uid] || [];
        return mapFirestoreUser(d, undefined, userListings);
      })
      .filter((m: RoommateItem) => m.resolvedIntent?.isDiscoveryEligible === true);

    const names = discoveredCandidates.map((c) => c.name);
    expect(names).not.toContain('Mukesh Ram');
    expect(names).toContain('Aarav Patel');
    expect(names).toContain('Sneha Rao');
    expect(names).not.toContain('Aditi Sharma');
    expect(names).not.toContain('Commercial Landlord');
    expect(discoveredCandidates.length).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Additional validations: Moderation and Multi-Intent
  // ---------------------------------------------------------------------------
  it('Admin, banned, suspended, and inactive users are excluded', () => {
    const admin = { uid: 'admin_1', name: 'Admin', role: 'admin', status: 'active' };
    const banned = { uid: 'banned_1', name: 'Banned', status: 'banned', housingPreferences: { activeIntents: ['team_up' as const] } };
    const suspended = { uid: 'susp_1', name: 'Suspended', status: 'suspended', housingPreferences: { activeIntents: ['team_up' as const] } };
    const inactive = { uid: 'inact_1', name: 'Inactive', status: 'active', housingPreferences: { activeIntents: ['team_up' as const], isActivelySearching: false } };

    expect(resolveUserHousingIntent(admin).discoveryIneligibilityReason).toBe('admin');
    expect(resolveUserHousingIntent(banned).discoveryIneligibilityReason).toBe('banned');
    expect(resolveUserHousingIntent(suspended).discoveryIneligibilityReason).toBe('suspended');
    expect(resolveUserHousingIntent(inactive).discoveryIneligibilityReason).toBe('inactive_search');
  });

  it('Multiple active intents (find_room + team_up) qualify user via Team-Up', () => {
    const dualSeeker = {
      uid: 'dual_seeker_1',
      name: 'Karan Mehra',
      role: 'seeker',
      status: 'active',
      housingPreferences: {
        activeIntents: ['find_room' as const, 'team_up' as const],
      },
    };

    const resolved = resolveUserHousingIntent(dualSeeker);
    expect(resolved.isTeamUpSeeker).toBe(true);
    expect(resolved.isLookingForRoom).toBe(true);
    expect(resolved.isDiscoveryEligible).toBe(true);
    expect(resolved.displayBadge.text).toBe('Seeking Room & Team-Up');
  });
});
