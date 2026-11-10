import type { UserProfile } from '@/hooks/useAuth';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NESTMATE CANONICAL HOUSING INTENT ARCHITECTURE (PHASE 1)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Core Product Thesis: "Compatibility, Not Just Availability."
 *
 * The canonical model strictly differentiates:
 * 1. Account Role ('seeker' | 'owner' | 'both' | 'admin') -> Capability/Identity
 * 2. Housing Intent ('find_room' | 'team_up' | 'have_room') -> Active Marketplace Goal
 *
 * Supported primary intents:
 * - 'find_room': User wants to move into an existing available room/flat/PG.
 * - 'team_up': User wants to connect with another seeker to jointly rent a property.
 * - 'have_room': User already has an apartment/room and wants a roommate to move in.
 */

export type HousingIntent = 'find_room' | 'team_up' | 'have_room';

export type AccountRole = 'seeker' | 'owner' | 'both' | 'admin';

/**
 * Canonical Housing Preferences Schema
 * Stored in `users/{uid}.housingPreferences`
 */
export interface UserHousingPreferences {
  /** Array of active housing intents; user can have multiple concurrent requirements */
  activeIntents: HousingIntent[];
  /** Preferred target cities (e.g. ['Bengaluru', 'Chennai']) */
  preferredCities?: string[];
  /** Preferred target localities (e.g. ['Koramangala', 'HSR Layout']) */
  preferredLocalities?: string[];
  /** Budget range in INR */
  budgetMin?: number;
  budgetMax?: number;
  /** Desired move-in date or timeframe */
  moveInDate?: string;
  /** Active search toggle; when false, user is not looking right now */
  isActivelySearching?: boolean;
  /** For 'have_room': pointer to the user's active listing document in Firestore */
  associatedListingId?: string;
  /** Timestamp when preferences were last updated */
  updatedAt?: any;
}

/**
 * Context structure for listing relationship verification
 */
export interface ListingVerificationContext {
  id: string;
  ownerId: string;
  status?: string; // 'active' | 'draft' | 'pending_verification' | 'filled' | 'closed' | 'paused'
  isDeleted?: boolean;
  totalRent?: number;
  partnerShare?: number;
  flatType?: string;
  roomType?: string;
  partnersNeeded?: number;
  locality?: string;
  city?: string;
  isLiveInRoom?: boolean; // Spare room in occupied flat vs commercial property
}

/**
 * Centralized Housing Intent Resolution Result
 */
export interface ResolvedHousingIntent {
  /** All validated active intents */
  activeIntents: HousingIntent[];

  /** High-level boolean flags for application components */
  isLookingForRoom: boolean;       // Has 'find_room'
  isTeamUpSeeker: boolean;         // Has 'team_up'
  isLiveInHost: boolean;           // Has 'have_room' AND verified valid active listing
  isPropertyHost: boolean;         // Commercial landlord / property manager
  hasValidAvailableRoom: boolean;  // Verified ownership of active listing
  associatedListingId?: string;    // Associated listing ID if valid

  /** Whether the user profile lacks housing intent data or has ambiguous intent */
  needsIntentCompletion: boolean;

  /** Whether the user is eligible to appear in public roommate discovery */
  isDiscoveryEligible: boolean;
  discoveryIneligibilityReason?:
    | 'banned'
    | 'suspended'
    | 'admin'
    | 'inactive_search'
    | 'commercial_landlord_only'
    | 'find_room_only'
    | 'have_room_unverified_listing'
    | 'have_room_ambiguous_listings'
    | 'no_active_intent';

  /** Human-readable display badge */
  displayBadge: {
    text: string;
    variant: 'seeker' | 'team_up' | 'live_in_host' | 'property_host' | 'unknown';
  };

  /** Summary of raw input fields used in resolution */
  rawSources: {
    declaredIntents?: HousingIntent[];
    legacyIntent?: string;
    legacyRole?: string;
    legacyOwnerType?: string;
    status?: string;
  };
}

/**
 * Validates whether a given listing document establishes a genuine,
 * available Live-in Host relationship for a user.
 */
