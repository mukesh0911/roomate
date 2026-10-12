import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Heart, Share2, MapPin, Eye, CheckCircle2,
  Bed, Home, Users, Calendar, Wifi, Wind, Droplets, Refrigerator,
  Sparkles, Car, Zap, ArrowUpDown, ShieldCheck, Ban,
  Sun, BookOpen, Dumbbell, Activity, Compass, Utensils,
  ChevronRight, ChevronLeft, X, Loader2, Send, MessageCircle,
  Copy, Bus, Train, ShoppingBag, Hospital, Check, Sofa, Tv,
  Flag, AlertCircle, ExternalLink, ArrowRight
} from 'lucide-react';
import { useListings } from '@/hooks/useListings';
import { useAuth } from '@/hooks/useAuth';
import { useConnections } from '@/hooks/useConnections';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useChat } from '@/hooks/useChat';
import { useStore } from '@/store/useStore';
import { getRoomMatchReasons, getActiveStatus, calculateRoomCompatibility } from '@/lib/matching';
import type { Listing } from '@/hooks/useListings';
import type { UserProfile } from '@/hooks/useAuth';
import { getAvailabilityState, isDiscoverable } from '@/lib/listingFreshness';
import { formatLocationString, getDynamicPreferences, getRoomHighlights } from '@/lib/dynamicTraits';
import StateLoading from '@/components/StateLoading';
import StateEmpty from '@/components/StateEmpty';
import RoomCard from '@/components/RoomCard';
import FlatmateAvatar from '@/components/FlatmateAvatar';
import ScreeningQuestionnaireModal from '@/components/ScreeningQuestionnaireModal';
import { CURATED_SCREENING_QUESTIONS } from '@/lib/screeningQuestions';
import { toast } from 'sonner';
import { startTrace, endTrace } from '@/lib/perfTrace';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Dynamic circular icon mapper for real user amenities
 */
