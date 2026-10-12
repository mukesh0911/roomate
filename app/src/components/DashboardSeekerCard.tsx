import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveStatus } from '@/hooks/useMatches';
import {
  MapPin, CheckCircle2, ShieldCheck, MoreVertical, Flag, Ban,
  Loader2, Check, Clock, Star, Heart, Phone, MessageSquare
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MatchedUser } from '@/hooks/useMatches';
import type { UserProfile } from '@/hooks/useAuth';
import { getUserIntent, getPreferredRoommateGender, getUserInitials } from '@/lib/userIntent';

export interface DashboardSeekerCardProps {
  match: MatchedUser;
  isSaved?: boolean;
  onToggleSave?: (uid: string) => void;
  saving?: boolean;
  onChat?: (uid: string, name: string) => void;
  cState?: 'connect' | 'pending_sent' | 'pending_received' | 'chat' | 'connected' | 'none';
  connecting?: boolean;
  onSkip?: (uid: string, name: string) => void;
  onReport?: (match: MatchedUser) => void;
  onBlock?: (uid: string, name: string) => void;
  onOpenCompatModal?: (match: MatchedUser) => void;
  isReceivedRequest?: boolean;
  onAcceptRequest?: () => void;
  onDeclineRequest?: () => void;
  isSentRequest?: boolean;
  onCancelRequest?: () => void;
  viewMode?: 'grid' | 'list';
}