export function validateLiveInListingRelationship(
  userId: string,
  listing: ListingVerificationContext | null | undefined
): { isValid: boolean; reason?: string } {
  if (!listing) {
    return { isValid: false, reason: 'No accommodation listing provided' };
  }
  if (!listing.id || typeof listing.id !== 'string') {
    return { isValid: false, reason: 'Invalid or missing listing identifier' };
  }
  if (listing.ownerId !== userId) {
    return { isValid: false, reason: 'Listing ownerId does not match user UID' };
  }
  if (listing.isDeleted === true) {
    return { isValid: false, reason: 'Listing has been deleted' };
  }
  if (listing.status !== 'active') {
    return { isValid: false, reason: `Listing status is '${listing.status || 'unknown'}', must be 'active'` };
  }
  return { isValid: true };
}

/**
 * Normalizes legacy string intent values into canonical HousingIntent[].
 * Does not guess when given empty or unrecognizable values.
 */
export function normalizeLegacyHousingIntent(raw: any): {
  intents: HousingIntent[];
  isAmbiguous: boolean;
  originalValue: any;
} {
  if (raw === null || raw === undefined || raw === '') {
    return { intents: [], isAmbiguous: false, originalValue: raw };
  }

  // Already array of intents
  if (Array.isArray(raw)) {
    const valid = raw.filter((i): i is HousingIntent =>
      i === 'find_room' || i === 'team_up' || i === 'have_room'
    );
    const unique = Array.from(new Set(valid));
    return { intents: unique, isAmbiguous: unique.length === 0 && raw.length > 0, originalValue: raw };
  }

  const str = String(raw).trim().toLowerCase();

  switch (str) {
    case 'find_room':
    case 'looking for a room':
    case 'room_seeker':
    case 'seeker':
      return { intents: ['find_room'], isAmbiguous: false, originalValue: raw };

    case 'team_up':
    case 'team-up & rent together':
    case 'teaming up':
    case 'team-up':
      return { intents: ['team_up'], isAmbiguous: false, originalValue: raw };

    case 'have_room':
    case 'roommate_for_my_room':
    case 'room available':
    case 'live-in host':
    case 'owner_flatmate':
      return { intents: ['have_room'], isAmbiguous: false, originalValue: raw };

    case 'room_and_roommate':
      // Legacy questionnaire option: user needs both room and flatmate
      return { intents: ['find_room', 'team_up'], isAmbiguous: false, originalValue: raw };

    case 'offering & seeking':
      return { intents: ['find_room', 'have_room'], isAmbiguous: false, originalValue: raw };

    default:
      return { intents: [], isAmbiguous: true, originalValue: raw };
  }
}

/**
 * Validates housing preferences object strictly without throwing.
 */
