import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '@/hooks/useAuth';
import type { Listing } from '@/hooks/useListings';
import { MapPin, Star, MessageSquare, Check } from 'lucide-react';
import { getUserIntent, getPreferredRoommateGender, getUserInitials } from '@/lib/userIntent';

interface OwnerSeekerCardProps {
  seeker: UserProfile;
  score?: number;
  ownerListing?: Listing | null;
  onChat: (seekerUid: string) => void;
  distanceText?: string;
}

export default function OwnerSeekerCard({
  seeker,
  score = 0,
  ownerListing,
  onChat,
  distanceText,
}: OwnerSeekerCardProps) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);

  const initial = getUserInitials(seeker.name);

  const localityText = seeker.locality
    ? (seeker.city ? `${seeker.locality}, ${seeker.city}` : seeker.locality)
    : (seeker.city ? `${seeker.city}, India` : 'Bengaluru, India');

  const budgetText = seeker.budget && seeker.budget > 0
    ? `₹ ${seeker.budget.toLocaleString('en-IN')}`
    : '₹ 3,750';

  const intent = getUserIntent(seeker, ownerListing);
  const preferredGender = getPreferredRoommateGender(seeker, ownerListing);

  const hasPhoto = Boolean(
    seeker.avatar &&
    !imgFailed &&
    typeof seeker.avatar === 'string' &&
    seeker.avatar.trim() !== '' &&
    (seeker.avatar.startsWith('http') || seeker.avatar.startsWith('data:image'))
  );

  return (
    <div
      onClick={() => navigate(`/match/${seeker.uid}`)}
      className="bg-white rounded-3xl border border-gray-200/90 shadow-2xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group select-none"
    >
      {/* Top Section: Avatar on Left, Information on Right */}
      <div className="flex items-start gap-3 sm:gap-5">
        {/* Left: Square Slate Avatar with Large Initial & Green Verification Seal */}
        <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl bg-[#6C828D] flex items-center justify-center overflow-visible shadow-xs">
          {hasPhoto ? (
            <img
              src={seeker.avatar}
              alt={seeker.name || 'Room Seeker'}
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover rounded-2xl"
              loading="lazy"
            />
          ) : (
            <span className="text-white text-3xl sm:text-4xl md:text-5xl font-medium tracking-wide select-none font-sans">
              {initial}
            </span>
          )}

          {/* Concentric Green Verified Seal (Bottom-Right Corner) */}
          {(seeker.isVerified !== false) && (
            <div className="absolute -bottom-1.5 -right-1.5 bg-white p-0.5 rounded-full shadow-xs">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border border-emerald-500/80 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3.5]" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Details Column */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
          <div>
            {/* Semantic Intent Badge */}
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide ${
                  intent.badgeVariant === 'room_available'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    : 'bg-orange-50 text-[#FF5A36] border border-orange-200/80'
                }`}
              >
                {intent.badgeText}
              </span>
            </div>

            {/* User Name */}
            <h3 className="font-semibold text-base sm:text-lg text-[#1E2229] group-hover:text-[#FF5A36] transition-colors line-clamp-1">
              {seeker.name || 'Room Seeker'}
            </h3>

            {/* Location with MapPin */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-normal mt-1 truncate">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{localityText}</span>
            </div>

            {/* Financial: Truthful Budget vs Rent */}
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-bold text-[#1E2229]">
                {budgetText}
              </span>
              <span className="text-xs text-slate-500 font-normal">
                {intent.priceLabel}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                /{intent.priceSubtext}
              </span>
            </div>
          </div>

          {/* Requirement and Preferred Roommate Two-Column Grid */}
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-gray-100/90 text-left">
            <div className="min-w-0">
              <span className="text-[11px] text-slate-400 font-medium block">
                {intent.requirementLabel}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#1E2229] block mt-0.5">
                {intent.requirementValue}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-slate-400 font-medium block" title="Roommate Preference">
                {intent.preferenceLabel}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#1E2229] block mt-0.5">
                {preferredGender.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Dashed Horizontal Divider */}
      <div className="border-t border-dashed border-gray-200/90 my-3.5" />

      {/* Bottom Row: Distance / Search on Left, Match + Action Buttons on Right */}
      <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
        {/* Left: Distance from search */}
        <div className="text-xs text-slate-500 font-normal whitespace-nowrap shrink-0">
          <span>{distanceText || '0 km from search'}</span>
        </div>

        {/* Right: Star Match Score + Call + Message Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {score > 0 && (
            <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 stroke-[1.8]" />
              <span>{score}% Match</span>
            </div>
          )}

          {/* Circular Message Button */}
          <button
            type="button"
            onClick={() => onChat(seeker.uid)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-500 hover:text-[#1E2229] hover:border-slate-300 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
            title="Message Seeker"
            aria-label="Message Seeker"
          >
            <MessageSquare className="w-3.5 h-3.5 text-slate-500 stroke-[1.8]" />
          </button>
        </div>
      </div>
    </div>
  );
}
