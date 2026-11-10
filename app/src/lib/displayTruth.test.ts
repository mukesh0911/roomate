/**
 * Sprint 4A — Truthfulness regression tests.
 *
 * Guards the "never fabricate user-facing data" contract:
 *   1. Missing listing images never produce fake images
 *   2. Missing property facts never produce invented values
 *   3. Missing owner quiz never produces a compatibility score
 *   4. Unverified users are never treated as verified by the trust model
 *   5. Missing seeker budget never becomes ₹10,000
 *   6. Missing budget never becomes a fabricated 50% overlap
 *   7. Insufficient match data never produces a fabricated explanation
 *   8. Unsupported global marketing claims stay removed
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    hasRealListingImages,
    getListingPhotos,
    formatDepositINR,
    formatBudgetINR,
    hasOwnerPreferences,
    budgetOverlapPct,
} from './displayTruth';
import { calculateCompatibility, getMatchReasons } from './matching';
// NOTE: relative imports — the root vitest runner does not resolve the '@/' alias.
import { mapFirestoreUser } from './nestmateBackend';

// ── 1. Missing listing images ────────────────────────────────────────────────
describe('listing photos (truth)', () => {
    it('missing images array yields NO photos and hasRealPhotos=false', () => {
        const r = getListingPhotos(undefined);
        expect(r.photos).toEqual([]);
        expect(r.hasRealPhotos).toBe(false);
        expect(hasRealListingImages(undefined)).toBe(false);
    });

    it('empty images array yields NO photos', () => {
        const r = getListingPhotos([]);
        expect(r.photos).toEqual([]);
        expect(r.hasRealPhotos).toBe(false);
    });

    it('malformed entries (nulls/blanks) are filtered out', () => {
        const r = getListingPhotos([null as unknown as string, '', '  ', 'https://real.example/a.jpg']);
        expect(r.photos).toEqual(['https://real.example/a.jpg']);
        expect(r.hasRealPhotos).toBe(true);
    });

    it('real images pass through unchanged', () => {
        const imgs = ['https://a/1.jpg', 'https://a/2.jpg'];
        expect(getListingPhotos(imgs)).toEqual({ photos: imgs, hasRealPhotos: true });
    });
});

// ── 2. Missing property facts / deposit ──────────────────────────────────────
describe('deposit formatting (truth)', () => {
    it('missing deposit renders "Not specified" — never an estimate', () => {
        expect(formatDepositINR(undefined)).toBe('Not specified');
        expect(formatDepositINR(null)).toBe('Not specified');
        expect(formatDepositINR(0)).toBe('Not specified');
    });
    it('malformed deposit renders neutral state', () => {
        expect(formatDepositINR(NaN)).toBe('Not specified');
    });
    it('real deposit renders the real value', () => {
        expect(formatDepositINR(12000)).toBe('₹12,000');
    });
});

// ── 3. Missing owner quiz → NO compatibility score ───────────────────────────
describe('owner preferences gate (truth)', () => {
    it('missing/empty owner quiz reports no preferences', () => {
        expect(hasOwnerPreferences(undefined)).toBe(false);
        expect(hasOwnerPreferences(null)).toBe(false);
        expect(hasOwnerPreferences({})).toBe(false);
    });
    it('real quiz answers report preferences present', () => {
        expect(hasOwnerPreferences({ q1: '1' })).toBe(true);
    });
    it('compatibility engine itself yields 0 against empty answers (unchanged algorithm)', () => {
        // The engine is NOT modified; callers must simply not invoke/display it
        // when hasOwnerPreferences() is false. This asserts the honest baseline.
        expect(calculateCompatibility({ q1: '1', q2: '2' }, {})).toBe(0);
    });
});

// ── 4. Trust model: unverified stays unverified ──────────────────────────────
describe('active manual identity display (truth)', () => {
  it('requires the real approval flag, not level, upload, name or completeness', () => {
    expect(mapFirestoreUser({isVerified:false,verificationLevel:3}).isVerified).toBe(0);
    expect(mapFirestoreUser({documentPath:'private',name:'Complete profile'}).isVerified).toBe(0);
    expect(mapFirestoreUser({isVerified:true,verificationLevel:2}).isVerified).toBe(1);
  });
});

describe('budget formatting (truth)', () => {
    it('missing budget renders "Budget not provided" — never ₹10,000', () => {
        expect(formatBudgetINR(undefined)).toBe('Budget not provided');
        expect(formatBudgetINR(null)).toBe('Budget not provided');
        expect(formatBudgetINR(0)).toBe('Budget not provided');
        expect(formatBudgetINR(NaN)).toBe('Budget not provided');
    });
    it('real budget renders the real value', () => {
        expect(formatBudgetINR(14500)).toBe('₹14,500');
    });
});

// ── 6. Budget overlap requires two real budgets ──────────────────────────────
describe('budget overlap (truth)', () => {
    it('missing either budget yields null — never a fabricated 50%', () => {
        expect(budgetOverlapPct(undefined, 10000)).toBeNull();
        expect(budgetOverlapPct(10000, undefined)).toBeNull();
        expect(budgetOverlapPct(0, 0)).toBeNull();
        expect(budgetOverlapPct(null, null)).toBeNull();
    });
    it('identical real budgets yield 100%', () => {
        expect(budgetOverlapPct(12000, 12000)).toBe(100);
    });
    it('divergent real budgets yield a truthful low value', () => {
        expect(budgetOverlapPct(10000, 20000)).toBe(50);
    });
});

// ── 7. Insufficient match data → no fabricated explanation ───────────────────
describe('match explanation sufficiency (truth)', () => {
    it('no overlapping data produces ZERO reasons (neutral state required)', () => {
        const why = getMatchReasons({}, {}, {});
        expect(why.reasons).toEqual([]);
        expect(why.caveats.length).toBeGreaterThan(0);
    });
    it('missing budgets/cities produce caveats, not invented reasons', () => {
        const why = getMatchReasons(
            { sleep_time: 'before_10' },
            { food_pref: 'veg' },
            {}
        );
        expect(why.reasons).toEqual([]);
        expect(why.caveats).toContain('Location not fully specified');
        expect(why.caveats).toContain('Budget not fully specified');
    });
});

// ── 8. Global claims stay truthful ───────────────────────────────────────────
describe('index.html global claims (truth)', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

    it('does NOT claim AI-powered matching', () => {
        expect(html).not.toMatch(/AI-powered/i);
    });
    it('does NOT claim verified profiles', () => {
        expect(html.toLowerCase()).not.toContain('verified profiles');
    });
    it('does NOT claim digital agreements (feature not shipped)', () => {
        expect(html.toLowerCase()).not.toContain('digital agreements');
    });
});