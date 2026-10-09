import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { cities, localitiesByCity, flatTypes, furnishingTypes, amenitiesList } from '@/lib/staticData';
import { useAuth } from '@/hooks/useAuth';
import { useMatches, calculateCompatibility, calculateRoomCompatibility, getActiveStatus } from '@/hooks/useMatches';
import { getMatchReasons, getRoomMatchReasons } from '@/lib/matching';
import { useChat } from '@/hooks/useChat';
import { useConnections, FREE_CONNECT_LIMIT } from '@/hooks/useConnections';
import { useNotifications } from '@/hooks/useNotifications';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { MatchedUser } from '@/hooks/useMatches';
import type { Connection } from '@/hooks/useConnections';
import { toast } from 'sonner';
import { Drawer } from 'vaul';
import {
  Search, LayoutGrid, List, Crown, Shield, ShieldCheck, Star, MessageCircle,
  Heart, HeartOff, Bookmark, Home, Loader2, X, Filter, SlidersHorizontal,
  MoreVertical, Flag, Ban, Check, CheckCircle2, Bell, Sparkles, ChevronDown,
  Phone, UserCheck, Send, ArrowRight, Clock, MapPin, MessageSquare, Trash2, Users
} from 'lucide-react';
import TrustBadge from '@/components/TrustBadge';
import ProfileCompleteness from '@/components/ProfileCompleteness';
import { budgetOverlapPct } from '@/lib/displayTruth';
import StateEmpty from '@/components/StateEmpty';
import SeekerTrustBanner from '@/components/SeekerTrustBanner';
import { StateSkeletonGrid } from '@/components/StateLoading';
import FlatmateAvatar from '@/components/FlatmateAvatar';
import CompactRoomCard from '@/components/CompactRoomCard';
import DashboardSeekerCard from '@/components/DashboardSeekerCard';
import ContactModal from '@/components/ContactModal';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Listing } from '@/hooks/useListings';
import type { UserProfile } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

