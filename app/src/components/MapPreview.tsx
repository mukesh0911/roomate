import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { MapPin, Loader2 } from 'lucide-react';
import { useGeocoding } from '@/hooks/useGeocoding';
import type { MatchedUser } from '@/hooks/useMatches';
import type { UserProfile } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import type { MapItem } from '@/pages/MapView';
import { resolveEntityCoordinates } from '@/lib/locationResolver';

// Helper to handle dynamic container resizing for Leaflet maps
function LeafletResizeHandler() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const invalidate = () => map.invalidateSize();
    invalidate();
    const timers = [setTimeout(invalidate, 50), setTimeout(invalidate, 300), setTimeout(invalidate, 600)];
    const container = map.getContainer();
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => invalidate());
      observer.observe(container);
    }
    return () => {
      timers.forEach(clearTimeout);
      if (observer) observer.disconnect();
    };
  }, [map]);
  return null;
}


// Fix leaflet icon
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl,
  shadowUrl,
});

interface MapPreviewProps {
  currentUser: UserProfile;
  topMatches: MatchedUser[];
}

function toLatLng(location: { lat: number; lng: number } | { lat: number; lng: number; formattedAddress?: string } | null | undefined) {
  if (!location) return null;
  return { lat: location.lat, lng: location.lng };
}

