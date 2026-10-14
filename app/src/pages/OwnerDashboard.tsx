import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useListings } from '@/hooks/useListings';
import { useConnections } from '@/hooks/useConnections';
import { useChat } from '@/hooks/useChat';
import { useNotifications } from '@/hooks/useNotifications';
import type { Listing, WeeklyViewItem } from '@/hooks/useListings';
import type { Connection } from '@/hooks/useConnections';
import type { UserProfile } from '@/hooks/useAuth';
import { doc, getDoc, Timestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import OwnerVerificationGate from '@/components/OwnerVerificationGate';
import {
  subscribeToOwnerVerification,
  type OwnerVerification,
} from '@/lib/ownerVerification';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  TrendingUp, MessageCircle, Edit3, Eye, Users, Settings, MapPin,
  Shield, ShieldCheck, Check, X, Pause, Play, Trash2, AlertTriangle, CheckCircle2, Plus,
  FileText, ArrowRight, User, Mail, Star, ChevronRight, Lightbulb, Home, Building2,
  Compass, Search, ArrowLeft, ChevronDown, RotateCcw, SlidersHorizontal, Sparkles
} from 'lucide-react';
import StateLoading from '@/components/StateLoading';
import StateEmpty from '@/components/StateEmpty';
import PageShell from '@/components/PageShell';
import OwnerSeekerCard from '@/components/OwnerSeekerCard';
import ContactModal from '@/components/ContactModal';
import { getAvailabilityState, getFreshnessAnchorMs, formatRelativeDays } from '@/lib/listingFreshness';
import { rankApplicants, evaluateApplicantFit } from '@/lib/applicantRanking';
import { filterFlatmateProfiles } from '@/lib/roleFiltering';
import { areSameCityAlias } from '@/lib/cityNormalization';
import { isPubliclyVisibleProfile } from '@/lib/marketplaceVisibility';
import { calculateRoomCompatibility } from '@/hooks/useMatches';
import { cities } from '@/lib/staticData';
import ApplicantScreeningAnswersModal from '@/components/ApplicantScreeningAnswersModal';

interface PendingApplicant {
  connection: Connection;
  profile: UserProfile;
}

