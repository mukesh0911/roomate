/**
 * Pure matching helpers — safe to unit test without Firebase.
 */

/**
 * Calculate dynamic compatibility score between two quiz answer maps.
 * Returns integer percentage (0-100%).
 */
export function calculateCompatibility(
  answersA: Record<string, string> = {},
  answersB: Record<string, string> = {},
  cityA?: string,
  cityB?: string
): number {
  const keysA = Object.keys(answersA || {});
  const keysB = Object.keys(answersB || {});

  // Quiz answer IDs are opaque string tokens (e.g. 'before_10', '10_to_12', 'veg', 'wfh').
  // They must ONLY be compared by exact string equality — never parsed as numbers.
  // parseInt('10_to_12') === 10 and parseInt('6_to_8') === 6, which gives a
  // false numeric diff score and completely wrong compatibility results.
  let score = 0;
  const commonKeys = keysA.filter(k => keysB.includes(k));

  if (commonKeys.length > 0) {
    // Score = fraction of shared questions where both users gave the exact same answer
    const matches = commonKeys.filter(k => answersA[k] === answersB[k]).length;
    score = Math.round((matches / commonKeys.length) * 100);
  }
  // If there are no common keys (one or both have no answers), score stays 0 — honest.

  // City Mismatch Adjustment:
  // If both cities are specified and they do NOT match (e.g. Chennai vs Hyderabad),
  // cap cross-city compatibility at 60% so users in Chennai are never misled by a 100% score for a Hyderabad profile.
  if (cityA && cityB) {
    const normA = cityA.toLowerCase().trim();
    const normB = cityB.toLowerCase().trim();
    if (normA && normB && normA !== normB) {
      score = Math.min(60, Math.round(score * 0.6));
    }
  }

  return score;
}

/**
 * Truthful match explanation (Sprint 2C).
 *
 * Returns ONLY reasons supported by real data — never fabricated.
 * Used by the compatibility breakdown UI so users can see WHY a
 * candidate is a good match instead of a bare percentage.
 */
export interface MatchReasons {
  score: number;
  reasons: string[]; // positive, data-backed reasons
  caveats: string[]; // honest limitations (missing data etc.)
}

export function getMatchReasons(
  myAnswers: Record<string, string> = {},
  theirAnswers: Record<string, string> = {},
  opts: {
    myCity?: string;
    theirCity?: string;
    myBudget?: number;
    theirBudget?: number;
    sharedAnswerCount?: number;
  } = {}
): MatchReasons {
  const score = calculateCompatibility(
    myAnswers,
    theirAnswers,
    opts.myCity,
    opts.theirCity
  );
  const reasons: string[] = [];
  const caveats: string[] = [];

  // Location — only when both cities are known and equal
  if (opts.myCity && opts.theirCity) {
    if (
      opts.myCity.toLowerCase().trim() === opts.theirCity.toLowerCase().trim()
    ) {
      reasons.push(`Same city (${opts.myCity})`);
    } else {
      caveats.push("Different cities");
    }
  } else {
    caveats.push("Location not fully specified");
  }

  // Budget overlap — only when both budgets are known and positive
  const myB = opts.myBudget || 0;
  const theirB = opts.theirBudget || 0;
  if (myB > 0 && theirB > 0) {
    const gapPct = Math.abs(myB - theirB) / Math.max(myB, theirB);
    if (gapPct <= 0.2) reasons.push("Budgets are close");
    else caveats.push("Budgets differ significantly");
  } else {
    caveats.push("Budget not fully specified");
  }

  // Lifestyle — count genuinely shared answers (exact string equality only)
  const commonKeys = Object.keys(myAnswers).filter(
    k => k in (theirAnswers || {})
  );
  if (commonKeys.length > 0) {
    const shared = commonKeys.filter(
      k => myAnswers[k] === theirAnswers[k]
    ).length;
    if (shared > 0)
      reasons.push(
        `${shared} lifestyle preference${shared === 1 ? "" : "s"} in common`
      );
    if (commonKeys.length < 5)
      caveats.push("Few overlapping quiz answers — score is low-confidence");
  } else {
    caveats.push("No overlapping quiz answers yet");
  }

  return { score, reasons, caveats };
}

