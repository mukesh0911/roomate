import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useListings } from '@/hooks/useListings';
import type { Listing } from '@/hooks/useListings';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useChat } from '@/hooks/useChat';
import { calculateRoomCompatibility } from '@/hooks/useMatches';
import {
  Search, MapPin, Bed, SlidersHorizontal, X, ChevronDown,
  ArrowUpDown, LayoutGrid, List, ShieldAlert, Check
} from 'lucide-react';
import { cities } from '@/lib/staticData';
import { areSameCityAlias } from '@/lib/cityNormalization';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import StateEmpty from '@/components/StateEmpty';
import StateLoading from '@/components/StateLoading';
import RoomCard from '@/components/RoomCard';
import CompactRoomCard from '@/components/CompactRoomCard';
import ContactModal from '@/components/ContactModal';
import { isPubliclyVisibleListing } from '@/lib/marketplaceVisibility';
import AdvancedFiltersModal, { DEFAULT_ADVANCED_FILTERS } from '@/components/AdvancedFiltersModal';
import type { AdvancedFilterState } from '@/components/AdvancedFiltersModal';

type SortOption = 'match' | 'newest' | 'price_asc' | 'price_desc';

const sortLabels: Record<SortOption, string> = {
  match: 'Best Match',
  newest: 'Newest First',
  price_asc: 'Lowest Rent',
  price_desc: 'Highest Rent',
};



interface BrowseRoomsProps {
  embedded?: boolean;
  city?: string;
  category?: 'rooms' | 'pg' | 'all';
  searchQuery?: string;
  onOpenFilters?: () => void;
}

