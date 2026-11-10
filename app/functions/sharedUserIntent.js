// Generated from src/lib/userIntent.ts (7991cbac8e4d04d1bf38f716a38496551589df2028536163ba80415568c79973).
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  buildCanonicalPreferencesFromLegacy: () => buildCanonicalPreferencesFromLegacy,
  getPreferredRoommateGender: () => getPreferredRoommateGender,
  getUserInitials: () => getUserInitials,
  getUserIntent: () => getUserIntent,
  normalizeLegacyHousingIntent: () => normalizeLegacyHousingIntent,
  resolveUserHousingIntent: () => resolveUserHousingIntent,
  validateHousingPreferences: () => validateHousingPreferences,
  validateLiveInListingRelationship: () => validateLiveInListingRelationship
});
module.exports = __toCommonJS(stdin_exports);
function validateLiveInListingRelationship(userId, listing) {
  if (!listing) {
    return { isValid: false, reason: "No accommodation listing provided" };
  }
  if (!listing.id || typeof listing.id !== "string") {
    return { isValid: false, reason: "Invalid or missing listing identifier" };
  }
  if (listing.ownerId !== userId) {
    return { isValid: false, reason: "Listing ownerId does not match user UID" };
  }
  if (listing.isDeleted === true) {
    return { isValid: false, reason: "Listing has been deleted" };
  }
  if (listing.status !== "active") {
    return { isValid: false, reason: `Listing status is '${listing.status || "unknown"}', must be 'active'` };
  }
  return { isValid: true };
}
function normalizeLegacyHousingIntent(raw) {
  if (raw === null || raw === void 0 || raw === "") {
    return { intents: [], isAmbiguous: false, originalValue: raw };
  }
  if (Array.isArray(raw)) {
    const valid = raw.filter(
      (i) => i === "find_room" || i === "team_up" || i === "have_room"
    );
    const unique = Array.from(new Set(valid));
    return { intents: unique, isAmbiguous: unique.length === 0 && raw.length > 0, originalValue: raw };
  }
  const str = String(raw).trim().toLowerCase();
  switch (str) {
    case "find_room":
    case "looking for a room":
    case "room_seeker":
    case "seeker":
      return { intents: ["find_room"], isAmbiguous: false, originalValue: raw };
    case "team_up":
    case "team-up & rent together":
    case "teaming up":
    case "team-up":
      return { intents: ["team_up"], isAmbiguous: false, originalValue: raw };
    case "have_room":
    case "roommate_for_my_room":
    case "room available":
    case "live-in host":
    case "owner_flatmate":
      return { intents: ["have_room"], isAmbiguous: false, originalValue: raw };
    case "room_and_roommate":
      return { intents: ["find_room", "team_up"], isAmbiguous: false, originalValue: raw };
    case "offering & seeking":
      return { intents: ["find_room", "have_room"], isAmbiguous: false, originalValue: raw };
    default:
      return { intents: [], isAmbiguous: true, originalValue: raw };
  }
}
function validateHousingPreferences(prefs) {
  const errors = [];
  if (!prefs || typeof prefs !== "object") {
    return { isValid: false, errors: ["Housing preferences must be a non-null object"] };
  }
  if (prefs.activeIntents !== void 0) {
    if (!Array.isArray(prefs.activeIntents)) {
      errors.push("activeIntents must be an array");
    } else {
      const allowed = ["find_room", "team_up", "have_room"];
      for (const intent of prefs.activeIntents) {
        if (!allowed.includes(intent)) {
          errors.push(`Invalid housing intent: "${intent}". Allowed: ${allowed.join(", ")}`);
        }
      }
    }
  }
  if (prefs.budgetMin !== void 0 && prefs.budgetMin !== null) {
    if (typeof prefs.budgetMin !== "number" || isNaN(prefs.budgetMin) || prefs.budgetMin < 0) {
      errors.push("budgetMin must be a non-negative number");
    }
  }
  if (prefs.budgetMax !== void 0 && prefs.budgetMax !== null) {
    if (typeof prefs.budgetMax !== "number" || isNaN(prefs.budgetMax) || prefs.budgetMax < 0) {
      errors.push("budgetMax must be a non-negative number");
    }
  }
  if (typeof prefs.budgetMin === "number" && typeof prefs.budgetMax === "number" && prefs.budgetMin > prefs.budgetMax) {
    errors.push(`budgetMin (${prefs.budgetMin}) cannot be greater than budgetMax (${prefs.budgetMax})`);
  }
  if (prefs.preferredCities !== void 0 && prefs.preferredCities !== null) {
    if (!Array.isArray(prefs.preferredCities)) {
      errors.push("preferredCities must be an array of strings");
    } else if (prefs.preferredCities.some((c) => typeof c !== "string" || c.trim() === "")) {
      errors.push("preferredCities cannot contain empty or non-string values");
    }
  }
  if (prefs.preferredLocalities !== void 0 && prefs.preferredLocalities !== null) {
    if (!Array.isArray(prefs.preferredLocalities)) {
      errors.push("preferredLocalities must be an array of strings");
    } else if (prefs.preferredLocalities.some((l) => typeof l !== "string" || l.trim() === "")) {
      errors.push("preferredLocalities cannot contain empty or non-string values");
    }
  }
  return {
    isValid: errors.length === 0,
    errors
  };
}
function buildCanonicalPreferencesFromLegacy(profile) {
  const norm = normalizeLegacyHousingIntent(profile?.housingIntent || profile?.roommateSeekingType);
  const budget = Number(profile?.budget || 0);
  const localities = Array.isArray(profile?.localities) ? profile.localities.filter(Boolean) : profile?.locality ? [profile.locality] : [];
  const cities = profile?.city ? [profile.city] : [];
  return {
    activeIntents: norm.intents,
    preferredCities: cities,
    preferredLocalities: localities,
    budgetMin: budget > 0 ? Math.round(budget * 0.8) : void 0,
    budgetMax: budget > 0 ? Math.round(budget * 1.2) : void 0,
    moveInDate: profile?.moveInDate || profile?.availableFrom || void 0,
    isActivelySearching: profile?.status === "active" && profile?.onboardingComplete === true
  };
}
function resolveUserHousingIntent(user, userListings) {
  const rawSources = {
    declaredIntents: user?.housingPreferences?.activeIntents,
    legacyIntent: user?.housingIntent,
    legacyRole: user?.role,
    legacyOwnerType: user?.ownerType,
    status: user?.status
  };
  if (!user || !user.uid && !user.id) {
    return {
      activeIntents: [],
      isLookingForRoom: false,
      isTeamUpSeeker: false,
      isLiveInHost: false,
      isPropertyHost: false,
      hasValidAvailableRoom: false,
      needsIntentCompletion: true,
      isDiscoveryEligible: false,
      discoveryIneligibilityReason: "no_active_intent",
      displayBadge: { text: "Intent Needed", variant: "unknown" },
      rawSources
    };
  }
  const uid = user.uid || user.id || "";
  const status = (user.status || "active").toLowerCase();
  const role = (user.role || "").toLowerCase();
  const ownerType = (user.ownerType || "").toLowerCase();
  if (status === "banned") {
    return {
      activeIntents: [],
      isLookingForRoom: false,
      isTeamUpSeeker: false,
      isLiveInHost: false,
      isPropertyHost: false,
      hasValidAvailableRoom: false,
      needsIntentCompletion: false,
      isDiscoveryEligible: false,
      discoveryIneligibilityReason: "banned",
      displayBadge: { text: "Account Banned", variant: "unknown" },
      rawSources
    };
  }
  if (status === "suspended") {
    return {
      activeIntents: [],
      isLookingForRoom: false,
      isTeamUpSeeker: false,
      isLiveInHost: false,
      isPropertyHost: false,
      hasValidAvailableRoom: false,
      needsIntentCompletion: false,
      isDiscoveryEligible: false,
      discoveryIneligibilityReason: "suspended",
      displayBadge: { text: "Account Suspended", variant: "unknown" },
      rawSources
    };
  }
  if (role === "admin") {
    return {
      activeIntents: [],
      isLookingForRoom: false,
      isTeamUpSeeker: false,
      isLiveInHost: false,
      isPropertyHost: false,
      hasValidAvailableRoom: false,
      needsIntentCompletion: false,
      isDiscoveryEligible: false,
      discoveryIneligibilityReason: "admin",
      displayBadge: { text: "Administrator", variant: "unknown" },
      rawSources
    };
  }
  let intents = [];
  let isFromCanonical = false;
  if (user.housingPreferences && Array.isArray(user.housingPreferences.activeIntents) && user.housingPreferences.activeIntents.length > 0) {
    const valid = user.housingPreferences.activeIntents.filter(
      (i) => i === "find_room" || i === "team_up" || i === "have_room"
    );
    intents = Array.from(new Set(valid));
    isFromCanonical = true;
  }
  if (intents.length === 0) {
    const rawIntentStr = typeof user.housingIntent === "string" && user.housingIntent.trim().length > 0 ? user.housingIntent.trim() : void 0;
    const rawSeekingType = typeof user.roommateSeekingType === "string" && user.roommateSeekingType.trim().length > 0 ? user.roommateSeekingType.trim() : void 0;
    const hasRoomBool = typeof user.hasRoom === "boolean" ? user.hasRoom : void 0;
    const intentNorm = rawIntentStr ? normalizeLegacyHousingIntent(rawIntentStr) : null;
    const seekingNorm = rawSeekingType ? normalizeLegacyHousingIntent(rawSeekingType) : null;
    const hasRoomIntents = hasRoomBool === true ? ["have_room"] : [];
    const claimsFindRoom = intentNorm && intentNorm.intents.includes("find_room") || seekingNorm && seekingNorm.intents.includes("find_room");
    const claimsHaveRoom2 = hasRoomBool === true || intentNorm && intentNorm.intents.includes("have_room") || seekingNorm && seekingNorm.intents.includes("have_room");
    const isExplicitCompound = rawIntentStr === "room_and_roommate" || rawIntentStr === "offering & seeking";
    const isConflicting = !isExplicitCompound && claimsFindRoom && claimsHaveRoom2 && (rawIntentStr === "find_room" && (hasRoomBool === true || rawSeekingType === "roommate_for_my_room") || rawIntentStr === "have_room" && (hasRoomBool === false || rawSeekingType === "find_room"));
    if (isConflicting) {
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
  const listingsArray = Array.isArray(userListings) ? userListings : userListings ? [userListings] : [];
  const validCandidateListings = listingsArray.filter(
    (listing) => validateLiveInListingRelationship(uid, listing).isValid
  );
  let validLiveInListing = void 0;
  let isListingAssociationAmbiguous = false;
  const explicitId = user.housingPreferences?.associatedListingId || user.associatedListingId;
  if (explicitId) {
    const matchedExplicit = validCandidateListings.find((l) => l.id === explicitId);
    if (matchedExplicit) {
      if (matchedExplicit.isLiveInRoom === true && ownerType !== "landlord") {
        validLiveInListing = matchedExplicit;
      } else {
        validLiveInListing = void 0;
      }
    } else {
      validLiveInListing = void 0;
    }
  } else if (validCandidateListings.length > 1) {
    isListingAssociationAmbiguous = true;
    validLiveInListing = void 0;
  } else if (validCandidateListings.length === 1 && validCandidateListings[0].isLiveInRoom === true && ownerType !== "landlord") {
    validLiveInListing = validCandidateListings[0];
  } else {
    validLiveInListing = void 0;
  }
  const hasValidAvailableRoom = Boolean(validLiveInListing);
  const claimsHaveRoom = intents.includes("have_room") || ownerType === "owner_flatmate";
  const isLiveInHost = claimsHaveRoom && hasValidAvailableRoom && ownerType !== "landlord";
  const isPropertyHost = role === "owner" && (ownerType === "landlord" || !isLiveInHost && !claimsHaveRoom);
  const isLookingForRoom = intents.includes("find_room");
  const isTeamUpSeeker = intents.includes("team_up");
  const needsIntentCompletion = !isPropertyHost && intents.length === 0;
  const isActivelySearching = user.housingPreferences?.isActivelySearching !== false && user.isActivelySearching !== false && user.roommateDiscoveryEnabled !== false;
  let isDiscoveryEligible = false;
  let discoveryIneligibilityReason = void 0;
  if (status === "banned") {
    discoveryIneligibilityReason = "banned";
  } else if (status === "suspended") {
    discoveryIneligibilityReason = "suspended";
  } else if (role === "admin" || user.isAdmin === true) {
    discoveryIneligibilityReason = "admin";
  } else if (!isActivelySearching) {
    discoveryIneligibilityReason = "inactive_search";
  } else if (isPropertyHost && !isTeamUpSeeker) {
    discoveryIneligibilityReason = "commercial_landlord_only";
  } else if (isTeamUpSeeker) {
    isDiscoveryEligible = true;
  } else if (isLiveInHost) {
    isDiscoveryEligible = true;
  } else if (isListingAssociationAmbiguous) {
    discoveryIneligibilityReason = "have_room_ambiguous_listings";
  } else if (claimsHaveRoom && !hasValidAvailableRoom) {
    discoveryIneligibilityReason = "have_room_unverified_listing";
  } else if (isLookingForRoom) {
    discoveryIneligibilityReason = "find_room_only";
  } else {
    discoveryIneligibilityReason = "no_active_intent";
  }
  let badgeText = "Intent Needed";
  let badgeVariant = "unknown";
  if (isLiveInHost) {
    badgeText = "Room Available";
    badgeVariant = "live_in_host";
  } else if (isTeamUpSeeker && isLookingForRoom) {
    badgeText = "Seeking Room & Team-Up";
    badgeVariant = "team_up";
  } else if (isLookingForRoom && isPropertyHost) {
    badgeText = "Offering & Seeking";
    badgeVariant = "seeker";
  } else if (isLookingForRoom) {
    badgeText = "Looking for a room";
    badgeVariant = "seeker";
  } else if (isTeamUpSeeker) {
    badgeText = "Teaming Up for a Room";
    badgeVariant = "team_up";
  } else if (isPropertyHost) {
    badgeText = "Property Host";
    badgeVariant = "property_host";
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
      variant: badgeVariant
    },
    rawSources
  };
}
function getUserIntent(profile, listing) {
  if (!profile) {
    return {
      type: "room_seeker",
      badgeText: "Looking for a Room",
      badgeVariant: "seeker",
      requirementLabel: "Seeking",
      requirementValue: "A Room",
      preferenceLabel: "Preference",
      priceLabel: "Budget",
      priceSubtext: "max / mo",
      roleLabel: "Room Seeker"
    };
  }
  const role = (profile.role || "seeker").toLowerCase();
  const ownerType = (profile.ownerType || "").toLowerCase();
  const hasListing = Boolean(listing || profile._listing);
  const housingIntent = profile.housingIntent;
  if (hasListing || role === "owner" && (ownerType === "owner_flatmate" || !ownerType) || housingIntent === "have_room") {
    if (role === "owner" && ownerType === "landlord" && !listing) {
    } else {
      return {
        type: "roommate_seeker",
        badgeText: "Room Available",
        badgeVariant: "room_available",
        requirementLabel: "Seeking",
        requirementValue: "A Roommate",
        preferenceLabel: "Preference",
        priceLabel: "Rent",
        priceSubtext: "share / mo",
        roleLabel: "Live-in Host"
      };
    }
  }
  if (role === "owner" && ownerType === "landlord") {
    return {
      type: "property_host",
      badgeText: "Property Host",
      badgeVariant: "owner",
      requirementLabel: "Offering",
      requirementValue: "Room / Property",
      preferenceLabel: "Preference",
      priceLabel: "Rent",
      priceSubtext: "/ mo",
      roleLabel: "Property Host"
    };
  }
  if (housingIntent === "team_up") {
    return {
      type: "room_seeker",
      badgeText: "Teaming Up for a Room",
      badgeVariant: "seeker",
      requirementLabel: "Seeking",
      requirementValue: "Team-Up Flat",
      preferenceLabel: "Preference",
      priceLabel: "Budget",
      priceSubtext: "max / mo",
      roleLabel: "Room Seeker"
    };
  }
  return {
    type: "room_seeker",
    badgeText: "Looking for a Room",
    badgeVariant: "seeker",
    requirementLabel: "Seeking",
    requirementValue: profile.preferredRoomType || "A Room",
    preferenceLabel: "Preference",
    priceLabel: "Budget",
    priceSubtext: "max / mo",
    roleLabel: "Room Seeker"
  };
}
function getPreferredRoommateGender(profile, listing) {
  if (!profile && !listing) {
    return { label: "Any Gender", raw: "any" };
  }
  const rawPref = listing?.preferredGender || listing?.householdExpectations?.genderPref || profile?.householdExpectations?.genderPref || profile?.quizAnswers?.roommate_gender || profile?.preferences?.genderPref || profile?.preferredGender;
  if (typeof rawPref === "string") {
    const normalized = rawPref.trim().toLowerCase();
    if (normalized === "female" || normalized.includes("female")) {
      return { label: "Female Only", raw: "female" };
    }
    if (normalized === "male" || normalized.includes("male")) {
      return { label: "Male Only", raw: "male" };
    }
  }
  return { label: "Any Gender", raw: "any" };
}
function getUserInitials(name) {
  if (!name || typeof name !== "string") return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
