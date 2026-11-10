import { validateHousingPreferences, type HousingIntent, type UserHousingPreferences } from './userIntent';

export interface ProfileEditorDraft {
  n: string; job: string; city: string; area: string; bio: string; ph: string;
  activeIntents: HousingIntent[]; discover: boolean;
  diet: string; smoke: string; sleep: string; guests: string; clean: string;
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
  const unchangedArea = existing.localities?.[0] === area && existing.city === city;
  const localities = unchangedArea ? [...existing.localities!] : [area];
  const housingPreferences: UserHousingPreferences = {
    ...existing.housingPreferences, activeIntents,
    preferredCities: unchangedArea ? existing.housingPreferences?.preferredCities || [city] : [city],
    preferredLocalities: unchangedArea ? existing.housingPreferences?.preferredLocalities || localities : localities,
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
    quizAnswers: { ...existing.quizAnswers, diet: draft.diet, smoke: draft.smoke, sleep: draft.sleep, guests: draft.guests, clean: draft.clean },
  };
}

export function buildMatchingPreferencesUpdate(
  draft: { b: number[]; areas: string[]; mv: string; types: string[]; gd: string },
  existing: ExistingProfile = {},
) {
  const [minimum, maximum] = draft.b;
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum <= 0 || minimum > maximum) throw new Error('Enter a valid minimum and maximum budget.');
  const areas = [...new Set(draft.areas.map(area => area.trim()).filter(Boolean))];
  if (!areas.length || areas.length > 3) throw new Error('Choose between one and three localities.');
  if (!['Any', 'Female', 'Male'].includes(draft.gd)) throw new Error('Choose a valid roommate gender preference.');
  if (draft.types.some(type => !['Private room', 'Full flat', 'PG / Coliving'].includes(type))) throw new Error('Choose a supported place type.');
  return {
    budget: maximum, budgetMin: minimum, localities: areas, moveInDate: draft.mv,
    preferredRoomTypes: [...draft.types], roommateGenderPreference: draft.gd,
    housingPreferences: {
      ...existing.housingPreferences, activeIntents: existing.housingPreferences?.activeIntents || [],
      budgetMin: minimum, budgetMax: maximum, preferredLocalities: areas, moveInDate: draft.mv,
    },
    quizAnswers: { ...existing.quizAnswers, roommate_gender: draft.gd.toLowerCase() },
  };
}
