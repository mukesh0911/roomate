import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/useStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useConnections, getRelationshipState } from '@/hooks/useConnections';
import { useChat } from '@/hooks/useChat';
import { useMatches, calculateCompatibility, calculateRoomCompatibility } from '@/hooks/useMatches';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Connection } from '@/hooks/useConnections';
import type { MatchedUser } from '@/hooks/useMatches';
import type { Listing } from '@/hooks/useListings';
import type { UserProfile } from '@/hooks/useAuth';
import {
  MapPin, SlidersHorizontal, Compass, Bed, Users, Building2,
  ChevronRight, ChevronDown, Check, X, Search, Heart, UserCheck,
  ArrowUpDown, LayoutGrid, List, Sparkles, ShieldAlert, Loader2,
  FileText
} from 'lucide-react';
import BrowseRooms from './BrowseRooms';
import BrowseSeekers from './BrowseSeekers';
import AdvancedFiltersModal, { DEFAULT_ADVANCED_FILTERS } from '@/components/AdvancedFiltersModal';
import type { AdvancedFilterState } from '@/components/AdvancedFiltersModal';
import CreateTeamModal from '@/components/CreateTeamModal';
import CompactRoomCard from '@/components/CompactRoomCard';
import DashboardSeekerCard from '@/components/DashboardSeekerCard';
import StateEmpty from '@/components/StateEmpty';
import { cities } from '@/lib/staticData';
import { toast } from 'sonner';

export type CategoryTab = 'rooms' | 'roommates' | 'pg' | 'saved' | 'connections' | 'all';
type SortOption = 'match' | 'newest' | 'price_asc' | 'price_desc';