export default function SeekerDashboard() {
  const navigate = useNavigate();
  const { profile, user, refreshProfile } = useAuth();
  const { filters, updateFilters } = useStore();
  const { findMatches, getProfilesByIds, hasMore } = useMatches();
  const { subscribeToChatRooms, getOrCreateChatRoom } = useChat();
  const { sendRequest, getMyConnections, getMonthlyConnectCount, subscribeToMyConnections, acceptRequest, rejectRequest } = useConnections();
  const { createNotification } = useNotifications();
  const { toggleSavedProfile, toggleSavedRoom, addSkippedUser, blockUser, reportUser, saveSearch, deleteSearch, updateProfile } = useUserProfile();
  const { logEvent } = useAnalytics();

  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'connections' ? 'connections' : (searchParams.get('tab') === 'saved' ? 'saved' : 'all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<'best' | 'newest' | 'budgetAsc' | 'budgetDesc'>('best');
  const [activeTab, setActiveTab] = useState<'all' | 'saved' | 'connections'>(initialTab);
  const [savedSubTab, setSavedSubTab] = useState<'flatmates' | 'rooms'>('flatmates');
  const [connectionSubTab, setConnectionSubTab] = useState<'connected' | 'received' | 'sent'>('connected');
  const [contactModalProfile, setContactModalProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'connections' || tabParam === 'saved' || tabParam === 'all') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  const [searchQuery, setSearchQuery] = useState('');
  const [matches, setMatches] = useState<MatchedUser[]>([]);
  const [savedProfiles, setSavedProfiles] = useState<MatchedUser[]>([]);
  const [savedRooms, setSavedRooms] = useState<Listing[]>([]);
  const [loadingSavedRooms, setLoadingSavedRooms] = useState(false);
  const [connectedProfiles, setConnectedProfiles] = useState<MatchedUser[]>([]);
  const [chatCount, setChatCount] = useState(0);
  const [chatRoomMap, setChatRoomMap] = useState<Record<string, string>>({});
  const [myConnections, setMyConnections] = useState<Connection[]>([]);

  const acceptedConnectedUids = useMemo(() => {
    if (!user?.uid) return [];
    return myConnections
      .filter(c => c.status === 'accepted')
      .map(c => c.fromUserId === user.uid ? c.toUserId : c.fromUserId);
  }, [myConnections, user?.uid]);

  const acceptedConnections = useMemo(() => myConnections.filter(c => c.status === 'accepted'), [myConnections]);
  const receivedRequests = useMemo(() => myConnections.filter(c => c.status === 'pending' && c.toUserId === user?.uid), [myConnections, user?.uid]);
  const sentRequests = useMemo(() => myConnections.filter(c => c.status === 'pending' && c.fromUserId === user?.uid), [myConnections, user?.uid]);

  const allConnectionUids = useMemo(() => {
    if (!user?.uid) return [];
    const set = new Set<string>();
    myConnections.forEach(c => {
      if (c.fromUserId === user.uid) set.add(c.toUserId);
      else if (c.toUserId === user.uid) set.add(c.fromUserId);
    });
    return Array.from(set);
  }, [myConnections, user?.uid]);

  const [connectsUsed, setConnectsUsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [compatModal, setCompatModal] = useState<MatchedUser | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether we've already applied the profile's default city once on mount.
  // Without this guard, the effect re-fires every time the user selects "All Cities"
  // (which sets filters.city = ""), immediately overwriting their selection back to
  // the profile city (e.g. Chennai). The flag ensures it only runs on first load.
  const cityInitializedRef = useRef(false);

  // Check URL param ?verify=true (e.g. from in-app notification click) -> redirect to verify portal
  useEffect(() => {
    if (searchParams.get('verify') === 'true') {
      navigate('/edit-profile#verification', { replace: true });
    }
  }, [searchParams, navigate]);

  // Push in-app notification to user inbox (once per user account)
  useEffect(() => {
    if (!user?.uid || !profile || profile.role !== 'seeker' || profile.isVerified) return;

    const notifKey = `nestmate_verify_notif_sent_${user.uid}`;
    if (!localStorage.getItem(notifKey)) {
      localStorage.setItem(notifKey, 'true');
      createNotification({
        userId: user.uid,
        title: '🚀 Boost your profile to the top list',
        description: 'Complete identity verification to rank higher in searches, unlock verified roommates, and receive 3x more replies.',
        type: 'verification',
        actionUrl: '/edit-profile#verification',
        read: false
      }).catch(err => console.warn('Failed to push verification notification', err));
    }
  }, [user?.uid, profile?.role, profile?.isVerified, createNotification]);

  // Report & Block State
  const [reportingUser, setReportingUser] = useState<MatchedUser | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  // Sprint 2E: set when a city-scoped search found nothing and results were
  // widened to other cities — surfaced to the user as an explicit notice.
  const [expandedFromCity, setExpandedFromCity] = useState<string | null>(null);

  const savedProfileIds = useMemo(() => profile?.savedProfileIds || [], [profile?.savedProfileIds]);
  const savedRoomIds = useMemo(() => profile?.savedRoomIds || [], [profile?.savedRoomIds]);

  // Combine local matches, saved profiles, and connected profiles to create a unified pool
  const allAvailableMatches = useMemo(() => [
    ...matches,
    ...savedProfiles.filter(sp => !matches.some(m => m.profile.uid === sp.profile.uid)),
    ...connectedProfiles.filter(cp => !matches.some(m => m.profile.uid === cp.profile.uid))
  ], [matches, savedProfiles, connectedProfiles]);

  const handleBlockUser = async (targetUid: string, name: string) => {
    if (!user?.uid) return;
    if (!window.confirm(`Are you sure you want to block ${name}? You won't see each other again.`)) return;

    try {
      await blockUser(user.uid, targetUid);
      await refreshProfile();
      setMatches(prev => prev.filter(m => m.profile.uid !== targetUid));
      toast.success(`${name} has been blocked.`);
    } catch {
      toast.error('Failed to block user.');
    }
  };

  const handleSubmitReport = async () => {
    if (!user?.uid || !reportingUser || !reportReason) {
      toast.error('Please select a reason for reporting.');
      return;
    }
    setIsSubmittingReport(true);
    try {
      await reportUser({
        reporterId: user.uid,
        targetId: reportingUser.profile.uid || '',
        reason: reportReason,
        description: reportDescription,
      });
      toast.success('Report submitted successfully.');
      setReportingUser(null);
      setReportReason('');
      setReportDescription('');
    } catch {
      toast.error('Failed to submit report.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Auto-set city filter on mount — runs only ONCE per profile load.
  // Using a ref guard prevents this from re-firing when the user explicitly
  // selects "All Cities" (which sets filters.city to ""), which previously
  // caused Chennai to be immediately re-applied, breaking the All Cities filter.
  useEffect(() => {
    if (profile?.city && !cityInitializedRef.current) {
      cityInitializedRef.current = true;
      // Only set the default city if no city is currently selected
      if (!filters.city) {
        updateFilters({ city: profile.city });
      }
    }
  }, [profile?.city]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load matches
  useEffect(() => {
    if (!profile) return;
    setIsLoading(true);
    setExpandedFromCity(null);
    findMatches(profile, filters.city, filters, false, (requestedCity) => setExpandedFromCity(requestedCity))
      .then(matches => {
        // Filter out blocked users
        const blockedIds = new Set(profile.blockedUserIds || []);
        const visible = matches.filter(m => !blockedIds.has(m.profile.uid || ''));
        setMatches(visible);
        // Sprint 2D: discovery event — one per unique filter signature per
        // session window. Zero-result searches are logged too (no-result rate).
        const sig = [filters.city, filters.budgetMin, filters.budgetMax,
        (filters.localities || []).join(','), filters.gender].join('|');
        logEvent(
          { name: 'search_performed', actorId: user?.uid || '', city: filters.city || undefined, resultCount: visible.length },
          { dedupeKey: `search:${sig}`, dedupeWindowMs: 60_000 }
        );
      })
      .catch(() => toast.error('Failed to load matches.'))
      .finally(() => setIsLoading(false));
  }, [profile?.uid, profile?.city, filters, findMatches, profile?.blockedUserIds]);

  // Load More Matches
  const handleLoadMore = useCallback(async () => {
    if (!profile || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const moreMatches = await findMatches(profile, filters.city, filters, true);
      const blockedIds = new Set(profile.blockedUserIds || []);
      setMatches(prev => {
        const existingIds = new Set(prev.map(m => m.profile.uid));
        const filtered = moreMatches.filter(m => !existingIds.has(m.profile.uid) && !blockedIds.has(m.profile.uid || ''));
        return [...prev, ...filtered];
      });
    } catch {
      toast.error('Failed to load more matches.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [profile, filters, hasMore, isLoadingMore, findMatches]);

  // Auto-load on scroll
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (
          window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 800 &&
          !isLoading &&
          !isLoadingMore &&
          hasMore &&
          activeTab === 'all'
        ) {
          handleLoadMore();
        }
      }, 100);
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [isLoading, isLoadingMore, hasMore, activeTab, handleLoadMore]);

  // Load missing saved profiles
  useEffect(() => {
    if (!profile || !savedProfileIds.length) {
      setSavedProfiles([]);
      return;
    }
    // Find IDs that are saved but not currently in matches
    const existingUids = new Set(matches.map(m => m.profile.uid));
    const missingUids = savedProfileIds.filter(id => !existingUids.has(id));

    if (missingUids.length === 0) {
      setSavedProfiles([]);
      return;
    }

    getProfilesByIds(profile, missingUids)
      .then(setSavedProfiles)
      .catch((err) => console.warn('Could not load saved profiles:', err));
  }, [profile, savedProfileIds, matches, getProfilesByIds]);

  // Subscribe to chat rooms to build uid->roomId map
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToChatRooms(user.uid, (rooms) => {
      setChatCount(rooms.length);
      const map: Record<string, string> = {};
      rooms.forEach(r => {
        const other = r.participants.find(p => p !== user.uid);
        if (other) map[other] = r.id;
      });
      setChatRoomMap(map);
    });
    return unsub;
  }, [user?.uid]);

  // Real-time connections subscription — updates button state instantly without page refresh
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToMyConnections(user.uid, setMyConnections);
    getMonthlyConnectCount(user.uid).then(setConnectsUsed).catch(() => { });
    return unsub;
  }, [user?.uid]);

  // Fetch saved rooms dynamically from Firestore
  useEffect(() => {
    if (!savedRoomIds.length) {
      setSavedRooms([]);
      return;
    }
    let isMounted = true;
    setLoadingSavedRooms(true);
    Promise.all(
      savedRoomIds.map(async (id) => {
        try {
          const docSnap = await getDoc(doc(db, 'listings', id));
          if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Listing;
          }
        } catch (e) {
          console.warn('Could not load saved room:', id, e);
        }
        return null;
      })
    )
      .then(rooms => {
        if (isMounted) {
          setSavedRooms(rooms.filter(Boolean) as Listing[]);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingSavedRooms(false);
      });

    return () => {
      isMounted = false;
    };
  }, [savedRoomIds]);

  // Load profiles for all connections (accepted, received, sent) not already in matches pool
  useEffect(() => {
    if (!profile || allConnectionUids.length === 0) {
      setConnectedProfiles([]);
      return;
    }
    const existingUids = new Set(matches.map(m => m.profile.uid));
    const missingSavedUids = new Set((savedProfiles || []).map(sp => sp.profile.uid));
    const missingUids = allConnectionUids.filter(
      id => !existingUids.has(id) && !missingSavedUids.has(id)
    );
    if (missingUids.length === 0) {
      return;
    }
    getProfilesByIds(profile, missingUids)
      .then(newProfiles => {
        setConnectedProfiles(prev => {
          const map = new Map(prev.map(p => [p.profile.uid, p]));
          newProfiles.forEach(p => map.set(p.profile.uid, p));
          return Array.from(map.values());
        });
      })
      .catch((err) => console.warn('Could not load connected profiles:', err));
  }, [profile, allConnectionUids, matches, savedProfiles, getProfilesByIds]);

  // Save / Unsave
  const handleToggleSave = useCallback(async (targetUid: string) => {
    if (!user?.uid || savingId) return;
    setSavingId(targetUid);
    const isSaved = savedProfileIds.includes(targetUid);
    try {
      await toggleSavedProfile(user.uid, targetUid, isSaved);
      await refreshProfile();
      toast.success(isSaved ? 'Removed from saved' : 'Profile saved!');
    } catch {
      toast.error('Could not update saved profiles.');
    } finally {
      setSavingId(null);
    }
  }, [user?.uid, savedProfileIds, savingId, toggleSavedProfile, refreshProfile]);

  // Skip with undo toast
  const handleSkip = useCallback(async (skippedUid: string, skippedName: string) => {
    if (!user?.uid) return;
    // Immediately remove from UI
    setMatches(prev => prev.filter(m => m.profile.uid !== skippedUid));
    let undone = false;
    toast(`Skipped ${skippedName}`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          // Reload matches to restore
          if (profile) findMatches(profile, filters.city, filters, false).then(setMatches);
          toast.success('Undo successful!');
        },
      },
    });
    // Commit to Firestore after 5 seconds unless undone
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(async () => {
      if (!undone) {
        try {
          await addSkippedUser(user.uid, skippedUid);
          await refreshProfile();
        } catch {
          toast.error('Failed to skip user.');
          if (profile) findMatches(profile, filters.city, filters, false).then(setMatches);
        }
      }
    }, 5500);
  }, [user?.uid, profile, filters, addSkippedUser, findMatches, refreshProfile]);

  // Full connection state machine with 4 states
  const getConnectState = useCallback(
    (targetUid: string): 'connect' | 'pending_sent' | 'pending_received' | 'chat' => {
      if (chatRoomMap[targetUid]) return 'chat';
      const conn = myConnections.find(c =>
        (c.fromUserId === user?.uid && c.toUserId === targetUid) ||
        (c.toUserId === user?.uid && c.fromUserId === targetUid)
      );
      if (!conn) return 'connect';
      if (conn.status === 'accepted') return 'chat';
      if (conn.status === 'pending') {
        // I sent the request
        if (conn.fromUserId === user?.uid) return 'pending_sent';
        // They sent me the request — I can accept
        return 'pending_received';
      }
      return 'connect'; // rejected / blocked — allow retry
    },
    [chatRoomMap, myConnections, user?.uid]
  );

  // Handle connect button click — works for all 4 states
  const handleConnect = useCallback(async (targetUid: string, targetName: string) => {
    if (!user?.uid || connectingId) return;

    // Already has a chat room → go to chat
    if (chatRoomMap[targetUid]) {
      navigate(`/chat/${chatRoomMap[targetUid]}`);
      return;
    }

    const conn = myConnections.find(c =>
      (c.fromUserId === user.uid && c.toUserId === targetUid) ||
      (c.toUserId === user.uid && c.fromUserId === targetUid)
    );

    // They sent me a request — Accept it
    if (conn && conn.status === 'pending' && conn.toUserId === user.uid) {
      setConnectingId(targetUid);
      try {
        await acceptRequest(conn.id);
        // Sprint 2D: funnel event (fire-and-forget)
        logEvent({ name: 'interest_accepted', actorId: user.uid, entityId: conn.id, city: profile?.city });
        const roomId = await getOrCreateChatRoom(user.uid, targetUid);
        await createNotification({
          userId: targetUid,
          type: 'connect',
          title: 'Connection Accepted!',
          description: `${profile?.name || 'Someone'} accepted your connect request. Start chatting!`,
          read: false,
          actionUrl: `/chat/${roomId}`,
          connectionId: conn.id,
        });
        navigate(`/chat/${roomId}`);
      } catch {
        toast.error('Failed to accept request.');
      } finally {
        setConnectingId(null);
      }
      return;
    }

    // Already sent a pending request — do nothing (button is disabled)
    if (conn && conn.status === 'pending' && conn.fromUserId === user.uid) return;

    // No connection — send new request
    setConnectingId(targetUid);
    try {
      const connectionId = await sendRequest(user.uid, targetUid);
      // Sprint 2D: funnel event (fire-and-forget)
      logEvent({ name: 'interest_sent', actorId: user.uid, entityId: connectionId, city: profile?.city });
      const targetMatch = allAvailableMatches.find(m => m.profile.uid === targetUid);
      const isTargetOwner = targetMatch?.profile.role === 'owner';
      const actionUrl = isTargetOwner
        ? `/owner-dashboard?request=${connectionId}`
        : `/match/${user.uid}`;

      await createNotification({
        userId: targetUid,
        type: 'connect',
        title: 'New Connection Request!',
        description: `${profile?.name || 'Someone'} wants to connect with you.`,
        read: false,
        actionUrl,
        connectionId,
      });
      toast.success(`Connection request sent to ${targetName}!`);
    } catch (err: any) {
      toast.error('Failed to send connection request.');
    } finally {
      setConnectingId(null);
    }
  }, [user?.uid, connectingId, chatRoomMap, myConnections, allAvailableMatches, sendRequest, acceptRequest, getOrCreateChatRoom, createNotification, profile?.name, profile?.city, logEvent, navigate]);

  // Save / Unsave Room
  const handleToggleSaveRoom = useCallback(async (room: Listing) => {
    if (!user?.uid || !room.id) return;
    const isSaved = savedRoomIds.includes(room.id);
    try {
      await toggleSavedRoom(user.uid, room.id, isSaved);
      await refreshProfile();
      toast.success(isSaved ? 'Room removed from saved' : 'Room saved!');
    } catch {
      toast.error('Could not update saved rooms.');
    }
  }, [user?.uid, savedRoomIds, toggleSavedRoom, refreshProfile]);

  // Accept incoming connection request
  const handleAcceptRequest = useCallback(async (connectionId: string, senderUid: string, senderName: string) => {
    if (!user?.uid) return;
    setConnectingId(senderUid);
    try {
      await acceptRequest(connectionId);
      logEvent({ name: 'interest_accepted', actorId: user.uid, entityId: connectionId, city: profile?.city });
      const roomId = await getOrCreateChatRoom(user.uid, senderUid);
      await createNotification({
        userId: senderUid,
        type: 'connect',
        title: 'Connection Accepted!',
        description: `${profile?.name || 'Someone'} accepted your connection request. Start chatting!`,
        read: false,
        actionUrl: `/chat/${roomId}`,
        connectionId,
      });
      toast.success(`You are now connected with ${senderName}!`);
      navigate(`/chat/${roomId}`);
    } catch {
      toast.error('Failed to accept request.');
    } finally {
      setConnectingId(null);
    }
  }, [user?.uid, profile?.name, profile?.city, acceptRequest, getOrCreateChatRoom, createNotification, logEvent, navigate]);

  // Decline incoming connection request
  const handleDeclineRequest = useCallback(async (connectionId: string, senderName: string) => {
    try {
      await rejectRequest(connectionId);
      toast.success(`Declined request from ${senderName}`);
    } catch {
      toast.error('Failed to decline request.');
    }
  }, [rejectRequest]);

  // Cancel outgoing sent request
  const handleCancelRequest = useCallback(async (connectionId: string, targetName: string) => {
    try {
      await deleteDoc(doc(db, 'connections', connectionId));
      toast.success(`Cancelled request to ${targetName}`);
    } catch {
      toast.error('Failed to cancel request.');
    }
  }, []);

  // Helper to get or synthesize a MatchedUser object for any UID
  const getMatchForUid = useCallback((uid: string): MatchedUser => {
    const found = allAvailableMatches.find(m => m.profile.uid === uid);
    if (found) return found;
    return {
      profile: { uid, name: 'NestMate Member', city: profile?.city || 'India' } as any,
      compatibilityScore: 0,
      matchReasons: []
    };
  }, [allAvailableMatches, profile?.city]);

  // Saved Flatmates list filtered by search query
  const savedFlatmates = useMemo(() => {
    return allAvailableMatches.filter(m => {
      if (!savedProfileIds.includes(m.profile.uid || '')) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inLocalities = (m.profile.localities || []).some((l: string) => l.toLowerCase().includes(q));
        const inProfession = (m.profile.profession || '').toLowerCase().includes(q);
        const inName = (m.profile.name || '').toLowerCase().includes(q);
        const inCity = (m.profile.city || '').toLowerCase().includes(q);
        return inName || inProfession || inCity || inLocalities;
      }
      return true;
    });
  }, [allAvailableMatches, savedProfileIds, searchQuery]);

  // Saved Rooms list filtered by search query
  const filteredSavedRooms = useMemo(() => {
    return savedRooms.filter(room => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inTitle = (room.title || '').toLowerCase().includes(q);
        const inCity = (room.city || '').toLowerCase().includes(q);
        const inLocality = (room.locality || '').toLowerCase().includes(q);
        return inTitle || inCity || inLocality;
      }
      return true;
    });
  }, [savedRooms, searchQuery]);

  // Connected Flatmates list filtered by search query
  const connectedMatches = useMemo(() => {
    return allAvailableMatches.filter(m => {
      if (!acceptedConnectedUids.includes(m.profile.uid || '')) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inLocalities = (m.profile.localities || []).some((l: string) => l.toLowerCase().includes(q));
        const inProfession = (m.profile.profession || '').toLowerCase().includes(q);
        const inName = (m.profile.name || '').toLowerCase().includes(q);
        const inCity = (m.profile.city || '').toLowerCase().includes(q);
        return inName || inProfession || inCity || inLocalities;
      }
      return true;
    });
  }, [allAvailableMatches, acceptedConnectedUids, searchQuery]);

  // Sprint 2D: match-explanation usage (fire-and-forget, deduped per target)
  useEffect(() => {
    if (compatModal && user?.uid) {
      logEvent(
        { name: 'match_explanation_viewed', actorId: user.uid, entityId: compatModal.profile.uid },
        { dedupeKey: `explain:${compatModal.profile.uid}`, dedupeWindowMs: 60_000 }
      );
    }
  }, [compatModal, user?.uid, logEvent]);


  // Client-side filtering + sorting for All Matches tab
  const filteredMatches = useMemo(() => {
    const getEffectiveBudget = (m: MatchedUser) => {
      const listing = (m.profile as any)._listing;
      return listing?.partnerShare || listing?.totalRent || m.profile.budget || 0;
    };

    const getTimestampMs = (m: MatchedUser) => {
      const p = m.profile;
      const ts = (p as any)._listing?.createdAt || p.createdAt || p.lastActiveAt;
      if (!ts) return 0;
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts.getTime === 'function') return ts.getTime();
      if (typeof ts === 'number') return ts;
      if (typeof ts === 'string') return new Date(ts).getTime() || 0;
      return 0;
    };

    return matches
      .filter(m => {
        const p = m.profile;
        const listing = (p as any)._listing;

        // Verified Only filter
        if (filters.verifiedOnly && !p.isVerified) return false;

        // Gender filter
        if (filters.gender && filters.gender !== 'any') {
          const effectiveGender = (p.gender || listing?.genderPreference || '').toLowerCase();
          if (effectiveGender && effectiveGender !== 'any' && effectiveGender !== filters.gender.toLowerCase()) {
            return false;
          }
        }

        // Budget filter
        const effectiveBudget = getEffectiveBudget(m);
        if (effectiveBudget > 0) {
          if (filters.budgetMin > 0 && effectiveBudget < filters.budgetMin) return false;
          if (filters.budgetMax < 100000 && effectiveBudget > filters.budgetMax) return false;
        }

        // Localities filter
        if (filters.localities && filters.localities.length > 0) {
          const userLocs = (p.localities || []).map((l: string) => (l || '').toLowerCase());
          if (p.locality) userLocs.push(p.locality.toLowerCase());
          if (listing?.locality) userLocs.push(listing.locality.toLowerCase());
          const hasMatch = filters.localities.some((l: string) => userLocs.includes(l.toLowerCase()));
          if (!hasMatch) return false;
        }

        // Flat Type filter: apply only when candidate has a listing
        if (filters.flatType && filters.flatType.length > 0) {
          if (listing && listing.flatType && !filters.flatType.includes(listing.flatType)) return false;
        }

        // Furnishing filter: apply only when candidate has a listing
        if (filters.furnishing && filters.furnishing.length > 0) {
          if (listing && listing.furnishing && !filters.furnishing.includes(listing.furnishing)) return false;
        }

        // Amenities filter: apply only when candidate has a listing
        if (filters.amenities && filters.amenities.length > 0) {
          if (listing && listing.amenities) {
            const hasAll = filters.amenities.every((a: string) => listing.amenities.includes(a));
            if (!hasAll) return false;
          }
        }

        // Search Query filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const inLocalities = (p.localities || []).some((l: string) => l.toLowerCase().includes(q));
          const inProfession = (p.profession || '').toLowerCase().includes(q);
          const inName = (p.name || '').toLowerCase().includes(q);
          const inCity = (p.city || '').toLowerCase().includes(q);
          return inName || inProfession || inCity || inLocalities;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortMode === 'newest') {
          return getTimestampMs(b) - getTimestampMs(a);
        }
        if (sortMode === 'budgetAsc') {
          return getEffectiveBudget(a) - getEffectiveBudget(b);
        }
        if (sortMode === 'budgetDesc') {
          return getEffectiveBudget(b) - getEffectiveBudget(a);
        }
        // 'best': Compatibility Score primary, newest as tiebreaker
        if (b.compatibilityScore !== a.compatibilityScore) {
          return b.compatibilityScore - a.compatibilityScore;
        }
        return getTimestampMs(b) - getTimestampMs(a);
      });
  }, [allAvailableMatches, activeTab, savedProfileIds, acceptedConnectedUids, filters, searchQuery, sortMode]);

  // bestMatch: the first match with a real score > 0. If all scores are 0
  // (e.g. no quiz data on either side) we show no featured hero card —
  // calling a 0% match "Best Match Today" is dishonest.
  const bestMatch = useMemo(
    () => activeTab === 'all' ? (filteredMatches.find(m => m.compatibilityScore > 0) ?? null) : null,
    [activeTab, filteredMatches]
  );
  const gridMatches = useMemo(
    () => activeTab === 'all' ? filteredMatches.filter(m => m !== bestMatch) : filteredMatches,
    [activeTab, filteredMatches, bestMatch]
  );

  const compatibilityColor = (score: number) => {
    if (score >= 90) return 'bg-teal';
    return 'bg-fire';
  };

  // Sprint 4A (truth): compatibility modal breakdown.
  // - Lifestyle is always computable from real quiz answers (may be 0).
  // - Budget overlap is computed ONLY from two real budgets; otherwise null
  //   (previously a fabricated 50% placeholder was shown).
  // - Location match requires BOTH cities to be known; otherwise null.
  const getCompatBreakdown = (match: MatchedUser) => {
    // Use the pre-computed score from findMatches (same engine, avoids drift between card and modal).
    const lifestyle = match.compatibilityScore;
    const budgetMatch = budgetOverlapPct(profile?.budget, match.profile.budget);
    const locationMatch =
      profile?.city && match.profile.city
        ? (profile.city.toLowerCase().trim() === match.profile.city.toLowerCase().trim() ? 100 : 0)
        : null;
    return { lifestyle, budgetMatch, locationMatch };
  };

  const getSharedCount = (match: MatchedUser) => {
    if (!profile?.quizAnswers || !match.profile.quizAnswers) return { matched: 0, total: 0 };
    const myKeys = Object.keys(profile.quizAnswers);
    const theirKeys = Object.keys(match.profile.quizAnswers);
    const commonKeys = myKeys.filter(k => theirKeys.includes(k));
    const matched = commonKeys.filter(k => match.profile.quizAnswers![k] === profile.quizAnswers![k]).length;
    return { matched, total: commonKeys.length };
  };

  const getLifestyleTags = (match: MatchedUser) => {
    const tags = [];
    const ans = match.profile.quizAnswers || {};
    const myAns = profile?.quizAnswers || {};

    if (ans.sleep_time) {
      const isMatch = ans.sleep_time === myAns.sleep_time;
      const lbl = ans.sleep_time === 'before_10' ? 'Early Bird' : ans.sleep_time === 'after_12' ? 'Night Owl' : 'Flexible';
      tags.push({ label: lbl, match: isMatch });
    }
    if (ans.food_pref) {
      const isMatch = ans.food_pref === myAns.food_pref;
      const lbl = ans.food_pref === 'veg' ? 'Vegetarian' : ans.food_pref === 'vegan' ? 'Vegan' : 'Non-veg';
      tags.push({ label: lbl, match: isMatch });
    }
    if (ans.work_mode) {
      const isMatch = ans.work_mode === myAns.work_mode;
      const lbl = ans.work_mode === 'wfo' ? 'WFO' : ans.work_mode === 'wfh' ? 'WFH' : 'Hybrid';
      tags.push({ label: lbl, match: isMatch });
    }
    if (ans.guests && tags.length < 3) {
      const isMatch = ans.guests === myAns.guests;
      const lbl = ans.guests === 'rarely' ? 'No Guests' : ans.guests === 'very_often' ? 'Frequent' : 'Occasional';
      tags.push({ label: lbl, match: isMatch });
    }
    return tags.slice(0, 3);
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] overflow-x-hidden pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ─── Desktop Sidebar (hidden on mobile) ─── */}
          <aside className="hidden lg:flex w-[285px] flex-shrink-0 flex-col space-y-5">
            {/* Profile Mini Card */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full border-2 border-[#E5501A] p-0.5 bg-[#FBF9F6] shadow-xs">
                    {(profile?.avatar || user?.photoURL) && !(profile?.avatar || user?.photoURL)?.includes('dicebear') ? (
                      <img
                        src={profile?.avatar || user?.photoURL || undefined}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div aria-hidden="true" className="w-full h-full rounded-full bg-[#FFF2EB] text-[#E5501A] flex items-center justify-center font-bold">
                        {(profile?.name || user?.displayName || '?').trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {profile?.isVerified && (
                    <div className="absolute -top-1 -right-1 bg-emerald-600 text-white p-0.5 rounded-full border border-white">
                      <ShieldCheck className="w-3 h-3" />
                    </div>
                  )}
                  {profile?.isPremium && <Crown className="absolute -bottom-1 -right-1 w-4 h-4 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-serif font-medium text-sm text-[#1A1A2E] truncate">{profile?.name || 'Guest'}</h3>
                    <TrustBadge profile={profile} authProviders={user?.providerData?.map(p => p.providerId)} size="xs" showTooltip />
                  </div>
                  <p className="text-[10px] text-gray-500 truncate font-medium">{profile?.profession || 'Member'}{profile?.city ? ` · ${profile.city}` : ''}</p>
                </div>
              </div>
              {/* Compact completeness bar */}
              <ProfileCompleteness profile={profile} compact className="mb-3" />

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#FBF9F6] border border-gray-100 rounded-2xl p-2">
                  <p className="text-base font-bold text-[#1A1A2E]">{matches.length}</p>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Matches</p>
                </div>
                <div className="bg-[#FBF9F6] border border-gray-100 rounded-2xl p-2">
                  <p className="text-base font-bold text-[#1A1A2E]">{chatCount}</p>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Chats</p>
                </div>
                <div className="bg-[#FBF9F6] border border-gray-100 rounded-2xl p-2">
                  <p className="text-base font-bold text-[#E5501A]">
                    {matches.length > 0 && Math.max(...matches.map(m => m.compatibilityScore)) > 0
                      ? `${Math.max(...matches.map(m => m.compatibilityScore))}%`
                      : '—'}
                  </p>
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Top Match</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/edit-profile')}
                className="mt-3 w-full text-xs font-semibold text-[#1A1A2E] border border-gray-200 rounded-full py-2 hover:bg-gray-50 transition-all cursor-pointer shadow-xs"
              >
                Edit Profile
              </button>
            </div>

            {/* Filters – Desktop Card */}
            <FilterPanel filters={filters} updateFilters={updateFilters} profile={profile} onSaveSearch={saveSearch} matches={allAvailableMatches} />

            {/* Your Preferences */}
            {profile?.quizAnswers && Object.keys(profile.quizAnswers).length > 0 && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif font-medium text-sm text-[#1A1A2E]">Your Preferences</h4>
                  <button onClick={() => navigate('/edit-profile')} className="text-xs text-[#E5501A] font-semibold cursor-pointer">Edit</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.quizAnswers && Object.entries(profile.quizAnswers).slice(0, 5).map(([qId, ansId]: [string, string]) => {
                    const labels: Record<string, string> = { before_10: 'Early Bird', after_12: 'Night Owl', veg: 'Vegetarian', non_veg: 'Non-veg', wfo: 'WFO', wfh: 'WFH' };
                    return (
                      <span key={qId} className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#FBF9F6] text-[#1A1A2E] border border-gray-200">
                        {labels[ansId] || ansId}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Saved Alerts */}
            {profile?.savedSearches && profile.savedSearches.length > 0 && (
              <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-serif font-medium text-sm text-[#1A1A2E] flex items-center gap-2"><Bell className="w-4 h-4 text-[#E5501A]" /> Saved Alerts</h4>
                </div>
                <div className="space-y-2">
                  {profile.savedSearches.map(alert => (
                    <div key={alert.id} className="bg-[#FBF9F6] p-3 rounded-2xl border border-gray-100 flex flex-col gap-2">
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => updateFilters(alert.filters)}
                          className="text-left text-xs font-bold text-[#1A1A2E] hover:text-[#E5501A] transition-colors"
                        >
                          {alert.name}
                        </button>
                        <button
                          onClick={() => {
                            if (user?.uid) deleteSearch(user.uid, alert);
                          }}
                          className="text-gray-400 hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {alert.filters.city && <span className="bg-white px-2 py-0.5 rounded-full text-[9px] font-semibold text-[#1A1A2E] border border-gray-200">{alert.filters.city}</span>}
                        {alert.filters.budgetMax && <span className="bg-white px-2 py-0.5 rounded-full text-[9px] font-semibold text-emerald-700 border border-emerald-200">₹{alert.filters.budgetMax / 1000}k</span>}
                        {alert.filters.flatType?.map((ft: string) => <span key={ft} className="bg-white px-2 py-0.5 rounded-full text-[9px] font-semibold text-gray-600 border border-gray-200">{ft}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unlimited Connects Widget */}
            <div className="bg-[#FFF2EB]/50 rounded-3xl p-4 border border-[#E5501A]/20 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-xs text-[#1A1A2E] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#E5501A]" /> 100% Free Connects
                  </h4>
                  <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Connect directly without any hidden fees</p>
                </div>
                <span className="text-[10px] font-bold text-[#E5501A] bg-white px-2.5 py-0.5 rounded-full border border-[#E5501A]/30 shadow-2xs">
                  FREE
                </span>
              </div>
            </div>

            {/* Promo Card: Switch to Owner */}
            <div className="bg-gradient-to-br from-[#1A1A2E] via-[#24243E] to-[#1A1A2E] text-white rounded-3xl p-5 shadow-xs border border-slate-700/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#E5501A]/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
              <div className="flex items-start gap-3.5 relative">
                <div className="w-10 h-10 bg-[#FFF2EB]/15 rounded-2xl flex items-center justify-center flex-shrink-0 border border-[#E5501A]/30">
                  <Home className="w-5 h-5 text-[#FF7A45]" />
                </div>
                <div>
                  <h4 className="font-serif font-medium text-sm text-white mb-1">Got a room to list?</h4>
                  <p className="text-xs text-slate-300 mb-3.5 leading-relaxed font-normal">Switch to Owner mode and find the perfect roommate today.</p>
                  <button
                    onClick={async () => {
                      if (user?.uid) {
                        try {
                          await updateProfile(user.uid, { role: 'owner' } as any);
                          await refreshProfile();
                          navigate('/owner-dashboard');
                        } catch {
                          navigate('/owner-dashboard');
                        }
                      } else {
                        navigate('/login');
                      }
                    }}
                    className="px-4 py-2 w-full rounded-full bg-[#E5501A] hover:bg-[#D0400B] text-white text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                  >
                    List My Room →
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* ─── Main Content ─── */}
          <div className="flex-1 min-w-0">
            {/* Seeker Trust & Verification Banner */}
            <SeekerTrustBanner
              onVerifyClick={() => navigate('/edit-profile#verification')}
              isVerified={!!profile?.isVerified}
            />

            {/* Page Header */}
            <div className="mb-4">
              <h1 className="font-serif font-medium text-2xl sm:text-3xl text-[#1A1A2E]">
                {activeTab === 'all'
                  ? 'Find your next roommate'
                  : activeTab === 'saved'
                    ? 'Saved'
                    : 'My Connections'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
                {activeTab === 'all' ? (
                  isLoading
                    ? 'Loading matches…'
                    : `${filteredMatches.length} ${filteredMatches.length === 1 ? 'person' : 'people'} ${filters.city ? `in ${filters.city}` : 'across all cities'}`
                ) : activeTab === 'saved' ? (
                  `${savedSubTab === 'flatmates' ? savedFlatmates.length : filteredSavedRooms.length} saved ${savedSubTab === 'flatmates' ? (savedFlatmates.length === 1 ? 'roommate' : 'roommates') : (filteredSavedRooms.length === 1 ? 'room' : 'rooms')}`
                ) : (
                  `${connectionSubTab === 'connected' ? connectedMatches.length : connectionSubTab === 'received' ? receivedRequests.length : sentRequests.length} ${connectionSubTab === 'connected' ? 'connected roommates' : connectionSubTab === 'received' ? 'requests received' : 'requests sent'}`
                )}
              </p>
            </div>

            {/* Tabs Bar */}
            <div className="flex border-b border-gray-200/80 mb-5 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setActiveTab('all')}
                className={`py-3 px-5 sm:px-6 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap border-b-2 -mb-px cursor-pointer ${activeTab === 'all' ? 'text-[#E5501A] border-[#E5501A]' : 'text-gray-500 hover:text-[#1A1A2E] border-transparent'}`}
              >
                All Matches
              </button>
              <button
                onClick={() => setActiveTab('saved')}
                className={`py-3 px-5 sm:px-6 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px cursor-pointer ${activeTab === 'saved' ? 'text-[#E5501A] border-[#E5501A]' : 'text-gray-500 hover:text-[#1A1A2E] border-transparent'}`}
              >
                Saved
                {(savedProfileIds.length + savedRoomIds.length) > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'saved' ? 'bg-[#E5501A] text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {savedProfileIds.length + savedRoomIds.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('connections')}
                className={`py-3 px-5 sm:px-6 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px cursor-pointer ${activeTab === 'connections' ? 'text-[#E5501A] border-[#E5501A]' : 'text-gray-500 hover:text-[#1A1A2E] border-transparent'}`}
              >
                My Connections
                {(acceptedConnectedUids.length + receivedRequests.length) > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'connections' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {acceptedConnectedUids.length + receivedRequests.length}
                  </span>
                )}
              </button>
            </div>

            {/* Top Bar (Filters/Search/Sort) */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-2.5 sm:p-3 mb-5 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full flex items-center gap-2">
                {/* Mobile Filters Trigger (Vaul Drawer) */}
                <div className="lg:hidden">
                  <Drawer.Root open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                    <Drawer.Trigger asChild>
                      <button className="flex items-center gap-2 px-3.5 py-2 bg-[#FBF9F6] border border-gray-200 rounded-full text-xs font-semibold text-[#1A1A2E] hover:border-[#E5501A] transition-colors cursor-pointer">
                        <Filter className="w-3.5 h-3.5 text-[#E5501A]" />
                        <span>Filters</span>
                      </button>
                    </Drawer.Trigger>
                    <Drawer.Portal>
                      <Drawer.Overlay className="fixed inset-0 bg-black/40 z-[100] backdrop-blur-sm" />
                      <Drawer.Content className="bg-[#FBF9F6] flex flex-col rounded-t-[28px] max-h-[85vh] mt-24 fixed bottom-0 left-0 right-0 z-[100] shadow-2xl">
                        <div className="p-5 bg-white rounded-t-[28px] flex-1 overflow-y-auto">
                          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-200 mb-5" />
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="font-serif font-medium text-lg text-[#1A1A2E]">Filters</h2>
                            <button onClick={() => setMobileFiltersOpen(false)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 cursor-pointer">
                              <X className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                          <FilterPanel filters={filters} updateFilters={updateFilters} profile={profile} onSaveSearch={saveSearch} matches={allAvailableMatches} />
                          <div className="mt-6">
                            <button onClick={() => setMobileFiltersOpen(false)} className="w-full py-3.5 bg-[#E5501A] hover:bg-[#D0400B] text-white rounded-full font-semibold text-sm shadow-xs cursor-pointer">Apply Filters</button>
                          </div>
                        </div>
                      </Drawer.Content>
                    </Drawer.Portal>
                  </Drawer.Root>
                </div>

                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by name, profession, locality..."
                    className="w-full pl-9 pr-9 py-2 bg-[#FBF9F6] rounded-full text-xs sm:text-sm border border-gray-200 outline-none focus:border-[#E5501A] font-medium text-[#1A1A2E]"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              <select
                value={sortMode}
                onChange={e => setSortMode(e.target.value as any)}
                className="bg-[#FBF9F6] border border-gray-200 rounded-full px-3.5 py-2 text-xs font-semibold text-[#1A1A2E] outline-none focus:border-[#E5501A] flex-shrink-0 cursor-pointer"
              >
                <option value="best">Best Match</option>
                <option value="newest">Newest First</option>
                <option value="budgetAsc">Budget: Low → High</option>
                <option value="budgetDesc">Budget: High → Low</option>
              </select>
              <div className="hidden sm:flex bg-[#FBF9F6] rounded-full p-0.5 border border-gray-200 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`p-2 rounded-full transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white shadow-xs text-[#E5501A]' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`p-2 rounded-full transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white shadow-xs text-[#E5501A]' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Sub-Tabs for Saved */}
            {activeTab === 'saved' && (
              <div className="flex items-center gap-2 mb-5">
                <button
                  type="button"
                  onClick={() => setSavedSubTab('flatmates')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    savedSubTab === 'flatmates'
                      ? 'bg-[#1A1A2E] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Saved Roommates ({savedFlatmates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSavedSubTab('rooms')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    savedSubTab === 'rooms'
                      ? 'bg-[#1A1A2E] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Saved Rooms ({filteredSavedRooms.length})
                </button>
              </div>
            )}

            {/* Sub-Tabs for My Connections */}
            {activeTab === 'connections' && (
              <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-hide">
                <button
                  type="button"
                  onClick={() => setConnectionSubTab('connected')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    connectionSubTab === 'connected'
                      ? 'bg-[#1A1A2E] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Connected ({connectedMatches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionSubTab('received')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    connectionSubTab === 'received'
                      ? 'bg-[#1A1A2E] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  Requests Received ({receivedRequests.length})
                </button>
                <button
                  type="button"
                  onClick={() => setConnectionSubTab('sent')}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                    connectionSubTab === 'sent'
                      ? 'bg-[#1A1A2E] text-white shadow-xs'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Requests Sent ({sentRequests.length})
                </button>
              </div>
            )}

            {/* Skeleton Loading State */}
            {isLoading && <StateSkeletonGrid count={6} />}

            {/* ── All Matches Feed ── */}
            {!isLoading && activeTab === 'all' && (
              <>
                {filteredMatches.length > 0 ? (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5' : 'space-y-3'}>
                    {filteredMatches.map(match => (
                      <DashboardSeekerCard
                        key={match.profile.uid}
                        match={match}
                        isSaved={savedProfileIds.includes(match.profile.uid || '')}
                        onToggleSave={handleToggleSave}
                        saving={savingId === match.profile.uid}
                        onCall={p => setContactModalProfile(p)}
                        onChat={(uid, name) => handleConnect(uid, name)}
                        cState={getConnectState(match.profile.uid || '')}
                        connecting={connectingId === match.profile.uid}
                        onSkip={handleSkip}
                        onReport={setReportingUser}
                        onBlock={handleBlockUser}
                        onOpenCompatModal={setCompatModal}
                        viewMode={viewMode}
                      />
                    ))}
                  </div>
                ) : (
                  <StateEmpty
                    icon={Search}
                    title={filters.city ? `No matches in ${filters.city} found` : 'No matches found'}
                    description="Try adjusting your filters or expanding your search"
                    action={
                      <button onClick={() => updateFilters({ city: '', budgetMin: 1000, budgetMax: 25000, localities: [], gender: 'any', verifiedOnly: false })} className="rounded-full bg-white border border-gray-200 text-xs sm:text-sm font-semibold px-6 py-2.5 shadow-xs hover:bg-gray-50 cursor-pointer">
                        Reset Filters
                      </button>
                    }
                  />
                )}

                {/* Explicit cross-city expansion notice */}
                {expandedFromCity && filteredMatches.length > 0 && (
                  <div className="mt-4 px-1">
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 font-medium">
                      No matches in <span className="font-bold">{expandedFromCity}</span> yet — showing relevant people from other cities.
                    </p>
                  </div>
                )}

                {/* Infinite Scroll Load More */}
                <div className="mt-8 mb-4 text-center">
                  {isLoadingMore ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-left">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={`skel-${i}`} className="bg-white rounded-3xl overflow-hidden shadow-xs border border-gray-100 p-4 space-y-3">
                          <div className="h-[140px] rounded-2xl bg-gray-100 animate-pulse" />
                          <div className="h-4 w-3/4 bg-gray-100 rounded-full animate-pulse" />
                          <div className="h-3 w-1/2 bg-gray-100 rounded-full animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : hasMore ? (
                    <button onClick={handleLoadMore} className="rounded-full bg-white border border-gray-200 text-[#1A1A2E] hover:bg-gray-50 text-xs sm:text-sm font-semibold px-6 py-2.5 shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer">Show More Matches <ChevronDown className="w-4 h-4" /></button>
                  ) : matches.length > 0 ? (
                    <p className="text-gray-400 text-xs font-semibold">You've reached the end of your matches</p>
                  ) : null}
                </div>
              </>
            )}

            {/* ── Saved Tab ── */}
            {!isLoading && activeTab === 'saved' && (
              <>
                {savedSubTab === 'flatmates' && (
                  savedFlatmates.length > 0 ? (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5' : 'space-y-3'}>
                      {savedFlatmates.map(match => (
                        <DashboardSeekerCard
                          key={match.profile.uid}
                          match={match}
                          isSaved={true}
                          onToggleSave={handleToggleSave}
                          saving={savingId === match.profile.uid}
                          onCall={p => setContactModalProfile(p)}
                          onChat={(uid, name) => handleConnect(uid, name)}
                          cState={getConnectState(match.profile.uid || '')}
                          connecting={connectingId === match.profile.uid}
                          onReport={setReportingUser}
                          onBlock={handleBlockUser}
                          onOpenCompatModal={setCompatModal}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-8">
                      <StateEmpty
                        icon={Bookmark}
                        title="No saved roommates yet"
                        description="Heart roommate profiles while browsing to easily revisit and connect with them here."
                        action={
                          <button onClick={() => setActiveTab('all')} className="rounded-full bg-[#E5501A] hover:bg-[#D0400B] text-white text-xs sm:text-sm font-semibold px-6 py-2.5 shadow-xs cursor-pointer">
                            Browse Roommates
                          </button>
                        }
                      />
                    </div>
                  )
                )}

                {savedSubTab === 'rooms' && (
                  loadingSavedRooms ? (
                    <StateSkeletonGrid count={3} />
                  ) : filteredSavedRooms.length > 0 ? (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5' : 'space-y-3'}>
                      {filteredSavedRooms.map(room => (
                        <CompactRoomCard
                          key={room.id}
                          room={room}
                          isSaved={true}
                          compatibilityScore={profile ? calculateRoomCompatibility(profile, room) : undefined}
                          onToggleSave={handleToggleSaveRoom}
                          onCall={r => setContactModalProfile({ name: r.title || 'Property Owner', phone: (r as any).contactPhone || '', isOwner: true } as any)}
                          onChat={() => navigate('/chat')}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-8">
                      <StateEmpty
                        icon={Home}
                        title="No saved rooms yet"
                        description="Save rooms across the platform to easily compare and revisit them here."
                        action={
                          <button onClick={() => navigate('/explore?tab=rooms')} className="rounded-full bg-[#E5501A] hover:bg-[#D0400B] text-white text-xs sm:text-sm font-semibold px-6 py-2.5 shadow-xs cursor-pointer">
                            Explore Rooms
                          </button>
                        }
                      />
                    </div>
                  )
                )}
              </>
            )}

            {/* ── My Connections Tab ── */}
            {!isLoading && activeTab === 'connections' && (
              <>
                {connectionSubTab === 'connected' && (
                  connectedMatches.length > 0 ? (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5' : 'space-y-3'}>
                      {connectedMatches.map(match => (
                        <DashboardSeekerCard
                          key={match.profile.uid}
                          match={match}
                          isSaved={savedProfileIds.includes(match.profile.uid || '')}
                          onToggleSave={handleToggleSave}
                          saving={savingId === match.profile.uid}
                          onCall={p => setContactModalProfile(p)}
                          onChat={(uid, name) => handleConnect(uid, name)}
                          cState="chat"
                          connecting={connectingId === match.profile.uid}
                          onReport={setReportingUser}
                          onBlock={handleBlockUser}
                          onOpenCompatModal={setCompatModal}
                          viewMode={viewMode}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-8">
                      <StateEmpty
                        icon={Users}
                        title="No active connections yet"
                        description="Once you and another roommate connect, their contact details and direct chat will appear here."
                        action={
                          <button onClick={() => setActiveTab('all')} className="rounded-full bg-[#E5501A] hover:bg-[#D0400B] text-white text-xs sm:text-sm font-semibold px-6 py-2.5 shadow-xs cursor-pointer">
                            Find Roommates
                          </button>
                        }
                      />
                    </div>
                  )
                )}

                {connectionSubTab === 'received' && (
                  receivedRequests.length > 0 ? (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5' : 'space-y-3'}>
                      {receivedRequests.map(conn => {
                        const match = getMatchForUid(conn.fromUserId);
                        return (
                          <DashboardSeekerCard
                            key={conn.id}
                            match={match}
                            isReceivedRequest={true}
                            onAcceptRequest={() => handleAcceptRequest(conn.id, conn.fromUserId, match.profile.name || 'Roommate')}
                            onDeclineRequest={() => handleDeclineRequest(conn.id, match.profile.name || 'Roommate')}
                            connecting={connectingId === conn.fromUserId}
                            onCall={p => setContactModalProfile(p)}
                            onReport={setReportingUser}
                            onBlock={handleBlockUser}
                            viewMode={viewMode}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-8">
                      <StateEmpty
                        icon={Bell}
                        title="No pending requests received"
                        description="When other roommates send you a connection request, they will show up here for you to accept or decline."
                      />
                    </div>
                  )
                )}

                {connectionSubTab === 'sent' && (
                  sentRequests.length > 0 ? (
                    <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5' : 'space-y-3'}>
                      {sentRequests.map(conn => {
                        const match = getMatchForUid(conn.toUserId);
                        return (
                          <DashboardSeekerCard
                            key={conn.id}
                            match={match}
                            isSentRequest={true}
                            onCancelRequest={() => handleCancelRequest(conn.id, match.profile.name || 'Roommate')}
                            onCall={p => setContactModalProfile(p)}
                            onReport={setReportingUser}
                            onBlock={handleBlockUser}
                            viewMode={viewMode}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-8">
                      <StateEmpty
                        icon={Send}
                        title="No pending requests sent"
                        description="You haven't sent any connection requests yet. Send requests to connect with roommates."
                        action={
                          <button onClick={() => setActiveTab('all')} className="rounded-full bg-[#E5501A] hover:bg-[#D0400B] text-white text-xs sm:text-sm font-semibold px-6 py-2.5 shadow-xs cursor-pointer">
                            Browse Roommates
                          </button>
                        }
                      />
                    </div>
                  )
                )}
              </>
            )}

            {/* Map preview removed as the map feature was decommissioned */}
          </div>
        </div>
      </div>

      {/* Compatibility Modal */}
      {compatModal && (() => {
        const bd = getCompatBreakdown(compatModal);
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setCompatModal(null)}>
            <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
            <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <button onClick={() => setCompatModal(null)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-ink/5 text-ink/40">
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-5">
                {compatModal.profile.avatar && !compatModal.profile.avatar.includes('dicebear') ? (
                  <img src={compatModal.profile.avatar} alt="" loading="lazy" className="w-12 h-12 rounded-full" />
                ) : (
                  <div aria-hidden="true" className="w-12 h-12 rounded-full bg-fire/10 text-fire flex items-center justify-center font-bold">
                    {(compatModal.profile.name || '?').trim().charAt(0).toUpperCase()}
                  </div>
                )}

                <div>
                  <h3 className="font-semibold">{compatModal.profile.name}</h3>
                  <span className={`${compatibilityColor(compatModal.compatibilityScore)} text-white text-xs font-semibold px-3 py-1 rounded-full shadow-xs`}>
                    {compatModal.compatibilityScore}% Compatible
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                {/* Truthful "why" reasons — data-backed claims */}
                {(() => {
                  const listing = (compatModal.profile as any)._listing;
                  const isRoom = Boolean(listing || compatModal.listingId);
                  const why = isRoom
                    ? getRoomMatchReasons(profile || {}, listing || { city: compatModal.profile.city }, compatModal.profile)
                    : getMatchReasons(
                      profile?.quizAnswers || {},
                      compatModal.profile.quizAnswers || {},
                      {
                        myCity: profile?.city,
                        theirCity: compatModal.profile.city,
                        myBudget: profile?.budget || 0,
                        theirBudget: compatModal.profile.budget || 0,
                      }
                    );
                  return (
                    <>
                      {why.reasons.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 space-y-1.5">
                          {why.reasons.map(r => (
                            <p key={r} className="text-xs text-emerald-800 font-medium flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />{r}
                            </p>
                          ))}
                        </div>
                      )}
                      {why.caveats.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {why.caveats.map(c => (
                            <span key={c} className="text-[11px] text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">{c}</span>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
                {/* Sprint 4A (truth): rows are rendered ONLY when real data exists.
                    Missing budget/city data renders an explicit neutral note —
                    never a fabricated percentage. */}
                {[
                  { label: 'Lifestyle Match', value: bd.lifestyle },
                  ...(bd.budgetMatch !== null ? [{ label: 'Budget Overlap', value: bd.budgetMatch }] : []),
                  ...(bd.locationMatch !== null ? [{ label: 'Location Match', value: bd.locationMatch }] : []),
                ].map(item => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 font-medium">{item.label}</span>
                      <span className="font-bold text-[#1A1A2E]">{item.value}%</span>
                    </div>
                    <div className="h-2 bg-[#F7F3ED] rounded-full overflow-hidden">
                      <div className="h-full bg-[#E5501A] rounded-full transition-all duration-700" style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
                {(bd.budgetMatch === null || bd.locationMatch === null) && (
                  <p className="text-[11px] text-gray-400 italic">
                    Budget or location details aren't available for this comparison yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {/* Report User Modal */}
      <Dialog open={!!reportingUser} onOpenChange={(open) => !open && setReportingUser(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-6 bg-white border border-gray-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl font-medium text-[#1A1A2E]">Report User</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Help us understand what's happening with {reportingUser?.profile.name}. Your report is anonymous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Reason for reporting</label>
              <Select value={reportReason} onValueChange={setReportReason}>
                <SelectTrigger className="w-full rounded-2xl border-gray-200 bg-[#FBF9F6]">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-gray-100 bg-white">
                  <SelectItem value="spam">Spam or Scammer</SelectItem>
                  <SelectItem value="harassment">Harassment or Abuse</SelectItem>
                  <SelectItem value="inappropriate">Inappropriate Content</SelectItem>
                  <SelectItem value="fake">Fake Profile</SelectItem>
                  <SelectItem value="other">Other Reason</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Additional details (optional)</label>
              <Textarea
                placeholder="Please describe the issue..."
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                className="min-h-[100px] resize-none rounded-2xl border-gray-200 bg-[#FBF9F6] p-3 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-full text-xs font-semibold border-gray-200" onClick={() => setReportingUser(null)} disabled={isSubmittingReport}>
              Cancel
            </Button>
            <Button
              className="bg-[#E5501A] hover:bg-[#D0400B] text-white rounded-full text-xs font-semibold shadow-sm"
              onClick={handleSubmitReport}
              disabled={isSubmittingReport || !reportReason}
            >
              {isSubmittingReport ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Flag className="w-4 h-4 mr-2" />}
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call / Contact Modal */}
      <ContactModal
        isOpen={Boolean(contactModalProfile)}
        onClose={() => setContactModalProfile(null)}
        profile={contactModalProfile}
      />
    </div>
  );
}

// ─── FilterPanel Component (Desktop & Mobile Content) ───
function FilterPanel({
  filters,
  updateFilters,
  profile,
  onSaveSearch,
  matches = []
}: {
  filters: any;
  updateFilters: any;
  profile: any;
  onSaveSearch: any;
  matches?: MatchedUser[];
}) {
  const safeMin = typeof filters.budgetMin === 'number' && !isNaN(filters.budgetMin) ? filters.budgetMin : 0;
  const safeMax = typeof filters.budgetMax === 'number' && !isNaN(filters.budgetMax) ? filters.budgetMax : 100000;

  const [localBudget, setLocalBudget] = useState([safeMin, safeMax]);
  const [isSavingAlert, setIsSavingAlert] = useState(false);

  // Sync local budget state when global filters change (e.g. Reset)
  useEffect(() => {
    setLocalBudget([safeMin, safeMax]);
  }, [safeMin, safeMax]);

  // Extract dynamic cities and localities from actual match profiles
  const dynamicCities = useMemo(() => {
    const set = new Set<string>(cities);
    matches.forEach(m => {
      if (m.profile.city) set.add(m.profile.city);
    });
    return Array.from(set).sort();
  }, [matches]);

  const dynamicLocalities = useMemo(() => {
    const set = new Set<string>();
    const staticLocs = filters.city ? localitiesByCity[filters.city] || [] : Object.values(localitiesByCity).flat();
    staticLocs.forEach(l => set.add(l));

    matches.forEach(m => {
      if (!filters.city || m.profile.city?.toLowerCase() === filters.city.toLowerCase()) {
        (m.profile.localities || []).forEach(l => set.add(l));
        const listingLoc = (m.profile as any)._listing?.locality;
        if (listingLoc) set.add(listingLoc);
      }
    });

    return Array.from(set).filter(l => !filters.localities?.includes(l)).sort();
  }, [matches, filters.city, filters.localities]);

  const handleSaveAlert = async () => {
    if (!profile?.uid) return;
    setIsSavingAlert(true);
    try {
      const name = `${filters.city || 'Anywhere'} under ₹${(filters.budgetMax / 1000).toFixed(0)}k`;
      await onSaveSearch(profile.uid, {
        id: Date.now().toString(),
        name,
        filters,
        createdAt: new Date().toISOString()
      });
      toast.success('Search alert saved!');
    } catch {
      toast.error('Failed to save alert');
    } finally {
      setIsSavingAlert(false);
    }
  };

  const handleReset = () => {
    updateFilters({
      city: '',
      budgetMin: 0,
      budgetMax: 100000,
      localities: [],
      gender: 'any',
      verifiedOnly: false,
      flatType: [],
      furnishing: [],
      amenities: []
    });
    setLocalBudget([0, 100000]);
  };

  const toggleArrayFilter = (field: 'flatType' | 'furnishing' | 'amenities', value: string) => {
    const current = filters[field] || [];
    const next = current.includes(value)
      ? current.filter((x: string) => x !== value)
      : [...current, value];
    updateFilters({ [field]: next });
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-serif text-base font-medium text-[#1A1A2E]">Filters</h4>
          <p className="text-[11px] text-gray-400">Refine match criteria</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSaveAlert}
            disabled={isSavingAlert}
            className="text-xs text-[#E5501A] font-semibold hover:underline flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FFF2EB]"
          >
            {isSavingAlert ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
            Save
          </button>
          <button onClick={handleReset} className="text-xs text-gray-500 font-semibold hover:text-gray-700 px-2.5 py-1 rounded-full bg-gray-100">
            Reset
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* City Filter */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block font-medium">City</label>
          <select
            value={filters.city}
            onChange={e => updateFilters({ city: e.target.value })}
            className="w-full text-xs font-medium bg-[#FBF9F6] border border-gray-200 rounded-2xl px-3.5 py-2.5 outline-none focus:border-[#E5501A] text-[#1A1A2E]"
          >
            <option value="">All Cities</option>
            {dynamicCities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Budget Range Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 font-medium">Monthly Budget</label>
            <span className="text-xs font-bold text-[#1A1A2E]">
              ₹{localBudget[0].toLocaleString()} - {localBudget[1] >= 100000 ? '₹1,00,000+' : `₹${localBudget[1].toLocaleString()}`}
            </span>
          </div>
          <div className="relative h-2 w-full bg-gray-100 rounded-full mt-2">
            <div
              className="absolute h-full bg-[#E5501A] rounded-full"
              style={{
                left: `${(localBudget[0] / 100000) * 100}%`,
                right: `${100 - (localBudget[1] / 100000) * 100}%`
              }}
            />
            <input
              type="range"
              min={0}
              max={100000}
              step={1000}
              value={localBudget[0]}
              onChange={e => {
                const val = Math.min(parseInt(e.target.value, 10), localBudget[1] - 1000);
                setLocalBudget([val, localBudget[1]]);
              }}
              onMouseUp={() => updateFilters({ budgetMin: localBudget[0] })}
              onTouchEnd={() => updateFilters({ budgetMin: localBudget[0] })}
              className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#E5501A] [&::-webkit-slider-thumb]:shadow-md cursor-pointer"
              style={{ zIndex: localBudget[0] > 50000 ? 5 : 3 }}
            />
            <input
              type="range"
              min={0}
              max={100000}
              step={1000}
              value={localBudget[1]}
              onChange={e => {
                const val = Math.max(parseInt(e.target.value, 10), localBudget[0] + 1000);
                setLocalBudget([localBudget[0], val]);
              }}
              onMouseUp={() => updateFilters({ budgetMax: localBudget[1] })}
              onTouchEnd={() => updateFilters({ budgetMax: localBudget[1] })}
              className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#E5501A] [&::-webkit-slider-thumb]:shadow-md cursor-pointer"
              style={{ zIndex: 4 }}
            />
          </div>
        </div>

        {/* Localities Filter */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block font-medium">Localities</label>
          <select
            value=""
            onChange={e => {
              if (e.target.value) {
                updateFilters({ localities: [...(filters.localities || []), e.target.value] });
              }
            }}
            className="w-full text-xs bg-[#FBF9F6] border border-gray-200 rounded-2xl px-3.5 py-2.5 outline-none focus:border-[#E5501A] text-[#1A1A2E]"
          >
            <option value="">Add locality...</option>
            {dynamicLocalities.map(l => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          {filters.localities && filters.localities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {filters.localities.map((l: string) => (
                <span key={l} className="bg-[#FFF2EB] text-[#E5501A] border border-[#E5501A]/20 text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  {l}
                  <button
                    type="button"
                    onClick={() => updateFilters({ localities: filters.localities.filter((x: string) => x !== l) })}
                    className="hover:text-red-600 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Gender Filter */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block font-medium">Gender Preference</label>
          <div className="flex gap-1.5 p-1 bg-[#F7F3ED] rounded-2xl">
            {['any', 'female', 'male'].map(g => (
              <button
                key={g}
                type="button"
                onClick={() => updateFilters({ gender: g })}
                className={`flex-1 py-1.5 rounded-xl text-xs capitalize transition-all font-semibold ${filters.gender === g ? 'bg-white text-[#1A1A2E] shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Verified Only Toggle */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 cursor-pointer">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Verified Only
          </label>
          <button
            type="button"
            onClick={() => updateFilters({ verifiedOnly: !filters.verifiedOnly })}
            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${filters.verifiedOnly ? 'bg-emerald-600' : 'bg-gray-200'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${filters.verifiedOnly ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Flat Type Filter */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block font-medium">Flat Type</label>
          <div className="flex flex-wrap gap-1.5">
            {flatTypes.map(ft => {
              const selected = (filters.flatType || []).includes(ft);
              return (
                <button
                  key={ft}
                  type="button"
                  onClick={() => toggleArrayFilter('flatType', ft)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${selected ? 'bg-[#E5501A] text-white border-[#E5501A] shadow-xs' : 'bg-[#FBF9F6] border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {ft}
                </button>
              );
            })}
          </div>
        </div>

        {/* Furnishing Filter */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block font-medium">Furnishing</label>
          <div className="flex flex-wrap gap-1.5">
            {furnishingTypes.map(fn => {
              const selected = (filters.furnishing || []).includes(fn);
              return (
                <button
                  key={fn}
                  type="button"
                  onClick={() => toggleArrayFilter('furnishing', fn)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${selected ? 'bg-[#E5501A] text-white border-[#E5501A] shadow-xs' : 'bg-[#FBF9F6] border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {fn}
                </button>
              );
            })}
          </div>
        </div>

        {/* Amenities Filter */}
        <div>
          <label className="text-xs text-gray-500 mb-1.5 block font-medium">Amenities</label>
          <div className="flex flex-wrap gap-1.5">
            {amenitiesList.map(amt => {
              const selected = (filters.amenities || []).includes(amt);
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => toggleArrayFilter('amenities', amt)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${selected ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-[#FBF9F6] border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {amt}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
