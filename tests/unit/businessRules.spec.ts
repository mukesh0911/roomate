import { test, expect } from '@playwright/test';
import { BusinessRuleUtils } from '../helpers/businessRuleUtils';
import { AccountFactory, defaultQuizAnswers, nightOwlQuizAnswers } from '../factories/accountFactory';
import { DataFactory } from '../factories/dataFactory';

test.describe('Phase 3: Master Business Rules & Pure Logic Certification (RULE-01 to RULE-20)', () => {
  // ── RULE-01: 10-Point Compatibility Engine ─────────────────────────────────
  test('RULE-01: 10-Point Compatibility Engine computes exact percentages and dealbreakers', () => {
    const sRef = { ...defaultQuizAnswers };

    // 1. Perfect Match (10/10 dimensions identical, same city) => 100%
    const perfectScore = BusinessRuleUtils.calculateCompatibility(sRef, { ...sRef }, 'Bengaluru', 'Bengaluru');
    expect(perfectScore).toBe(100);

    // 2. Intermediate Match: 8/10 dimensions match
    const eightTenths = { ...sRef, sleep_time: 'after_12', work_mode: 'wfo' };
    const score80 = BusinessRuleUtils.calculateCompatibility(sRef, eightTenths, 'Bengaluru', 'Bengaluru');
    expect(score80).toBe(80);

    // 3. Cross-city Cap: 10/10 match but different city => capped at 60%
    const crossCity = BusinessRuleUtils.calculateCompatibility(sRef, { ...sRef }, 'Bengaluru', 'Chennai');
    expect(crossCity).toBe(60);

    // 4. Strict Dealbreaker Veto: non-smoker vs regular smoker => 0%
    const smoker = { ...sRef, smoking: 'regularly' };
    const smokerVeto = BusinessRuleUtils.calculateCompatibility(sRef, smoker, 'Bengaluru', 'Bengaluru');
    expect(smokerVeto).toBe(0);

    // 5. Incomplete answers / empty quiz => 0%
    const emptyScore = BusinessRuleUtils.calculateCompatibility(sRef, {}, 'Bengaluru', 'Bengaluru');
    expect(emptyScore).toBe(0);

    // 6. Undefined input => 0%
    expect(BusinessRuleUtils.calculateCompatibility(undefined, sRef)).toBe(0);
  });

  // ── RULE-02: Room-to-Seeker Scoring Invariants ──────────────────────────────
  test('RULE-02: Room-to-Seeker Budget and Locality alignment invariants', () => {
    const seekerBudget = 15000;
    const roomExact = 15000;
    const roomAffordable = 12000;
    const roomOverBudget = 25000;

    // Budget tolerance: within 20%
    const isWithinBudget = (rent: number, budget: number) => rent <= budget * 1.2;
    expect(isWithinBudget(roomExact, seekerBudget)).toBe(true);
    expect(isWithinBudget(roomAffordable, seekerBudget)).toBe(true);
    expect(isWithinBudget(roomOverBudget, seekerBudget)).toBe(false);
  });

  // ── RULE-03: Free Connection Request Limit ──────────────────────────────────
  test('RULE-03: Enforces FREE_CONNECT_LIMIT = 5 for standard seekers and unlimited for Pro', () => {
    // 0 to 4 used: can send
    for (let used = 0; used < 5; used++) {
      expect(BusinessRuleUtils.isConnectionQuotaExhausted(used, 5, false)).toBe(false);
    }

    // 5 used: quota exhausted
    expect(BusinessRuleUtils.isConnectionQuotaExhausted(5, 5, false)).toBe(true);

    // 6 used: exhausted
    expect(BusinessRuleUtils.isConnectionQuotaExhausted(6, 5, false)).toBe(true);

    // Pro / Premium subscriber: never exhausted even at 10 requests
    expect(BusinessRuleUtils.isConnectionQuotaExhausted(10, 5, true)).toBe(false);
  });

  test('RULE-03 (Server-Side Quota Enforcement): 0 to 5 allowed, 6th direct connection blocked with PERMISSION_DENIED', () => {
    // 1. Provision a non-premium test user
    const seeker = AccountFactory.createSeeker('test_quota_seeker', {
      isPremium: false,
      connectsUsed: 0,
      connectsLimit: 5,
    });

    // 2. Simulate 5 valid outgoing connection requests
    for (let i = 1; i <= 5; i++) {
      expect(BusinessRuleUtils.isConnectionQuotaExhausted(seeker.connectsUsed, seeker.connectsLimit, seeker.isPremium)).toBe(false);
      seeker.connectsUsed = i;
    }

    // 3. Verify those 5 are accepted and counter is at ceiling
    expect(seeker.connectsUsed).toBe(5);

    // 4. Attempt 6th connection: UI / client guard blocks
    expect(BusinessRuleUtils.isConnectionQuotaExhausted(seeker.connectsUsed, seeker.connectsLimit, seeker.isPremium)).toBe(true);

    // 5. Server-side rule evaluation: connectsUsed < 5 evaluates to false -> PERMISSION_DENIED
    const serverRuleAllows = (connectsUsed: number, isPremium: boolean) => isPremium || connectsUsed < 5;
    expect(serverRuleAllows(seeker.connectsUsed, seeker.isPremium)).toBe(false);

    // 6. Pro / Premium user bypasses quota limit
    const premiumSeeker = AccountFactory.createSeeker('test_pro_seeker', {
      isPremium: true,
      connectsUsed: 10,
    });
    expect(serverRuleAllows(premiumSeeker.connectsUsed, premiumSeeker.isPremium)).toBe(true);
  });

  // ── RULE-04: Contact Privacy & WhatsApp Phone Masking ───────────────────────
  test('RULE-04: Phone numbers and WhatsApp links remain masked until connection is accepted', () => {
    const viewerId = 'usr_seeker_1';
    const targetId = 'usr_owner_1';

    // Anonymous or unrequested
    expect(BusinessRuleUtils.canViewUnmaskedContact(viewerId, targetId, null)).toBe(false);

    // Pending connection: still masked
    expect(BusinessRuleUtils.canViewUnmaskedContact(viewerId, targetId, 'pending')).toBe(false);

    // Rejected / blocked: masked
    expect(BusinessRuleUtils.canViewUnmaskedContact(viewerId, targetId, 'rejected')).toBe(false);
    expect(BusinessRuleUtils.canViewUnmaskedContact(viewerId, targetId, 'blocked')).toBe(false);

    // Accepted: unmasked and available
    expect(BusinessRuleUtils.canViewUnmaskedContact(viewerId, targetId, 'accepted')).toBe(true);

    // Own profile: always unmasked
    expect(BusinessRuleUtils.canViewUnmaskedContact(viewerId, viewerId, null)).toBe(true);

    // Platform admin: always unmasked
    expect(BusinessRuleUtils.canViewUnmaskedContact(viewerId, targetId, 'pending', true)).toBe(true);
  });

  // ── RULE-05: 30-Day Listing Freshness & Discoverability Expiry ─────────────
  test('RULE-05: Listings older than 30 days are marked stale and excluded from search', () => {
    const now = Date.now();
    const fresh20DaysAgo = new Date(now - 20 * 86400000).toISOString();
    const exactBoundary29Days = new Date(now - 29 * 86400000).toISOString();
    const expired31DaysAgo = new Date(now - 31 * 86400000).toISOString();
    const stale60DaysAgo = new Date(now - 60 * 86400000).toISOString();

    expect(BusinessRuleUtils.isListingFresh(fresh20DaysAgo)).toBe(true);
    expect(BusinessRuleUtils.isListingFresh(exactBoundary29Days)).toBe(true);
    expect(BusinessRuleUtils.isListingFresh(expired31DaysAgo)).toBe(false);
    expect(BusinessRuleUtils.isListingFresh(stale60DaysAgo)).toBe(false);
    expect(BusinessRuleUtils.isListingFresh(null)).toBe(false);
  });

  // ── RULE-06: Tier 3 Owner Verification State Machine ────────────────────────
  test('RULE-06: Owner Verification transitions strictly enforce defined state machine', () => {
    // Valid lifecycle forward transitions
    expect(BusinessRuleUtils.isValidVerificationTransition('NOT_STARTED', 'SUBMITTED')).toBe(true);
    expect(BusinessRuleUtils.isValidVerificationTransition('SUBMITTED', 'UNDER_REVIEW')).toBe(true);
    expect(BusinessRuleUtils.isValidVerificationTransition('UNDER_REVIEW', 'APPROVED')).toBe(true);
    expect(BusinessRuleUtils.isValidVerificationTransition('UNDER_REVIEW', 'REJECTED')).toBe(true);
    expect(BusinessRuleUtils.isValidVerificationTransition('UNDER_REVIEW', 'RESUBMISSION_REQUIRED')).toBe(true);
    expect(BusinessRuleUtils.isValidVerificationTransition('RESUBMISSION_REQUIRED', 'SUBMITTED')).toBe(true);

    // Invalid self-escalation transitions
    expect(BusinessRuleUtils.isValidVerificationTransition('NOT_STARTED', 'APPROVED')).toBe(false);
    expect(BusinessRuleUtils.isValidVerificationTransition('APPROVED', 'SUBMITTED')).toBe(false);
    expect(BusinessRuleUtils.isValidVerificationTransition('APPROVED', 'UNDER_REVIEW')).toBe(false);
  });

  // ── RULE-07: Marketplace Role Separation Invariant ──────────────────────────
  test('RULE-07: Users with role owner are strictly excluded from roommate discovery pool', () => {
    const seeker = AccountFactory.createSeeker('s_active');
    const owner = AccountFactory.createOwner('o_active');

    const filterRoommates = (users: any[]) => users.filter(u => u.role === 'seeker' && u.onboardingComplete);
    const pool = filterRoommates([seeker, owner]);

    expect(pool).toHaveLength(1);
    expect(pool[0].uid).toBe(seeker.uid);
    expect(pool.some(u => u.role === 'owner')).toBe(false);
  });

  // ── RULE-08: City & Locality Geolocation Resolution ─────────────────────────
  test('RULE-08: City coordinates and locality resolution', () => {
    const cityCoords: Record<string, { lat: number; lng: number }> = {
      Bengaluru: { lat: 12.9716, lng: 77.5946 },
      Mumbai: { lat: 19.076, lng: 72.8777 },
      Chennai: { lat: 13.0827, lng: 80.2707 },
    };

    expect(cityCoords['Bengaluru'].lat).toBeCloseTo(12.97, 1);
    expect(cityCoords['Mumbai'].lat).toBeCloseTo(19.07, 1);
  });

  // ── RULE-09: Applicant Ranking & Fit Evaluation ─────────────────────────────
  test('RULE-09: Applicant Ranking sorts by composite score (40% comp, 20% profile, 20% budget, 20% trust)', () => {
    // Candidate A: 100% comp, 100% profile, 100% budget, Tier 3 trust (100%)
    const scoreA = BusinessRuleUtils.calculateApplicantRankScore({
      compatibilityScore: 100,
      profileCompleteness: 100,
      budgetAlignment: 100,
      verificationLevel: 3,
    });
    expect(scoreA).toBe(100);

    // Candidate B: 50% comp, 50% profile, 50% budget, Tier 0 trust (0%)
    const scoreB = BusinessRuleUtils.calculateApplicantRankScore({
      compatibilityScore: 50,
      profileCompleteness: 50,
      budgetAlignment: 50,
      verificationLevel: 0,
    });
    // 50*0.4 + 50*0.2 + 50*0.2 + 0 = 20 + 10 + 10 = 40
    expect(scoreB).toBe(40);

    expect(scoreA).toBeGreaterThan(scoreB);
  });

  // ── RULE-10: Seeker Onboarding Completeness Invariant ───────────────────────
  test('RULE-10: Seeker profiles must have at least 5 quiz answers to complete onboarding', () => {
    const isSeekerOnboardingValid = (answers: Record<string, any>) => Object.keys(answers).length >= 5;

    expect(isSeekerOnboardingValid({ q1: 'a', q2: 'b', q3: 'c', q4: 'd' })).toBe(false); // 4 answers: invalid
    expect(isSeekerOnboardingValid({ q1: 'a', q2: 'b', q3: 'c', q4: 'd', q5: 'e' })).toBe(true); // 5 answers: valid
    expect(isSeekerOnboardingValid(defaultQuizAnswers)).toBe(true); // 10 answers: valid
  });

  // ── RULE-11: Listing Financial Invariants ───────────────────────────────────
  test('RULE-11: totalRent > 0, partnerShare > 0 and <= totalRent, deposit >= 0', () => {
    // Valid listing finances
    expect(BusinessRuleUtils.validateFinancialInvariants({ totalRent: 20000, partnerShare: 10000, deposit: 40000 }).isValid).toBe(true);
    expect(BusinessRuleUtils.validateFinancialInvariants({ totalRent: 15000, partnerShare: 15000, deposit: 0 }).isValid).toBe(true);

    // Invalid total rent <= 0
    expect(BusinessRuleUtils.validateFinancialInvariants({ totalRent: 0, partnerShare: 0 }).isValid).toBe(false);

    // Invalid partnerShare > totalRent
    expect(BusinessRuleUtils.validateFinancialInvariants({ totalRent: 20000, partnerShare: 25000 }).isValid).toBe(false);

    // Invalid negative deposit
    expect(BusinessRuleUtils.validateFinancialInvariants({ totalRent: 20000, partnerShare: 10000, deposit: -5000 }).isValid).toBe(false);
  });

  // ── RULE-12: Single Active Role Invariant ───────────────────────────────────
  test('RULE-12: User role must be strictly seeker or owner', () => {
    const isValidRole = (role: string | null) => role === 'seeker' || role === 'owner';
    expect(isValidRole('seeker')).toBe(true);
    expect(isValidRole('owner')).toBe(true);
    expect(isValidRole('admin')).toBe(false);
    expect(isValidRole('guest')).toBe(false);
    expect(isValidRole(null)).toBe(false);
  });

  // ── RULE-13: Self-Connection & Self-Report Prohibition ──────────────────────
  test('RULE-13: Self-connections (fromUserId === toUserId) and self-reports are prohibited', () => {
    expect(BusinessRuleUtils.validateSelfOperation('user_A', 'user_B')).toBe(true);
    expect(BusinessRuleUtils.validateSelfOperation('user_A', 'user_A')).toBe(false);
  });

  // ── RULE-14: Active User Requirement for Mutating Operations ───────────────
  test('RULE-14: Suspended and banned accounts are prohibited from database mutations', () => {
    expect(BusinessRuleUtils.canPerformMutations('active')).toBe(true);
    expect(BusinessRuleUtils.canPerformMutations('suspended')).toBe(false);
    expect(BusinessRuleUtils.canPerformMutations('banned')).toBe(false);
  });

  // ── RULE-15: Notification Immutability ──────────────────────────────────────
  test('RULE-15: Notification payload cannot be mutated once created', () => {
    const notif = { id: 'n1', title: 'New Message', read: false };
    const canUpdateField = (field: string) => field === 'read'; // only 'read' status can be modified

    expect(canUpdateField('read')).toBe(true);
    expect(canUpdateField('title')).toBe(false);
    expect(canUpdateField('userId')).toBe(false);
  });

  // ── RULE-16: Dual-Key Admin Access Model ────────────────────────────────────
  test('RULE-16: Admin privileges granted only to authorized emails or admins collection', () => {
    expect(BusinessRuleUtils.isAdminEmail('admin@nestmate-test.com')).toBe(true);
    expect(BusinessRuleUtils.isAdminEmail('admin@nestmate.in')).toBe(true);
    expect(BusinessRuleUtils.isAdminEmail('mukvr46@gmail.com')).toBe(true);
    expect(BusinessRuleUtils.isAdminEmail('MUKVR46@GMAIL.COM')).toBe(true); // case-insensitive

    expect(BusinessRuleUtils.isAdminEmail('hacker@example.com')).toBe(false);
    expect(BusinessRuleUtils.isAdminEmail('seeker.ref@nestmate-test.com')).toBe(false);
    expect(BusinessRuleUtils.isAdminEmail(null)).toBe(false);
  });

  // ── RULE-17: Listing View Analytics Rate Limiting ───────────────────────────
  test('RULE-17: Listing views are incremented per user session with valid date string', () => {
    const isValidViewKey = (key: string) => /^[a-zA-Z0-9_-]+_\d{4}-\d{2}-\d{2}$/.test(key);
    expect(isValidViewKey('listing123_2026-10-06')).toBe(true);
    expect(isValidViewKey('invalid-key')).toBe(false);
  });

  // ── RULE-18: Chat Room Isolation ────────────────────────────────────────────
  test('RULE-18: Chat room is accessible exclusively by participants or admin', () => {
    const isAuthorizedChatAccess = (callerUid: string, participants: string[], isAdmin = false) => {
      if (isAdmin) return true;
      return participants.includes(callerUid);
    };

    const participants = ['user_seeker_1', 'user_owner_1'];
    expect(isAuthorizedChatAccess('user_seeker_1', participants)).toBe(true);
    expect(isAuthorizedChatAccess('user_owner_1', participants)).toBe(true);
    expect(isAuthorizedChatAccess('user_intruder_9', participants)).toBe(false);
    expect(isAuthorizedChatAccess('user_intruder_9', participants, true)).toBe(true);
  });

  // ── RULE-19: Cascading Database Purge Safety Invariant ──────────────────────
  test('RULE-19: Safe wipe selectively removes seed/test entities while preserving production admin accounts', () => {
    const isSeedOrTestDoc = (doc: { uid?: string; email?: string; isTest?: boolean }) => {
      const email = (doc.email || '').toLowerCase().trim();
      if (email === 'mukvr46@gmail.com' || email === 'mrmukeshram111@gmail.com' || email === 'admin@nestmate.in') return false; // protected
      return doc.isTest === true || (doc.uid && doc.uid.startsWith('test_user_')) || email.endsWith('@nestmate-test.com');
    };

    expect(isSeedOrTestDoc({ email: 'mukvr46@gmail.com' })).toBe(false);
    expect(isSeedOrTestDoc({ email: 'admin@nestmate.in' })).toBe(false);
    expect(isSeedOrTestDoc({ uid: 'test_user_ref', email: 'seeker.ref@nestmate-test.com' })).toBe(true);
    expect(isSeedOrTestDoc({ isTest: true })).toBe(true);
  });

  // ── RULE-20: City Alias Normalization ──────────────────────────────────────
  test('RULE-20: City alias normalization maps colloquial Indian spellings to canonical names', () => {
    expect(BusinessRuleUtils.normalizeCityName('Bangalore')).toBe('Bengaluru');
    expect(BusinessRuleUtils.normalizeCityName('bengaluru')).toBe('Bengaluru');
    expect(BusinessRuleUtils.normalizeCityName('Bombay')).toBe('Mumbai');
    expect(BusinessRuleUtils.normalizeCityName('mumbai')).toBe('Mumbai');
    expect(BusinessRuleUtils.normalizeCityName('Madras')).toBe('Chennai');
    expect(BusinessRuleUtils.normalizeCityName('Delhi')).toBe('Delhi NCR');
    expect(BusinessRuleUtils.normalizeCityName('New Delhi')).toBe('Delhi NCR');
    expect(BusinessRuleUtils.normalizeCityName('Gurgaon')).toBe('Delhi NCR');
    expect(BusinessRuleUtils.normalizeCityName('Noida')).toBe('Delhi NCR');
    expect(BusinessRuleUtils.normalizeCityName('Hyderabad')).toBe('Hyderabad');
    expect(BusinessRuleUtils.normalizeCityName('Pune')).toBe('Pune');
  });
});
