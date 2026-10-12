import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useAuth } from '@/hooks/useAuth';
import { useListings } from '@/hooks/useListings';
import { useMatches, calculateProfileCompatibility } from '@/hooks/useMatches';
import { useGeocoding } from '@/hooks/useGeocoding';
import { useIsMobile } from '@/hooks/use-mobile';
import type { UserProfile } from '@/hooks/useAuth';
import type { Listing } from '@/hooks/useListings';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import {
  Search, Crosshair, Loader2, MapPin, Users, Home,
  ChevronUp, ChevronDown, X, List as ListIcon, Map as MapIcon, Check
} from 'lucide-react';
import StateEmpty from '@/components/StateEmpty';

// Fix leaflet icons
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import { resolveEntityCoordinates, isValidCoord } from '@/lib/locationResolver';
import { isPubliclyVisibleListing, isPubliclyVisibleProfile } from '@/lib/marketplaceVisibility';
L.Icon.Default.mergeOptions({ iconUrl, shadowUrl });

export interface MapPerson {
  type: 'person';
  uid: string;
  name: string;
  avatar: string;
  profession: string;
  role: 'seeker' | 'owner' | null;
  compatibility: number;
  lat: number;
  lng: number;
  city: string;
}

export interface MapRoom {
  type: 'room';
  id: string;
  title: string;
  locality: string;
  city: string;
  rent: number;
  image: string;
  ownerId: string;
  ownerName: string;
  lat: number;
  lng: number;
}

export type MapItem = MapPerson | MapRoom;

/** Location state that callers pass via navigate('/map', { state }) */
export interface MapViewState {
  mode?: 'people' | 'rooms';
  items?: MapItem[];
  initialCenter?: [number, number];
  sourceLabel?: string; // e.g. "Matches Near You", "Browse Rooms"
}

// Validate a coordinate pair (re-exported from locationResolver)
export { isValidCoord };

// Helper to calculate distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fit map to an array of items after they load
function FitBoundsOnLoad({ items, initialCenter }: { items: MapItem[]; initialCenter?: [number, number] | null }) {
  const map = useMap();
  const fittedRef = useRef(false);

  useEffect(() => {
    if (fittedRef.current) return;

    const validItems = items.filter(i => isValidCoord(i.lat, i.lng));

    if (validItems.length === 0) {
      // If caller provided a specific center, use it; otherwise don't move
      if (initialCenter && isValidCoord(initialCenter[0], initialCenter[1])) {
        map.setView(initialCenter, 12, { animate: false });
        fittedRef.current = true;
      }
      return;
    }

    if (validItems.length === 1) {
      map.setView([validItems[0].lat, validItems[0].lng], 14, { animate: false });
      fittedRef.current = true;
      return;
    }

    const latlngs = validItems.map(i => [i.lat, i.lng] as [number, number]);
    const bounds = L.latLngBounds(latlngs);
    try {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: false });
    } catch {
      // fitBounds can fail if bounds are degenerate — fall back to first item
      map.setView([validItems[0].lat, validItems[0].lng], 12, { animate: false });
    }
    fittedRef.current = true;
  }, [items, initialCenter, map]);

  return null;
}

// Map panner component (for user-driven panning, not initial fit)
function MapPanner({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!center || !isValidCoord(center[0], center[1])) return;
    map.flyTo(center, zoom, { duration: 1 });
  }, [center, zoom, map]);
  return null;
}

// Viewport tracker
function ViewportTracker({ onBoundsChange }: { onBoundsChange: (b: L.LatLngBounds) => void }) {
  const map = useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });
  useEffect(() => { onBoundsChange(map.getBounds()); }, [map, onBoundsChange]);
  return null;
}

