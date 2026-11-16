// Generated from src/lib/matching.ts (d3ce7b7658fbbaf8a12e7a75ecfcb3aecb14b55b9d0a8411f4f3ff6ff7ad0914).
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
  COMPATIBILITY_ENGINE_VERSION: () => COMPATIBILITY_ENGINE_VERSION,
  calculateCanonicalRoomCompatibility: () => calculateCanonicalRoomCompatibility,
  calculateCompatibility: () => calculateCompatibility,
  calculateProfileCompatibility: () => calculateProfileCompatibility,
  calculateRoomCompatibility: () => calculateRoomCompatibility,
  canonicalSeekerFingerprint: () => canonicalSeekerFingerprint,
  getActiveStatus: () => getActiveStatus,
  getMatchReasons: () => getMatchReasons,
  getRoomMatchReasons: () => getRoomMatchReasons,
  hasActiveSeekerIntent: () => hasActiveSeekerIntent,
  isHostOnlyWithoutSeekerPrefs: () => isHostOnlyWithoutSeekerPrefs,
  isUserMatchingCalibrated: () => isUserMatchingCalibrated,
  resolveCanonicalRoomCompatibility: () => resolveCanonicalRoomCompatibility,
  resolveSeekerBudget: () => resolveSeekerBudget,
  resolveSeekerCity: () => resolveSeekerCity,
  resolveSeekerLocalities: () => resolveSeekerLocalities,
  synthesizeQuizFromProfile: () => synthesizeQuizFromProfile
});
module.exports = __toCommonJS(stdin_exports);
function calculateCompatibility(answersA = {}, answersB = {}, cityA, cityB) {
  const keysA = Object.keys(answersA || {});
  const keysB = Object.keys(answersB || {});
  let score = 0;
  const commonKeys = keysA.filter((k) => keysB.includes(k));
  if (commonKeys.length > 0) {
    const matches = commonKeys.filter((k) => answersA[k] === answersB[k]).length;
    score = Math.round(matches / commonKeys.length * 100);
  }
  if (cityA && cityB) {
    const normA = cityA.toLowerCase().trim();
    const normB = cityB.toLowerCase().trim();
    if (normA && normB && normA !== normB) {
      score = Math.min(60, Math.round(score * 0.6));
    }
  }
  return score;
}
function getMatchReasons(myAnswers = {}, theirAnswers = {}, opts = {}) {
  const score = calculateCompatibility(
    myAnswers,
    theirAnswers,
    opts.myCity,
    opts.theirCity
  );
  const reasons = [];
  const caveats = [];
  if (opts.myCity && opts.theirCity) {
    if (opts.myCity.toLowerCase().trim() === opts.theirCity.toLowerCase().trim()) {
      reasons.push(`Same city (${opts.myCity})`);
    } else {
      caveats.push("Different cities");
    }
  } else {
    caveats.push("Location not fully specified");
  }
  const myB = opts.myBudget || 0;
  const theirB = opts.theirBudget || 0;
  if (myB > 0 && theirB > 0) {
    const gapPct = Math.abs(myB - theirB) / Math.max(myB, theirB);
    if (gapPct <= 0.2) reasons.push("Budgets are close");
    else caveats.push("Budgets differ significantly");
  } else {
    caveats.push("Budget not fully specified");
  }
  const commonKeys = Object.keys(myAnswers).filter(
    (k) => k in (theirAnswers || {})
  );
  if (commonKeys.length > 0) {
    const shared = commonKeys.filter(
      (k) => myAnswers[k] === theirAnswers[k]
    ).length;
    if (shared > 0)
      reasons.push(
        `${shared} lifestyle preference${shared === 1 ? "" : "s"} in common`
      );
    if (commonKeys.length < 5)
      caveats.push("Few overlapping quiz answers \u2014 score is low-confidence");
  } else {
    caveats.push("No overlapping quiz answers yet");
  }
  return { score, reasons, caveats };
}
const COMPATIBILITY_ENGINE_VERSION = "canonical-v2";
const norm = (v) => typeof v === "string" ? v.trim().toLowerCase() : "";
const positive = (v) => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0;
function resolveSeekerBudget(user = {}) {
  const u = user || {};
  return positive(
    u.housingPreferences?.budgetMax || u.budgetMax || u.budget || u.housingPreferences?.budgetMin || u.budgetMin
  );
}
function resolveSeekerCity(user = {}) {
  const u = user || {};
  const preferredCities = u.housingPreferences?.preferredCities;
  if (Array.isArray(preferredCities) && preferredCities.length > 0) {
    const firstCity = preferredCities.find((c) => typeof c === "string" && c.trim().length > 0);
    if (firstCity) return firstCity.trim();
  }
  if (typeof u.city === "string" && u.city.trim().length > 0) {
    return u.city.trim();
  }
  return "";
}
function resolveSeekerLocalities(user = {}) {
  const u = user || {};
  const values = u.housingPreferences?.preferredLocalities || u.localities;
  const rawList = Array.isArray(values) ? values : u.locality ? [u.locality] : [];
  return [
    ...new Set(
      rawList.filter((loc) => typeof loc === "string").map((loc) => loc.trim()).filter((loc) => loc.length > 0)
    )
  ];
}
function hasActiveSeekerIntent(user = {}, myRooms = []) {
  const u = user || {};
  const activeIntents = u.housingPreferences?.activeIntents;
  if (Array.isArray(activeIntents) && activeIntents.length > 0) {
    return activeIntents.includes("find_room") || activeIntents.includes("team_up");
  }
  if (u.housingIntent === "find_room" || u.housingIntent === "team_up") {
    return true;
  }
  if (u.housingIntent === "have_room") {
    return false;
  }
  if (u.isLandlord === true || Array.isArray(myRooms) && myRooms.length > 0) {
    return false;
  }
  return true;
}
function isHostOnlyWithoutSeekerPrefs(user = {}, myRooms = []) {
  const u = user || {};
  const isHostLike = u.isLandlord === true || Array.isArray(myRooms) && myRooms.length > 0 || u.housingIntent === "have_room" || Array.isArray(u.housingPreferences?.activeIntents) && u.housingPreferences.activeIntents.includes("have_room");
  if (!isHostLike) return false;
  const isSeekerCalibrated = resolveSeekerBudget(u) > 0 && resolveSeekerLocalities(u).length > 0;
  return !isSeekerCalibrated;
}
function isUserMatchingCalibrated(user = {}, myRooms = []) {
  if (!user) return false;
  if (user.onboardingComplete === false) return false;
  if (!hasActiveSeekerIntent(user, myRooms)) return false;
  if (resolveSeekerBudget(user) <= 0) return false;
  if (!resolveSeekerCity(user)) return false;
  if (resolveSeekerLocalities(user).length === 0) return false;
  return true;
}
function areas(p) {
  return resolveSeekerLocalities(p).map(norm);
}
function roomTypes(p) {
  const values = p.preferredRoomTypes || (p.roomType ? [p.roomType] : []);
  return (Array.isArray(values) ? values : []).map(norm).filter(Boolean);
}
function occupancy(p) {
  return norm(p.occupancyPreference || p.preferredOccupancy || p.occupancy);
}
function actualQuiz(p) {
  const q = p.quizAnswers || {}, result = {};
  const aliases = {
    diet: "food_pref",
    smoke: "smoking",
    sleep: "sleep_time",
    clean: "cleanliness"
  };
  const values = {
    vegetarian: "veg",
    "non-vegetarian": "non_veg",
    "non-smoker": "never",
    "very tidy": "very",
    "night owl": "after_12",
    "early riser": "before_10"
  };
  for (const [key, value] of Object.entries(q).sort(
    ([a], [b]) => Number(a in aliases) - Number(b in aliases)
  )) {
    const v = norm(value);
    if (v) result[aliases[key] || key] = values[v] || v;
  }
  return result;
}
function getRoomMatchReasons(seeker = {}, listing = {}, owner = {}) {
  const reasons = [], caveats = [];
  const a = seeker || {}, b = listing || {}, o = owner || {};
  const rent = positive(b.partnerShare) || positive(b.monthlyRent) || positive(b.totalRent) || positive(b.rent), budget = resolveSeekerBudget(a);
  let budgetScore = 0, locationScore = 0, genderScore = 0, rulesScore = 0, preferenceScore = 0;
  if (budget && rent) {
    budgetScore = budget >= rent ? 25 : budget >= rent * 0.85 ? 20 : budget >= rent * 0.75 ? 12 : 0;
    if (budget >= rent) reasons.push("Budget fits");
    else caveats.push("Budget below rent");
  } else caveats.push("Budget not fully specified");
  const ac = norm(resolveSeekerCity(a)), bc = norm(b.city || o.city), loc = norm(b.locality);
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
    b.preferredGender || b.genderPreference || o.householdExpectations?.genderPref
  ), mine = norm(a.gender);
  const required = gender.includes("female") ? "female" : gender.includes("male") ? "male" : "";
  const genderMismatch = !!required && !!mine && mine !== required;
  if (required && mine) {
    genderScore = genderMismatch ? 0 : 20;
    if (genderMismatch) caveats.push("Listing gender requirement differs");
    else reasons.push("Matches listing gender requirement");
  } else if (["any", "co-ed", "coed"].includes(gender)) {
    genderScore = 20;
    reasons.push("Listing welcomes any gender");
  } else caveats.push("Gender requirement not fully specified");
  const rules = (b.houseRules || []).map(norm), exp = o.householdExpectations || {}, q = actualQuiz(a);
  const veg = rules.some(
    (r) => r.includes("veg") && !r.includes("non-veg") && !r.includes("allowed")
  ) || exp.dietPref === "veg";
  const smoke = rules.some(
    (r) => r.includes("no smoking") || r.includes("smoke-free") || r.includes("non-smoker") || r.includes("non smoker")
  ) || exp.smokingPolicy === "no_smoking";
  const pets = rules.some((r) => r.includes("no pets")) || exp.petPolicy === "no_pets";
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
    quizAnswers: b.ownerQuizAnswers || o.quizAnswers || {}
  }), keys = Object.keys(q).filter((k) => host[k]);
  if (keys.length) {
    const same = keys.filter((k) => host[k] === q[k]).length;
    rulesScore += 5 * same / Math.max(5, (/* @__PURE__ */ new Set([...Object.keys(q), ...Object.keys(host)])).size);
    if (same) reasons.push("Shared lifestyle preferences with host");
  }
  const hasLifestyleContext = Boolean(
    rules.length || Object.keys(host).length || exp.dietPref || exp.smokingPolicy || exp.petPolicy
  );
  if (!rules.length && !Object.keys(host).length)
    caveats.push("Household preferences not provided");
  const types = roomTypes(a), type = norm(b.roomType);
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
  let score = budgetScore + locationScore + genderScore + rulesScore + preferenceScore;
  if (genderMismatch) score = Math.min(40, score);
  if (ac && bc && ac !== bc) score = Math.min(60, score * 0.6);
  const hasSeekerSignals = Boolean(
    budget || ac || mine || Object.keys(q).length || types.length || occupancy(a)
  );
  const calibrated = isUserMatchingCalibrated(a);
  if (!calibrated) {
    score = 0;
    caveats.push("Complete your matching preferences to see compatibility");
  }
  const clampedScore = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;
  return {
    score: clampedScore,
    budgetScore,
    locationScore,
    genderScore,
    rulesScore,
    preferenceScore,
    trustScore: 0,
    budgetPct: budget && rent ? Math.round(budgetScore / 25 * 100) : null,
    locationPct: ac && bc ? Math.round(locationScore / 20 * 100) : null,
    lifestylePct: Object.keys(q).length && hasLifestyleContext ? Math.round(rulesScore / 20 * 100) : null,
    calibrated,
    hasProfilePreferences: Boolean(
      budget || ac || Object.keys(q).length || Object.keys(a.lifestyle || {}).length || a.housingPreferences?.budgetMin
    ),
    engineVersion: COMPATIBILITY_ENGINE_VERSION,
    reasons,
    caveats
  };
}
function canonicalSeekerFingerprint(seeker = {}) {
  const s = seeker || {};
  const q = actualQuiz(s);
  const sortedQuiz = Object.keys(q).sort().map((k) => `${k}:${q[k]}`);
  return JSON.stringify([
    isUserMatchingCalibrated(s) ? 1 : 0,
    resolveSeekerBudget(s),
    norm(resolveSeekerCity(s)),
    resolveSeekerLocalities(s).map(norm).sort(),
    norm(s.gender),
    roomTypes(s).sort(),
    occupancy(s),
    sortedQuiz
  ]);
}
function calculateCanonicalRoomCompatibility(seeker = {}, listing = {}, owner = {}) {
  return getRoomMatchReasons(seeker, listing, owner);
}
function resolveCanonicalRoomCompatibility(seeker = {}, listing = {}, owner = {}) {
  const precomputed = listing?.viewerCompatibility;
  if (precomputed && typeof precomputed === "object" && precomputed.engineVersion === COMPATIBILITY_ENGINE_VERSION && typeof precomputed.score === "number" && Number.isFinite(precomputed.score) && (!precomputed.seekerFingerprint || precomputed.seekerFingerprint === canonicalSeekerFingerprint(seeker))) {
    return {
      score: Math.max(0, Math.min(100, Math.round(precomputed.score))),
      budgetScore: Number(precomputed.budgetScore) || 0,
      locationScore: Number(precomputed.locationScore) || 0,
      genderScore: Number(precomputed.genderScore) || 0,
      rulesScore: Number(precomputed.rulesScore) || 0,
      preferenceScore: Number(precomputed.preferenceScore) || 0,
      trustScore: 0,
      budgetPct: typeof precomputed.budgetPct === "number" ? precomputed.budgetPct : null,
      locationPct: typeof precomputed.locationPct === "number" ? precomputed.locationPct : null,
      lifestylePct: typeof precomputed.lifestylePct === "number" ? precomputed.lifestylePct : null,
      calibrated: precomputed.calibrated !== false,
      hasProfilePreferences: Boolean(precomputed.hasProfilePreferences),
      engineVersion: COMPATIBILITY_ENGINE_VERSION,
      reasons: Array.isArray(precomputed.reasons) ? precomputed.reasons : [],
      caveats: Array.isArray(precomputed.caveats) ? precomputed.caveats : []
    };
  }
  return getRoomMatchReasons(seeker, listing, owner);
}
function synthesizeQuizFromProfile(profile, listing) {
  const result = { ...profile?.quizAnswers || {} };
  if (profile?.householdExpectations) {
    const exp = profile.householdExpectations;
    if (!result.smoking && exp.smokingPolicy) {
      result.smoking = exp.smokingPolicy === "no_smoking" ? "never" : "occasionally";
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
  if (listing) {
    if (!result.roommate_gender && listing.genderPreference) {
      const gp = listing.genderPreference.toLowerCase();
      result.roommate_gender = gp.includes("female") ? "female" : gp.includes("male") ? "male" : "any";
    }
    if (listing.houseRules && Array.isArray(listing.houseRules)) {
      const rules = listing.houseRules.map(
        (r) => (r || "").toLowerCase()
      );
      if (!result.cleanliness && rules.some((r) => r.includes("clean"))) {
        result.cleanliness = "very";
      }
      if (!result.smoking && rules.some(
        (r) => r.includes("no smoking") || r.includes("smoke-free") || r.includes("non-smoker") || r.includes("non smoker")
      )) {
        result.smoking = "never";
      }
      if (!result.pets && rules.some((r) => r.includes("no pets"))) {
        result.pets = "no";
      }
      if (!result.food_pref && rules.some((r) => r.includes("veg") && !r.includes("non-veg"))) {
        result.food_pref = "veg";
      }
      if (!result.guests && rules.some(
        (r) => r.includes("no parties") || r.includes("no guests")
      )) {
        result.guests = "rarely";
      }
    }
    if (listing.ownerQuizAnswers && typeof listing.ownerQuizAnswers === "object") {
      Object.assign(result, listing.ownerQuizAnswers);
    }
  }
  return result;
}
function calculateProfileCompatibility(userA, userB, listing) {
  if (!userA || !userB) {
    return {
      score: 0,
      reasons: [],
      caveats: ["Profile information unavailable"]
    };
  }
  const roleA = (userA.role || "").toLowerCase();
  const roleB = (userB.role || "").toLowerCase();
  const ownerIdFromListing = String(listing?.ownerId || "");
  const aUid = String(userA.uid || userA.id || "");
  const bUid = String(userB.uid || userB.id || "");
  const aOwnsListing = Boolean(
    listing && (ownerIdFromListing && aUid && aUid === ownerIdFromListing || roleA === "owner")
  );
  const bOwnsListing = Boolean(
    listing && (ownerIdFromListing && bUid && bUid === ownerIdFromListing || roleB === "owner")
  );
  if (listing) {
    let owner = userA;
    let seeker = userB;
    if (bOwnsListing && !aOwnsListing || bUid && ownerIdFromListing && bUid === ownerIdFromListing || roleB === "owner") {
      owner = userB;
      seeker = userA;
    } else if (aOwnsListing && !bOwnsListing || aUid && ownerIdFromListing && aUid === ownerIdFromListing || roleA === "owner") {
      owner = userA;
      seeker = userB;
    } else {
      const intentA = String(userA.housingIntent || userA.serverResolvedIntent?.intent || "").toLowerCase();
      const intentB = String(userB.housingIntent || userB.serverResolvedIntent?.intent || "").toLowerCase();
      if (intentB.includes("room") || intentB.includes("seeker") || intentB.includes("find")) {
        owner = userA;
        seeker = userB;
      } else if (intentA.includes("room") || intentA.includes("seeker") || intentA.includes("find")) {
        owner = userB;
        seeker = userA;
      }
    }
    const breakdown = getRoomMatchReasons(seeker, listing, owner);
    return {
      score: breakdown.score,
      reasons: breakdown.reasons,
      caveats: breakdown.caveats
    };
  }
  const reasons = [], caveats = [];
  if (userA.onboardingComplete === false || userB.onboardingComplete === false)
    return {
      score: 0,
      reasons,
      caveats: ["Complete profile information needed"]
    };
  let score = 0;
  const ac = norm(userA.city), bc = norm(userB.city), aa = areas(userA), ba = areas(userB);
  if (ac && bc) {
    if (ac === bc) {
      score += 15;
      reasons.push("Same city (" + userA.city + ")");
      if (aa.length && ba.length && aa.some((l) => ba.includes(l))) {
        score += 10;
        reasons.push("Preferred localities overlap");
      }
    } else caveats.push("Different cities");
  } else caveats.push("Location not fully specified");
  const ab = positive(userA.budget || userA.housingPreferences?.budgetMax), bb = positive(userB.budget || userB.housingPreferences?.budgetMax);
  if (ab && bb) {
    const ratio = Math.min(ab, bb) / Math.max(ab, bb);
    score += 25 * ratio;
    if (ratio >= 0.8) reasons.push("Budgets are close");
    else caveats.push("Budgets differ significantly");
  } else caveats.push("Budget not fully specified");
  const aq = actualQuiz(userA), bq = actualQuiz(userB), keys = Object.keys(aq).filter((k) => bq[k]), union = /* @__PURE__ */ new Set([...Object.keys(aq), ...Object.keys(bq)]);
  if (keys.length) {
    const same = keys.filter((k) => aq[k] === bq[k]).length;
    score += 30 * same / Math.max(5, union.size);
    if (same) reasons.push(same + " lifestyle preferences in common");
    if (keys.length < 5) caveats.push("Few overlapping quiz answers");
  } else caveats.push("No overlapping quiz answers yet");
  const at = roomTypes(userA), bt = roomTypes(userB);
  if (at.length && bt.length) {
    if (at.some((t) => bt.includes(t))) {
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
    caveats
  };
}
function calculateRoomCompatibility(seeker = {}, listing = {}, owner = {}) {
  return getRoomMatchReasons(seeker, listing, owner).score;
}
function getActiveStatus(timestamp) {
  if (!timestamp) return { status: "offline", text: "Active a while ago" };
  const lastActive = timestamp.toMillis ? timestamp.toMillis() : timestamp instanceof Date ? timestamp.getTime() : timestamp;
  const now = Date.now();
  const diffMs = now - lastActive;
  const diffMins = Math.floor(diffMs / (1e3 * 60));
  const diffHours = Math.floor(diffMs / (1e3 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1e3 * 60 * 60 * 24));
  if (diffMins < 15) {
    return { status: "online", text: "Active now" };
  } else if (diffHours < 24) {
    return { status: "recent", text: `Active ${diffHours || 1}h ago` };
  } else {
    return { status: "offline", text: `Active ${diffDays} days ago` };
  }
}
