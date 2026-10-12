import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Heart, MessageCircle, ShieldCheck, Check,
  Star, Loader2, Home as HomeIcon, MapPin, X,
  Moon, Sun, Utensils, Wind, Wine, Users, Sparkles, Briefcase, Dog, User,
  CheckCircle2, Circle, Calendar, MessageSquare, ChevronRight, ChevronLeft, Zap,
  ExternalLink, Flag, Ban, SlidersHorizontal, Bed, Compass, Coffee,
  Cigarette, Flame, Eye, Target, Share2, Copy, Bus, Train, ShoppingBag,
  Hospital, Shield, Send, Phone, Dumbbell, Activity, BookOpen, Leaf,
  Building2, ArrowRight
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useChat } from '@/hooks/useChat';
import { useConnections, getRelationshipState, getConnectedUserWhatsApp } from '@/hooks/useConnections';
import type { Connection } from '@/hooks/useConnections';
import { useNotifications } from '@/hooks/useNotifications';
import { calculateCompatibility, calculateProfileCompatibility, getActiveStatus } from '@/hooks/useMatches';
import type { MatchedUser } from '@/hooks/useMatches';
import { quizQuestions } from '@/lib/staticData';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';

import FlatmateAvatar from '@/components/FlatmateAvatar';
import ContactModal from '@/components/ContactModal';
import { formatLocationString, getDynamicPreferences, getUserHighlights } from '@/lib/dynamicTraits';

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
import StateLoading from '@/components/StateLoading';
import StateEmpty from '@/components/StateEmpty';

function getQuizLabel(questionId: string, optionId?: string): string {
  if (!optionId) return 'Not specified';
  const q = quizQuestions.find(item => item.id === questionId);
  const opt = q?.options.find(o => o.id === optionId);
  return opt ? opt.label : optionId;
}

function getMemberDuration(createdAt: any): string {
  if (!createdAt) return '< 1 Month';
  try {
    const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    const now = new Date();
    const diffDays = Math.max(0, Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)));
    if (diffDays < 30) {
      return `${Math.max(1, diffDays)} ${diffDays <= 1 ? 'day' : 'days'}`;
    }
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) {
      return `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'}`;
    }
    const diffYears = Math.floor(diffMonths / 12);
    return `${diffYears} ${diffYears === 1 ? 'year' : 'years'}`;
  } catch {
    return '1 month';
  }
}

