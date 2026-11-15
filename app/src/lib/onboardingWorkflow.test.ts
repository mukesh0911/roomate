import { describe, expect, it } from 'vitest';
import {
  getPostOnboardingDestination,
  getSafeReturnDestination,
} from './roleNavigation';
import {
  buildMatchingPreferencesUpdate,
  buildSeekerLifestyleQuizPatch,
} from './profileEditor';
import { getRoomMatchReasons } from './matching';

describe('Room Seeker Matching Preferences & Personalization Workflow', () => {
  describe('Return destination safety for /profile?section=prefs redirects', () => {
    it('preserves safe internal return paths from room cards and explore feed', () => {
      expect(getSafeReturnDestination('/explore')).toBe('/explore');
      expect(getSafeReturnDestination('/explore?room=room_123')).toBe('/explore?room=room_123');
      expect(getSafeReturnDestination('/explore?tab=rooms')).toBe('/explore?tab=rooms');
      expect(getPostOnboardingDestination('find_room', '/explore?room=xyz')).toBe('/explore?room=xyz');
      expect(getPostOnboardingDestination('find_room')).toBe('/explore?tab=rooms');
      expect(getPostOnboardingDestination('team_up')).toBe('/explore?tab=roommates');
    });

    it('rejects external or protocol-relative redirect targets', () => {
      expect(getSafeReturnDestination('https://evil.example/phish')).toBeNull();
      expect(getSafeReturnDestination('//evil.example/phish')).toBeNull();
      expect(getSafeReturnDestination('javascript:alert(1)')).toBeNull();
    });
  });

  describe('Matching Preferences save payload (buildMatchingPreferencesUpdate & lifestyle patch)', () => {
    it('unlocks onboardingComplete when city and existing Google profile name exist without duplicating name', () => {
      const payload = buildMatchingPreferencesUpdate(
        {
          city: 'Hyderabad',
          b: [10000, 22000],
          areas: ['Gachibowli', 'Madhapur'],
          mv: 'Immediately',
          types: ['Private room'],
          gd: 'Any',
          ug: 'Male',
        },
        {
          name: 'Karan Mehta',
          housingPreferences: { activeIntents: ['find_room'] },
        },
      );

      expect(payload.city).toBe('Hyderabad');
      expect(payload.localities).toEqual(['Gachibowli', 'Madhapur']);
      expect(payload.gender).toBe('Male');
      expect(payload.onboardingComplete).toBe(true);
      expect('name' in payload).toBe(false);
      expect(payload.housingPreferences.activeIntents).toEqual(['find_room']);
      expect(payload.housingPreferences.preferredCities).toEqual(['Hyderabad']);
      expect(payload.housingPreferences.preferredLocalities).toEqual(['Gachibowli', 'Madhapur']);
    });

    it('accepts inline name for email signups missing stored profile name and validates limits', () => {
      const emailSignupPayload = buildMatchingPreferencesUpdate(
        {
          name: 'Ananya Rao',
          city: 'Mumbai',
          b: [18000, 32000],
          areas: ['Bandra West'],
          mv: 'Next month',
          types: ['Private room', 'Full flat'],
          gd: 'Female',
          ug: 'Female',
        },
        { name: '' },
      );

      expect(emailSignupPayload.name).toBe('Ananya Rao');
      expect(emailSignupPayload.city).toBe('Mumbai');
      expect(emailSignupPayload.onboardingComplete).toBe(true);

      expect(() =>
        buildMatchingPreferencesUpdate({
          city: 'Bengaluru',
          b: [25000, 15000],
          areas: ['Koramangala'],
          mv: 'Immediately',
          types: [],
          gd: 'Any',
        }),
      ).toThrow();

      expect(() =>
        buildMatchingPreferencesUpdate({
          city: 'Bengaluru',
          b: [10000, 20000],
          areas: ['A', 'B', 'C', 'D'],
          mv: 'Immediately',
          types: [],
          gd: 'Any',
        }),
      ).toThrow();
    });

    it('maps selected seeker habits canonically without fake defaults and clears deselected traits', () => {
      const untouched = buildSeekerLifestyleQuizPatch({}, { roommate_gender: 'any' });
      expect(untouched).toEqual({ roommate_gender: 'any' });

      const chosen = buildSeekerLifestyleQuizPatch(
        {
          diet: 'Vegetarian',
          smoke: 'Non-smoker',
          pets: 'No pets / allergic',
          sleep: 'Early riser',
        },
        { roommate_gender: 'any' },
      );

      expect(chosen).toMatchObject({
        roommate_gender: 'any',
        diet: 'Vegetarian',
        food_pref: 'veg',
        smoke: 'Non-smoker',
        smoking: 'never',
        pets: 'no',
        sleep: 'Early riser',
        sleep_time: 'before_10',
      });

      const toggledOff = buildSeekerLifestyleQuizPatch(
        { diet: '', smoke: '' },
        chosen,
      );
      expect(toggledOff.diet).toBeUndefined();
      expect(toggledOff.food_pref).toBeUndefined();
      expect(toggledOff.smoke).toBeUndefined();
      expect(toggledOff.smoking).toBeUndefined();
      expect(toggledOff.pets).toBe('no');
      expect(toggledOff.sleep_time).toBe('before_10');
    });
  });

  describe('Automatic match % calibration after saving Matching Preferences', () => {
    it('transitions a new Google seeker from 0% uncalibrated to ranked high vs low scores', () => {
      const uncalibratedUser = {
        uid: 'u_new',
        name: 'Priya',
        city: '',
        localities: [],
        budget: 0,
        onboardingComplete: false,
      };

      const strongRoom = {
        id: 'r_high',
        city: 'Bengaluru',
        locality: 'Koramangala',
        monthlyRent: 16000,
        roomType: 'Private room',
        occupancy: 'Single',
        preferredGender: 'Female',
        houseRules: ['Vegetarian', 'Non-smoker', 'No pets'],
      };

      const weakRoom = {
        id: 'r_low',
        city: 'Bengaluru',
        locality: 'Whitefield',
        monthlyRent: 31000,
        roomType: 'PG / Coliving',
        occupancy: 'Triple sharing',
        preferredGender: 'Male',
        houseRules: ['Smoking allowed', 'Pets allowed'],
      };

      const beforeCalib = getRoomMatchReasons(uncalibratedUser, strongRoom);
      expect(beforeCalib.score).toBe(0);
      expect(beforeCalib.reasons).toEqual([]);

      const prefsUpdate = buildMatchingPreferencesUpdate(
        {
          city: 'Bengaluru',
          b: [12000, 20000],
          areas: ['Koramangala'],
          mv: 'Immediately',
          types: ['Private room'],
          gd: 'Female',
          ug: 'Female',
          diet: 'Vegetarian',
          smoke: 'Non-smoker',
          pets: 'No pets / allergic',
        },
        uncalibratedUser,
      );

      const calibratedUser = {
        ...uncalibratedUser,
        ...prefsUpdate,
      };

      const highFit = getRoomMatchReasons(calibratedUser, strongRoom);
      const lowFit = getRoomMatchReasons(calibratedUser, weakRoom);

      expect(highFit.score).toBeGreaterThanOrEqual(85);
      expect(lowFit.score).toBeLessThan(45);
      expect(highFit.score).toBeGreaterThan(lowFit.score + 35);
    });

    it('supports explicit Roommates Team-Up visibility opt-in and opt-out in Matching Preferences', () => {
      const baseSeeker = {
        uid: 'u_seeker',
        name: 'Aarav',
        city: 'Bengaluru',
        housingIntent: 'find_room',
        housingPreferences: {
          activeIntents: ['find_room'],
        },
        roommateDiscoveryEnabled: false,
      };

      const optedIn = buildMatchingPreferencesUpdate(
        {
          city: 'Bengaluru',
          b: [10000, 22000],
          areas: ['Indiranagar'],
          mv: 'Next month',
          types: ['Private room'],
          gd: 'Any',
          teamUpDiscoverable: true,
        },
        baseSeeker,
      );

      expect(optedIn.roommateDiscoveryEnabled).toBe(true);
      expect(optedIn.housingPreferences.activeIntents).toEqual(['find_room', 'team_up']);

      const optedOut = buildMatchingPreferencesUpdate(
        {
          city: 'Bengaluru',
          b: [10000, 22000],
          areas: ['Indiranagar'],
          mv: 'Next month',
          types: ['Private room'],
          gd: 'Any',
          teamUpDiscoverable: false,
        },
        {
          ...baseSeeker,
          housingPreferences: optedIn.housingPreferences,
          roommateDiscoveryEnabled: true,
        },
      );

      expect(optedOut.roommateDiscoveryEnabled).toBe(false);
      expect(optedOut.housingPreferences.activeIntents).toEqual(['find_room']);

      const untouched = buildMatchingPreferencesUpdate(
        {
          city: 'Bengaluru',
          b: [10000, 22000],
          areas: ['Indiranagar'],
          mv: 'Next month',
          types: ['Private room'],
          gd: 'Any',
        },
        baseSeeker,
      );

      expect('roommateDiscoveryEnabled' in untouched).toBe(false);
      expect(untouched.housingPreferences.activeIntents).toEqual(['find_room']);
    });
  });
});