export default function BrowseRooms({
  embedded = false,
  city: propCity,
  category = 'all',
  searchQuery: propSearchQuery = '',
  onOpenFilters,
}: BrowseRoomsProps) {
  const navigate = useNavigate();
  const { filters, updateFilters } = useStore();
  const { listings, getListings, isLoading, hasMore, loadMore, error } = useListings();
  const { user, profile, refreshProfile } = useAuth();
  const { toggleSavedRoom } = useUserProfile();
  const { getOrCreateChatRoom } = useChat();

  const [searchQuery, setSearchQuery] = useState(propSearchQuery);
  const [showFilters, setShowFilters] = useState(false);
  const [savingRoomId, setSavingRoomId] = useState<string | null>(null);
  const [advFilters, setAdvFilters] = useState<AdvancedFilterState>(DEFAULT_ADVANCED_FILTERS);
  const [contactOwnerProfile, setContactOwnerProfile] = useState<any | null>(null);

  const [isCityOpen, setIsCityOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('match');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const savedRoomIds: string[] = profile?.savedRoomIds || [];
  const currentCity = propCity !== undefined ? propCity : (filters.city || advFilters.city || profile?.city || '');

  useEffect(() => {
    getListings(filters);
  }, [filters, getListings]);

  // Sync prop changes
  useEffect(() => {
    if (propSearchQuery !== undefined) {
      setSearchQuery(propSearchQuery);
    }
  }, [propSearchQuery]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.dropdown-container')) {
        setIsCityOpen(false);
        setIsSortOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCitySelect = (cityName: string) => {
    updateFilters({ city: cityName });
    setAdvFilters(prev => ({ ...prev, city: cityName }));
    setIsCityOpen(false);
  };

  const clearFilters = () => {
    updateFilters({ city: '', budgetMin: 0, budgetMax: 100000, localities: [], gender: 'any', verifiedOnly: false, amenities: [], flatType: [] });
    setAdvFilters({ ...DEFAULT_ADVANCED_FILTERS, city: '' });
    setSearchQuery('');
    setShowFilters(false);
  };

  const handleToggleSave = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: 'Sign in to Save Rooms',
        subtitle: 'Save your favorite rooms and access them anytime across devices.',
        redirect: `/room/${roomId}`,
      });
      return;
    }
    if (savingRoomId) return;
    setSavingRoomId(roomId);
    const isSaved = savedRoomIds.includes(roomId);
    try {
      await toggleSavedRoom(user.uid, roomId, isSaved);
      await refreshProfile();
      toast.success(isSaved ? 'Room removed from saved' : 'Room saved to your favorites');
    } catch (err) {
      console.error('Failed to save room:', err);
      toast.error('Failed to update saved room');
    } finally {
      setSavingRoomId(null);
    }
  };

  const handleToggleSaveRoom = async (room: Listing) => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: 'Sign in to Save Rooms',
        subtitle: 'Save your favorite rooms and access them anytime across devices.',
        redirect: `/room/${room.id}`,
      });
      return;
    }
    if (savingRoomId) return;
    setSavingRoomId(room.id);
    const isSaved = savedRoomIds.includes(room.id);
    try {
      await toggleSavedRoom(user.uid, room.id, isSaved);
      await refreshProfile();
      toast.success(isSaved ? 'Room removed from saved' : 'Room saved to your favorites');
    } catch (err) {
      console.error('Failed to save room:', err);
      toast.error('Failed to update saved room');
    } finally {
      setSavingRoomId(null);
    }
  };

  const handleCallOwner = async (room: Listing) => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
        title: 'Sign in to Contact Owner',
        subtitle: 'Sign in to view verified contact numbers and reach out to property owners.',
        redirect: `/room/${room.id}`,
      });
      return;
    }
    try {
      const ownerSnap = await getDoc(doc(db, 'users', room.ownerId));
      const ownerData = ownerSnap.exists() ? ownerSnap.data() : null;
      setContactOwnerProfile({
        uid: room.ownerId,
        name: room.ownerName || ownerData?.name || 'Property Owner',
        phone: (room as any).contactPhone || ownerData?.phone || '',
        locality: room.locality || room.city || currentCity,
        budget: room.partnerShare || room.totalRent || 0,
        isVerified: room.ownerVerified || (room as any).isOwnerVerified || ownerData?.isVerified,
        avatar: room.ownerAvatar || ownerData?.avatar,
      });
    } catch {
      setContactOwnerProfile({
        uid: room.ownerId,
        name: room.ownerName || 'Property Owner',
        phone: (room as any).contactPhone || '',
        locality: room.locality || room.city || currentCity,
        budget: room.partnerShare || room.totalRent || 0,
        isVerified: room.ownerVerified || (room as any).isOwnerVerified,
        avatar: room.ownerAvatar,
      });
    }
  };

  const handleChatOwner = async (room: Listing) => {
    if (!user?.uid) {
      useStore.getState().openAuthModal({
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
    try {
      const roomId = await getOrCreateChatRoom(user.uid, room.ownerId);
      navigate(`/chat/${roomId}`);
    } catch (err) {
      navigate(`/room/${room.id}`);
    }
  };

  const filtered = listings.filter(l => {
    if (!isPubliclyVisibleListing(l)) return false;
    if (profile?.blockedUserIds?.includes(l.ownerId)) return false;

    // City filter
    if (currentCity) {
      const qCity = currentCity.toLowerCase().trim();
      const lCity = (l.city || '').toLowerCase().trim();
      if (lCity && !lCity.includes(qCity) && !qCity.includes(lCity) && !areSameCityAlias(qCity, lCity)) {
        return false;
      }
    }

    // Category filter from props (rooms vs pg)
    if (category === 'pg') {
      const isPg = (l.flatType || '').toLowerCase().includes('pg') || (l.flatType || '').toLowerCase().includes('hostel') || (l.flatType || '').toLowerCase().includes('coliving');
      if (!isPg) return false;
    } else if (category === 'rooms') {
      const isPg = (l.flatType || '').toLowerCase().includes('pg') || (l.flatType || '').toLowerCase().includes('hostel');
      if (isPg) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = l.title?.toLowerCase().includes(q) || l.locality?.toLowerCase().includes(q) || l.city?.toLowerCase().includes(q);
      if (!match) return false;
    }

    // Budget filter from advFilters
    const rent = l.partnerShare || l.totalRent || (l as any).monthlyRent || 0;
    if (advFilters.budgetMin && rent < advFilters.budgetMin) return false;
    if (advFilters.budgetMax && advFilters.budgetMax < 100000 && rent > advFilters.budgetMax) return false;

    // Move-in Date filter
    if (advFilters.moveInDate && advFilters.moveInDate !== 'any' && l.availableFrom) {
      const avail = new Date(l.availableFrom).getTime();
      const now = Date.now();
      const daysDiff = (avail - now) / (1000 * 60 * 60 * 24);
      if (advFilters.moveInDate === 'immediate' && daysDiff > 7) return false;
      if (advFilters.moveInDate === '15_days' && daysDiff > 15) return false;
      if (advFilters.moveInDate === '30_days' && daysDiff > 30) return false;
    }

    // Gender filter
    if (advFilters.gender && advFilters.gender !== 'any') {
      const prefGender = ((l as any).preferredGender || (l as any).gender || '').toLowerCase();
      if (prefGender && prefGender !== 'any' && !prefGender.includes(advFilters.gender)) return false;
    }

    // Room Type filter
    if (advFilters.roomTypes && advFilters.roomTypes.length > 0) {
      const flatType = (l.flatType || '').toLowerCase();
      const matches = advFilters.roomTypes.some(rt => {
        const norm = rt.toLowerCase().replace(/\s+/g, '');
        const flatNorm = flatType.replace(/\s+/g, '');
        if (norm === flatNorm) return true;
        if (norm === 'privateroom') return ['1bhk', 'studio', 'privateroom'].some(k => flatNorm.includes(k));
        if (norm === 'sharedroom') return ['2bhk', '3bhk', 'sharedroom'].some(k => flatNorm.includes(k));
        return flatNorm.includes(norm);
      });
      if (!matches) return false;
    }

    // Furnishing filter
    if (advFilters.furnishing && advFilters.furnishing !== 'any') {
      if (l.furnishing && l.furnishing !== advFilters.furnishing) return false;
    }

    // Verified Only filter
    if (advFilters.verifiedOnly) {
      if (!l.ownerVerified && !l.isOwnerVerified) return false;
    }

    return true;
  });

  // Sorting
  const sortedListings = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'price_asc') {
        const rentA = a.partnerShare || a.totalRent || (a as any).monthlyRent || 0;
        const rentB = b.partnerShare || b.totalRent || (b as any).monthlyRent || 0;
        return rentA - rentB;
      }
      if (sortBy === 'price_desc') {
        const rentA = a.partnerShare || a.totalRent || (a as any).monthlyRent || 0;
        const rentB = b.partnerShare || b.totalRent || (b as any).monthlyRent || 0;
        return rentB - rentA;
      }
      if (sortBy === 'match' && profile) {
        const scoreA = calculateRoomCompatibility(profile, a);
        const scoreB = calculateRoomCompatibility(profile, b);
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
  }, [filtered, sortBy, profile]);

  // EMBEDDED VIEW: EXACT REFERENCE CARD ARCHITECTURE (NO DUPLICATE SEARCH OR CONTROL BARS)
  if (embedded) {
    return (
      <div className="space-y-3.5 sm:space-y-4">
        {isLoading && (
          <div className="py-20 flex justify-center">
            <StateLoading label="Finding verified rooms..." />
          </div>
        )}

        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-600 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
            <span>Failed to load rooms. Please check your connection and try again.</span>
          </div>
        )}

        {/* RESPONSIVE FEED: 1 COLUMN ON MOBILE, 2 COLUMNS ON DESKTOP (MATCHING FLATMATE EXACT LAYOUT) */}
        {!isLoading && sortedListings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
            {sortedListings.map((listing) => (
              <CompactRoomCard
                key={listing.id}
                room={listing}
                isSaved={savedRoomIds.includes(listing.id)}
                onToggleSave={handleToggleSaveRoom}
                compatibilityScore={profile ? calculateRoomCompatibility(profile, listing) : undefined}
                distanceKm={0}
                onClick={() => navigate(`/room/${listing.id}`)}
                onChat={(r) => handleChatOwner(r)}
              />
            ))}
          </div>
        )}

        {/* Real-User Dynamic Empty State */}
        {!isLoading && sortedListings.length === 0 && (
          <StateEmpty
            icon={Bed}
            compact
            title={searchQuery ? `No rooms match "${searchQuery}" in ${currentCity}` : `No rooms available in ${currentCity} yet`}
            titleClassName="text-sm sm:text-base font-semibold text-[#1E2229]"
            description={
              searchQuery
                ? "Try clearing your search terms or adjusting budget filters."
                : `Be the first to list a verified flat or private room in ${currentCity} and connect with genuine roommates.`
            }
            descriptionClassName="text-xs text-gray-500 max-w-xs mx-auto mb-0"
            className="bg-white rounded-2xl border border-gray-100 py-8 px-4 shadow-2xs max-w-sm mx-auto my-4"
          />
        )}

        {/* Call / Contact Modal */}
        <ContactModal
          isOpen={Boolean(contactOwnerProfile)}
          onClose={() => setContactOwnerProfile(null)}
          profile={contactOwnerProfile}
        />
      </div>
    );
  }

  // STANDALONE VIEW (When accessed directly at /rooms)
  const hasActiveFilters =
    Boolean(currentCity) ||
    Boolean(advFilters.budgetMax && advFilters.budgetMax < 100000) ||
    Boolean(advFilters.moveInDate && advFilters.moveInDate !== 'any') ||
    Boolean(advFilters.gender && advFilters.gender !== 'any') ||
    Boolean(advFilters.roomTypes && advFilters.roomTypes.length > 0) ||
    Boolean(advFilters.furnishing && advFilters.furnishing !== 'any') ||
    Boolean(advFilters.verifiedOnly);

  const contentGrid = (
    <div className="space-y-4">
      {/* Top Search & Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by locality, landmark or society (e.g. Kilpauk, T. Nagar, Koramangala...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search rooms"
            className="w-full pl-11 pr-10 py-3 bg-white rounded-2xl text-xs sm:text-sm border border-gray-200/90 shadow-2xs outline-none focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/10 transition-all text-[#1E2229] placeholder:text-gray-400 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Control Bar */}
        <div className="grid grid-cols-2 gap-2.5 md:hidden w-full">
          <div className="relative dropdown-container">
            <button
              type="button"
              onClick={() => {
                setIsSortOpen(!isSortOpen);
                setIsCityOpen(false);
              }}
              className="w-full px-3.5 py-3 bg-white border border-gray-200/90 rounded-2xl text-xs sm:text-sm font-semibold text-[#1E2229] flex items-center justify-between shadow-2xs hover:border-gray-300 transition-all cursor-pointer whitespace-nowrap"
            >
              <div className="flex items-center gap-1.5 truncate">
                <ArrowUpDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span className="truncate">{sortLabels[sortBy]}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSortOpen && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-40 animate-fade-up">
                {(Object.keys(sortLabels) as (keyof typeof sortLabels)[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSortBy(key);
                      setIsSortOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      sortBy === key ? 'text-[#FF5A36] bg-[#FFF2EB]' : 'text-[#1E2229] hover:bg-gray-50'
                    }`}
                  >
                    <span>{sortLabels[key]}</span>
                    {sortBy === key && <Check className="w-3.5 h-3.5 text-[#FF5A36]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(true)}
            aria-label="Open filters"
            className={`w-full px-3.5 py-3 bg-white border rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer ${
              hasActiveFilters ? 'border-[#FF5A36] text-[#FF5A36] bg-[#FFF2EB]' : 'border-gray-200/90 text-[#1E2229] hover:border-gray-300'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-gray-500" />
            <span>Filters</span>
          </button>
        </div>

        {/* Desktop Controls */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          <div className="relative dropdown-container shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsCityOpen(!isCityOpen);
                setIsSortOpen(false);
              }}
              className="px-4 py-3 bg-white border border-gray-200/90 rounded-2xl text-xs sm:text-sm font-semibold text-[#1E2229] flex items-center gap-2 shadow-2xs hover:border-gray-300 transition-all cursor-pointer whitespace-nowrap"
            >
              <MapPin className="w-4 h-4 text-gray-500 shrink-0" />
              <span>{currentCity}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isCityOpen ? 'rotate-180' : ''}`} />
            </button>

            {isCityOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-40 animate-fade-up">
                {cities.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCitySelect(c)}
                    className={`w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      currentCity === c ? 'text-[#FF5A36] bg-[#FFF2EB]' : 'text-[#1E2229] hover:bg-gray-50'
                    }`}
                  >
                    <span>{c}</span>
                    {currentCity === c && <Check className="w-3.5 h-3.5 text-[#FF5A36]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative dropdown-container shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsSortOpen(!isSortOpen);
                setIsCityOpen(false);
              }}
              className="px-4 py-3 bg-white border border-gray-200/90 rounded-2xl text-xs sm:text-sm font-semibold text-[#1E2229] flex items-center gap-2 shadow-2xs hover:border-gray-300 transition-all cursor-pointer whitespace-nowrap"
            >
              <ArrowUpDown className="w-4 h-4 text-gray-500 shrink-0" />
              <span>{sortLabels[sortBy]}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isSortOpen ? 'rotate-180' : ''}`} />
            </button>

            {isSortOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-40 animate-fade-up">
                {(Object.keys(sortLabels) as (keyof typeof sortLabels)[]).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSortBy(key);
                      setIsSortOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                      sortBy === key ? 'text-[#FF5A36] bg-[#FFF2EB]' : 'text-[#1E2229] hover:bg-gray-50'
                    }`}
                  >
                    <span>{sortLabels[key]}</span>
                    {sortBy === key && <Check className="w-3.5 h-3.5 text-[#FF5A36]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(true)}
            aria-label="Open filters"
            className={`flex items-center gap-2 px-4 sm:px-5 py-3 bg-white border rounded-2xl text-xs sm:text-sm font-semibold transition-all shadow-2xs cursor-pointer shrink-0 ${
              hasActiveFilters
                ? 'border-[#FF5A36] text-[#FF5A36] bg-[#FFF2EB]'
                : 'border-gray-200/90 text-[#1E2229] hover:border-gray-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>

          <div className="flex items-center gap-1 bg-white border border-gray-200/90 rounded-2xl p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                  : 'border-gray-200/90 bg-white text-gray-500 hover:text-[#1E2229]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                  : 'border-gray-200/90 bg-white text-gray-500 hover:text-[#1E2229]'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Verified Properties Count */}
      <div className="pt-1 pb-1">
        <h2 className="text-sm font-bold text-[#1E2229]">
          {sortedListings.length} verified properties
        </h2>
      </div>

      {/* Standalone Listings Grid */}
      {!isLoading && sortedListings.length > 0 && (
        <div className={
          viewMode === 'grid'
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            : "flex flex-col space-y-4"
        }>
          {sortedListings.map((listing) => (
            <RoomCard
              key={listing.id}
              room={listing}
              isSaved={savedRoomIds.includes(listing.id)}
              isSaving={savingRoomId === listing.id}
              onToggleSave={handleToggleSave}
              onClick={() => navigate(`/room/${listing.id}`)}
            />
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && !isLoading && sortedListings.length > 0 && (
        <div className="flex justify-center pt-6">
          <button
            onClick={() => loadMore(filters)}
            className="px-6 py-2.5 bg-white border border-gray-200/90 rounded-full text-xs font-semibold text-[#1E2229] hover:border-gray-300 hover:bg-gray-50 shadow-2xs transition-all cursor-pointer"
          >
            Load More Rooms
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && sortedListings.length === 0 && (
        <div className="py-12">
          <StateEmpty
            icon={Bed}
            title="No rooms match your search"
            description="Try widening your budget range or clearing some filters."
            action={
              <button
                onClick={clearFilters}
                className="px-6 py-3 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-semibold shadow-xs cursor-pointer"
              >
                Clear All Filters
              </button>
            }
            className="bg-white rounded-3xl max-w-xl mx-auto border border-gray-100 p-8 shadow-xs"
          />
        </div>
      )}
    </div>
  );

  const filterDrawer = (
    <AdvancedFiltersModal
      isOpen={showFilters}
      onClose={() => setShowFilters(false)}
      filters={{ ...advFilters, city: currentCity }}
      onApply={(updated) => {
        if (updated.city && updated.city !== currentCity) {
          updateFilters({ city: updated.city });
        }
        setAdvFilters(updated);
        setShowFilters(false);
      }}
      totalResultsCount={filtered.length}
    />
  );

  return (
    <div className="min-h-screen bg-[#FBFBFC] pb-24 font-sans overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {contentGrid}
      </div>
      {filterDrawer}
    </div>
  );
}
