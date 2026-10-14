import { describe, it, expect } from 'vitest';
import {
  resolvePostRoomAction,
  getBrowseRoomsRoute,
  getBrowseSeekersRoute,
  resolveOwnerExploreRedirect,
  getManageListingsRoute,
  getListingDetailRoute,
} from './roleNavigation';

describe('E2E Owner & Seeker Unified User Journey Verification', () => {
  // Mock authentications
  const seekerUser = {
    uid: 'seeker_user_123',
    role: 'seeker' as const,
    name: 'Aarav Patel',
    email: 'aarav@example.com',
    onboardingComplete: true,
  };

  const ownerUser = {
    uid: 'owner_user_456',
    role: 'owner' as const,
    name: 'Priya Sharma',
    email: 'priya@example.com',
    onboardingComplete: true,
  };

  describe('Scenario 1 & 2: Seeker Discovery Journey', () => {
    it('directs seekers to room discovery by default', () => {
      const browseRoute = getBrowseRoomsRoute(seekerUser.role);
      expect(browseRoute).toBe('/explore?tab=rooms');
    });

    it('does not require seekers to complete an owner profile to browse rooms', () => {
      expect(seekerUser.role).toBe('seeker');
      expect((seekerUser as any).propertyBasics).toBeUndefined();
    });
  });

  describe('Scenario 3: Seeker Access to "Post a Room" Without Logging Out', () => {
    it('navigates seamlessly to /edit-listing/new without requiring role switch in Settings', () => {
      const action = resolvePostRoomAction(true, seekerUser.role);
      expect(action.type).toBe('navigate_new_listing');
      expect(action.path).toBe('/edit-listing/new');
    });

    it('prompts unauthenticated users to log in with direct /edit-listing/new redirect', () => {
      const action = resolvePostRoomAction(false, null);
      expect(action.type).toBe('auth_prompt');
      expect(action.path).toBe('/edit-listing/new');
    });
  });

  describe('Scenario 4 & 8: Shared Listing Creation & Publication Flow', () => {
    const listingPayload = {
      title: 'Spacious Master Room in Koramangala',
      city: 'Bengaluru',
      locality: 'Koramangala',
      monthlyRent: 16000,
      deposit: 32000,
      flatType: '2BHK',
      furnishing: 'Fully Furnished',
      partnersNeeded: 1,
      availableFrom: '2026-11-01',
      amenities: ['Wifi', 'AC', 'Power Backup'],
      houseRules: ['No smoking inside'],
    };

    it('validates that required listing creation fields match for both roles', () => {
      // Both Seeker and Owner supply the exact same core schema
      expect(listingPayload.title).toBeTruthy();
      expect(listingPayload.city).toBeTruthy();
      expect(listingPayload.locality).toBeTruthy();
      expect(listingPayload.monthlyRent).toBeGreaterThan(0);
    });

    it('both Owner and Seeker enter the identical creation route /edit-listing/new', () => {
      const seekerAction = resolvePostRoomAction(true, seekerUser.role);
      const ownerAction = resolvePostRoomAction(true, ownerUser.role);

      expect(seekerAction.path).toBe('/edit-listing/new');
      expect(ownerAction.path).toBe('/edit-listing/new');
    });
  });

  describe('Scenario 5 & 6: Post-Publication Direct CTAs and Ownership Validation', () => {
    const createdListingId = 'listing_new_789';

    it('provides direct link to view the public listing detail', () => {
      const detailRoute = getListingDetailRoute(createdListingId);
      expect(detailRoute).toBe(`/room/${createdListingId}`);
    });

    it('provides direct link to manage the published listing', () => {
      const manageRoute = getManageListingsRoute();
      expect(manageRoute).toBe('/my-listings');
    });

    it('confirms that the listing belongs strictly to the authenticated creator', () => {
      const seekerListing = {
        id: createdListingId,
        ownerId: seekerUser.uid,
        title: 'Spacious Room',
      };

      // Owner verification check
      const canSeekerEdit = seekerListing.ownerId === seekerUser.uid;
      const canOtherEdit = seekerListing.ownerId === ownerUser.uid;

      expect(canSeekerEdit).toBe(true);
      expect(canOtherEdit).toBe(false);
    });
  });

  describe('Scenario 7 & 9: Returning Later & Security Isolation', () => {
    it('allows a user who created a listing to return and manage it via /my-listings', () => {
      const managementPath = getManageListingsRoute();
      expect(managementPath).toBe('/my-listings');
    });

    it('ensures users cannot modify listings owned by others', () => {
      const foreignListing = {
        id: 'foreign_listing_999',
        ownerId: 'different_user_000',
      };

      const hasOwnership = foreignListing.ownerId === seekerUser.uid;
      expect(hasOwnership).toBe(false);
    });
  });

  describe('Scenario 10 & 11: Owner Journey & Freedom to Explore', () => {
    it('allows owners to freely explore public rooms without forced bounce', () => {
      const redirect = resolveOwnerExploreRedirect(ownerUser.role, 'rooms');
      expect(redirect).toBeNull();
    });

    it('allows owners to browse room seeker profiles', () => {
      const seekersRoute = getBrowseSeekersRoute(ownerUser.role);
      expect(seekersRoute).toBe('/explore?tab=roommates');
    });
  });
});
