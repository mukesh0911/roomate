import { validateHousingPreferences, type HousingIntent, type UserHousingPreferences } from './userIntent';

export interface ProfileEditorDraft {
  n: string; job: string; city: string; area: string; bio: string; ph: string;
  activeIntents: HousingIntent[]; discover: boolean;
  diet: string; smoke: string; sleep: string; guests: string; clean: string; pets?: string;
}
interface ExistingProfile {
  localities?: string[];
  city?: string;
  housingPreferences?: UserHousingPreferences;
  quizAnswers?: Record<string, string>;
}

/** Whitelist editable fields; never infer role, trust, residency or housing intent. */
export function buildProfileEditorUpdate(draft: ProfileEditorDraft, existing: ExistingProfile = {}) {
  const name = draft.n.trim(), city = draft.city.trim(), area = draft.area.trim();
  if (name.length < 2 || name.length > 120) throw new Error('Enter a name between 2 and 120 characters.');
  if (!city || city.length > 64) throw new Error('Enter your city.');
  if (!area || area.length > 128) throw new Error('Enter your locality.');
  if (draft.bio.length > 280) throw new Error('Keep your bio under 280 characters.');
  const activeIntents = [...new Set(draft.activeIntents)];
  // The basic editor displays one locality, so editing unrelated fields must
  // not silently replace the complete matching-preference locality list.
  const localities = Array.from(new Set([area, ...(existing.city === city ? (existing.localities || []) : [])])).slice(0, 3);
  const housingPreferences: UserHousingPreferences = {
    ...existing.housingPreferences, activeIntents,
    preferredCities: existing.city === city ? existing.housingPreferences?.preferredCities || [city] : [city],
    preferredLocalities: localities,
  };
  const validation = validateHousingPreferences(housingPreferences);
  if (!validation.isValid) throw new Error(validation.errors.join(' '));
  if (draft.discover && !activeIntents.length) throw new Error('Choose a housing intent before enabling roommate discovery.');
  return {
    name, profession: draft.job.trim(), city, localities, bio: draft.bio,
    avatar: draft.ph, housingPreferences,
    housingIntent: activeIntents.length === 1 ? activeIntents[0] : '',
    roommateDiscoveryEnabled: draft.discover === true,
    onboardingComplete: true,
    quizAnswers: {
      ...existing.quizAnswers,
      diet: draft.diet,
      smoke: draft.smoke,
      sleep: draft.sleep,
      guests: draft.guests,
      clean: draft.clean,
      ...(draft.pets !== undefined ? { pets: draft.pets } : {}),
    },
  };
}

export interface SeekerLifestyleDraft {
  diet?: string;
  smoke?: string;
  pets?: string;
  sleep?: string;
}

const SUPPORTED_USER_GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];

const DIET_TO_CANONICAL: Record<string, string> = {
  Vegetarian: 'veg',
  'Non-vegetarian': 'non_veg',
  Eggetarian: 'egg',
  Flexible: 'flexible',
};

const SMOKE_TO_CANONICAL: Record<string, string> = {
  'Non-smoker': 'never',
  'Outside only': 'outside',
  Smoker: 'regular',
};

const PETS_TO_CANONICAL: Record<string, string> = {
  'No pets / allergic': 'no',
  'Pet-friendly': 'yes',
  'Has pets': 'has_pets',
};

const SLEEP_TO_CANONICAL: Record<string, string> = {
  'Early riser': 'before_10',
  'Night owl': 'after_12',
  Flexible: 'flexible',
};

/** Maps user-selected seeker lifestyle habits into canonical matching tokens without inventing defaults. */
export function buildSeekerLifestyleQuizPatch(
  draft: SeekerLifestyleDraft,
  existingQuizAnswers: Record<string, string> = {},
): Record<string, string> {
  const nextQuiz: Record<string, string> = { ...existingQuizAnswers };

  if (draft.diet !== undefined) {
    if (draft.diet) {
      nextQuiz.diet = draft.diet;
      if (DIET_TO_CANONICAL[draft.diet]) nextQuiz.food_pref = DIET_TO_CANONICAL[draft.diet];
      else delete nextQuiz.food_pref;
    } else {
      delete nextQuiz.diet;
      delete nextQuiz.food_pref;
    }
  }

  if (draft.smoke !== undefined) {
    if (draft.smoke) {
      nextQuiz.smoke = draft.smoke;
      if (SMOKE_TO_CANONICAL[draft.smoke]) nextQuiz.smoking = SMOKE_TO_CANONICAL[draft.smoke];
      else delete nextQuiz.smoking;
    } else {
      delete nextQuiz.smoke;
      delete nextQuiz.smoking;
    }
  }

  if (draft.pets !== undefined) {
    if (draft.pets) {
      nextQuiz.pets = PETS_TO_CANONICAL[draft.pets] || draft.pets;
    } else {
      delete nextQuiz.pets;
    }
  }

  if (draft.sleep !== undefined) {
    if (draft.sleep) {
      nextQuiz.sleep = draft.sleep;
      if (SLEEP_TO_CANONICAL[draft.sleep]) nextQuiz.sleep_time = SLEEP_TO_CANONICAL[draft.sleep];
      else delete nextQuiz.sleep_time;
    } else {
      delete nextQuiz.sleep;
      delete nextQuiz.sleep_time;
    }
  }

  return nextQuiz;
}