export function MapPreview({ currentUser, topMatches }: MapPreviewProps) {
  const navigate = useNavigate();
  const { geocodeAndSave, isGeocoding } = useGeocoding();
  const initialResolvedUser = resolveEntityCoordinates({
    uid: currentUser.uid,
    geoLocation: currentUser.geoLocation,
    city: currentUser.city,
    locality: currentUser.locality || currentUser.localities?.[0],
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(initialResolvedUser);
  const [matchLocations, setMatchLocations] = useState<Record<string, { lat: number; lng: number }>>({});
  const [isIntersecting, setIsIntersecting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Lazy load intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsIntersecting(true);
      },
      { threshold: 0.1 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Process geocoding sequentially when visible
  useEffect(() => {
    if (!isIntersecting) return;

    let mounted = true;

    const processGeocoding = async () => {
      // 1. Current user
      if (!userLocation && currentUser.city) {
        const loc = await geocodeAndSave('user', currentUser.uid!, currentUser.city, currentUser.localities?.[0]);
        if (mounted && loc) setUserLocation(loc);
      }

      // 2. Top matches (up to 5)
      const matchesToProcess = topMatches.slice(0, 5);
      const newMatchLocs = { ...matchLocations };

      for (const match of matchesToProcess) {
        if (!mounted) break;
        const p = match.profile;
        if (p.geoLocation) {
          const normalizedLocation = toLatLng(p.geoLocation);
          if (!newMatchLocs[p.uid!]) {
            if (!normalizedLocation) {
              continue;
            }
            newMatchLocs[p.uid!] = normalizedLocation;
            setMatchLocations(prev => ({ ...prev, [p.uid!]: normalizedLocation }));
          }
        } else if (p.city && !newMatchLocs[p.uid!]) {
          const loc = await geocodeAndSave('user', p.uid!, p.city, p.localities?.[0]);
          if (loc && mounted) {
            const normalizedLocation = toLatLng(loc);
            if (!normalizedLocation) {
              continue;
            }
            newMatchLocs[p.uid!] = normalizedLocation;
            setMatchLocations(prev => ({ ...prev, [p.uid!]: normalizedLocation }));
          }
        }
      }
    };

    processGeocoding();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIntersecting, currentUser, topMatches]);

  // If no location after trying, show empty state
  const hasAttemptedUserLocation = isIntersecting && !isGeocoding && !userLocation && !currentUser.geoLocation;

  if (hasAttemptedUserLocation) {
    return (
      <div ref={containerRef} className="card-nestmate p-6 text-center mt-5 mb-5 border-2 border-dashed border-ink/10">
        <div className="w-16 h-16 bg-ink/5 rounded-full flex items-center justify-center mx-auto mb-4">
          <MapPin className="w-8 h-8 text-ink/20" />
        </div>
        <h3 className="type-h3 mb-2">Add your location to see matches on the map</h3>
        <p className="text-sm text-ink/50 mb-6">Update your city and locality in your profile</p>
        <button onClick={() => navigate('/edit-profile')} className="btn-outline text-sm">
          Update Location
        </button>
      </div>
    );
  }

  // We need userLocation to center the map
  if (!userLocation) {
    return (
      <div ref={containerRef} className="card-nestmate p-6 mt-5 mb-5 flex items-center justify-center h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-fire animate-spin" />
          <p className="text-sm text-ink/50">Finding match locations...</p>
        </div>
      </div>
    );
  }

  const activeMatches = topMatches.slice(0, 5).map(m => {
    const loc = matchLocations[m.profile.uid!] || resolveEntityCoordinates({
      uid: m.profile.uid,
      geoLocation: m.profile.geoLocation,
      city: m.profile.city,
      locality: m.profile.locality || m.profile.localities?.[0],
    });
    return loc ? { match: m, loc } : null;
  }).filter(Boolean) as { match: MatchedUser; loc: { lat: number; lng: number } }[];

  return (
    <div ref={containerRef} className="card-nestmate p-6 mt-5 mb-5 bg-white rounded-[22px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-6 h-6 text-fire" />
          <h2 className="text-xl font-bold">Matches Near You</h2>
        </div>
        {!isMobile && (
          <button
            onClick={() => {
              // Build normalized MapItem[] for MapView — passes current match dataset so /map shows exactly these users
              const mapItems: MapItem[] = activeMatches
                .map(({ match, loc }) => {
                  return {
                    type: 'person' as const,
                    uid: match.profile.uid!,
                    name: match.profile.name || 'User',
                    avatar: match.profile.avatar || '',
                    profession: match.profile.profession || '',
                    role: match.profile.role,
                    compatibility: match.compatibilityScore,
                    lat: loc.lat,
                    lng: loc.lng,
                    city: match.profile.city || '',
                  };
                });
              navigate('/map', {
                state: {
                  mode: 'people',
                  items: mapItems,
                  initialCenter: userLocation ? [userLocation.lat, userLocation.lng] as [number, number] : undefined,
                  sourceLabel: 'Matches Near You',
                },
              });
            }}
            className="text-sm font-semibold text-fire border border-fire px-4 py-2 rounded-xl hover:bg-fire/5 transition-colors shrink-0"
          >
            View Full Map &rarr;
          </button>
        )}
      </div>

      {isMobile ? (
        <>
          <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x -mx-6 px-6">
            {activeMatches.map(({ match, loc }) => {
              return (
                <div key={match.profile.uid} className="snap-center shrink-0 w-[280px] bg-parchment rounded-[16px] overflow-hidden border border-border">
                  <div className="h-[180px] bg-ink/5 relative pointer-events-none">
                    <MapContainer center={[loc.lat, loc.lng]} zoom={13} zoomControl={false} dragging={false} scrollWheelZoom={false} className="w-full h-full">
                      <LeafletResizeHandler />
                      <TileLayer
                        attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
                        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        maxZoom={20}
                      />
                      <CircleMarker center={[loc.lat, loc.lng]} radius={10} pathOptions={{ color: 'white', weight: 2, fillColor: match.compatibilityScore >= 80 ? '#0D9488' : match.profile.role === 'owner' ? '#FF5A36' : '#1E3A5F', fillOpacity: 1 }} />
                    </MapContainer>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      {match.profile.avatar ? (
                        <img src={match.profile.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-fire/10 flex items-center justify-center text-sm font-bold text-fire">
                          {(match.profile.name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-sm">{match.profile.name}</p>
                        <p className="text-xs text-ink/50">{match.compatibilityScore > 0 ? `${match.compatibilityScore}% Match` : 'Active Member'}</p>
                      </div>
                    </div>
                    <button onClick={() => navigate(`/match/${match.profile.uid}`)} className="w-full py-2 bg-white border border-border rounded-lg text-xs font-semibold hover:border-fire transition-colors">
                      View Profile
                    </button>
                  </div>
                </div>
              );
            })}
            {activeMatches.length === 0 && isGeocoding && (
              <div className="flex items-center justify-center w-[280px] h-[180px] bg-parchment rounded-[16px]">
                <Loader2 className="w-6 h-6 animate-spin text-fire" />
              </div>
            )}
          </div>
          <button
            onClick={() => {
              const mapItems: MapItem[] = activeMatches
                .map(({ match, loc }) => {
                  return {
                    type: 'person' as const,
                    uid: match.profile.uid!,
                    name: match.profile.name || 'User',
                    avatar: match.profile.avatar || '',
                    profession: match.profile.profession || '',
                    role: match.profile.role,
                    compatibility: match.compatibilityScore,
                    lat: loc.lat,
                    lng: loc.lng,
                    city: match.profile.city || '',
                  };
                });
              navigate('/map', {
                state: {
                  mode: 'people',
                  items: mapItems,
                  initialCenter: userLocation ? [userLocation.lat, userLocation.lng] as [number, number] : undefined,
                  sourceLabel: 'Matches Near You',
                },
              });
            }}
            className="mt-4 w-full text-sm font-semibold text-fire border border-fire px-4 py-3 rounded-xl hover:bg-fire/5 transition-colors"
          >
            View Full Map &rarr;
          </button>
        </>
      ) : (
        // Desktop Map
        <div className="w-full h-[320px] rounded-[16px] overflow-hidden border border-border relative z-0">
          <MapContainer center={[userLocation.lat, userLocation.lng]} zoom={12} className="w-full h-full">
            <LeafletResizeHandler />
            <TileLayer
              attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
              url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
              subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
              maxZoom={20}
            />

            {/* Current User Pin */}
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={12}
              pathOptions={{
                color: 'white',
                weight: 2,
                fillColor: '#1E3A5F',
                fillOpacity: 1,
                className: 'animate-pulse'
              }}
            >
              <Tooltip>You</Tooltip>
            </CircleMarker>

            {/* Match Pins */}
            {activeMatches.map(({ match, loc }) => {
              const p = match.profile;

              const fillColor = match.compatibilityScore >= 80
                ? '#0D9488' // teal
                : p.role === 'owner'
                  ? '#FF5A36' // fire orange
                  : '#1E3A5F'; // navy blue

              return (
                <CircleMarker
                  key={p.uid}
                  center={[loc.lat, loc.lng]}
                  radius={12}
                  pathOptions={{
                    color: 'white',
                    weight: 2,
                    fillColor,
                    fillOpacity: 1
                  }}
                >
                  <Tooltip className="font-semibold bg-white border border-fire rounded-lg shadow-sm px-2 py-1">
                    {p.name} {match.compatibilityScore > 0 ? `• ${match.compatibilityScore}%` : ''} • {p.role}
                  </Tooltip>
                  <Popup className="match-popup">
                    <div className="flex flex-col gap-2 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        {p.avatar ? (
                          <img src={p.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-fire/10 flex items-center justify-center text-xs font-bold text-fire">
                            {(p.name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-sm leading-tight">{p.name}</p>
                          <p className="text-[10px] text-ink/60">{p.profession}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        {match.compatibilityScore > 0 ? (
                          <span className="badge-teal text-[10px]">{match.compatibilityScore}%</span>
                        ) : (
                          <span className="text-[10px] text-ink/40 font-medium">Member</span>
                        )}
                        <button onClick={() => navigate(`/match/${p.uid}`)} className="text-xs text-fire font-medium hover:underline">
                          View Profile
                        </button>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
