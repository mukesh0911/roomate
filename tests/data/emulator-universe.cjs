/**
 * Canonical identity registry for the local NestMate QA universe.
 * This file deliberately contains no Firebase configuration or live secret.
 */

const TEST_PASSWORD = process.env.NESTMATE_E2E_PASSWORD || 'Nestmate-Emulator-Only-123!';
const STATE_FILES = {
  SEEKER_A: 'seekerA.json', SEEKER_B: 'seekerB.json', SEEKER_WEAK: 'seekerWeak.json',
  SEEKER_OTHER_CITY: 'seekerOtherCity.json', OWNER_A: 'ownerA.json', OWNER_B: 'ownerB.json',
  OWNER_PENDING: 'ownerPending.json', OWNER_REJECTED: 'ownerRejected.json', OWNER_RESUBMIT: 'ownerResubmit.json',
  ONBOARDING_INCOMPLETE: 'onboardingPending.json', SUSPENDED_USER: 'suspendedUser.json',
  BANNED_USER: 'bannedUser.json', ADMIN: 'admin.json', PREMIUM_USER: 'premiumUser.json',
  QUOTA_EXHAUSTED: 'quotaFullUser.json', UNRELATED_USER: 'unrelatedUser.json', DISPOSABLE_USER: 'disposableUser.json',
};

const PERSONAS = [
  ['SEEKER_A', 'qa_seeker_a', 'seeker.a@nestmate.test', 'Aditi Sharma', 'seeker', 'active', true, false, 'Bengaluru'],
  ['SEEKER_B', 'qa_seeker_b', 'seeker.b@nestmate.test', 'Pooja Iyer', 'seeker', 'active', true, false, 'Bengaluru'],
  ['SEEKER_WEAK', 'qa_seeker_weak', 'seeker.weak@nestmate.test', 'Karan Mehra', 'seeker', 'active', true, false, 'Bengaluru'],
  ['SEEKER_OTHER_CITY', 'qa_seeker_other_city', 'seeker.chennai@nestmate.test', 'Meera Nair', 'seeker', 'active', true, false, 'Chennai'],
  ['OWNER_A', 'qa_owner_a', 'owner.a@nestmate.test', 'Ramesh Gupta', 'owner', 'active', true, true, 'Bengaluru'],
  ['OWNER_B', 'qa_owner_b', 'owner.b@nestmate.test', 'Siddharth Rao', 'owner', 'active', true, false, 'Bengaluru'],
  ['OWNER_PENDING', 'qa_owner_pending', 'owner.pending@nestmate.test', 'Anjali Deshmukh', 'owner', 'active', false, false, 'Bengaluru'],
  ['OWNER_REJECTED', 'qa_owner_rejected', 'owner.rejected@nestmate.test', 'Kavita Reddy', 'owner', 'active', false, false, 'Bengaluru'],
  ['OWNER_RESUBMIT', 'qa_owner_resubmit', 'owner.resubmit@nestmate.test', 'Dev Patel', 'owner', 'active', false, false, 'Bengaluru'],
  ['ONBOARDING_INCOMPLETE', 'qa_incomplete', 'incomplete@nestmate.test', '', null, 'active', false, false, 'Bengaluru'],
  ['SUSPENDED_USER', 'qa_suspended', 'suspended@nestmate.test', 'Suspended Seeker', 'seeker', 'suspended', false, false, 'Bengaluru'],
  ['BANNED_USER', 'qa_banned', 'banned@nestmate.test', 'Banned Seeker', 'seeker', 'banned', false, false, 'Bengaluru'],
  ['ADMIN', 'qa_admin', 'admin.qa@nestmate.test', 'NestMate QA Admin', 'seeker', 'active', true, true, 'Bengaluru'],
  ['PREMIUM_USER', 'qa_premium', 'premium@nestmate.test', 'Priya Sharma', 'seeker', 'active', true, true, 'Bengaluru'],
  ['QUOTA_EXHAUSTED', 'qa_quota', 'quota@nestmate.test', 'Suresh Raina', 'seeker', 'active', true, false, 'Bengaluru'],
  ['UNRELATED_USER', 'qa_third_party', 'third.party@nestmate.test', 'Unaffiliated User', 'seeker', 'active', true, false, 'Bengaluru'],
  ['DISPOSABLE_USER', 'qa_delete_me', 'delete.me@nestmate.test', 'Disposable User', 'seeker', 'active', true, false, 'Bengaluru'],
].map(([key, uid, email, name, role, status, verified, premium, city]) => ({
  key, uid, email, name, role, status, verified, premium, city,
  password: TEST_PASSWORD,
  storageStatePath: `tests/.auth/${STATE_FILES[key]}`,
}));

const BY_KEY = Object.fromEntries(PERSONAS.map(persona => [persona.key, persona]));

const IDS = Object.freeze({
  LISTING_DRAFT: 'qa_listing_draft',
  LISTING_PENDING: 'qa_listing_pending',
  LISTING_ACTIVE: 'qa_listing_active',
  LISTING_OWNER_B: 'qa_listing_owner_b',
  LISTING_PAUSED: 'qa_listing_paused',
  LISTING_FILLED: 'qa_listing_filled',
  LISTING_CLOSED: 'qa_listing_closed',
  LISTING_STALE: 'qa_listing_stale',
  LISTING_EXPIRED: 'qa_listing_expired',
  CONNECTION_PENDING: 'qa_conn_pending',
  CONNECTION_ACCEPTED: 'qa_conn_accepted',
  CONNECTION_REJECTED: 'qa_conn_rejected',
  CONNECTION_BLOCKED: 'qa_conn_blocked',
  CONNECTION_OWNER_B: 'qa_conn_owner_b',
  CONNECTION_EMPTY_CHAT: 'qa_conn_empty_chat',
  CONNECTION_DELETE: 'qa_conn_delete',
  CHAT_EMPTY: 'qa_chat_empty',
  CHAT_EXISTING: 'qa_chat_existing',
  CHAT_DELETE: 'qa_chat_delete',
});

module.exports = { TEST_PASSWORD, STATE_FILES, PERSONAS, BY_KEY, IDS };
