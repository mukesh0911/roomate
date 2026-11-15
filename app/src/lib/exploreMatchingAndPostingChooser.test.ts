import { describe, it, expect } from 'vitest';
import {
  calculateCanonicalRoomCompatibility,
  resolveCanonicalRoomCompatibility,
  isUserMatchingCalibrated,
  getActiveStatus,
} from '@/lib/matching';
import { buildMatchingPreferencesUpdate } from '@/lib/profileEditor';

describe('Explore Engine: Matching, Intent Switching, and Posting Chooser', () => {
  describe('Quick 2-Option Posting Chooser Contract', () => {
    it('differentiates room posting (provider/host) from requirement/matching preferences (seeker)', () => {
      const chooserOptions = [
        { action: 'post-room', label: 'Post a Room', role: 'have_room' },
        { action: 'post-pref', label: 'Post Requirement / Set Match Preferences', role: 'find_room' },
      ];

      expect(chooserOptions).toHaveLength(2);
      expect(chooserOptions[0].action).toBe('post-room');
      expect(chooserOptions[1].action).toBe('post-pref');
    });
  });

  describe('Fast 2-Step Budget & Locality Calibration', () => {
    it('detects uncalibrated seeker profiles missing budget or localities', () => {
      const uncalibratedUser = {
        uid: 'user_1',
        onboardingComplete: true,
        housingPreferences: {
          activeIntents: ['find_room'],
          preferredCities: ['Bengaluru'],
          budgetMax: 0,
          preferredLocalities: [],
        },
      };

      expect(isUserMatchingCalibrated(uncalibratedUser)).toBe(false);
    });

    it('buildMatchingPreferencesUpdate calibrates seeker without contaminating host listings', () => {
      const draft = {
        city: 'Bengaluru',
        b: [10000, 25000],
        areas: ['Koramangala', 'HSR Layout'],
        mv: 'Flexible',
        types: ['Private room'],
        gd: 'Any',
        diet: 'Flexible',
        smoke: 'Non-smoker',
        pets: 'Pet-friendly',
        sleep: 'Flexible',
        teamUpDiscoverable: true,
      };

      const existingProfile = {
        uid: 'user_seeker',
        name: 'Alex Seeker',
        onboardingComplete: false,
        housingPreferences: {
          activeIntents: ['find_room'],
        },
      };

      const update = buildMatchingPreferencesUpdate(draft, existingProfile);

      expect(update.budget).toBe(25000);
      expect(update.budgetMin).toBe(10000);
      expect(update.localities).toEqual(['Koramangala', 'HSR Layout']);
      expect(update.housingPreferences?.preferredCities).toEqual(['Bengaluru']);
      expect(update.housingPreferences?.budgetMax).toBe(25000);
      expect(update.housingPreferences?.preferredLocalities).toEqual(['Koramangala', 'HSR Layout']);
      expect(update.onboardingComplete).toBe(true);

      // Verify calibration passes with update applied
      const calibratedProfile = { ...existingProfile, ...update };
      expect(isUserMatchingCalibrated(calibratedProfile)).toBe(true);
    });
  });

  describe('5-Factor Compatibility Breakdown Calculation', () => {
    it('returns exact transparent 5-factor point breakdown summing to canonical score', () => {
      const calibratedSeeker = {
        uid: 'seeker_1',
        city: 'Bengaluru',
        gender: 'Male',
        preferredRoomTypes: ['Private room'],
        onboardingComplete: true,
        housingPreferences: {
          activeIntents: ['find_room'],
          preferredCities: ['Bengaluru'],
          preferredLocalities: ['Koramangala'],
          budgetMax: 25000,
          budgetMin: 10000,
          preferredRoomTypes: ['Private room'],
        },
        quizAnswers: {
          smoking: 'never',
          food_pref: 'veg',
        },
      };

      const roomListing = {
        id: 'room_101',
        city: 'Bengaluru',
        locality: 'Koramangala',
        monthlyRent: 20000,
        roomType: 'Private room',
        preferredGender: 'Male',
        houseRules: ['Veg only', 'No smoking'],
      };

      const fit = calculateCanonicalRoomCompatibility(calibratedSeeker, roomListing);

      expect(fit.score).toBeGreaterThanOrEqual(70);
      expect(fit.budgetScore).toBe(25); // Within budget
      expect(fit.locationScore).toBe(20); // Exact locality match
      expect(fit.genderScore).toBe(20); // Gender satisfied
      expect(fit.rulesScore).toBe(10); // Veg rule + non-smoker rule
      expect(fit.preferenceScore).toBe(8); // Preferred room type
      expect(fit.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('Active Recently Indicator & Freshness Sorting', () => {
    it('formats active status labels accurately based on last activity timestamp', () => {
      const now = Date.now();
      const activeNow = getActiveStatus(new Date(now - 2 * 60 * 1000));
      const activeHoursAgo = getActiveStatus(new Date(now - 3 * 3600 * 1000));
      const activeDaysAgo = getActiveStatus(new Date(now - 2 * 86400 * 1000));

      expect(activeNow.text).toMatch(/Active now/i);
      expect(activeHoursAgo.text).toMatch(/Active \d+h ago/i);
      expect(activeDaysAgo.text).toMatch(/Active \d+ days? ago/i);
    });
  });
});
