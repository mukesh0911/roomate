/**
 * Sprint 4B regression tests — client-side listing filter pipeline.
 *
 * Bug fixed this sprint: the landing-page hero collected a locality query but
 * silently discarded it; additionally, filters.localities was only honored on
 * the roommates tab (useMatches), never on the rooms tab. These tests pin the
 * corrected behavior of applyClientFilters.
 *
 * The pipeline lives in @/lib/listingFilters (pure module, no Firebase), so
 * these tests are fully hermetic.
 */
import { describe, it, expect } from 'vitest';
import { applyClientFilters, type FilterableListing } from '../lib/listingFilters';

function makeListing(overrides: Partial<FilterableListing>): FilterableListing {
    return {
        city: 'Bengaluru',
        locality: 'HSR Layout',
        partnerShare: 12000,
        totalRent: 24000,
        flatType: '2BHK',
        furnishing: 'Semi-Furnished',
        amenities: [],
        ...overrides,
    };
}

describe('applyClientFilters — Sprint 4B locality truth fixes', () => {
    const listings = [
        makeListing({ locality: 'HSR Layout' }),
        makeListing({ locality: 'Koramangala' }),
        makeListing({ city: 'Mumbai', locality: 'Bandra West' }),
    ];

    it('no filters returns the input unchanged', () => {
        expect(applyClientFilters(listings)).toEqual(listings);
        expect(applyClientFilters(listings, {})).toEqual(listings);
    });

    it('locality filter matches case-insensitively (hero search "hsr layout")', () => {
        const out = applyClientFilters(listings, { localities: ['hsr layout'] });
        expect(out.map(l => l.locality)).toEqual(['HSR Layout']);
    });

    it('locality filter matches as a substring in both directions', () => {
        // Query shorter than stored locality…
        expect(applyClientFilters(listings, { localities: ['koram'] }).map(l => l.locality)).toEqual(['Koramangala']);
        // …and query longer than a short stored locality.
        const short = [makeListing({ locality: 'HSR' })];
        expect(applyClientFilters(short, { localities: ['hsr layout, bengaluru'] }).map(l => l.locality)).toEqual(['HSR']);
    });

    it('locality filter excludes listings in other localities/cities', () => {
        expect(applyClientFilters(listings, { localities: ['Indiranagar'] })).toEqual([]);
    });

    it('empty or whitespace-only locality arrays do not filter anything', () => {
        expect(applyClientFilters(listings, { localities: [] })).toEqual(listings);
        expect(applyClientFilters(listings, { localities: ['   '] })).toEqual(listings);
    });

    it('city and locality combine (AND semantics)', () => {
        expect(applyClientFilters(listings, { city: 'Bengaluru', localities: ['bandra west'] })).toEqual([]);
        expect(applyClientFilters(listings, { city: 'bengaluru', localities: ['hsr'] }).map(l => l.locality)).toEqual(['HSR Layout']);
    });

    it('listings with missing locality never match a locality query (fail-safe)', () => {
        const partial = [makeListing({ locality: '' })];
        expect(applyClientFilters(partial, { localities: ['hsr'] })).toEqual([]);
    });

    it('budget filters still work on partnerShare/totalRent', () => {
        expect(applyClientFilters(listings, { budgetMin: 15000 })).toEqual([]);
        expect(applyClientFilters(listings, { budgetMax: 12000 }).length).toBe(3);
    });

    it('matches city using common aliases (Bengaluru <-> Bangalore, Mumbai <-> Bombay)', () => {
        // Listings with city 'Bengaluru' match a filter for 'Bangalore'
        const blrListings = [makeListing({ city: 'Bengaluru' })];
        expect(applyClientFilters(blrListings, { city: 'Bangalore' })).toHaveLength(1);
        expect(applyClientFilters(blrListings, { city: 'bengaluru' })).toHaveLength(1);

        // Listings with city 'Bangalore' match a filter for 'Bengaluru'
        const bangListings = [makeListing({ city: 'Bangalore' })];
        expect(applyClientFilters(bangListings, { city: 'Bengaluru' })).toHaveLength(1);

        // Bombay <-> Mumbai
        const bombayListing = [makeListing({ city: 'Bombay' })];
        expect(applyClientFilters(bombayListing, { city: 'Mumbai' })).toHaveLength(1);
    });
});

