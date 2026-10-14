import type { UserProfile } from '@/hooks/useAuth';

export interface PublicProfile {
  uid: string;
  displayName: string;
  city: string;
  localities: string[];
  roommateDiscoveryEnabled: true;
  discoverySetupVersion: 1;
  schemaVersion: 1;
  avatar?: string;
  ageRange?: string;
  budgetRange?: string;
}

export interface PublicProfileDisclosure {
  showAvatar?: boolean;
  ageRange?: string;
  budgetRange?: string;
}

type DiscoveryAccount = Pick<UserProfile,
  'uid' | 'name' | 'city' | 'localities' | 'avatar' | 'onboardingComplete' | 'roommateDiscoveryEnabled'
>;

function trimmed(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const result = value.trim();
  return result.length > 0 && result.length <= maxLength ? result : undefined;
}

/**
 * Produces the only shape permitted in authenticated roommate discovery.
 * It deliberately has no spread from UserProfile, so private fields cannot
 * reach the projection accidentally.
 */
export function toPublicProfile(
  account: DiscoveryAccount,
  disclosure: PublicProfileDisclosure = {},
): PublicProfile | null {
  const displayName = trimmed(account.name, 80);
  const city = trimmed(account.city, 64);
  const localities = Array.isArray(account.localities)
    ? account.localities
      .map((value) => trimmed(value, 80))
      .filter((value): value is string => !!value)
      .slice(0, 3)
    : [];

  if (
    account.roommateDiscoveryEnabled !== true
    || account.onboardingComplete !== true
    || !trimmed(account.uid, 128)
    || !displayName
    || !city
    || localities.length === 0
  ) {
    return null;
  }

  const profile: PublicProfile = {
    uid: account.uid,
    displayName,
    city,
    localities,
    roommateDiscoveryEnabled: true,
    discoverySetupVersion: 1,
    schemaVersion: 1,
  };

  const avatar = disclosure.showAvatar ? trimmed(account.avatar, 2048) : undefined;
  const ageRange = trimmed(disclosure.ageRange, 32);
  const budgetRange = trimmed(disclosure.budgetRange, 32);
  if (avatar) profile.avatar = avatar;
  if (ageRange) profile.ageRange = ageRange;
  if (budgetRange) profile.budgetRange = budgetRange;
  return profile;
}

export interface PublicListing {
  ownerId: string;
  ownerName?: string;
  ownerAvatar?: string;
  title: string;
  city: string;
  locality: string;
  flatType: string;
  furnishing: string;
  totalRent: number;
  monthlyRent?: number;
  partnerShare: number;
  partnersNeeded: number;
  deposit?: number;
  amenities: string[];
  houseRules: string[];
  images: string[];
  availableFrom?: string;
  status: 'active';
  ownerVerified: true;
  preferredGender?: string;
  schemaVersion: 1;
}

/** Strict anonymous-listing projection. Address, coordinates, description,
 * contacts, moderation fields, and raw owner compatibility inputs are absent. */
export function toPublicListing(source: Record<string, unknown>): PublicListing | null {
  const ownerId = trimmed(source.ownerId, 128);
  const title = trimmed(source.title, 160);
  const city = trimmed(source.city, 64);
  const locality = trimmed(source.locality, 128);
  const flatType = trimmed(source.flatType, 64);
  const furnishing = trimmed(source.furnishing, 64);
  const totalRent = source.totalRent;
  const partnerShare = source.partnerShare;
  const partnersNeeded = source.partnersNeeded;
  if (
    !ownerId || !title || !city || !locality || !flatType || !furnishing
    || source.status !== 'active' || source.ownerVerified !== true
    || typeof totalRent !== 'number' || totalRent <= 0
    || typeof partnerShare !== 'number' || partnerShare < 0
    || typeof partnersNeeded !== 'number' || !Number.isInteger(partnersNeeded) || partnersNeeded < 0
  ) return null;

  const safeStrings = (value: unknown, maxItems: number, maxLength: number) => Array.isArray(value)
    ? value.map((item) => trimmed(item, maxLength)).filter((item): item is string => !!item).slice(0, maxItems)
    : [];

  const result: PublicListing = {
    ownerId,
    title,
    city,
    locality,
    flatType,
    furnishing,
    totalRent,
    partnerShare,
    partnersNeeded,
    amenities: safeStrings(source.amenities, 30, 80),
    houseRules: safeStrings(source.houseRules, 20, 120),
    images: safeStrings(source.images, 12, 2048),
    status: 'active',
    ownerVerified: true,
    schemaVersion: 1,
  };
  const ownerName = trimmed(source.ownerName, 80);
  const ownerAvatar = trimmed(source.ownerAvatar, 2048);
  const availableFrom = trimmed(source.availableFrom, 32);
  const preferredGender = trimmed(source.preferredGender, 24);
  if (ownerName) result.ownerName = ownerName;
  if (ownerAvatar) result.ownerAvatar = ownerAvatar;
  if (typeof source.monthlyRent === 'number' && source.monthlyRent >= 0) result.monthlyRent = source.monthlyRent;
  if (typeof source.deposit === 'number' && source.deposit >= 0) result.deposit = source.deposit;
  if (availableFrom) result.availableFrom = availableFrom;
  if (preferredGender) result.preferredGender = preferredGender;
  return result;
}
