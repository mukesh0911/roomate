import { describe, expect, it } from 'vitest';
import { buildMatchingPreferencesUpdate, buildProfileEditorUpdate, type ProfileEditorDraft } from './profileEditor';
import { resolveUserHousingIntent } from './userIntent';

const draft: ProfileEditorDraft = {
  n: 'New Member', job: '', city: 'Pune', area: 'Baner', bio: '', ph: '',
  activeIntents: ['find_room'], discover: false, diet: '', smoke: '', sleep: '', guests: '', clean: '',
};
describe('actual profile/onboarding form mapping', () => {
  it('completes a real location/name profile without fabricating lifestyle, role or trust', () => {
    const result = buildProfileEditorUpdate(draft);
    expect(result).toMatchObject({ city: 'Pune', localities: ['Baner'], onboardingComplete: true, roommateDiscoveryEnabled: false, housingIntent: 'find_room' });
    expect(result).not.toHaveProperty('role'); expect(result).not.toHaveProperty('isVerified');
    expect(resolveUserHousingIntent({ ...result, uid: 'new' }).isTeamUpSeeker).toBe(false);
  });
  it('preserves multiple explicit intents and consent without inferring a resident host', () => {
    const result = buildProfileEditorUpdate({ ...draft, activeIntents: ['find_room', 'team_up', 'have_room'], discover: true });
    const resolved = resolveUserHousingIntent({ ...result, uid: 'new' });
    expect(resolved.activeIntents).toEqual(['find_room', 'team_up', 'have_room']);
    expect(resolved.isTeamUpSeeker).toBe(true); expect(resolved.isLiveInHost).toBe(false);
  });
  it('allows property-only accounts without inventing roommate intent or discovery consent', () => {
    const result = buildProfileEditorUpdate({ ...draft, activeIntents: [] });
    expect(result.housingPreferences.activeIntents).toEqual([]);
    expect(result.roommateDiscoveryEnabled).toBe(false);
  });
  it('rejects missing location and unsupported intents, preserving existing canonical association and quiz', () => {
    expect(() => buildProfileEditorUpdate({ ...draft, city: '' })).toThrow('city');
    expect(() => buildProfileEditorUpdate({ ...draft, activeIntents: [], discover: true })).toThrow('housing intent');
    const result = buildProfileEditorUpdate(draft, { housingPreferences: { activeIntents: ['have_room'], associatedListingId: 'owned' }, quizAnswers: { pets: 'yes' } });
    expect(result.housingPreferences.associatedListingId).toBe('owned');
    expect(result.quizAnswers.pets).toBe('yes');
  });
  it('persists all supported matching controls and preserves lifestyle answers and intents', () => {
    const result = buildMatchingPreferencesUpdate({ b: [10000, 20000], areas: ['Baner'], mv: 'Within 30 days', types: ['Private room'], gd: 'Female' }, { housingPreferences: { activeIntents: ['team_up'] }, quizAnswers: { diet: 'Vegetarian' } });
    expect(result).toMatchObject({ budget: 20000, budgetMin: 10000, preferredRoomTypes: ['Private room'], roommateGenderPreference: 'Female', moveInDate: 'Within 30 days' });
    expect(result.housingPreferences.activeIntents).toEqual(['team_up']);
    expect(result.quizAnswers).toEqual({ diet: 'Vegetarian', roommate_gender: 'female' });
    expect(() => buildMatchingPreferencesUpdate({ b: [20000, 10000], areas: ['Baner'], mv: '', types: [], gd: 'Any' })).toThrow('budget');
  });
});