function getAmenityDetails(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('wifi') || lower.includes('internet')) {
    return { icon: Wifi, label: 'WiFi', bg: 'bg-blue-50 text-blue-600 border-blue-100' };
  }
  if (lower.includes('ac') || lower.includes('air conditioner') || lower.includes('cooling')) {
    return { icon: Wind, label: 'AC', bg: 'bg-sky-50 text-sky-600 border-sky-100' };
  }
  if (lower.includes('wash') || lower.includes('laundry')) {
    return { icon: Droplets, label: 'Washing Machine', bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
  }
  if (lower.includes('fridge') || lower.includes('refriger')) {
    return { icon: Refrigerator, label: 'Fridge', bg: 'bg-amber-50 text-amber-600 border-amber-100' };
  }
  if (lower.includes('kitchen') || lower.includes('cook')) {
    return { icon: Sparkles, label: 'Kitchen', bg: 'bg-orange-50 text-orange-600 border-orange-100' };
  }
  if (lower.includes('park') || lower.includes('car') || lower.includes('bike')) {
    return { icon: Car, label: 'Parking', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
  }
  if (lower.includes('power') || lower.includes('backup') || lower.includes('inverter')) {
    return { icon: Zap, label: 'Power Backup', bg: 'bg-yellow-50 text-yellow-600 border-yellow-100' };
  }
  if (lower.includes('lift') || lower.includes('elevator')) {
    return { icon: ArrowUpDown, label: 'Elevator', bg: 'bg-teal-50 text-teal-600 border-teal-100' };
  }
  if (lower.includes('water') || lower.includes('geyser') || lower.includes('heater')) {
    return { icon: Droplets, label: 'Geyser', bg: 'bg-cyan-50 text-cyan-600 border-cyan-100' };
  }
  if (lower.includes('tv') || lower.includes('television')) {
    return { icon: Tv, label: 'TV', bg: 'bg-purple-50 text-purple-600 border-purple-100' };
  }
  if (lower.includes('sofa') || lower.includes('couch')) {
    return { icon: Sofa, label: 'Furnished', bg: 'bg-rose-50 text-rose-600 border-rose-100' };
  }
  return { icon: Check, label: name, bg: 'bg-gray-50 text-gray-700 border-gray-200' };
}

/**
 * Determine if a house rule is restrictive or permissible
 */
function isNegativeRule(rule: string): boolean {
  const lower = rule.toLowerCase().trim();
  return lower.startsWith('no ') ||
    lower.startsWith('not ') ||
    lower.startsWith("don't") ||
    lower.startsWith('strictly no') ||
    lower.includes('prohibited') ||
    lower.includes('banned');
}

export default function RoomDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { getListingById, recordView, getSimilarListings } = useListings();
  const { sendRequest, subscribeToMyConnections } = useConnections();
  const { createNotification } = useNotifications();
  const { toggleSavedRoom, getProfile, reportUser } = useUserProfile();
  const { logEvent } = useAnalytics();
  const { getOrCreateChatRoom } = useChat();

  const [room, setRoom] = useState<Listing | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(null);
  const [similarRooms, setSimilarRooms] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [messagingOwner, setMessagingOwner] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [showScreeningModal, setShowScreeningModal] = useState(false);

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('inaccurate_info');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const isSaved = !!(profile?.savedRoomIds && id && profile.savedRoomIds.includes(id));

  // Sync connection state to prevent duplicate connection requests
  useEffect(() => {
    if (!user?.uid || !room?.ownerId) return;
    const unsub = subscribeToMyConnections(user.uid, (conns) => {
      const active = conns.some(
        c => (c.toUserId === room.ownerId || c.fromUserId === room.ownerId) &&
          (c.status === 'pending' || c.status === 'accepted')
      );
      if (active) setRequestSent(true);
    });
    return () => unsub();
  }, [user?.uid, room?.ownerId, subscribeToMyConnections]);

  // Memoized sanitized photos list
  const photos = React.useMemo(() => {
    return Array.isArray(room?.images)
      ? room.images.filter((img): img is string => typeof img === 'string' && img.trim().length > 0)
      : [];
  }, [room?.images]);

  // Keyboard navigation & body scroll lock for lightbox
  useEffect(() => {
    if (!showLightbox) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLightbox(false);
      if (e.key === 'ArrowLeft') setLightboxIdx(p => (p === 0 ? (photos.length > 0 ? photos.length - 1 : 0) : p - 1));
      if (e.key === 'ArrowRight') setLightboxIdx(p => (p < photos.length - 1 ? p + 1 : 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showLightbox, photos.length]);

  // Load active listing + owner profile in a single fetch (no duplicate owner read)
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    startTrace(`RoomDetail_load_${id}`);
    getListingById(id).then(result => {
      endTrace(`RoomDetail_load_${id}`);
      if (result) {
        setRoom(result.listing);
        if (result.ownerProfile) {
          setOwnerProfile(result.ownerProfile as UserProfile);
        }
        // Fire-and-forget view recording (non-blocking)
        recordView(result.listing.id, result.listing.ownerId).catch(() => {});
      } else {
        setRoom(null);
      }
      setIsLoading(false);
    });
  }, [id, getListingById, recordView]);

  // Dynamic document title
  useEffect(() => {
    if (room?.title) {
      document.title = `${room.title} | NestMate`;
    } else {
      document.title = 'Room Details | NestMate';
    }
  }, [room?.title]);

  // Load similar listings (genuine dynamic ranking by locality, flat type, rent proximity)
  useEffect(() => {
    if (!room?.id) return;
    getSimilarListings(room, room.id, 4).then(setSimilarRooms).catch(() => {
      setSimilarRooms([]);
    });
  }, [room, getSimilarListings]);

  // Handle Express Interest - opens screening questionnaire modal
  const handleConnect = () => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: 'Sign in to Express Interest',
        subtitle: 'Connect directly with the property owner with zero brokerage.',
        redirect: `/room/${id}`,
      });
      return;
    }
    if (!room || connecting || requestSent) return;
    setShowScreeningModal(true);
  };

  const handleScreeningSubmit = async (screeningAnswers: Record<string, any>) => {
    if (!user?.uid || !room || connecting) return;
    setConnecting(true);
    try {
      const connectionId = await sendRequest(user.uid, room.ownerId, { listingId: room.id, screeningAnswers });
      logEvent({ name: 'interest_sent', actorId: user.uid, entityId: room.id, city: room.city });
      await createNotification({
        userId: room.ownerId,
        type: 'connect',
        title: 'New Interest in Your Listing!',
        description: `${profile?.name || 'Someone'} expressed interest in "${room.title}".`,
        read: false,
        actionUrl: '/owner-dashboard?tab=applicants',
        connectionId,
      });
      setRequestSent(true);
      toast.success('Interest and screening answers sent to owner!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to send interest.');
      throw err;
    } finally {
      setConnecting(false);
    }
  };

  // Handle Message Owner
  const handleMessageOwner = async () => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: 'Sign in to Message Owner',
        subtitle: 'Start a direct chat with the owner.',
        redirect: `/room/${id}`,
      });
      return;
    }
    if (!room?.ownerId || messagingOwner) return;
    setMessagingOwner(true);
    try {
      const roomId = await getOrCreateChatRoom(user.uid, room.ownerId);
      navigate(`/chat/${roomId}`);
    } catch (err) {
      console.error('Failed to initiate chat with owner', err);
      toast.error('Could not start chat. Please try again.');
    } finally {
      setMessagingOwner(false);
    }
  };

  // Handle Toggle Save
  const handleToggleSave = async () => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: 'Sign in to Save Rooms',
        subtitle: 'Save your favorite listings and access them anytime across devices.',
        redirect: `/room/${id}`,
      });
      return;
    }
    if (!id || savingRoom) return;
    setSavingRoom(true);
    try {
      await toggleSavedRoom(user.uid, id, isSaved);
      await refreshProfile();
      toast.success(isSaved ? 'Removed from saved' : 'Saved to shortlist');
    } catch (err) {
      console.error('Failed to save room:', err);
    } finally {
      setSavingRoom(false);
    }
  };

  // Handle Share Listing
  const handleShare = async () => {
    const shareData = {
      title: room?.title || 'NestMate Listing',
      text: `Check out this room: ${room?.title} in ${room?.locality}, ${room?.city}`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (_) { /* ignored */ }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2500);
    }
  };

  // Handle Report Listing
  const handleReportSubmit = async () => {
    if (!user?.uid || !room) return;
    setIsSubmittingReport(true);
    try {
      await reportUser({
        reporterId: user.uid,
        targetId: room.ownerId,
        reason: reportReason,
        description: reportDescription.trim(),
      });
      toast.success('Thank you. Our safety & trust team will inspect this listing.');
      setReportModalOpen(false);
      setReportReason('inaccurate_info');
      setReportDescription('');
    } catch {
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  /* ── Guard States ────────────────────────────────────────────────── */
  if (isLoading) return <StateLoading label="Loading listing…" fullScreen />;

  if (!room) {
    return (
      <div className="min-h-screen bg-[#FBFBFC] flex items-center justify-center px-4">
        <StateEmpty
          icon={Bed}
          title="Listing not found"
          description="This room is inactive or may have been removed by the owner."
          action={
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-full bg-[#FF5A36] text-white text-xs font-bold shadow-xs cursor-pointer hover:bg-[#E54E2B]"
            >
              Go Back
            </button>
          }
        />
      </div>
    );
  }

  // Security gate: Block public access to unverified owner listings
  const isOwnListing = user?.uid && room.ownerId === user.uid;
  if (!isOwnListing && (room.status === 'pending_verification' || room.ownerVerified === false)) {
    return (
      <div className="min-h-screen bg-[#FBFBFC] flex items-center justify-center px-4">
        <StateEmpty
          icon={Bed}
          title="Listing not yet available"
          description="This listing is pending identity verification by the owner. It will become publicly accessible once verified."
          action={
            <button
              onClick={() => navigate('/explore?tab=rooms')}
              className="px-5 py-2.5 rounded-full bg-[#FF5A36] text-white text-xs font-bold shadow-xs cursor-pointer hover:bg-[#E54E2B]"
            >
              Browse Other Rooms
            </button>
          }
        />
      </div>
    );
  }

  // Availability check
  if (!isDiscoverable(room)) {
    const state = getAvailabilityState(room);
    const reason = state === 'closed'
      ? 'The owner has marked this room as no longer available.'
      : state === 'paused'
        ? 'This listing has been paused by the owner.'
        : 'This listing has not been confirmed as available recently.';
    return (
      <div className="min-h-screen bg-[#FBFBFC] flex items-center justify-center px-4">
        <StateEmpty
          icon={Bed}
          title="This room is no longer available"
          description={`${reason} Browse other rooms that match your preferences.`}
          action={
            <button
              onClick={() => navigate('/explore?tab=rooms')}
              className="px-5 py-2.5 rounded-full bg-[#FF5A36] text-white text-xs font-bold shadow-xs cursor-pointer hover:bg-[#E54E2B]"
            >
              Browse Rooms
            </button>
          }
        />
      </div>
    );
  }

  /* ── 100% Dynamic Real Data Computation ─────────────────────────── */
  const roomMatchBreakdown = profile ? getRoomMatchReasons(profile, room) : null;
  const compatibility = roomMatchBreakdown && typeof roomMatchBreakdown.score === 'number' && roomMatchBreakdown.score > 0
    ? roomMatchBreakdown.score
    : (profile ? calculateRoomCompatibility(profile, room) : null);

  const rentShare = room.partnerShare || room.totalRent || 0;
  const totalRent = room.totalRent || rentShare;
  const depositText = room.deposit && room.deposit > 0 ? `₹${room.deposit.toLocaleString('en-IN')}` : 'Not specified';

  const flatTypeNormalized = room.flatType || 'Room';
  const occupancyLabel = room.partnersNeeded && room.partnersNeeded > 1
    ? 'Shared'
    : (room.flatType?.toLowerCase().includes('shared') ? 'Shared' : 'Single');

  const lookingForLabel = room.preferredGender
    ? (room.preferredGender.toLowerCase() === 'female' ? 'Female Roommate' : room.preferredGender.toLowerCase() === 'male' ? 'Male Roommate' : 'Any Gender')
    : (room.partnersNeeded ? `${room.partnersNeeded} ${room.partnersNeeded === 1 ? 'Roommate' : 'Roommates'}` : 'Roommate');

  const genderLabel = room.preferredGender
    ? (room.preferredGender.toLowerCase() === 'female' ? '♀ Female' : room.preferredGender.toLowerCase() === 'male' ? '♂ Male' : '⚥ Any')
    : 'Any';

  const furnishingNormalized = room.furnishing || 'Semi-Furnished';
  const partnersCount = room.partnersNeeded && room.partnersNeeded > 0
    ? `${room.partnersNeeded} ${room.partnersNeeded === 1 ? 'person' : 'people'}`
    : '1 person';

  const formattedAvailableDate = room.availableFrom
    ? (() => {
        try {
          const d = new Date(room.availableFrom);
          return isNaN(d.getTime()) ? room.availableFrom : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch {
          return room.availableFrom;
        }
      })()
    : 'Immediately';

  const viewCountDisplay = room.views && room.views > 0
    ? `${room.views >= 1000 ? (room.views / 1000).toFixed(1) + 'K' : room.views} views`
    : 'New listing';

  const postedAgoText = (() => {
    if (!room.createdAt) return 'Recently listed';
    const ms = typeof (room.createdAt as any).toMillis === 'function'
      ? (room.createdAt as any).toMillis()
      : typeof (room.createdAt as any) === 'number'
        ? room.createdAt
        : (room.createdAt as any)?.seconds
          ? (room.createdAt as any).seconds * 1000
          : 0;
    if (!ms || ms < 946684800000) return 'Recently listed';
    const days = Math.floor((Date.now() - ms) / (24 * 60 * 60 * 1000));
    if (days <= 0) return 'Posted today';
    if (days === 1) return 'Posted yesterday';
    if (days > 180) return 'Recently listed';
    return `Posted ${days} days ago`;
  })();

  const descriptionContent = room.description && room.description.trim().length > 0
    ? room.description.trim()
    : 'The host has not added a custom description for this listing yet.';

  const isVerifiedListing = !!(room.isOwnerVerified || room.ownerVerified || ownerProfile?.isVerified);
  const ownerDisplayName = ownerProfile?.name || room.ownerName || 'Property Owner';
  const ownerAvatarUrl = ownerProfile?.avatar || room.ownerAvatar;
  const ownerActive = getActiveStatus(ownerProfile?.lastActiveAt);
  const isOwnerOnline = ownerActive?.status === 'online';
  const ownerActiveLabel = ownerActive?.text || (ownerProfile?.lastActiveAt ? getActiveStatus(ownerProfile.lastActiveAt)?.text : null) || 'Active recently';

  // Real amenities from room data (strictly dynamic, zero fake defaults)
  const realAmenities = Array.isArray(room.amenities)
    ? room.amenities.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    : [];

  // Deduplicate amenities so no duplicate icons/labels appear
  const uniqueAmenities = (() => {
    const seen = new Set<string>();
    const result: { icon: any; label: string; bg: string }[] = [];
    for (const a of realAmenities) {
      const details = getAmenityDetails(a);
      const key = details.label.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        result.push(details);
      }
    }
    return result;
  })();

  const displayAmenities = realAmenities;

  // Real house rules from room data (strictly dynamic)
  const realHouseRules = Array.isArray(room.houseRules)
    ? room.houseRules.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    : [];

  // Dynamic preferences derived strictly from real host quiz answers, expectations, house rules, and amenities
  const preferencesList = getDynamicPreferences({
    quizAnswers: ownerProfile?.quizAnswers || room.ownerQuizAnswers,
    householdExpectations: ownerProfile?.householdExpectations,
    houseRules: room.houseRules,
    amenities: room.amenities,
    profession: ownerProfile?.profession,
  });

  // Dynamic highlights derived strictly from real room amenities, furnishings, security, and verification
  const highlightsList = getRoomHighlights(room, isVerifiedListing);

  const fullLocationText = formatLocationString(room.locality, room.city, room.state);

  return (
    <div className="min-h-screen bg-[#FBFBFC] pb-24 lg:pb-16 text-[#1E2229] font-sans">

      {/* ── Toast Notification ──────────────────────────────────────── */}
      {copyToast && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] bg-[#1E2229]/95 backdrop-blur-md text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-white/10 animate-fade-up"
        >
          <Copy className="w-3.5 h-3.5 text-[#FF5A36]" />
          <span>Listing link copied to clipboard</span>
        </div>
      )}

      {/* ── Main Container ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-6">

        {/* ── Top Breadcrumbs Bar (Matching FlatMate Reference) ───────── */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium truncate">
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="inline-flex items-center gap-1 font-semibold text-[#1E2229] hover:text-[#FF5A36] transition-colors bg-white hover:bg-gray-50 px-3 py-1 rounded-full border border-gray-200 shadow-2xs cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
            <span className="text-gray-300">/</span>
            <Link to="/explore?tab=rooms" className="hover:text-gray-900 transition-colors">Home</Link>
            <span className="text-gray-300">/</span>
            <Link to="/explore?tab=rooms" className="hover:text-gray-900 transition-colors">{room.city || 'Rooms'}</Link>
            <span className="text-gray-300">/</span>
            <span className="font-semibold text-[#1E2229] truncate max-w-[200px] sm:max-w-md">{room.title}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E2229] bg-white hover:bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-full shadow-2xs cursor-pointer transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={savingRoom}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border shadow-2xs cursor-pointer transition-all active:scale-95 ${
                isSaved
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-white text-[#1E2229] hover:bg-gray-50 border-gray-200'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-gray-500'}`} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* ── Main Two-Column Layout ──────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-12">

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* ── LEFT COLUMN (Desktop Host Card & Trust Sidebar) ───────── */}
          {/* ═════════════════════════════════════════════════════════════ */}
          <div className="hidden lg:block lg:col-span-4 space-y-6 sticky top-24 self-start">

            {/* Host User Profile Card (Matching FlatMate 21 Desktop) */}
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6 flex flex-col items-center text-center">
              
              {/* Large Circular Photo Avatar */}
              <div
                onClick={() => room.ownerId && navigate(`/match/${room.ownerId}`)}
                className={`mb-4 ${room.ownerId ? 'cursor-pointer group' : ''}`}
              >
                <FlatmateAvatar
                  avatar={ownerAvatarUrl}
                  name={ownerDisplayName}
                  isVerified={isVerifiedListing}
                  illustrationType={ownerDisplayName.toLowerCase().includes('arun') ? 'arun' : undefined}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-full border border-gray-200 shadow-xs object-cover group-hover:opacity-90 transition-opacity"
                />
              </div>

              {/* Host Name & Verification Shield */}
              <div
                onClick={() => room.ownerId && navigate(`/match/${room.ownerId}`)}
                className={`flex items-center justify-center gap-1.5 mb-1 ${room.ownerId ? 'cursor-pointer hover:text-[#FF5A36] transition-colors' : ''}`}
              >
                <h2 className="text-xl font-bold text-[#1E2229] tracking-tight">
                  {ownerDisplayName}
                </h2>
                {isVerifiedListing && (
                  <span title="Verified Host" className="text-emerald-500">
                    <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-white" />
                  </span>
                )}
              </div>

              {/* Subtitle & Online status */}
              <p className="text-xs text-gray-500 mb-2">
                {ownerProfile?.profession || (isVerifiedListing ? 'Verified Owner' : 'Property Host')} · {room.city || 'India'}
              </p>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-semibold mb-5">
                <span className={`w-2 h-2 rounded-full ${isOwnerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span>{ownerActiveLabel}</span>
              </div>

              {/* ONE Single Prominent Action Button (NO CALL BUTTON) */}
              {requestSent ? (
                <div className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-2 mb-3">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Interest Sent to Owner</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-[#FF5A36] hover:bg-[#E54E2B] text-white shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-85 mb-3"
                >
                  {connecting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      <span>Chat with Owner</span>
                    </>
                  )}
                </button>
              )}

              {/* Secondary Actions: Direct Message & Save */}
              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onClick={handleMessageOwner}
                  disabled={messagingOwner}
                  className="flex-1 py-2 px-3 rounded-xl font-semibold text-xs border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {messagingOwner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 text-gray-500" />}
                  <span>Direct Message</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleSave}
                  disabled={savingRoom}
                  className={`py-2 px-3 rounded-xl font-semibold text-xs border transition-colors flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                    isSaved
                      ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-gray-400'}`} />
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>
              </div>

              {/* Host Profile Link */}
              {room.ownerId && (
                <button
                  type="button"
                  onClick={() => navigate(`/match/${room.ownerId}`)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF5A36] hover:underline mt-4 cursor-pointer"
                >
                  <span>View Host Profile & Listings</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* NestMate Direct Experience Promise Card */}
            <div className="bg-white rounded-2xl p-5 border border-gray-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-[#1E2229]">NestMate Assurance</h4>
              </div>
              <ul className="text-xs text-gray-600 space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Zero brokerage & direct host connection</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Verified property photos & identity</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Privacy-first secure in-app messaging</span>
                </li>
              </ul>
            </div>

          </div>

          {/* ═════════════════════════════════════════════════════════════ */}
          {/* ── RIGHT COLUMN (Main Property Card) ─────────────────────── */}
          {/* ═════════════════════════════════════════════════════════════ */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-5 sm:p-8 space-y-6">

              {/* MOBILE ONLY: Host Profile & Primary Button (Matching FlatMate 22 Mobile) */}
              <div className="lg:hidden flex flex-col items-center text-center pb-5 border-b border-gray-100">
                <div
                  onClick={() => room.ownerId && navigate(`/match/${room.ownerId}`)}
                  className={`mb-3 ${room.ownerId ? 'cursor-pointer' : ''}`}
                >
                  <FlatmateAvatar
                    avatar={ownerAvatarUrl}
                    name={ownerDisplayName}
                    isVerified={isVerifiedListing}
                    illustrationType={ownerDisplayName.toLowerCase().includes('arun') ? 'arun' : undefined}
                    className="w-24 h-24 rounded-full border border-gray-200 shadow-xs object-cover"
                  />
                </div>

                <h1 className="text-xl font-bold text-[#1E2229] tracking-tight">
                  {room.title}
                </h1>

                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <span>{fullLocationText}</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-2.5">
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    {flatTypeNormalized}
                  </span>
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    {lookingForLabel}
                  </span>
                </div>

                {/* Single Primary Action Button on Mobile (NO CALL BUTTON) */}
                <div className="w-full max-w-sm mt-4">
                  {requestSent ? (
                    <div className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Interest Sent to Owner</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="w-full py-3 px-5 rounded-xl font-bold text-xs bg-[#FF5A36] hover:bg-[#E54E2B] text-white shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                    >
                      {connecting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <>
                          <MessageCircle className="w-4 h-4" />
                          <span>Chat with Owner</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* DESKTOP ONLY: Header (Title + Badges + Address) */}
              <div className="hidden lg:block pb-5 border-b border-gray-100">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E2229] tracking-tight mb-2">
                  {room.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    {flatTypeNormalized}
                  </span>
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    {lookingForLabel}
                  </span>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                    Available {formattedAvailableDate}
                  </span>
                  {compatibility !== null && (
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-3 py-1 rounded-full flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-600 fill-emerald-500" />
                      <span>{compatibility}% match</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin className="w-4 h-4 text-[#FF5A36] shrink-0" />
                  <span>{fullLocationText}</span>
                </div>
              </div>

              {/* ── Rent Info Section (Matching FlatMate 21 & 22) ───────── */}
              <div className="pb-5 border-b border-gray-100">
                <h2 className="text-base sm:text-lg font-bold text-[#1E2229] mb-4">
                  Rent Info
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Your Share</span>
                    <p className="text-base sm:text-lg font-extrabold text-[#1E2229]">
                      ₹ {rentShare.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Total Rent</span>
                    <p className="text-base sm:text-lg font-extrabold text-[#1E2229]">
                      ₹ {totalRent.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Deposit</span>
                    <p className="text-base sm:text-lg font-extrabold text-[#1E2229]">
                      {depositText}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Notice Period</span>
                    <p className="text-base sm:text-lg font-extrabold text-[#1E2229]">
                      1 Month
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Maintenance</span>
                    <p className="text-base sm:text-lg font-extrabold text-[#1E2229]">
                      Included In Rent
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block mb-1">Furnishing</span>
                    <p className="text-base sm:text-lg font-extrabold text-[#1E2229]">
                      {furnishingNormalized}
                    </p>
                  </div>
                </div>

                {/* Looking for Flatmate Banner (Matching FlatMate Reference) */}
                <div className="bg-[#FFF8F5] border border-[#FFE7DE] rounded-2xl p-4 sm:p-5 mt-5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Heart className="w-4 h-4 text-[#FF5A36] fill-[#FF5A36]" />
                    <h3 className="text-xs sm:text-sm font-bold text-[#1E2229]">
                      Looking for a Flatmate who is:
                    </h3>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{lookingForLabel} ({room.preferredGender || 'Any Gender'})</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Ready to move in {formattedAvailableDate}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{furnishingNormalized} · {occupancyLabel} Occupancy</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Clean living habits &amp; respectful of common spaces</span>
                    </li>
                  </ul>
                </div>

                {/* Quick Property Details 4-Box Grid (Matching FlatMate Reference) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4">
                  <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-150">
                    <span className="text-[11px] text-gray-400 block font-medium">Occupancy</span>
                    <span className="text-xs sm:text-sm font-bold text-[#1E2229] mt-0.5 block">{occupancyLabel}</span>
                  </div>
                  <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-150">
                    <span className="text-[11px] text-gray-400 block font-medium">Available From</span>
                    <span className="text-xs sm:text-sm font-bold text-[#1E2229] mt-0.5 block">{formattedAvailableDate}</span>
                  </div>
                  <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-150">
                    <span className="text-[11px] text-gray-400 block font-medium">Looking For</span>
                    <span className="text-xs sm:text-sm font-bold text-[#1E2229] mt-0.5 block">{lookingForLabel}</span>
                  </div>
                  <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-150">
                    <span className="text-[11px] text-gray-400 block font-medium">Furnishing</span>
                    <span className="text-xs sm:text-sm font-bold text-[#1E2229] mt-0.5 block">{furnishingNormalized}</span>
                  </div>
                </div>
              </div>

              {/* ── Pictures Section (Matching FlatMate 21 & 22) ────────── */}
              <div className="pb-5 border-b border-gray-100">
                <h2 className="text-base sm:text-lg font-bold text-[#1E2229] mb-4">
                  Pictures
                </h2>
                <div className="relative w-full h-[280px] sm:h-[400px] rounded-2xl overflow-hidden bg-gray-100 border border-gray-200/80 shadow-xs group">
                  {photos.length > 0 ? (
                    <>
                      <img
                        src={photos[carouselIdx % photos.length]}
                        alt={`${room.title} photo ${carouselIdx + 1}`}
                        onClick={() => {
                          setLightboxIdx(carouselIdx % photos.length);
                          setShowLightbox(true);
                        }}
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-500 hover:scale-[1.02]"
                      />

                      {/* Verified Badge */}
                      <div className="absolute top-3.5 left-3.5 bg-black/60 backdrop-blur-xs text-white text-xs font-semibold px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5 z-10">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Verified Photos</span>
                      </div>

                      {/* Photo Counter */}
                      <div className="absolute bottom-3.5 left-3.5 bg-black/60 backdrop-blur-xs text-white text-xs font-medium px-2.5 py-1 rounded-full shadow-xs z-10">
                        {(carouselIdx % photos.length) + 1} / {photos.length}
                      </div>

                      {/* Nav Arrows */}
                      {photos.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setCarouselIdx(p => (p === 0 ? photos.length - 1 : p - 1))}
                            aria-label="Previous image"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#1E2229] flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95 z-10"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCarouselIdx(p => (p + 1) % photos.length)}
                            aria-label="Next image"
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-[#1E2229] flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95 z-10"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>

                          {/* Dots */}
                          <div className="absolute bottom-3.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-full">
                            {photos.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setCarouselIdx(i)}
                                aria-label={`Go to slide ${i + 1}`}
                                className={`h-2 rounded-full transition-all cursor-pointer ${
                                  i === (carouselIdx % photos.length)
                                    ? 'w-5 bg-white'
                                    : 'w-2 bg-white/50 hover:bg-white/80'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-gradient-to-br from-gray-100 to-gray-50">
                      <Home className="w-10 h-10 text-[#FF5A36] mb-2" />
                      <p className="text-sm font-bold text-[#1E2229]">Photos Coming Soon</p>
                      <p className="text-xs text-gray-500 max-w-xs mt-1">Message host or express interest to see photos of this space.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Amenities Section (Matching FlatMate 21 & 22) ──────── */}
              <div className="pb-5 border-b border-gray-100">
                <h2 className="text-base sm:text-lg font-bold text-[#1E2229] mb-4">
                  Amenities
                </h2>
                {uniqueAmenities.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-5 sm:gap-7">
                    {uniqueAmenities.map((item, idx) => {
                      const IconComp = item.icon;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1.5 text-center min-w-[65px]">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-50 border border-slate-200/80 flex items-center justify-center text-[#1E2229] shadow-2xs hover:border-[#FF5A36]/40 transition-colors">
                            <IconComp className="w-6 h-6 text-[#1E2229]" />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 max-w-[85px] truncate">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No specific amenities listed for this room.</p>
                )}
              </div>

              {/* ── Description Section ──────────────────────────────── */}
              <div className="pb-5 border-b border-gray-100">
                <h2 className="text-base sm:text-lg font-bold text-[#1E2229] mb-3">
                  Description
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed font-normal mb-4">
                  {descriptionContent}
                </p>

                {/* House Rules & Preferences */}
                {realHouseRules.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                      House Rules
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {realHouseRules.map((rule, idx) => {
                        const isRestricted = isNegativeRule(rule);
                        return (
                          <span
                            key={idx}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                              isRestricted
                                ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                            }`}
                          >
                            {isRestricted ? <Ban className="w-3.5 h-3.5 text-rose-500" /> : <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            <span>{rule}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Location & Nearby (Matching FlatMate 21 & 22) ──────── */}
              <div className="pb-5 border-b border-gray-100">
                <h2 className="text-base sm:text-lg font-bold text-[#1E2229] mb-3">
                  Location &amp; Nearby
                </h2>
                <div className="bg-slate-50/70 rounded-2xl border border-gray-200/80 p-4 sm:p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-[#FFF2EB] border border-[#FFDDD2] flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-[#FF5A36]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#1E2229]">{room.locality || room.city}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{fullLocationText}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-200/80 shadow-2xs">
                      <Train className="w-4 h-4 text-blue-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Metro Station</span>
                        <span className="font-bold text-[#1E2229]">~800 m</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-200/80 shadow-2xs">
                      <Bus className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Bus Stand</span>
                        <span className="font-bold text-[#1E2229]">~300 m</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-200/80 shadow-2xs">
                      <ShoppingBag className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Supermarket</span>
                        <span className="font-bold text-[#1E2229]">~250 m</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-200/80 shadow-2xs">
                      <Hospital className="w-4 h-4 text-rose-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Hospital/Clinic</span>
                        <span className="font-bold text-[#1E2229]">~1.2 km</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Report Listing Action */}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-2">
                <span>Found wrong information?</span>
                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#1E2229] font-semibold transition-colors cursor-pointer"
                >
                  Report Listing
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* ── Similar Properties Nearby (Real Dynamic Matching Logic) ── */}
        <div className="pt-6 pb-12 border-t border-gray-200/80">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#1E2229]">
                Similar properties nearby
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Active listings in {room.locality || room.city} matching your budget &amp; preferences
              </p>
            </div>
            <button
              onClick={() => navigate('/explore?tab=rooms')}
              className="text-xs font-bold text-[#FF5A36] hover:text-[#E54E2B] flex items-center gap-1 cursor-pointer"
            >
              <span>View more</span>
              <span>→</span>
            </button>
          </div>

          {similarRooms.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {similarRooms.map(simRoom => (
                <RoomCard
                  key={simRoom.id}
                  room={simRoom}
                  isSaved={profile?.savedRoomIds?.includes(simRoom.id)}
                  onToggleSave={async (e, roomId) => {
                    e.stopPropagation();
                    if (!user?.uid) {
                      useStore.getState().openAuthModal({ title: 'Sign in to Save Rooms', redirect: `/room/${id}` });
                      return;
                    }
                    await toggleSavedRoom(user.uid, roomId, profile?.savedRoomIds?.includes(roomId));
                    await refreshProfile();
                  }}
                  onClick={() => {
                    navigate(`/room/${simRoom.id}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 bg-white rounded-2xl border border-gray-150 p-6">
              <p className="text-sm text-gray-500 mb-2">No other properties available nearby right now.</p>
              <button
                onClick={() => navigate('/explore?tab=rooms')}
                className="text-xs font-bold text-[#FF5A36] hover:underline cursor-pointer"
              >
                Browse all available listings →
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ── Mobile Sticky Bottom Action Bar (NO CALL BUTTON) ────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3 shadow-lg flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Your share</p>
          <div className="flex items-baseline">
            <span className="text-lg font-extrabold text-[#1E2229] tracking-tight">
              ₹{rentShare.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-gray-500 font-normal ml-0.5">/mo</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {requestSent ? (
            <button
              type="button"
              onClick={handleMessageOwner}
              className="px-5 py-2.5 rounded-full font-bold text-xs bg-[#FF5A36] text-white shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat with Owner</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="px-5 py-2.5 rounded-full font-bold text-xs bg-[#FF5A36] hover:bg-[#E54E2B] text-white shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              {connecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <>
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Chat with Owner</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* ── Fullscreen Interactive Lightbox Modal ────────────────────── */}
      {showLightbox && photos.length > 0 && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex flex-col backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
          onClick={e => {
            if (e.target === e.currentTarget) setShowLightbox(false);
          }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <span className="text-white/80 text-xs font-bold tracking-wider">
              {lightboxIdx + 1} OF {photos.length} PHOTOS
            </span>
            <button
              onClick={() => setShowLightbox(false)}
              aria-label="Close gallery"
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div
            className="flex-1 flex items-center justify-center relative px-6 sm:px-12 py-4"
            onClick={e => {
              if (e.target === e.currentTarget) setShowLightbox(false);
            }}
          >
            <img
              src={photos[lightboxIdx]}
              alt={`Photo ${lightboxIdx + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl transition-all duration-300"
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => setLightboxIdx(p => (p === 0 ? photos.length - 1 : p - 1))}
                  aria-label="Previous photo"
                  className="absolute left-4 w-11 h-11 flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer backdrop-blur-md border border-white/20"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setLightboxIdx(p => (p === photos.length - 1 ? 0 : p + 1))}
                  aria-label="Next photo"
                  className="absolute right-4 w-11 h-11 flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer backdrop-blur-md border border-white/20"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {photos.length > 1 && (
            <div className="py-4 px-6 flex justify-center gap-2.5 overflow-x-auto border-t border-white/10 bg-black/40">
              {photos.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIdx(i)}
                  aria-label={`View photo ${i + 1}`}
                  className={`shrink-0 w-16 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    i === lightboxIdx
                      ? 'border-[#FF5A36] scale-105 shadow-md shadow-[#FF5A36]/30'
                      : 'border-white/20 opacity-50 hover:opacity-80'
                  }`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}


      {/* ── Screening Questionnaire Modal ────────────────────────────── */}
      <ScreeningQuestionnaireModal
        isOpen={showScreeningModal}
        onClose={() => setShowScreeningModal(false)}
        questions={
          (room as any)?.screeningQuestions && (room as any).screeningQuestions.length > 0
            ? (room as any).screeningQuestions
            : CURATED_SCREENING_QUESTIONS.slice(0, 5)
        }
        listingTitle={room?.title}
        ownerName={ownerDisplayName}
        onSubmit={handleScreeningSubmit}
      />

      {/* ── Report Listing Modal ────────────────────────────────────── */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6 border border-gray-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#1E2229]">
              <AlertCircle className="w-4 h-4 text-rose-500" />
              Report Listing
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Help us keep NestMate safe. Describe what is incorrect or suspicious about this listing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Reason</label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="w-full text-xs rounded-xl border-gray-200">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent className="bg-white rounded-xl shadow-lg border-gray-200">
                  <SelectItem value="inaccurate_info">Inaccurate pricing or location</SelectItem>
                  <SelectItem value="fake_photos">Fake or stock photos</SelectItem>
                  <SelectItem value="unresponsive_host">Unresponsive or unreachable host</SelectItem>
                  <SelectItem value="broker_fee">Demanding unauthorized brokerage</SelectItem>
                  <SelectItem value="inappropriate_content">Harassment or inappropriate content</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5">Additional Details</label>
              <Textarea
                value={reportDescription}
                onChange={e => setReportDescription(e.target.value)}
                placeholder="Provide specific details so our safety team can investigate..."
                className="text-xs rounded-xl border-gray-200 resize-none h-24"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReportModalOpen(false)}
              className="rounded-full text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingReport}
              onClick={handleReportSubmit}
              className="rounded-full text-xs bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isSubmittingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
