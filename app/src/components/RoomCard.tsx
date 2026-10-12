import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ChevronLeft, ChevronRight, Image as ImageIcon, MapPin, Bed, Home as HomeIcon, Loader2, Users } from 'lucide-react';
import type { Listing } from '@/hooks/useListings';
import { getListingPhotos } from '@/lib/displayTruth';

interface RoomCardProps {
  room: Listing;
  isSaved?: boolean;
  isSaving?: boolean;
  onToggleSave?: (e: React.MouseEvent, roomId: string) => void;
  onClick?: () => void;
  className?: string;
  compatibilityScore?: number;
}

export default function RoomCard({
  room,
  isSaved = false,
  isSaving = false,
  onToggleSave,
  onClick,
  className = '',
}: RoomCardProps) {
  const navigate = useNavigate();
  const [currentImgIdx, setCurrentImgIdx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const { photos: images, hasRealPhotos } = getListingPhotos(room.images);

  const rentAmount = room.totalRent || (room as any).monthlyRent || (room as any).rent || 0;
  const locality = room.locality || 'Bengaluru';
  const city = room.city || 'Bengaluru';

  // Normalize property badge: 1BHK / 2BHK / 3BHK / PG (strictly NO Entire Apartment)
  const rawType = (room.flatType || '').trim();
  let propertyBadge: string | null = null;
  if (rawType.toLowerCase().includes('pg') || rawType.toLowerCase().includes('hostel')) {
    propertyBadge = 'PG';
  } else if (rawType.toLowerCase().includes('1bhk') || rawType.toLowerCase().includes('studio')) {
    propertyBadge = '1BHK';
  } else if (rawType.toLowerCase().includes('2bhk')) {
    propertyBadge = '2BHK';
  } else if (rawType.toLowerCase().includes('3bhk')) {
    propertyBadge = '3BHK';
  } else if (rawType && !rawType.toLowerCase().includes('apartment')) {
    propertyBadge = rawType;
  }

  // Accommodation type: Private Room or Shared Room
  const isShared = propertyBadge === 'PG' || rawType.toLowerCase().includes('shared') || (room.partnersNeeded ?? 0) > 1;
  const isPrivate = rawType.toLowerCase().includes('private') || room.partnersNeeded === 1;
  const accommodationType = isShared ? 'Shared Room' : isPrivate ? 'Private Room' : null;

  // Furnishing
  const rawFurnishing = (room.furnishing || '').toLowerCase();
  let furnishing: string | null = null;
  if (rawFurnishing.includes('full') || rawFurnishing.includes('fully')) {
    furnishing = 'Furnished';
  } else if (rawFurnishing.includes('unfurnish')) {
    furnishing = 'Unfurnished';
  } else if (rawFurnishing.includes('semi')) {
    furnishing = 'Semi-Furnished';
  }

  const prefetchRoomDetail = () => {
    import('@/pages/RoomDetail');
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/room/${room.id}`);
    }
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIdx(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImgIdx(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div
      onClick={handleCardClick}
      onMouseEnter={() => {
        setIsHovered(true);
        prefetchRoomDetail();
      }}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={prefetchRoomDetail}
      onPointerDown={prefetchRoomDetail}
      className={`group relative flex flex-col bg-white rounded-2xl shadow-xs hover:shadow-md border border-gray-200/80 overflow-hidden transition-all duration-300 cursor-pointer ${className}`}
    >
      {/* Top Image Container */}
      <div className="relative aspect-[16/11] w-full overflow-hidden bg-gray-100">
        {hasRealPhotos && images.length > 0 ? (
          <img
            src={images[currentImgIdx]}
            alt={room.title || `${locality}, ${city}`}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-100 text-gray-400">
            <ImageIcon className="w-8 h-8 text-gray-300" />
            <span className="text-xs font-semibold text-gray-400">No photos yet</span>
          </div>
        )}

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {/* Top-Left Property Type Badge (1BHK / 2BHK / 3BHK / PG) */}
        {propertyBadge && (
          <div className="absolute top-3 left-3 z-10 pointer-events-none">
            <span className="bg-white text-[#1E2229] text-xs font-semibold px-3 py-1 rounded-full shadow-xs tracking-wide">
              {propertyBadge}
            </span>
          </div>
        )}

        {/* Top-Right Wishlist Button */}
        {onToggleSave && (
          <button
            onClick={e => onToggleSave(e, room.id)}
            aria-label={isSaved ? 'Remove from saved' : 'Save room'}
            className="absolute top-3 right-3 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-white text-gray-600 hover:text-red-500 shadow-sm transition-all z-10 cursor-pointer hover:scale-105"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#FF5A36]" />
            ) : (
              <Heart
                className={`w-4 h-4 transition-all ${
                  isSaved ? 'fill-red-500 text-red-500' : 'hover:fill-red-100'
                }`}
              />
            )}
          </button>
        )}

        {/* Bottom-Left Photo Count Badge — only when real photos exist */}
        {hasRealPhotos && images.length > 0 && (
          <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
            <span className="bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
              <ImageIcon className="w-3 h-3" />
              {images.length} Photos
            </span>
          </div>
        )}

        {/* Image Nav Arrows (Desktop Hover) */}
        {hasRealPhotos && images.length > 1 && isHovered && (
          <>
            <button
              onClick={handlePrevImage}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 text-[#1E2229] shadow-md hover:bg-white transition-all z-10 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextImage}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 text-[#1E2229] shadow-md hover:bg-white transition-all z-10 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Content Area */}
      <div className="p-4 flex flex-col justify-between flex-1 space-y-3">
        <div>
          {/* Real Listing Title */}
          <h3 className="font-bold text-[#1E2229] text-sm sm:text-base leading-snug line-clamp-1 tracking-tight mb-1">
            {room.title || `1 Room in ${propertyBadge || 'Apartment'}`}
          </h3>

          {/* Locality & City with Location Pin */}
          <div className="flex items-center gap-1 text-xs text-slate-500 font-normal truncate mb-2.5">
            <MapPin className="w-3.5 h-3.5 text-[#FF5A36] shrink-0" />
            <span className="truncate">{locality}{city && city !== locality ? `, ${city}` : ''}</span>
          </div>

          {/* Accommodation Type, Furnishing & Flatmates Needed Row */}
          {(accommodationType || furnishing || room.preferredGender || room.partnersNeeded || (room as any).flatmatesNeeded) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] sm:text-xs text-slate-600 font-normal">
              {accommodationType && (
                <div className="flex items-center gap-1 shrink-0">
                  <Bed className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{accommodationType}</span>
                </div>
              )}
              {furnishing && (
                <div className="flex items-center gap-1 shrink-0">
                  <HomeIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{furnishing}</span>
                </div>
              )}
              {room.preferredGender && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                  For {room.preferredGender}
                </span>
              )}
              {(room.partnersNeeded || (room as any).flatmatesNeeded) ? (
                <div className="flex items-center gap-1 shrink-0 text-emerald-700 font-medium">
                  <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {room.partnersNeeded || (room as any).flatmatesNeeded}{' '}
                    {(room.partnersNeeded || (room as any).flatmatesNeeded) === 1 ? 'roommate' : 'roommates'}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Rent & View Details Action Row */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
          <div>
            {rentAmount > 0 ? (
              <div className="flex items-baseline">
                <span className="text-lg sm:text-xl font-bold text-[#1E2229] tracking-tight">
                  ₹{rentAmount.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-normal ml-1">/mo</span>
              </div>
            ) : (
              <span className="text-xs font-medium text-slate-400">Rent on request</span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleCardClick();
            }}
            className="border border-[#FF5A36] text-[#FF5A36] hover:bg-[#FF5A36] hover:text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
          >
            <span>View Details</span>
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
