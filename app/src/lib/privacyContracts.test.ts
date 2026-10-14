import { describe, expect, it } from 'vitest';
import { toPublicListing, toPublicProfile } from './privacyContracts';

describe('privacy contracts', () => {
  const account = {
    uid: 'person-1', name: 'Asha Rao', city: 'Bengaluru', localities: ['Indiranagar'],
    avatar: 'https://images.example/avatar.png', onboardingComplete: true, roommateDiscoveryEnabled: true,
    phone: '9999999999', email: 'asha@example.test', quizAnswers: { smoking: 'never' },
  } as any;

  it('creates an allowlisted opt-in discovery card only', () => {
    expect(toPublicProfile(account, { showAvatar: true, ageRange: '25-30', budgetRange: '10k-15k' })).toEqual({
      uid: 'person-1', displayName: 'Asha Rao', city: 'Bengaluru', localities: ['Indiranagar'],
      roommateDiscoveryEnabled: true, discoverySetupVersion: 1, schemaVersion: 1,
      avatar: 'https://images.example/avatar.png', ageRange: '25-30', budgetRange: '10k-15k',
    });
  });

  it('does not publish legacy or opted-out accounts', () => {
    expect(toPublicProfile({ ...account, roommateDiscoveryEnabled: undefined })).toBeNull();
    expect(toPublicProfile({ ...account, roommateDiscoveryEnabled: false })).toBeNull();
  });

  it('projects an active verified listing without private fields', () => {
    const projected = toPublicListing({
      ownerId: 'owner-1', ownerName: 'Ramesh', title: 'Sunny room', city: 'Bengaluru', locality: 'Koramangala',
      flatType: '2 BHK', furnishing: 'Furnished', totalRent: 26000, partnerShare: 13000, partnersNeeded: 1,
      amenities: ['WiFi'], houseRules: ['No smoking'], images: ['https://images.example/room.png'],
      status: 'active', ownerVerified: true, phone: '9999999999', address: '80 Feet Road', lat: 12.9,
      ownerQuizAnswers: { smoking: 'never' }, verificationDetails: { secret: true },
    });
    expect(projected).toMatchObject({ ownerId: 'owner-1', title: 'Sunny room', schemaVersion: 1 });
    expect(projected).not.toHaveProperty('phone');
    expect(projected).not.toHaveProperty('address');
    expect(projected).not.toHaveProperty('lat');
    expect(projected).not.toHaveProperty('ownerQuizAnswers');
    expect(projected).not.toHaveProperty('verificationDetails');
  });

  it('does not project pending or unverified listings', () => {
    const base = { ownerId: 'owner-1', title: 'Room', city: 'Bengaluru', locality: 'HSR', flatType: '1 BHK', furnishing: 'Furnished', totalRent: 1, partnerShare: 1, partnersNeeded: 1 };
    expect(toPublicListing({ ...base, status: 'pending_verification', ownerVerified: false })).toBeNull();
  });
});