/**
 * Seeker signal required for room matching.
 */
export interface SeekerMatchSignal {
  uid?: string;
  name?: string | null;
  gender?: string | null;
  city?: string | null;
  localities?: string[];
  locality?: string | null;
  budget?: number | null;
  quizAnswers?: Record<string, string>;
  isVerified?: boolean;
  workEmailVerified?: boolean;
  onboardingComplete?: boolean;
}

/**
 * Listing intent required for room matching.
 */
export interface ListingMatchSignal {
  id?: string;
  title?: string;
  city?: string;
  locality?: string;
  monthlyRent?: number;
  partnerShare?: number;
  totalRent?: number;
  deposit?: number;
  genderPreference?: string;
  houseRules?: string[];
  amenities?: string[];
  ownerQuizAnswers?: Record<string, string>;
}

/**
 * Optional owner context for room matching.
 */
export interface OwnerMatchSignal {
  uid?: string;
  role?: string | null;
  ownerType?: "owner_flatmate" | "landlord" | string | null;
  city?: string | null;
  isVerified?: boolean;
  workEmailVerified?: boolean;
  quizAnswers?: Record<string, string>;
  householdExpectations?: {
    genderPref?: string;
    dietPref?: string;
    smokingPolicy?: string;
    petPolicy?: string;
  };
}

export interface RoomMatchBreakdown {
  score: number;
  budgetScore: number;
  locationScore: number;
  genderScore: number;
  rulesScore: number;
  trustScore: number;
  reasons: string[];
  caveats: string[];
}

/**
 * Multi-Factor Room Compatibility Engine (0–100%).
 *
 * Outperforms single-dimensional quiz comparison by evaluating:
 * 1. Budget Fit (25%)
 * 2. Location & Locality Fit (20%)
 * 3. Gender Requirement Fit (20%)
 * 4. House Rules & Habits Alignment (20%)
 * 5. Trust & Verification Signals (15%)
 */
const norm = (v: unknown): string =>
  typeof v === "string" ? v.trim().toLowerCase() : "";
const positive = (v: unknown): number =>
  Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0;
