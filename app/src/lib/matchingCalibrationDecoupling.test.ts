import { describe, expect, it } from 'vitest';
import {
  hasActiveSeekerIntent,
  isUserMatchingCalibrated,
  resolveSeekerBudget,
  resolveSeekerCity,
  resolveSeekerLocalities,
  getRoomMatchReasons,
  canonicalSeekerFingerprint,
} from './matching';

describe('Decoupled Matching Calibration & Intent Separation', () => {
  describe('resolveSeekerBudget', () => {
    it('prefers housingPreferences.budgetMax', () => {
      expect(resolveSeekerBudget({
        housingPreferences: { budgetMax: 25000, budgetMin: 15000 },
        budget: 20000,
      })).toBe(25000);
    });

    it('falls back to top-level budget and budgetMin', () => {
      expect(resolveSeekerBudget({ budget: 18000 })).toBe(18000);
      expect(resolveSeekerBudget({ budgetMax: 22000 })).toBe(22000);
      expect(resolveSeekerBudget({ housingPreferences: { budgetMin: 12000 } })).toBe(12000);
    });

    it('returns 0 when budget is missing or zero', () => {
      expect(resolveSeekerBudget({})).toBe(0);
      expect(resolveSeekerBudget({ budget: 0 })).toBe(0);
      expect(resolveSeekerBudget({ budget: -500 })).toBe(0);
      expect(resolveSeekerBudget(null)).toBe(0);
    });
  });

  describe('resolveSeekerCity', () => {
    it('prefers housingPreferences.preferredCities', () => {
      expect(resolveSeekerCity({
        city: 'Pune',
        housingPreferences: { preferredCities: ['Bengaluru', 'Mumbai'] },
      })).toBe('Bengaluru');
    });

    it('falls back to top-level city', () => {
      expect(resolveSeekerCity({ city: '  Hyderabad  ' })).toBe('Hyderabad');
    });

    it('returns empty string when missing or invalid', () => {
      expect(resolveSeekerCity({})).toBe('');
      expect(resolveSeekerCity({ city: '   ' })).toBe('');
      expect(resolveSeekerCity(null)).toBe('');
    });
  });

  describe('resolveSeekerLocalities', () => {
    it('prefers housingPreferences.preferredLocalities and deduplicates', () => {
      expect(resolveSeekerLocalities({
        localities: ['Koramangala'],
        housingPreferences: { preferredLocalities: ['Indiranagar', '  Indiranagar  ', 'HSR Layout'] },
      })).toEqual(['Indiranagar', 'HSR Layout']);
    });

    it('falls back to top-level localities or locality', () => {
      expect(resolveSeekerLocalities({ localities: ['Adyar', 'Besant Nagar'] })).toEqual(['Adyar', 'Besant Nagar']);
      expect(resolveSeekerLocalities({ locality: 'Whitefield' })).toEqual(['Whitefield']);
    });

    it('returns empty array when missing or empty', () => {
      expect(resolveSeekerLocalities({})).toEqual([]);
      expect(resolveSeekerLocalities({ localities: [] })).toEqual([]);
      expect(resolveSeekerLocalities(null)).toEqual([]);
    });
  });

  describe('hasActiveSeekerIntent', () => {
    it('returns true when activeIntents contains find_room or team_up', () => {
      expect(hasActiveSeekerIntent({ housingPreferences: { activeIntents: ['find_room'] } })).toBe(true);
      expect(hasActiveSeekerIntent({ housingPreferences: { activeIntents: ['team_up'] } })).toBe(true);
      expect(hasActiveSeekerIntent({ housingPreferences: { activeIntents: ['have_room', 'find_room'] } })).toBe(true);
    });

    it('returns false for pure hosts with activeIntents [have_room]', () => {
      expect(hasActiveSeekerIntent({ housingPreferences: { activeIntents: ['have_room'] } })).toBe(false);
    });

    it('checks singular housingIntent when activeIntents is not present', () => {
      expect(hasActiveSeekerIntent({ housingIntent: 'find_room' })).toBe(true);
      expect(hasActiveSeekerIntent({ housingIntent: 'team_up' })).toBe(true);
      expect(hasActiveSeekerIntent({ housingIntent: 'have_room' })).toBe(false);
    });

    it('detects legacy hosts who have isLandlord: true or active listings without seeker intent', () => {
      expect(hasActiveSeekerIntent({ isLandlord: true })).toBe(false);
      expect(hasActiveSeekerIntent({}, [{ id: 'listing_1' }])).toBe(false);
    });

    it('defaults to true for legacy seekers without host markers', () => {
      expect(hasActiveSeekerIntent({})).toBe(true);
      expect(hasActiveSeekerIntent({ name: 'Seeker', city: 'Bengaluru' }, [])).toBe(true);
    });
  });

  describe('isUserMatchingCalibrated', () => {
    const validSeeker = {
      onboardingComplete: true,
      city: 'Bengaluru',
      localities: ['Koramangala'],
      budget: 25000,
      housingPreferences: {
        activeIntents: ['find_room'],
        preferredCities: ['Bengaluru'],
        preferredLocalities: ['Koramangala'],
        budgetMax: 25000,
      },
    };

    it('returns true for a fully specified seeker', () => {
      expect(isUserMatchingCalibrated(validSeeker)).toBe(true);
    });

    it('returns false when onboardingComplete is false', () => {
      expect(isUserMatchingCalibrated({ ...validSeeker, onboardingComplete: false })).toBe(false);
    });

    it('returns false when user is a dedicated host without seeker intent', () => {
      const pureHost = {
        ...validSeeker,
        housingPreferences: { activeIntents: ['have_room'] },
      };
      expect(isUserMatchingCalibrated(pureHost)).toBe(false);
    });

    it('returns false when budget is 0 or missing', () => {
      expect(isUserMatchingCalibrated({
        ...validSeeker,
        budget: 0,
        housingPreferences: { activeIntents: ['find_room'], preferredCities: ['Bengaluru'], preferredLocalities: ['Koramangala'] },
      })).toBe(false);
    });

    it('returns false when city is missing or empty', () => {
      expect(isUserMatchingCalibrated({
        ...validSeeker,
        city: '',
        housingPreferences: { activeIntents: ['find_room'], preferredCities: [], preferredLocalities: ['Koramangala'], budgetMax: 20000 },
      })).toBe(false);
    });

    it('returns false when localities is empty', () => {
      expect(isUserMatchingCalibrated({
        ...validSeeker,
        localities: [],
        housingPreferences: { activeIntents: ['find_room'], preferredCities: ['Bengaluru'], preferredLocalities: [], budgetMax: 20000 },
      })).toBe(false);
    });

    it('returns true for dual-intent users who are both hosts and room seekers', () => {
      const dualIntent = {
        ...validSeeker,
        isLandlord: true,
        housingPreferences: {
          activeIntents: ['have_room', 'find_room'],
          preferredCities: ['Bengaluru'],
          preferredLocalities: ['Indiranagar'],
          budgetMax: 30000,
        },
      };
      expect(isUserMatchingCalibrated(dualIntent)).toBe(true);
    });
  });

  describe('getRoomMatchReasons & Uncalibrated State', () => {
    const listing = {
      id: 'room_101',
      city: 'Bengaluru',
      locality: 'Koramangala',
      monthlyRent: 22000,
      roomType: 'Private room',
    };

    it('reports calibrated: false and score: 0 when seeker is uncalibrated', () => {
      const uncalibratedSeeker = {
        onboardingComplete: false,
        city: 'Bengaluru',
        budget: 0,
      };

      const breakdown = getRoomMatchReasons(uncalibratedSeeker, listing);
      expect(breakdown.calibrated).toBe(false);
      expect(breakdown.score).toBe(0);
      expect(breakdown.caveats).toContain('Complete your matching preferences to see compatibility');
    });

    it('reports calibrated: true and calculates honest compatibility for calibrated seekers', () => {
      const calibratedSeeker = {
        onboardingComplete: true,
        city: 'Bengaluru',
        localities: ['Koramangala'],
        budget: 25000,
        gender: 'Any',
        housingPreferences: { activeIntents: ['find_room'] },
      };

      const breakdown = getRoomMatchReasons(calibratedSeeker, listing);
      expect(breakdown.calibrated).toBe(true);
      expect(breakdown.score).toBeGreaterThan(0);
      expect(breakdown.reasons).toContain('Same city');
      expect(breakdown.reasons).toContain('Same locality');
      expect(breakdown.reasons).toContain('Budget fits');
    });

    it('computes consistent canonical fingerprints for cache validation', () => {
      const userA = {
        city: 'Bengaluru',
        localities: ['Koramangala'],
        budget: 25000,
        housingPreferences: { activeIntents: ['find_room'] },
      };
      const fp1 = canonicalSeekerFingerprint(userA);
      const fp2 = canonicalSeekerFingerprint({ ...userA });
      expect(fp1).toBe(fp2);

      // Changing budget changes fingerprint
      const fp3 = canonicalSeekerFingerprint({ ...userA, budget: 30000 });
      expect(fp3).not.toBe(fp1);
    });
  });
});

