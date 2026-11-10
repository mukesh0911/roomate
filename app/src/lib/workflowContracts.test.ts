import { describe, expect, it } from 'vitest';
import { assertApplicationTransition, type ApplicationStatus } from './applicationState';
import { listingRent, listingStatusLabel, consentIsCurrent } from './listingTruth';
import { buildProfileEditorUpdate } from './profileEditor';

describe('existing workflow contracts', () => {
  it('adapts actual prices and never fabricates active status or missing rent', () => {
    expect(listingRent({ monthlyRent: 12000 })).toBe(12000);
    expect(listingRent({ partnerShare: 0, totalRent: 20000 })).toBe(0);
    expect(listingRent({ rent: '12000' })).toBe(12000);
    expect(listingRent({})).toBeNull();
    expect(listingStatusLabel('pending_verification')).toBe('Pending verification');
    expect(listingStatusLabel('rejected')).toBe('Rejected');
    expect(listingStatusLabel(undefined)).toBe('Unknown');
  });
  it('keeps terminal applications closed and enforces the deciding actor', () => {
    for (const terminal of ['rejected','withdrawn','declined_by_applicant'] as ApplicationStatus[]) {
      expect(() => assertApplicationTransition(terminal,'selected',true)).toThrow();
    }
    expect(() => assertApplicationTransition('pending','selected',false)).toThrow();
    expect(() => assertApplicationTransition('selected','declined_by_applicant',true)).toThrow();
    expect(() => assertApplicationTransition('selected','declined_by_applicant',false)).not.toThrow();
    expect(() => assertApplicationTransition('shortlisted','selected',true)).not.toThrow();
  });
  it('preserves undisplayed localities during an unrelated basic profile edit', () => {
    const original = { city:'Pune', localities:['Baner','Aundh','Wakad'], housingPreferences:{activeIntents:['team_up' as const],preferredLocalities:['Baner','Aundh','Wakad']} };
    const update = buildProfileEditorUpdate({n:'Updated Name',job:'',city:'Pune',area:'Baner',bio:'',ph:'',activeIntents:['team_up'],discover:true,diet:'',smoke:'',sleep:'',guests:'',clean:''},original);
    expect(update.localities).toEqual(original.localities);
    expect(update.housingPreferences.preferredLocalities).toEqual(original.localities);
  });
});

it('disconnect invalidates old person aliases but preserves separate listing consent', () => {
  const timestamp = (value: number) => ({ toMillis: () => value });
  const member = { personCommunicationRevokedAt: { peer: timestamp(20) } };
  const consent = { fromUserId: 'self', toUserId: 'peer', createdAt: timestamp(10) };
  expect(consentIsCurrent(member, {}, consent)).toBe(false);
  expect(consentIsCurrent(member, {}, { ...consent, listingId: 'room' })).toBe(true);
  expect(consentIsCurrent(member, {}, { ...consent, createdAt: timestamp(30) })).toBe(true);
  expect(consentIsCurrent({}, member, { fromUserId: 'peer', toUserId: 'self', createdAt: timestamp(10) })).toBe(false);
});
