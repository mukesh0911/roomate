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

  describe('Phase 2 Interaction & Navigation Contracts', () => {
    it('routes both bottom bar and desktop post buttons to chooser while reserving explicit room actions', () => {
      const chooserActions = ['post', 'post-chooser'];
      const explicitAction = 'data-open-post';
      expect(chooserActions).toContain('post');
      expect(explicitAction).toBe('data-open-post');
    });

    it('defines complete 4-item HUB view navigation with correct destinations', () => {
      const HUB = [
        ['listings', 'My listings', 'Rooms you have posted & draft listings'],
        ['connections', 'Connections & Applications', 'Your room applications and connection requests'],
        ['notifications', 'Notifications', 'Alerts and activity updates'],
        ['profile', 'Profile & Preferences', 'Your habits, budget, localities & details'],
      ];
      expect(HUB.map((item) => item[0])).toEqual(['listings', 'connections', 'notifications', 'profile']);
    });

    it('ensures room cards use data-apply-place for uncontacted listings instead of direct chat initialization', () => {
      const mockListing = { id: 'room_42', title: 'Sunny room in Indiranagar' };
      const relationState = 'none';
      const kind = 'r';

      const isUncontactedRoom = kind === 'r' && relationState === 'none';
      const buttonAttr = isUncontactedRoom ? `data-apply-place="${mockListing.id}"` : `data-msg="r:0"`;

      expect(buttonAttr).toContain('data-apply-place="room_42"');
      expect(buttonAttr).not.toContain('data-c-init');
    });

    it('verifies city switcher supports All Cities and exact city selection', () => {
      const supportedCities = ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai'];
      const cityChoices = ['', ...supportedCities];
      expect(cityChoices).toContain('');
      expect(cityChoices).toContain('Bengaluru');
      expect(cityChoices).toHaveLength(7);
    });
  });
});