export function buildMatchingPreferencesUpdate(
  draft: {
    b: number[];
    areas: string[];
    mv: string;
    types: string[];
    gd: string;
    city?: string;
    name?: string;
    ug?: string;
    diet?: string;
    smoke?: string;
    pets?: string;
    sleep?: string;
    guests?: string;
    clean?: string;
    teamUpDiscoverable?: boolean;
  },
  existing: ExistingProfile & { name?: string; onboardingComplete?: boolean; housingIntent?: string } = {},
) {
  const [minimum, maximum] = draft.b;
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum <= 0 || minimum > maximum) throw new Error('Enter a valid minimum and maximum budget.');
  const areas = [...new Set(draft.areas.map(area => area.trim()).filter(Boolean))];
  if (!areas.length || areas.length > 3) throw new Error('Choose between one and three localities.');
  if (!['Any', 'Female', 'Male'].includes(draft.gd)) throw new Error('Choose a valid roommate gender preference.');
  if (draft.types.some(type => !['Private room', 'Full flat', 'PG / Coliving'].includes(type))) throw new Error('Choose a supported place type.');

  const trimmedCity = typeof draft.city === 'string' ? draft.city.trim() : '';
  if (typeof draft.city === 'string' && !trimmedCity) throw new Error('Choose your target city.');
  if (trimmedCity.length > 64) throw new Error('Enter a valid city name.');

  let validatedName: string | undefined;
  if (typeof draft.name === 'string') {
    const tName = draft.name.trim();
    if (tName.length < 2 || tName.length > 120) throw new Error('Enter your name (between 2 and 120 characters).');
    validatedName = tName;
  }

  let validatedGender: string | undefined;
  if (typeof draft.ug === 'string') {
    const tGender = draft.ug.trim();
    if (tGender && !SUPPORTED_USER_GENDERS.includes(tGender)) throw new Error('Choose a valid gender option.');
    validatedGender = tGender;
  }

  const effectiveCity = trimmedCity || existing.city?.trim() || '';
  const effectiveName = validatedName || existing.name?.trim() || '';
  const canFlipComplete = Boolean(effectiveCity && effectiveName);

  const baseQuizWithExtras: Record<string, string> = {
    ...existing.quizAnswers,
    roommate_gender: draft.gd.toLowerCase(),
  };
  if (draft.guests !== undefined) {
    if (draft.guests) baseQuizWithExtras.guests = draft.guests;
    else delete baseQuizWithExtras.guests;
  }
  if (draft.clean !== undefined) {
    if (draft.clean) baseQuizWithExtras.clean = draft.clean;
    else delete baseQuizWithExtras.clean;
  }

  const quizAnswers = buildSeekerLifestyleQuizPatch(
    { diet: draft.diet, smoke: draft.smoke, pets: draft.pets, sleep: draft.sleep },
    baseQuizWithExtras,
  );

  return {
    budget: maximum,
    budgetMin: minimum,
    localities: areas,
    moveInDate: draft.mv,
    preferredRoomTypes: [...draft.types],
    roommateGenderPreference: draft.gd,
    ...(validatedName ? { name: validatedName } : {}),
    ...(trimmedCity ? { city: trimmedCity } : {}),
    ...(validatedGender !== undefined && validatedGender ? { gender: validatedGender } : {}),
    ...(canFlipComplete && draft.city !== undefined ? { onboardingComplete: true } : {}),
    preferencesComplete: true,
    housingPreferences: {
      ...existing.housingPreferences,
      activeIntents: typeof draft.teamUpDiscoverable === 'boolean'
        ? (draft.teamUpDiscoverable
            ? Array.from(new Set([...(existing.housingPreferences?.activeIntents || []), ...(existing.housingIntent === 'find_room' || existing.housingIntent === 'have_room' ? [existing.housingIntent] : []), 'team_up']))
            : (existing.housingPreferences?.activeIntents || []).filter((intent) => intent !== 'team_up'))
        : (existing.housingPreferences?.activeIntents || (existing.housingIntent ? [existing.housingIntent] : ['find_room'])),
      ...(effectiveCity ? { preferredCities: [effectiveCity] } : {}),
      budgetMin: minimum,
      budgetMax: maximum,
      preferredLocalities: areas,
      moveInDate: draft.mv,
    },
    quizAnswers,
    ...(typeof draft.teamUpDiscoverable === 'boolean' ? { roommateDiscoveryEnabled: draft.teamUpDiscoverable } : {}),
  };
}
