import { describe, it, expect } from 'vitest';
import { evaluateApplicantFit, rankApplicants } from './applicantRanking';

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

const ownerAnswers = { smoking: '1', pets: '2', sleep: '2', guests: '1', cleanliness: '1' };
const listing = { city: 'Chennai', locality: 'OMR', partnerShare: 12000 };

describe('evaluateApplicantFit — signals are data-backed only', () => {
    it('gives reasons for a genuinely strong applicant', () => {
        const fit = evaluateApplicantFit(ownerAnswers, {
            city: 'Chennai',
            locality: 'OMR',
            budget: 11500,
            quizAnswers: { smoking: '1', pets: '2', sleep: '2', guests: '1', cleanliness: '1' },
            onboardingComplete: true,
        }, { listing });
        expect(fit.score).toBe(100);
        expect(fit.reasons).toContain('Same city (Chennai)');
        expect(fit.reasons).toContain('Same locality (OMR)');
        expect(fit.reasons.some(r => r.startsWith('Budget fits'))).toBe(true);
        expect(fit.reasons.some(r => r.includes('lifestyle preference'))).toBe(true);
    });

    it('caps cross-city scores and states the mismatch as a caveat', () => {
        const fit = evaluateApplicantFit(ownerAnswers, {
            city: 'Hyderabad',
            budget: 12000,
            quizAnswers: ownerAnswers,
            onboardingComplete: true,
        }, { listing });
        expect(fit.score).toBeLessThanOrEqual(60);
        expect(fit.caveats).toContain('Different city from your room');
    });

    it('flags budget mismatch honestly', () => {
        const fit = evaluateApplicantFit(ownerAnswers, {
            city: 'Chennai', budget: 5000, quizAnswers: ownerAnswers, onboardingComplete: true,
        }, { listing });
        expect(fit.caveats.some(c => c.includes('differs from rent'))).toBe(true);
    });

    it('states missing data instead of inventing signal', () => {
        const fit = evaluateApplicantFit(ownerAnswers, {}, { listing });
        expect(fit.score).toBe(0);
        expect(fit.reasons).toHaveLength(0);
        expect(fit.caveats).toContain('Budget not fully specified');
        expect(fit.caveats).toContain('No overlapping lifestyle answers yet');
        expect(fit.caveats).toContain('Profile incomplete — limited signal');
    });

    it('shows trust reasons ONLY from real verification fields', () => {
        const base = { city: 'Chennai', budget: 12000, quizAnswers: ownerAnswers, onboardingComplete: true };
        const none = evaluateApplicantFit(ownerAnswers, { ...base }, { listing });
        expect(none.reasons.some(r => r.includes('verified'))).toBe(false);

        const verified = evaluateApplicantFit(ownerAnswers, {
            ...base, workEmailVerified: true, isVerified: true,
        }, { listing });
        expect(verified.reasons).toContain('Work email verified');
        expect(verified.reasons).toContain('ID verified');
    });

    it('adds a recency caveat for week-old requests without changing the score', () => {
        const base = { city: 'Chennai', budget: 12000, quizAnswers: ownerAnswers, onboardingComplete: true };
        const fresh = evaluateApplicantFit(ownerAnswers, base, { listing, requestedAtMs: NOW - 1 * DAY_MS, now: NOW });
        const old = evaluateApplicantFit(ownerAnswers, base, { listing, requestedAtMs: NOW - 9 * DAY_MS, now: NOW });
        expect(old.score).toBe(fresh.score);
        expect(old.caveats).toContain('Requested over a week ago');
        expect(fresh.caveats).not.toContain('Requested over a week ago');
    });
});

describe('rankApplicants — ordering + stability', () => {
    const mk = (uid: string, overrides: Record<string, unknown> = {}) => ({
        connection: { id: uid },
        profile: { uid, city: 'Chennai', budget: 12000, quizAnswers: ownerAnswers, onboardingComplete: true, ...overrides },
    });

    it('ranks higher-compatibility applicants first', () => {
        const strong = mk('strong');
        const weak = mk('weak', { quizAnswers: {} });
        const ranked = rankApplicants([weak, strong], (a) =>
            evaluateApplicantFit(ownerAnswers, a.profile as any, { listing })
        );
        expect(ranked[0].profile.uid).toBe('strong');
        expect(ranked[0].fit.score).toBeGreaterThanOrEqual(ranked[1].fit.score);
    });

    it('preserves chronological order for ties (stable sort)', () => {
        const a = mk('older-first');
        const b = mk('newer-second');
        const ranked = rankApplicants([a, b], (x) =>
            evaluateApplicantFit(ownerAnswers, x.profile as any, { listing })
        );
        expect(ranked.map(r => r.profile.uid)).toEqual(['older-first', 'newer-second']);
    });

    it('returns an empty array for an empty inbox', () => {
        expect(rankApplicants([], () => ({ score: 0, reasons: [], caveats: [] }))).toEqual([]);
    });

    it('does not mutate the input array', () => {
        const input = [mk('a'), mk('b', { quizAnswers: {} })];
        const snapshot = [...input];
        rankApplicants(input, (x) => evaluateApplicantFit(ownerAnswers, x.profile as any, { listing }));
        expect(input).toEqual(snapshot);
    });

    it('ranks applicants accurately when owner has no quiz answers (landlord mode)', () => {
        const emptyOwnerAnswers = {};
        const bangaloreListing = {
            city: 'Bengaluru',
            locality: 'Koramangala',
            partnerShare: 15000,
            totalRent: 15000,
        };

        const topApplicant = {
            uid: 'top',
            city: 'Bengaluru',
            locality: 'Koramangala',
            budget: 15000,
            isVerified: true,
            workEmailVerified: true,
            quizAnswers: { food_pref: 'veg', smoking: 'never' },
            onboardingComplete: true,
        };

        const lowApplicant = {
            uid: 'low',
            city: 'Hyderabad', // cross-city
            budget: 6000, // big budget gap
            isVerified: false,
            quizAnswers: {},
            onboardingComplete: false,
        };

        const ranked = rankApplicants(
            [{ profile: lowApplicant }, { profile: topApplicant }],
            (item) => evaluateApplicantFit(emptyOwnerAnswers, item.profile as any, { listing: bangaloreListing })
        );

        expect(ranked[0].profile.uid).toBe('top');
        expect(ranked[0].fit.score).toBe(45); // Only budget and location have comparable data.
        expect(ranked[0].fit.reasons.some(r => r.includes('Same locality'))).toBe(true);
        expect(ranked[0].fit.reasons.some(r => r.includes('Budget fits'))).toBe(true);
        expect(ranked[1].profile.uid).toBe('low');
        expect(ranked[1].fit.score).toBeLessThanOrEqual(40);
        expect(ranked[1].fit.caveats.some(c => c.includes('Different city'))).toBe(true);
    });
});