export default function DashboardSeekerCard({
  match,
  isSaved,
  onToggleSave,
  saving,
  onChat,
  cState = 'connect',
  connecting,
  onReport,
  onBlock,
  onOpenCompatModal,
  isReceivedRequest,
  onAcceptRequest,
  onDeclineRequest,
  isSentRequest,
  onCancelRequest,
  viewMode = 'grid',
}: DashboardSeekerCardProps) {
  const navigate = useNavigate();
  const [imgFailed, setImgFailed] = useState(false);
  const p = match.profile;
  const activeCState = cState === 'connected' ? 'chat' : cState === 'none' ? 'connect' : cState;
  const activeStatus = getActiveStatus(p.lastActiveAt);

  const initial = getUserInitials(p.name);

  const localityText = p.locality
    ? (p.city ? `${p.locality}, ${p.city}` : p.locality)
    : (p.city ? `${p.city}, India` : 'Bengaluru, India');

  const budgetText = p.budget && p.budget > 0
    ? `₹ ${p.budget.toLocaleString('en-IN')}`
    : '₹ 3,750';

  const intent = getUserIntent(p, (p as any)._listing);
  const preferredGender = getPreferredRoommateGender(p, (p as any)._listing);

  const hasPhoto = Boolean(
    p.avatar &&
    !imgFailed &&
    typeof p.avatar === 'string' &&
    p.avatar.trim() !== '' &&
    (p.avatar.startsWith('http') || p.avatar.startsWith('data:image'))
  );

  return (
    <div
      onClick={() => navigate(`/match/${p.uid}`)}
      className={`bg-white rounded-3xl border border-gray-200/90 shadow-2xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between cursor-pointer group select-none ${
        viewMode === 'list' ? 'sm:flex-row sm:items-center sm:gap-4' : ''
      }`}
    >
      {/* Upper Section: Avatar on Left, Details on Right */}
      <div className={`flex items-start gap-4 sm:gap-5 ${viewMode === 'list' ? 'flex-1 min-w-0' : ''}`}>
        {/* Left: Square Slate Avatar with Large Initial & Concentric Green Verified Badge */}
        <div className="relative shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-[#6C828D] flex items-center justify-center overflow-visible shadow-xs">
          {hasPhoto ? (
            <img
              src={p.avatar}
              alt={p.name || 'Roommate'}
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover rounded-2xl"
              loading="lazy"
            />
          ) : (
            <span className="text-white text-4xl sm:text-5xl font-medium tracking-wide select-none font-sans">
              {initial}
            </span>
          )}

          {/* Concentric Green Verified Seal (Bottom-Right Corner) */}
          {(p.isVerified !== false) && (
            <div className="absolute -bottom-1.5 -right-1.5 bg-white p-0.5 rounded-full shadow-xs">
              <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border border-emerald-500/80 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3.5]" />
                </div>
              </div>
            </div>
          )}

          {/* Online indicator */}
          {activeStatus.status === 'online' && (
            <span
              className="absolute top-1.5 right-1.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-xs"
              title="Online now"
            />
          )}
        </div>

        {/* Right Details Column */}
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

            <div className="flex items-start justify-between gap-1">
              {/* Name */}
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-semibold text-base sm:text-lg text-[#1E2229] group-hover:text-[#FF5A36] transition-colors line-clamp-1">
                  {p.name || 'Roommate'}
                </h3>
                {p.workEmailVerified && (
                  <span title="Corporate Verified" className="shrink-0 flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                  </span>
                )}
              </div>

              {/* 3-dots Menu for Report / Block */}
              {(onReport || onBlock) && (
                <div onClick={e => e.stopPropagation()} className="shrink-0 -mr-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer" aria-label="More options">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 rounded-2xl shadow-lg border border-slate-100">
                      {onReport && (
                        <DropdownMenuItem onClick={() => onReport(match)} className="text-amber-600 focus:text-amber-600 cursor-pointer">
                          <Flag className="w-4 h-4 mr-2" /> Report User
                        </DropdownMenuItem>
                      )}
                      {onBlock && (
                        <DropdownMenuItem onClick={() => onBlock(p.uid || '', p.name)} className="text-rose-600 focus:text-rose-600 cursor-pointer">
                          <Ban className="w-4 h-4 mr-2" /> Block User
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

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
              <span className="text-xs text-slate-500 font-normal">
                {intent.priceLabel}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                /{intent.priceSubtext}
              </span>
            </div>
          </div>

          {/* 2-Column Info Grid: Requirement | Preferred Roommate Gender */}
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

      {/* Bottom Row: Conditional for Received / Sent Requests OR Standard Dashed Action Row */}
      {isReceivedRequest ? (
        <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
          <span className="text-xs text-gray-500 font-medium">Wants to connect</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDeclineRequest}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={onAcceptRequest}
              disabled={connecting}
              className="px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Accept
            </button>
          </div>
        </div>
      ) : isSentRequest ? (
        <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Pending
          </span>
          <button
            type="button"
            onClick={onCancelRequest}
            className="px-3 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-500 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
          >
            Cancel Request
          </button>
        </div>
      ) : (
        /* Standard Bottom Row: Distance + Match + Action Buttons */
        <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
          {/* Distance / Locality from search */}
          <div className="text-xs text-slate-500 font-normal whitespace-nowrap shrink-0">
            <span>0 km from search</span>
          </div>

          {/* Match Score & Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Match Score */}
            {match.compatibilityScore > 0 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onOpenCompatModal?.(match); }}
                className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-[#FF5A36] transition-colors cursor-pointer"
                title="View Compatibility Breakdown"
              >
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400 stroke-[1.8]" />
                <span>{match.compatibilityScore}% Match</span>
              </button>
            )}

            {/* Action Buttons Group */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Optional Save Heart Button */}
              {onToggleSave && (
                <button
                  type="button"
                  onClick={() => onToggleSave(p.uid || '')}
                  disabled={saving}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-slate-200/90 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 ${
                    isSaved ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white hover:bg-slate-50 text-slate-500 hover:text-[#1E2229] hover:border-slate-300'
                  }`}
                  title={isSaved ? "Remove from saved" : "Save profile"}
                  aria-label={isSaved ? "Remove from saved" : "Save profile"}
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-current text-rose-600' : 'text-slate-500'}`} />
                  )}
                </button>
              )}

              {/* Circular Chat / Connect Button */}
              {onChat && (
                <button
                  type="button"
                  disabled={activeCState === 'pending_sent' || connecting}
                  onClick={() => onChat(p.uid || '', p.name || '')}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-500 hover:text-[#1E2229] hover:border-slate-300 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xs"
                  title={activeCState === 'chat' ? 'Chat' : activeCState === 'pending_sent' ? 'Request Sent' : activeCState === 'pending_received' ? 'Accept Request' : 'Connect'}
                  aria-label={activeCState === 'chat' ? 'Chat' : activeCState === 'pending_sent' ? 'Request Sent' : activeCState === 'pending_received' ? 'Accept Request' : 'Connect'}
                >
                  {connecting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 text-slate-500 stroke-[1.8]" />
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
