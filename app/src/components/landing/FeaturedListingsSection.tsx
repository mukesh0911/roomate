import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ChevronLeft, ChevronRight, ShieldCheck, ArrowRight } from 'lucide-react';
import { getListingPhotos } from '@/lib/displayTruth';
import { listingRent } from '@/lib/listingTruth';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/useStore';
import { saveUserBookmarkBackend, fetchBoundedExploreListings } from '@/lib/nestmateBackend';
import { toast } from 'sonner';

export default function FeaturedListingsSection() {
  const navigate = useNavigate();
  const carouselRef = useRef<HTMLDivElement>(null);
  const { user, profile, refreshProfile } = useAuth();
  const openAuthModal = useStore(state => state.openAuthModal);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const savesInFlight = useRef(new Set<string>());
  const favorites = Object.fromEntries((profile?.savedRoomIds || []).map(id => [id, true]));
  const [realListings, setRealListings] = useState<any[]>([]);
  const [fetchState, setFetchState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let mounted = true;
    setFetchState('loading');
    async function loadFeatured() {
      try {
        const result = await fetchBoundedExploreListings({ pageSize: 8, maxReadBudget: 32 });
        if (!mounted) return;
        const items = result.all.map((d) => {
          const data = d.raw;
          const { photos, hasRealPhotos } = getListingPhotos(data.images);
          const rent = listingRent(data);
          const tags = [data.flatType, data.furnishing, data.locality].filter(Boolean);
          return {
            id: d.id,
            title: data.title || 'Untitled listing',
            price: rent != null ? `₹ ${rent.toLocaleString()}` : 'Rent not provided',
            period: rent != null ? '/ month' : '',
            image: hasRealPhotos && photos[0] ? photos[0] : undefined,
            tags,
            verified: data.ownerVerified === true,
            city: data.city || '',
            distance: [data.locality, data.city].filter(Boolean).join(', '),
          };
        });
        setRealListings(items);
        setFetchState('ready');
      } catch (e) {
        if (!mounted) return;
        setFetchState('error');
        console.warn('Could not load featured places:', e);
      }
    }
    const handle = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(() => loadFeatured(), { timeout: 2500 })
      : setTimeout(loadFeatured, 1500);

    return () => {
      mounted = false;
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof handle === 'number') {
        (window as any).cancelIdleCallback(handle);
      } else {
        clearTimeout(handle);
      }
    };
  }, [user?.uid, retry]);

  const prefetchRoomDetail = () => {
    // prefetch no-op
  };

  const listings = realListings;


  const toggleFavorite = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) { openAuthModal({ title: 'Sign in to save this listing' }); return; }
    if (savesInFlight.current.has(id)) return;
    savesInFlight.current.add(id); setSaving(previous => ({ ...previous, [id]: true }));
    try {
      await saveUserBookmarkBackend(id, true, !favorites[id]);
      await refreshProfile();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update Saved. Try again.'); }
    finally { savesInFlight.current.delete(id); setSaving(previous => ({ ...previous, [id]: false })); }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 320;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="py-10 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-[1280px] mx-auto">
      {fetchState === 'loading' && !realListings.length && <p role="status" className="mb-4 text-slate-600">Loading featured places...</p>}
      {fetchState === 'error' && <div role="alert" className="mb-4 rounded-xl border p-4 text-slate-700">Featured places could not refresh. <button className="underline" onClick={() => setRetry(value => value + 1)}>Try again</button></div>}
      {fetchState === 'ready' && !realListings.length && <p role="status" className="mb-4 text-slate-600">No featured places are available right now. <Link className="underline" to="/explore">Explore places</Link></p>}
      {/* ─── MOBILE VIEW (< md): Matches Reference Mockup Exactly ─── */}
      <div className="md:hidden text-left mb-6">
        <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-[#FF5A36] uppercase mb-1.5 block">
          FEATURED LISTINGS
        </span>
        <h2 className="text-[28px] sm:text-3xl lg:text-4xl font-serif font-medium text-[#1E2229] tracking-tight mb-1">
          Find your next space
        </h2>
        <p className="text-[13px] text-slate-600 mb-5 leading-relaxed">
          Discover places across cities.
        </p>

        {/* 2 Mobile Cards Stacked/Presented cleanly matching reference */}
        <div className="flex flex-col gap-4">
          {listings.slice(0, 2).map((item) => {
            const isFav = !!favorites[item.id];
            return (
              <div
                key={item.id}
                onClick={() => {
                  navigate('/explore?room=' + encodeURIComponent(item.id));
                }}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xs cursor-pointer flex flex-col"
                onMouseEnter={prefetchRoomDetail}
                onTouchStart={prefetchRoomDetail}
                onPointerDown={prefetchRoomDetail}
              >
                {/* Photo container */}
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    decoding="async"
                    width={360}
                    height={225}
                    className="w-full h-full object-cover"
                  />

                  {/* Favorite Heart Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(e, item.id)}
                    aria-label={(isFav ? 'Unsave ' : 'Save ') + item.title}
                    aria-pressed={isFav}
                    disabled={saving[item.id]}
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-700 shadow-xs cursor-pointer"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isFav ? 'fill-red-500 text-red-500' : 'text-slate-600'
                      }`}
                    />
                  </button>

                  {/* Verified Badge */}
                  {item.verified && (
                    <div className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-md text-[10px] font-bold text-emerald-700 shadow-xs">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      <span>Verified</span>
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="p-3.5 flex flex-col text-left">
                  {/* Title & Arrow button row */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-[#1E2229] leading-snug line-clamp-2 min-h-[1.25rem]">
                      {item.title}
                    </h3>
                    <div className="w-6 h-6 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 shrink-0">
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-sm font-extrabold text-[#1E2229]">
                      {item.price}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {item.period}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-[10px] text-slate-500">
                    {item.tags.map((tag: string, tIdx: number) => (
                      <span key={tIdx} className="flex items-center gap-1">
                        <span>{tag}</span>
                        {tIdx < item.tags.length - 1 && (
                          <span className="text-slate-300">•</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dots Pagination */}
        <div className="flex items-center justify-center gap-1.5 mt-4 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-700" />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* View all listings centered pill button */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate('/explore?tab=rooms')}
            className="w-full max-w-[280px] py-2.5 px-5 rounded-full border border-gray-200 bg-white text-xs font-semibold text-[#1E2229] hover:bg-gray-50 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>View all listings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── DESKTOP VIEW (>= md): Original Carousel Untouched ─── */}
      <div className="hidden md:block">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-10 sm:mb-12 gap-4">
          <div className="text-left">
            <span className="text-[11px] font-bold tracking-[0.2em] text-[#FF5A36] uppercase mb-2 block">
              FEATURED LISTINGS
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif font-medium text-[#1E2229] tracking-tight mb-2">
              Find your next space
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              Discover places across cities.
            </p>
          </div>

          <Link
            to="/explore?tab=rooms"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#FF5A36] hover:text-[#C4410F] transition-colors group"
          >
            <span>View all listings</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Carousel Container */}
        <div className="relative group w-full min-w-0 max-w-full overflow-hidden md:overflow-visible">
          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={() => scroll('left')}
            className="hidden md:flex absolute -left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white shadow-lg border border-border/80 items-center justify-center text-slate-700 hover:text-[#FF5A36] hover:scale-105 transition-all cursor-pointer"
            aria-label="Previous listings"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => scroll('right')}
            className="hidden md:flex absolute -right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white shadow-lg border border-border/80 items-center justify-center text-slate-700 hover:text-[#FF5A36] hover:scale-105 transition-all cursor-pointer"
            aria-label="Next listings"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Listings Grid / Carousel */}
          <div
            ref={carouselRef}
            className="flex md:grid md:grid-cols-4 gap-5 sm:gap-6 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0 scroll-smooth snap-x snap-mandatory [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {listings.map((item) => {
              const isFav = !!favorites[item.id];
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    navigate('/explore?room=' + encodeURIComponent(item.id));
                  }}
                  className="group/card min-w-[270px] sm:min-w-[290px] md:min-w-0 flex-1 bg-white rounded-2xl sm:rounded-3xl overflow-hidden border border-border/60 shadow-xs hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col snap-start"
                  onMouseEnter={prefetchRoomDetail}
                  onTouchStart={prefetchRoomDetail}
                  onPointerDown={prefetchRoomDetail}
                >
                  {/* Image Container (4:3 aspect ratio) */}
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    <img
                      src={item.image}
                      alt={item.title}
                      loading="lazy"
                      decoding="async"
                      width={400}
                      height={300}
                      className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                    />

                    {/* Favorite Heart Button */}
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(e, item.id)}
                      aria-label={(isFav ? 'Unsave ' : 'Save ') + item.title}
                      aria-pressed={isFav}
                      disabled={saving[item.id]}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-slate-700 hover:bg-white hover:scale-110 transition-all shadow-xs cursor-pointer"
                    >
                      <Heart
                        className={`w-4.5 h-4.5 ${
                          isFav ? 'fill-red-500 text-red-500' : 'text-slate-600'
                        }`}
                      />
                    </button>

                    {/* Verified Badge */}
                    {item.verified && (
                      <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[10px] font-bold text-emerald-700 shadow-xs">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        <span>Verified</span>
                      </div>
                    )}
                  </div>

                  {/* Details Section */}
                  <div className="p-4 sm:p-5 flex flex-col flex-1 text-left justify-between">
                    <div>
                      <h3 className="text-base font-bold text-[#1E2229] mb-1 group-hover/card:text-[#FF5A36] transition-colors truncate">
                        {item.title}
                      </h3>

                      <div className="flex items-baseline gap-1 mb-3">
                        <span className="text-base sm:text-lg font-extrabold text-[#1E2229]">
                          {item.price}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {item.period}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-border/40 text-[11px] text-slate-500">
                      {item.tags.map((tag: string, tIdx: number) => (
                        <span key={tIdx} className="flex items-center">
                          {tag}
                          {tIdx < item.tags.length - 1 && (
                            <span className="mx-1 text-slate-300">•</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
