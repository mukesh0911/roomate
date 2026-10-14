import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile } from '@/hooks/useAuth';
import { calculateProfileCompatibility } from '@/hooks/useMatches';
import { useChat } from '@/hooks/useChat';
import { useConnections, getRelationshipState } from '@/hooks/useConnections';
import type { Connection } from '@/hooks/useConnections';
import {
  MapPin, Loader2, MessageSquare, Users, Phone, Star, Sparkles
} from 'lucide-react';
import StateEmpty from '@/components/StateEmpty';
import StateLoading from '@/components/StateLoading';
import { useStore } from '@/store/useStore';
import { toast } from 'sonner';
import { isPubliclyVisibleProfile } from '@/lib/marketplaceVisibility';
import { areSameCityAlias } from '@/lib/cityNormalization';
import { isRoommateDiscoverable } from '@/lib/profileEligibility';
import FlatmateAvatar from '@/components/FlatmateAvatar';
import ContactModal from '@/components/ContactModal';
import { getUserIntent, getPreferredRoommateGender } from '@/lib/userIntent';

interface SeekerWithScore {
  profile: UserProfile;
  score: number | null;
  distanceKm?: number;
}

interface BrowseSeekersProps {
  embedded?: boolean;
  city?: string;
  searchQuery?: string;
  onOpenFilters?: () => void;
}

