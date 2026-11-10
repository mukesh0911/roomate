import { describe, it, expect } from 'vitest';
import { validateReview, REVIEW_TEXT_MAX } from './reviewValidation';
import { mapFirestoreUser } from './nestmateBackend';
import { resolveUserHousingIntent } from './userIntent';
describe('active trust and discovery signals', () => {
 it('does not infer government verification from supplied documents or phone providers', () => {
  expect(mapFirestoreUser({documentPath:'private',phone:'+10000000000',verificationLevel:3}).isVerified).toBe(0);
  expect(mapFirestoreUser({isVerified:'yes'}).isVerified).toBe(0);
 });
 it('does not convert find-room alone into team-up or infer a resident from account role', () => {
  expect(resolveUserHousingIntent({uid:'u',housingIntent:'find_room'}).isTeamUpSeeker).toBe(false);
  expect(resolveUserHousingIntent({uid:'u',role:'owner'}).isLiveInHost).toBe(false);
 });
});
describe('review/vouch integrity (T3/T6)', () => {
    const auth = 'user-a';

    it('accepts a valid vouch from the signed-in user about someone else', () => {
        expect(validateReview(
            { reviewerId: auth, targetUserId: 'user-b', rating: 5, text: 'Great roommate' },
            auth
        )).toEqual({ ok: true });
    });

    it('rejects spoofed reviewer identity', () => {
        const r = validateReview(
            { reviewerId: 'someone-else', targetUserId: 'user-b', rating: 5 },
            auth
        );
        expect(r.ok).toBe(false);
    });

    it('rejects self-reviews', () => {
        const r = validateReview({ reviewerId: auth, targetUserId: auth, rating: 5 }, auth);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).toMatch(/own profile/i);
    });

    it('rejects unauthenticated submissions', () => {
        expect(validateReview(
            { reviewerId: auth, targetUserId: 'b', rating: 4 },
            null
        ).ok).toBe(false);
    });

    it('rejects out-of-range and non-integer ratings', () => {
        for (const rating of [0, 6, -1, 3.5, NaN]) {
            expect(validateReview({ reviewerId: auth, targetUserId: 'b', rating }, auth).ok).toBe(false);
        }
    });

    it('rejects over-long text', () => {
        const r = validateReview(
            { reviewerId: auth, targetUserId: 'b', rating: 4, text: 'x'.repeat(REVIEW_TEXT_MAX + 1) },
            auth
        );
        expect(r.ok).toBe(false);
    });

    it('rejects missing target', () => {
        expect(validateReview({ reviewerId: auth, targetUserId: '', rating: 4 }, auth).ok).toBe(false);
    });
});

