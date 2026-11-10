import { describe, it, expect } from 'vitest';
import {
  getUserIntent,
  getPreferredRoommateGender,
  getUserInitials,
  resolveUserHousingIntent,
  validateLiveInListingRelationship,
  normalizeLegacyHousingIntent,
  validateHousingPreferences,
  buildCanonicalPreferencesFromLegacy,
  type UserHousingPreferences,
  type ListingVerificationContext,
} from './userIntent';

describe('User Intent & Semantic Clarity Unit Tests', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // CANONICAL PHASE 1 ARCHITECTURE TESTS
  // ───────────────────────────────────────────────────────────────────────────

  describe('Scenario A – Find a Room', () => {
    it('classifies user with find_room as Room Seeker and not Team-Up or Live-in Host', () => {
      const user = {
        uid: 'seeker_01',
        name: 'Rohan Sharma',
        role: 'seeker' as const,
        status: 'active',
        housingPreferences: {
          activeIntents: ['find_room' as const],
          budgetMin: 15000,
          budgetMax: 20000,
          preferredCities: ['Bengaluru'],
          preferredLocalities: ['Indiranagar'],
        },
      };

      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toEqual(['find_room']);
      expect(resolved.isLookingForRoom).toBe(true);
      expect(resolved.isTeamUpSeeker).toBe(false);
      expect(resolved.isLiveInHost).toBe(false);
      expect(resolved.isPropertyHost).toBe(false);
      expect(resolved.hasValidAvailableRoom).toBe(false);
      expect(resolved.needsIntentCompletion).toBe(false);
      expect(resolved.isDiscoveryEligible).toBe(false);
      expect(resolved.discoveryIneligibilityReason).toBe('find_room_only');
      expect(resolved.displayBadge.text).toBe('Looking for a room');
      expect(resolved.displayBadge.variant).toBe('seeker');
    });
  });

  describe('Scenario B – Team-Up & Rent Together', () => {
    it('classifies user with team_up as Team-Up Seeker without requiring a room listing', () => {
      const user = {
        uid: 'teamup_01',
        name: 'Pooja Iyer',
        role: 'seeker' as const,
        status: 'active',
        housingPreferences: {
          activeIntents: ['team_up' as const],
          budgetMin: 16000,
          budgetMax: 22000,
          preferredCities: ['Bengaluru'],
          preferredLocalities: ['Koramangala'],
        },
      };

      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toEqual(['team_up']);
      expect(resolved.isLookingForRoom).toBe(false);
      expect(resolved.isTeamUpSeeker).toBe(true);
      expect(resolved.isLiveInHost).toBe(false);
      expect(resolved.hasValidAvailableRoom).toBe(false);
      expect(resolved.needsIntentCompletion).toBe(false);
      expect(resolved.isDiscoveryEligible).toBe(true);
      expect(resolved.discoveryIneligibilityReason).toBeUndefined();
      expect(resolved.displayBadge.text).toBe('Teaming Up for a Room');
      expect(resolved.displayBadge.variant).toBe('team_up');
    });
  });

  describe('Scenario C – Live-in Host / Resident Flatmate', () => {
    it('classifies user with have_room as Live-in Host only when verified active listing exists', () => {
      const user = {
        uid: 'host_01',
        name: 'Gowtham Pavan',
        role: 'owner' as const,
        ownerType: 'owner_flatmate',
        status: 'active',
        housingPreferences: {
          activeIntents: ['have_room' as const],
          associatedListingId: 'list_gowtham_1',
        },
      };

      const validListing: ListingVerificationContext = {
        id: 'list_gowtham_1',
        ownerId: 'host_01',
        status: 'active',
        isDeleted: false,
        totalRent: 16000,
        flatType: '2BHK',
        isLiveInRoom: true,
      };

      const resolved = resolveUserHousingIntent(user, validListing);
      expect(resolved.activeIntents).toEqual(['have_room']);
      expect(resolved.isLiveInHost).toBe(true);
      expect(resolved.hasValidAvailableRoom).toBe(true);
      expect(resolved.associatedListingId).toBe('list_gowtham_1');
      expect(resolved.displayBadge.text).toBe('Room Available');
      expect(resolved.displayBadge.variant).toBe('live_in_host');
    });

    it('rejects Live-in Host classification if no active listing is verified', () => {
      const userWithoutListing = {
        uid: 'host_unverified',
        name: 'Host Without Room',
        role: 'owner' as const,
        ownerType: 'owner_flatmate',
        status: 'active',
        housingPreferences: {
          activeIntents: ['have_room' as const],
        },
      };

      const resolved = resolveUserHousingIntent(userWithoutListing, null);
      expect(resolved.isLiveInHost).toBe(false);
      expect(resolved.hasValidAvailableRoom).toBe(false);
      expect(resolved.associatedListingId).toBeUndefined();
    });
  });

  describe('Scenario D – Multiple Concurrent Intents', () => {
    it('preserves both find_room and team_up simultaneously without discarding either', () => {
      const user = {
        uid: 'dual_01',
        name: 'Aditi Sharma',
        role: 'seeker' as const,
        status: 'active',
        housingPreferences: {
          activeIntents: ['find_room' as const, 'team_up' as const],
        },
      };

      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toHaveLength(2);
      expect(resolved.activeIntents).toContain('find_room');
      expect(resolved.activeIntents).toContain('team_up');
      expect(resolved.isLookingForRoom).toBe(true);
      expect(resolved.isTeamUpSeeker).toBe(true);
      expect(resolved.displayBadge.text).toBe('Seeking Room & Team-Up');
    });
  });

  describe('Scenario E – Commercial Landlord vs Live-in Host', () => {
    it('classifies commercial landlord as Property Host and excludes from roommate discovery', () => {
      const landlord = {
        uid: 'landlord_01',
        name: 'Ramesh Gupta',
        role: 'owner' as const,
        ownerType: 'landlord',
        status: 'active',
        hasActiveListing: true,
      };

      const commercialListing: ListingVerificationContext = {
        id: 'prop_01',
        ownerId: 'landlord_01',
        status: 'active',
        isLiveInRoom: false,
      };

      const resolved = resolveUserHousingIntent(landlord, commercialListing);
      expect(resolved.isPropertyHost).toBe(true);
      expect(resolved.isLiveInHost).toBe(false);
      expect(resolved.isDiscoveryEligible).toBe(false);
      expect(resolved.discoveryIneligibilityReason).toBe('commercial_landlord_only');
      expect(resolved.displayBadge.text).toBe('Property Host');
      expect(resolved.displayBadge.variant).toBe('property_host');
    });
  });

  describe('Scenario F – Incomplete Legacy Profile', () => {
    it('marks profile as needsIntentCompletion without fabricating default intents', () => {
      const incompleteUser = {
        uid: 'incomplete_01',
        name: 'New Registered User',
        status: 'active',
      };

      const resolved = resolveUserHousingIntent(incompleteUser);
      expect(resolved.activeIntents).toEqual([]);
      expect(resolved.needsIntentCompletion).toBe(true);
      expect(resolved.isLookingForRoom).toBe(false);
      expect(resolved.isTeamUpSeeker).toBe(false);
      expect(resolved.isLiveInHost).toBe(false);
      expect(resolved.isDiscoveryEligible).toBe(false);
      expect(resolved.discoveryIneligibilityReason).toBe('no_active_intent');
      expect(resolved.displayBadge.text).toBe('Intent Needed');
    });
  });

  describe('Scenario G – Invalid & Legacy Values Normalization', () => {
    it('normalizes legacy find_room string', () => {
      const res = normalizeLegacyHousingIntent('find_room');
      expect(res.intents).toEqual(['find_room']);
      expect(res.isAmbiguous).toBe(false);
    });

    it('normalizes legacy team_up string', () => {
      const res = normalizeLegacyHousingIntent('team_up');
      expect(res.intents).toEqual(['team_up']);
      expect(res.isAmbiguous).toBe(false);
    });

    it('normalizes legacy have_room string', () => {
      const res = normalizeLegacyHousingIntent('have_room');
      expect(res.intents).toEqual(['have_room']);
      expect(res.isAmbiguous).toBe(false);
    });

    it('normalizes legacy roommate_for_my_room string', () => {
      const res = normalizeLegacyHousingIntent('roommate_for_my_room');
      expect(res.intents).toEqual(['have_room']);
      expect(res.isAmbiguous).toBe(false);
    });

    it('normalizes legacy room_and_roommate string into both find_room and team_up', () => {
      const res = normalizeLegacyHousingIntent('room_and_roommate');
      expect(res.intents).toContain('find_room');
      expect(res.intents).toContain('team_up');
      expect(res.isAmbiguous).toBe(false);
    });

    it('handles empty and null values safely', () => {
      expect(normalizeLegacyHousingIntent(null).intents).toEqual([]);
      expect(normalizeLegacyHousingIntent('').intents).toEqual([]);
      expect(normalizeLegacyHousingIntent(undefined).intents).toEqual([]);
    });

    it('flags completely unknown strings as ambiguous without crashing', () => {
      const res = normalizeLegacyHousingIntent('random_unrecognized_data_xyz');
      expect(res.intents).toEqual([]);
      expect(res.isAmbiguous).toBe(true);
    });
  });

  describe('Scenario H – Listing Integrity & Ownership Security', () => {
    const userId = 'user_legit';

    it('rejects listing owned by another user', () => {
      const foreignListing: ListingVerificationContext = {
        id: 'list_foreign',
        ownerId: 'user_different',
        status: 'active',
      };
      const check = validateLiveInListingRelationship(userId, foreignListing);
      expect(check.isValid).toBe(false);
      expect(check.reason).toContain('does not match user UID');
    });

    it('rejects deleted listings', () => {
      const deletedListing: ListingVerificationContext = {
        id: 'list_deleted',
        ownerId: userId,
        status: 'active',
        isDeleted: true,
      };
      const check = validateLiveInListingRelationship(userId, deletedListing);
      expect(check.isValid).toBe(false);
      expect(check.reason).toContain('deleted');
    });

    it('rejects inactive or draft listings', () => {
      const draftListing: ListingVerificationContext = {
        id: 'list_draft',
        ownerId: userId,
        status: 'draft',
      };
      const check = validateLiveInListingRelationship(userId, draftListing);
      expect(check.isValid).toBe(false);
      expect(check.reason).toContain('must be \'active\'');
    });

    it('accepts genuine, active owned listings', () => {
      const goodListing: ListingVerificationContext = {
        id: 'list_good',
        ownerId: userId,
        status: 'active',
        isDeleted: false,
      };
      const check = validateLiveInListingRelationship(userId, goodListing);
      expect(check.isValid).toBe(true);
    });
  });

  describe('Scenario I – Moderation & Administrative Guard', () => {
    it('excludes banned users from discovery eligibility', () => {
      const bannedUser = {
        uid: 'banned_01',
        name: 'Banned Seeker',
        status: 'banned',
        housingIntent: 'find_room',
      };
      const resolved = resolveUserHousingIntent(bannedUser);
      expect(resolved.isDiscoveryEligible).toBe(false);
      expect(resolved.discoveryIneligibilityReason).toBe('banned');
    });

    it('excludes suspended users from discovery eligibility', () => {
      const suspendedUser = {
        uid: 'suspended_01',
        name: 'Suspended Seeker',
        status: 'suspended',
        housingIntent: 'find_room',
      };
      const resolved = resolveUserHousingIntent(suspendedUser);
      expect(resolved.isDiscoveryEligible).toBe(false);
      expect(resolved.discoveryIneligibilityReason).toBe('suspended');
    });

    it('excludes administrators from discovery eligibility', () => {
      const adminUser = {
        uid: 'admin_01',
        name: 'NestMate Admin',
        role: 'admin',
        status: 'active',
      };
      const resolved = resolveUserHousingIntent(adminUser);
      expect(resolved.isDiscoveryEligible).toBe(false);
      expect(resolved.discoveryIneligibilityReason).toBe('admin');
    });

    it('excludes users who have toggled isActivelySearching = false', () => {
      const inactiveUser = {
        uid: 'inactive_01',
        name: 'Settled Resident',
        status: 'active',
        housingPreferences: {
          activeIntents: ['find_room' as const],
          isActivelySearching: false,
        },
      };
      const resolved = resolveUserHousingIntent(inactiveUser);
      expect(resolved.isDiscoveryEligible).toBe(false);
      expect(resolved.discoveryIneligibilityReason).toBe('inactive_search');
    });
  });

  describe('Scenario J – Housing Preferences Validation', () => {
    it('validates correct preferences successfully', () => {
      const validPrefs: UserHousingPreferences = {
        activeIntents: ['find_room', 'team_up'],
        budgetMin: 12000,
        budgetMax: 20000,
        preferredCities: ['Bengaluru'],
        preferredLocalities: ['Indiranagar', 'Koramangala'],
        isActivelySearching: true,
      };
      const res = validateHousingPreferences(validPrefs);
      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('rejects budgetMin greater than budgetMax', () => {
      const invalidPrefs = {
        activeIntents: ['find_room'],
        budgetMin: 25000,
        budgetMax: 15000,
      };
      const res = validateHousingPreferences(invalidPrefs);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('budgetMin (25000) cannot be greater than budgetMax (15000)');
    });

    it('rejects negative budgets', () => {
      const invalidPrefs = {
        activeIntents: ['find_room'],
        budgetMin: -5000,
      };
      const res = validateHousingPreferences(invalidPrefs);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('budgetMin must be a non-negative number');
    });

    it('rejects unrecognized intent enums', () => {
      const invalidPrefs = {
        activeIntents: ['invalid_intent_value'],
      };
      const res = validateHousingPreferences(invalidPrefs);
      expect(res.isValid).toBe(false);
      expect(res.errors[0]).toContain('Invalid housing intent');
    });
  });

  describe('Scenario K – Migration Helper: buildCanonicalPreferencesFromLegacy', () => {
    it('constructs well-formed preferences from a legacy profile without data loss', () => {
      const legacyProfile = {
        uid: 'leg_01',
        housingIntent: 'find_room',
        budget: 18000,
        city: 'Bengaluru',
        localities: ['Koramangala', 'HSR Layout'],
        moveInDate: 'Immediate',
        status: 'active',
        onboardingComplete: true,
      };

      const prefs = buildCanonicalPreferencesFromLegacy(legacyProfile);
      expect(prefs.activeIntents).toEqual(['find_room']);
      expect(prefs.budgetMin).toBe(Math.round(18000 * 0.8));
      expect(prefs.budgetMax).toBe(Math.round(18000 * 1.2));
      expect(prefs.preferredCities).toEqual(['Bengaluru']);
      expect(prefs.preferredLocalities).toEqual(['Koramangala', 'HSR Layout']);
      expect(prefs.isActivelySearching).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // EXISTING RETRO-COMPATIBILITY TESTS (PRESERVED)
  // ───────────────────────────────────────────────────────────────────────────

  describe('getUserIntent (Legacy Adapter)', () => {
    it('correctly classifies a room seeker without listing', () => {
      const seeker = {
        uid: 'user1',
        name: 'Mukeshram G',
        role: 'seeker' as const,
        budget: 6000,
        gender: 'male',
      };

      const intent = getUserIntent(seeker);
      expect(intent.type).toBe('room_seeker');
      expect(intent.badgeText).toBe('Looking for a Room');
      expect(intent.priceLabel).toBe('Budget');
      expect(intent.requirementValue).toBe('A Room');
      expect(intent.preferenceLabel).toBe('Preference');
      expect(intent.roleLabel).toBe('Room Seeker');
    });

    it('correctly classifies a team-up room seeker', () => {
      const seeker = {
        uid: 'user2',
        name: 'Aarav',
        role: 'seeker' as const,
        housingIntent: 'team_up',
        budget: 12000,
      };

      const intent = getUserIntent(seeker);
      expect(intent.type).toBe('room_seeker');
      expect(intent.badgeText).toBe('Teaming Up for a Room');
      expect(intent.requirementValue).toBe('Team-Up Flat');
      expect(intent.priceLabel).toBe('Budget');
    });

    it('correctly classifies an owner-flatmate offering a room', () => {
      const liveInHost = {
        uid: 'host1',
        name: 'Gowtham Pavan',
        role: 'owner' as const,
        ownerType: 'owner_flatmate',
        budget: 15000,
      };

      const intent = getUserIntent(liveInHost);
      expect(intent.type).toBe('roommate_seeker');
      expect(intent.badgeText).toBe('Room Available');
      expect(intent.priceLabel).toBe('Rent');
      expect(intent.requirementValue).toBe('A Roommate');
      expect(intent.roleLabel).toBe('Live-in Host');
    });

    it('correctly classifies a seeker who has an active listing attached', () => {
      const seekerWithListing = {
        uid: 'user3',
        name: 'Priya',
        role: 'seeker' as const,
      };
      const listing = {
        id: 'list1',
        totalRent: 18000,
      };

      const intent = getUserIntent(seekerWithListing, listing);
      expect(intent.type).toBe('roommate_seeker');
      expect(intent.badgeText).toBe('Room Available');
      expect(intent.priceLabel).toBe('Rent');
    });

    it('correctly classifies an absentee landlord / property host', () => {
      const landlord = {
        uid: 'landlord1',
        name: 'Suresh Kumar',
        role: 'owner' as const,
        ownerType: 'landlord',
      };

      const intent = getUserIntent(landlord);
      expect(intent.type).toBe('property_host');
      expect(intent.badgeText).toBe('Property Host');
      expect(intent.priceLabel).toBe('Rent');
      expect(intent.requirementValue).toBe('Room / Property');
    });
  });

  describe('getPreferredRoommateGender', () => {
    it('returns Any Gender when seeker has roommate_gender = any (never falls back to user male gender)', () => {
      const mukeshram = {
        name: 'Mukeshram G',
        gender: 'male',
        quizAnswers: {
          roommate_gender: 'any',
        },
      };

      const res = getPreferredRoommateGender(mukeshram);
      expect(res.raw).toBe('any');
      expect(res.label).toBe('Any Gender');
      expect(res.label).not.toContain('Male');
    });

    it('returns Female Only when seeker quiz answers roommate_gender = female', () => {
      const user = {
        name: 'Ananya',
        gender: 'female',
        quizAnswers: {
          roommate_gender: 'female',
        },
      };

      const res = getPreferredRoommateGender(user);
      expect(res.raw).toBe('female');
      expect(res.label).toBe('Female Only');
    });

    it('returns Male Only when owner has householdExpectations genderPref = male', () => {
      const owner = {
        name: 'Rahul',
        householdExpectations: {
          genderPref: 'male',
        },
      };

      const res = getPreferredRoommateGender(owner);
      expect(res.raw).toBe('male');
      expect(res.label).toBe('Male Only');
    });

    it('prioritizes listing preferredGender if provided', () => {
      const profile = {
        name: 'Host',
        quizAnswers: { roommate_gender: 'any' },
      };
      const listing = {
        preferredGender: 'Female',
      };

      const res = getPreferredRoommateGender(profile, listing);
      expect(res.raw).toBe('female');
      expect(res.label).toBe('Female Only');
    });

    it('defaults truthfully to Any Gender when no preference is recorded (never guesses user gender)', () => {
      const unknownUser = {
        name: 'John Doe',
        gender: 'male',
      };

      const res = getPreferredRoommateGender(unknownUser);
      expect(res.raw).toBe('any');
      expect(res.label).toBe('Any Gender');
    });
  });

  describe('getUserInitials', () => {
    it('extracts two initials from first and last name', () => {
      expect(getUserInitials('Mukeshram G')).toBe('MG');
      expect(getUserInitials('Gowtham Pavan')).toBe('GP');
    });

    it('extracts two characters for single word names', () => {
      expect(getUserInitials('Mukesh')).toBe('MU');
    });

    it('handles empty or missing names gracefully', () => {
      expect(getUserInitials(null)).toBe('U');
      expect(getUserInitials('')).toBe('U');
    });
  });

  describe('Scenario I – Intent Fallback & Non-Fabrication Regression (7 Cases)', () => {
    // 1. User with no housingIntent, no hasRoom, and no roommateSeekingType
    it('Case 1: User with no housingIntent, no hasRoom, and no roommateSeekingType returns empty intents and needs completion', () => {
      const user = { uid: 'u_reg_1', name: 'No Intent User', status: 'active' };
      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toEqual([]);
      expect(resolved.isLookingForRoom).toBe(false);
      expect(resolved.needsIntentCompletion).toBe(true);
      expect(resolved.isDiscoveryEligible).toBe(false);
      expect(resolved.displayBadge.text).toBe('Intent Needed');
      expect(resolved.displayBadge.variant).toBe('unknown');
    });

    // 2. User with housingIntent: undefined
    it('Case 2: User with housingIntent: undefined returns empty intents and never defaults to find_room', () => {
      const user = { uid: 'u_reg_2', name: 'Undefined Intent User', housingIntent: undefined, status: 'active' };
      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toEqual([]);
      expect(resolved.isLookingForRoom).toBe(false);
      expect(resolved.needsIntentCompletion).toBe(true);
      expect(resolved.displayBadge.text).toBe('Intent Needed');
    });

    // 3. User with an unknown legacy intent
    it('Case 3: User with unknown legacy intent returns empty intents and needs completion', () => {
      const user = { uid: 'u_reg_3', name: 'Unknown Intent User', housingIntent: 'some_random_legacy_junk', status: 'active' };
      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toEqual([]);
      expect(resolved.isLookingForRoom).toBe(false);
      expect(resolved.needsIntentCompletion).toBe(true);
      expect(resolved.displayBadge.text).toBe('Intent Needed');
    });

    // 4. User with explicit hasRoom: true
    it('Case 4: User with explicit hasRoom: true resolves to have_room', () => {
      const user = { uid: 'u_reg_4', name: 'Has Room User', hasRoom: true, status: 'active' };
      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toEqual(['have_room']);
      expect(resolved.isLookingForRoom).toBe(false);
      expect(resolved.needsIntentCompletion).toBe(false);
    });

    // 5. User with explicit roommateSeekingType: roommate_for_my_room
    it('Case 5: User with explicit roommateSeekingType: roommate_for_my_room resolves to have_room', () => {
      const user = { uid: 'u_reg_5', name: 'Roommate Seeking User', roommateSeekingType: 'roommate_for_my_room', status: 'active' };
      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toEqual(['have_room']);
      expect(resolved.isLookingForRoom).toBe(false);
      expect(resolved.needsIntentCompletion).toBe(false);
    });

    // 6. User with explicit housingIntent: find_room
    it('Case 6: User with explicit housingIntent: find_room resolves to find_room', () => {
      const user = { uid: 'u_reg_6', name: 'Room Seeker User', housingIntent: 'find_room', status: 'active' };
      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toEqual(['find_room']);
      expect(resolved.isLookingForRoom).toBe(true);
      expect(resolved.needsIntentCompletion).toBe(false);
      expect(resolved.displayBadge.text).toBe('Looking for a room');
    });

    // 7. User with conflicting legacy fields
    it('Case 7: User with conflicting legacy fields resolves to empty activeIntents and needs completion', () => {
      const user = { uid: 'u_reg_7', name: 'Conflicting User', housingIntent: 'find_room', hasRoom: true, status: 'active' };
      const resolved = resolveUserHousingIntent(user);
      expect(resolved.activeIntents).toEqual([]);
      expect(resolved.isLookingForRoom).toBe(false);
      expect(resolved.needsIntentCompletion).toBe(true);
      expect(resolved.displayBadge.text).toBe('Intent Needed');
    });
  });
});