export default function BrowseSeekers({
  embedded = false,
  city: propCity,
  searchQuery: propSearchQuery = '',
  onOpenFilters,
}: BrowseSeekersProps) {
  const navigate = useNavigate();
  const { user, profile: currentUser } = useAuth();
  const { getOrCreateChatRoom, subscribeToChatRooms } = useChat();
  const { sendRequest, acceptRequest, subscribeToMyConnections } = useConnections();
  const openAuthModal = useStore(state => state.openAuthModal);

  const [seekers, setSeekers] = useState<SeekerWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [connectingTo, setConnectingTo] = useState<string | null>(null);
  const [myConnections, setMyConnections] = useState<Connection[]>([]);
  const [chatRoomMap, setChatRoomMap] = useState<Record<string, string>>({});
  const [contactProfile, setContactProfile] = useState<UserProfile | null>(null);

  const activeCity = propCity !== undefined ? propCity : (currentUser?.city || useStore.getState().filters.city || '');

  useEffect(() => {
    if (!user?.uid) return;
    const unsub1 = subscribeToMyConnections(user.uid, setMyConnections);
    const unsub2 = subscribeToChatRooms(user.uid, (rooms) => {
      const map: Record<string, string> = {};
      rooms.forEach(r => {
        const other = r.participants.find(p => p !== user.uid);
        if (other) map[other] = r.id;
      });
      setChatRoomMap(map);
    });
    return () => { unsub1(); unsub2(); };
  }, [subscribeToChatRooms, subscribeToMyConnections, user?.uid]);

  useEffect(() => {
    async function fetchFlatmates() {
      setLoading(true);
      setFetchError(false);
      try {
        const profileMap = new Map<string, UserProfile>();

        try {
          const snap = await getDocs(collection(db, 'users'));
          snap.docs.forEach(d => {
            const data = { uid: d.id, ...d.data() } as UserProfile;
            // Exclude current user and blocked users
            if (data.uid && data.uid === user?.uid) return;
            if (currentUser?.blockedUserIds?.includes(data.uid)) return;

            // Allow valid profile
            if (isPubliclyVisibleProfile(data)) {
              profileMap.set(data.uid, data);
            }
          });
        } catch (err) {
          console.warn('Firestore users query warning:', err);
        }



        // Listing data can enrich an explicitly discoverable member card, but
        // a listing never makes its owner discoverable by itself.
        const listingByOwnerId = new Map<string, any>();
        try {
          const lsnap = await getDocs(query(collection(db, 'listings'), where('status', '==', 'active')));
          lsnap.docs.forEach(d => {
            const data: any = { id: d.id, ...d.data() };
            if (data.ownerId && !listingByOwnerId.has(data.ownerId)) {
              listingByOwnerId.set(data.ownerId, data);
            }
          });
        } catch (e) {
          console.warn('Error fetching listings for flatmate discovery:', e);
        }

        const fetched = Array.from(profileMap.values()).filter(profile => isRoommateDiscoverable(profile));

        // Match against active city strictly (real users only in chosen city)
        const targetCity = activeCity.trim().toLowerCase();
        const isAllCities = !targetCity || targetCity === 'all';
        const cityMatches = isAllCities
          ? fetched
          : fetched.filter(r => {
              const profileCity = (r.city || '').trim().toLowerCase();
              return Boolean(profileCity && (profileCity === targetCity || areSameCityAlias(profileCity, targetCity)));
            });

        const effectivePool = cityMatches;

        // Apply search query
        const q = propSearchQuery.trim().toLowerCase();
        const filtered = q
          ? effectivePool.filter(r =>
              (r.locality && r.locality.toLowerCase().includes(q)) ||
              (r.name && r.name.toLowerCase().includes(q)) ||
              (r.profession && r.profession.toLowerCase().includes(q)) ||
              (r.city && r.city.toLowerCase().includes(q)) ||
              (r.bio && r.bio.toLowerCase().includes(q))
            )
          : effectivePool;

        let ownerListing: any = null;
        if (user?.uid) {
          try {
            const lq = query(collection(db, 'listings'), where('ownerId', '==', user.uid), limit(1));
            const lsnap = await getDocs(lq);
            if (!lsnap.empty) {
              ownerListing = { id: lsnap.docs[0].id, ...lsnap.docs[0].data() };
            }
          } catch (e) {
            console.warn('Error fetching owner listing for scoring', e);
          }
        }

        const scored = filtered.map(u => {
          const uListing = listingByOwnerId.get(u.uid);
          const effectiveProfile = { ...u };
          if (uListing) {
            effectiveProfile.budget = effectiveProfile.budget || uListing.partnerShare || uListing.totalRent || effectiveProfile.budget;
            (effectiveProfile as any)._listing = uListing;
          }
          const targetListing = ownerListing || uListing;
          const calculatedScore = currentUser
            ? calculateProfileCompatibility(currentUser, effectiveProfile, targetListing).score
            : null;

          const distanceKm = (u as any).distanceKm !== undefined ? (u as any).distanceKm : 0;

          return {
            profile: effectiveProfile,
            score: calculatedScore,
            distanceKm
          };
        });

        // Sort by verified first, then real calculated score
        scored.sort((a, b) => {
          const aVer = a.profile.isVerified ? 1 : 0;
          const bVer = b.profile.isVerified ? 1 : 0;
          if (bVer !== aVer) return bVer - aVer;
          return (b.score ?? 0) - (a.score ?? 0);
        });

        setSeekers(scored);
      } catch (err) {
        console.error('Failed to fetch flatmates', err);
        setFetchError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchFlatmates();
  }, [currentUser, activeCity, propSearchQuery, user?.uid]);

  const handleConnect = async (seekerId: string) => {
    if (!user?.uid) {
      openAuthModal({
        title: 'Sign in to Connect',
        subtitle: 'Create an account to send connect requests and chat with roommates.',
        redirect: `/match/${seekerId}`,
      });
      return;
    }
    const state = getRelationshipState(user.uid, seekerId, myConnections, chatRoomMap);
    if (state === 'pending_sent') return;

    setConnectingTo(seekerId);
    try {
      if (state === 'connected' || chatRoomMap[seekerId]) {
        const roomId = chatRoomMap[seekerId] || (await getOrCreateChatRoom(user.uid, seekerId));
        navigate(`/chat/${roomId}`);
      } else if (state === 'pending_received') {
        const conn = myConnections.find(c => c.fromUserId === seekerId && c.toUserId === user.uid);
        if (conn) await acceptRequest(conn.id);
        const roomId = await getOrCreateChatRoom(user.uid, seekerId);
        navigate(`/chat/${roomId}`);
      } else {
        await sendRequest(user.uid, seekerId);
        toast.success("Connect request sent!");
      }
    } catch (err) {
      console.error("Failed to connect", err);
      toast.error("Failed to send request. Try again.");
    } finally {
      setConnectingTo(null);
    }
  };

  const handleCall = (profile: UserProfile) => {
    if (!user?.uid) {
      openAuthModal({
        title: 'Sign in to Contact',
        subtitle: 'Sign in to view verified contact numbers and reach out to roommates.',
        redirect: `/match/${profile.uid}`,
      });
      return;
    }
    setContactProfile(profile);
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <StateLoading label="Finding compatible roommates..." />
      </div>
    );
  }

  if (fetchError) {
    return (
      <StateEmpty
        icon={Users}
        title="Unable to load roommates"
        description="We couldn't load roommate profiles right now. Please check your connection and try again."
        className="bg-white rounded-3xl border border-gray-100 py-12 shadow-xs"
      />
    );
  }

  if (seekers.length === 0) {
    return (
      <StateEmpty
        icon={Users}
        title={propSearchQuery ? `No roommates match "${propSearchQuery}" in ${activeCity}` : `No roommates looking in ${activeCity} yet`}
        description={
          propSearchQuery
            ? "Try broadening your search or exploring nearby localities."
            : `Be the first to find a roommate in ${activeCity}! Create your roommate profile to get discovered.`
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (!user) {
                  openAuthModal({ title: 'Join NestMate', redirect: '/profile' });
                } else {
                  navigate('/profile');
                }
              }}
              className="px-6 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-xs rounded-full shadow-xs cursor-pointer transition-colors"
            >
              Create Roommate Profile
            </button>
            {activeCity && (
              <button
                type="button"
                onClick={() => {
                  useStore.getState().updateFilters({ city: '' });
                }}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#1E2229] font-semibold text-xs rounded-full cursor-pointer transition-colors"
              >
                Browse All Cities
              </button>
            )}
          </div>
        }
        className="bg-white rounded-3xl border border-gray-100 py-14 shadow-xs max-w-xl mx-auto"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
      {/* RESPONSIVE FEED: 1 COL ON MOBILE, 2 COLS ON DESKTOP (MATCHING FLATMATE EXACT LAYOUT) */}
      {seekers.map(({ profile, score, distanceKm }) => {
        const state = getRelationshipState(user?.uid, profile.uid || '', myConnections, chatRoomMap);
        const localityText = profile.locality
          ? (profile.city ? `${profile.locality}, ${profile.city}` : profile.locality)
          : (profile.city ? `${profile.city}, India` : `${activeCity}, India`);

        const budgetText = profile.budget && profile.budget > 0
          ? `₹ ${profile.budget.toLocaleString('en-IN')}`
          : '₹ 5,000';

        // Truthful Intent and Preferred Roommate Resolution
        const intent = getUserIntent(profile, (profile as any)._listing);
        const preferredGender = getPreferredRoommateGender(profile, (profile as any)._listing);

        const distanceDisplay = distanceKm !== undefined
          ? `${distanceKm} km`
          : '0 km';

        return (
          <div
            key={profile.uid}
            onClick={() => navigate(`/match/${profile.uid}`)}
            className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer group"
          >
            {/* Upper Section: Avatar on Left, Details on Right */}
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Left Avatar Container */}
              <FlatmateAvatar
                avatar={profile.avatar}
                name={profile.name}
                gender={profile.gender}
                isVerified={profile.isVerified}
                illustrationType={(profile as any).illustrationType}
                className="group-hover:opacity-95 transition-opacity"
              />

              {/* Right Details Column */}
              <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                <div>
                  {/* Semantic Intent Badge */}
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${
                        intent.badgeVariant === 'room_available'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                          : intent.badgeVariant === 'owner'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200/80'
                            : 'bg-orange-50 text-[#FF5A36] border border-orange-200/80'
                      }`}
                    >
                      {intent.badgeText}
                    </span>
                  </div>

                  {/* Name - line-clamp-2 prevents awkward clipping */}
                  <h3 className="font-semibold text-sm sm:text-base text-[#1E2229] group-hover:text-[#FF5A36] transition-colors line-clamp-2 leading-snug">
                    {profile.name || 'Roommate'}
                  </h3>

                  {/* Location with Pin */}
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-normal mt-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{localityText}</span>
                  </div>

                  {/* Financial: Truthful Budget vs Rent */}
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="text-base sm:text-lg font-bold text-[#1E2229]">
                      {budgetText}
                    </span>
                    <span className="text-xs font-normal text-slate-500">
                      {intent.priceLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      /{intent.priceSubtext}
                    </span>
                  </div>
                </div>

                {/* 2-Column Info Grid: Requirement (A Room / Roommate) | Preferred Roommate Gender */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100/90 text-left">
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 font-medium block">
                      {intent.requirementLabel}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-[#1E2229] block mt-0.5">
                      {intent.requirementValue}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[11px] text-slate-400 font-medium block" title="Roommate Preference">
                      {intent.preferenceLabel}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-[#1E2229] block mt-0.5">
                      {preferredGender.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Dashed Divider + Search Distance + Match + Two Circular Action Buttons */}
            <div className="border-t border-dashed border-gray-200/80 mt-3 pt-2.5 flex items-center justify-between gap-2">
              {/* Distance from search - whitespace-nowrap prevents truncation */}
              <div className="text-xs text-slate-500 font-normal whitespace-nowrap shrink-0">
                <span>{distanceDisplay} from search</span>
              </div>

              {/* Match Score & Action Buttons */}
              <div className="flex items-center gap-2.5 shrink-0">
                {/* Match Score: Real dynamic score when logged in; sign-in prompt when guest */}
                {currentUser ? (
                  score !== null && score > 0 ? (
                    <div className="flex items-center gap-1 text-xs font-medium text-slate-600">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                      <span>{score}% Match</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-normal">New Profile</span>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAuthModal({
                        title: 'Check Compatibility',
                        subtitle: 'Sign in to see your personalized compatibility score with this profile.',
                        redirect: `/match/${profile.uid}`,
                      });
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-[#FF5A36] transition-colors cursor-pointer"
                    title="Sign in to calculate personalized compatibility"
                  >
                    <Sparkles className="w-3 h-3 text-[#FF5A36]" />
                    <span>Sign in to match</span>
                  </button>
                )}

                {/* Action Button: [ 💬 ] */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>

                  {/* Chat Button */}
                  <button
                    type="button"
                    onClick={() => handleConnect(profile.uid || '')}
                    disabled={connectingTo === profile.uid}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-500 hover:text-[#1E2229] hover:border-slate-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95"
                    title="Chat"
                    aria-label={`Chat with ${profile.name}`}
                  >
                    {connectingTo === profile.uid ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5 text-slate-500 stroke-[1.8]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Call / Contact Modal */}
      <ContactModal
        isOpen={Boolean(contactProfile)}
        onClose={() => setContactProfile(null)}
        profile={contactProfile}
      />
    </div>
  );
}