describe('applyClientFilters — flatType category-aware matching', () => {
    it('exact flatType match works (1BHK, 2BHK, Studio)', () => {
        const ls = [
            makeListing({ flatType: '1BHK' }),
            makeListing({ flatType: '2BHK' }),
            makeListing({ flatType: 'Studio' }),
        ];
        expect(applyClientFilters(ls, { flatType: ['1BHK'] }).map(l => l.flatType)).toEqual(['1BHK']);
        expect(applyClientFilters(ls, { flatType: ['Studio'] }).map(l => l.flatType)).toEqual(['Studio']);
    });

    it('PG filter also matches Hostel listings (same managed-accommodation category)', () => {
        const ls = [
            makeListing({ flatType: 'PG' }),
            makeListing({ flatType: 'Hostel' }),
            makeListing({ flatType: '2BHK' }),
        ];
        const result = applyClientFilters(ls, { flatType: ['PG'] });
        expect(result.map(l => l.flatType)).toEqual(expect.arrayContaining(['PG', 'Hostel']));
        expect(result).toHaveLength(2);
    });

    it('Hostel filter also matches PG listings', () => {
        const ls = [
            makeListing({ flatType: 'PG' }),
            makeListing({ flatType: 'Hostel' }),
            makeListing({ flatType: '1BHK' }),
        ];
        const result = applyClientFilters(ls, { flatType: ['Hostel'] });
        expect(result).toHaveLength(2);
        expect(result.map(l => l.flatType)).toEqual(expect.arrayContaining(['PG', 'Hostel']));
    });

    it('Coliving filter only matches Coliving listings', () => {
        const ls = [
            makeListing({ flatType: 'Coliving' }),
            makeListing({ flatType: 'PG' }),
            makeListing({ flatType: '2BHK' }),
        ];
        const result = applyClientFilters(ls, { flatType: ['Coliving'] });
        expect(result).toHaveLength(1);
        expect(result[0].flatType).toBe('Coliving');
    });

    it('Private Room filter also matches 1BHK and Studio (single-occupancy types)', () => {
        const ls = [
            makeListing({ flatType: 'Private Room' }),
            makeListing({ flatType: '1BHK' }),
            makeListing({ flatType: 'Studio' }),
            makeListing({ flatType: '2BHK' }),
        ];
        const result = applyClientFilters(ls, { flatType: ['Private Room'] });
        expect(result).toHaveLength(3);
        expect(result.map(l => l.flatType)).toEqual(expect.arrayContaining(['Private Room', '1BHK', 'Studio']));
    });

    it('Shared Room filter also matches 2BHK and 3BHK (multi-occupancy types)', () => {
        const ls = [
            makeListing({ flatType: 'Shared Room' }),
            makeListing({ flatType: '2BHK' }),
            makeListing({ flatType: '3BHK' }),
            makeListing({ flatType: 'Studio' }),
        ];
        const result = applyClientFilters(ls, { flatType: ['Shared Room'] });
        expect(result).toHaveLength(3);
        expect(result.map(l => l.flatType)).toEqual(expect.arrayContaining(['Shared Room', '2BHK', '3BHK']));
    });

    it('multiple flatType categories work together (OR semantics)', () => {
        const ls = [
            makeListing({ flatType: 'PG' }),
            makeListing({ flatType: 'Coliving' }),
            makeListing({ flatType: '2BHK' }),
        ];
        // Landing: PGs & Hostels + Coliving combined
        const result = applyClientFilters(ls, { flatType: ['PG', 'Coliving'] });
        expect(result).toHaveLength(2);
    });

    it('case-insensitive normalization: "pg" matches "PG"', () => {
        const ls = [makeListing({ flatType: 'PG' })];
        expect(applyClientFilters(ls, { flatType: ['pg'] })).toHaveLength(1);
    });

    it('whitespace normalization: "1 BHK" matches listing flatType "1BHK"', () => {
        const ls = [makeListing({ flatType: '1BHK' })];
        // Filter with extra space like the old bad landing filter '1 BHK'
        expect(applyClientFilters(ls, { flatType: ['1 BHK'] })).toHaveLength(1);
    });

    it('no flatType filter returns all listings', () => {
        const ls = [
            makeListing({ flatType: 'PG' }),
            makeListing({ flatType: '1BHK' }),
            makeListing({ flatType: 'Coliving' }),
        ];
        expect(applyClientFilters(ls, { flatType: [] })).toHaveLength(3);
        expect(applyClientFilters(ls, {})).toHaveLength(3);
    });
});
