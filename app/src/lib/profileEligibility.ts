import type { UserProfile } from '@/hooks/useAuth';

type ProfileLike = Partial<Pick<UserProfile,
  'name' | 'city' | 'localities' | 'quizAnswers' | 'roommateDiscoveryEnabled' | 'role'
>>;

/**
 * The minimum shared profile required to use authenticated marketplace actions.
 * It deliberately does not depend on a permanent seeker/owner account mode.
 */
export function hasSharedProfileEssentials(profile: ProfileLike | null | undefined): boolean {
  if (!profile) return false;
  const name = typeof profile.name === 'string' ? profile.name.trim() : '';
  const city = typeof profile.city === 'string' ? profile.city.trim() : '';
  const localities = Array.isArray(profile.localities)
    ? profile.localities.filter((locality): locality is string => typeof locality === 'string' && locality.trim().length > 0)
    : [];
  return name.length > 0 && city.length > 0 && localities.length > 0;
}

export function hasCompatibilityAnswers(profile: ProfileLike | null | undefined): boolean {
  const answers = profile?.quizAnswers;
  return !!answers && typeof answers === 'object' && !Array.isArray(answers) && Object.keys(answers).length >= 5;
}

/**
 * Roommate discovery always requires a deliberate opt-in. Legacy seeker data
 * is retained privately but is never interpreted as consent to publish it.
 */
export function isRoommateDiscoverable(profile: ProfileLike | null | undefined): boolean {
  if (!hasSharedProfileEssentials(profile) || !hasCompatibilityAnswers(profile)) return false;
  return profile?.roommateDiscoveryEnabled === true;
}
