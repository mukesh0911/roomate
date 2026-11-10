import { describe, expect, it } from 'vitest';
import {
  calculateCompatibility,
  calculateRoomCompatibility,
  getRoomMatchReasons,
  getActiveStatus,
  synthesizeQuizFromProfile,
  calculateProfileCompatibility,
} from './matching';

describe('calculateCompatibility', () => {
  it('returns 100 for identical numeric answers', () => {
    const a = { sleep_time: '1', food_pref: '2', pets: '0' };
    expect(calculateCompatibility(a, { ...a })).toBe(100);
  });

  it('requires exact token match on quiz answers', () => {
    const score = calculateCompatibility(
      { sleep_time: '0' },
      { sleep_time: '1' }
    );
    expect(score).toBe(0);
  });

  it('returns 0 for non-matching answer on a single question', () => {
    expect(
      calculateCompatibility({ sleep_time: '0' }, { sleep_time: '3' })
    ).toBe(0);
  });

  it('returns 0 when neither side has answers', () => {
    expect(calculateCompatibility({}, {})).toBe(0);
  });

  it('uses exact string match when values are non-numeric', () => {
    expect(
      calculateCompatibility({ food: 'veg' }, { food: 'veg' })
    ).toBe(100);
    expect(
      calculateCompatibility({ food: 'veg' }, { food: 'non_veg' })
    ).toBe(0);
  });

  it('is symmetric', () => {
    const a = { a: '0', b: '2' };
    const b = { a: '1', b: '2' };
    expect(calculateCompatibility(a, b)).toBe(calculateCompatibility(b, a));
  });

  it('calculates identical match percentage for listing ownerQuizAnswers as owner profile quizAnswers', () => {
    const seekerProfile = { quizAnswers: { q1: '0', q2: '2' }, city: 'Hyderabad' };
    const ownerProfile = { quizAnswers: { q1: '1', q2: '2' }, city: 'Hyderabad' };
    const listing = { ownerQuizAnswers: ownerProfile.quizAnswers, city: ownerProfile.city };

    const scoreFromProfile = calculateCompatibility(seekerProfile.quizAnswers, ownerProfile.quizAnswers, seekerProfile.city, ownerProfile.city);
    const scoreFromListing = calculateCompatibility(seekerProfile.quizAnswers, listing.ownerQuizAnswers, seekerProfile.city, listing.city);

    expect(scoreFromListing).toBe(scoreFromProfile);
    expect(scoreFromListing).toBe(50);
  });
});

describe('getActiveStatus', () => {
  it('marks <15 min as online', () => {
    const ts = Date.now() - 5 * 60 * 1000;
    expect(getActiveStatus(ts).status).toBe('online');
  });

  it('marks <24h as recent', () => {
    const ts = Date.now() - 3 * 60 * 60 * 1000;
    expect(getActiveStatus(ts).status).toBe('recent');
    expect(getActiveStatus(ts).text).toContain('h ago');
  });

  it('marks older as offline', () => {
    const ts = Date.now() - 3 * 24 * 60 * 60 * 1000;
    expect(getActiveStatus(ts).status).toBe('offline');
  });

  it('handles missing timestamp', () => {
    expect(getActiveStatus(null).status).toBe('offline');
  });
});

describe('calculateRoomCompatibility & getRoomMatchReasons (5-Factor Engine)', () => {
  const perfectSeeker = {
    uid: 'seeker1',
    name: 'Priya',
    gender: 'female',
    city: 'Bengaluru',
    locality: 'Koramangala',
    localities: ['Koramangala', 'HSR Layout'],
    budget: 15000,
    quizAnswers: { food_pref: 'veg', smoking: 'never', pets: 'no' },
    isVerified: true,
    workEmailVerified: true,
    onboardingComplete: true,
  };

  const perfectListing = {
    id: 'listing1',
    city: 'Bengaluru',
    locality: 'Koramangala',
    totalRent: 14000,
    partnerShare: 14000,
    genderPreference: 'female',
    houseRules: ['Veg kitchen only', 'No smoking inside', 'No pets'],
  };

  it('scores only evidenced dimensions without inventing absent room or occupancy preferences', () => {
    const breakdown = getRoomMatchReasons(perfectSeeker, perfectListing);
    expect(breakdown.score).toBe(80);
    expect(breakdown.budgetScore).toBe(25);
    expect(breakdown.locationScore).toBe(20);
    expect(breakdown.genderScore).toBe(20);
    expect(breakdown.rulesScore).toBe(15);
    expect(breakdown.trustScore).toBe(0);
    expect(breakdown.reasons.some(r => r.includes('Budget fits'))).toBe(true);
    expect(breakdown.reasons.some(r => r.includes('Same locality'))).toBe(true);
    expect(breakdown.reasons.some(r => r.includes('gender requirement'))).toBe(true);
    expect(breakdown.reasons.some(r => r.includes('Vegetarian matches'))).toBe(true);
    expect(breakdown.reasons.some(r => r.includes('Non-smoker'))).toBe(true);
    expect(breakdown.reasons.some(r => r.includes('Budget fits'))).toBe(true);
  });

  it('penalizes significant budget shortfall', () => {
    const tightSeeker = { ...perfectSeeker, budget: 8000 };
    const breakdown = getRoomMatchReasons(tightSeeker, perfectListing);
    expect(breakdown.budgetScore).toBe(0);
    expect(breakdown.score).toBeLessThanOrEqual(75);
    expect(breakdown.caveats.some(c => c.includes('below rent'))).toBe(true);
  });

  it('caps explicit gender mismatch to max 40%', () => {
    const maleSeeker = { ...perfectSeeker, gender: 'male' };
    const breakdown = getRoomMatchReasons(maleSeeker, perfectListing);
    expect(breakdown.genderScore).toBe(0);
    expect(breakdown.score).toBeLessThanOrEqual(40);
    expect(breakdown.caveats.some(c => c.includes('gender requirement'))).toBe(true);
  });

  it('flags diet and smoking conflicts honestly', () => {
    const smokerNonVeg = {
      ...perfectSeeker,
      quizAnswers: { food_pref: 'non_veg', smoking: 'regularly', pets: 'love' },
    };
    const breakdown = getRoomMatchReasons(smokerNonVeg, perfectListing);
    expect(breakdown.rulesScore).toBeLessThan(10);
    expect(breakdown.caveats.some(c => c.includes('veg-only'))).toBe(true);
    expect(breakdown.caveats.some(c => c.includes('Smoking habit conflicts'))).toBe(true);
    expect(breakdown.caveats.some(c => c.includes('Pet preference'))).toBe(true);
  });

  it('caps cross-city matches at 60%', () => {
    const chennaiSeeker = { ...perfectSeeker, city: 'Chennai', localities: ['OMR'] };
    const score = calculateRoomCompatibility(chennaiSeeker, perfectListing);
    expect(score).toBeLessThanOrEqual(60);
  });

  it('keeps identity verification separate from compatibility', () => {
    const unverified = { ...perfectSeeker, isVerified: false, workEmailVerified: false };
    const breakdown = getRoomMatchReasons(unverified, perfectListing);
    expect(breakdown.trustScore).toBe(0);
    expect(breakdown.score).toBe(getRoomMatchReasons(perfectSeeker, perfectListing).score);
  });

  it('correctly ranks a high-match room above a low-match room', () => {
    const seeker = perfectSeeker;
    const highMatchListing = perfectListing;
    const lowMatchListing = {
      city: 'Bengaluru',
      locality: 'Whitefield',
      partnerShare: 28000, // way above 15k budget
      genderPreference: 'male', // mismatch
      houseRules: [],
    };

    const highScore = calculateRoomCompatibility(seeker, highMatchListing);
    const lowScore = calculateRoomCompatibility(seeker, lowMatchListing);

    expect(highScore).toBeGreaterThan(lowScore);
    expect(highScore).toBe(80);
    expect(lowScore).toBeLessThanOrEqual(40);
  });
});

