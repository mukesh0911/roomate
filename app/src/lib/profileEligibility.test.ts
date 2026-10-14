import { describe, expect, it } from 'vitest';
import { hasSharedProfileEssentials, isRoommateDiscoverable } from './profileEligibility';

const shared = {
  name: 'Asha Rao',
  city: 'Bengaluru',
  localities: ['Indiranagar'],
  quizAnswers: { sleep: 'early', food: 'veg', smoking: 'never', guests: 'sometimes', work: 'hybrid' },
};

describe('shared profile and roommate-discovery eligibility', () => {
  it('requires name, city, and a preferred locality for shared completion', () => {
    expect(hasSharedProfileEssentials(shared)).toBe(true);
    expect(hasSharedProfileEssentials({ ...shared, localities: [] })).toBe(false);
    expect(hasSharedProfileEssentials({ ...shared, city: ' ' })).toBe(false);
  });

  it('requires an explicit opt-in for a new profile', () => {
    expect(isRoommateDiscoverable({ ...shared, role: null })).toBe(false);
    expect(isRoommateDiscoverable({ ...shared, role: null, roommateDiscoveryEnabled: true })).toBe(true);
  });

  it('keeps completed legacy seeker profiles private until consent is recorded', () => {
    expect(isRoommateDiscoverable({ ...shared, role: 'seeker' })).toBe(false);
    expect(isRoommateDiscoverable({ ...shared, role: 'owner' })).toBe(false);
  });

  it('never makes a listing owner discoverable merely because they own a listing', () => {
    expect(isRoommateDiscoverable({ ...shared, role: 'owner' })).toBe(false);
  });
});
