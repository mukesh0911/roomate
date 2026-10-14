import { describe, it, expect } from 'vitest';
import {
  getDashboardRoute,
  getBrowseSeekersRoute,
  getBrowseRoomsRoute,
  resolveOwnerExploreRedirect,
  getLogoDestination,
  resolvePostRoomAction,
  getManageListingsRoute,
  getListingDetailRoute,
  getSafeReturnDestination,
  getPostOnboardingDestination,
} from './roleNavigation';

describe('roleNavigation utilities', () => {
  describe('getDashboardRoute', () => {
    it('redirects unauthenticated users to /login', () => {
      expect(getDashboardRoute(false, null)).toBe('/login');
      expect(getDashboardRoute(false, 'owner')).toBe('/login');
      expect(getDashboardRoute(false, 'seeker')).toBe('/login');
    });

    it('routes users to /explore or /my-listings', () => {
      expect(getDashboardRoute(true, 'owner')).toBe('/explore?tab=rooms');
      expect(getDashboardRoute(true, 'owner', 'listings')).toBe('/my-listings');
      expect(getDashboardRoute(true, 'owner', 'roommates')).toBe('/explore?tab=roommates');
    });

    it('routes Seeker to /explore with or without tab', () => {
      expect(getDashboardRoute(true, 'seeker')).toBe('/explore?tab=rooms');
      expect(getDashboardRoute(true, 'seeker', 'roommates')).toBe('/explore?tab=roommates');
      expect(getDashboardRoute(true, 'seeker', 'saved')).toBe('/explore?tab=saved');
    });
  });

  describe('getBrowseSeekersRoute (Unified discovery)', () => {
    it('routes all users to Consumer Flatmate Explore (/explore?tab=roommates)', () => {
      expect(getBrowseSeekersRoute('owner')).toBe('/explore?tab=roommates');
      expect(getBrowseSeekersRoute('seeker')).toBe('/explore?tab=roommates');
      expect(getBrowseSeekersRoute(null)).toBe('/explore?tab=roommates');
    });
  });

  describe('getBrowseRoomsRoute', () => {
    it('routes both Owner and Seeker to Rooms Explore tab (/explore?tab=rooms)', () => {
      expect(getBrowseRoomsRoute('owner')).toBe('/explore?tab=rooms');
      expect(getBrowseRoomsRoute('seeker')).toBe('/explore?tab=rooms');
      expect(getBrowseRoomsRoute(null)).toBe('/explore?tab=rooms');
    });
  });

  describe('resolveOwnerExploreRedirect', () => {
    it('allows Owner to freely browse rooms and roommates without forced redirect', () => {
      expect(resolveOwnerExploreRedirect('owner', 'roommates')).toBeNull();
      expect(resolveOwnerExploreRedirect('owner', 'rooms')).toBeNull();
    });

    it('does not redirect Seeker on roommates tab', () => {
      const redirect = resolveOwnerExploreRedirect('seeker', 'roommates');
      expect(redirect).toBeNull();
    });
  });

  describe('getLogoDestination', () => {
    it('returns / for all users to reach the home discovery experience', () => {
      expect(getLogoDestination('owner')).toBe('/');
      expect(getLogoDestination('seeker')).toBe('/');
      expect(getLogoDestination(null)).toBe('/');
    });
  });

  describe('resolvePostRoomAction (Unified Account & Listing Creation)', () => {
    it('prompts auth with redirect to /edit-listing/new when unauthenticated', () => {
      const action = resolvePostRoomAction(false, null);
      expect(action.type).toBe('auth_prompt');
      expect(action.path).toBe('/edit-listing/new');
    });

    it('navigates directly to /edit-listing/new for Owners', () => {
      const action = resolvePostRoomAction(true, 'owner');
      expect(action.type).toBe('navigate_new_listing');
      expect(action.path).toBe('/edit-listing/new');
    });

    it('navigates seamlessly to /edit-listing/new for Seekers without requiring role switch', () => {
      const action = resolvePostRoomAction(true, 'seeker');
      expect(action.type).toBe('navigate_new_listing');
      expect(action.path).toBe('/edit-listing/new');
    });
  });

  describe('Listing Management & Detail Routes', () => {
    it('returns the standard management route /my-listings', () => {
      expect(getManageListingsRoute()).toBe('/my-listings');
    });

    it('returns the public room detail route for a given listing ID', () => {
      expect(getListingDetailRoute('listing-xyz-123')).toBe('/room/listing-xyz-123');
    });
  });

  describe('onboarding return destinations', () => {
    it('preserves valid local destinations and rejects unsafe or looping paths', () => {
      expect(getSafeReturnDestination('/edit-listing/new')).toBe('/edit-listing/new');
      expect(getSafeReturnDestination('/room/room-1?source=cta')).toBe('/room/room-1?source=cta');
      expect(getSafeReturnDestination('https://example.com')).toBeNull();
      expect(getSafeReturnDestination('//example.com')).toBeNull();
      expect(getSafeReturnDestination('/login')).toBeNull();
      expect(getSafeReturnDestination('/onboarding/seeker')).toBeNull();
    });

    it('uses the return destination first, otherwise follows the selected intent', () => {
      expect(getPostOnboardingDestination('find_room', '/edit-listing/new')).toBe('/edit-listing/new');
      expect(getPostOnboardingDestination('find_room')).toBe('/explore?tab=rooms');
      expect(getPostOnboardingDestination('team_up')).toBe('/explore?tab=roommates');
    });
  });
});