export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { getProfile, toggleSavedProfile, blockUser, reportUser } = useUserProfile();
  const { getOrCreateChatRoom, subscribeToChatRooms } = useChat();
  const { sendRequest, subscribeToMyConnections, acceptRequest, rejectRequest } = useConnections();
  const { createNotification } = useNotifications();

  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [listing, setListing] = useState<any | null>(null);
  const [ownerListings, setOwnerListings] = useState<any[]>([]);
  const [activeRoomImgIdx, setActiveRoomImgIdx] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  const [myConnections, setMyConnections] = useState<Connection[]>([]);
  const [chatRoomMap, setChatRoomMap] = useState<Record<string, string>>({});
  const [targetWhatsApp, setTargetWhatsApp] = useState<string | null>(null);

  // Report & Block State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Memoized active room photos
  const roomPhotos = useMemo(() => {
    return Array.isArray(listing?.images)
      ? listing.images.filter((img: any): img is string => typeof img === 'string' && img.trim().length > 0)
      : [];
  }, [listing?.images]);

  // Keyboard navigation & body scroll lock for lightbox
  useEffect(() => {
    if (!showLightbox) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLightbox(false);
      if (e.key === 'ArrowLeft') setActiveRoomImgIdx(p => (p === 0 ? (roomPhotos.length > 0 ? roomPhotos.length - 1 : 0) : p - 1));
      if (e.key === 'ArrowRight') setActiveRoomImgIdx(p => (p < roomPhotos.length - 1 ? p + 1 : 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showLightbox, roomPhotos.length]);

  // Dynamic document title
  useEffect(() => {
    if (matchedUser?.profile?.name) {
      document.title = `${matchedUser.profile.name} | NestMate`;
    } else {
      document.title = 'Flatmate Profile | NestMate';
    }
  }, [matchedUser?.profile?.name]);

  // Fetch match details
  useEffect(() => {
    if (!id) return;
    setIsLoading(true);

    getProfile(id).catch(() => null).then(async (targetProfileResult) => {
      let targetProfile = targetProfileResult;
      let targetListing: any = null;
      let allListings: any[] = [];

      // Fallback: If user doc is not found directly by ID, check if ID is an ownerId from real listings in Firestore
      if (!targetProfile) {
        try {
          const lq = query(collection(db, 'listings'), where('ownerId', '==', id));
          const lsnap = await getDocs(lq);
          if (!lsnap.empty) {
            allListings = lsnap.docs.map(d => ({ id: d.id, ...d.data() }));
            const ldata = allListings[0];
            targetListing = ldata;
            targetProfile = {
              uid: id,
              name: ldata.ownerName || 'Property Host',
              role: 'owner',
              city: ldata.city || '',
              localities: [ldata.locality].filter(Boolean),
              bio: ldata.ownerBio || '',
              isVerified: !!ldata.isVerified,
              quizAnswers: ldata.ownerQuizAnswers || {}
            } as any;
          }
        } catch (e) {
          console.error('Error fetching fallback profile', e);
        }
      }

      if (targetProfile) {
        // Query active rooms belonging to this user if not already found
        if (allListings.length === 0) {
          try {
            const lq = query(
              collection(db, 'listings'),
              where('ownerId', '==', id)
            );
            const lsnap = await getDocs(lq);
            if (!lsnap.empty) {
              allListings = lsnap.docs.map(d => ({ id: d.id, ...d.data() }));
              targetListing = allListings[0];
            }
          } catch (e) {
            console.error("Failed to fetch match listings", e);
          }
        }
        setOwnerListings(allListings);
        setListing(targetListing);

        // Compute multi-factor dynamic compatibility
        const matchResult = calculateProfileCompatibility(profile, targetProfile, targetListing);

        setMatchedUser({
          profile: targetProfile,
          compatibilityScore: matchResult.score,
          matchReasons: matchResult.reasons,
          matchCaveats: matchResult.caveats,
        });
      }
      setIsLoading(false);
    });
  }, [id, profile, getProfile]);

  // Real-time connection listener
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToMyConnections(user.uid, setMyConnections);
    return unsub;
  }, [user?.uid, subscribeToMyConnections]);

  // Real-time chat room listener
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToChatRooms(user.uid, (rooms) => {
      const map: Record<string, string> = {};
      rooms.forEach(r => {
        const other = r.participants.find(p => p !== user.uid);
        if (other) map[other] = r.id;
      });
      setChatRoomMap(map);
    });
    return () => unsub();
  }, [user?.uid, subscribeToChatRooms]);

  // Fetch private WhatsApp contact if connection is accepted
  useEffect(() => {
    if (!id || !user?.uid) return;
    const isConnAccepted = myConnections.some(
      c => (c.toUserId === id || c.fromUserId === id) && c.status === 'accepted'
    );
    if (isConnAccepted) {
      getConnectedUserWhatsApp(id).then(num => {
        if (num) setTargetWhatsApp(num);
      });
    } else {
      setTargetWhatsApp(null);
    }
  }, [id, user?.uid, myConnections]);

  const handleShare = async () => {
    const shareData = {
      title: `${matchedUser?.profile?.name || 'Flatmate Profile'} | NestMate`,
      text: `Check out ${matchedUser?.profile?.name || 'this flatmate'}'s profile on NestMate!`,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (_) {
        // Ignored
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setCopyToast(true);
      toast.success('Profile link copied to clipboard!');
      setTimeout(() => setCopyToast(false), 2500);
    }
  };

  const handleBlock = async () => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: 'Sign in to Block User',
        subtitle: 'Please sign in to manage and block user profiles.',
        redirect: `/match/${id}`,
      });
      return;
    }
    if (!id) return;
    if (!window.confirm(`Block ${matchedUser?.profile.name || 'this user'}? You won't see each other or their listings again.`)) return;
    try {
      await blockUser(user.uid, id);
      await refreshProfile();
      toast.success('User blocked successfully.');
      navigate('/explore?tab=roommates');
    } catch {
      toast.error('Failed to block user. Please try again.');
    }
  };

  const handleReport = async () => {
    if (!user?.uid) {
      setReportModalOpen(false);
      useStore.getState().openAuthModal({
        title: 'Sign in to Report',
        subtitle: 'Please sign in to submit a trust and safety report.',
        redirect: `/match/${id}`,
      });
      return;
    }
    if (!id || !reportReason) {
      toast.error('Please select a reason.');
      return;
    }
    setIsSubmittingReport(true);
    try {
      await reportUser({
        reporterId: user.uid,
        targetId: id,
        reason: reportReason,
        description: reportDescription,
      });
      toast.success('Report submitted successfully.');
      setReportModalOpen(false);
      setReportReason('');
      setReportDescription('');
    } catch {
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setIsSubmittingReport(false);
    }
  };


  const handleToggleSave = async () => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: 'Save Profile',
        subtitle: 'Sign in to save candidate profiles to your shortlist.',
        redirect: `/match/${id}`,
      });
      return;
    }
    setSaving(true);
    try {
      await toggleSavedProfile(user.uid, matchedUser?.profile.uid || '', isSaved);
      await refreshProfile();
      toast.success(!isSaved ? 'Profile saved!' : 'Removed from saved');
    } catch {
      toast.error('Failed to update saved profiles');
    } finally {
      setSaving(false);
    }
  };

  const handleCallUser = () => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: `Contact ${matchedUser?.profile.name || 'Roommate'}`,
        subtitle: 'Sign in to view verified contact details.',
        redirect: `/match/${id}`,
      });
      return;
    }
    setContactModalOpen(true);
  };

  const handleConnectOrChat = async () => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: `Connect with ${matchedUser?.profile.name || 'Roommate'}`,
        subtitle: 'Sign in to send a connection request or chat.',
        redirect: `/match/${id}`,
      });
      return;
    }
    if (!matchedUser?.profile.uid) return;

    const targetUid = matchedUser.profile.uid;
    const existingConn = myConnections.find(c => c.toUserId === targetUid || c.fromUserId === targetUid);

    if (chatRoomMap[targetUid] || existingConn?.status === 'accepted') {
      setConnecting(true);
      try {
        const roomId = chatRoomMap[targetUid] || (await getOrCreateChatRoom(user.uid, targetUid));
        navigate(`/chat/${roomId}`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to open chat');
      } finally {
        setConnecting(false);
      }
      return;
    }

    if (existingConn?.status === 'pending' && existingConn.toUserId === user.uid) {
      setConnecting(true);
      try {
        await acceptRequest(existingConn.id);
        const roomId = await getOrCreateChatRoom(user.uid, targetUid);
        await createNotification({
          userId: targetUid,
          type: 'connect',
          title: 'Connection Accepted!',
          description: `${profile?.name || 'A user'} accepted your connect request. Start chatting!`,
          read: false,
          actionUrl: `/chat/${roomId}`,
          connectionId: existingConn.id,
        });
        toast.success('Connection accepted! Opening chat...');
        navigate(`/chat/${roomId}`);
      } catch (err) {
        console.error(err);
        toast.error('Failed to accept request');
      } finally {
        setConnecting(false);
      }
      return;
    }

    if (existingConn?.status === 'pending' && existingConn.fromUserId === user.uid) {
      toast.info('Connection request already sent and pending.');
      return;
    }

    setConnecting(true);
    try {
      const connectionId = await sendRequest(user.uid, targetUid);
      const isTargetOwner = matchedUser?.profile.role === 'owner';
      const actionUrl = isTargetOwner
        ? `/owner-dashboard?request=${connectionId}`
        : `/match/${user.uid}`;

      await createNotification({
        userId: targetUid,
        type: 'connect',
        title: 'New Connect Request!',
        description: `${profile?.name || 'Someone'} wants to connect with you.`,
        read: false,
        actionUrl,
        connectionId,
      });
      toast.success('Connect request sent successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to send request');
    } finally {
      setConnecting(false);
    }
  };

  if (isLoading) return <StateLoading label="Loading profile..." fullScreen />;

  if (!matchedUser) return (
    <div className="min-h-screen bg-[#FBFBFC] flex items-center justify-center px-4">
      <StateEmpty
        icon={Star}
        title="Profile not found"
        description="This profile could not be found or may have been removed."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => navigate('/explore?tab=roommates')}
              className="px-5 py-2.5 rounded-full font-bold text-xs bg-[#FF5A36] hover:bg-[#E54E2B] text-white shadow-xs cursor-pointer"
            >
              Browse Roommates
            </button>
            <button
              onClick={() => navigate('/explore?tab=rooms')}
              className="px-5 py-2.5 rounded-full font-bold text-xs bg-white hover:bg-gray-50 border border-gray-200 text-[#1E2229] shadow-2xs cursor-pointer"
            >
              Browse Rooms
            </button>
          </div>
        }
      />
    </div>
  );

  const p = matchedUser.profile;
  const isSaved = profile?.savedProfileIds?.includes(p.uid || '') || false;
  const activeStatus = getActiveStatus(p.lastActiveAt);
  const isOnline = activeStatus?.status === 'online';
  const activeLabel = activeStatus?.text || (p.lastActiveAt ? getActiveStatus(p.lastActiveAt)?.text : null) || 'Active recently';
  const isActiveRecently = isOnline || activeStatus?.status === 'recent' || activeLabel.toLowerCase().includes('today') || activeLabel.toLowerCase().includes('now') || activeLabel.toLowerCase().includes('h ago') || activeLabel.toLowerCase().includes('min');

  const targetUid = p.uid || id || '';
  const connectState = getRelationshipState(user?.uid, targetUid, myConnections, chatRoomMap);
  const compatibilityScore = matchedUser.compatibilityScore || 0;
  const matchReasons = matchedUser.matchReasons || [];
  const matchCaveats = matchedUser.matchCaveats || [];
  const hasUserQuiz = Boolean(profile?.quizAnswers && Object.keys(profile.quizAnswers).length > 0);

  // Real member duration calculated from account creation
  const memberDuration = getMemberDuration(p.createdAt);

  // Real successful connections involving this user
  const acceptedMatches = myConnections.filter(
    c => (c.fromUserId === targetUid || c.toUserId === targetUid) && c.status === 'accepted'
  ).length;



  // Real trust metrics
  const isIdentityVerified = !!p.isVerified;
  const isPhoneVerified = !!(p.phone && p.phone.trim().length > 0);
  const isEmailVerified = !!(p.email || p.workEmailVerified);

  // Unified lifestyle preferences from quizAnswers OR householdExpectations OR listing houseRules
  const resolvedPreferences: Record<string, string> = { ...(p.quizAnswers || {}) };

  if (p.householdExpectations) {
    if (!resolvedPreferences.smoking && p.householdExpectations.smokingPolicy) {
      resolvedPreferences.smoking = p.householdExpectations.smokingPolicy === 'no_smoking' ? 'never' : 'occasionally';
    }
    if (!resolvedPreferences.pets && p.householdExpectations.petPolicy) {
      resolvedPreferences.pets = p.householdExpectations.petPolicy === 'no_pets' ? 'no' : 'yes';
    }
    if (!resolvedPreferences.food_pref && p.householdExpectations.dietPref) {
      resolvedPreferences.food_pref = p.householdExpectations.dietPref === 'veg' ? 'veg' : 'no_pref';
    }
    if (!resolvedPreferences.roommate_gender && (p.householdExpectations.genderPref || (listing as any)?.genderPreference)) {
      resolvedPreferences.roommate_gender = p.householdExpectations.genderPref || (listing as any)?.genderPreference;
    }
  }

  if (listing?.houseRules && Array.isArray(listing.houseRules)) {
    if (!resolvedPreferences.cleanliness && listing.houseRules.some((r: string) => r.toLowerCase().includes('clean'))) {
      resolvedPreferences.cleanliness = 'very';
    }
    if (!resolvedPreferences.smoking && listing.houseRules.some((r: string) => r.toLowerCase().includes('no smoking'))) {
      resolvedPreferences.smoking = 'never';
    }
    if (!resolvedPreferences.pets && listing.houseRules.some((r: string) => r.toLowerCase().includes('no pets'))) {
      resolvedPreferences.pets = 'no';
    }
    if (!resolvedPreferences.guests && listing.houseRules.some((r: string) => r.toLowerCase().includes('no parties'))) {
      resolvedPreferences.guests = 'rarely';
    }
  }

  const rentShare = listing?.partnerShare || listing?.rent || listing?.totalRent || 0;

  // Locality & City resolution (strictly dynamic real data, zero hardcoded city fallbacks)
  const userLocality = listing?.locality || p.localities?.[0] || p.locality || '';
  const userCity = listing?.city || p.city || '';
  const userState = p.state || (listing as any)?.state;
  const userLocationText = formatLocationString(userLocality, userCity, userState);

  // Dynamic preference badges derived strictly from real user/listing data
  const preferencesList = getDynamicPreferences({
    quizAnswers: p.quizAnswers,
    householdExpectations: p.householdExpectations,
    houseRules: listing?.houseRules,
    amenities: listing?.amenities,
    profession: p.profession,
  });

  // Highlights list derived strictly from real user profile data
  const highlightsList = getUserHighlights(p, isIdentityVerified, resolvedPreferences);

  const hasLifestylePreferences = Object.keys(resolvedPreferences).length > 0;
  const isOwner = p.role === 'owner' || ownerListings.length > 0 || Boolean(listing);

  return (
    <div className="min-h-screen bg-[#FBFBFC] pb-32 sm:pb-36 lg:pb-20 text-[#1E2229] font-sans">

      {/* ── Toast Notification ──────────────────────────────────────── */}
      {copyToast && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[80] bg-[#1E2229]/95 backdrop-blur-md text-white text-xs font-semibold px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-white/10 animate-fade-up"
        >
          <Copy className="w-3.5 h-3.5 text-[#FF5A36]" />
          <span>Profile link copied to clipboard</span>
        </div>
      )}

      {/* ── Main Container (Centered, Clean, Minimalist FlatMate-style sheet) ── */}
      <div className="max-w-2xl sm:max-w-3xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">

        {/* ── Top Navigation Bar (Always at the very top on mobile & desktop) ── */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 sm:px-5 h-12 border border-gray-200/80 shadow-2xs text-xs mb-5 sm:mb-6">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-gray-700 hover:text-[#1E2229] font-bold transition-colors cursor-pointer shrink-0 py-1.5 px-2.5 rounded-xl hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <span className="text-gray-300 hidden sm:inline">/</span>
            <Link
              to="/"
              className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors truncate hidden sm:inline font-medium"
            >
              Home
            </Link>
            <span className="text-gray-300 hidden sm:inline">/</span>
            <Link
              to={isOwner ? '/explore?tab=rooms' : '/explore?tab=roommates'}
              className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors truncate hidden sm:inline font-medium"
            >
              {isOwner ? 'Rooms & Hosts' : 'Roommates'}
            </Link>
            <span className="text-gray-300">/</span>
            <span className="font-extrabold text-[#1E2229] truncate">
              {p.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200/80 text-gray-700 font-bold transition-all cursor-pointer text-xs shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              type="button"
              onClick={handleToggleSave}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-bold transition-all cursor-pointer text-xs shadow-2xs ${
                isSaved
                  ? 'bg-rose-50 text-rose-600 border-rose-200'
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200/80 text-gray-700'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-rose-500 text-rose-500' : 'text-gray-500'}`} />
              <span className="hidden sm:inline">{isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* ── UNIFIED WHITE PROFILE CARD (FlatMate Reference Design) ── */}
        <div className="bg-white rounded-3xl border border-gray-200/80 shadow-2xs p-6 sm:p-10 mb-8 sm:mb-12">

          {/* 1. Hero Profile Header */}
          <div className="flex flex-col items-center text-center">
            {/* Centered Circular Avatar */}
            <div className="mb-4 relative">
              <FlatmateAvatar
                avatar={p.avatar}
                name={p.name}
                gender={p.gender}
                isVerified={isIdentityVerified}
                illustrationType={p.name?.toLowerCase().includes('arun') ? 'arun' : undefined}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-full shadow-xs ring-4 ring-gray-50 object-cover"
              />
            </div>

            {/* Name & Verification Badge */}
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2229] mb-1 flex items-center justify-center gap-1.5">
              <span>{p.name}</span>
              {isIdentityVerified && (
                <span title={isOwner ? "Verified Host" : "Verified User"} className="text-emerald-500">
                  <CheckCircle2 className="w-5 h-5 fill-emerald-500 text-white" />
                </span>
              )}
            </h1>

            {/* Profession & City Subtitle */}
            <p className="text-xs font-semibold text-gray-500 mb-1.5">
              {isOwner
                ? (p.profession ? `${p.profession} · Property Host` : 'Property Host / Room Provider')
                : (p.profession || 'Room Seeker')}
              {userCity ? ` · ${userCity}` : ''}
            </p>

            {/* Room Provider Pill Badge */}
            {isOwner && (
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/20 text-[11px] font-bold mb-2 shadow-2xs">
                <Building2 className="w-3.5 h-3.5 text-[#FF5A36]" />
                <span>Room Provider · {ownerListings.length > 0 ? `${ownerListings.length} Available Space${ownerListings.length > 1 ? 's' : ''}` : 'Verified Property'}</span>
              </div>
            )}

            {/* Active Status Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100/80 text-[11px] font-bold mb-4">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span>{activeLabel}</span>
            </div>

            {/* Action Buttons: Edit Profile if own profile, else Chat & Call */}
            {user?.uid === p.uid ? (
              <div className="w-full max-w-xs mb-3.5">
                <button
                  type="button"
                  onClick={() => navigate('/edit-profile')}
                  className="w-full py-2.5 px-5 rounded-full font-bold text-xs sm:text-sm bg-[#FF5A36] hover:bg-[#E54E2B] text-white shadow-md shadow-[#FF5A36]/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  <User className="w-4 h-4" />
                  <span>Edit My Profile</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 w-full max-w-xs mb-3.5">
                <button
                  type="button"
                  onClick={handleConnectOrChat}
                  disabled={connecting || connectState === 'pending_sent'}
                  className="flex-1 py-2.5 px-5 rounded-full font-bold text-xs sm:text-sm bg-[#FF5A36] hover:bg-[#E54E2B] text-white shadow-md shadow-[#FF5A36]/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-85"
                >
                  {connecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <MessageCircle className="w-4 h-4" />
                      <span>
                        {connectState === 'pending_sent' ? 'Requested' :
                          connectState === 'pending_received' ? 'Accept' :
                            connectState === 'connected' ? 'Message' : (isOwner ? 'Chat with Host' : 'Chat')}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Centered Location with Pin */}
            <div className="flex items-center justify-center gap-1 text-xs sm:text-sm font-medium text-gray-500">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{userLocationText || userCity || 'Location not specified'}</span>
            </div>
          </div>

          <hr className="border-gray-150 my-6 sm:my-7" />

          {/* 2. Match Compatibility (Original Engine & Reasons) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">
                {isOwner ? 'Compatibility with Host & Space' : 'Match Compatibility'}
              </h2>
              {user && compatibilityScore > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#FF5A36] bg-[#FFF2EB] px-2.5 py-0.5 rounded-full border border-[#FF5A36]/20">
                  <Sparkles className="w-3 h-3 text-[#FF5A36]" />
                  <span>{compatibilityScore}% Match</span>
                </span>
              )}
            </div>

            {user && compatibilityScore > 0 ? (
              <div className="space-y-3">
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#FF5A36] to-[#F26428] h-full rounded-full transition-all duration-500 shadow-xs"
                    style={{ width: `${Math.min(100, compatibilityScore)}%` }}
                  />
                </div>

                {matchReasons.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {matchReasons.map((reason, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-[#FFF9F6] border border-[#FF5A36]/15 text-xs text-gray-700">
                        <Check className="w-3.5 h-3.5 text-[#FF5A36] shrink-0 font-bold" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[#FFF9F6] border border-[#FF5A36]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                <p className="text-xs text-gray-600">
                  {!user
                    ? "Sign in to calculate personalized compatibility across lifestyle, budget, and habits."
                    : !hasUserQuiz
                      ? "Complete your lifestyle quiz to unlock deep multi-factor compatibility."
                      : "Compatibility score will appear as mutual preferences align."}
                </p>
                {!user ? (
                  <button
                    type="button"
                    onClick={() => useStore.getState().openAuthModal({
                      title: 'Match Compatibility',
                      subtitle: 'Sign in to see how well your habits align.',
                      redirect: `/match/${id}`
                    })}
                    className="shrink-0 text-xs font-bold text-[#FF5A36] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FF5A36]" />
                    <span>Sign in to match →</span>
                  </button>
                ) : !hasUserQuiz ? (
                  <button
                    type="button"
                    onClick={() => navigate('/preferences')}
                    className="shrink-0 text-xs font-bold text-[#FF5A36] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FF5A36]" />
                    <span>Take quiz →</span>
                  </button>
                ) : null}
              </div>
            )}
          </div>

          {/* Available Rooms Offered by Room Provider */}
          {isOwner && ownerListings.length > 0 && (
            <>
              <hr className="border-gray-150 my-6 sm:my-7" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-[#1E2229] flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-[#FF5A36]" />
                      <span>Available Rooms by {p.name}</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Explore active spaces and rooms hosted by {p.name}</p>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/20">
                    {ownerListings.length} {ownerListings.length === 1 ? 'Space' : 'Spaces'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ownerListings.map((item: any) => {
                    const itemImg = (item.images && item.images.length > 0 && item.images[0]) ||
                      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80';
                    const rentVal = item.partnerShare || item.rent || item.totalRent || 0;
                    return (
                      <div
                        key={item.id}
                        onClick={() => navigate(`/room/${item.id}`)}
                        className="group bg-white rounded-2xl border border-gray-200/90 hover:border-[#FF5A36]/50 p-3.5 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                      >
                        <div>
                          <div className="relative aspect-video rounded-xl overflow-hidden mb-3 bg-gray-100">
                            <img
                              src={itemImg}
                              alt={item.title || 'Room'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute top-2 left-2 flex items-center gap-1.5">
                              <span className="bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                                {item.flatType || 'Room'}
                              </span>
                              {item.furnishing && (
                                <span className="bg-white/90 backdrop-blur-xs text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                                  {item.furnishing}
                                </span>
                              )}
                            </div>
                            {item.genderPreference && (
                              <div className="absolute bottom-2 left-2">
                                <span className="bg-white/95 backdrop-blur-xs text-[#1E2229] text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                                  {item.genderPreference} preferred
                                </span>
                              </div>
                            )}
                          </div>

                          <h3 className="text-sm font-bold text-[#1E2229] group-hover:text-[#FF5A36] transition-colors line-clamp-1 mb-1">
                            {item.title || `${item.flatType || 'Room'} in ${item.locality || item.city}`}
                          </h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mb-3 line-clamp-1">
                            <MapPin className="w-3.5 h-3.5 text-[#FF5A36] shrink-0" />
                            <span>{item.locality ? `${item.locality}, ${item.city}` : item.city || 'Location not specified'}</span>
                          </p>
                        </div>

                        <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
                          <div>
                            <span className="text-sm font-extrabold text-[#FF5A36]">
                              ₹{rentVal.toLocaleString('en-IN')}
                            </span>
                            <span className="text-[11px] text-gray-400 font-medium"> / month</span>
                          </div>
                          <span className="text-xs font-bold text-[#FF5A36] group-hover:underline flex items-center gap-1">
                            <span>View Details</span>
                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <hr className="border-gray-150 my-6 sm:my-7" />

          {/* 3. Basic Info (Owner Hosting Overview vs Seeker Roommate Overview) */}
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">
              {isOwner ? 'Hosting & Property Overview' : 'Basic Info'}
            </h2>
            {isOwner ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-left">
                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Host Role</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    Room Provider
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Monthly Rent</span>
                  <span className="text-sm font-bold text-[#FF5A36]">
                    {listing
                      ? `₹ ${rentShare.toLocaleString('en-IN')}/mo`
                      : 'Contact Host'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Security Deposit</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {listing?.deposit
                      ? `₹ ${listing.deposit.toLocaleString('en-IN')}`
                      : (listing ? 'Contact Host' : 'Not specified')}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Property Type</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {listing?.flatType || listing?.propertyType || (isOwner ? 'Apartment' : 'Not specified')}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Preferred Tenant</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {listing?.genderPreference ? `${listing.genderPreference} preferred` : 'Any (Male / Female)'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Furnishing</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {listing?.furnishing || (isOwner ? 'Semi-Furnished' : 'Not specified')}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Available From</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {listing?.availableFrom || 'Immediately'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Host on NestMate</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {memberDuration}
                  </span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-6 text-left">
                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Gender</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {p.gender ? (p.gender.toLowerCase() === 'female' ? '♀ Female' : '♂ Male') : 'Any'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">
                    {listing ? 'Approx Rent' : 'Budget'}
                  </span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {listing
                      ? `₹ ${rentShare.toLocaleString('en-IN')}`
                      : p.budget
                        ? `₹ ${p.budget.toLocaleString('en-IN')}`
                        : 'Flexible'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Occupancy</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {listing?.flatType || p.preferredRoomType || 'Single'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Looking For</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {listing ? ((listing as any).propertyType || 'Roommate') : 'Any'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Occupation</span>
                  <span className="text-sm font-bold text-[#1E2229] truncate block">
                    {p.profession || 'Working Professional'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-gray-400 font-medium block mb-1">Member Since</span>
                  <span className="text-sm font-bold text-[#1E2229]">
                    {memberDuration}
                  </span>
                </div>
              </div>
            )}
          </div>

          <hr className="border-gray-150 my-6 sm:my-7" />

          {/* 4. Pictures (Carousel - only if photos exist) */}
          {roomPhotos.length > 0 && (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">Pictures</h2>
                  {listing && (
                    <button
                      onClick={() => navigate(`/room/${listing.id}`)}
                      className="text-xs font-bold text-[#FF5A36] hover:underline cursor-pointer"
                    >
                      View listing →
                    </button>
                  )}
                </div>

                <div className="relative rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 aspect-[16/10] max-h-[380px] flex items-center justify-center group">
                  <img
                    src={roomPhotos[activeRoomImgIdx] || roomPhotos[0]}
                    alt="Space"
                    onClick={() => setShowLightbox(true)}
                    className="w-full h-full object-cover select-none cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                  />

                  {roomPhotos.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRoomImgIdx(idx => (idx === 0 ? roomPhotos.length - 1 : idx - 1));
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-700 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveRoomImgIdx(idx => (idx === roomPhotos.length - 1 ? 0 : idx + 1));
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-700 shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-full">
                        {roomPhotos.map((_: string, i: number) => (
                          <button
                            key={i}
                            onClick={() => setActiveRoomImgIdx(i)}
                            className={`rounded-full transition-all cursor-pointer ${
                              i === activeRoomImgIdx ? 'w-3.5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/60'
                            }`}
                            aria-label={`Slide ${i + 1}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <hr className="border-gray-150 my-6 sm:my-7" />
            </>
          )}

          {/* 5. Trust & Verification (Original Trust Signals) */}
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">Trust &amp; Verification</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left">
              <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${
                isIdentityVerified ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-[#FAF8F5] border-gray-150 text-gray-500'
              }`}>
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${isIdentityVerified ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>{isOwner ? 'Host ID' : 'ID'} {isIdentityVerified ? 'Verified' : 'Pending'}</span>
              </div>

              <div className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${
                isPhoneVerified ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800' : 'bg-[#FAF8F5] border-gray-150 text-gray-500'
              }`}>
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${isPhoneVerified ? 'text-emerald-600' : 'text-gray-400'}`} />
                <span>Phone {isPhoneVerified ? 'Verified' : 'Pending'}</span>
              </div>

              <div className="p-3 rounded-2xl border bg-[#FAF8F5] border-gray-150 text-gray-700 flex items-center gap-2.5 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{isOwner ? (isIdentityVerified ? 'Verified Host' : 'Host Member') : 'Active Member'}</span>
              </div>

              <div className="p-3 rounded-2xl border bg-[#FAF8F5] border-gray-150 text-gray-700 flex items-center gap-2.5 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{isOwner ? 'Direct Owner (0 Brokerage)' : 'Zero Brokerage'}</span>
              </div>
            </div>
          </div>

          <hr className="border-gray-150 my-6 sm:my-7" />

          {/* 6. Preferences (Original Illustrated Badges) */}
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">Preferences</h2>
            {preferencesList.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 text-center">
                {preferencesList.map((pref, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#F5F8F6] border border-gray-150 flex items-center justify-center text-gray-700 shadow-2xs mb-2 hover:scale-105 transition-transform">
                      <pref.icon className="w-6 h-6 stroke-[1.75]" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 leading-tight">
                      {pref.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No specific preferences recorded yet.</p>
            )}
          </div>

          <hr className="border-gray-150 my-6 sm:my-7" />

          {/* 7. Living Habits & Schedule (Original Detailed Breakdown) */}
          {hasLifestylePreferences && (
            <>
              <div className="space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">Living Habits &amp; Schedule</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                  {resolvedPreferences.sleep_schedule && (
                    <div className="p-3 rounded-2xl bg-[#F5F8F6] border border-gray-150">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Sleep Schedule</span>
                      <span className="font-bold text-xs text-[#1E2229]">
                        {resolvedPreferences.sleep_schedule === 'early_bird' ? 'Early Bird (10 PM)' : 'Night Owl (1 AM+)'}
                      </span>
                    </div>
                  )}

                  {resolvedPreferences.cleanliness && (
                    <div className="p-3 rounded-2xl bg-[#F5F8F6] border border-gray-150">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Cleanliness</span>
                      <span className="font-bold text-xs text-[#1E2229]">
                        {resolvedPreferences.cleanliness === 'very' ? 'Very Clean' : 'Moderate'}
                      </span>
                    </div>
                  )}

                  {resolvedPreferences.smoking && (
                    <div className="p-3 rounded-2xl bg-[#F5F8F6] border border-gray-150">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Smoking</span>
                      <span className="font-bold text-xs text-[#1E2229]">
                        {resolvedPreferences.smoking === 'never' ? 'Non-Smoker' : 'Occasional'}
                      </span>
                    </div>
                  )}

                  {resolvedPreferences.food_pref && (
                    <div className="p-3 rounded-2xl bg-[#F5F8F6] border border-gray-150">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Diet</span>
                      <span className="font-bold text-xs text-[#1E2229]">
                        {resolvedPreferences.food_pref === 'veg' ? 'Pure Vegetarian' : 'Non-Vegetarian'}
                      </span>
                    </div>
                  )}

                  {resolvedPreferences.guests && (
                    <div className="p-3 rounded-2xl bg-[#F5F8F6] border border-gray-150">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Guests</span>
                      <span className="font-bold text-xs text-[#1E2229]">
                        {resolvedPreferences.guests === 'rarely' ? 'Rare Guests' : 'Guests Welcome'}
                      </span>
                    </div>
                  )}

                  {resolvedPreferences.pets && (
                    <div className="p-3 rounded-2xl bg-[#F5F8F6] border border-gray-150">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Pets</span>
                      <span className="font-bold text-xs text-[#1E2229]">
                        {resolvedPreferences.pets === 'yes' ? 'Pet Friendly' : 'No Pets'}
                      </span>
                    </div>
                  )}

                  {resolvedPreferences.work_schedule && (
                    <div className="p-3 rounded-2xl bg-[#F5F8F6] border border-gray-150">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Work Style</span>
                      <span className="font-bold text-xs text-[#1E2229]">
                        {resolvedPreferences.work_schedule === 'wfh' ? 'Work From Home' : 'Office Going'}
                      </span>
                    </div>
                  )}

                  {resolvedPreferences.social_vibe && (
                    <div className="p-3 rounded-2xl bg-[#F5F8F6] border border-gray-150">
                      <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Social Vibe</span>
                      <span className="font-bold text-xs text-[#1E2229]">
                        {resolvedPreferences.social_vibe === 'quiet' ? 'Quiet & Chill' : 'Social & Outgoing'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <hr className="border-gray-150 my-6 sm:my-7" />
            </>
          )}

          {/* 8. Highlights (Pill Badges with Checkmark) */}
          <div className="space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">Highlights</h2>
            {highlightsList.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                {highlightsList.map((highlight, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#EBF6FF] text-[#1E70B8] border border-blue-100 text-xs font-medium shadow-2xs"
                  >
                    <Check className="w-3.5 h-3.5 text-[#1E70B8] stroke-[2.5]" />
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No specific highlights listed yet.</p>
            )}
          </div>

          <hr className="border-gray-150 my-6 sm:my-7" />

          {/* 9. Amenities (Clean Circular Icons) */}
          {listing?.amenities && listing.amenities.length > 0 && (
            <>
              <div className="space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">Amenities</h2>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
                  {listing.amenities.map((amenity: string, idx: number) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="w-13 h-13 rounded-full bg-gray-50 border border-gray-150 flex items-center justify-center text-gray-700 shadow-2xs mb-1.5">
                        <Sparkles className="w-5 h-5 text-gray-600" />
                      </div>
                      <span className="text-xs font-medium text-gray-700 leading-tight">
                        {amenity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-gray-150 my-6 sm:my-7" />
            </>
          )}

          {/* 10. House Rules & Guidelines (Only if Listing Associated) */}
          {listing?.houseRules && listing.houseRules.length > 0 && (
            <>
              <div className="space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">House Rules &amp; Guidelines</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {listing.houseRules.map((rule: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F5F8F6] border border-gray-150 text-xs text-gray-700">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2.5]" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="border-gray-150 my-6 sm:my-7" />
            </>
          )}

          {/* 11. Description / About */}
          <div className="space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">
              {isOwner ? `About Host ${p.name}` : `About ${p.name}`}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              {p.bio && p.bio.trim().length > 0
                ? p.bio
                : isOwner
                  ? `Property Host offering clean, safe, and comfortable living spaces in ${userCity || 'the city'}. Direct owner, zero brokerage, transparent house terms.`
                  : "Looking for friendly, peaceful flatmates to share a clean living space and good vibes."}
            </p>
          </div>

          <hr className="border-gray-150 my-6 sm:my-7" />

          {/* 12. Neighborhood & Transit (Original Locality & Commute Details) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-[#1E2229]">Neighborhood &amp; Transit</h2>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([userLocality, userCity].filter(Boolean).join(', ') || 'India')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#FF5A36] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Metro Station near ${userLocality} ${userCity}`.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-2xl bg-[#F5F8F6] hover:bg-[#ECF2ED] border border-gray-150 flex items-center justify-between transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Train className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Metro Connectivity</span>
                    <span className="text-xs font-bold text-[#1E2229] group-hover:text-[#FF5A36] transition-colors">Find Stations</span>
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-[#FF5A36]" />
              </a>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Bus Stop near ${userLocality} ${userCity}`.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-2xl bg-[#F5F8F6] hover:bg-[#ECF2ED] border border-gray-150 flex items-center justify-between transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Bus className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Public Transport</span>
                    <span className="text-xs font-bold text-[#1E2229] group-hover:text-[#FF5A36] transition-colors">Find Bus Stops</span>
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-[#FF5A36]" />
              </a>

              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Supermarket near ${userLocality} ${userCity}`.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-2xl bg-[#F5F8F6] hover:bg-[#ECF2ED] border border-gray-150 flex items-center justify-between transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Local Market</span>
                    <span className="text-xs font-bold text-[#1E2229] group-hover:text-[#FF5A36] transition-colors">Find Markets</span>
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-[#FF5A36]" />
              </a>
            </div>
          </div>

          <hr className="border-gray-150 my-6 sm:my-7" />

          {/* 13. Safety & Report Host / User */}
          <div className="flex items-center justify-between py-1 text-xs text-gray-500">
            <span>{isOwner ? 'Incorrect listing details or suspicious host?' : 'Not looking good or fake?'}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBlock}
                className="px-3.5 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:text-rose-600 hover:border-rose-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                Block
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!user?.uid) {
                    useStore.getState().openAuthModal({
                      title: 'Sign in to Report',
                      subtitle: 'Please sign in to submit a trust and safety report.',
                      redirect: `/match/${id}`,
                    });
                    return;
                  }
                  setReportModalOpen(true);
                }}
                className="px-4 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:text-amber-600 hover:border-amber-200 text-xs font-semibold cursor-pointer transition-colors"
              >
                {isOwner ? 'Report Host / Space' : 'Report User'}
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ── Mobile Floating Action Bar (NestMate Orange Pills) ── */}
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-white/95 backdrop-blur-xl border-t border-gray-200/80 z-40 lg:hidden flex items-center justify-center gap-3 shadow-[0_-8px_24px_rgba(0,0,0,0.06)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {user?.uid === p.uid ? (
          <button
            type="button"
            onClick={() => navigate('/edit-profile')}
            className="w-full max-w-[280px] h-11 px-5 rounded-full font-bold text-xs sm:text-sm bg-[#FF5A36] hover:bg-[#E54E2B] text-white shadow-md shadow-[#FF5A36]/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
          >
            <User className="w-4 h-4" />
            <span>Edit My Profile</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleConnectOrChat}
              disabled={connecting || connectState === 'pending_sent'}
              className="flex-1 max-w-[200px] h-11 px-5 rounded-full font-bold text-xs sm:text-sm bg-[#FF5A36] hover:bg-[#E54E2B] text-white shadow-md shadow-[#FF5A36]/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-85"
            >
              {connecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <MessageCircle className="w-4 h-4" />
                  <span>
                    {connectState === 'pending_sent' ? 'Requested' :
                      connectState === 'pending_received' ? 'Accept' :
                        connectState === 'connected' ? 'Message' : (isOwner ? 'Chat with Host' : 'Chat')}
                  </span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* ── Contact Phone Modal ───────────────────────────────────────── */}
      <ContactModal
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        profile={p ? { ...p, whatsappNumber: targetWhatsApp || undefined } : null}
      />

      {/* ── Report Modal ─────────────────────────────────────────────── */}
      <Dialog open={reportModalOpen} onOpenChange={setReportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report User</DialogTitle>
            <DialogDescription>
              Help us keep NestMate safe. Please provide a reason for reporting {p.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1.5">Reason</label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fake_profile">Fake Profile / Identity</SelectItem>
                  <SelectItem value="inappropriate_behavior">Inappropriate Behavior</SelectItem>
                  <SelectItem value="spam_or_scam">Spam or Financial Scam</SelectItem>
                  <SelectItem value="harassment">Harassment</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1.5">Additional Details</label>
              <Textarea
                placeholder="Describe what happened..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportModalOpen(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold" onClick={handleReport} disabled={isSubmittingReport}>
              {isSubmittingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fullscreen Interactive Lightbox Modal ────────────────────── */}
      {showLightbox && roomPhotos.length > 0 && (
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
              {activeRoomImgIdx + 1} OF {roomPhotos.length} PHOTOS
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
              src={roomPhotos[activeRoomImgIdx]}
              alt={`Space photo ${activeRoomImgIdx + 1}`}
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl transition-all duration-300"
            />
            {roomPhotos.length > 1 && (
              <>
                <button
                  onClick={() => setActiveRoomImgIdx(p => (p === 0 ? roomPhotos.length - 1 : p - 1))}
                  aria-label="Previous photo"
                  className="absolute left-4 w-11 h-11 flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer backdrop-blur-md border border-white/20"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => setActiveRoomImgIdx(p => (p === roomPhotos.length - 1 ? 0 : p + 1))}
                  aria-label="Next photo"
                  className="absolute right-4 w-11 h-11 flex items-center justify-center bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer backdrop-blur-md border border-white/20"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {roomPhotos.length > 1 && (
            <div className="py-4 px-6 flex justify-center gap-2.5 overflow-x-auto border-t border-white/10 bg-black/40">
              {roomPhotos.map((src: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setActiveRoomImgIdx(i)}
                  aria-label={`View photo ${i + 1}`}
                  className={`shrink-0 w-16 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                    i === activeRoomImgIdx
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

    </div>
  );
}
