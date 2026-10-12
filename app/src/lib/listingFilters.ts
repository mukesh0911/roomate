/**
 * Sprint 4B — pure client-side listing filter pipeline.
 *
 * Extracted from useListings.ts so the filtering logic is unit-testable
 * without Firebase. The rooms tab (useListings) and the roommates tab
 * (useMatches) must honor the same locality filter semantics.
 */

import { areSameCityAlias } from './cityNormalization';

export interface ListingFilters {
    city?: string;
    /** Sprint 4B: locality search from the landing hero / dashboard filters.
     *  Case-insensitive substring match on listing.locality. */
    localities?: string[];
    budgetMin?: number;
    budgetMax?: number;
    flatType?: string[];
    furnishing?: string[];
    amenities?: string[];
}

/** Minimal structural shape the filters need (avoids importing Firebase types). */
export interface FilterableListing {
    id?: string;
    city?: string;
    locality?: string;
    partnerShare?: number;
    totalRent?: number;
    flatType?: string;
    furnishing?: string;
    amenities?: string[];
    /** Optional text fields used as secondary match source for PG/Coliving queries */
    title?: string;
    description?: string;
}

/**
 * Normalize a flatType string for comparison:
 * trims whitespace, collapses internal spaces, lowercases.
 * e.g. '1 BHK' → '1bhk', 'PG' → 'pg'.
 */
function normFlatType(s: string): string {
    return s.toLowerCase().replace(/\s+/g, '');
}

/**
 * Category-aware flatType matching.
 *
 * The landing page uses semantic categories ('Private Room', 'PG', 'Coliving').
 * Owner onboarding may store BHK variants ('1BHK', '2BHK', 'PG', etc.).
 * This function accepts a filter set and a listing flatType and returns true
 * if any semantic mapping covers the listing.
 *
 * Mapping logic:
 *  - 'Private Room' covers: Private Room, 1BHK, Studio (single-occupancy types)
 *  - 'Shared Room'  covers: Shared Room, 2BHK, 3BHK (multi-occupancy sharing)
 *  - 'PG'           covers: PG, Hostel (managed accommodation category)
 *  - 'Hostel'       covers: Hostel, PG (same category)
 *  - 'Coliving'     covers: Coliving only
 *  - All other types (1BHK, 2BHK, 3BHK, Studio) match exactly after normalization.
 */
function flatTypeMatches(filterTypes: string[], listingFlatType: string): boolean {
    const listingNorm = normFlatType(listingFlatType);

    for (const ft of filterTypes) {
        const ftNorm = normFlatType(ft);

        // Direct exact match (catches '1BHK', '2BHK', 'Studio', 'PG', 'Coliving', etc.)
        if (ftNorm === listingNorm) return true;

        // 'Private Room' filter → also matches single-occupancy flat types
        if (ftNorm === 'privateroom') {
            if (['1bhk', 'studio', 'privateroom'].includes(listingNorm)) return true;
        }

        // 'Shared Room' filter → also matches multi-occupancy flat types
        if (ftNorm === 'sharedroom') {
            if (['2bhk', '3bhk', 'sharedroom'].includes(listingNorm)) return true;
        }

        // 'PG' filter → also matches Hostel (same managed-accommodation category)
        if (ftNorm === 'pg') {
            if (['pg', 'hostel'].includes(listingNorm)) return true;
        }

        // 'Hostel' filter → also matches PG
        if (ftNorm === 'hostel') {
            if (['hostel', 'pg'].includes(listingNorm)) return true;
        }
    }

    return false;
}

export function applyClientFilters<T extends FilterableListing>(
    results: T[],
    filters?: ListingFilters
): T[] {
    if (!filters) return results;
    let out = results;
    if (filters.city) {
        const target = filters.city.toLowerCase().trim();
        out = out.filter(l => {
            const lc = (l.city || '').toLowerCase().trim();
            return lc === target || lc.includes(target) || areSameCityAlias(lc, target);
        });
    }
    // Sprint 4B (truth): honor the locality query on the rooms tab too —
    // previously only the roommates tab (useMatches) applied filters.localities,
    // so a hero-search locality was silently ignored for rooms.
    if (filters.localities && filters.localities.length > 0) {
        const targets = filters.localities.map(loc => loc.toLowerCase().trim()).filter(Boolean);
        if (targets.length > 0) {
            out = out.filter(l => {
                // Fail-safe: a listing with no locality must never match a
                // locality query (an empty string is a substring of anything).
                const listingLocality = (l.locality || '').toLowerCase().trim();
                if (!listingLocality) return false;
                return targets.some(t => listingLocality.includes(t) || t.includes(listingLocality));
            });
        }
    }
    if (filters.budgetMin !== undefined) {
        out = out.filter(l => (l.partnerShare || l.totalRent || 0) >= (filters.budgetMin ?? 0));
    }
    if (filters.budgetMax !== undefined) {
        out = out.filter(l => (l.partnerShare || l.totalRent || 0) <= (filters.budgetMax ?? Infinity));
    }
    if (filters.flatType?.length) {
        out = out.filter(l => flatTypeMatches(filters.flatType!, l.flatType || ''));
    }
    if (filters.furnishing?.length) {
        out = out.filter(l => filters.furnishing!.includes(l.furnishing || ''));
    }
    if (filters.amenities?.length) {
        out = out.filter(l => filters.amenities!.every(a => l.amenities?.includes(a)));
    }
    return out;
}