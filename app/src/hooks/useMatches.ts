import { useCallback } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  doc,
  getDoc,
  limit,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from './useAuth';
import { useState, useRef } from 'react';
import { sanitizePublicProfile } from '@/lib/sanitizeProfile';
import { calculateCompatibility, calculateProfileCompatibility, calculateRoomCompatibility, getRoomMatchReasons } from '@/lib/matching';
import { isDiscoverable } from '@/lib/listingFreshness';
import { isAccountActive } from '@/lib/accountStatus';
import { isDemoProfile } from '@/lib/demoUsers';
import { isPubliclyVisibleProfile, isPubliclyVisibleListing } from '@/lib/marketplaceVisibility';
import { areSameCityAlias, getCityQueryValues } from '@/lib/cityNormalization';
import { isRoommateDiscoverable } from '@/lib/profileEligibility';

export { calculateCompatibility, calculateProfileCompatibility, calculateRoomCompatibility, getRoomMatchReasons, getActiveStatus } from '@/lib/matching';

export interface Match {
  id: string;
  userId: string;
  matchedUserId: string;
  compatibilityScore: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}

export interface MatchedUser {
  profile: UserProfile;
  compatibilityScore: number;
  matchId?: string;
  listingId?: string;
  matchReasons?: string[];
  matchCaveats?: string[];
}