export default function ExplorePage() {
  const navigate = useNavigate();
  const { profile: currentUser, user, refreshProfile } = useAuth();
  const { filters, updateFilters, openAuthModal } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    toggleSavedRoom, toggleSavedProfile, saveSearch, deleteSearch,
    updateProfile, blockUser, reportUser
  } = useUserProfile();
  const {
    subscribeToMyConnections, acceptRequest, rejectRequest
  } = useConnections();
  const { subscribeToChatRooms, getOrCreateChatRoom } = useChat();
  const { findMatches, getProfilesByIds } = useMatches();

  const urlCity = searchParams.get('city');
  const urlQuery = searchParams.get('query') || '';

  const defaultCity = urlCity || currentUser?.city || filters.city || 'Bengaluru';
  const [selectedCity, setSelectedCity] = useState(defaultCity);

  useEffect(() => {
    if (urlCity && urlCity !== selectedCity) {
      setSelectedCity(urlCity);
      updateFilters({ city: urlCity });
      setAdvFilters(prev => ({ ...prev, city: urlCity }));
    } else if (currentUser?.city && !filters.city && !urlCity) {
      setSelectedCity(currentUser.city);
    }
  }, [urlCity, currentUser?.city, filters.city, selectedCity, updateFilters]);

  const [isCityOpen, setIsCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [advFilters, setAdvFilters] = useState<AdvancedFilterState>(DEFAULT_ADVANCED_FILTERS);

  // Sync searchQuery when URL query param changes
  useEffect(() => {
    const qParam = searchParams.get('query');
    if (qParam !== null && qParam !== searchQuery) {
      setSearchQuery(qParam);
    }
  }, [searchParams, searchQuery]);

  const [sortBy, setSortBy] = useState<SortOption>('match');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [savedSubTab, setSavedSubTab] = useState<'rooms' | 'flatmates'>('rooms');
  const [connectionSubTab, setConnectionSubTab] = useState<'connected' | 'received' | 'sent'>('connected');

  // Dynamic state for Saved & Connections
  const [savedRooms, setSavedRooms] = useState<Listing[]>([]);
  const [loadingSavedRooms, setLoadingSavedRooms] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<MatchedUser[]>([]);
  const [loadingSavedProfiles, setLoadingSavedProfiles] = useState(false);
  const [myConnections, setMyConnections] = useState<Connection[]>([]);
  const [connectedProfiles, setConnectedProfiles] = useState<MatchedUser[]>([]);
  const [chatCount, setChatCount] = useState(0);
  const [chatRoomMap, setChatRoomMap] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<MatchedUser[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const savedRoomIds: string[] = useMemo(() => currentUser?.savedRoomIds || [], [currentUser?.savedRoomIds]);
  const savedProfileIds: string[] = useMemo(() => currentUser?.savedProfileIds || [], [currentUser?.savedProfileIds]);

  // Tab management: 'rooms' | 'roommates' | 'pg' | 'saved' | 'connections' | 'all'
  const rawTab = searchParams.get('tab');
  const activeTab: CategoryTab =
    rawTab === 'rooms' ? 'rooms'
    : rawTab === 'roommates' ? 'roommates'
    : rawTab === 'pg' ? 'pg'
    : rawTab === 'saved' ? 'saved'
    : rawTab === 'connections' ? 'connections'
    : rawTab === 'all' ? 'all'
    : 'rooms';

  const handleTabChange = (tab: CategoryTab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (!rawTab) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'rooms');
        return next;
      }, { replace: true });
    }
  }, [rawTab, setSearchParams]);

  // Subscribe to real-time connections
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToMyConnections(user.uid, setMyConnections);
    return () => unsub();
  }, [user?.uid, subscribeToMyConnections]);

  // Subscribe to chat rooms
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
    return () => unsub();
  }, [user?.uid, subscribeToChatRooms]);

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

  // Fetch saved profiles dynamically from Firestore
  useEffect(() => {
    if (!currentUser || !savedProfileIds.length) {
      setSavedProfiles([]);
      return;
    }
    let isMounted = true;
    setLoadingSavedProfiles(true);
    getProfilesByIds(currentUser, savedProfileIds)
      .then(profiles => {
        if (isMounted) {
          setSavedProfiles(profiles);
        }
      })
      .catch(err => console.warn('Could not load saved profiles:', err))
      .finally(() => {
        if (isMounted) setLoadingSavedProfiles(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentUser, savedProfileIds, getProfilesByIds]);

  // Load matches for sidebar & seeker calculations
  useEffect(() => {
    if (!currentUser) return;
    findMatches(currentUser, selectedCity, filters, false)
      .then(res => setMatches(res))
      .catch(err => console.warn('Failed to load matches for explore page:', err));
  }, [currentUser, selectedCity, filters, findMatches]);

  // Connections filtering
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

  // Fetch profiles for connections
  useEffect(() => {
    if (!currentUser || allConnectionUids.length === 0) {
      setConnectedProfiles([]);
      return;
    }
    let isMounted = true;
    getProfilesByIds(currentUser, allConnectionUids)
      .then(res => {
        if (isMounted) setConnectedProfiles(res);
      })
      .catch(err => console.warn('Could not load connected profiles:', err));
    return () => { isMounted = false; };
  }, [currentUser, allConnectionUids, getProfilesByIds]);

  const handleSelectCity = (cityName: string) => {
    setSelectedCity(cityName);
    updateFilters({ city: cityName });
    setAdvFilters(prev => ({ ...prev, city: cityName }));
    setIsCityOpen(false);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (cityName) {
        next.set('city', cityName);
      } else {
        next.delete('city');
      }
      return next;
    }, { replace: true });
  };

  const filteredCities = cities.filter(c =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  );

  const hasActiveAdvFilters = Boolean(
    (advFilters.budgetMax && advFilters.budgetMax < 100000) ||
    (advFilters.moveInDate && advFilters.moveInDate !== 'any') ||
    (advFilters.gender && advFilters.gender !== 'any') ||
    (advFilters.roomTypes && advFilters.roomTypes.length > 0) ||
    (advFilters.furnishing && advFilters.furnishing !== 'any') ||
    advFilters.verifiedOnly
  );

  // Toggle Save Room
  const handleToggleSaveRoom = async (roomId: string) => {
    if (!user?.uid) {
      openAuthModal({
        title: 'Sign in to Save Rooms',
        subtitle: 'Save your favorite rooms and access them anytime across devices.',
        redirect: `/explore?tab=rooms`,
      });
      return;
    }
    if (savingId) return;
    setSavingId(roomId);
    const isSaved = savedRoomIds.includes(roomId);
    try {
      await toggleSavedRoom(user.uid, roomId, isSaved);
      await refreshProfile();
      toast.success(isSaved ? 'Room removed from saved' : 'Room saved to your favorites');
    } catch {
      toast.error('Failed to update saved room');
    } finally {
      setSavingId(null);
    }
  };

  // Toggle Save Profile
  const handleToggleSaveProfile = async (uid: string) => {
    if (!user?.uid) {
      openAuthModal({
        title: 'Sign in to Save Roommates',
        subtitle: 'Save profiles of compatible roommates and connect anytime.',
        redirect: `/explore?tab=roommates`,
      });
      return;
    }
    if (savingId) return;
    setSavingId(uid);
    const isSaved = savedProfileIds.includes(uid);
    try {
      await toggleSavedProfile(user.uid, uid, isSaved);
      await refreshProfile();
      toast.success(isSaved ? 'Roommate removed from saved' : 'Roommate saved to your favorites');
    } catch {
      toast.error('Failed to update saved roommate');
    } finally {
      setSavingId(null);
    }
  };

  // Chat with owner
  const handleChatOwner = async (room: Listing) => {
    if (!user?.uid) {
      openAuthModal({
        title: 'Sign in to Inquire',
        subtitle: 'Sign in to chat with property owners and schedule visits.',
        redirect: `/room/${room.id}`,
      });
      return;
    }
    if (!room.ownerId) {
      navigate(`/room/${room.id}`);
      return;
    }
    const relationship = getRelationshipState(user.uid, room.ownerId, myConnections, chatRoomMap);
    if (relationship !== 'connected') {
      toast.info(relationship === 'pending_sent'
        ? 'Your interest is pending. Messaging opens after the owner accepts it.'
        : 'Send interest from the listing first. Messaging opens after acceptance.');
      navigate(`/room/${room.id}`);
      return;
    }
    try {
      const chatRoomId = await getOrCreateChatRoom(user.uid, room.ownerId);
      navigate(`/chat/${chatRoomId}`);
    } catch {
      navigate(`/room/${room.id}`);
    }
  };

  // Chat with flatmate
  const handleChatFlatmate = async (targetUid: string) => {
    if (!user?.uid) {
      openAuthModal({
        title: 'Sign in to Message',
        subtitle: 'Sign in to start conversations with verified roommates.',
        redirect: `/match/${targetUid}`,
      });
      return;
    }
    const relationship = getRelationshipState(user.uid, targetUid, myConnections, chatRoomMap);
    if (relationship !== 'connected') {
      toast.info(relationship === 'pending_sent'
        ? 'Your connection request is pending. Messaging opens after acceptance.'
        : 'Connect first. Messaging opens after the other person accepts.');
      navigate(`/match/${targetUid}`);
      return;
    }
    try {
      const chatRoomId = await getOrCreateChatRoom(user.uid, targetUid);
      navigate(`/chat/${chatRoomId}`);
    } catch {
      navigate(`/match/${targetUid}`);
    }
  };


  // Connection Request Actions
  const handleAcceptConnection = async (connId: string) => {
    if (!user?.uid || connectingId) return;
    setConnectingId(connId);
    try {
      await acceptRequest(connId);
      toast.success('Connection request accepted! You can now message each other.');
    } catch {
      toast.error('Failed to accept connection request.');
    } finally {
      setConnectingId(null);
    }
  };

  const handleDeclineConnection = async (connId: string) => {
    if (!user?.uid || connectingId) return;
    setConnectingId(connId);
    try {
      await rejectRequest(connId);
      toast.success('Connection request declined.');
    } catch {
      toast.error('Failed to decline connection request.');
    } finally {
      setConnectingId(null);
    }
  };

  // Close city dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.city-dropdown-container')) {
        setIsCityOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsCityOpen(false);
      }
    };
    if (isCityOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isCityOpen]);

  // Filtered saved rooms
  const filteredSavedRooms = useMemo(() => {
    return savedRooms.filter(room => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = room.title?.toLowerCase().includes(q) ||
          room.locality?.toLowerCase().includes(q) ||
          room.city?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [savedRooms, searchQuery]);

  // Filtered saved flatmates
  const filteredSavedFlatmates = useMemo(() => {
    return savedProfiles.filter(m => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match = m.profile.name?.toLowerCase().includes(q) ||
          m.profile.locality?.toLowerCase().includes(q) ||
          m.profile.city?.toLowerCase().includes(q) ||
          m.profile.profession?.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [savedProfiles, searchQuery]);

  // Combined pool of available matches for sidebar calculations
  const allAvailableMatches = useMemo(() => [
    ...matches,
    ...savedProfiles.filter(sp => !matches.some(m => m.profile.uid === sp.profile.uid)),
    ...connectedProfiles.filter(cp => !matches.some(m => m.profile.uid === cp.profile.uid))
  ], [matches, savedProfiles, connectedProfiles]);

  const totalSavedCount = savedRoomIds.length + savedProfileIds.length;
  const totalConnectionsCount = acceptedConnectedUids.length + receivedRequests.length;

  return (
    <div className="min-h-screen bg-[#FBFBFC] pb-24 sm:pb-16 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-6">



        {/* ======================================================== */}
        {/* MOBILE CONTROLS (< 768px): 100% PRESERVED                */}
        {/* ======================================================== */}
        <div className="block md:hidden max-w-xl mx-auto mb-4">
          {/* 1. TOP SEARCH & LOCATION BAR PILL (Matching Mobile [ 📍 Bengaluru   (⚙️) ]) */}
          <div className="relative mb-3.5 city-dropdown-container">
            <div className="w-full bg-white border border-gray-200/90 rounded-full py-2.5 px-4 flex items-center justify-between shadow-2xs">
              <div
                onClick={() => setIsCityOpen(!isCityOpen)}
                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
              >
                <MapPin className="w-5 h-5 text-[#FF5A36] shrink-0" />
                <span className="font-semibold text-sm sm:text-base text-[#1E2229] truncate">
                  {selectedCity}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCityOpen ? 'rotate-180' : ''}`} />
              </div>

              <button
                type="button"
                onClick={() => setShowFiltersModal(true)}
                className="w-9 h-9 rounded-full border border-gray-200/80 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors shrink-0 cursor-pointer shadow-2xs active:scale-95 ml-2"
                title="Filter listings"
                aria-label="Open filters"
              >
                <SlidersHorizontal className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* City Selection Dropdown (Mobile) */}
            {isCityOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 p-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search city..."
                    value={citySearch}
                    onChange={e => setCitySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-gray-50 rounded-xl text-xs border border-gray-200 outline-none focus:border-[#FF5A36]"
                    autoFocus
                  />
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredCities.map(cityName => (
                    <button
                      key={cityName}
                      type="button"
                      onClick={() => handleSelectCity(cityName)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        selectedCity === cityName
                          ? 'bg-[#FFF2EB] text-[#FF5A36]'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{cityName}</span>
                      {selectedCity === cityName && <Check className="w-3.5 h-3.5 text-[#FF5A36]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mobile Locality / Area Search Bar */}
          <div className="relative mb-3 flex items-center bg-white border border-gray-200/90 rounded-2xl px-3.5 py-2 shadow-2xs">
            <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search locality or keywords in ${selectedCity}...`}
              className="w-full text-xs font-medium text-[#1E2229] placeholder:text-gray-400 bg-transparent border-none outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="p-1 text-gray-400 hover:text-gray-600 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. CATEGORY NAVIGATION TABS (Mobile: Horizontal Scrollable Strip) */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide border-b border-gray-200/70 pb-2.5 mb-3 select-none">
            {/* Rooms */}
            <button
              type="button"
              onClick={() => handleTabChange('rooms')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'rooms'
                  ? 'bg-[#1E2229] text-white shadow-xs'
                  : 'bg-white border border-gray-200/80 text-gray-600'
              }`}
            >
              <Bed className="w-3.5 h-3.5" />
              <span>Rooms</span>
            </button>

            {/* Roommates */}
            <button
              type="button"
              onClick={() => handleTabChange('roommates')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'roommates'
                  ? 'bg-[#1E2229] text-white shadow-xs'
                  : 'bg-white border border-gray-200/80 text-gray-600'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Roommates</span>
            </button>

            {/* PG */}
            <button
              type="button"
              onClick={() => handleTabChange('pg')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'pg'
                  ? 'bg-[#1E2229] text-white shadow-xs'
                  : 'bg-white border border-gray-200/80 text-gray-600'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>PG</span>
            </button>

            {/* Saved (with Badge) */}
            <button
              type="button"
              onClick={() => handleTabChange('saved')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'saved'
                  ? 'bg-[#FF5A36] text-white shadow-xs'
                  : 'bg-white border border-gray-200/80 text-gray-600'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${activeTab === 'saved' ? 'fill-current' : ''}`} />
              <span>Saved</span>
              {totalSavedCount > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                  activeTab === 'saved' ? 'bg-white text-[#FF5A36]' : 'bg-[#FFF2EB] text-[#FF5A36]'
                }`}>
                  {totalSavedCount}
                </span>
              )}
            </button>

            {/* Connections (with Badge) */}
            <button
              type="button"
              onClick={() => handleTabChange('connections')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'connections'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-gray-200/80 text-gray-600'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Connections</span>
              {totalConnectionsCount > 0 && (
                <span className={`px-1.5 py-0.2 text-[10px] font-extrabold rounded-full ${
                  activeTab === 'connections' ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {totalConnectionsCount}
                </span>
              )}
            </button>

            {/* All Listings */}
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#1E2229] text-white shadow-xs'
                  : 'bg-white border border-gray-200/80 text-gray-600'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>All</span>
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* DESKTOP CONTENT AREA (Full Width)                        */}
        {/* ======================================================== */}
        <div className="w-full space-y-4">

            {/* Row 1: Unified Desktop Search & Filter Bar */}
            <div className="hidden md:flex bg-white border border-gray-200/90 rounded-2xl shadow-2xs p-2 items-center gap-3">
              {/* City Selector Button with Dropdown */}
              <div className="relative city-dropdown-container shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCityOpen(!isCityOpen)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all font-bold text-xs sm:text-sm text-[#1E2229] cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-[#FF5A36]" />
                  <span>{selectedCity}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCityOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu (Desktop) */}
                {isCityOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 p-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search city..."
                        value={citySearch}
                        onChange={e => setCitySearch(e.target.value)}
                        className="w-full pl-7 pr-2.5 py-1.5 bg-gray-50 rounded-lg text-xs border border-gray-200 outline-none focus:border-[#FF5A36]"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto space-y-0.5">
                      {filteredCities.map(cityName => (
                        <button
                          key={cityName}
                          type="button"
                          onClick={() => handleSelectCity(cityName)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            selectedCity === cityName
                              ? 'bg-[#FFF2EB] text-[#FF5A36]'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>{cityName}</span>
                          {selectedCity === cityName && <Check className="w-3.5 h-3.5 text-[#FF5A36]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="h-6 w-px bg-gray-200 shrink-0" />

              {/* Locality & Keyword Search Input */}
              <div className="flex-1 relative min-w-0">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search locality, landmark, area, or keywords in ${selectedCity}...`}
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm text-[#1E2229] placeholder:text-gray-400 bg-transparent border-none outline-none font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Sort Selector */}
              <div className="relative shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="bg-gray-50 border border-gray-200/90 rounded-xl px-3 py-2 text-xs font-semibold text-[#1E2229] outline-none focus:border-[#FF5A36] cursor-pointer"
                >
                  <option value="match">Best Match</option>
                  <option value="newest">Newest First</option>
                  <option value="price_asc">Lowest Rent</option>
                  <option value="price_desc">Highest Rent</option>
                </select>
              </div>

              {/* View Mode Toggle */}
              <div className="hidden xl:flex items-center gap-1 border border-gray-200/90 rounded-xl p-0.5 bg-gray-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white text-[#1E2229] shadow-2xs' : 'text-gray-400 hover:text-gray-700'}`}
                  title="Grid view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white text-[#1E2229] shadow-2xs' : 'text-gray-400 hover:text-gray-700'}`}
                  title="List view"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Filters Modal Trigger */}
              <button
                type="button"
                onClick={() => setShowFiltersModal(true)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  hasActiveAdvFilters
                    ? 'bg-[#FFF2EB] border-[#FF5A36] text-[#FF5A36]'
                    : 'bg-gray-50 border-gray-200/90 text-[#1E2229] hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Filters</span>
                {hasActiveAdvFilters && (
                  <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
                )}
              </button>
            </div>

            {/* Row 2: Category Tabs Bar + Team Banner (Desktop) */}
            <div className="hidden md:flex items-center justify-between border-b border-gray-200/80 pb-3 pt-1">
              {/* Left: Category Navigation Tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Rooms & Flats */}
                <button
                  type="button"
                  onClick={() => handleTabChange('rooms')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'rooms'
                      ? 'bg-[#1E2229] text-white shadow-xs'
                      : 'text-gray-600 hover:text-[#1E2229] hover:bg-gray-100/70'
                  }`}
                >
                  <Bed className="w-4 h-4" />
                  <span>Rooms &amp; Flats</span>
                </button>

                {/* Roommates */}
                <button
                  type="button"
                  onClick={() => handleTabChange('roommates')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'roommates'
                      ? 'bg-[#1E2229] text-white shadow-xs'
                      : 'text-gray-600 hover:text-[#1E2229] hover:bg-gray-100/70'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Roommates</span>
                </button>

                {/* PG & Coliving */}
                <button
                  type="button"
                  onClick={() => handleTabChange('pg')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'pg'
                      ? 'bg-[#1E2229] text-white shadow-xs'
                      : 'text-gray-600 hover:text-[#1E2229] hover:bg-gray-100/70'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>PG &amp; Coliving</span>
                </button>

                {/* Saved (with badge count) */}
                <button
                  type="button"
                  onClick={() => handleTabChange('saved')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'saved'
                      ? 'bg-[#FF5A36] text-white shadow-xs'
                      : 'text-gray-600 hover:text-[#FF5A36] hover:bg-rose-50/70'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${activeTab === 'saved' ? 'fill-current' : ''}`} />
                  <span>Saved</span>
                  {totalSavedCount > 0 && (
                    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                      activeTab === 'saved' ? 'bg-white text-[#FF5A36]' : 'bg-[#FFF2EB] text-[#FF5A36]'
                    }`}>
                      {totalSavedCount}
                    </span>
                  )}
                </button>

                {/* Connections (with badge count) */}
                <button
                  type="button"
                  onClick={() => handleTabChange('connections')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'connections'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 hover:text-emerald-700 hover:bg-emerald-50/70'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  <span>My Connections</span>
                  {totalConnectionsCount > 0 && (
                    <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                      activeTab === 'connections' ? 'bg-white text-emerald-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {totalConnectionsCount}
                    </span>
                  )}
                </button>

                {/* All Listings */}
                <button
                  type="button"
                  onClick={() => handleTabChange('all')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-[#1E2229] text-white shadow-xs'
                      : 'text-gray-600 hover:text-[#1E2229] hover:bg-gray-100/70'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  <span>All Listings</span>
                </button>
              </div>
            </div>

            {/* Sub-Tabs: Shown when Saved or Connections is selected */}
            {activeTab === 'saved' && (
              <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSavedSubTab('rooms')}
                  className={`flex-1 h-9 py-2 px-2.5 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-0 cursor-pointer ${
                    savedSubTab === 'rooms'
                      ? 'bg-[#FF5A36] text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Bed className="w-4 h-4 shrink-0" />
                  <span className="truncate whitespace-nowrap">
                    <span className="hidden sm:inline">Saved </span>Rooms
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] shrink-0 font-bold ${
                    savedSubTab === 'rooms' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {savedRooms.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSavedSubTab('flatmates')}
                  className={`flex-1 h-9 py-2 px-2.5 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-0 cursor-pointer ${
                    savedSubTab === 'flatmates'
                      ? 'bg-[#FF5A36] text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span className="truncate whitespace-nowrap">
                    <span className="hidden sm:inline">Saved </span>Roommates
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] shrink-0 font-bold ${
                    savedSubTab === 'flatmates' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {savedProfiles.length}
                  </span>
                </button>
              </div>
            )}

            {activeTab === 'connections' && (
              <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-200/80 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setConnectionSubTab('connected')}
                  className={`flex-1 h-9 py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-0 ${
                    connectionSubTab === 'connected'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate whitespace-nowrap">Connected</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] shrink-0 font-bold ${
                    connectionSubTab === 'connected' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {acceptedConnections.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionSubTab('received')}
                  className={`flex-1 h-9 py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-0 ${
                    connectionSubTab === 'received'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate whitespace-nowrap">Received</span>
                  {receivedRequests.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-white text-emerald-700 font-extrabold shrink-0">
                      {receivedRequests.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setConnectionSubTab('sent')}
                  className={`flex-1 h-9 py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap min-w-0 ${
                    connectionSubTab === 'sent'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="truncate whitespace-nowrap">Sent</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] shrink-0 font-bold ${
                    connectionSubTab === 'sent' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {sentRequests.length}
                  </span>
                </button>
              </div>
            )}

            {/* FEED CONTENT: Dynamic views based on Active Tab */}
            <div className="w-full">
              {activeTab === 'rooms' ? (
                <BrowseRooms
                  embedded
                  city={selectedCity}
                  category="rooms"
                  searchQuery={searchQuery}
                  onOpenFilters={() => setShowFiltersModal(true)}
                />
              ) : activeTab === 'roommates' ? (
                <BrowseSeekers
                  embedded
                  city={selectedCity}
                  searchQuery={searchQuery}
                  onOpenFilters={() => setShowFiltersModal(true)}
                />
              ) : activeTab === 'pg' ? (
                <BrowseRooms
                  embedded
                  city={selectedCity}
                  category="pg"
                  searchQuery={searchQuery}
                  onOpenFilters={() => setShowFiltersModal(true)}
                />
              ) : activeTab === 'saved' ? (
                /* SAVED VIEW (Rooms or Flatmates) */
                <div>
                  {savedSubTab === 'rooms' ? (
                    loadingSavedRooms ? (
                      <div className="py-20 flex justify-center">
                        <Loader2 className="w-8 h-8 text-[#FF5A36] animate-spin" />
                      </div>
                    ) : filteredSavedRooms.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                        {filteredSavedRooms.map(room => (
                          <CompactRoomCard
                            key={room.id}
                            room={room}
                            isSaved={true}
                            onToggleSave={() => handleToggleSaveRoom(room.id)}
                            compatibilityScore={currentUser ? calculateRoomCompatibility(currentUser, room) : undefined}
                            distanceKm={0}
                            onClick={() => navigate(`/room/${room.id}`)}
                            onChat={() => handleChatOwner(room)}
                          />
                        ))}
                      </div>
                    ) : (
                      <StateEmpty
                        icon={Heart}
                        title="No saved rooms yet"
                        description="Browse verified flats and private rooms in Bangalore or your city and tap the heart icon to save your favorites."
                        action={
                          <button
                            type="button"
                            onClick={() => handleTabChange('rooms')}
                            className="px-6 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-xs rounded-full shadow-xs cursor-pointer transition-colors"
                          >
                            Explore Rooms &amp; Flats
                          </button>
                        }
                        className="bg-white rounded-3xl border border-gray-100 py-14 shadow-xs max-w-xl mx-auto"
                      />
                    )
                  ) : (
                    loadingSavedProfiles ? (
                      <div className="py-20 flex justify-center">
                        <Loader2 className="w-8 h-8 text-[#FF5A36] animate-spin" />
                      </div>
                    ) : filteredSavedFlatmates.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                        {filteredSavedFlatmates.map(m => (
                          <DashboardSeekerCard
                            key={m.profile.uid}
                            match={m}
                            isSaved={true}
                            onToggleSave={() => handleToggleSaveProfile(m.profile.uid || '')}
                            saving={savingId === m.profile.uid}
                            onChat={() => handleChatFlatmate(m.profile.uid || '')}
                            cState={getRelationshipState(user?.uid, m.profile.uid || '', myConnections, chatRoomMap)}
                            viewMode={viewMode}
                          />
                        ))}
                      </div>
                    ) : (
                      <StateEmpty
                        icon={Users}
                        title="No saved roommates yet"
                        description="Explore compatible roommates and save profiles to connect, compare habits, and team up."
                        action={
                          <button
                            type="button"
                            onClick={() => handleTabChange('roommates')}
                            className="px-6 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-xs rounded-full shadow-xs cursor-pointer transition-colors"
                          >
                            Browse Roommates
                          </button>
                        }
                        className="bg-white rounded-3xl border border-gray-100 py-14 shadow-xs max-w-xl mx-auto"
                      />
                    )
                  )}
                </div>
              ) : activeTab === 'connections' ? (
                /* CONNECTIONS VIEW (Connected / Received / Sent) */
                <div>
                  {connectionSubTab === 'connected' ? (
                    connectedProfiles.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                        {connectedProfiles.map(m => (
                          <DashboardSeekerCard
                            key={m.profile.uid}
                            match={m}
                            isSaved={savedProfileIds.includes(m.profile.uid || '')}
                            onToggleSave={() => handleToggleSaveProfile(m.profile.uid || '')}
                            onChat={() => handleChatFlatmate(m.profile.uid || '')}
                            cState="chat"
                            viewMode={viewMode}
                          />
                        ))}
                      </div>
                    ) : (
                      <StateEmpty
                        icon={UserCheck}
                        title="No connected roommates yet"
                        description="When a roommate request is accepted by both parties, your mutual connections and verified contact numbers appear right here."
                        action={
                          <button
                            type="button"
                            onClick={() => handleTabChange('roommates')}
                            className="px-6 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-xs rounded-full shadow-xs cursor-pointer transition-colors"
                          >
                            Find Compatible Roommates
                          </button>
                        }
                        className="bg-white rounded-3xl border border-gray-100 py-14 shadow-xs max-w-xl mx-auto"
                      />
                    )
                  ) : connectionSubTab === 'received' ? (
                    receivedRequests.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                        {receivedRequests.map(req => {
                          const m = connectedProfiles.find(p => p.profile.uid === req.fromUserId) || {
                            profile: { uid: req.fromUserId, name: 'Prospective Roommate', city: selectedCity, budget: 10000 } as any,
                            compatibilityScore: currentUser ? calculateCompatibility(currentUser.quizAnswers, {}, currentUser.city, selectedCity) : 0,
                            matchReasons: ['Shared interest in connecting']
                          };
                          return (
                            <DashboardSeekerCard
                              key={req.id}
                              match={m}
                              isReceivedRequest={true}
                              onAcceptRequest={() => handleAcceptConnection(req.id)}
                              onDeclineRequest={() => handleDeclineConnection(req.id)}
                              connecting={connectingId === req.id}
                              viewMode={viewMode}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <StateEmpty
                        icon={Users}
                        title="No pending requests received"
                        description="You don't have any incoming roommate connection requests at this time."
                        className="bg-white rounded-3xl border border-gray-100 py-14 shadow-xs max-w-xl mx-auto"
                      />
                    )
                  ) : (
                    sentRequests.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
                        {sentRequests.map(req => {
                          const m = connectedProfiles.find(p => p.profile.uid === req.toUserId) || {
                            profile: { uid: req.toUserId, name: 'Prospective Roommate', city: selectedCity, budget: 10000 } as any,
                            compatibilityScore: currentUser ? calculateCompatibility(currentUser.quizAnswers, {}, currentUser.city, selectedCity) : 0,
                            matchReasons: ['Request sent']
                          };
                          return (
                            <DashboardSeekerCard
                              key={req.id}
                              match={m}
                              isSentRequest={true}
                              onCancelRequest={() => handleDeclineConnection(req.id)}
                              viewMode={viewMode}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <StateEmpty
                        icon={Users}
                        title="No outgoing requests pending"
                        description="You haven't sent any pending connection requests. Browse roommates and connect with genuine people."
                        action={
                          <button
                            type="button"
                            onClick={() => handleTabChange('roommates')}
                            className="px-6 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-xs rounded-full shadow-xs cursor-pointer transition-colors"
                          >
                            Explore Roommates
                          </button>
                        }
                        className="bg-white rounded-3xl border border-gray-100 py-14 shadow-xs max-w-xl mx-auto"
                      />
                    )
                  )}
                </div>
              ) : (
                /* ALL LISTINGS VIEW */
                <BrowseRooms
                  embedded
                  city={selectedCity}
                  category="all"
                  searchQuery={searchQuery}
                  onOpenFilters={() => setShowFiltersModal(true)}
                />
              )}
            </div>
          </div>
      </div>

      {/* Advanced Filters Modal (Mobile & Tablet) */}
      <AdvancedFiltersModal
        isOpen={showFiltersModal}
        onClose={() => setShowFiltersModal(false)}
        onApply={(newFilters) => {
          setAdvFilters(newFilters);
          if (newFilters.city) {
            setSelectedCity(newFilters.city);
            updateFilters({ city: newFilters.city });
          }
          setShowFiltersModal(false);
        }}
        filters={advFilters}
        totalResultsCount={0}
      />

      {/* Create Team Modal */}
      <CreateTeamModal
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        cityName={selectedCity}
      />
    </div>
  );
}
