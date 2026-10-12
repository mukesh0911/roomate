import { useState, useCallback, useRef } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
  startAfter,
  DocumentSnapshot,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isDiscoverable } from '@/lib/listingFreshness';
import { isPubliclyVisibleListing } from '@/lib/marketplaceVisibility';
// Sprint 4B: filter pipeline extracted to a pure, unit-testable module.
import { applyClientFilters, type ListingFilters } from '@/lib/listingFilters';
import { getCityQueryValues } from '@/lib/cityNormalization';
import { useAnalytics } from './useAnalytics';
import { getAuth } from 'firebase/auth';
import { startTrace, endTrace } from '@/lib/perfTrace';

/**
 * Local calendar date string YYYY-MM-DD.
 * Prevents UTC timezone drift near midnight.
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface WeeklyViewItem {
  day: string;
  date: string;
  views: number;
  isToday: boolean;
}

export interface Listing {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar: string;
  title: string;
  description: string;
  flatType: string;
  furnishing: string;
  city: string;
  locality: string;
  address: string;
  totalRent: number;
  partnerShare: number;
  partnersNeeded: number;
  deposit: number;
  amenities: string[];
  houseRules: string[];
  images: string[];
  availableFrom: string;
  lat: number;
  lng: number;
  status: 'draft' | 'active' | 'paused' | 'filled' | 'closed' | 'pending_verification';
  applicants: number;
  views: number;
  /** Owner-confirmed availability timestamp (Sprint 2A). Legacy docs may lack it. */
  lastConfirmedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isOwnerPremium?: boolean;
  isOwnerVerified?: boolean;
  ownerQuizAnswers?: Record<string, string>;
  /**
   * Set to true ONLY by admin approval of owner identity verification.
   * Firestore rules enforce that only admins can write this field.
   * Absent field on legacy listings = grandfathered (grace period).
   * false = explicitly unverified (must not appear in discovery).
   */
  ownerVerified?: boolean;
  preferredGender?: string;
  genderPreference?: string;
  state?: string;
}

// ListingFilters + applyClientFilters now live in @/lib/listingFilters
// (pure module, unit-tested in listingFilters.test.ts). Re-exported here so
// existing imports of these names from useListings keep working.
export type { ListingFilters } from '@/lib/listingFilters';
export { applyClientFilters } from '@/lib/listingFilters';

const PAGE_SIZE = 20;
const OWNER_CACHE_TTL = 5 * 60 * 1000;
const ownerCache = new Map<string, { data: any; expiresAt: number }>();
const listingDetailCache = new Map<string, { listing: Listing; ownerProfile: any | null; expiresAt: number }>();