export function useMatches() {
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  /**
   * Find potential matches for a seeker.
   * Queries users in the same city, computes compatibility, sorts by score.
   */
  const findMatches = useCallback(
    async function findMatchesImpl(
      currentUser: UserProfile,
      uiCity?: string,
      filters?: any,
      isLoadMore = false,
      // Sprint 2E: cross-city expansion is EXPLICIT — the caller is notified
      // whenever a city-scoped search returned nothing and we widened it.
      onCrossCityFallback?: (requestedCity: string) => void
    ): Promise<MatchedUser[]> {
      const targetCity = uiCity !== undefined ? uiCity : currentUser.city;

      const constraints: any[] = [where('onboardingComplete', '==', true)];
      if (targetCity) {
        const cityValues = getCityQueryValues(targetCity);
        constraints.push(cityValues.length > 1
          ? where('city', 'in', cityValues)
          : where('city', '==', cityValues[0]));
      }

      // Role is legacy account metadata, not a roommate-discovery gate.
      // Keep the optional filters argument for call-site compatibility.
      void filters;

      const skippedIds = new Set(currentUser.skippedUserIds || []);
      const blockedIds = new Set(currentUser.blockedUserIds || []);

      if (isLoadMore && lastDocRef.current) {
        constraints.push(startAfter(lastDocRef.current));
      } else if (!isLoadMore) {
        lastDocRef.current = null;
      }
      constraints.push(limit(20));

      let candidateDocs: UserProfile[] = [];
      let constrainedQueryFailed = false;
      try {
        const q = query(collection(db, 'users'), ...constraints);
        const snap = await getDocs(q);

        const newLastDoc = snap.docs[snap.docs.length - 1];
        lastDocRef.current = newLastDoc || null;

        if (!isLoadMore) {
          setPage(1);
        } else {
          setPage(p => p + 1);
        }
        setHasMore(snap.docs.length === 20);

        candidateDocs = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      } catch (err) {
        constrainedQueryFailed = true;
        console.warn('Constrained findMatches query failed, using unconstrained fallback:', err);
      }

      // Full scans are a last-resort compatibility path for a missing index or
      // transient query failure. A valid empty result must remain empty so the
      // explicit cross-city fallback below can notify the UI.
      if (constrainedQueryFailed && !isLoadMore) {
        try {
          const rawSnap = await getDocs(collection(db, 'users'));
          candidateDocs = rawSnap.docs
            .map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
            .filter((u) => {
              if (u.onboardingComplete !== true) return false;
              if (targetCity) {
                const candidateCity = (u.city || '').trim().toLowerCase();
                const requestedCity = targetCity.trim().toLowerCase();
                if (!areSameCityAlias(candidateCity, requestedCity)) return false;
              }
              return true;
            });
        } catch (err) {
          console.error('Fallback findMatches query failed:', err);
        }
      }

      // Sprint 2C (M2): suspended/banned accounts are never eligible candidates.
      // Sprint 2E (P0): demo accounts (fabricated profiles) are never eligible either.
      const candidates = candidateDocs.filter((u) =>
        u.uid !== currentUser.uid
        && !skippedIds.has(u.uid || '')
        && !blockedIds.has(u.uid || '')
        && isAccountActive((u as any).status)
        && !isDemoProfile(u as any)
        && isRoommateDiscoverable(u)
      );

      // Listings only enrich people who are already roommate-discoverable.
      // Owning a listing must not inject someone into this directory.
      const listingMap = new Map<string, any>();
      const includeListingOwners = false;
      {

        const lqConstraints: any[] = [where('status', '==', 'active')];
        if (targetCity) {
          const cityValues = getCityQueryValues(targetCity);
          lqConstraints.push(cityValues.length > 1
            ? where('city', 'in', cityValues)
            : where('city', '==', cityValues[0]));
        }
        try {
          const lsnap = await getDocs(query(collection(db, 'listings'), ...lqConstraints));
          const existingOwnerIds = new Set(candidates.map(candidate => candidate.uid));
          for (const d of lsnap.docs) {
            const ldata = { id: d.id, ...d.data() } as any;
            const ownerId = ldata.ownerId;
            if (!ownerId) continue;
            // Sprint 2C (M1) + Security Gate: unverified/pending or expired/closed/paused
            // listings must never appear as matches.
            if (!isPubliclyVisibleListing(ldata)) continue;

            if (candidates.some(candidate => candidate.uid === ownerId)) {
              listingMap.set(ownerId, ldata);
            }

            // If this owner is not already in candidates array, fetch or generate their profile
            if (includeListingOwners) { // Retained only for a later legacy-code cleanup.
              existingOwnerIds.add(ownerId);
              try {
                const ownerSnap = await getDoc(doc(db, 'users', ownerId));
                if (ownerSnap.exists()) {
                  const ownerData = { uid: ownerSnap.id, ...ownerSnap.data() } as UserProfile;
                  // Sprint 2E hardening: non-public owners (demo/suspended/
                  // incomplete) never surface as matches.
                  if (!isPubliclyVisibleProfile(ownerData as any)) continue;
                  candidates.push(ownerData);
                } else {
                  // Sprint 2E hardening — ORPHAN POLICY: the owner document no
                  // longer exists. HIDE the listing from matching; we never
                  // fabricate an owner identity from listing metadata.
                  continue;
                }
              } catch (err) {
                console.warn('Failed to fetch owner profile for listing:', ownerId, err);
              }
            }
          }
        } catch (err) {
          console.warn('Listing pre-fetch failed:', err);
        }
      }

      // NOTE: No fake/fallback profiles are injected when there are no real
      // candidates. An empty result is rendered as an empty state by the UI —
      // the production marketplace must never display fabricated users.
      let scored: MatchedUser[] = candidates.map((u) => {
        const listingData = listingMap.get(u.uid || '');
        const profileToUse = { ...u };

        // Patch owner profile with listing data so filters and UI work correctly
        if (listingData) {
          if (!profileToUse.localities || profileToUse.localities.length === 0) {
            profileToUse.localities = [listingData.locality];
          }
          // Prioritize listing's partnerShare or totalRent for seeker match filtering
          profileToUse.budget = listingData.partnerShare || listingData.totalRent || profileToUse.budget;
          if (!profileToUse.moveInDate) {
            profileToUse.moveInDate = listingData.availableFrom;
          }
          // Attach extra listing data for filtering purposes
          (profileToUse as any)._listing = listingData;
        }

        const compatibilityScore = calculateProfileCompatibility(currentUser, u, listingData).score;

        return {
          profile: sanitizePublicProfile(profileToUse as unknown as Record<string, unknown>) as unknown as UserProfile,
          listingId: listingData?.id,
          compatibilityScore,
        };
      });

      // Apply Filters if provided
      if (filters) {
        scored = scored.filter(match => {
          const p = match.profile;
          const listing = (p as any)._listing;

          // Verified Only
          if (filters.verifiedOnly && !p.isVerified) return false;

          // Gender
          if (filters.gender && filters.gender !== 'any') {
            if (p.gender?.toLowerCase() !== filters.gender) return false;
          }

          // Budget
          const budget = p.budget || 0;
          if (budget > 0) {
            if (filters.budgetMin && budget < filters.budgetMin) return false;
            if (filters.budgetMax && budget > filters.budgetMax) return false;
          }

          // Localities
          if (filters.localities && filters.localities.length > 0) {
            const hasMatch = filters.localities.some((loc: string) =>
              p.localities?.includes(loc) || listing?.locality === loc
            );
            if (!hasMatch) return false;
          }

          // Flat Type (only applies if they have a listing)
          if (filters.flatType && filters.flatType.length > 0) {
            if (!listing || !filters.flatType.includes(listing.flatType)) return false;
          }

          // Furnishing (only applies if they have a listing)
          if (filters.furnishing && filters.furnishing.length > 0) {
            if (!listing || !filters.furnishing.includes(listing.furnishing)) return false;
          }

          // Amenities (must have ALL selected amenities)
          if (filters.amenities && filters.amenities.length > 0) {
            if (!listing || !listing.amenities) return false;
            const hasAll = filters.amenities.every((a: string) => listing.amenities.includes(a));
            if (!hasAll) return false;
          }

          return true;
        });
      }

      if (scored.length === 0 && targetCity && !isLoadMore) {
        // Sprint 2E: the user's explicit city search found nothing. We widen to
        // other cities ONLY while telling the caller, so the UI can display:
        // "No matches in {city} yet — showing relevant people from other cities."
        onCrossCityFallback?.(targetCity);
        return findMatchesImpl(currentUser, '', filters ? { ...filters, city: '' } : undefined, false);
      }

      // Sort by compatibility score first (primary), then Premium/Verified as tiebreakers.
      // A 0% Premium user must never outrank a 90% non-Premium user.
      return scored.sort((a, b) => {
        // Primary: compatibility score (highest first)
        if (b.compatibilityScore !== a.compatibilityScore) {
          return b.compatibilityScore - a.compatibilityScore;
        }
        // Tiebreaker 1: Premium
        const aPrem = a.profile.isPremium ? 1 : 0;
        const bPrem = b.profile.isPremium ? 1 : 0;
        if (aPrem !== bPrem) return bPrem - aPrem;
        // Tiebreaker 2: Verified
        const aVer = a.profile.isVerified ? 1 : 0;
        const bVer = b.profile.isVerified ? 1 : 0;
        return bVer - aVer;
      });
    },
    []
  );

  const createMatch = useCallback(
    async (userId: string, matchedUserId: string, score: number): Promise<string> => {
      const docRef = await addDoc(collection(db, 'matches'), {
        userId,
        matchedUserId,
        compatibilityScore: score,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    },
    []
  );

  const getMatches = useCallback(async (userId: string): Promise<Match[]> => {
    // Firestore doesn't support OR queries; merge two queries
    const [q1, q2] = await Promise.all([
      getDocs(query(collection(db, 'matches'), where('userId', '==', userId), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'matches'), where('matchedUserId', '==', userId), orderBy('createdAt', 'desc'))),
    ]);
    const all = [...q1.docs, ...q2.docs].map((d) => ({ id: d.id, ...d.data() } as Match));
    // Deduplicate (shouldn't happen, but safety)
    const seen = new Set<string>();
    return all.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, []);

  const getMatchedUserProfiles = useCallback(
    async (userId: string): Promise<MatchedUser[]> => {
      const matches = await getMatches(userId);
      const profiles = await Promise.all(
        matches.map(async (m) => {
          const otherId = m.userId === userId ? m.matchedUserId : m.userId;
          const snap = await getDoc(doc(db, 'users', otherId));
          if (!snap.exists()) return null;
          return {
            profile: snap.data() as UserProfile,
            compatibilityScore: m.compatibilityScore,
            matchId: m.id,
          } as MatchedUser;
        })
      );
      return profiles.filter(Boolean) as MatchedUser[];
    },
    [getMatches]
  );

  const skipUser = useCallback(async (userId: string, skippedUserId: string) => {
    await addDoc(collection(db, 'skippedUsers'), {
      userId,
      skippedUserId,
      createdAt: serverTimestamp()
    });
  }, []);

  const getProfilesByIds = useCallback(
    async (currentUser: UserProfile, uids: string[]): Promise<MatchedUser[]> => {
      if (!uids || uids.length === 0) return [];

      const profiles = await Promise.all(
        uids.map(async (id) => {
          try {
            let user: UserProfile | null = null;
            const snap = await getDoc(doc(db, 'users', id));
            if (snap.exists()) {
              user = sanitizePublicProfile({ uid: snap.id, ...snap.data() }) as unknown as UserProfile;
            }

            if (!user) return null;

            let listingId: string | undefined;
            let listingData: any;
            if (user.role === 'owner') {
              try {
                const lq = query(collection(db, 'listings'), where('ownerId', '==', user.uid));
                const lsnap = await getDocs(lq);
                if (!lsnap.empty) {
                  const activeDoc = lsnap.docs.find(d => isPubliclyVisibleListing({ id: d.id, ...d.data() }));
                  if (!activeDoc) return null;
                  listingId = activeDoc.id;
                  listingData = { id: listingId, ...activeDoc.data() };
                }
              } catch (e) {
                console.warn('Could not query listings for owner', user.uid, e);
              }
            }

            if (listingData) {
              (user as any)._listing = listingData;
            }

            const compatibilityScore = calculateProfileCompatibility(currentUser, user, listingData).score;

            return {
              profile: user,
              listingId,
              compatibilityScore,
            } as MatchedUser;
          } catch (err) {
            console.error('Error fetching profile for id', id, err);
            return null;
          }
        })
      );
      return profiles.filter(Boolean) as MatchedUser[];
    },
    []
  );

  return {
    findMatches,
    createMatch,
    getMatches,
    getMatchedUserProfiles,
    calculateCompatibility,
    skipUser,
    getProfilesByIds,
    page,
    hasMore,
  };
}
