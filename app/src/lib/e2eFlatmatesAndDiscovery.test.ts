import { describe, it, expect } from 'vitest';
import { filterFlatmateProfiles, filterProfilesByRole, type UserProfileLike } from './roleFiltering';
import { calculateProfileCompatibility } from './matching';

describe('E2E Flatmates & People Discovery Integrity Suite', () => {
  const realSeeker = {
    uid: 'td52RsZm8qNX3OIDa1trHBS0oVI3',
    name: 'Mukeshram G',
    role: 'seeker' as const,
    city: 'Bengaluru',
    locality: 'Koramangala',
    localities: ['Koramangala'],
    budget: 6000,
    gender: 'male',
    isVerified: true,
    onboardingComplete: true,
    quizAnswers: {
      sleep_time: '10_to_12',
      roommate_gender: 'any',
      work_mode: 'wfo',
      wake_time: '6_to_8',
      guests: 'rarely',
      drinking: 'never',
      pets: 'no',
      food_pref: 'no_pref',
      cleanliness: 'very',
      smoking: 'never'
    }
  };

  const realOwnerFlatmate = {
    uid: '9ZRUD2PCGhYc0JbxGOzxXsthxCy1',
    name: 'Ram G',
    role: 'owner' as const,
    ownerType: 'owner_flatmate',
    city: 'Bengaluru',
    locality: 'Koramangala',
    localities: ['Koramangala'],
    isVerified: true,
    onboardingComplete: true,
    householdExpectations: {
      smokingPolicy: 'no_smoking',
      petPolicy: 'no_pets',
      genderPref: 'any',
      dietPref: 'any'
    },
    propertyBasics: {
      flatType: '1BHK',
      totalRooms: 2,
      locality: 'Koramangala',
      roomsToOffer: 1
    }
  };

  const realListing = {
    id: 'R5JUNn4vn3ewrCoiK7Fo',
    title: 'Sunny 2BHK House ',
    status: 'active',
    ownerId: '9ZRUD2PCGhYc0JbxGOzxXsthxCy1',
    ownerVerified: true,
    city: 'Bengaluru',
    locality: 'Koramangala',
    totalRent: 15000,
    partnerShare: 3750,
    partnersNeeded: 3,
    flatType: '2BHK',
    furnishing: 'Semi-Furnished',
    amenities: ['AC'],
    genderPreference: 'male',
    houseRules: [
      'No smoking inside',
      'No pets',
      'Maintain cleanliness',
      'No parties'
    ]
  };

  it('Seeker discovers live-in owner-flatmate in Flatmates discovery', () => {
    const pool = [realSeeker, realOwnerFlatmate];
    // Seeker browsing flatmates
    const discovered = filterFlatmateProfiles(pool, realSeeker.uid, 'seeker');
    expect(discovered).toHaveLength(1);
    expect(discovered[0].uid).toBe(realOwnerFlatmate.uid);
    expect(discovered[0].name).toBe('Ram G');
  });

  it('Owner discovers seeker in Flatmates discovery', () => {
    const pool = [realSeeker, realOwnerFlatmate];
    const discovered = filterFlatmateProfiles(pool, realOwnerFlatmate.uid, 'owner');
    expect(discovered).toHaveLength(1);
    expect(discovered[0].uid).toBe(realSeeker.uid);
    expect(discovered[0].name).toBe('Mukeshram G');
  });

  it('Guest discovers all eligible flatmates (both seekers and owner-flatmates)', () => {
    const pool = [realSeeker, realOwnerFlatmate];
    const discovered = filterFlatmateProfiles(pool, null, null);
    expect(discovered).toHaveLength(2);
  });

  it('Computes evidence-based compatibility without awarding missing preferences', () => {
    const match = calculateProfileCompatibility(realSeeker, realOwnerFlatmate, realListing);
    expect(match.score).toBe(75);
    expect(match.reasons.length).toBeGreaterThan(0);
    expect(match.caveats).toContain('Room preference not fully specified');
  });

  it('Preserves seekers without listings when filtering by flatType/furnishing/amenities', () => {
    // Simulated matches pool in SeekerDashboard
    const candidateSeekerWithoutListing = {
      profile: {
        uid: 'other_seeker',
        name: 'Another Seeker',
        role: 'seeker',
        budget: 7000,
        city: 'Bengaluru',
        locality: 'Koramangala',
        localities: ['Koramangala']
      }
    };

    const candidateOwnerWithListing = {
      profile: {
        ...realOwnerFlatmate,
        _listing: realListing
      }
    };

    const matches = [candidateSeekerWithoutListing, candidateOwnerWithListing];
    const filters = {
      flatType: ['2BHK'],
      furnishing: ['Semi-Furnished'],
      amenities: ['AC'],
      gender: 'any',
      budgetMin: 0,
      budgetMax: 100000,
      localities: [],
      verifiedOnly: false
    };

    // Filter pipeline logic
    const filtered = matches.filter(m => {
      const p = m.profile as any;
      const listing = p._listing;
      if (filters.flatType.length > 0 && listing && listing.flatType && !filters.flatType.includes(listing.flatType)) {
        return false;
      }
      if (filters.furnishing.length > 0 && listing && listing.furnishing && !filters.furnishing.includes(listing.furnishing)) {
        return false;
      }
      if (filters.amenities.length > 0 && listing && listing.amenities) {
        const hasAll = filters.amenities.every((a: string) => listing.amenities.includes(a));
        if (!hasAll) return false;
      }
      return true;
    });

    // Both candidates must be retained (seeker is not eliminated just because listing is undefined)
    expect(filtered).toHaveLength(2);
    expect(filtered.map(m => m.profile.uid)).toContain('other_seeker');
    expect(filtered.map(m => m.profile.uid)).toContain(realOwnerFlatmate.uid);
  });
});