// Sprint 6B: local initial-letter avatar fallback — removes third-party dicebear requests with image onError fallback
function UserAvatar({ src, name, className }: { src?: string; name?: string; className?: string }) {
  const [imgError, setImgError] = useState(false);
  if (src && !src.includes('dicebear') && !imgError) {
    return <img src={src} alt={name || 'User'} className={className} onError={() => setImgError(true)} />;
  }
  return (
    <div aria-hidden="true" className={`${className} bg-fire/10 text-fire flex items-center justify-center font-bold`}>
      {name?.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

const SEEKER_LIFESTYLE_TRAITS = [
  { id: 'veg', label: 'Vegetarian' },
  { id: 'no_smoke', label: 'Non-Smoker' },
  { id: 'clean', label: 'Neat & Clean' },
  { id: 'wfh', label: 'WFH / Remote' },
  { id: 'pets', label: 'Pet Friendly' },
] as const;

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { getMyListings, updateListing, deleteListing, getWeeklyViews, getOwnerWeeklyViews, confirmAvailability, closeListing } = useListings();
  const { subscribeToIncoming, getMyConnections, acceptRequest, rejectRequest } = useConnections();
  const { subscribeToChatRooms, getOrCreateChatRoom } = useChat();
  const { createNotification } = useNotifications();

  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [myListing, setMyListing] = useState<Listing | null>(null);
  const [pendingApplicants, setPendingApplicants] = useState<PendingApplicant[]>([]);
  const [acceptedConnections, setAcceptedConnections] = useState<PendingApplicant[]>([]);
  const [chatCount, setChatCount] = useState(0);
  const [weeklyViews, setWeeklyViews] = useState<WeeklyViewItem[]>([]);
  const [portfolioWeeklyViews, setPortfolioWeeklyViews] = useState<WeeklyViewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [processingApplicantId, setProcessingApplicantId] = useState<string | null>(null);
  const [ownerVerification, setOwnerVerification] = useState<OwnerVerification | null>(null);
  const [selectedScreeningApplicant, setSelectedScreeningApplicant] = useState<PendingApplicant | null>(null);
  const [showTrafficChart, setShowTrafficChart] = useState(false);

  // Deep-link & tab support: /owner-dashboard?tab=listings | applicants, ?request={connectionId}
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedRequestId = searchParams.get('request');
  const tabParam = searchParams.get('tab');

  const activeTab: 'overview' | 'listings' | 'applicants' | 'seekers' =
    tabParam === 'listings' ? 'listings' :
    tabParam === 'applicants' ? 'applicants' :
    tabParam === 'seekers' || tabParam === 'roommates' ? 'seekers' :
    highlightedRequestId ? 'applicants' : 'overview';

  // Auto-scroll to highlighted request when landing from a notification deep-link
  useEffect(() => {
    if (!highlightedRequestId || pendingApplicants.length === 0) return;
    const el = document.getElementById(`request-${highlightedRequestId}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
    }
  }, [highlightedRequestId, pendingApplicants]);

  // Scroll to top smoothly when switching tabs explicitly
  useEffect(() => {
    if (tabParam && !highlightedRequestId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [tabParam, highlightedRequestId]);

  // Escape key and scroll lock for Delete Confirmation Modal
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDeleteConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showDeleteConfirm]);

  // Subscribe to owner verification status
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToOwnerVerification(user.uid, setOwnerVerification);
    return unsub;
  }, [user?.uid]);

  // Load listings
  useEffect(() => {
    if (!user?.uid) {
      const timer = window.setTimeout(() => setIsLoading(false), 2000);
      return () => window.clearTimeout(timer);
    }
    const safetyTimer = window.setTimeout(() => setIsLoading(false), 8000);
    getMyListings(user.uid)
      .then(async listings => {
        setAllListings(listings);
        const listing = listings.find(l => l.status === 'active') || listings[0] || null;
        setMyListing(listing);

        // Fetch portfolio-wide views across all owner listings
        const allIds = listings.map(l => l.id).filter(Boolean);
        if (allIds.length > 0) {
          const portfolioViews = await getOwnerWeeklyViews(allIds);
          setPortfolioWeeklyViews(portfolioViews);
        }

        // Fetch specific selected listing weekly views
        if (listing?.id) {
          const views = await getWeeklyViews(listing.id);
          setWeeklyViews(views);
        }
      })
      .catch(err => console.error('Failed to load listings:', err))
      .finally(() => {
        window.clearTimeout(safetyTimer);
        setIsLoading(false);
      });
    return () => window.clearTimeout(safetyTimer);
  }, [getMyListings, getOwnerWeeklyViews, getWeeklyViews, user?.uid]);

  // Real-time chat count
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToChatRooms(user.uid, rooms => {
      setChatCount(rooms.length);
    });
    return () => unsub();
  }, [subscribeToChatRooms, user?.uid]);

  // Real-time incoming connection requests
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToIncoming(user.uid, async connections => {
      const applicants: PendingApplicant[] = [];
      for (const conn of connections) {
        const snap = await getDoc(doc(db, 'users', conn.fromUserId));
        if (snap.exists()) {
          applicants.push({ connection: conn, profile: { uid: snap.id, ...snap.data() } as UserProfile });
        }
      }
      setPendingApplicants(applicants);
    });
    return () => unsub();
  }, [subscribeToIncoming, user?.uid]);

  // Sprint 3A: EXPLAINABLE applicant ranking — owners see best-fit applicants
  // first, with data-backed reasons shown on every card. Signals come ONLY
  // from real stored data (quiz answers, budget, city/locality, verification
  // fields). Ties preserve chronological order via stable sort.
  const rankedApplicants = useMemo(
    () => rankApplicants(pendingApplicants, (a) =>
      evaluateApplicantFit(profile?.quizAnswers || {}, a.profile as any, {
        ownerCity: profile?.city,
        listing: myListing
          ? {
            city: myListing.city,
            locality: myListing.locality,
            partnerShare: (myListing as any).partnerShare,
            totalRent: myListing.totalRent,
            genderPreference: (myListing as any).genderPreference,
            houseRules: myListing.houseRules,
            ownerQuizAnswers: myListing.ownerQuizAnswers,
          }
          : undefined,
        requestedAtMs: (a.connection as any)?.createdAt?.toMillis?.(),
        now: Date.now(),
      })
    ),
    [pendingApplicants, profile?.quizAnswers, profile?.city, myListing]
  );

  // Sprint 6A: real listing attribution — resolve a connection's listingId
  // against the owner's actual listings. Returns null when the connection has
  // no listingId (profile-origin request) or the listing no longer exists.
  // Attribution is never guessed.
  const getRequestedListing = (conn: Connection): Listing | null => {
    const lid = (conn as any).listingId;
    if (!lid) return null;
    return allListings.find(l => l.id === lid) || null;
  };

  // Load accepted connections
  useEffect(() => {
    if (!user?.uid) return;
    getMyConnections(user.uid, 'accepted').then(async conns => {
      const list: PendingApplicant[] = [];
      for (const conn of conns) {
        const otherId = conn.fromUserId === user.uid ? conn.toUserId : conn.fromUserId;
        const snap = await getDoc(doc(db, 'users', otherId));
        if (snap.exists()) {
          list.push({ connection: conn, profile: { uid: snap.id, ...snap.data() } as UserProfile });
        }
      }
      setAcceptedConnections(list);
    }).catch(() => { });
  }, [getMyConnections, user?.uid]);

  // Seeker Discovery State for Owner
  const [seekers, setSeekers] = useState<{ profile: UserProfile; score: number }[]>([]);
  const [loadingSeekers, setLoadingSeekers] = useState(false);
  const [seekerCity, setSeekerCity] = useState<string>('');
  const [seekerSearchQuery, setSeekerSearchQuery] = useState('');
  const [seekerGenderFilter, setSeekerGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [seekerMaxBudget, setSeekerMaxBudget] = useState<number | null>(null);
  const [seekerTraitFilter, setSeekerTraitFilter] = useState<string[]>([]);
  const [seekerSort, setSeekerSort] = useState<'match' | 'budget_desc' | 'budget_asc'>('match');
  const [contactSeekerProfile, setContactSeekerProfile] = useState<UserProfile | null>(null);
  const [showSeekerFilters, setShowSeekerFilters] = useState(false);

  // Escape key listener to close seeker filter panel
  useEffect(() => {
    if (!showSeekerFilters) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSeekerFilters(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSeekerFilters]);

  const defaultOwnerCity = myListing?.city || profile?.city || 'all';

  // Active Seeker Filters Count
  const activeSeekerFiltersCount = useMemo(() => {
    let count = 0;
    if (seekerGenderFilter !== 'all') count++;
    count += seekerTraitFilter.length;
    if (seekerCity && seekerCity !== 'all' && seekerCity !== defaultOwnerCity) count++;
    if (seekerSort !== 'match') count++;
    return count;
  }, [seekerGenderFilter, seekerTraitFilter, seekerCity, seekerSort, defaultOwnerCity]);

  const handleResetSeekerFilters = () => {
    setSeekerSearchQuery('');
    setSeekerGenderFilter('all');
    setSeekerTraitFilter([]);
    setSeekerCity(defaultOwnerCity);
    setSeekerSort('match');
  };

  // Default seekerCity to the city of the owner's primary listing or profile
  useEffect(() => {
    if (!seekerCity) {
      setSeekerCity(defaultOwnerCity);
    }
  }, [defaultOwnerCity, seekerCity]);

  // Load verified room seekers from Firestore
  useEffect(() => {
    if (activeTab !== 'seekers' && activeTab !== 'overview') return;
    let isCancelled = false;

    async function loadSeekers() {
      setLoadingSeekers(true);
      try {
        const snap = await getDocs(collection(db, 'users'));
        const list: UserProfile[] = [];
        snap.docs.forEach(d => {
          const data = { uid: d.id, ...d.data() } as UserProfile;
          if (data.uid === user?.uid) return;
          if (profile?.blockedUserIds?.includes(data.uid)) return;
          if (isPubliclyVisibleProfile(data)) {
            list.push(data);
          }
        });

        const filtered = filterFlatmateProfiles(list, user?.uid, 'owner');

        const scored = filtered.map(seeker => {
          const score = myListing
            ? calculateRoomCompatibility(seeker, myListing)
            : 0;
          return { profile: seeker, score };
        });

        if (!isCancelled) {
          setSeekers(scored);
        }
      } catch (err) {
        console.warn('Error loading room seekers:', err);
      } finally {
        if (!isCancelled) setLoadingSeekers(false);
      }
    }

    loadSeekers();
    return () => { isCancelled = true; };
  }, [activeTab, user?.uid, myListing, profile?.blockedUserIds]);

  // Filter and sort seekers
  const filteredSeekers = useMemo(() => {
    return seekers
      .filter(({ profile: s }) => {
        // City filter
        if (seekerCity && seekerCity !== 'all') {
          const pCity = (s.city || '').trim().toLowerCase();
          const tCity = seekerCity.trim().toLowerCase();
          if (pCity && pCity !== tCity && !areSameCityAlias(pCity, tCity)) {
            return false;
          }
        }

        // Search query
        if (seekerSearchQuery.trim()) {
          const q = seekerSearchQuery.trim().toLowerCase();
          const match =
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.locality && s.locality.toLowerCase().includes(q)) ||
            (s.profession && s.profession.toLowerCase().includes(q)) ||
            (s.bio && s.bio.toLowerCase().includes(q));
          if (!match) return false;
        }

        // Gender filter
        if (seekerGenderFilter !== 'all') {
          const g = (s.gender || '').toLowerCase();
          if (g !== seekerGenderFilter) return false;
        }

        // Max Budget
        if (seekerMaxBudget && seekerMaxBudget > 0) {
          if (s.budget && s.budget > seekerMaxBudget) return false;
        }

        // Traits filter
        if (seekerTraitFilter.length > 0) {
          const qAns = s.quizAnswers || {};
          for (const trait of seekerTraitFilter) {
            if (trait === 'veg' && qAns.food_pref !== 'veg' && qAns.food_pref !== 'vegan') return false;
            if (trait === 'no_smoke' && qAns.smoking !== 'never') return false;
            if (trait === 'clean' && qAns.cleanliness !== 'very') return false;
            if (trait === 'wfh' && qAns.work_mode !== 'wfh') return false;
            if (trait === 'pets' && qAns.pets !== 'love' && qAns.pets !== 'ok') return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (seekerSort === 'match') return b.score - a.score;
        if (seekerSort === 'budget_desc') return (b.profile.budget || 0) - (a.profile.budget || 0);
        if (seekerSort === 'budget_asc') return (a.profile.budget || 0) - (b.profile.budget || 0);
        return 0;
      });
  }, [seekers, seekerCity, seekerSearchQuery, seekerGenderFilter, seekerMaxBudget, seekerTraitFilter, seekerSort]);

  const handleChatSeeker = async (seekerUid: string) => {
    if (!user?.uid) return;
    try {
      const chatRoomId = await getOrCreateChatRoom(user.uid, seekerUid);
      navigate(`/chat/${chatRoomId}`);
    } catch {
      navigate(`/match/${seekerUid}`);
    }
  };

  const handleCallSeeker = (seeker: UserProfile) => {
    setContactSeekerProfile(seeker);
  };

  const handleAccept = async (applicant: PendingApplicant) => {
    if (!user?.uid || processingApplicantId) return;
    setProcessingApplicantId(applicant.connection.id);
    try {
      await acceptRequest(applicant.connection.id);
      const roomId = await getOrCreateChatRoom(user.uid, applicant.connection.fromUserId);
      await createNotification({
        userId: applicant.connection.fromUserId,
        type: 'connect',
        title: 'Connection Accepted!',
        description: `${profile?.name || 'A user'} accepted your connect request. Start chatting!`,
        read: false,
        actionUrl: `/chat/${roomId}`,
        connectionId: applicant.connection.id,
      });
      navigate(`/chat/${roomId}`);
    } catch (err) {
      console.error('Failed to accept applicant:', err);
    } finally {
      setProcessingApplicantId(null);
    }
  };

  const handleReject = async (applicant: PendingApplicant) => {
    if (processingApplicantId) return;
    setProcessingApplicantId(applicant.connection.id);
    try {
      await rejectRequest(applicant.connection.id);
    } catch (err) {
      console.error('Failed to reject applicant:', err);
    } finally {
      setProcessingApplicantId(null);
    }
  };

  // Sprint 2A: explicit owner confirmation that the room is still available.
  const handleConfirmAvailability = async () => {
    if (!myListing) return;
    try {
      await confirmAvailability(myListing.id);
      setMyListing({ ...myListing, status: 'active', lastConfirmedAt: Timestamp.now() });
      setAllListings(prev => prev.map(l => l.id === myListing.id ? { ...l, status: 'active' as const, lastConfirmedAt: Timestamp.now() } : l));
    } catch (err) {
      console.error('Failed to confirm availability', err);
    }
  };

  const handleCloseListing = async () => {
    if (!myListing) return;
    try {
      await closeListing(myListing.id);
      const remaining = allListings.filter(l => l.id !== myListing.id);
      setAllListings(remaining);
      setMyListing(remaining[0] || null);
    } catch (err) {
      console.error('Failed to close listing', err);
    }
  };

  const handleSelectListing = async (listing: Listing) => {
    setMyListing(listing);
    if (listing?.id) {
      const views = await getWeeklyViews(listing.id);
      setWeeklyViews(views);
    } else {
      setWeeklyViews([]);
    }
  };

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!myListing) return;
    // SECURITY: Cannot activate a listing that is pending owner verification.
    // The owner must submit identity documents first.
    if (myListing.status === 'pending_verification' || myListing.ownerVerified === false) {
      return; // Silently block — the UI already shows the verification gate
    }
    const newStatus: 'active' | 'paused' = myListing.status === 'active' ? 'paused' : 'active';
    try {
      await updateListing(myListing.id, { status: newStatus });
      const updatedListing = { ...myListing, status: newStatus };
      setMyListing(updatedListing);
      setAllListings(prev => prev.map(l => l.id === myListing.id ? updatedListing : l));
    } catch (err) {
      console.error('Failed to toggle status', err);
    }
  };

  const handleDeleteListing = async () => {
    if (!myListing) return;
    await deleteListing(myListing.id);
    const remaining = allListings.filter(l => l.id !== myListing.id);
    setAllListings(remaining);
    setMyListing(remaining[0] || null);
    setShowDeleteConfirm(false);
  };

  const handleDeleteSpecificListing = async (e: React.MouseEvent, listingId: string) => {
    e.stopPropagation();
    try {
      await deleteListing(listingId);
      const remaining = allListings.filter(l => l.id !== listingId);
      setAllListings(remaining);
      if (myListing?.id === listingId) {
        setMyListing(remaining[0] || null);
      }
    } catch (err) {
      console.error('Failed to delete listing', err);
    }
  };

  const handleCleanDuplicates = async () => {
    if (allListings.length <= 1) return;
    const seen = new Set<string>();
    const toKeep: Listing[] = [];
    const toDeleteIds: string[] = [];

    allListings.forEach(l => {
      const key = `${l.locality.toLowerCase().trim()}_${l.flatType.toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.add(key);
        toKeep.push(l);
      } else {
        toDeleteIds.push(l.id);
      }
    });

    if (toDeleteIds.length === 0) return;

    for (const id of toDeleteIds) {
      await deleteListing(id);
    }

    setAllListings(toKeep);
    setMyListing(toKeep[0] || null);
  };

  if (isLoading) return <StateLoading label="Loading dashboard..." fullScreen />;

  // Selected listing weekly views
  const selectedListingWeeklyViews = weeklyViews.reduce((s, d) => s + d.views, 0);

  // Active weekly data: Overview displays portfolio-wide activity; listings drilldown displays selected listing
  const activeWeeklyData = (activeTab === 'overview' && portfolioWeeklyViews.length > 0)
    ? portfolioWeeklyViews
    : weeklyViews;

  const totalWeeklyViews = activeWeeklyData.reduce((s, d) => s + d.views, 0);

  // Total all-time views across all listings (overview) or for selected listing
  const totalAllTimeViews = (activeTab === 'overview')
    ? allListings.reduce((s, l) => s + (l.views || 0), 0)
    : (myListing?.views || 0);

  const hasDuplicateProperties = allListings.some(l =>
    allListings.filter(x => x.locality.toLowerCase().trim() === l.locality.toLowerCase().trim() && x.flatType === l.flatType).length > 1
  );

  const displayWeeklyViews = activeWeeklyData;

  return (
    <PageShell maxWidth="max-w-[1600px]" className="bg-[#FBFBFC]" withBottomNavPad>

      {/* 1. DESKTOP HEADER (Visible ONLY on lg screens) */}
      <div className="hidden lg:flex mb-6 flex-row items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <h1 className="font-serif text-2xl md:text-3xl font-medium text-[#1E2229] tracking-tight">
              {activeTab === 'listings'
                ? 'Properties & Listings'
                : activeTab === 'applicants'
                  ? 'Applicant Inquiries'
                  : activeTab === 'seekers'
                    ? 'Browse Room Seekers'
                    : 'Owner Dashboard'}
            </h1>
            {ownerVerification?.status === 'APPROVED' ? (
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full border border-emerald-200/60 inline-flex items-center gap-1 shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified Host
              </span>
            ) : (
              <span className="text-xs font-semibold bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200/60 inline-flex items-center gap-1 shadow-xs">
                <Shield className="w-3.5 h-3.5 text-amber-600" /> Verification Pending
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 max-w-xl">
            {activeTab === 'listings'
              ? 'Manage room availability, pricing, photos, and live seeker engagement.'
              : activeTab === 'applicants'
                ? 'Review verified roommate applicants, assess lifestyle compatibility, and start chats.'
                : activeTab === 'seekers'
                  ? 'Discover and connect with verified people actively seeking rental rooms.'
                  : `Welcome back${profile?.name ? `, ${profile.name}` : ''}! Manage your spaces, track views, and accept verified roommates.`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'applicants' ? (
            <button
              onClick={() => navigate('/chat')}
              className="px-5 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-semibold rounded-full transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <MessageCircle className="w-4 h-4" /> Go to Messages
            </button>
          ) : (
            <button
              onClick={() => navigate('/edit-listing/new')}
              className="px-5 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-semibold rounded-full transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add New Space
            </button>
          )}
        </div>
      </div>

      {/* 2. COMPACT MOBILE HEADER (Visible ONLY on mobile when not on seekers tab) */}
      {activeTab !== 'seekers' && (
        <div className="lg:hidden flex items-center justify-between gap-2.5 mb-3 pt-0.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="font-serif font-medium text-lg text-[#1E2229] truncate">
                Owner Dashboard
              </h1>
              {ownerVerification?.status === 'APPROVED' ? (
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 inline-flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60 inline-flex items-center gap-1 shrink-0">
                  <Shield className="w-3 h-3 text-amber-600" /> Pending
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 truncate mt-0.5 font-medium">
              Welcome back, {profile?.name?.split(' ')[0] || 'Host'}
            </p>
          </div>

          <button
            onClick={() => navigate(allListings.length === 0 ? '/edit-listing/new' : '/owner-dashboard?tab=listings')}
            className="px-3.5 py-1.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-bold rounded-full transition-all flex items-center gap-1 shadow-xs shrink-0 cursor-pointer active:scale-95"
          >
            {allListings.length === 0 ? (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>List Room</span>
              </>
            ) : (
              <>
                <Building2 className="w-3.5 h-3.5" />
                <span>Manage</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NAVIGATION TABS: DESKTOP PILLS vs MOBILE SEGMENTED CONTROL                */}
      {/* ========================================================================= */}

      {/* 1. DESKTOP NAVIGATION PILLS (Visible ONLY on lg screens) */}
      <div className="hidden lg:flex items-center gap-2 mb-8">
        <button
          onClick={() => navigate('/owner-dashboard')}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#1E2229] text-white shadow-xs font-bold'
              : 'bg-white text-gray-600 border border-gray-150 hover:border-gray-300'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => navigate('/owner-dashboard?tab=listings')}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'listings'
              ? 'bg-[#1E2229] text-white shadow-xs font-bold'
              : 'bg-white text-gray-600 border border-gray-150 hover:border-gray-300'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Listings</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            activeTab === 'listings' ? 'bg-white/20 text-white' : 'bg-[#FBFBFC] text-[#1E2229]'
          }`}>
            {allListings.length}
          </span>
        </button>

        <button
          onClick={() => navigate('/owner-dashboard?tab=applicants')}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'applicants'
              ? 'bg-[#1E2229] text-white shadow-xs font-bold'
              : 'bg-white text-gray-600 border border-gray-150 hover:border-gray-300'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Inquiries</span>
          {pendingApplicants.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#FF5A36] text-white">
              {pendingApplicants.length}
            </span>
          )}
        </button>

        <button
          onClick={() => navigate('/owner-dashboard?tab=seekers')}
          className={`px-5 py-2.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'seekers'
              ? 'bg-[#1E2229] text-white shadow-xs font-bold'
              : 'bg-white text-gray-600 border border-gray-150 hover:border-gray-300'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Browse Seekers</span>
          {seekers.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'seekers' ? 'bg-white/20 text-white' : 'bg-[#FFF2EB] text-[#FF5A36]'
            }`}>
              {seekers.length}
            </span>
          )}
        </button>
      </div>

      {/* 2. COMPACT 4-ITEM MOBILE SEGMENTED TAB CONTROL (Visible ONLY on mobile: lg:hidden) */}
      <div className="lg:hidden w-full mb-3.5">
        <nav
          aria-label="Owner dashboard tabs"
          className="w-full bg-[#EFEAE2] p-1 rounded-2xl border border-gray-200/80 grid grid-cols-4 gap-1 shadow-2xs"
        >
          {/* 1. OVERVIEW */}
          <button
            type="button"
            onClick={() => navigate('/owner-dashboard')}
            className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] min-[360px]:text-xs transition-all cursor-pointer min-w-0 ${
              activeTab === 'overview'
                ? 'bg-[#1E2229] text-white font-bold shadow-xs'
                : 'text-[#1E2229]/75 hover:text-[#1E2229] hover:bg-white/40 font-medium'
            }`}
          >
            <Home className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'overview' ? 'text-[#FF5A36]' : 'text-gray-500'}`} />
            <span className="truncate">Overview</span>
          </button>

          {/* 2. LISTINGS */}
          <button
            type="button"
            onClick={() => navigate('/owner-dashboard?tab=listings')}
            className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] min-[360px]:text-xs transition-all cursor-pointer min-w-0 ${
              activeTab === 'listings'
                ? 'bg-[#1E2229] text-white font-bold shadow-xs'
                : 'text-[#1E2229]/75 hover:text-[#1E2229] hover:bg-white/40 font-medium'
            }`}
          >
            <Building2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'listings' ? 'text-[#FF5A36]' : 'text-gray-500'}`} />
            <span className="truncate">Listings</span>
          </button>

          {/* 3. INQUIRIES */}
          <button
            type="button"
            onClick={() => navigate('/owner-dashboard?tab=applicants')}
            className={`relative flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] min-[360px]:text-xs transition-all cursor-pointer min-w-0 ${
              activeTab === 'applicants'
                ? 'bg-[#1E2229] text-white font-bold shadow-xs'
                : 'text-[#1E2229]/75 hover:text-[#1E2229] hover:bg-white/40 font-medium'
            }`}
          >
            <div className="relative shrink-0 flex items-center">
              <Users className={`w-3.5 h-3.5 ${activeTab === 'applicants' ? 'text-[#FF5A36]' : 'text-gray-500'}`} />
              {pendingApplicants.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#FF5A36] ring-1 ring-white" />
              )}
            </div>
            <span className="truncate">Inquiries</span>
          </button>

          {/* 4. SEEKERS */}
          <button
            type="button"
            onClick={() => navigate('/owner-dashboard?tab=seekers')}
            className={`flex items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] min-[360px]:text-xs transition-all cursor-pointer min-w-0 ${
              activeTab === 'seekers'
                ? 'bg-[#1E2229] text-white font-bold shadow-xs'
                : 'text-[#1E2229]/75 hover:text-[#1E2229] hover:bg-white/40 font-medium'
            }`}
          >
            <Compass className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'seekers' ? 'text-[#FF5A36]' : 'text-gray-500'}`} />
            <span className="truncate">Seekers</span>
          </button>
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* 1. DESKTOP VIEW (Visible on lg screens and up: hidden lg:flex) */}
      {/* ========================================================================= */}
      {activeTab !== 'seekers' && (
      <div className="hidden lg:flex flex-row gap-8 w-full">
        {/* BEGIN: Left Column (Desktop) */}
        <div className="flex-grow flex flex-col gap-6 max-w-5xl">

          {/* ========================================================================= */}
          {/* A. OVERVIEW SECTION (Desktop): Shown ONLY on Dashboard tab */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div id="overview-section" className="flex flex-col gap-6">
              {/* Getting Started Hero (when 0 properties listed) */}
              {allListings.length === 0 && (
                <div className="bg-gradient-to-br from-orange-50 via-white to-amber-50/50 rounded-3xl p-6 sm:p-7 border border-[#FF5A36]/20 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-5">
                  <div className="space-y-1.5 text-center sm:text-left">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/20">
                      <Sparkles className="w-3.5 h-3.5" /> Start Hosting on NestMate
                    </span>
                    <h3 className="font-serif text-xl sm:text-2xl font-medium text-[#1E2229]">
                      You haven't listed a room yet
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 max-w-lg leading-relaxed">
                      Publish your room or flat to start receiving verified tenant inquiries with lifestyle compatibility matching.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/edit-listing/new')}
                    className="px-6 py-3.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs sm:text-sm font-bold rounded-full transition-all flex items-center gap-2 shadow-sm shadow-[#FF5A36]/20 shrink-0 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ List Your First Room</span>
                  </button>
                </div>
              )}

              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* 1. Live Properties */}
                <div
                  onClick={() => navigate('/owner-dashboard?tab=listings')}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-xs hover:border-[#FF5A36]/30 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Properties</span>
                    <div className="w-9 h-9 rounded-2xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="font-serif text-3xl font-medium text-[#1E2229]">{allListings.length}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 group-hover:text-[#FF5A36] font-medium">
                    <span>{allListings.filter(l => l.status === 'active').length} Active</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </p>
                </div>

                {/* 2. Pending Requests */}
                <div
                  onClick={() => navigate('/owner-dashboard?tab=applicants')}
                  className={`bg-white rounded-3xl p-5 sm:p-6 border shadow-xs hover:shadow-md transition-all cursor-pointer group ${
                    pendingApplicants.length > 0 ? 'border-[#FF5A36]/30 bg-[#FFF2EB]/20' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Inquiries</span>
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${
                      pendingApplicants.length > 0 ? 'bg-[#FF5A36] text-white shadow-xs' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="font-serif text-3xl font-medium text-[#1E2229]">{pendingApplicants.length}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 group-hover:text-[#FF5A36] font-medium">
                    <span>{pendingApplicants.length > 0 ? 'Action needed' : 'All responded'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </p>
                </div>

                {/* 3. Messages */}
                <div
                  onClick={() => navigate('/chat')}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-xs hover:border-[#FF5A36]/30 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Messages</span>
                    <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="font-serif text-3xl font-medium text-[#1E2229]">{chatCount}</p>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 group-hover:text-teal-700 font-medium">
                    <span>Conversations</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </p>
                </div>

                {/* 4. Weekly Views */}
                <div
                  onClick={() => navigate('/owner-dashboard?tab=listings')}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-100 shadow-xs hover:border-[#FF5A36]/30 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Views</span>
                    <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="font-serif text-3xl font-medium text-[#1E2229]">{totalWeeklyViews}</p>
                    <span className="text-xs text-gray-400 font-medium">this week</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center justify-between group-hover:text-blue-700 font-medium">
                    <span>{totalAllTimeViews} all time</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </p>
                </div>
              </div>

              {/* Verification Gate Banner (if pending) */}
              {myListing && (myListing.status === 'pending_verification' || myListing.ownerVerified === false) && ownerVerification?.status !== 'APPROVED' && (
                <OwnerVerificationGate listingTitle={myListing.title} />
              )}

              {/* Urgent Requests / Action Center */}
              {pendingApplicants.length > 0 ? (
                <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-[#FF5A36]/20">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-[#FF5A36] animate-pulse" />
                      <h2 className="font-serif text-lg font-medium text-[#1E2229]">
                        Pending Requests ({pendingApplicants.length})
                      </h2>
                    </div>
                    <button
                      onClick={() => navigate('/owner-dashboard?tab=applicants')}
                      className="text-xs font-semibold text-[#FF5A36] hover:underline flex items-center gap-1"
                    >
                      Review all <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {rankedApplicants.slice(0, 2).map(applicant => {
                      const p = applicant.profile;
                      return (
                        <div
                          key={applicant.connection.id}
                          className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-[#FBFBFC]"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <UserAvatar src={p.avatar} name={p.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-[#1E2229] text-sm">{p.name}</h4>
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/20">
                                  {applicant.fit.score}% match
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5 font-medium">{p.profession || 'Roommate Seeker'} · Budget ₹{p.budget?.toLocaleString() || 'Flexible'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleAccept(applicant)}
                              disabled={!!processingApplicantId}
                              className="px-4 py-2 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" /> Accept
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <div className="bg-[#FFF2EB]/50 rounded-3xl p-5 sm:p-6 border border-[#FF5A36]/20 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center shrink-0 border border-[#FF5A36]/20">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1E2229] text-sm">Everything is up to date</h4>
                      <p className="text-xs text-gray-500 mt-0.5">No pending roommate requests right now. Your spaces are actively receiving views.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/owner-dashboard?tab=seekers')}
                    className="text-xs font-bold text-[#FF5A36] hover:underline shrink-0 hidden sm:block cursor-pointer bg-white px-4 py-2 rounded-full border border-[#FF5A36]/30 shadow-2xs"
                  >
                    Browse Seeking Roommates →
                  </button>
                </div>
              )}

              {/* Properties Overview Grid */}
              <section className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="font-serif text-xl font-medium text-[#1E2229]">Your Properties ({allListings.length})</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Quick summary of all active and listed rooms</p>
                  </div>
                  <button
                    onClick={() => navigate('/owner-dashboard?tab=listings')}
                    className="text-xs font-semibold text-[#FF5A36] hover:underline flex items-center gap-1"
                  >
                    Manage All <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {allListings.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allListings.map(listing => (
                      <div
                        key={listing.id}
                        className="p-4 rounded-2xl border border-gray-100 hover:border-[#FF5A36]/30 hover:shadow-xs transition-all flex flex-col justify-between gap-3 bg-[#FBFBFC]"
                      >
                        <div className="flex gap-3.5">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 shrink-0">
                            {listing.images && listing.images.length > 0 ? (
                              <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-[#1E2229] flex items-center justify-center text-white text-xs font-bold">
                                NestMate
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                listing.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {listing.status === 'active' ? 'LIVE' : 'PAUSED'}
                              </span>
                              <span className="text-[10px] text-gray-400 truncate">
                                {listing.flatType}
                              </span>
                            </div>
                            <h4 className="font-bold text-[#1E2229] text-sm truncate">{listing.title || `${listing.locality} Flat`}</h4>
                            <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-[#FF5A36] shrink-0" />
                              {listing.locality}, {listing.city}
                            </p>
                            <p className="text-xs font-bold text-[#1E2229] mt-1">
                              ₹{listing.totalRent?.toLocaleString() || '0'}<span className="text-[10px] font-normal text-gray-500">/mo</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2.5 border-t border-gray-200/60 text-xs">
                          <span className="text-gray-500 text-[11px]">{listing.views || 0} views</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => navigate(`/room/${listing.id}`)}
                              className="px-3 py-1 text-gray-600 hover:text-[#1E2229] hover:bg-white rounded-full font-semibold text-[11px] transition-colors flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              View
                            </button>
                            <button
                              onClick={() => navigate(`/edit-listing/${listing.id}`)}
                              className="px-3 py-1 text-gray-600 hover:text-[#1E2229] hover:bg-white rounded-full font-semibold text-[11px] transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                handleSelectListing(listing);
                                navigate('/owner-dashboard?tab=listings');
                              }}
                              className="px-3.5 py-1 bg-[#1E2229] text-white hover:bg-black rounded-full font-semibold text-[11px] transition-colors"
                            >
                              Manage →
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm mb-3">You don't have any properties listed yet.</p>
                    <button
                      onClick={() => navigate('/edit-listing/new')}
                      className="px-5 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-semibold rounded-full shadow-xs"
                    >
                      + Create Your First Listing
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* ========================================================================= */}
          {/* B. LISTINGS MANAGEMENT SECTION (Desktop): Shown ONLY on Listings tab */}
          {/* ========================================================================= */}
          {activeTab === 'listings' && (
            <div id="listings-section" className="flex flex-col gap-6">
              {/* Listing Selector Bar */}
              {allListings.length > 0 && (
            <div className="flex flex-row items-center justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-gray-100">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Select Space</label>
                  {hasDuplicateProperties && (
                    <button
                      onClick={handleCleanDuplicates}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 underline transition-colors"
                      title="Delete duplicate listings created during testing"
                    >
                      Remove Duplicates
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allListings.map((l, index) => {
                    const isDuplicateName = allListings.filter(x => x.locality === l.locality && x.flatType === l.flatType).length > 1;
                    const isSelected = myListing?.id === l.id;
                    return (
                      <div key={l.id} className="relative group">
                        <button
                          onClick={() => handleSelectListing(l)}
                          className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all flex items-center gap-2 ${isSelected
                            ? 'border-[#FF5A36] bg-[#FF5A36] text-white shadow-xs font-bold pr-8'
                            : 'border-gray-200 bg-white hover:border-[#FF5A36]/40 text-gray-700 pr-8'
                            }`}
                        >
                          <span>{l.title ? (l.title.length > 22 ? `${l.title.substring(0, 22)}...` : l.title) : `${l.locality} (${l.flatType})`}</span>
                          {isDuplicateName && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                              #{index + 1}
                            </span>
                          )}
                        </button>
                        {allListings.length > 1 && (
                          <button
                            onClick={(e) => handleDeleteSpecificListing(e, l.id)}
                            className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[10px] transition-all ${isSelected ? 'bg-white/30 text-white hover:bg-white/50' : 'bg-gray-200 text-gray-600 hover:bg-red-500 hover:text-white'
                              }`}
                            title="Delete this listing"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {ownerVerification?.status === 'APPROVED' ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-50 text-emerald-800 px-3.5 py-1.5 rounded-full border border-emerald-200 shadow-xs">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Identity Verified</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-800 px-3.5 py-1.5 rounded-full border border-amber-200 shadow-xs">
                    <Shield className="w-4 h-4 text-amber-600" />
                    <span>Verification Pending</span>
                  </div>
                )}
                <span className="text-xs text-[#FF5A36] font-semibold bg-[#FFF2EB] px-3.5 py-1.5 rounded-full border border-[#FF5A36]/20">
                  Unlimited Listings
                </span>
                <button
                  onClick={() => navigate('/edit-listing/new')}
                  className="px-5 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-semibold rounded-full transition-all flex items-center gap-2 shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add Property
                </button>
              </div>
            </div>
          )}

          {/* Verification Gate Banner — shown when listing requires identity verification */}
          {myListing && (myListing.status === 'pending_verification' || myListing.ownerVerified === false) && ownerVerification?.status !== 'APPROVED' && (
            <OwnerVerificationGate
              listingTitle={myListing.title}
            />
          )}

          {/* Desktop Hero Banner */}
          {myListing ? (
            <div className="relative rounded-3xl overflow-hidden shadow-md border border-gray-100 group">
              <div className="absolute inset-0">
                {myListing.images && myListing.images.length > 0 ? (
                  <img src={myListing.images[0]} alt="Listing cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#1E2229]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1E2229] via-[#1E2229]/80 to-[#1E2229]/30" />
              </div>

              <div className="relative p-8 pt-24 text-white flex flex-col justify-end min-h-[360px]">
                <div className="absolute top-6 right-6 flex flex-wrap justify-end gap-2.5 z-10">
                  {/* Status badge — shows PENDING VERIFICATION when ownerVerified is false */}
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 shadow-lg backdrop-blur-md ${
                    myListing.status === 'pending_verification' || myListing.ownerVerified === false
                      ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                      : myListing.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      myListing.status === 'pending_verification' || myListing.ownerVerified === false
                        ? 'bg-amber-400 animate-pulse'
                        : myListing.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`} />
                    {myListing.status === 'pending_verification' || myListing.ownerVerified === false
                      ? 'PENDING VERIFICATION'
                      : myListing.status === 'active' ? 'LIVE' : 'PAUSED'
                    }
                  </span>
                  {/* Toggle status button — disabled when listing requires verification */}
                  <button
                    onClick={handleToggleStatus}
                    disabled={myListing.status === 'pending_verification' || myListing.ownerVerified === false}
                    className={`p-2.5 backdrop-blur-md rounded-full transition-all border text-white ${
                      myListing.status === 'pending_verification' || myListing.ownerVerified === false
                        ? 'bg-black/20 border-white/5 opacity-40 cursor-not-allowed'
                        : 'bg-black/40 hover:bg-black/60 border-white/10'
                    }`}
                    title={myListing.status === 'pending_verification' ? 'Listing unavailable until identity is verified' : (myListing.status === 'active' ? 'Pause Listing' : 'Resume Listing')}
                  >
                    {myListing.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button onClick={() => navigate(`/edit-listing/${myListing.id}`)} className="p-2.5 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-all border border-white/10 text-white" title="Edit Listing">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="p-2.5 bg-red-500/40 backdrop-blur-md rounded-full hover:bg-red-500/60 transition-all border border-red-500/50 text-white" title="Delete Listing">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Sprint 2A: availability confirmation strip */}
                {(() => {
                  const avail = getAvailabilityState(myListing);
                  const confirmedAgo = formatRelativeDays(getFreshnessAnchorMs(myListing));
                  return (
                    <div className="absolute top-6 left-6 flex flex-col items-start gap-2 z-10">
                      <span className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md border shadow-lg ${avail === 'available' ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' : 'bg-amber-500/25 text-amber-100 border-amber-300/40'}`}>
                        {avail === 'available'
                          ? `Available · confirmed ${confirmedAgo}`
                          : avail === 'needs_confirmation'
                            ? 'Availability needs confirmation'
                            : 'No longer available'}
                      </span>
                      <div className="flex items-center gap-2">
                        {(avail === 'needs_confirmation' || avail === 'expired' || myListing.status === 'active') && (
                          <button onClick={handleConfirmAvailability} className="px-4 py-1.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-semibold rounded-full shadow-md transition-all">
                            Confirm Available
                          </button>
                        )}
                        {avail !== 'closed' && (
                          <button onClick={handleCloseListing} className="px-4 py-1.5 bg-black/40 hover:bg-black/60 text-white text-xs font-semibold rounded-full backdrop-blur-md border border-white/20 transition-all">
                            Room filled — mark unavailable
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="mb-6">
                  <h2 className="font-serif text-3xl sm:text-4xl font-medium mb-2 leading-tight drop-shadow-md">{myListing.title}</h2>
                  <p className="text-sm text-gray-200 flex items-center gap-1.5 drop-shadow font-medium">
                    <MapPin className="w-4 h-4 text-[#FF5A36] shrink-0" /> {myListing.locality}, {myListing.city}
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-center shadow-sm">
                    <p className="text-2xl font-bold">{pendingApplicants.length}</p>
                    <p className="text-[11px] text-gray-300 font-medium uppercase tracking-wider">Applicants</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-center shadow-sm">
                    <p className="text-2xl font-bold">{myListing.views || 0}</p>
                    <p className="text-[11px] text-gray-300 font-medium uppercase tracking-wider">Views</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 flex flex-col items-center justify-center shadow-sm">
                    <p className="text-2xl font-bold">{chatCount}</p>
                    <p className="text-[11px] text-slate-300 font-medium uppercase tracking-wider">Chats</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex flex-col items-center justify-center shadow-sm">
                    <p className="text-2xl font-bold">{selectedListingWeeklyViews}</p>
                    <p className="text-[11px] text-slate-300 font-medium uppercase tracking-wider">This Week</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-sm">
                  <div className="flex flex-col">
                    <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wider mb-0.5">Rent</p>
                    <p className="font-bold text-xl text-white truncate">₹{myListing.totalRent?.toLocaleString() || (myListing as any).monthlyRent?.toLocaleString() || '—'}</p>
                  </div>
                  <div className="flex flex-col border-l border-white/20 pl-3">
                    <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wider mb-0.5">Deposit</p>
                    <p className="font-bold text-xl text-brand-orange truncate">₹{myListing.deposit?.toLocaleString() || '—'}</p>
                  </div>
                  <div className="flex flex-col border-l border-white/20 pl-3">
                    <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wider mb-0.5">Type</p>
                    <p className="font-bold text-xl text-brand-tealLight truncate">{myListing.flatType}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <section
              className="bg-brand-navy rounded-2xl relative overflow-hidden flex flex-col items-center justify-center text-center p-12 min-h-[360px] shadow-sm text-white"
              style={{
                backgroundImage: 'linear-gradient(rgba(26, 35, 58, 0.7), rgba(26, 35, 58, 0.7)), url("https://lh3.googleusercontent.com/aida-public/AB6AXuBsQUA9QfqJ5_EhVOmV_3MNyJsHJRxcXz53agqOSoREbJWJuddao9qhrnUWYR2sni8gQnLmQ2UbjPfU9NxESk4ibTRDj5jC9XX-otGv5dn2J9_6NdY3lxiqor8wLlNlU5nXTVq3UE3V97LuOB2o7dTgz45GO7B310Rg5RRpj44ygnTM-tUWb-TLPwUL_lI52YL2oCv3wZI7XNjYknK9fdFCCu4Dx1-krJG-Kruxv5L-EHqI5XCC15bplchWcfEiMS7JeA")',
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
              }}
            >
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute top-10 right-20 w-32 h-32 rounded-full border-4 border-white/20"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[150%] bg-gradient-to-tr from-white/5 to-transparent rounded-full blur-3xl"></div>
              </div>
              <div className="relative z-10 flex flex-row items-center gap-8 w-full max-w-5xl">
                <div className="w-full flex flex-col text-center items-center justify-center">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6 border border-white/20">
                    <FileText className="w-5 h-5 text-brand-orange" />
                  </div>
                  {/* Sprint 5B: dashboard headings use the sans voice */}
                  <h1 className="type-h1 text-white mb-4">No listing yet</h1>
                  <p className="text-slate-300 mb-8 text-base leading-relaxed max-w-md mx-auto text-center">
                    Create your first listing to start finding great roommates and manage your property with ease.
                  </p>
                  <button
                    onClick={() => navigate('/edit-listing/new')}
                    className="bg-brand-orange hover:bg-orange-600 text-white px-8 py-4 rounded-xl font-semibold flex items-center gap-3 transition-all transform hover:scale-[1.02] shadow-lg shadow-orange-500/30 text-base"
                  >
                    Create Listing
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </section>
          )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* C. APPLICANTS SECTION (Desktop): Shown ONLY on Applicants tab */}
          {/* ========================================================================= */}
          {activeTab === 'applicants' && (
            <div id="applicants-section" className="flex flex-col gap-6">
              {/* Pending Requests (Desktop) */}
              <section className={`bg-white rounded-3xl p-6 sm:p-8 shadow-xs border flex flex-col justify-between min-h-[280px] relative ${pendingApplicants.length > 0 ? 'border-[#FF5A36]/30' : 'border-gray-100'}`}>
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-serif text-xl font-medium text-[#1E2229]">
                        Pending Inquiries ({pendingApplicants.length})
                      </h2>
                      <p className="text-xs text-gray-400">Prospective verified roommates awaiting your response</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pendingApplicants.length > 1 && (
                      <button
                        onClick={() => {
                          const ids = pendingApplicants.map(a => a.profile.uid || a.connection.fromUserId).filter(Boolean).slice(0, 3).join(',');
                          const lQuery = myListing?.id ? `&listingId=${myListing.id}` : '';
                          navigate(ids ? `/applicants/compare?ids=${ids}${lQuery}` : '/applicants/compare');
                        }}
                        className="px-3.5 py-1.5 border border-[#FF5A36]/30 text-[#FF5A36] bg-[#FFF2EB] hover:bg-[#FFE5D6] rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                      >
                        <Users className="w-3.5 h-3.5" /> Compare Applicants
                      </button>
                    )}
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#FBFBFC] text-gray-700">
                      {pendingApplicants.length} pending review
                    </span>
                  </div>
                </div>

            {pendingApplicants.length > 0 ? (
              <div className="w-full space-y-3.5">
                {rankedApplicants.map(applicant => {
                  const p = applicant.profile;
                  const isHighlighted = highlightedRequestId === applicant.connection.id;
                  return (
                    <div
                      key={applicant.connection.id}
                      id={`request-${applicant.connection.id}`}
                      className={`flex flex-row items-center justify-between gap-4 p-5 rounded-3xl border transition-all ${isHighlighted
                        ? 'bg-[#FFF2EB]/50 border-[#FF5A36]/40 shadow-sm'
                        : 'bg-[#FBFBFC] border-gray-100 hover:border-gray-200'
                        }`}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <UserAvatar src={p.avatar} name={p.name} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs shrink-0" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold text-[#1E2229] text-base">{p.name}</h4>
                            {isHighlighted && (
                              <span className="text-[10px] font-bold bg-[#FF5A36] text-white px-2 py-0.5 rounded-full">New!</span>
                            )}
                            {p.workEmailVerified && <span title="Corporate Verified"><CheckCircle2 className="w-4 h-4 text-blue-500" /></span>}
                            {p.isVerified && <span title="ID Verified"><Shield className="w-4 h-4 text-emerald-600" /></span>}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">{p.profession || 'Roommate Seeker'} · Budget: ₹{p.budget?.toLocaleString() || 'Flexible'}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 font-medium">Move-in: {p.moveInDate || 'Flexible'}</p>
                          {(() => {
                            const req = getRequestedListing(applicant.connection);
                            if (!req) return null;
                            const label = req.title ? (req.title.length > 34 ? `${req.title.slice(0, 34)}…` : req.title) : `${req.locality}, ${req.city}`;
                            return (
                              <p className="text-[11px] text-gray-600 mt-1 flex items-center gap-1.5 font-medium">
                                <Home className="w-3.5 h-3.5 text-[#FF5A36] shrink-0" /> Interested in: <span className="font-semibold text-[#1E2229]">{label}</span>
                              </p>
                            );
                          })()}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/20">
                              {applicant.fit.score}% match
                            </span>
                            {applicant.fit.reasons.slice(0, 2).map(r => (
                              <span key={r} className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 inline-flex items-center gap-1"><Check className="w-2.5 h-2.5 text-emerald-600" />{r}</span>
                            ))}
                            {applicant.fit.caveats.length > 0 && (
                              <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-medium">{applicant.fit.caveats[0]}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {applicant.connection.screeningAnswers && Object.keys(applicant.connection.screeningAnswers).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedScreeningApplicant(applicant)}
                            className="px-3.5 py-2 border border-orange-200 bg-orange-50/60 hover:bg-orange-100 text-[#FF5A36] rounded-full text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                            title="View Questionnaire Responses"
                          >
                            <FileText className="w-3.5 h-3.5" /> Answers ({Object.keys(applicant.connection.screeningAnswers).length})
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/match/${p.uid || applicant.connection.fromUserId}`)}
                          className="px-4 py-2 border border-gray-200 rounded-full text-gray-700 hover:bg-white transition-all text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                          title="View Profile"
                        >
                          <User className="w-3.5 h-3.5" /> Profile
                        </button>
                        <button
                          onClick={() => handleReject(applicant)}
                          disabled={!!processingApplicantId}
                          className="p-2.5 border border-red-200 rounded-full text-red-500 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAccept(applicant)}
                          disabled={!!processingApplicantId}
                          className="px-5 py-2 bg-[#FF5A36] text-white rounded-full font-semibold hover:bg-[#E54E2B] transition-all text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Accept & Chat"
                        >
                          <Check className="w-3.5 h-3.5" /> {processingApplicantId === applicant.connection.id ? 'Accepting...' : 'Accept'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center my-auto py-8">
                <div className="w-16 h-16 bg-[#FFF2EB] rounded-3xl flex items-center justify-center mb-4 text-[#FF5A36]">
                  <Mail className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-lg font-medium text-[#1E2229] mb-1">No pending requests</h3>
                <p className="text-gray-400 text-xs max-w-sm">
                  {myListing ? 'Your listing is live. Roommate requests will appear here.' : 'Create a listing to start receiving roommate requests.'}
                </p>
              </div>
            )}
          </section>

          {/* My Connections (Desktop) */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-gray-100 flex flex-col justify-between min-h-[280px] relative">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-medium text-[#1E2229]">My Connections ({acceptedConnections.length})</h3>
                  <p className="text-xs text-gray-400">Accepted applicants with active conversations</p>
                </div>
              </div>
              <button onClick={() => navigate('/chat')} className="text-xs font-semibold text-[#FF5A36] hover:underline">View all</button>
            </div>

            {acceptedConnections.length > 0 ? (
              <div className="w-full space-y-3.5">
                {acceptedConnections.map(conn => {
                  const p = conn.profile;
                  return (
                    <div
                      key={conn.connection.id}
                      className="flex flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 bg-[#FBFBFC] transition-all"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <UserAvatar src={p.avatar} name={p.name} className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-[#1E2229] text-sm">{p.name}</h4>
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1"><Check className="w-3 h-3" />Connected</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{p.profession || 'Roommate'}{p.city ? ` · ${p.city}` : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => navigate(`/match/${p.uid || conn.connection.fromUserId}`)}
                          className="px-3.5 py-2 border border-gray-200 text-gray-700 rounded-full text-xs font-semibold hover:bg-white transition-all flex items-center gap-1.5"
                        >
                          <User className="w-3.5 h-3.5" /> Profile
                        </button>
                        <button
                          onClick={async () => {
                            if (!user?.uid) return;
                            const targetId = p.uid || conn.connection.fromUserId;
                            const roomId = await getOrCreateChatRoom(user.uid, targetId);
                            navigate(`/chat/${roomId}`);
                          }}
                          className="px-4 py-2 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 shadow-xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center my-auto py-8">
                <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center mb-4 text-emerald-600">
                  <Users className="w-7 h-7" />
                </div>
                <h3 className="font-serif text-lg font-medium text-[#1E2229] mb-1">No accepted connections yet</h3>
                <p className="text-gray-400 text-xs">Accept incoming requests to connect with your future roommates.</p>
              </div>
            )}
          </section>
            </div>
          )}
        </div>
        {/* END: Left Column (Desktop) */}

        {/* BEGIN: Right Sidebar (Desktop) */}
        <div className="w-[380px] shrink-0 flex flex-col gap-6">
          {/* Weekly Views Analytics (Desktop) */}
          {(activeTab === 'overview' || activeTab === 'listings') && (
            <section className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100 relative">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-serif text-lg font-medium text-[#1E2229]">Weekly Views</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Last 7 days visitor traffic</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-[#1E2229] block">{totalWeeklyViews} this week</span>
                  <button
                    type="button"
                    onClick={() => setShowTrafficChart(!showTrafficChart)}
                    className="text-[11px] font-semibold text-[#FF5A36] hover:underline flex items-center gap-1 mt-0.5 cursor-pointer ml-auto"
                  >
                    {showTrafficChart ? 'Hide Chart' : 'Show Chart'}
                    <ChevronDown className={`w-3 h-3 transition-transform ${showTrafficChart ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              {showTrafficChart && (
                totalWeeklyViews > 0 ? (
                  <div className="h-32 mb-6 animate-in fade-in duration-200">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={displayWeeklyViews} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                        <XAxis
                          dataKey="day"
                          tick={({ x, y, payload }) => {
                            const item = displayWeeklyViews.find(d => d.day === payload.value);
                            const isToday = item?.isToday;
                            return (
                              <text
                                x={x}
                                y={y + 12}
                                textAnchor="middle"
                                fill={isToday ? '#FF5A36' : '#94a3b8'}
                                fontWeight={isToday ? 700 : 400}
                                fontSize={11}
                              >
                                {isToday ? 'Today' : payload.value}
                              </text>
                            );
                          }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ fontSize: 12, borderRadius: 16, border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                          formatter={(v: number) => [v, 'Views']}
                          labelFormatter={(label, payload) => {
                            const item = payload?.[0]?.payload as WeeklyViewItem;
                            return item ? `${item.day} (${item.date})${item.isToday ? ' - Today' : ''}` : label;
                          }}
                        />
                        <Bar dataKey="views" radius={[6, 6, 0, 0]}>
                          {displayWeeklyViews.map((d, i) => (
                            <Cell
                              key={d.date || i}
                              fill={d.isToday ? '#FF5A36' : d.views > 0 ? '#FB923C' : '#FBFBFC'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center mb-6 py-4 animate-in fade-in duration-200">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-3">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-[#1E2229] text-sm mb-1">No views yet this week</h4>
                    <p className="text-gray-400 text-xs max-w-[240px]">
                      Share your listing or complete verification to boost your search presence.
                    </p>
                  </div>
                )
              )}

              <div className="flex justify-between items-end border-t border-gray-100 pt-4 px-2">
                {displayWeeklyViews.map(d => (
                  <div key={d.date} className="flex flex-col items-center gap-1">
                    <span className={`text-xs ${d.isToday ? 'font-bold text-[#FF5A36]' : 'text-gray-400'}`}>
                      {d.isToday ? 'Today' : d.day}
                    </span>
                    <span className={`text-sm font-semibold ${d.isToday ? 'font-bold text-[#FF5A36]' : 'text-gray-700'}`}>
                      {d.views}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Quick Actions (Desktop) */}
          <section className="bg-white rounded-3xl p-6 shadow-xs border border-gray-100">
            <h3 className="font-serif text-lg font-medium text-[#1E2229] mb-4">Quick Actions</h3>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => navigate('/chat')}
                className="flex items-center p-3.5 rounded-2xl hover:bg-[#FBFBFC] transition group border border-gray-100 w-full text-left"
              >
                <div className="w-11 h-11 rounded-2xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center mr-3.5 group-hover:bg-[#FF5A36] group-hover:text-white transition shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-[#1E2229] text-sm">Messages</h4>
                  <p className="text-gray-400 text-xs">View all conversations</p>
                </div>
                {chatCount > 0 && (
                  <span className="bg-[#FF5A36] text-white text-xs font-bold px-2 py-0.5 rounded-full mr-2">
                    {chatCount}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {myListing && (
                <button
                  onClick={() => navigate(`/edit-listing/${myListing.id}`)}
                  className="flex items-center p-3 rounded-2xl hover:bg-slate-50 transition group border border-slate-50 w-full text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mr-4 group-hover:bg-teal-100 transition shrink-0">
                    <Edit3 className="w-5 h-5 text-brand-teal" />
                  </div>
                  <div className="flex-grow">
                    <h4 className="font-bold text-slate-900 text-sm">Edit Listing</h4>
                    <p className="text-slate-500 text-xs">Update photos & details</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              )}

              <button
                onClick={() => navigate('/settings')}
                className="flex items-center p-3 rounded-2xl hover:bg-slate-50 transition group border border-slate-50 w-full text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mr-4 group-hover:bg-slate-200 transition shrink-0">
                  <Settings className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-slate-900 text-sm">Settings</h4>
                  <p className="text-slate-500 text-xs">Account & preferences</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </section>

          {/* Quick Tip (Desktop) */}
          <section className="bg-brand-navy rounded-2xl p-6 shadow-sm border border-border text-white">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-brand-orange" />
              <h3 className="type-h3">Quick Tip</h3>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
              Applicants who hear back quickly are more likely to stay engaged — responding sooner helps you secure the right roommate.
            </p>
          </section>
        </div>
        {/* END: Right Sidebar (Desktop) */}
      </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MOBILE VIEW (Visible ONLY on mobile/tablet screens: lg:hidden) */}
      {/* ========================================================================= */}
      {activeTab !== 'seekers' && (
      <div className="flex lg:hidden flex-col gap-4 w-full">

        {/* ========================================================================= */}
        {/* A. OVERVIEW SECTION (Mobile): Shown ONLY on Dashboard tab */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div id="overview-section-mobile" className="flex flex-col gap-3.5 pb-20">

            {/* 1. OWNER STATUS CARD (Dynamic, Navy/Orange/Warm White, compact) */}
            {pendingApplicants.length > 0 ? (
              <div className="bg-[#1E2229] text-white rounded-2xl p-4 shadow-sm border border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center shrink-0 shadow-xs">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#FF5A36] animate-pulse shrink-0" />
                      <h4 className="font-bold text-xs sm:text-sm truncate">
                        {pendingApplicants.length} Request{pendingApplicants.length > 1 ? 's' : ''} Awaiting Review
                      </h4>
                    </div>
                    <p className="text-[11px] text-gray-300 truncate mt-0.5 font-medium">
                      Prospective roommates are waiting for your response.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/owner-dashboard?tab=applicants')}
                  className="px-3.5 py-1.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 shadow-xs"
                >
                  Review →
                </button>
              </div>
            ) : (
              <div className="bg-[#1E2229] text-white rounded-2xl p-4 shadow-sm border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-[#FF5A36] flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-white">Everything is up to date</h4>
                    <p className="text-[11px] text-gray-300 mt-0.5">No pending roommate requests right now.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/owner-dashboard?tab=seekers')}
                  className="self-start sm:self-auto text-xs font-bold text-[#1E2229] bg-white hover:bg-[#FBFBFC] px-3.5 py-1.5 rounded-full shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
                >
                  Browse Seeking Roommates →
                </button>
              </div>
            )}

            {/* Verification Gate Banner (Mobile) if pending */}
            {myListing && (myListing.status === 'pending_verification' || myListing.ownerVerified === false) && ownerVerification?.status !== 'APPROVED' && (
              <OwnerVerificationGate listingTitle={myListing.title} />
            )}

            {/* 2. PRIMARY OWNER ACTION CARD */}
            {allListings.length === 0 ? (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-xs flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-[#1E2229]">Start Hosting on NestMate</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">List your room or flat to get verified inquiries.</p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/edit-listing/new')}
                  className="px-4 py-2 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-bold rounded-full transition-all flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>List Your Room</span>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-gray-100 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-[#1E2229] truncate">
                      {allListings.length} {allListings.length === 1 ? 'Property' : 'Properties'} Listed
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 truncate font-medium">
                      {allListings.filter(l => l.status === 'active').length} active space(s) accepting seekers
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => navigate('/owner-dashboard?tab=listings')}
                    className="px-3.5 py-1.5 bg-[#1E2229] hover:bg-[#2A2A44] text-white text-xs font-bold rounded-full transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Building2 className="w-3 h-3 text-[#FF5A36]" />
                    <span>Manage Listing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/edit-listing/new')}
                    className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-all cursor-pointer active:scale-95"
                    title="Add another space"
                    aria-label="Add Space"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 4 KPI Summary Cards (Mobile) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <div
                onClick={() => navigate('/owner-dashboard?tab=listings')}
                className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs hover:border-[#FF5A36]/40 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Properties</span>
                  <div className="w-7 h-7 rounded-xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="font-serif text-xl sm:text-2xl font-medium text-[#1E2229]">{allListings.length}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{allListings.filter(l => l.status === 'active').length} Active</p>
              </div>

              <div
                onClick={() => navigate('/owner-dashboard?tab=applicants')}
                className={`bg-white rounded-2xl p-3.5 border shadow-xs hover:border-[#FF5A36]/40 transition-all cursor-pointer ${
                  pendingApplicants.length > 0 ? 'border-[#FF5A36]/30 bg-[#FFF2EB]/20' : 'border-gray-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Inquiries</span>
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    pendingApplicants.length > 0 ? 'bg-[#FF5A36] text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="font-serif text-xl sm:text-2xl font-medium text-[#1E2229]">{pendingApplicants.length}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{pendingApplicants.length > 0 ? 'Action needed' : 'All clear'}</p>
              </div>

              <div
                onClick={() => navigate('/chat')}
                className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs hover:border-[#FF5A36]/40 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Messages</span>
                  <div className="w-7 h-7 rounded-xl bg-orange-50 text-[#FF5A36] flex items-center justify-center">
                    <MessageCircle className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="font-serif text-xl sm:text-2xl font-medium text-[#1E2229]">{chatCount}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Conversations</p>
              </div>

              <div
                onClick={() => navigate('/owner-dashboard?tab=listings')}
                className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs hover:border-[#FF5A36]/40 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Views</span>
                  <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="font-serif text-xl sm:text-2xl font-medium text-[#1E2229]">{totalWeeklyViews}</p>
                  <span className="text-[10px] text-gray-400 font-medium">week</span>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 font-medium">{totalAllTimeViews} all time</p>
              </div>
            </div>

            {/* 3. LISTING / PROPERTY STATUS */}
            <section className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-serif text-base font-medium text-[#1E2229]">Your Properties ({allListings.length})</h3>
                <button
                  onClick={() => navigate('/owner-dashboard?tab=listings')}
                  className="text-xs font-semibold text-[#FF5A36] flex items-center gap-0.5"
                >
                  Manage <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {allListings.length > 0 ? (
                <div className="space-y-2.5">
                  {allListings.slice(0, 3).map(listing => (
                    <div
                      key={listing.id}
                      className="p-3 rounded-xl border border-gray-100 bg-[#FBFBFC] flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                          {listing.images && listing.images.length > 0 ? (
                            <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[#1E2229] flex items-center justify-center text-white text-[10px] font-bold">
                              NestMate
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-[#1E2229] text-xs truncate">{listing.title || `${listing.locality} Flat`}</h4>
                          <p className="text-[10px] text-gray-500 truncate font-medium">{listing.locality} · ₹{listing.totalRent?.toLocaleString('en-IN')}/mo</p>
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded-md mt-0.5 uppercase ${
                            listing.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {listing.status === 'active' ? 'Live' : 'Paused'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleSelectListing(listing);
                          navigate('/owner-dashboard?tab=listings');
                        }}
                        className="px-3 py-1.5 bg-[#1E2229] text-white rounded-full text-[11px] font-bold shrink-0 shadow-2xs active:scale-95"
                      >
                        Manage
                      </button>
                    </div>
                  ))}
                  {allListings.length > 3 && (
                    <button
                      onClick={() => navigate('/owner-dashboard?tab=listings')}
                      className="w-full py-2 text-center text-xs font-bold text-[#FF5A36] hover:underline"
                    >
                      + {allListings.length - 3} more properties
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 px-4">
                  <div className="w-10 h-10 bg-[#FFF2EB] text-[#FF5A36] rounded-2xl flex items-center justify-center mx-auto mb-2.5">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-xs text-[#1E2229] mb-1">No properties listed yet</h4>
                  <p className="text-[11px] text-gray-400 mb-3.5">List your room to connect with verified roommates in your area.</p>
                  <button
                    onClick={() => navigate('/edit-listing/new')}
                    className="px-4 py-2 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-bold rounded-full shadow-xs inline-flex items-center gap-1 active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" /> List Your Room
                  </button>
                </div>
              )}
            </section>

            {/* 4. SEEKER ACTIVITY PREVIEW (Requirement 2 & 5 & 12) */}
            <section className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-medium text-[#1E2229]">
                    Room Seekers Looking Now
                  </h3>
                  {filteredSeekers.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF2EB] text-[#FF5A36]">
                      {filteredSeekers.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => navigate('/owner-dashboard?tab=seekers')}
                  className="text-xs font-semibold text-[#FF5A36] flex items-center gap-0.5"
                >
                  Browse All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {loadingSeekers ? (
                <div className="py-6 text-center text-xs text-gray-400">Loading active room seekers...</div>
              ) : filteredSeekers.length > 0 ? (
                <div className="space-y-3">
                  {filteredSeekers.slice(0, 2).map(({ profile: s, score }) => (
                    <OwnerSeekerCard
                      key={s.uid}
                      seeker={s}
                      score={score}
                      ownerListing={myListing}
                      onChat={handleChatSeeker}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => navigate('/owner-dashboard?tab=seekers')}
                    className="w-full py-2.5 bg-[#FFF2EB] hover:bg-[#FFE5D6] text-[#FF5A36] rounded-xl text-xs font-bold transition-all text-center flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                  >
                    Browse Seeking Roommates ({filteredSeekers.length} active) →
                  </button>
                </div>
              ) : (
                <div className="text-center py-6 px-4">
                  <div className="w-10 h-10 bg-[#FFF2EB] text-[#FF5A36] rounded-2xl flex items-center justify-center mx-auto mb-2.5">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-xs text-[#1E2229] mb-1">Browse verified room seekers</h4>
                  <p className="text-[11px] text-gray-400 mb-3.5">Discover roommate candidates looking for rooms in your area.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/owner-dashboard?tab=seekers')}
                    className="px-4 py-2 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-bold rounded-full shadow-xs inline-flex items-center gap-1 active:scale-95"
                  >
                    Browse Seeking Roommates →
                  </button>
                </div>
              )}
            </section>

            {/* 5. APPLICATIONS / INQUIRIES PREVIEW (Requirement 5 & 12 & 13) */}
            <section className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-medium text-[#1E2229]">
                    Recent Inquiries ({pendingApplicants.length})
                  </h3>
                </div>
                {pendingApplicants.length > 0 && (
                  <button
                    onClick={() => navigate('/owner-dashboard?tab=applicants')}
                    className="text-xs font-semibold text-[#FF5A36] flex items-center gap-0.5"
                  >
                    View all <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {pendingApplicants.length > 0 ? (
                <div className="space-y-2.5">
                  {rankedApplicants.slice(0, 2).map(applicant => {
                    const p = applicant.profile;
                    return (
                      <div
                        key={applicant.connection.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-[#FBFBFC]"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar src={p.avatar} name={p.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                          <div className="min-w-0">
                            <h4 className="font-bold text-[#1E2229] text-xs truncate">{p.name}</h4>
                            <p className="text-[10px] text-gray-500 truncate font-medium">{applicant.fit.score}% match · ₹{p.budget?.toLocaleString('en-IN') || 'Flex'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleReject(applicant)}
                            disabled={!!processingApplicantId}
                            className="p-1.5 border border-red-200 text-red-500 hover:bg-red-50 rounded-full cursor-pointer active:scale-95"
                            title="Decline"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleAccept(applicant)}
                            disabled={!!processingApplicantId}
                            className="px-3 py-1.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-semibold transition-all flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                          >
                            <Check className="w-3 h-3" /> Accept
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-5 px-4">
                  <div className="w-10 h-10 bg-gray-100 text-gray-500 rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <Mail className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-xs text-[#1E2229] mb-0.5">No pending roommate requests</h4>
                  <p className="text-[11px] text-gray-400">When seekers apply to your listing, they will appear here.</p>
                </div>
              )}
            </section>

            {/* 6. MESSAGES & CONNECTIONS PREVIEW (Requirement 5 & 12) */}
            <section className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-serif text-base font-medium text-[#1E2229]">Messages &amp; Chats</h3>
                <button
                  onClick={() => navigate('/chat')}
                  className="text-xs font-semibold text-[#FF5A36] flex items-center gap-0.5"
                >
                  Open Chats <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div
                onClick={() => navigate('/chat')}
                className="p-3 rounded-xl border border-gray-100 bg-[#FBFBFC] flex items-center justify-between gap-3 cursor-pointer hover:border-[#FF5A36]/30 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-[#1E2229] text-xs truncate">
                      {chatCount > 0 ? `${chatCount} Active Conversation${chatCount === 1 ? '' : 's'}` : 'No active chats'}
                    </h4>
                    <p className="text-[10px] text-gray-500 truncate mt-0.5">
                      {chatCount > 0 ? 'Tap to view your ongoing roommate discussions' : 'Chat with seekers or accepted applicants'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </div>

              {acceptedConnections.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Connected Roommates</span>
                  <div className="space-y-2">
                    {acceptedConnections.slice(0, 1).map(conn => {
                      const p = conn.profile;
                      return (
                        <div key={conn.connection.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar src={p.avatar} name={p.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                            <span className="font-bold text-xs text-[#1E2229] truncate">{p.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!user?.uid) return;
                              const targetId = p.uid || conn.connection.fromUserId;
                              const roomId = await getOrCreateChatRoom(user.uid, targetId);
                              navigate(`/chat/${roomId}`);
                            }}
                            className="px-3 py-1 bg-[#1E2229] text-white rounded-full text-[11px] font-bold shadow-2xs cursor-pointer"
                          >
                            Chat
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* 7. WEEKLY VIEWS ANALYTICS (Requirement 5 & 12) */}
            <section className="bg-white rounded-2xl p-4 shadow-xs border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center text-blue-700 shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-sm font-medium text-[#1E2229]">Weekly Views</h3>
                    <p className="text-[10px] text-gray-400">Last 7 days traffic</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#1E2229] block">{totalWeeklyViews} this week</span>
                  <span className="text-[10px] text-gray-400">{totalAllTimeViews} all time</span>
                </div>
              </div>

              {displayWeeklyViews.some(d => d.views > 0) ? (
                <div className="h-32 w-full my-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayWeeklyViews} margin={{ top: 8, right: 5, left: -25, bottom: 0 }}>
                      <XAxis
                        dataKey="day"
                        tick={({ x, y, payload }) => {
                          const item = displayWeeklyViews.find(d => d.day === payload.value);
                          const isToday = item?.isToday;
                          return (
                            <text
                              x={x}
                              y={y + 11}
                              textAnchor="middle"
                              fill={isToday ? '#FF5A36' : '#94a3b8'}
                              fontWeight={isToday ? 700 : 400}
                              fontSize={9}
                            >
                              {isToday ? 'Today' : payload.value}
                            </text>
                          );
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                        formatter={(v: number) => [v, 'Views']}
                      />
                      <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                        {displayWeeklyViews.map((d, i) => (
                          <Cell
                            key={d.date || i}
                            fill={d.isToday ? '#FF5A36' : d.views > 0 ? '#FB923C' : '#FBFBFC'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-center text-gray-400 py-3">No views recorded yet this week.</p>
              )}
            </section>

            {/* 8. SECONDARY ACTIONS (Requirement 5) */}
            <section className="bg-white rounded-2xl p-3 shadow-xs border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block px-2 mb-1.5">Quick Tools</span>
              <div className="grid grid-cols-2 gap-2">
                {myListing && (
                  <button
                    onClick={() => navigate(`/edit-listing/${myListing.id}`)}
                    className="p-2.5 rounded-xl border border-gray-100 bg-[#FBFBFC] hover:bg-white flex items-center gap-2 text-left transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#FF5A36] shrink-0" />
                    <span className="text-xs font-semibold text-[#1E2229] truncate">Edit Listing</span>
                  </button>
                )}
                {pendingApplicants.length > 1 && (
                  <button
                    onClick={() => {
                      const ids = pendingApplicants.map(a => a.profile.uid || a.connection.fromUserId).filter(Boolean).slice(0, 3).join(',');
                      const lQuery = myListing?.id ? `&listingId=${myListing.id}` : '';
                      navigate(ids ? `/applicants/compare?ids=${ids}${lQuery}` : '/applicants/compare');
                    }}
                    className="p-2.5 rounded-xl border border-gray-100 bg-[#FBFBFC] hover:bg-white flex items-center gap-2 text-left transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="text-xs font-semibold text-[#1E2229] truncate">Compare</span>
                  </button>
                )}
                <button
                  onClick={() => navigate('/settings')}
                  className="p-2.5 rounded-xl border border-gray-100 bg-[#FBFBFC] hover:bg-white flex items-center gap-2 text-left transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  <span className="text-xs font-semibold text-[#1E2229] truncate">Settings</span>
                </button>
                <button
                  onClick={() => navigate('/safety')}
                  className="p-2.5 rounded-xl border border-gray-100 bg-[#FBFBFC] hover:bg-white flex items-center gap-2 text-left transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-semibold text-[#1E2229] truncate">Safety Center</span>
                </button>
              </div>
            </section>

          </div>
        )}

        {/* ========================================================================= */}
        {/* B. LISTINGS MANAGEMENT SECTION (Mobile): Shown ONLY on Listings tab */}
        {/* ========================================================================= */}
        {activeTab === 'listings' && (
          <div id="listings-section-mobile" className="flex flex-col gap-4">
            {/* Listing Selector Bar (Mobile) */}
            {allListings.length > 0 && (
          <div className="flex flex-col items-start justify-between gap-3 bg-white rounded-3xl p-5 shadow-xs border border-gray-100">
            <div className="w-full">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Select Space</label>
                {hasDuplicateProperties && (
                  <button
                    onClick={handleCleanDuplicates}
                    className="text-xs font-semibold text-red-500 hover:text-red-600 underline transition-colors"
                  >
                    Remove Duplicates
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allListings.map((l, index) => {
                  const isDuplicateName = allListings.filter(x => x.locality === l.locality && x.flatType === l.flatType).length > 1;
                  const isSelected = myListing?.id === l.id;
                  return (
                    <div key={l.id} className="relative group">
                      <button
                        onClick={() => handleSelectListing(l)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5 ${isSelected
                          ? 'border-[#FF5A36] bg-[#FF5A36] text-white shadow-xs font-bold pr-7'
                          : 'border-gray-200 bg-white hover:border-[#FF5A36]/40 text-gray-700 pr-7'
                          }`}
                      >
                        <span>{l.title ? (l.title.length > 18 ? `${l.title.substring(0, 18)}...` : l.title) : `${l.locality} (${l.flatType})`}</span>
                        {isDuplicateName && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            #{index + 1}
                          </span>
                        )}
                      </button>
                      {allListings.length > 1 && (
                        <button
                          onClick={(e) => handleDeleteSpecificListing(e, l.id)}
                          className={`absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isSelected ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'
                            }`}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between w-full pt-3 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#FF5A36] font-semibold bg-[#FFF2EB] px-2.5 py-0.5 rounded-full border border-[#FF5A36]/20">
                  Unlimited
                </span>
                {ownerVerification?.status === 'APPROVED' ? (
                  <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-amber-600" /> Pending
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/edit-listing/new')}
                className="px-4 py-1.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-semibold rounded-full transition-all flex items-center gap-1 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Space
              </button>
            </div>
          </div>
        )}

        {/* Verification Gate Banner (Mobile) */}
        {myListing && (myListing.status === 'pending_verification' || myListing.ownerVerified === false) && ownerVerification?.status !== 'APPROVED' && (
          <OwnerVerificationGate
            listingTitle={myListing.title}
          />
        )}

        {/* Hero Section (Mobile) */}
        {myListing ? (
          <div className="relative rounded-3xl overflow-hidden shadow-md border border-gray-100 bg-[#1E2229]">
            <div className="absolute inset-0">
              {myListing.images && myListing.images.length > 0 ? (
                <img src={myListing.images[0]} alt="Listing cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#1E2229]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#1E2229] via-[#1E2229]/85 to-[#1E2229]/40" />
            </div>

            <div className="relative p-5 pt-16 text-white flex flex-col justify-end min-h-[300px]">
              <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                <span className={`px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 shadow-md backdrop-blur-md ${
                  myListing.status === 'pending_verification' || myListing.ownerVerified === false
                    ? 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                    : myListing.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    myListing.status === 'pending_verification' || myListing.ownerVerified === false
                      ? 'bg-amber-400 animate-pulse'
                      : myListing.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`} />
                  {myListing.status === 'pending_verification' || myListing.ownerVerified === false
                    ? 'PENDING VERIFICATION'
                    : myListing.status === 'active' ? 'LIVE' : 'PAUSED'}
                </span>
                <button
                  onClick={handleToggleStatus}
                  disabled={myListing.status === 'pending_verification' || myListing.ownerVerified === false}
                  className={`p-2 backdrop-blur-md rounded-full border border-white/10 text-white ${
                    myListing.status === 'pending_verification' || myListing.ownerVerified === false
                      ? 'opacity-40 cursor-not-allowed'
                      : ''
                  }`}
                  title={myListing.status === 'pending_verification' ? 'Listing unavailable until identity is verified' : (myListing.status === 'active' ? 'Pause Listing' : 'Resume Listing')}
                >
                  {myListing.status === 'active' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                {getAvailabilityState(myListing) !== 'available' && myListing.status === 'active' && (
                  <button onClick={handleConfirmAvailability} className="px-3 py-1 bg-[#FF5A36] text-white text-[10px] font-bold rounded-full shadow-md">
                    Confirm Available
                  </button>
                )}
                <button onClick={() => navigate(`/edit-listing/${myListing.id}`)} className="p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mb-4">
                <h2 className="font-serif text-2xl font-medium mb-1 leading-tight drop-shadow">{myListing.title}</h2>
                <p className="text-xs text-gray-200 flex items-center gap-1 drop-shadow">
                  <MapPin className="w-3.5 h-3.5 text-[#FF5A36] shrink-0" /> {myListing.locality}, {myListing.city}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 text-center">
                  <p className="text-lg font-bold">{pendingApplicants.length}</p>
                  <p className="text-[9px] text-gray-300 font-medium uppercase">Requests</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 text-center">
                  <p className="text-lg font-bold">{myListing.views || 0}</p>
                  <p className="text-[9px] text-gray-300 font-medium uppercase">Views</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 text-center">
                  <p className="text-lg font-bold">{chatCount}</p>
                  <p className="text-[9px] text-gray-300 font-medium uppercase">Chats</p>
                </div>
                <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-2.5 text-center">
                  <p className="text-lg font-bold">{selectedListingWeeklyViews}</p>
                  <p className="text-[9px] text-gray-300 font-medium uppercase">Week</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <section className="relative bg-[#1E2229] rounded-3xl p-6 text-white overflow-hidden shadow-sm">
            <div className="relative z-10 w-full">
              <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center mb-4 text-[#FF5A36]">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="font-serif text-xl font-medium mb-1">No listing yet</h2>
              <p className="text-gray-300 text-xs mb-5 leading-relaxed">Create your first listing to start finding great roommates.</p>
              <button
                onClick={() => navigate('/edit-listing/new')}
                className="bg-[#FF5A36] hover:bg-[#E54E2B] text-white px-5 py-2.5 rounded-full font-semibold flex items-center gap-2 transition-colors text-xs"
              >
                Create Listing
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>
        )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* C. APPLICANTS SECTION (Mobile): Shown ONLY on Applicants tab */}
        {/* ========================================================================= */}
        {activeTab === 'applicants' && (
          <div id="applicants-section-mobile" className="flex flex-col gap-4">
            {/* Pending Requests Card (Mobile) */}
            <section className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#FFF2EB] rounded-2xl flex items-center justify-center text-[#FF5A36]">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-medium text-[#1E2229]">Inquiries ({pendingApplicants.length})</h2>
                    <p className="text-[11px] text-gray-400">Sorted by verified compatibility.</p>
                  </div>
                </div>
                {pendingApplicants.length > 1 && (
                  <button
                    onClick={() => {
                      const ids = pendingApplicants.map(a => a.profile.uid || a.connection.fromUserId).filter(Boolean).slice(0, 3).join(',');
                      const lQuery = myListing?.id ? `&listingId=${myListing.id}` : '';
                      navigate(ids ? `/applicants/compare?ids=${ids}${lQuery}` : '/applicants/compare');
                    }}
                    className="px-3.5 py-1.5 border border-[#FF5A36]/30 text-[#FF5A36] bg-[#FFF2EB] hover:bg-[#FFE5D6] rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                  >
                    <Users className="w-3.5 h-3.5" /> Compare
                  </button>
                )}
              </div>

          {pendingApplicants.length > 0 ? (
            <div className="w-full space-y-3">
              {rankedApplicants.map(applicant => {
                const p = applicant.profile;
                const isHighlighted = highlightedRequestId === applicant.connection.id;
                return (
                  <div
                    key={applicant.connection.id}
                    id={`request-${applicant.connection.id}`}
                    className={`flex flex-col gap-3 p-4 rounded-2xl border transition-all ${isHighlighted
                      ? 'bg-[#FFF2EB]/50 border-[#FF5A36]/40 shadow-sm'
                      : 'bg-[#FBFBFC] border-gray-100'
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar src={p.avatar} name={p.name} className="w-11 h-11 rounded-full object-cover border border-white shadow-xs shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-[#1E2229] text-sm truncate">{p.name}</h4>
                          {p.workEmailVerified && <span title="Corporate Verified"><CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /></span>}
                          {p.isVerified && <span title="ID Verified"><Shield className="w-3.5 h-3.5 text-emerald-600" /></span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate font-medium">{p.profession || 'Roommate Seeker'} · ₹{p.budget?.toLocaleString() || 'Flex'}</p>
                        {(() => {
                          const req = getRequestedListing(applicant.connection);
                          if (!req) return null;
                          const label = req.title ? (req.title.length > 26 ? `${req.title.slice(0, 26)}…` : req.title) : `${req.locality}`;
                          return (
                            <p className="text-[11px] text-gray-600 mt-0.5 truncate">Interested in: <span className="font-semibold text-[#1E2229]">{label}</span></p>
                          );
                        })()}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/20">{applicant.fit.score}% match</span>
                          {applicant.fit.reasons.slice(0, 1).map(r => (
                            <span key={r} className="text-[10px] text-emerald-800 font-medium inline-flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-full"><Check className="w-2.5 h-2.5 text-emerald-600" />{r}</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-gray-150">
                      <div className="flex items-center gap-2">
                        {applicant.connection.screeningAnswers && Object.keys(applicant.connection.screeningAnswers).length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedScreeningApplicant(applicant)}
                            className="px-3 py-1.5 border border-orange-200 bg-orange-50/60 hover:bg-orange-100 text-[#FF5A36] rounded-full text-xs font-semibold flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <FileText className="w-3 h-3" /> Answers
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/match/${p.uid || applicant.connection.fromUserId}`)}
                          className="px-3 py-1.5 border border-gray-200 rounded-full text-gray-700 text-xs font-semibold hover:bg-white cursor-pointer"
                        >
                          Profile
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReject(applicant)}
                          aria-label="Reject request"
                          className="p-1.5 sm:p-2 border border-red-200 rounded-full text-red-500 hover:bg-red-50 cursor-pointer active:scale-95"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleAccept(applicant)}
                          className="px-4 py-1.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full font-semibold text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-5">
              <div className="w-14 h-14 bg-[#FFF2EB] rounded-2xl flex items-center justify-center mb-3 text-[#FF5A36]">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-base font-medium text-[#1E2229] mb-1">No pending requests</h3>
              <p className="text-xs text-gray-400">{myListing ? 'Your listing is live. Roommate requests will appear here.' : 'Create a listing to start receiving roommate requests.'}</p>
            </div>
          )}
        </section>

        {/* My Connections Card (Mobile) */}
        <section className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700">
                <Users className="w-5 h-5" />
              </div>
              <h2 className="font-serif text-base font-medium text-[#1E2229]">My Connections ({acceptedConnections.length})</h2>
            </div>
            <button
              onClick={() => navigate('/chat')}
              className="text-[#FF5A36] text-xs font-semibold flex items-center gap-1 hover:underline"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {acceptedConnections.length > 0 ? (
            <div className="w-full space-y-2.5">
              {acceptedConnections.map(conn => {
                const p = conn.profile;
                return (
                  <div
                    key={conn.connection.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-gray-100 bg-[#FBFBFC]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar src={p.avatar} name={p.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-[#1E2229] text-xs truncate">{p.name}</h4>
                        <p className="text-[11px] text-gray-500 truncate">{p.profession || 'Roommate'}</p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!user?.uid) return;
                        const targetId = p.uid || conn.connection.fromUserId;
                        const roomId = await getOrCreateChatRoom(user.uid, targetId);
                        navigate(`/chat/${roomId}`);
                      }}
                      className="px-3.5 py-1.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-semibold shrink-0 shadow-xs"
                    >
                      Message
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center text-center py-5">
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-3 text-emerald-700">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-base font-medium text-[#1E2229] mb-1">No accepted connections yet</h3>
              <p className="text-xs text-gray-400">Accept incoming requests to connect.</p>
            </div>
          )}
        </section>
          </div>
        )}

        {/* Weekly Views Analytics Card (Mobile: Listings Tab Only) */}
        {activeTab === 'listings' && (
          <section className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-700">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-serif text-base font-medium text-[#1E2229] leading-tight">Weekly Views</h2>
                  <span className="text-[11px] text-gray-400">Last 7 days visitor traffic</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-[#1E2229] block">{totalWeeklyViews} this week</span>
                <span className="text-[10px] text-gray-400">{totalAllTimeViews} all time</span>
              </div>
            </div>

            {/* Mobile Visual BarChart */}
            {displayWeeklyViews.some(d => d.views > 0) ? (
              <div className="h-36 w-full my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={displayWeeklyViews} margin={{ top: 8, right: 5, left: -25, bottom: 0 }}>
                    <XAxis
                      dataKey="day"
                      tick={({ x, y, payload }) => {
                        const item = displayWeeklyViews.find(d => d.day === payload.value);
                        const isToday = item?.isToday;
                        return (
                          <text
                            x={x}
                            y={y + 11}
                            textAnchor="middle"
                            fill={isToday ? '#FF5A36' : '#94a3b8'}
                            fontWeight={isToday ? 700 : 400}
                            fontSize={10}
                          >
                            {isToday ? 'Today' : payload.value}
                          </text>
                        );
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      formatter={(v: number) => [v, 'Views']}
                    />
                    <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                      {displayWeeklyViews.map((d, i) => (
                        <Cell
                          key={d.date || i}
                          fill={d.isToday ? '#FF5A36' : d.views > 0 ? '#FB923C' : '#FBFBFC'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-center text-gray-400 py-3">No views recorded yet this week.</p>
            )}

            <div className="flex justify-between items-end border-t border-gray-100 pt-3 px-1">
              {displayWeeklyViews.map((d, index) => (
                <div key={d.date || d.day} className="contents">
                  <div className="flex flex-col items-center gap-1">
                    <span className={`text-[11px] ${d.isToday ? 'font-bold text-[#FF5A36]' : 'text-gray-400'}`}>
                      {d.isToday ? 'Today' : d.day}
                    </span>
                    <span className={`text-xs font-semibold ${d.isToday ? 'font-bold text-[#FF5A36]' : 'text-[#1E2229]'}`}>
                      {d.views}
                    </span>
                  </div>
                  {index < displayWeeklyViews.length - 1 && (
                    <div className="w-px h-5 bg-gray-100"></div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      )}

      {/* ========================================================================= */}
      {/* 3. DEDICATED SEEKER DISCOVERY VIEW (Unified Desktop & Mobile)             */}
      {/* ========================================================================= */}
      {activeTab === 'seekers' && (
        <div className="w-full space-y-4 sm:space-y-6 animate-fade-up pb-24">
          {/* Prominent Dedicated Back Navigation Bar */}
          <div className="flex items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-gray-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => navigate('/owner-dashboard')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1E2229] hover:bg-[#2A2A44] text-white text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← Owner Dashboard</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium truncate">
              <span className="hidden xs:inline">Showing </span><span className="font-bold text-[#1E2229]">{filteredSeekers.length}</span> Room Seekers in
              <span className="font-bold text-[#FF5A36] truncate max-w-[120px] sm:max-w-none">
                {seekerCity === 'all' ? 'All Cities' : (seekerCity || (defaultOwnerCity === 'all' ? 'All Cities' : defaultOwnerCity))}
              </span>
            </div>
          </div>

          {/* Seeker Discovery Header Banner */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-7 shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-[#FFF2EB] text-[#FF5A36] font-extrabold text-[10px] uppercase tracking-wider">
                  Owner Discovery Mode
                </span>
                <span className="text-xs text-gray-400 font-medium">Verified Room Seekers</span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-medium text-[#1E2229] tracking-tight">
                Browse People Seeking Rooms
              </h2>
              <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
                Discover verified candidates actively looking for rooms and roommates. View their budget, location preferences, and lifestyle habits, then reach out or start a conversation directly.
              </p>
            </div>

            {myListing && (
              <div className="bg-[#FBFBFC] border border-gray-200/80 rounded-2xl p-3 sm:p-3.5 shrink-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="text-left min-w-0 max-w-[220px]">
                  <p className="text-[10px] uppercase font-bold text-gray-400">Scoring Against</p>
                  <p className="text-xs font-bold text-[#1E2229] truncate">{myListing.title}</p>
                </div>
              </div>
            )}
          </div>

          {/* Search, City & Filter Controls Bar */}
          <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-xs border border-gray-100 space-y-3">
            {/* Top Bar: Search + Filter Trigger (and City/Sort on desktop) */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5 sm:gap-3">
              {/* City Dropdown (Desktop: inline w-48) */}
              <div className="hidden md:block relative w-48 shrink-0">
                <select
                  value={seekerCity}
                  onChange={e => setSeekerCity(e.target.value)}
                  className="w-full bg-[#FBFBFC] border border-gray-200/90 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#1E2229] outline-none focus:border-[#FF5A36] cursor-pointer appearance-none pr-8"
                >
                  <option value="all">All Cities</option>
                  {cities.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Mobile / Tablet Container: Search Input + Filter Toggle Button */}
              <div className="flex items-center gap-2 w-full md:flex-1">
                {/* Locality / Keyword Search Input */}
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={seekerSearchQuery}
                    onChange={e => setSeekerSearchQuery(e.target.value)}
                    placeholder={`Search locality, profession, or name in ${seekerCity === 'all' ? 'all cities' : (seekerCity || (defaultOwnerCity === 'all' ? 'all cities' : defaultOwnerCity))}...`}
                    className="w-full pl-10 pr-9 py-2.5 bg-[#FBFBFC] border border-gray-200/90 rounded-xl text-xs font-medium text-[#1E2229] placeholder:text-gray-400 outline-none focus:border-[#FF5A36]"
                  />
                  {seekerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSeekerSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Toggle Button */}
                <button
                  type="button"
                  onClick={() => setShowSeekerFilters(prev => !prev)}
                  aria-expanded={showSeekerFilters}
                  aria-label="Toggle seeker filters"
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer select-none active:scale-95 ${
                    showSeekerFilters || activeSeekerFiltersCount > 0
                      ? 'bg-[#1E2229] text-white border-[#1E2229] shadow-2xs'
                      : 'bg-[#FBFBFC] text-[#1E2229] border-gray-200/90 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  <SlidersHorizontal className={`w-3.5 h-3.5 ${showSeekerFilters || activeSeekerFiltersCount > 0 ? 'text-[#FF5A36]' : 'text-gray-500'}`} />
                  <span>Filters</span>
                  {activeSeekerFiltersCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-[#FF5A36] text-white text-[10px] font-extrabold flex items-center justify-center">
                      {activeSeekerFiltersCount}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showSeekerFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {/* Sort Selector (Desktop: inline w-44) */}
              <div className="hidden md:block relative w-44 shrink-0">
                <select
                  value={seekerSort}
                  onChange={e => setSeekerSort(e.target.value as any)}
                  className="w-full bg-[#FBFBFC] border border-gray-200/90 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#1E2229] outline-none focus:border-[#FF5A36] cursor-pointer appearance-none pr-8"
                >
                  <option value="match">Best Match</option>
                  <option value="budget_desc">Highest Budget</option>
                  <option value="budget_asc">Lowest Budget</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Active Filter Chips Strip (Visible when filters are active and drawer is collapsed) */}
            {!showSeekerFilters && activeSeekerFiltersCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">
                  Active Filters:
                </span>

                {seekerCity && seekerCity !== defaultOwnerCity && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FFF2EB] border border-[#FF5A36]/20 text-[11px] font-bold text-[#FF5A36]">
                    <MapPin className="w-3 h-3" />
                    <span>{seekerCity === 'all' ? 'All Cities' : seekerCity}</span>
                    <button
                      type="button"
                      onClick={() => setSeekerCity(defaultOwnerCity)}
                      className="hover:text-red-600 cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {seekerGenderFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[11px] font-bold text-[#1E2229] capitalize">
                    <span>{seekerGenderFilter}</span>
                    <button
                      type="button"
                      onClick={() => setSeekerGenderFilter('all')}
                      className="hover:text-red-600 cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {seekerTraitFilter.map(tid => {
                  const trait = SEEKER_LIFESTYLE_TRAITS.find(t => t.id === tid);
                  return (
                    <span
                      key={tid}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[11px] font-bold text-[#1E2229]"
                    >
                      <span>{trait?.label || tid}</span>
                      <button
                        type="button"
                        onClick={() => setSeekerTraitFilter(prev => prev.filter(t => t !== tid))}
                        className="hover:text-red-600 cursor-pointer ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}

                {seekerSort !== 'match' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-[11px] font-bold text-[#1E2229]">
                    <span>Sort: {seekerSort === 'budget_desc' ? 'Highest Budget' : 'Lowest Budget'}</span>
                    <button
                      type="button"
                      onClick={() => setSeekerSort('match')}
                      className="hover:text-red-600 cursor-pointer ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleResetSeekerFilters}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5A36] hover:underline cursor-pointer ml-auto px-1 py-0.5"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All</span>
                </button>
              </div>
            )}

            {/* Expandable Filter Drawer / Dropdown Panel */}
            {showSeekerFilters && (
              <div className="pt-3 border-t border-gray-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Drawer Header */}
                <div className="flex items-center justify-between gap-2 pb-1 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#FF5A36]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1E2229]">
                      Filter & Refine Seekers
                    </span>
                    {activeSeekerFiltersCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-[#FFF2EB] text-[#FF5A36] text-[10px] font-bold">
                        {activeSeekerFiltersCount} active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeSeekerFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={handleResetSeekerFilters}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#FF5A36] hover:underline cursor-pointer px-1 py-0.5"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowSeekerFilters(false)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                      title="Close filters"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile-only City & Sort Selectors (Stacked on mobile, hidden on desktop since desktop has them in top bar) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 md:hidden">
                  {/* City Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#FF5A36]" />
                      <span>City / Location</span>
                    </label>
                    <div className="relative">
                      <select
                        value={seekerCity}
                        onChange={e => setSeekerCity(e.target.value)}
                        className="w-full bg-[#FBFBFC] border border-gray-200/90 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#1E2229] outline-none focus:border-[#FF5A36] cursor-pointer appearance-none pr-8"
                      >
                        <option value="all">All Cities</option>
                        {cities.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* Sort Selector */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-[#FF5A36]" />
                      <span>Sort By</span>
                    </label>
                    <div className="relative">
                      <select
                        value={seekerSort}
                        onChange={e => setSeekerSort(e.target.value as any)}
                        className="w-full bg-[#FBFBFC] border border-gray-200/90 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#1E2229] outline-none focus:border-[#FF5A36] cursor-pointer appearance-none pr-8"
                      >
                        <option value="match">Best Match</option>
                        <option value="budget_desc">Highest Budget</option>
                        <option value="budget_asc">Lowest Budget</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Gender Preference Filter */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3 text-[#FF5A36]" />
                    <span>Seeker Gender Preference</span>
                  </label>
                  <div className="grid grid-cols-3 rounded-xl bg-gray-100 p-0.5 border border-gray-200/70 max-w-sm">
                    {(['all', 'male', 'female'] as const).map(gender => (
                      <button
                        key={gender}
                        type="button"
                        onClick={() => setSeekerGenderFilter(gender)}
                        className={`py-1.5 px-2.5 rounded-lg text-xs font-bold capitalize transition-colors cursor-pointer text-center ${
                          seekerGenderFilter === gender
                            ? 'bg-white text-[#1E2229] shadow-2xs'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {gender === 'all' ? 'Any Gender' : gender}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Lifestyle & Habits Pills */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#FF5A36]" />
                    <span>Lifestyle & Preferences</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SEEKER_LIFESTYLE_TRAITS.map(trait => {
                      const isActive = seekerTraitFilter.includes(trait.id);
                      return (
                        <button
                          key={trait.id}
                          type="button"
                          onClick={() => {
                            setSeekerTraitFilter(prev =>
                              isActive ? prev.filter(t => t !== trait.id) : [...prev, trait.id]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-[#1E2229] text-white border-[#1E2229] shadow-2xs font-bold'
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {isActive && <Check className="w-3 h-3 text-[#FF5A36]" />}
                          <span>{trait.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Controls / Apply CTA */}
                <div className="pt-2 flex items-center justify-between gap-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleResetSeekerFilters}
                    disabled={activeSeekerFiltersCount === 0 && !seekerSearchQuery}
                    className="text-xs font-bold text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:pointer-events-none cursor-pointer px-2 py-1.5"
                  >
                    Clear All
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSeekerFilters(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E2229] hover:bg-[#2A2A44] text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 ml-auto"
                  >
                    <span>Show {filteredSeekers.length} Seekers</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Seekers Content Grid / States */}
          {loadingSeekers ? (
            <div className="py-16">
              <StateLoading label="Finding verified room seekers..." />
            </div>
          ) : filteredSeekers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
              {filteredSeekers.map(({ profile: s, score }) => (
                <OwnerSeekerCard
                  key={s.uid}
                  seeker={s}
                  score={score}
                  ownerListing={myListing}
                  onChat={handleChatSeeker}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-xs">
              <StateEmpty
                icon={Users}
                title="No room seekers found"
                description={
                  seekerSearchQuery || seekerGenderFilter !== 'all' || seekerTraitFilter.length > 0
                    ? 'No candidates match your current search filters. Try clearing some filters to see more candidates.'
                    : `No active room seekers currently found in ${seekerCity}. Try switching to another city or "All Cities".`
                }
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setSeekerSearchQuery('');
                      setSeekerGenderFilter('all');
                      setSeekerTraitFilter([]);
                      setSeekerCity('all');
                    }}
                    className="px-5 py-2.5 rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    View All Room Seekers
                  </button>
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl w-full max-w-sm p-7 shadow-2xl border border-gray-100">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-xl font-medium text-center text-[#1E2229] mb-2">Delete Listing?</h2>
            <p className="text-gray-500 text-xs text-center mb-6 leading-relaxed">
              This action cannot be undone. All data associated with this listing will be permanently removed.
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-3 rounded-full border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-all text-xs cursor-pointer">
                Cancel
              </button>
              <button onClick={handleDeleteListing} className="flex-1 px-4 py-3 rounded-full bg-red-600 text-white font-semibold hover:bg-red-700 transition-all text-xs shadow-xs cursor-pointer">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Screening Answers Modal */}
      <ApplicantScreeningAnswersModal
        isOpen={!!selectedScreeningApplicant}
        onClose={() => setSelectedScreeningApplicant(null)}
        applicantName={selectedScreeningApplicant?.profile.name || 'Applicant'}
        applicantAvatar={selectedScreeningApplicant?.profile.avatar}
        screeningAnswers={selectedScreeningApplicant?.connection.screeningAnswers}
        onAccept={selectedScreeningApplicant ? () => handleAccept(selectedScreeningApplicant) : undefined}
      />
      {/* Contact Seeker Modal */}
      <ContactModal
        isOpen={Boolean(contactSeekerProfile)}
        onClose={() => setContactSeekerProfile(null)}
        profile={contactSeekerProfile}
      />
    </PageShell>
  );
}