function areas(p: any): string[] {
  const values = p.localities || p.housingPreferences?.preferredLocalities;
  return [
    ...new Set(
      [...(Array.isArray(values) ? values : []), p.locality]
        .map(norm)
        .filter(Boolean)
    ),
  ];
}
function roomTypes(p: any): string[] {
  const values = p.preferredRoomTypes || (p.roomType ? [p.roomType] : []);
  return (Array.isArray(values) ? values : []).map(norm).filter(Boolean);
}
function occupancy(p: any): string {
  return norm(p.occupancyPreference || p.preferredOccupancy || p.occupancy);
}
function actualQuiz(p: any): Record<string, string> {
  const q = p.quizAnswers || {},
    result: Record<string, string> = {};
  const aliases: Record<string, string> = {
    diet: "food_pref",
    smoke: "smoking",
    sleep: "sleep_time",
    clean: "cleanliness",
  };
  const values: Record<string, string> = {
    vegetarian: "veg",
    "non-vegetarian": "non_veg",
    "non-smoker": "never",
    "very tidy": "very",
    "night owl": "after_12",
    "early riser": "before_10",
  };
  // The active profile editor writes these aliases; prefer the same values
  // as the displayed profile when a legacy canonical answer remains.
  for (const [key, value] of Object.entries(q).sort(
    ([a], [b]) => Number(a in aliases) - Number(b in aliases)
  )) {
    const v = norm(value);
    if (v) result[aliases[key] || key] = values[v] || v;
  }
  return result;
}
export function getRoomMatchReasons(
  seeker: SeekerMatchSignal = {},
  listing: ListingMatchSignal = {},
  owner: OwnerMatchSignal = {}
): RoomMatchBreakdown {
  const reasons: string[] = [],
    caveats: string[] = [];
  const a: any = seeker,
    b: any = listing;
  const rent =
      positive(b.partnerShare) ||
      positive(b.monthlyRent) ||
      positive(b.totalRent),
    budget = positive(a.budget || a.housingPreferences?.budgetMax);
  let budgetScore = 0,
    locationScore = 0,
    genderScore = 0,
    rulesScore = 0,
    preferenceScore = 0;
  if (budget && rent) {
    budgetScore =
      budget >= rent
        ? 25
        : budget >= rent * 0.85
          ? 20
          : budget >= rent * 0.75
            ? 12
            : 0;
    if (budget >= rent) reasons.push("Budget fits");
    else caveats.push("Budget below rent");
  } else caveats.push("Budget not fully specified");
  const ac = norm(a.city),
    bc = norm(b.city || owner.city),
    loc = norm(b.locality);
  if (ac && bc) {
    if (ac === bc) {
      locationScore = 14;
      reasons.push("Same city");
      if (loc && areas(a).includes(loc)) {
        locationScore = 20;
        reasons.push("Same locality");
      }
    } else caveats.push("Different cities");
  } else caveats.push("Location not fully specified");
  const gender = norm(
      b.preferredGender ||
        b.genderPreference ||
        owner.householdExpectations?.genderPref
    ),
    mine = norm(a.gender);
  const required = gender.includes("female")
    ? "female"
    : gender.includes("male")
      ? "male"
      : "";
  const genderMismatch = !!required && !!mine && mine !== required;
  if (required && mine) {
    genderScore = genderMismatch ? 0 : 20;
    if (genderMismatch) caveats.push("Listing gender requirement differs");
    else reasons.push("Matches listing gender requirement");
  } else if (["any", "co-ed", "coed"].includes(gender)) {
    genderScore = 20;
    reasons.push("Listing welcomes any gender");
  } else caveats.push("Gender requirement not fully specified");
  const rules = (b.houseRules || []).map(norm),
    exp = owner.householdExpectations || {},
    q = actualQuiz(a);
  const veg =
    rules.some(
      (r: string) =>
        r.includes("veg") && !r.includes("non-veg") && !r.includes("allowed")
    ) || exp.dietPref === "veg";
  const smoke =
    rules.some(
      (r: string) => r.includes("no smoking") || r.includes("smoke-free")
    ) || exp.smokingPolicy === "no_smoking";
  const pets =
    rules.some((r: string) => r.includes("no pets")) ||
    exp.petPolicy === "no_pets";
  if (veg && q.food_pref) {
    if (["veg", "vegan"].includes(q.food_pref)) {
      rulesScore += 5;
      reasons.push("Vegetarian matches veg kitchen rule");
    } else caveats.push("Diet conflicts with veg-only kitchen");
  }
  if (smoke && q.smoking) {
    if (q.smoking === "never") {
      rulesScore += 5;
      reasons.push("Non-smoker matches smoke-free home");
    } else caveats.push("Smoking habit conflicts with smoke-free home rule");
  }
  if (pets && q.pets) {
    if (["no", "allergic"].includes(q.pets)) {
      rulesScore += 5;
      reasons.push("No pets matches building policy");
    } else caveats.push("Pet preference conflicts with no-pets rule");
  }
  const host = actualQuiz({
      quizAnswers: b.ownerQuizAnswers || owner.quizAnswers || {},
    }),
    keys = Object.keys(q).filter(k => host[k]);
  if (keys.length) {
    const same = keys.filter(k => host[k] === q[k]).length;
    rulesScore +=
      (5 * same) /
      Math.max(5, new Set([...Object.keys(q), ...Object.keys(host)]).size);
    if (same) reasons.push("Shared lifestyle preferences with host");
  }
  if (!rules.length && !Object.keys(host).length)
    caveats.push("Household preferences not provided");
  const types = roomTypes(a),
    type = norm(b.roomType);
  if (types.length && type) {
    if (types.includes(type)) {
      preferenceScore += 8;
      reasons.push("Preferred room type");
    } else caveats.push("Room type differs");
  } else caveats.push("Room preference not fully specified");
  if (occupancy(a) && occupancy(b)) {
    if (occupancy(a) === occupancy(b)) preferenceScore += 7;
    else caveats.push("Occupancy preference differs");
  } else caveats.push("Occupancy preference not fully specified");
  let score =
    budgetScore + locationScore + genderScore + rulesScore + preferenceScore;
  if (genderMismatch) score = Math.min(40, score);
  if (ac && bc && ac !== bc) score = Math.min(60, score * 0.6);
  if (
    a.onboardingComplete === false ||
    !(
      budget ||
      ac ||
      mine ||
      Object.keys(q).length ||
      types.length ||
      occupancy(a)
    )
  ) {
    score = 0;
    caveats.push("Complete your profile for a match");
  }
  return {
    score: Math.round(score),
    budgetScore,
    locationScore,
    genderScore,
    rulesScore,
    trustScore: 0,
    reasons,
    caveats,
  };
}

