/**
 * Role-Aware Navigation Utilities for NestMate
 * Ensures strict separation of Owner and Seeker experiences across
 * desktop headers, mobile bottom bars, deep-links, and marketplace routing.
 */

export type UserRole = 'owner' | 'seeker' | null | undefined;

/**
 * Accept only local, non-auth destinations when resuming a user journey.
 * This avoids open redirects and prevents an onboarding loop.
 */
export function getSafeReturnDestination(value?: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (value === '/login' || value.startsWith('/login?') || value.startsWith('/onboarding/')) return null;
  return value;
}

export function getPostOnboardingDestination(
  housingIntent: 'find_room' | 'team_up',
  returnDestination?: string | null
): string {
  return getSafeReturnDestination(returnDestination)
    || (housingIntent === 'team_up' ? '/explore?tab=roommates' : '/explore?tab=rooms');
}

/**
 * Returns the appropriate dashboard route depending on authentication and role.
 * Includes optional tab persistence.
 */
export function getDashboardRoute(
  isAuthenticated: boolean,
  _role?: UserRole,
  tab?: string | null
): string {
  if (!isAuthenticated) return '/login';
  if (tab === 'listings') return '/my-listings';
  return tab ? `/explore?tab=${tab}` : '/explore?tab=rooms';
}

/**
 * Resolves seeker/roommate discovery route:
 * - All users explore flatmates and roommates on the unified discovery tab (/explore?tab=roommates)
 */
export function getBrowseSeekersRoute(_role?: UserRole): string {
  return '/explore?tab=roommates';
}

/**
 * Resolves room browsing route by role:
 * - Owners navigate to their property listings management (/owner-dashboard?tab=listings)
 * - Seekers navigate to the public room discovery tab (/explore?tab=rooms)
 */
/**
 * Resolves room browsing route:
 * - Directs to public room discovery (/explore?tab=rooms)
 */
export function getBrowseRoomsRoute(_role?: UserRole): string {
  return '/explore?tab=rooms';
}

/**
 * Checks if an Owner landing on ExplorePage should be redirected.
 * Under unified architecture, owners can freely browse public rooms and flatmates.
 */
export function resolveOwnerExploreRedirect(
  _role: UserRole,
  _activeTab: string
): string | null {
  return null;
}

/**
 * Returns the logo click destination:
 * - All authenticated & guest users return to the home discovery experience
 */
export function getLogoDestination(_role?: UserRole): string {
  return '/';
}

/**
 * Action resolver when user clicks "+ Post Room":
 * - Unauthenticated: prompts auth with /edit-listing/new redirect
 * - Authenticated (Seeker or Owner): navigates directly to /edit-listing/new
 */
export function resolvePostRoomAction(
  isAuthenticated: boolean,
  _role?: UserRole
): { type: 'auth_prompt' | 'navigate_new_listing'; path: string } {
  if (!isAuthenticated) {
    return { type: 'auth_prompt', path: '/edit-listing/new' };
  }
  return { type: 'navigate_new_listing', path: '/edit-listing/new' };
}

/**
 * Route to manage properties and applicants
 */
export function getManageListingsRoute(): string {
  return '/my-listings';
}

/**
 * Route to view public room listing detail
 */
export function getListingDetailRoute(listingId: string): string {
  return `/room/${listingId}`;
}