export function useListings() {
  const { logEvent } = useAnalytics();
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  const getListings = useCallback(async (filters?: ListingFilters, reset = true): Promise<Listing[]> => {
    setIsLoading(true);
    setError(null);
    startTrace('useListings_getListings');
    try {
      const enhanceAndSortListings = async (rawListings: Listing[]): Promise<Listing[]> => {
        if (rawListings.length === 0) return [];
        const ownerIds = Array.from(new Set(rawListings.map(r => r.ownerId).filter(Boolean)));
        const ownersMap = new Map<string, any>();
        if (ownerIds.length > 0) {
          const now = Date.now();
          const missingIds = ownerIds.filter(id => {
            const cached = ownerCache.get(id);
            return !cached || cached.expiresAt <= now;
          });

          if (missingIds.length > 0) {
            try {
              const ownerSnaps = await Promise.all(
                missingIds.map(id => getDoc(doc(db, 'users', id)))
              );
              ownerSnaps.forEach(d => {
                if (d.exists()) {
                  ownerCache.set(d.id, { data: d.data(), expiresAt: now + OWNER_CACHE_TTL });
                }
              });
            } catch (err) {
              console.error('Failed to pre-fetch owners profile details for listings:', err);
            }
          }

          ownerIds.forEach(id => {
            const cached = ownerCache.get(id);
            if (cached) {
              ownersMap.set(id, cached.data);
            }
          });
        }
        // Sprint 4A (truth): NEVER fabricate owner quiz answers. If the owner
        // has no real quiz data, ownerQuizAnswers stays undefined and the UI
        // must render an honest "preferences unavailable" state instead of a
        // compatibility score computed against invented answers.
        const enhanced = rawListings.map(r => {
          const owner = ownersMap.get(r.ownerId);
          const storedQuiz = (r as any).ownerQuizAnswers;
          const ownerQuiz =
            owner?.quizAnswers && Object.keys(owner.quizAnswers).length > 0
              ? owner.quizAnswers
              : storedQuiz && Object.keys(storedQuiz).length > 0
                ? storedQuiz
                : undefined;

          return {
            ...r,
            ...(ownerQuiz ? { ownerQuizAnswers: ownerQuiz } : {}),
            isOwnerPremium: owner?.isPremium || false,
            isOwnerVerified: owner?.isVerified || false,
          };
        });
        enhanced.sort((a, b) => {
          const aPrem = a.isOwnerPremium ? 1 : 0;
          const bPrem = b.isOwnerPremium ? 1 : 0;
          if (aPrem !== bPrem) return bPrem - aPrem;

          const aVer = a.isOwnerVerified ? 1 : 0;
          const bVer = b.isOwnerVerified ? 1 : 0;
          if (aVer !== bVer) return bVer - aVer;

          return 0;
        });

        // Pre-populate listing detail cache so navigating to any card is instant
        enhanced.forEach(item => {
          const owner = ownersMap.get(item.ownerId) || null;
          listingDetailCache.set(item.id, {
            listing: item,
            ownerProfile: owner ? { uid: item.ownerId, ...owner } : null,
            expiresAt: Date.now() + 2 * 60 * 1000,
          });
        });

        return enhanced;
      };

      // Availability & Verification integrity: drop unverified/closed/expired listings from discovery.
      const dropUnavailable = (ls: Listing[]) => ls.filter(l => isPubliclyVisibleListing(l));

      let fetchedResults: Listing[] = [];
      let constrainedQueryFailed = false;
      try {
        const constraints: any[] = [
          where('status', '==', 'active'),
          orderBy('createdAt', 'desc'),
          limit(100),
        ];

        if (filters?.city) {
          const newConstraints: any[] = [
            where('status', '==', 'active'),
            (() => {
              const values = getCityQueryValues(filters.city!);
              return values.length > 1 ? where('city', 'in', values) : where('city', '==', values[0]);
            })(),
            orderBy('createdAt', 'desc'),
            limit(100),
          ];
          if (!reset && lastDocRef.current) {
            newConstraints.push(startAfter(lastDocRef.current));
          }
          const q = query(collection(db, 'listings'), ...newConstraints);
          const snap = await getDocs(q);
          lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
          setHasMore(snap.docs.length === 100);
          fetchedResults = dropUnavailable(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing)));
        } else {
          if (!reset && lastDocRef.current) {
            constraints.push(startAfter(lastDocRef.current));
          }
          const q = query(collection(db, 'listings'), ...constraints);
          const snap = await getDocs(q);
          lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
          setHasMore(snap.docs.length === 100);
          fetchedResults = dropUnavailable(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing)));
        }
      } catch (e) {
        constrainedQueryFailed = true;
        console.warn('Firestore constrained listings fetch failed, executing fallback all-listings query:', e);
      }

      // A legitimate empty query result stays empty. Full-scan fallback is only
      // for an unavailable index/transient query failure and is re-filtered below.
      if (constrainedQueryFailed) {
        try {
          const rawSnap = await getDocs(collection(db, 'listings'));
          fetchedResults = rawSnap.docs
            .map((d) => ({ id: d.id, ...d.data() } as Listing))
            .filter((l) => l.status === 'active' || !l.status)
            .filter(isPubliclyVisibleListing);
        } catch (err) {
          console.error('Fallback listings query failed:', err);
        }
      }



      // Apply client-side filtering on Firestore results
      let results = applyClientFilters(fetchedResults, filters);
      results = await enhanceAndSortListings(results);

      if (reset) {
        setListings(results);
      } else {
        setListings(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const uniqueResults = results.filter(r => !existingIds.has(r.id));
          return [...prev, ...uniqueResults];
        });
      }
      return results;
    } catch (err: any) {
      setError(err.message);
      setListings([]);
      return [];
    } finally {
      endTrace('useListings_getListings');
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (filters?: ListingFilters) => {
    if (!hasMore || isLoading) return;
    await getListings(filters, false);
  }, [hasMore, isLoading, getListings]);

  /**
   * Fetch a single listing by ID with owner enrichment.
   * Returns { listing, ownerProfile } so callers don't need a duplicate owner fetch.
   * Listing and owner profile are fetched in PARALLEL (not serial).
   */
  const getListingById = useCallback(async (id: string): Promise<{ listing: Listing; ownerProfile: any | null } | null> => {
    const cached = listingDetailCache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      return { listing: cached.listing, ownerProfile: cached.ownerProfile };
    }
    try {
      const snap = await getDoc(doc(db, 'listings', id));
      if (snap.exists()) {
        const data = snap.data() as Omit<Listing, 'id'>;
        let isOwnerVerified = false;
        let isOwnerPremium = false;
        // Sprint 4A (truth): no fabricated default quiz. ownerQuizAnswers is
        // set ONLY from real data; RoomDetail renders an honest state when absent.
        let ownerQuizAnswers: Record<string, string> | undefined = undefined;
        let ownerProfile: any | null = null;

        if (data.ownerId) {
          try {
            const ownerSnap = await getDoc(doc(db, 'users', data.ownerId));
            if (ownerSnap.exists()) {
              const owner = ownerSnap.data();
              ownerProfile = { uid: data.ownerId, ...owner };
              isOwnerVerified = !!owner.isVerified;
              isOwnerPremium = !!owner.isPremium;
              if (owner.quizAnswers && Object.keys(owner.quizAnswers).length > 0) {
                ownerQuizAnswers = owner.quizAnswers;
              }
            }
          } catch {
            // ignore owner enrichment failures
          }
        }
        if ((data as any).ownerQuizAnswers && Object.keys((data as any).ownerQuizAnswers).length > 0) {
          ownerQuizAnswers = (data as any).ownerQuizAnswers;
        }
        const fullListing: Listing = {
          id: snap.id,
          ...data,
          isOwnerVerified,
          isOwnerPremium,
          ...(ownerQuizAnswers ? { ownerQuizAnswers } : {}),
        };
        listingDetailCache.set(snap.id, {
          listing: fullListing,
          ownerProfile,
          expiresAt: Date.now() + 2 * 60 * 1000,
        });
        return {
          listing: fullListing,
          ownerProfile,
        };
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  /**
   * Lightweight similar-listings query: fetches a small set of active listings
   * in the same city WITHOUT full owner enrichment (avoids N+1 owner reads).
   * Used by RoomDetail to show "Similar Rooms" without the expensive
   * enhanceAndSortListings pipeline.
   */
  /**
   * Genuine dynamic similar-listings matching:
   * Dynamically ranks real active listings by same locality (+40), same flat type (+30),
   * budget proximity (+30), same city (+50), and lifestyle/gender preferences.
   * Uses safe single-filter Firestore query to eliminate composite index crashes.
   */
  const getSimilarListings = useCallback(async (
    target: Partial<Listing> | string,
    excludeId?: string,
    maxResults: number = 4
  ): Promise<Listing[]> => {
    try {
      const targetRoom: Partial<Listing> = typeof target === 'string' ? { city: target } : target;
      const targetCity = (targetRoom.city || '').trim().toLowerCase();
      const targetLocality = (targetRoom.locality || '').trim().toLowerCase();
      const targetFlatType = (targetRoom.flatType || '').trim().toLowerCase();
      const targetRent = Number(targetRoom.partnerShare || targetRoom.totalRent || (targetRoom as any)?.monthlyRent || 0);
      const targetGender = (targetRoom.preferredGender || '').toLowerCase();
      const actualExcludeId = excludeId || targetRoom.id || '';

      // Query active listings with a single-field filter (no composite index required)
      let snap;
      try {
        const q = query(
          collection(db, 'listings'),
          where('status', '==', 'active'),
          limit(50)
        );
        snap = await getDocs(q);
      } catch {
        snap = await getDocs(query(collection(db, 'listings'), limit(50)));
      }

      let candidates: Listing[] = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Listing))
        .filter(r => r.id !== actualExcludeId && isDiscoverable(r) && isPubliclyVisibleListing(r));

      // If strict visibility returned fewer than maxResults, gracefully backfill with any other available listings
      if (candidates.length < maxResults) {
        try {
          const allSnap = await getDocs(query(collection(db, 'listings'), limit(50)));
          const moreCandidates = allSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as Listing))
            .filter(r => r.id !== actualExcludeId && (r.status === 'active' || !r.status) && r.status !== 'closed');
          const existingIds = new Set(candidates.map(c => c.id));
          for (const item of moreCandidates) {
            if (!existingIds.has(item.id)) {
              candidates.push(item);
              existingIds.add(item.id);
            }
          }
        } catch (_) {
          // ignore fallback error
        }
      }

      // Dynamically score candidates based on similarity to current room
      const scored = candidates.map(candidate => {
        let score = 0;
        const cCity = (candidate.city || '').trim().toLowerCase();
        const cLocality = (candidate.locality || '').trim().toLowerCase();
        const cFlatType = (candidate.flatType || '').trim().toLowerCase();
        const cRent = Number(candidate.partnerShare || candidate.totalRent || (candidate as any)?.monthlyRent || 0);
        const cGender = (candidate.preferredGender || '').toLowerCase();

        // 1. City Match (+50 points)
        if (targetCity && cCity) {
          if (cCity === targetCity || cCity.includes(targetCity) || targetCity.includes(cCity)) {
            score += 50;
          }
        }

        // 2. Locality Match (+40 for exact, +25 for partial)
        if (targetLocality && cLocality) {
          if (cLocality === targetLocality) {
            score += 40;
          } else if (cLocality.includes(targetLocality) || targetLocality.includes(cLocality)) {
            score += 25;
          }
        }

        // 3. Property / Flat Type Match (+30 for exact, +15 for category)
        if (targetFlatType && cFlatType) {
          if (cFlatType === targetFlatType) {
            score += 30;
          } else if (cFlatType.includes('bhk') && targetFlatType.includes('bhk')) {
            score += 15;
          } else if ((cFlatType.includes('pg') || cFlatType.includes('hostel')) && (targetFlatType.includes('pg') || targetFlatType.includes('hostel'))) {
            score += 25;
          }
        }

        // 4. Rent Proximity (+30 scaled by difference)
        if (targetRent > 0 && cRent > 0) {
          const diffRatio = Math.abs(cRent - targetRent) / targetRent;
          if (diffRatio <= 0.15) {
            score += 30;
          } else if (diffRatio <= 0.3) {
            score += 20;
          } else if (diffRatio <= 0.5) {
            score += 10;
          }
        }

        // 5. Gender Preference Match (+10)
        if (targetGender && cGender) {
          if (cGender === targetGender || cGender === 'any' || targetGender === 'any') {
            score += 10;
          }
        }

        return { candidate, score };
      });

      // Sort by score descending; if tied, sort by recency
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const timeA = (a.candidate.createdAt as any)?.toMillis ? (a.candidate.createdAt as any).toMillis() : 0;
        const timeB = (b.candidate.createdAt as any)?.toMillis ? (b.candidate.createdAt as any).toMillis() : 0;
        return timeB - timeA;
      });

      return scored.slice(0, maxResults).map(s => s.candidate);
    } catch {
      return [];
    }
  }, []);


  const getMyListings = useCallback(async (ownerId: string): Promise<Listing[]> => {
    try {
      const q = query(
        collection(db, 'listings'),
        where('ownerId', '==', ownerId)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Listing));
      return results.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
    } catch (err) {
      console.error("Error fetching my listings:", err);
      return [];
    }
  }, []);

  const createListing = useCallback(
    async (ownerId: string, data: Omit<Listing, 'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'applicants' | 'views'>): Promise<string> => {
      const docRef = await addDoc(collection(db, 'listings'), {
        ...data,
        ownerId,
        applicants: 0,
        views: 0,
        // Security: New listings start as pending_verification and are not publicly visible
        // until admin approves the owner's identity verification.
        // The status may be overridden by caller only to 'pending_verification' or 'paused';
        // Firestore rules enforce newListingFieldsSafe() which blocks status:'active' on create.
        status: data.status === 'paused' ? 'paused' : 'pending_verification',
        // ownerVerified is always false on creation — only admin approval sets this to true.
        ownerVerified: false,
        // A brand-new listing counts as freshly confirmed at publish time.
        lastConfirmedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // Sprint 2D: supply-side event (fire-and-forget)
      logEvent({ name: 'listing_created', actorId: ownerId, entityId: docRef.id, city: data.city });
      return docRef.id;
    },
    [logEvent]
  );

  const updateListing = useCallback(
    async (id: string, data: Partial<Listing>) => {
      listingDetailCache.delete(id);
      await updateDoc(doc(db, 'listings', id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    []
  );

  const deleteListing = useCallback(async (id: string) => {
    listingDetailCache.delete(id);
    await deleteDoc(doc(db, 'listings', id));
  }, []);

  /**
   * Owner explicitly confirms "this room is still available".
   * Ownership is enforced by Firestore rules; the timestamp uses
   * serverTimestamp() so clients cannot spoof freshness.
   */
  const confirmAvailability = useCallback(async (id: string) => {
    listingDetailCache.delete(id);
    const snap = await getDoc(doc(db, 'listings', id));
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === 'pending_verification' || data.ownerVerified === false) {
        console.warn('Cannot confirm availability for unverified listing:', id);
        return;
      }
    }
    await updateDoc(doc(db, 'listings', id), {
      status: 'active',
      lastConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    // Sprint 2D: freshness event (fire-and-forget). Actor = real auth UID so
    // server rules can verify actorId == auth.uid. No PII logged.
    logEvent({ name: 'availability_confirmed', actorId: getAuth().currentUser?.uid ?? '', entityId: id });
  }, [logEvent]);

  /** Owner marks the room as no longer available (soft close, history kept). */
  const closeListing = useCallback(async (id: string) => {
    listingDetailCache.delete(id);
    await updateDoc(doc(db, 'listings', id), {
      status: 'closed',
      updatedAt: serverTimestamp(),
    });
    // Sprint 2D: supply-side event (fire-and-forget). Actor = real auth UID.
    logEvent({ name: 'listing_closed', actorId: getAuth().currentUser?.uid ?? '', entityId: id });
  }, [logEvent]);

  const incrementViews = useCallback(async (id: string) => {
    try {
      const ref = doc(db, 'listings', id);
      await updateDoc(ref, { views: increment(1) });
    } catch {
      // Fallback if atomic increment fails on legacy doc
      const ref = doc(db, 'listings', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { views: (snap.data().views || 0) + 1 });
      }
    }
  }, []);

  /**
   * Record a listing view (Industry Standard):
   * 1. Ignore owner self-views (previews do not count as visitor traffic).
   * 2. Deduplicate per session/day using sessionStorage.
   * 3. Atomically increment listings/{id}.views using Firestore increment(1).
   * 4. Atomically upsert listingViews/{listingId}_{YYYY-MM-DD}.count.
   * 5. Log marketplace analytics event for conversion funnels.
   */
  const recordView = useCallback(async (listingId: string, ownerId?: string) => {
    if (!listingId) return;

    // 1. Owner self-view exclusion: creators checking their own listing do not inflate metrics
    const currentUserId = getAuth().currentUser?.uid;
    if (ownerId && currentUserId && currentUserId === ownerId) {
      return;
    }

    const todayStr = getLocalDateString(new Date());

    // 2. Session deduplication: 1 view event per listing per visitor session/day
    const sessionKey = `nestmate_view_${listingId}_${todayStr}`;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (window.sessionStorage.getItem(sessionKey)) {
          return; // Already counted in this session
        }
        window.sessionStorage.setItem(sessionKey, '1');
      }
    } catch {
      // Ignore storage errors (private browsing quota/disabled)
    }

    try {
      // 3. Atomically increment total views on listing document
      const listingRef = doc(db, 'listings', listingId);
      await updateDoc(listingRef, { views: increment(1) }).catch(async () => {
        // Fallback for doc without views field
        const snap = await getDoc(listingRef);
        if (snap.exists()) {
          const currentViews = snap.data().views || 0;
          await updateDoc(listingRef, { views: currentViews + 1 });
        }
      });

      // 4. Atomically upsert daily analytics record
      const viewDocId = `${listingId}_${todayStr}`;
      const viewRef = doc(db, 'listingViews', viewDocId);
      await setDoc(
        viewRef,
        {
          listingId,
          ...(ownerId ? { ownerId } : {}),
          date: todayStr,
          count: increment(1),
        },
        { merge: true }
      );

      // 5. Supply-side & marketplace analytics event
      logEvent({
        name: 'listing_viewed',
        actorId: currentUserId || 'guest',
        entityId: listingId,
      });
    } catch (err) {
      console.warn('Failed to record listing view:', err);
    }
  }, [logEvent]);

  /**
   * Get trailing 7 days of view counts for a listing.
   * Chronological order: Day -6, Day -5, ... Yesterday, Today.
   * Returns array of WeeklyViewItem ready for direct charting.
   */
  const getWeeklyViews = useCallback(async (listingId: string): Promise<WeeklyViewItem[]> => {
    if (!listingId) return [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days: WeeklyViewItem[] = [];

    const today = new Date();
    const todayStr = getLocalDateString(today);

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = getLocalDateString(d);
      const label = dayLabels[d.getDay()];
      days.push({
        day: label,
        date: dateStr,
        views: 0,
        isToday: dateStr === todayStr,
      });
    }

    // Batch fetch all 7 daily docs
    try {
      const fetches = days.map(d =>
        getDoc(doc(db, 'listingViews', `${listingId}_${d.date}`))
      );
      const snaps = await Promise.all(fetches);
      snaps.forEach((snap, i) => {
        if (snap.exists()) {
          days[i].views = snap.data().count || 0;
        }
      });
    } catch (err) {
      console.warn('Failed to load weekly views for listing:', listingId, err);
    }

    return days;
  }, []);

  /**
   * Portfolio-wide weekly analytics:
   * Aggregates trailing 7-day views across ALL listings belonging to an owner.
   */
  const getOwnerWeeklyViews = useCallback(async (listingIds: string[]): Promise<WeeklyViewItem[]> => {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const todayStr = getLocalDateString(today);

    const baseDays: WeeklyViewItem[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = getLocalDateString(d);
      baseDays.push({
        day: dayLabels[d.getDay()],
        date: dateStr,
        views: 0,
        isToday: dateStr === todayStr,
      });
    }

    if (!listingIds || listingIds.length === 0) {
      return baseDays;
    }

    // Fetch weekly views for each listing and sum them up per day
    const allListingViews = await Promise.all(
      listingIds.map(id => getWeeklyViews(id))
    );

    allListingViews.forEach(viewsForListing => {
      viewsForListing.forEach((item, idx) => {
        if (baseDays[idx]) {
          baseDays[idx].views += item.views;
        }
      });
    });

    return baseDays;
  }, [getWeeklyViews]);

  return {
    listings,
    isLoading,
    error,
    hasMore,
    getListings,
    loadMore,
    getListingById,
    getSimilarListings,
    getMyListings,
    createListing,
    updateListing,
    deleteListing,
    confirmAvailability,
    closeListing,
    incrementViews,
    recordView,
    getWeeklyViews,
    getOwnerWeeklyViews,
  };
}