describe('calculateProfileCompatibility & synthesizeQuizFromProfile', () => {
  it('synthesizes quiz tokens from householdExpectations and houseRules', () => {
    const owner = {
      householdExpectations: {
        dietPref: 'veg',
        smokingPolicy: 'no_smoking',
        petPolicy: 'no_pets',
        genderPref: 'female',
      },
    };
    const listing = {
      genderPreference: 'female only',
      houseRules: ['Keep common areas clean', 'No parties or loud guests after 10pm'],
    };

    const synthesized = synthesizeQuizFromProfile(owner, listing);
    expect(synthesized.food_pref).toBe('veg');
    expect(synthesized.smoking).toBe('never');
    expect(synthesized.pets).toBe('no');
    expect(synthesized.roommate_gender).toBe('female');
    expect(synthesized.cleanliness).toBe('very');
    expect(synthesized.guests).toBe('rarely');
  });

  it('calculates dynamic score for Seeker viewing Owner with Listing', () => {
    const seeker = {
      role: 'seeker',
      city: 'Bengaluru',
      localities: ['Indiranagar'],
      budget: 15000,
      isVerified: true,
      quizAnswers: {
        food_pref: 'veg',
        smoking: 'never',
        pets: 'no',
      },
    };
    const owner = {
      role: 'owner',
      city: 'Bengaluru',
      householdExpectations: {
        dietPref: 'veg',
        smokingPolicy: 'no_smoking',
        petPolicy: 'no_pets',
      },
    };
    const listing = {
      city: 'Bengaluru',
      locality: 'Indiranagar',
      partnerShare: 15000,
      houseRules: ['Veg only kitchen', 'Smoke-free home', 'No pets'],
    };

    const match = calculateProfileCompatibility(seeker, owner, listing);
    expect(match.score).toBe(60);
    expect(match.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Same locality'),
        expect.stringContaining('Budget fits'),
        expect.stringContaining('Vegetarian matches veg kitchen rule'),
        expect.stringContaining('Non-smoker matches smoke-free home'),
      ])
    );
  });

  it('calculates dynamic score for Seeker ↔ Seeker pair', () => {
    const seekerA = {
      role: 'seeker',
      city: 'Bengaluru',
      budget: 12000,
      quizAnswers: {
        food_pref: 'veg',
        smoking: 'never',
        sleep_time: 'before_10',
      },
    };
    const seekerB = {
      role: 'seeker',
      city: 'Bengaluru',
      budget: 13000,
      quizAnswers: {
        food_pref: 'veg',
        smoking: 'never',
        sleep_time: 'after_12',
      },
    };

    const match = calculateProfileCompatibility(seekerA, seekerB);
    expect(match.score).toBe(50); // City 15 + budget ratio 23 + two known lifestyle answers 12.
    expect(match.reasons).toEqual(
      expect.arrayContaining([
        'Same city (Bengaluru)',
        'Budgets are close',
        '2 lifestyle preferences in common',
      ])
    );
  });

  it('returns 0 and honest caveats when neither user has provided preferences', () => {
    const seekerA = { role: 'seeker' };
    const seekerB = { role: 'seeker' };
    const match = calculateProfileCompatibility(seekerA, seekerB);
    expect(match.score).toBe(0);
    expect(match.caveats).toContain('No overlapping quiz answers yet');
  });
});