/**
 * Synthesize comparable quiz tokens from a profile's quizAnswers,
 * householdExpectations, and listing houseRules.
 */
export function synthesizeQuizFromProfile(
  profile: any,
  listing?: any
): Record<string, string> {
  const result: Record<string, string> = { ...(profile?.quizAnswers || {}) };

  // 1. Household expectations from owner or seeker
  if (profile?.householdExpectations) {
    const exp = profile.householdExpectations;
    if (!result.smoking && exp.smokingPolicy) {
      result.smoking =
        exp.smokingPolicy === "no_smoking" ? "never" : "occasionally";
    }
    if (!result.pets && exp.petPolicy) {
      result.pets = exp.petPolicy === "no_pets" ? "no" : "love";
    }
    if (!result.food_pref && exp.dietPref) {
      result.food_pref = exp.dietPref === "veg" ? "veg" : "non_veg";
    }
    if (!result.roommate_gender && exp.genderPref) {
      result.roommate_gender = exp.genderPref;
    }
  }

  // 2. Listing expectations / rules
  if (listing) {
    if (!result.roommate_gender && listing.genderPreference) {
      const gp = listing.genderPreference.toLowerCase();
      result.roommate_gender = gp.includes("female")
        ? "female"
        : gp.includes("male")
          ? "male"
          : "any";
    }
    if (listing.houseRules && Array.isArray(listing.houseRules)) {
      const rules = listing.houseRules.map((r: string) =>
        (r || "").toLowerCase()
      );
      if (
        !result.cleanliness &&
        rules.some((r: string) => r.includes("clean"))
      ) {
        result.cleanliness = "very";
      }
      if (
        !result.smoking &&
        rules.some(
          (r: string) => r.includes("no smoking") || r.includes("smoke-free")
        )
      ) {
        result.smoking = "never";
      }
      if (!result.pets && rules.some((r: string) => r.includes("no pets"))) {
        result.pets = "no";
      }
      if (
        !result.food_pref &&
        rules.some((r: string) => r.includes("veg") && !r.includes("non-veg"))
      ) {
        result.food_pref = "veg";
      }
      if (
        !result.guests &&
        rules.some(
          (r: string) => r.includes("no parties") || r.includes("no guests")
        )
      ) {
        result.guests = "rarely";
      }
    }
    if (
      listing.ownerQuizAnswers &&
      typeof listing.ownerQuizAnswers === "object"
    ) {
      Object.assign(result, listing.ownerQuizAnswers);
    }
  }

  return result;
}

export interface ProfileMatchResult {
  score: number;
  reasons: string[];
  caveats: string[];
}

/**
 * Universal profile compatibility calculator:
 * - Computes multi-factor room compatibility if one party has an active room listing.
 * - Computes synthesized quiz and preference compatibility for flatmate pairs.
 */
