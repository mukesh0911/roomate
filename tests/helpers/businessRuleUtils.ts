import { QuizAnswers, AccountStatus, OwnerVerificationStatus } from '../data/testTypes';

export class BusinessRuleUtils {
  // ── RULE-01: 10-Point Compatibility Score ──────────────────────────────────
  static calculateCompatibility(
    answersA?: QuizAnswers,
    answersB?: QuizAnswers,
    cityA?: string,
    cityB?: string
  ): number {
    if (!answersA || !answersB) return 0;
    const keysA = Object.keys(answersA);
    const keysB = Object.keys(answersB);
    if (keysA.length === 0 || keysB.length === 0) return 0;

    const commonKeys = [
      'sleep_time', 'wake_time', 'food_pref', 'smoking', 'drinking',
      'guests', 'cleanliness', 'work_mode', 'pets', 'roommate_gender'
    ];

    let matchCount = 0;
    let evaluated = 0;

    for (const key of commonKeys) {
      const valA = answersA[key];
      const valB = answersB[key];
      if (valA !== undefined && valB !== undefined) {
        evaluated++;
        // Strict dealbreaker: smoking mismatch between never and regular
        if (key === 'smoking' && ((valA === 'never' && valB === 'regularly') || (valA === 'regularly' && valB === 'never'))) {
          return 0; // immediate dealbreaker veto
        }
        if (valA === valB) {
          matchCount++;
        }
      }
    }

    if (evaluated === 0) return 0;
    let baseScore = Math.round((matchCount / evaluated) * 100);

    // Cross-city penalty: capped at 60% if different cities
    if (cityA && cityB && cityA.trim().toLowerCase() !== cityB.trim().toLowerCase()) {
      baseScore = Math.min(baseScore, 60);
    }

    return baseScore;
  }

  // ── RULE-03: Connection Limit & Quota ───────────────────────────────────────
  static FREE_CONNECT_LIMIT = 5;

  static isConnectionQuotaExhausted(connectsUsed: number, connectsLimit = 5, isPremium = false): boolean {
    if (isPremium) return false;
    return connectsUsed >= connectsLimit;
  }

  // ── RULE-04: Contact Unlocking Condition ───────────────────────────────────
  static canViewUnmaskedContact(
    viewerUserId: string,
    targetUserId: string,
    connectionStatus: string | null,
    isViewerAdmin = false
  ): boolean {
    if (isViewerAdmin) return true;
    if (viewerUserId === targetUserId) return true;
    return connectionStatus === 'accepted';
  }

  // ── RULE-05: 30-Day Freshness Anchor ───────────────────────────────────────
  static FRESHNESS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  static isListingFresh(lastConfirmedAt?: string | number | Date | null): boolean {
    if (!lastConfirmedAt) return false;
    const anchor = new Date(lastConfirmedAt).getTime();
    if (isNaN(anchor)) return false;
    const age = Date.now() - anchor;
    return age <= this.FRESHNESS_WINDOW_MS;
  }

  // ── RULE-06: Verification State Machine Transitions ────────────────────────
  static validVerificationTransitions: Record<OwnerVerificationStatus, OwnerVerificationStatus[]> = {
    NOT_STARTED: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED'],
    APPROVED: [],
    REJECTED: ['RESUBMISSION_REQUIRED', 'SUBMITTED'],
    RESUBMISSION_REQUIRED: ['SUBMITTED'],
  };

  static isValidVerificationTransition(
    current: OwnerVerificationStatus,
    next: OwnerVerificationStatus
  ): boolean {
    return this.validVerificationTransitions[current]?.includes(next) ?? false;
  }

  // ── RULE-09: Applicant Ranking ─────────────────────────────────────────────
  static calculateApplicantRankScore(params: {
    compatibilityScore: number; // 0-100
    profileCompleteness: number; // 0-100
    budgetAlignment: number; // 0-100
    verificationLevel: number; // 0-3
  }): number {
    const compWeight = 0.4;
    const profWeight = 0.2;
    const budWeight = 0.2;
    const verifWeight = 0.2;

    const normalizedVerif = (Math.min(params.verificationLevel, 3) / 3) * 100;

    return Math.round(
      params.compatibilityScore * compWeight +
      params.profileCompleteness * profWeight +
      params.budgetAlignment * budWeight +
      normalizedVerif * verifWeight
    );
  }

  // ── RULE-11: Listing Financial Invariants ──────────────────────────────────
  static validateFinancialInvariants(listing: {
    totalRent: number;
    partnerShare: number;
    deposit?: number;
  }): { isValid: boolean; error?: string } {
    if (listing.totalRent <= 0) {
      return { isValid: false, error: 'totalRent must be greater than 0' };
    }
    if (listing.partnerShare <= 0) {
      return { isValid: false, error: 'partnerShare must be greater than 0' };
    }
    if (listing.partnerShare > listing.totalRent) {
      return { isValid: false, error: 'partnerShare cannot exceed totalRent' };
    }
    if (listing.deposit !== undefined && listing.deposit < 0) {
      return { isValid: false, error: 'deposit cannot be negative' };
    }
    return { isValid: true };
  }

  // ── RULE-13: Self-Connection / Self-Report Prevention ──────────────────────
  static validateSelfOperation(callerUid: string, targetUid: string): boolean {
    return callerUid !== targetUid;
  }

  // ── RULE-14: Active Account Requirement ───────────────────────────────────
  static canPerformMutations(status: AccountStatus): boolean {
    return status === 'active';
  }

  // ── RULE-16: Admin Email Registry ──────────────────────────────────────────
  static readonly KNOWN_ADMIN_EMAILS = [
    'admin@nestmate-test.com',
    'admin@nestmate.in',
    'mukvr46@gmail.com',
    'mrmukeshram111@gmail.com',
  ];

  static isAdminEmail(email?: string | null): boolean {
    if (!email) return false;
    return this.KNOWN_ADMIN_EMAILS.includes(email.toLowerCase().trim());
  }

  // ── RULE-20: City Alias Normalization ──────────────────────────────────────
  static normalizeCityName(cityName?: string): string {
    if (!cityName) return '';
    const clean = cityName.trim().toLowerCase();
    const map: Record<string, string> = {
      bangalore: 'Bengaluru',
      bengaluru: 'Bengaluru',
      bombay: 'Mumbai',
      mumbai: 'Mumbai',
      madras: 'Chennai',
      chennai: 'Chennai',
      calcutta: 'Kolkata',
      kolkata: 'Kolkata',
      delhi: 'Delhi NCR',
      'delhi ncr': 'Delhi NCR',
      newdelhi: 'Delhi NCR',
      'new delhi': 'Delhi NCR',
      gurgaon: 'Delhi NCR',
      gurugram: 'Delhi NCR',
      noida: 'Delhi NCR',
      hyderabad: 'Hyderabad',
      pune: 'Pune',
    };
    return map[clean] || cityName.trim();
  }
}