export function validateHousingPreferences(prefs: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!prefs || typeof prefs !== 'object') {
    return { isValid: false, errors: ['Housing preferences must be a non-null object'] };
  }

  if (prefs.activeIntents !== undefined) {
    if (!Array.isArray(prefs.activeIntents)) {
      errors.push('activeIntents must be an array');
    } else {
      const allowed: HousingIntent[] = ['find_room', 'team_up', 'have_room'];
      for (const intent of prefs.activeIntents) {
        if (!allowed.includes(intent)) {
          errors.push(`Invalid housing intent: "${intent}". Allowed: ${allowed.join(', ')}`);
        }
      }
    }
  }

  if (prefs.budgetMin !== undefined && prefs.budgetMin !== null) {
    if (typeof prefs.budgetMin !== 'number' || isNaN(prefs.budgetMin) || prefs.budgetMin < 0) {
      errors.push('budgetMin must be a non-negative number');
    }
  }

  if (prefs.budgetMax !== undefined && prefs.budgetMax !== null) {
    if (typeof prefs.budgetMax !== 'number' || isNaN(prefs.budgetMax) || prefs.budgetMax < 0) {
      errors.push('budgetMax must be a non-negative number');
    }
  }

  if (
    typeof prefs.budgetMin === 'number' &&
    typeof prefs.budgetMax === 'number' &&
    prefs.budgetMin > prefs.budgetMax
  ) {
    errors.push(`budgetMin (${prefs.budgetMin}) cannot be greater than budgetMax (${prefs.budgetMax})`);
  }

  if (prefs.preferredCities !== undefined && prefs.preferredCities !== null) {
    if (!Array.isArray(prefs.preferredCities)) {
      errors.push('preferredCities must be an array of strings');
    } else if (prefs.preferredCities.some((c: any) => typeof c !== 'string' || c.trim() === '')) {
      errors.push('preferredCities cannot contain empty or non-string values');
    }
  }

  if (prefs.preferredLocalities !== undefined && prefs.preferredLocalities !== null) {
    if (!Array.isArray(prefs.preferredLocalities)) {
      errors.push('preferredLocalities must be an array of strings');
    } else if (prefs.preferredLocalities.some((l: any) => typeof l !== 'string' || l.trim() === '')) {
      errors.push('preferredLocalities cannot contain empty or non-string values');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Migration helper: Constructs canonical UserHousingPreferences from a legacy user document
 * without mutating or guessing ambiguous data.
 */
export function buildCanonicalPreferencesFromLegacy(profile: any): UserHousingPreferences {
  const norm = normalizeLegacyHousingIntent(profile?.housingIntent || profile?.roommateSeekingType);
  const budget = Number(profile?.budget || 0);

  const localities: string[] = Array.isArray(profile?.localities)
    ? profile.localities.filter(Boolean)
    : profile?.locality
      ? [profile.locality]
      : [];

  const cities: string[] = profile?.city ? [profile.city] : [];

  return {
    activeIntents: norm.intents,
    preferredCities: cities,
    preferredLocalities: localities,
    budgetMin: budget > 0 ? Math.round(budget * 0.8) : undefined,
    budgetMax: budget > 0 ? Math.round(budget * 1.2) : undefined,
    moveInDate: profile?.moveInDate || profile?.availableFrom || undefined,
    isActivelySearching: profile?.status === 'active' && profile?.onboardingComplete === true,
  };
}

/**
 * Centralized Housing Intent Resolution Engine
 *
 * Deterministically resolves a user's housing intent by inspecting canonical preferences,
 * legacy fields, moderation status, and listing relationships.
 *
 * Critical Rules:
 * 1. Never silently classify an unknown user as find_room.
 * 2. Never silently classify every listing owner as have_room.
 * 3. Never treat an admin account as a housing candidate.
 * 4. Never treat a suspended or banned account as an active discovery candidate.
 * 5. Never use fake defaults to manufacture housing intent.
 */
export function resolveUserHousingIntent(
  user: Partial<UserProfile> | any | null | undefined,
  userListings?: ListingVerificationContext[] | ListingVerificationContext | null
): ResolvedHousingIntent {
  const rawSources = {
    declaredIntents: user?.housingPreferences?.activeIntents,
    legacyIntent: user?.housingIntent,
    legacyRole: user?.role,
    legacyOwnerType: user?.ownerType,
    status: user?.status,
  };

  // 1. Guard against empty/missing user
  if (!user || (!user.uid && !user.id)) {
    return {
      activeIntents: [],
      isLookingForRoom: false,
      isTeamUpSeeker: false,
      isLiveInHost: false,
      isPropertyHost: false,
      hasValidAvailableRoom: false,
      needsIntentCompletion: true,
      isDiscoveryEligible: false,
      discoveryIneligibilityReason: 'no_active_intent',
      displayBadge: { text: 'Intent Needed', variant: 'unknown' },
      rawSources,
    };
  }

  const uid = user.uid || user.id || '';
  const status = (user.status || 'active').toLowerCase();
  const role = (user.role || '').toLowerCase();
  const ownerType = (user.ownerType || '').toLowerCase();

  // 2. Moderation & Administrative Guards
  if (status === 'banned') {
    return {
      activeIntents: [],
      isLookingForRoom: false,
      isTeamUpSeeker: false,
      isLiveInHost: false,
      isPropertyHost: false,
      hasValidAvailableRoom: false,
      needsIntentCompletion: false,
      isDiscoveryEligible: false,
      discoveryIneligibilityReason: 'banned',
      displayBadge: { text: 'Account Banned', variant: 'unknown' },
      rawSources,
    };
  }

  if (status === 'suspended') {
    return {
      activeIntents: [],
      isLookingForRoom: false,
      isTeamUpSeeker: false,
      isLiveInHost: false,
      isPropertyHost: false,
      hasValidAvailableRoom: false,
      needsIntentCompletion: false,
      isDiscoveryEligible: false,
      discoveryIneligibilityReason: 'suspended',
      displayBadge: { text: 'Account Suspended', variant: 'unknown' },
      rawSources,
    };
  }

  if (role === 'admin') {
    return {
      activeIntents: [],
      isLookingForRoom: false,
      isTeamUpSeeker: false,
      isLiveInHost: false,
      isPropertyHost: false,
      hasValidAvailableRoom: false,
      needsIntentCompletion: false,
      isDiscoveryEligible: false,
      discoveryIneligibilityReason: 'admin',
      displayBadge: { text: 'Administrator', variant: 'unknown' },
      rawSources,
    };
  }

  // 3. Resolve Intents: Priority 1 = canonical housingPreferences; Priority 2 = legacy
  let intents: HousingIntent[] = [];
  let isFromCanonical = false;

  if (
    user.housingPreferences &&
    Array.isArray(user.housingPreferences.activeIntents) &&
    user.housingPreferences.activeIntents.length > 0
  ) {
    const valid = user.housingPreferences.activeIntents.filter((i: any): i is HousingIntent =>
      i === 'find_room' || i === 'team_up' || i === 'have_room'
    );
    intents = Array.from(new Set(valid));
    isFromCanonical = true;
  }

  if (intents.length === 0) {
    const rawIntentStr = typeof user.housingIntent === 'string' && user.housingIntent.trim().length > 0
      ? user.housingIntent.trim()
      : undefined;
    const rawSeekingType = typeof user.roommateSeekingType === 'string' && user.roommateSeekingType.trim().length > 0
      ? user.roommateSeekingType.trim()
      : undefined;
    const hasRoomBool = typeof user.hasRoom === 'boolean' ? user.hasRoom : undefined;

    const intentNorm = rawIntentStr ? normalizeLegacyHousingIntent(rawIntentStr) : null;
    const seekingNorm = rawSeekingType ? normalizeLegacyHousingIntent(rawSeekingType) : null;
    const hasRoomIntents: HousingIntent[] = hasRoomBool === true ? ['have_room'] : [];

    // Detect conflicting signals: e.g. user claims find_room, but hasRoom === true or seekingType === roommate_for_my_room
    const claimsFindRoom = (intentNorm && intentNorm.intents.includes('find_room')) ||
      (seekingNorm && seekingNorm.intents.includes('find_room'));
    const claimsHaveRoom = hasRoomBool === true ||
      (intentNorm && intentNorm.intents.includes('have_room')) ||
      (seekingNorm && seekingNorm.intents.includes('have_room'));

    const isExplicitCompound = rawIntentStr === 'room_and_roommate' || rawIntentStr === 'offering & seeking';
    const isConflicting = !isExplicitCompound && claimsFindRoom && claimsHaveRoom && (
      (rawIntentStr === 'find_room' && (hasRoomBool === true || rawSeekingType === 'roommate_for_my_room')) ||
      (rawIntentStr === 'have_room' && (hasRoomBool === false || rawSeekingType === 'find_room'))
    );

    if (isConflicting) {
      // Conflicting/ambiguous legacy signals cannot establish a reliable intent
      intents = [];
    } else if (intentNorm && intentNorm.intents.length > 0) {
      intents = intentNorm.intents;
    } else if (seekingNorm && seekingNorm.intents.length > 0) {
      intents = seekingNorm.intents;
    } else if (hasRoomIntents.length > 0) {
      intents = hasRoomIntents;
    } else {
      intents = [];
    }
  }

  // 4. Listing verification and deterministic association for Live-in Host ('have_room')
  const listingsArray: ListingVerificationContext[] = Array.isArray(userListings)
    ? userListings
    : userListings
      ? [userListings]
      : [];

  // Filter candidate listings to active, non-deleted listings owned by this user
  const validCandidateListings = listingsArray.filter(
    (listing) => validateLiveInListingRelationship(uid, listing).isValid
  );

  // Deterministic association hierarchy:
  // 1. Explicit user.housingPreferences.associatedListingId pointing to an active listing owned by the user
  //    WITH reliable occupancy evidence (isLiveInRoom === true).
  // 2. Ambiguity check: Multiple candidate listings without explicit association are AMBIGUOUS.
  // 3. Unverified resident declarations (ownerType: 'owner_flatmate', roomType: 'Private room', or partnersNeeded)
  //    WITHOUT verified occupancy evidence on the listing context are strictly EXCLUDED.
  let validLiveInListing: ListingVerificationContext | undefined = undefined;
  let isListingAssociationAmbiguous = false;

  const explicitId = user.housingPreferences?.associatedListingId || user.associatedListingId;

  if (explicitId) {
    // Explicit association provided: Must match an active, valid listing owned by this user
    const matchedExplicit = validCandidateListings.find((l) => l.id === explicitId);
    if (matchedExplicit) {
      // Must have reliable occupancy evidence (isLiveInRoom === true).
      // Never infer residence from roomType, partnersNeeded, listing ownership alone,
      // or an unverified user role.
      if (matchedExplicit.isLiveInRoom === true && ownerType !== 'landlord') {
        validLiveInListing = matchedExplicit;
      } else {
        // Unverified resident declaration or commercial landlord
        validLiveInListing = undefined;
      }
    } else {
      // Explicit ID was invalid, deleted, inactive, or owned by someone else
      validLiveInListing = undefined;
    }
  } else if (validCandidateListings.length > 1) {
    // Multiple candidate listings exist without an explicit association -> AMBIGUOUS
    // An ambiguous association must NOT qualify the user as a verified Live-in Host.
    isListingAssociationAmbiguous = true;
    validLiveInListing = undefined;
  } else if (validCandidateListings.length === 1 && validCandidateListings[0].isLiveInRoom === true && ownerType !== 'landlord') {
    // Single unambiguous active listing with verified occupancy evidence (isLiveInRoom)
    validLiveInListing = validCandidateListings[0];
  } else {
    // Single listing or no listing without explicit association or without reliable occupancy evidence
    // Classified as unverified declaration and excluded from Live-in Host discovery.
    validLiveInListing = undefined;
  }

  const hasValidAvailableRoom = Boolean(validLiveInListing);

  // If user declared 'have_room' or has live-in flatmate role
  const claimsHaveRoom = intents.includes('have_room') || ownerType === 'owner_flatmate';
  const isLiveInHost = claimsHaveRoom && hasValidAvailableRoom && ownerType !== 'landlord';

  // Commercial landlord distinction:
  // Role 'owner' with ownerType 'landlord', or owner who does not have verified live-in status and does not have seeker team-up intent.
  const isPropertyHost = role === 'owner' && (ownerType === 'landlord' || (!isLiveInHost && !claimsHaveRoom));

  const isLookingForRoom = intents.includes('find_room');
  const isTeamUpSeeker = intents.includes('team_up');

  // Check if intent completion is needed
  const needsIntentCompletion = !isPropertyHost && intents.length === 0;

  // Active searching flag
  const isActivelySearching =
    user.housingPreferences?.isActivelySearching !== false &&
    user.isActivelySearching !== false &&
    user.roommateDiscoveryEnabled !== false;

  // Roommate discovery eligibility (Phase 2):
  // Include A: Team-Up Seekers (isTeamUpSeeker === true)
  // Include B: Live-in Hosts (isLiveInHost === true)
  // Exclude: Commercial landlords without Team-Up intent, admin, banned, suspended,
  //          inactive search, incomplete intent, ambiguous listing associations, and find_room-only users.
  let isDiscoveryEligible = false;
  let discoveryIneligibilityReason: ResolvedHousingIntent['discoveryIneligibilityReason'] = undefined;

  if (status === 'banned') {
    discoveryIneligibilityReason = 'banned';
  } else if (status === 'suspended') {
    discoveryIneligibilityReason = 'suspended';
  } else if (role === 'admin' || user.isAdmin === true) {
    discoveryIneligibilityReason = 'admin';
  } else if (!isActivelySearching) {
    discoveryIneligibilityReason = 'inactive_search';
  } else if (isPropertyHost && !isTeamUpSeeker) {
    discoveryIneligibilityReason = 'commercial_landlord_only';
  } else if (isTeamUpSeeker) {
    // Both pure Team-Up seekers and dual-role commercial landlords with genuine team_up intent qualify
    isDiscoveryEligible = true;
  } else if (isLiveInHost) {
    isDiscoveryEligible = true;
  } else if (isListingAssociationAmbiguous) {
    discoveryIneligibilityReason = 'have_room_ambiguous_listings';
  } else if (claimsHaveRoom && !hasValidAvailableRoom) {
    discoveryIneligibilityReason = 'have_room_unverified_listing';
  } else if (isLookingForRoom) {
    // Room seekers looking for physical units belong in Rooms & Flats, not Roommates
    discoveryIneligibilityReason = 'find_room_only';
  } else {
    discoveryIneligibilityReason = 'no_active_intent';
  }

  // Human-readable Display Badge (Default to Intent Needed, never fabricate Looking for a room)
  let badgeText = 'Intent Needed';
  let badgeVariant: ResolvedHousingIntent['displayBadge']['variant'] = 'unknown';

  if (isLiveInHost) {
    badgeText = 'Room Available';
    badgeVariant = 'live_in_host';
  } else if (isTeamUpSeeker && isLookingForRoom) {
    badgeText = 'Seeking Room & Team-Up';
    badgeVariant = 'team_up';
  } else if (isLookingForRoom && isPropertyHost) {
    badgeText = 'Offering & Seeking';
    badgeVariant = 'seeker';
  } else if (isLookingForRoom) {
    badgeText = 'Looking for a room';
    badgeVariant = 'seeker';
  } else if (isTeamUpSeeker) {
    badgeText = 'Teaming Up for a Room';
    badgeVariant = 'team_up';
  } else if (isPropertyHost) {
    badgeText = 'Property Host';
    badgeVariant = 'property_host';
  }

  return {
    activeIntents: intents,
    isLookingForRoom,
    isTeamUpSeeker,
    isLiveInHost,
    isPropertyHost,
    hasValidAvailableRoom,
    associatedListingId: validLiveInListing?.id,
    needsIntentCompletion,
    isDiscoveryEligible,
    discoveryIneligibilityReason,
    displayBadge: {
      text: badgeText,
      variant: badgeVariant,
    },
    rawSources,
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * LEGACY COMPATIBILITY LAYER
 * Preserves backwards compatibility for existing components & tests
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type UserIntentType = 'room_seeker' | 'roommate_seeker' | 'property_host';

export interface UserIntentDetails {
  type: UserIntentType;
  /** Primary intent badge displayed on cards (e.g. 'Looking for a Room', 'Room Available') */
  badgeText: string;
  badgeVariant: 'seeker' | 'room_available' | 'owner';
  /** Primary requirement description (e.g. 'A Room', 'A Roommate') */
  requirementLabel: string;
  requirementValue: string;
  /** Label for roommate/tenant preference column (e.g. 'Preference') */
  preferenceLabel: string;
  /** Financial label distinguishing budget vs rent */
  priceLabel: 'Budget' | 'Rent';
  priceSubtext: string;
  /** Role description (e.g. 'Room Seeker', 'Live-in Host', 'Property Host') */
  roleLabel: string;
}

/**
 * Backwards-compatible legacy intent getter
 */
export function getUserIntent(
  profile?: Partial<UserProfile> | any | null,
  listing?: any | null
): UserIntentDetails {
  if (!profile) {
    return {
      type: 'room_seeker',
      badgeText: 'Looking for a Room',
      badgeVariant: 'seeker',
      requirementLabel: 'Seeking',
      requirementValue: 'A Room',
      preferenceLabel: 'Preference',
      priceLabel: 'Budget',
      priceSubtext: 'max / mo',
      roleLabel: 'Room Seeker',
    };
  }

  const role = (profile.role || 'seeker').toLowerCase();
  const ownerType = ((profile as any).ownerType || '').toLowerCase();
  const hasListing = Boolean(listing || (profile as any)._listing);
  const housingIntent = (profile as any).housingIntent;

  // Case 1: Live-in Host or user offering an existing room (including any profile with an attached listing)
  if (
    hasListing ||
    (role === 'owner' && (ownerType === 'owner_flatmate' || !ownerType)) ||
    housingIntent === 'have_room'
  ) {
    if (role === 'owner' && ownerType === 'landlord' && !listing) {
      // Handled in Case 2
    } else {
      return {
        type: 'roommate_seeker',
        badgeText: 'Room Available',
        badgeVariant: 'room_available',
        requirementLabel: 'Seeking',
        requirementValue: 'A Roommate',
        preferenceLabel: 'Preference',
        priceLabel: 'Rent',
        priceSubtext: 'share / mo',
        roleLabel: 'Live-in Host',
      };
    }
  }

  // Case 2: Absentee Landlord / Property Owner
  if (role === 'owner' && ownerType === 'landlord') {
    return {
      type: 'property_host',
      badgeText: 'Property Host',
      badgeVariant: 'owner',
      requirementLabel: 'Offering',
      requirementValue: 'Room / Property',
      preferenceLabel: 'Preference',
      priceLabel: 'Rent',
      priceSubtext: '/ mo',
      roleLabel: 'Property Host',
    };
  }

  // Case 3: Seeker teaming up
  if (housingIntent === 'team_up') {
    return {
      type: 'room_seeker',
      badgeText: 'Teaming Up for a Room',
      badgeVariant: 'seeker',
      requirementLabel: 'Seeking',
      requirementValue: 'Team-Up Flat',
      preferenceLabel: 'Preference',
      priceLabel: 'Budget',
      priceSubtext: 'max / mo',
      roleLabel: 'Room Seeker',
    };
  }

  // Case 4: Standard Room Seeker (Default)
  return {
    type: 'room_seeker',
    badgeText: 'Looking for a Room',
    badgeVariant: 'seeker',
    requirementLabel: 'Seeking',
    requirementValue: profile.preferredRoomType || 'A Room',
    preferenceLabel: 'Preference',
    priceLabel: 'Budget',
    priceSubtext: 'max / mo',
    roleLabel: 'Room Seeker',
  };
}

/**
 * Resolves the preferred roommate gender truthfully from preferences or quiz answers.
 * NEVER falls back to the user's own gender!
 */
export function getPreferredRoommateGender(
  profile?: Partial<UserProfile> | null,
  listing?: any | null
): { label: string; raw: 'female' | 'male' | 'any' } {
  if (!profile && !listing) {
    return { label: 'Any Gender', raw: 'any' };
  }

  const rawPref =
    listing?.preferredGender ||
    listing?.householdExpectations?.genderPref ||
    profile?.householdExpectations?.genderPref ||
    profile?.quizAnswers?.roommate_gender ||
    profile?.preferences?.genderPref ||
    (profile as any)?.preferredGender;

  if (typeof rawPref === 'string') {
    const normalized = rawPref.trim().toLowerCase();
    if (normalized === 'female' || normalized.includes('female')) {
      return { label: 'Female Only', raw: 'female' };
    }
    if (normalized === 'male' || normalized.includes('male')) {
      return { label: 'Male Only', raw: 'male' };
    }
  }

  return { label: 'Any Gender', raw: 'any' };
}

/**
 * Returns a clean, truthful initials representation for user avatar fallback.
 * Example: 'Mukeshram G' -> 'MG', 'Ram' -> 'R', null -> 'U'
 */
export function getUserInitials(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