export function calculateProfileCompatibility(
  userA: any,
  userB: any,
  listing?: any
): ProfileMatchResult {
  if (!userA || !userB) {
    return {
      score: 0,
      reasons: [],
      caveats: ["Profile information unavailable"],
    };
  }

  const roleA = (userA.role || "").toLowerCase();
  const roleB = (userB.role || "").toLowerCase();

  // Scenario 1: One user is Seeker and the other has a Listing (or listing provided)
  const isSeekerAndOwnerWithListing =
    listing &&
    ((roleA === "seeker" && roleB === "owner") ||
      (roleA === "owner" && roleB === "seeker") ||
      roleB === "owner" ||
      roleA === "owner");

  if (isSeekerAndOwnerWithListing) {
    const seeker = roleA === "owner" ? userB : userA;
    const owner = roleA === "owner" ? userA : userB;
    const breakdown = getRoomMatchReasons(seeker, listing, owner);
    return {
      score: breakdown.score,
      reasons: breakdown.reasons,
      caveats: breakdown.caveats,
    };
  }

  // Symmetric weighted fit. Missing data earns no points. Verification is
  // displayed separately and never inflates lifestyle compatibility.
  const reasons: string[] = [],
    caveats: string[] = [];
  if (userA.onboardingComplete === false || userB.onboardingComplete === false)
    return {
      score: 0,
      reasons,
      caveats: ["Complete profile information needed"],
    };
  let score = 0;
  const ac = norm(userA.city),
    bc = norm(userB.city),
    aa = areas(userA),
    ba = areas(userB);
  if (ac && bc) {
    if (ac === bc) {
      score += 15;
      reasons.push("Same city (" + userA.city + ")");
      if (aa.length && ba.length && aa.some(l => ba.includes(l))) {
        score += 10;
        reasons.push("Preferred localities overlap");
      }
    } else caveats.push("Different cities");
  } else caveats.push("Location not fully specified");
  const ab = positive(userA.budget || userA.housingPreferences?.budgetMax),
    bb = positive(userB.budget || userB.housingPreferences?.budgetMax);
  if (ab && bb) {
    const ratio = Math.min(ab, bb) / Math.max(ab, bb);
    score += 25 * ratio;
    if (ratio >= 0.8) reasons.push("Budgets are close");
    else caveats.push("Budgets differ significantly");
  } else caveats.push("Budget not fully specified");
  const aq = actualQuiz(userA),
    bq = actualQuiz(userB),
    keys = Object.keys(aq).filter(k => bq[k]),
    union = new Set([...Object.keys(aq), ...Object.keys(bq)]);
  if (keys.length) {
    const same = keys.filter(k => aq[k] === bq[k]).length;
    score += (30 * same) / Math.max(5, union.size);
    if (same) reasons.push(same + " lifestyle preferences in common");
    if (keys.length < 5) caveats.push("Few overlapping quiz answers");
  } else caveats.push("No overlapping quiz answers yet");
  const at = roomTypes(userA),
    bt = roomTypes(userB);
  if (at.length && bt.length) {
    if (at.some(t => bt.includes(t))) {
      score += 10;
      reasons.push("Room preferences overlap");
    } else caveats.push("Room preferences differ");
  } else caveats.push("Room preferences not fully specified");
  if (occupancy(userA) && occupancy(userB)) {
    if (occupancy(userA) === occupancy(userB)) score += 10;
    else caveats.push("Occupancy preferences differ");
  } else caveats.push("Occupancy preferences not fully specified");
  if (ac && bc && ac !== bc) score = Math.min(60, score * 0.6);
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons,
    caveats,
  };
}

/**
 * Pure scalar helper for calculating room compatibility score (0-100%).
 */
export function calculateRoomCompatibility(
  seeker: SeekerMatchSignal = {},
  listing: ListingMatchSignal = {},
  owner: OwnerMatchSignal = {}
): number {
  return getRoomMatchReasons(seeker, listing, owner).score;
}

/**
 * Get active status based on lastActiveAt timestamp.
 */
export function getActiveStatus(timestamp: any): {
  status: "online" | "recent" | "offline";
  text: string;
} {
  if (!timestamp) return { status: "offline", text: "Active a while ago" };

  const lastActive = timestamp.toMillis
    ? timestamp.toMillis()
    : timestamp instanceof Date
      ? timestamp.getTime()
      : timestamp;
  const now = Date.now();
  const diffMs = now - lastActive;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 15) {
    return { status: "online", text: "Active now" };
  } else if (diffHours < 24) {
    return { status: "recent", text: `Active ${diffHours || 1}h ago` };
  } else {
    return { status: "offline", text: `Active ${diffDays} days ago` };
  }
}
