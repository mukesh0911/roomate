import { describe, it, expect } from 'vitest';
import { mapFirestoreUser } from './nestmateBackend';

describe('mapFirestoreUser canonical data integrity & non-fabrication suite', () => {
  it('preserves machine-readable housingIntent enum and attaches resolvedIntent for explicit find_room', () => {
    const rawDoc = {
      uid: 'seeker_123',
      name: 'Aditi Sharma',
      email: 'aditi@example.com',
      housingIntent: 'find_room',
      role: 'seeker',
      budget: 15000,
      city: 'Bengaluru',
    };

    const mapped = mapFirestoreUser(rawDoc);

    // 1. housingIntent MUST be the stored machine-readable enum, never badge label
    expect(mapped.housingIntent).toBe('find_room');
    expect(mapped.housingIntent).not.toBe('Looking for a room');

    // 2. resolvedIntent MUST contain the full canonical interpretation
    expect(mapped.resolvedIntent).toBeDefined();
    expect(mapped.resolvedIntent?.activeIntents).toEqual(['find_room']);
    expect(mapped.resolvedIntent?.isLookingForRoom).toBe(true);
    expect(mapped.resolvedIntent?.needsIntentCompletion).toBe(false);
    expect(mapped.resolvedIntent?.displayBadge.text).toBe('Looking for a room');
    expect(mapped.resolvedIntent?.displayBadge.variant).toBe('seeker');
  });

  it('preserves machine-readable team_up enum', () => {
    const rawDoc = {
      uid: 'teamup_123',
      name: 'Karan Mehra',
      housingIntent: 'team_up',
      role: 'seeker',
    };

    const mapped = mapFirestoreUser(rawDoc);

    expect(mapped.housingIntent).toBe('team_up');
    expect(mapped.resolvedIntent?.activeIntents).toEqual(['team_up']);
    expect(mapped.resolvedIntent?.isTeamUpSeeker).toBe(true);
    expect(mapped.resolvedIntent?.needsIntentCompletion).toBe(false);
  });

  it('never fabricates find_room for commercial landlords without housingIntent', () => {
    const rawDoc = {
      uid: 'landlord_123',
      name: 'Sunil Verma',
      role: 'owner',
      ownerType: 'landlord',
    };

    const mapped = mapFirestoreUser(rawDoc);

    // Stored field was absent, so mapped.housingIntent MUST be undefined
    expect(mapped.housingIntent).toBeUndefined();

    // Canonical resolvedIntent correctly captures commercial property host
    expect(mapped.resolvedIntent?.isPropertyHost).toBe(true);
    expect(mapped.resolvedIntent?.isLookingForRoom).toBe(false);
    expect(mapped.resolvedIntent?.displayBadge.text).toBe('Property Host');
  });

  it('retains all legacy fields and quiz attributes intact', () => {
    const rawDoc = {
      uid: 'complete_user_123',
      name: 'Pooja Iyer',
      profession: 'Software Engineer',
      localities: ['Indiranagar', 'Koramangala'],
      budget: 20000,
      isVerified: true,
      avatar: 'https://images.example.com/pooja.jpg',
      quizAnswers: {
        diet: 'Vegetarian',
        smoke: 'Non-smoker',
        sleep: 'Early riser',
        clean: 'Very tidy',
        guests: 'sometimes',
      },
      housingIntent: 'find_room',
    };

    const mapped = mapFirestoreUser(rawDoc);

    expect(mapped.name).toBe('Pooja Iyer');
    expect(mapped.profession).toBe('Software Engineer');
    expect(mapped.locality).toBe('Indiranagar');
    expect(mapped.isVerified).toBe(1);
    expect(mapped.diet).toBe('Vegetarian');
    expect(mapped.smoking).toBe('Non-smoker');
    expect(mapped.sleep).toBe('Early riser');
    expect(mapped.cleanliness).toBe('Very tidy');
    expect(mapped.guests).toBe('Sometimes');
    expect(mapped.housingIntent).toBe('find_room');
    expect(mapped.raw).toBe(rawDoc);
  });

  describe('Regression: 7 Intent Fallback & Incomplete User Cases', () => {
    // 1. User with no housingIntent, no hasRoom, and no roommateSeekingType
    it('Case 1: User with no housingIntent, no hasRoom, and no roommateSeekingType returns undefined and needs completion', () => {
      const rawDoc = {
        uid: 'user_case_1',
        name: 'Incomplete Seeker',
        role: 'seeker',
      };

      const mapped = mapFirestoreUser(rawDoc);

      expect(mapped.housingIntent).toBeUndefined();
      expect(mapped.resolvedIntent?.activeIntents).toEqual([]);
      expect(mapped.resolvedIntent?.isLookingForRoom).toBe(false);
      expect(mapped.resolvedIntent?.needsIntentCompletion).toBe(true);
      expect(mapped.resolvedIntent?.isDiscoveryEligible).toBe(false);
      expect(mapped.resolvedIntent?.displayBadge.text).toBe('Intent Needed');
      expect(mapped.resolvedIntent?.displayBadge.variant).toBe('unknown');
    });

    // 2. User with housingIntent: undefined
    it('Case 2: User with housingIntent: undefined returns undefined and never fabricates find_room', () => {
      const rawDoc = {
        uid: 'user_case_2',
        name: 'Undefined Intent User',
        housingIntent: undefined,
        role: 'seeker',
      };

      const mapped = mapFirestoreUser(rawDoc);

      expect(mapped.housingIntent).toBeUndefined();
      expect(mapped.resolvedIntent?.activeIntents).toEqual([]);
      expect(mapped.resolvedIntent?.isLookingForRoom).toBe(false);
      expect(mapped.resolvedIntent?.needsIntentCompletion).toBe(true);
      expect(mapped.resolvedIntent?.displayBadge.text).toBe('Intent Needed');
    });

    // 3. User with an unknown legacy intent
    it('Case 3: User with unknown legacy intent preserves raw string but resolves to empty activeIntents', () => {
      const rawDoc = {
        uid: 'user_case_3',
        name: 'Gibberish User',
        housingIntent: 'unrecognized_legacy_intent_xyz',
        role: 'seeker',
      };

      const mapped = mapFirestoreUser(rawDoc);

      // Raw stored value is preserved truthfully
      expect(mapped.housingIntent).toBe('unrecognized_legacy_intent_xyz');
      // But canonical resolution treats it as ambiguous / empty, NOT find_room
      expect(mapped.resolvedIntent?.activeIntents).toEqual([]);
      expect(mapped.resolvedIntent?.isLookingForRoom).toBe(false);
      expect(mapped.resolvedIntent?.needsIntentCompletion).toBe(true);
      expect(mapped.resolvedIntent?.displayBadge.text).toBe('Intent Needed');
    });

    // 4. User with explicit hasRoom: true
    it('Case 4: User with explicit hasRoom: true resolves to have_room without fabricating housingIntent field', () => {
      const rawDoc = {
        uid: 'user_case_4',
        name: 'Legacy Room Owner',
        hasRoom: true,
        role: 'seeker',
      };

      const mapped = mapFirestoreUser(rawDoc);

      // Stored housingIntent field was not present
      expect(mapped.housingIntent).toBeUndefined();
      // But legacy resolution legitimately interprets hasRoom: true as have_room
      expect(mapped.resolvedIntent?.activeIntents).toEqual(['have_room']);
      expect(mapped.resolvedIntent?.isLookingForRoom).toBe(false);
      expect(mapped.resolvedIntent?.needsIntentCompletion).toBe(false);
    });

    // 5. User with explicit roommateSeekingType: roommate_for_my_room
    it('Case 5: User with explicit roommateSeekingType: roommate_for_my_room resolves to have_room', () => {
      const rawDoc = {
        uid: 'user_case_5',
        name: 'Roommate For My Room Seeker',
        roommateSeekingType: 'roommate_for_my_room',
        role: 'seeker',
      };

      const mapped = mapFirestoreUser(rawDoc);

      expect(mapped.housingIntent).toBeUndefined();
      expect(mapped.resolvedIntent?.activeIntents).toEqual(['have_room']);
      expect(mapped.resolvedIntent?.isLookingForRoom).toBe(false);
      expect(mapped.resolvedIntent?.needsIntentCompletion).toBe(false);
    });

    // 6. User with explicit housingIntent: find_room
    it('Case 6: User with explicit housingIntent: find_room preserves stored enum and resolves to find_room', () => {
      const rawDoc = {
        uid: 'user_case_6',
        name: 'Explicit Room Seeker',
        housingIntent: 'find_room',
        role: 'seeker',
      };

      const mapped = mapFirestoreUser(rawDoc);

      expect(mapped.housingIntent).toBe('find_room');
      expect(mapped.resolvedIntent?.activeIntents).toEqual(['find_room']);
      expect(mapped.resolvedIntent?.isLookingForRoom).toBe(true);
      expect(mapped.resolvedIntent?.needsIntentCompletion).toBe(false);
      expect(mapped.resolvedIntent?.displayBadge.text).toBe('Looking for a room');
    });

    // 7. User with conflicting legacy fields
    it('Case 7: User with conflicting legacy fields (find_room + hasRoom: true) resolves to empty activeIntents and needs completion', () => {
      const rawDoc = {
        uid: 'user_case_7',
        name: 'Conflicting Signals User',
        housingIntent: 'find_room',
        hasRoom: true,
        role: 'seeker',
      };

      const mapped = mapFirestoreUser(rawDoc);

      // Preserves stored field
      expect(mapped.housingIntent).toBe('find_room');
      // Conflicting signals cannot establish a reliable intent -> empty intents, needs completion
      expect(mapped.resolvedIntent?.activeIntents).toEqual([]);
      expect(mapped.resolvedIntent?.isLookingForRoom).toBe(false);
      expect(mapped.resolvedIntent?.needsIntentCompletion).toBe(true);
      expect(mapped.resolvedIntent?.displayBadge.text).toBe('Intent Needed');
    });
  });
});