// Leaflet resize invalidator — fixes mobile grey area and orientation changes
function LeafletResizeHandler() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const invalidate = () => { map.invalidateSize(); };
    invalidate();

    const timers = [
      setTimeout(invalidate, 50),
      setTimeout(invalidate, 200),
      setTimeout(invalidate, 500),
      setTimeout(invalidate, 1000),
    ];

    const container = map.getContainer();
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => { invalidate(); });
      observer.observe(container);
    }

    window.addEventListener('resize', invalidate);
    window.addEventListener('orientationchange', invalidate);

    return () => {
      timers.forEach(clearTimeout);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('orientationchange', invalidate);
    };
  }, [map]);

  return null;
}

export default function MapView() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { profile, user } = useAuth();
  const { getListings } = useListings();
  const { geocode } = useGeocoding();
  const isMobile = useIsMobile();

  // Read caller-provided context from location.state
  const incomingState = routerLocation.state as MapViewState | null;
  const hasIncomingItems = !!incomingState?.items && incomingState.items.length >= 0;

  const [mode, setMode] = useState<'people' | 'rooms'>(incomingState?.mode || 'people');
  const [items, setItems] = useState<MapItem[]>(
    // If caller passed items, use them immediately — skip Firestore fetch
    hasIncomingItems ? (incomingState!.items!.filter(i => isValidCoord(i.lat, i.lng))) : []
  );
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [legendFilter, setLegendFilter] = useState<'all' | 'rooms' | 'seekers' | 'high_compat'>('all');
  const [loading, setLoading] = useState(!hasIncomingItems);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [searchCenter, setSearchCenter] = useState<[number, number] | null>(null);
  // panTarget is only set when user explicitly clicks an item or searches; not on initial load
  const [panTarget, setPanTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [mapStyle, setMapStyle] = useState<'roadmap' | 'satellite'>('roadmap');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [mobileListView, setMobileListView] = useState(false);
  const [sortBy, setSortBy] = useState<'match' | 'distance' | 'newest'>('match');
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);

  // Source label from caller (e.g. "Matches Near You")
  const sourceLabel = incomingState?.sourceLabel;
  const initialCenter = incomingState?.initialCenter ?? null;

  // Fetch people data from Firestore
  const fetchPeople = useCallback(async () => {
    setLoading(true);
    setItems([]);
    try {
      let q;
      if (profile?.role === 'owner') {
        q = query(collection(db, 'users'), where('onboardingComplete', '==', true), where('role', '==', 'seeker'));
      } else {
        q = query(collection(db, 'users'), where('onboardingComplete', '==', true));
      }
      const snap = await getDocs(q);
      const people: MapPerson[] = [];
      snap.docs.forEach(d => {
        const data = d.data() as UserProfile;
        if (user?.uid && d.id === user.uid) return;

        // Sprint 2E hardening: shared visibility rule — demo, suspended/banned
        // and incomplete-onboarding profiles never appear on the map.
        if (!isPubliclyVisibleProfile({ ...data, uid: d.id })) return;

        // Resolve coordinates from geoLocation, lat/lng, or city/locality fallback
        const coords = resolveEntityCoordinates({
          id: d.id,
          uid: d.id,
          geoLocation: data.geoLocation,
          lat: (data as any).lat,
          lng: (data as any).lng,
          city: data.city,
          locality: data.locality,
          localities: data.localities,
        });

        if (!coords || !isValidCoord(coords.lat, coords.lng)) return;

        // Dynamic multi-factor compatibility
        const compat = profile
          ? calculateProfileCompatibility(profile, data).score
          : 0;
        people.push({
          type: 'person', uid: d.id, name: data.name || 'User', avatar: data.avatar || '',
          profession: data.profession || '', role: data.role, compatibility: compat,
          lat: coords.lat, lng: coords.lng, city: data.city || '',
        });
      });
      setItems(people);
    } catch (e) {
      console.error('MapView fetchPeople error:', e);
      setItems([]); // ensure empty state on error, not stale data
    } finally {
      setLoading(false); // ALWAYS clears loading — success, empty, or error
    }
  }, [user?.uid, profile]);

  // Fetch rooms data from Firestore
  const fetchRooms = useCallback(async () => {
    setLoading(true);
    setItems([]);
    try {
      const results = await getListings();

      // Sprint 2E hardening: ORPHAN POLICY — load real owner docs once so we
      // can hide listings whose owner document no longer exists (we never
      // fabricate an owner identity) and show the REAL owner name.
      const ownersSnap = await getDocs(collection(db, 'users'));
      const ownerDocs = new Map<string, UserProfile>(
        ownersSnap.docs.map(d => [d.id, { uid: d.id, ...d.data() } as UserProfile])
      );

      const rooms: MapRoom[] = [];
      results.forEach(l => {
        // Shared visibility rule — paused/stale/non-discoverable listings are hidden.
        if (!isPubliclyVisibleListing(l)) return;
        // Orphaned listing (no owner doc) — hidden per policy.
        if (!l.ownerId || !ownerDocs.has(l.ownerId)) return;
        const coords = resolveEntityCoordinates({
          id: l.id,
          lat: l.lat,
          lng: l.lng,
          city: l.city,
          locality: l.locality,
        });

        if (!coords || !isValidCoord(coords.lat, coords.lng)) return;

        rooms.push({
          type: 'room', id: l.id, title: l.title || `${l.locality}, ${l.city}`, locality: l.locality, city: l.city,
          rent: l.partnerShare || l.totalRent, image: l.images?.[0] || '',
          ownerId: l.ownerId, ownerName: ownerDocs.get(l.ownerId)?.name || l.ownerName || 'Owner',
          lat: coords.lat, lng: coords.lng,
        });
      });
      setItems(rooms);
    } catch (e) {
      console.error('MapView fetchRooms error:', e);
      setItems([]);
    } finally {
      setLoading(false); // ALWAYS clears loading — success, empty, or error
    }
  }, [getListings]);

  // skipFetchOnMount: one-shot flag — skip Firestore fetch ONLY on the very first
  // render when the caller already provided preloaded items. After that, every mode
  // change (including People↔Rooms toggle) ALWAYS triggers a real Firestore fetch.
  // This fixes the infinite-loading bug where handleModeChange set loading=true but
  // hasIncomingItems guard in the old useEffect prevented the fetch from ever running.
  const skipFetchOnMount = useRef(hasIncomingItems);

  useEffect(() => {
    if (skipFetchOnMount.current) {
      // First render with preloaded data — use it as-is, don't overwrite with Firestore fetch
      skipFetchOnMount.current = false; // reset: next mode change WILL fetch
      return;
    }
    setSelectedItem(null);
    if (mode === 'people') fetchPeople();
    else fetchRooms();
  }, [mode, fetchPeople, fetchRooms]);
  // NOTE: fetchPeople/fetchRooms are in deps (correct). They change when profile/auth
  // loads, which triggers a re-fetch with the correct role filter. This matches the
  // original MapView behavior and ensures authenticated users see role-filtered data.

  // Filter items within viewport and legend filter
  const handleBoundsChange = useCallback((b: L.LatLngBounds) => {
    setMapBounds(b);
  }, []);

  // visibleItems: applies legend filter then viewport clip.
  // legendFilter values:
  //   'all'         — show everything currently loaded (people OR rooms depending on mode)
  //   'rooms'       — keep only MapRoom items
  //   'seekers'     — keep only MapPerson items
  //   'high_compat' — keep only MapPerson items with compatibility >= 80
  // boundsKey dep ensures this recomputes when the map viewport moves.
  const visibleItems = useMemo(() => {
    let filtered = items;
    if (legendFilter === 'high_compat') {
      filtered = filtered.filter(i => i.type === 'person' && i.compatibility >= 80);
    } else if (legendFilter === 'seekers') {
      filtered = filtered.filter(i => i.type === 'person');
    } else if (legendFilter === 'rooms') {
      filtered = filtered.filter(i => i.type === 'room');
    }
    // Viewport clip: only show items inside current map bounds
    if (!mapBounds) return filtered;
    const b = mapBounds;
    return filtered.filter(i =>
      i.lat >= b.getSouth() && i.lat <= b.getNorth() &&
      i.lng >= b.getWest() && i.lng <= b.getEast()
    );
  }, [items, legendFilter, mapBounds]);

  // Sort sidebar items
  const sortedItems = useMemo(() => {
    const arr = [...visibleItems];
    const refPt = searchCenter || (profile?.geoLocation ? [profile.geoLocation.lat, profile.geoLocation.lng] as [number, number] : null);
    if (sortBy === 'distance' && refPt) {
      arr.sort((a, b) => haversine(refPt[0], refPt[1], a.lat, a.lng) - haversine(refPt[0], refPt[1], b.lat, b.lng));
    } else if (sortBy === 'match') {
      arr.sort((a, b) => {
        const ca = a.type === 'person' ? a.compatibility : 0;
        const cb = b.type === 'person' ? b.compatibility : 0;
        return cb - ca;
      });
    }
    return arr;
  }, [visibleItems, sortBy, searchCenter, profile]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const loc = await geocode(searchQuery.trim());
      if (loc) {
        setSearchCenter([loc.lat, loc.lng]);
        setPanTarget({ center: [loc.lat, loc.lng], zoom: 14 });
      } else { toast.error('Location not found'); }
    } catch { toast.error('Search failed'); }
    finally { setSearching(false); }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPanTarget({ center: c, zoom: 14 });
        setSearchCenter(c);
      },
      () => toast.error('Location access denied')
    );
  };

  const panToItem = (item: MapItem) => {
    setSelectedItem(item);
    setPanTarget({ center: [item.lat, item.lng], zoom: 15 });
    if (isMobile) setMobileListView(false);
  };

  const getDistance = (item: MapItem): string | null => {
    const refPt = searchCenter || (profile?.geoLocation ? [profile.geoLocation.lat, profile.geoLocation.lng] as [number, number] : null);
    if (!refPt) return null;
    const d = haversine(refPt[0], refPt[1], item.lat, item.lng);
    return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
  };

  const getPinColor = (item: MapItem): string => {
    if (item.type === 'person' && item.compatibility >= 80) return '#0D9488';
    if (item.type === 'person') return '#1E3A5F';
    return '#FF5A36';
  };

  // Sidebar card component
  const SidebarCard = ({ item }: { item: MapItem }) => {
    const dist = getDistance(item);
    return (
      <button onClick={() => panToItem(item)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-cream/50 transition-all text-left border border-transparent hover:border-border">
        <div className="w-10 h-10 rounded-full bg-cream overflow-hidden border border-border flex items-center justify-center shrink-0">
          {item.type === 'person' && item.avatar ? <img src={item.avatar} alt="" className="w-full h-full object-cover" /> :
            item.type === 'room' && item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" /> :
              <MapPin className="w-4 h-4 text-ink/30" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{item.type === 'person' ? item.name : item.title}</p>
          <p className="text-xs text-ink/50 truncate">
            {item.type === 'person' ? item.profession : `₹${item.rent?.toLocaleString()}/mo · ${item.locality}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          {item.type === 'person' && <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.compatibility >= 80 ? 'bg-teal/10 text-teal' : item.compatibility >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-ink/5 text-ink/40'}`}>{item.compatibility}%</span>}
          {item.type === 'room' && <span className="text-xs font-bold text-fire">₹{item.rent?.toLocaleString()}</span>}
          {dist && <p className="text-[10px] text-ink/40 mt-0.5">{dist} away</p>}
        </div>
      </button>
    );
  };

  // MOBILE: full-screen list view
  if (isMobile && mobileListView) {
    return (
      <div className="min-h-screen bg-parchment pt-[60px]">
        <div className="sticky top-[60px] z-20 bg-white border-b border-border p-3 flex items-center justify-between">
          <h2 className="font-semibold text-sm">
            {sourceLabel || (mode === 'people' ? 'People Near You' : 'Rooms Near You')} · {sortedItems.length}
          </h2>
          <button onClick={() => setMobileListView(false)} className="flex items-center gap-1 text-xs font-bold text-fire"><MapIcon className="w-4 h-4" /> Map</button>
        </div>
        <div className="p-3 space-y-1">
          {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 skeleton-shimmer rounded-xl" />) :
            sortedItems.length === 0 ? (
              <StateEmpty
                compact
                icon={MapPin}
                title={`No ${mode} with valid locations`}
                description="Try another location or switch mode"
              />
            ) :
              sortedItems.map(item => <SidebarCard key={item.type === 'person' ? item.uid : item.id} item={item} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-1 relative overflow-hidden max-w-full min-h-0">
      {/* Desktop Sidebar */}
      {!isMobile && sidebarOpen && (
        <div className="w-[320px] bg-white border-r border-border flex flex-col shrink-0 z-10">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="type-h3">
                  {sourceLabel || (mode === 'people' ? 'People Near You' : 'Rooms Near You')}
                </h2>
                {sourceLabel && (
                  <p className="text-[10px] text-ink/40 mt-0.5">Showing results from {sourceLabel}</p>
                )}
              </div>
              <span className="text-xs font-bold text-ink/40">{sortedItems.length} found</span>
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)} className="w-full bg-cream/50 border border-border rounded-lg px-3 py-1.5 text-xs outline-none focus:border-fire">
              <option value="match">Best Match</option>
              <option value="distance">Distance</option>
              <option value="newest">Newest</option>
            </select>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 skeleton-shimmer rounded-xl" />) :
              sortedItems.length === 0 ? (
                <div className="p-4">
                  <StateEmpty
                    compact
                    icon={MapPin}
                    title={`No ${mode} with location data`}
                    description="Try the search bar to explore a specific area"
                  />
                </div>
              ) : sortedItems.map(item => <SidebarCard key={item.type === 'person' ? item.uid : item.id} item={item} />)}
          </div>
        </div>
      )}

      {/* Map Area */}
      <div className="flex-1 relative z-0 w-full h-full min-w-0">
        {/* Top Controls */}
        <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-4 sm:left-4 sm:right-4 z-[1000] flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-2 pointer-events-none">
          {/* Mode Toggle */}
          <div className="bg-white rounded-full shadow-lg p-0.5 sm:p-1 flex pointer-events-auto border border-border shrink-0">
            <button onClick={() => setMode('people')} className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 ${mode === 'people' ? 'bg-fire text-white shadow-sm' : 'text-ink/60 hover:text-ink'}`}><Users className="w-3.5 h-3.5" /> People</button>
            <button onClick={() => setMode('rooms')} className={`px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1 sm:gap-1.5 ${mode === 'rooms' ? 'bg-fire text-white shadow-sm' : 'text-ink/60 hover:text-ink'}`}><Home className="w-3.5 h-3.5" /> Rooms</button>
          </div>

          {/* Search */}
          {isMobile && !searchExpanded ? (
            <button onClick={() => setSearchExpanded(true)} aria-label="Search location" className="w-11 h-11 sm:w-10 sm:h-10 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-auto border border-border shrink-0"><Search className="w-4 h-4 text-ink/60" /></button>
          ) : (
            <div className="w-full sm:flex-1 flex bg-white rounded-full shadow-lg overflow-hidden pointer-events-auto border border-border order-last sm:order-none mt-1 sm:mt-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search area, landmark..." className="w-full pl-9 pr-2 py-2 text-xs sm:text-sm outline-none bg-transparent" />
              </div>
              {searching ? <div className="px-3 flex items-center"><Loader2 className="w-4 h-4 animate-spin text-fire" /></div> :
                searchQuery && <button onClick={() => { setSearchQuery(''); setSearchCenter(null); }} aria-label="Clear search" className="px-2 text-ink/40 hover:text-ink"><X className="w-4 h-4" /></button>}
              {isMobile && <button onClick={() => { setSearchExpanded(false); setSearchQuery(''); }} className="px-3 text-xs font-bold text-fire">Close</button>}
            </div>
          )}

          {/* Map Layer Switcher */}
          <div className="bg-white rounded-full shadow-lg p-0.5 sm:p-1 flex pointer-events-auto border border-border shrink-0">
            <button
              onClick={() => setMapStyle(mapStyle === 'satellite' ? 'roadmap' : 'satellite')}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${mapStyle === 'satellite' ? 'bg-navy text-white shadow-sm' : 'text-ink/70 hover:text-ink'
                }`}
            >
              {mapStyle === 'satellite' ? 'Map' : 'Satellite'}
            </button>
          </div>

          {/* Locate Me */}
          <button onClick={handleLocateMe} aria-label="My location" title="My location" className="w-11 h-11 sm:w-10 sm:h-10 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-auto border border-border hover:border-fire transition-colors">
            <Crosshair className="w-4 h-4 text-ink/60" />
          </button>

          {/* Desktop sidebar toggle */}
          {!isMobile && (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-auto border border-border hover:border-fire transition-colors shrink-0">
              <ListIcon className="w-4 h-4 text-ink/60" />
            </button>
          )}
        </div>

        {/* Interactive Legend & Category Filter */}
        {!selectedItem && (
          <div className="absolute bottom-4 left-3 z-[900] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl p-2.5 sm:p-3 border border-border pointer-events-auto max-w-[210px] sm:max-w-none transition-all">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[10px] font-bold text-ink/50 uppercase tracking-wider">Legend & Filters</span>
              {legendFilter !== 'all' && (
                <button onClick={() => setLegendFilter('all')} className="text-[10px] font-bold text-fire hover:underline">Reset</button>
              )}
            </div>
            <div className="space-y-1">
              {/* Rooms available — pure filter on current items, no re-fetch */}
              <button
                onClick={() => {
                  const next = legendFilter === 'rooms' ? 'all' : 'rooms';
                  setLegendFilter(next);
                  toast.info(next === 'all' ? 'Showing all markers' : 'Showing: Rooms only');
                }}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-left transition-all ${legendFilter === 'rooms'
                  ? 'bg-fire/10 text-fire font-bold ring-1 ring-fire/30'
                  : 'hover:bg-cream/60 text-ink/80'
                  }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full bg-fire border border-white shadow-sm shrink-0" />
                  <span className="text-[11px] truncate">Rooms available</span>
                </div>
                {legendFilter === 'rooms' && <Check className="w-3 h-3 font-bold text-fire shrink-0" aria-hidden="true" />}
              </button>

              {/* Seekers looking — pure filter on current items, no re-fetch */}
              <button
                onClick={() => {
                  const next = legendFilter === 'seekers' ? 'all' : 'seekers';
                  setLegendFilter(next);
                  toast.info(next === 'all' ? 'Showing all markers' : 'Showing: Seekers only');
                }}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-left transition-all ${legendFilter === 'seekers'
                  ? 'bg-navy/10 text-navy font-bold ring-1 ring-navy/30'
                  : 'hover:bg-cream/60 text-ink/80'
                  }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full bg-[#1E3A5F] border border-white shadow-sm shrink-0" />
                  <span className="text-[11px] truncate">Seekers looking</span>
                </div>
                {legendFilter === 'seekers' && <Check className="w-3 h-3 font-bold text-navy shrink-0" aria-hidden="true" />}
              </button>

              {/* High compatibility — pure filter on current people items, no re-fetch */}
              <button
                onClick={() => {
                  const next = legendFilter === 'high_compat' ? 'all' : 'high_compat';
                  setLegendFilter(next);
                  toast.info(next === 'all' ? 'Showing all markers' : 'Showing: High compatibility (80%+)');
                }}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-left transition-all ${legendFilter === 'high_compat'
                  ? 'bg-teal/10 text-teal font-bold ring-1 ring-teal/30'
                  : 'hover:bg-cream/60 text-ink/80'
                  }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full bg-teal border border-white shadow-sm shrink-0" />
                  <span className="text-[11px] truncate">High compat (80%+)</span>
                </div>
                {legendFilter === 'high_compat' && <Check className="w-3 h-3 font-bold text-teal shrink-0" aria-hidden="true" />}
              </button>

              {/* Your location */}
              <button
                onClick={() => handleLocateMe()}
                className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-left hover:bg-cream/60 transition-all text-ink/80"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-3 h-3 rounded-full bg-ink border-2 border-white shadow-sm shrink-0" />
                  <span className="text-[11px] truncate">Your location</span>
                </div>
                <span className="text-[10px] text-fire font-bold">Center</span>
              </button>
            </div>
          </div>
        )}

        {/* Mobile bottom list toggle */}
        {isMobile && !selectedItem && (
          <div className="absolute bottom-4 right-3 z-[900]">
            <button onClick={() => setMobileListView(true)} className="bg-white rounded-full shadow-lg px-4 py-2.5 flex items-center gap-2 border border-border text-xs font-bold text-ink/70 hover:text-fire transition-colors">
              <ListIcon className="w-4 h-4" /> List ({sortedItems.length})
            </button>
          </div>
        )}

        {/* Mobile floating selected item card */}
        {isMobile && selectedItem && !mobileListView && (
          <div className="absolute bottom-4 left-3 right-3 z-[1001] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-border flex flex-col gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-11 h-11 rounded-full bg-cream overflow-hidden border border-border shrink-0 flex items-center justify-center">
                  {selectedItem.type === 'person' && selectedItem.avatar ? <img src={selectedItem.avatar} alt="" className="w-full h-full object-cover" /> :
                    selectedItem.type === 'room' && selectedItem.image ? <img src={selectedItem.image} alt="" className="w-full h-full object-cover" /> :
                      <MapPin className="w-4 h-4 text-ink/30" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-ink truncate">{selectedItem.type === 'person' ? selectedItem.name : selectedItem.title}</h4>
                    {selectedItem.type === 'person' && selectedItem.compatibility > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${selectedItem.compatibility >= 80 ? 'bg-teal/10 text-teal' : 'bg-ink/5 text-ink/60'}`}>{selectedItem.compatibility}% Match</span>
                    )}
                  </div>
                  <p className="text-xs text-ink/60 truncate mt-0.5">
                    {selectedItem.type === 'person' ? selectedItem.profession || 'Seeker' : `₹${selectedItem.rent?.toLocaleString()}/mo · ${selectedItem.locality}, ${selectedItem.city}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-1 text-ink/40 hover:text-ink rounded-full shrink-0"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-border/60">
              <button
                onClick={() => navigate(selectedItem.type === 'person' ? `/match/${selectedItem.uid}` : `/room/${selectedItem.id}`)}
                className="w-full py-2 bg-fire text-white rounded-xl text-xs font-bold shadow-xs hover:bg-fire-dark transition-all text-center"
              >
                View {selectedItem.type === 'person' ? 'Profile' : 'Room Listing'} →
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur rounded-full shadow-lg px-4 py-2 flex items-center gap-2 border border-border">
            <Loader2 className="w-4 h-4 animate-spin text-fire" />
            <span className="text-xs font-medium text-ink/60">Loading map data...</span>
          </div>
        )}

        {/* THE MAP */}
        <MapContainer
          center={[20.5937, 78.9629]} // India center — immediately replaced by FitBoundsOnLoad
          zoom={5}
          scrollWheelZoom={true}
          touchZoom={true}
          dragging={true}
          doubleClickZoom={true}
          bounceAtZoomLimits={true}
          className="w-full h-full"
          zoomControl={false}
        >
          <LeafletResizeHandler />
          <TileLayer
            key={mapStyle}
            attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
            url={
              mapStyle === 'satellite'
                ? 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
                : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
            }
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
            maxZoom={20}
          />

          {/* FIT BOUNDS — fires once when items load, auto-centers map on real data */}
          <FitBoundsOnLoad items={items} initialCenter={initialCenter} />

          {/* User-driven panning (search / item click) */}
          {panTarget && <MapPanner center={panTarget.center} zoom={panTarget.zoom} />}

          <ViewportTracker onBoundsChange={handleBoundsChange} />

          {/* Distance rings around search center */}
          {searchCenter && (
            <>
              <Circle center={searchCenter} radius={2000} pathOptions={{ color: '#FF5A36', weight: 1, dashArray: '6 4', fillColor: '#FF5A36', fillOpacity: 0.04 }} />
              <Circle center={searchCenter} radius={5000} pathOptions={{ color: '#FF5A36', weight: 1, dashArray: '6 4', fillColor: '#FF5A36', fillOpacity: 0.02 }} />
            </>
          )}

          {/* User's own location pin with clear styling and popup */}
          {(() => {
            const userCoords = profile ? resolveEntityCoordinates({
              uid: profile.uid,
              geoLocation: profile.geoLocation,
              city: profile.city,
              locality: profile.localities?.[0] || profile.locality,
            }) : null;

            if (!userCoords || !isValidCoord(userCoords.lat, userCoords.lng)) return null;

            return (
              <CircleMarker
                center={[userCoords.lat, userCoords.lng]}
                radius={10}
                pathOptions={{ color: '#FF5A36', weight: 3, fillColor: '#1E3A5F', fillOpacity: 1 }}
              >
                <Popup className="match-popup">
                  <div className="p-1 text-center font-bold text-xs">
                    Your Location ({profile?.city || 'Current User'})
                  </div>
                </Popup>
              </CircleMarker>
            );
          })()}

          {/* BUG FIX: Render visibleItems (respects legend filter) — NOT items (which ignores filter) */}
          {visibleItems.map(item => {
            const key = item.type === 'person' ? item.uid : item.id;
            const color = getPinColor(item);
            const isSelected = selectedItem && (selectedItem.type === 'person' ? selectedItem.uid : selectedItem.id) === key;
            return (
              <CircleMarker
                key={key}
                center={[item.lat, item.lng]}
                radius={isMobile ? 12 : 8}
                pathOptions={{
                  color: isSelected ? '#121217' : 'white',
                  weight: isSelected ? 4 : (isMobile ? 3 : 2),
                  fillColor: color,
                  fillOpacity: 1
                }}
                eventHandlers={{
                  click: () => {
                    setSelectedItem(item);
                    setPanTarget({ center: [item.lat, item.lng], zoom: 15 });
                  }
                }}
              >
                <Popup
                  className="match-popup"
                  autoPan={true}
                  autoPanPadding={isMobile ? [60, 20] : [20, 20]}
                  keepInView={true}
                >
                  <div className="flex flex-col gap-2 min-w-[160px] p-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-cream overflow-hidden border border-border flex items-center justify-center shrink-0">
                        {item.type === 'person' && item.avatar ? <img src={item.avatar} className="w-full h-full object-cover" alt="" /> :
                          item.type === 'room' && item.image ? <img src={item.image} className="w-full h-full object-cover" alt="" /> :
                            <MapPin className="w-3 h-3 text-ink/30" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm leading-tight truncate">{item.type === 'person' ? item.name : item.title}</p>
                        <p className="text-[10px] text-ink/50 truncate">{item.type === 'person' ? item.profession : `${item.locality}, ${item.city}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      {item.type === 'person' ? (
                        item.compatibility > 0 ? (
                          <span className="badge-teal text-[10px]">{item.compatibility}% match</span>
                        ) : (
                          <span className="text-[10px] text-ink/40 font-medium">Seeker</span>
                        )
                      ) : (
                        <span className="text-xs font-bold text-fire">₹{item.rent?.toLocaleString()}/mo</span>
                      )}
                      {/* Marker → entity navigation uses canonical uid / listing id */}
                      <button
                        onClick={() => navigate(item.type === 'person' ? `/match/${item.uid}` : `/room/${item.id}`)}
                        className="text-xs text-fire font-medium hover:underline"
                      >
                        View →
                      </button>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
