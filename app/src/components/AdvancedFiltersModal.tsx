import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RotateCcw, Check, Sparkles, Filter, MapPin, ChevronDown, ShieldCheck } from 'lucide-react';
import { amenitiesList, cities } from '@/lib/staticData';

export interface AdvancedFilterState {
  city: string;
  budgetMin: number;
  budgetMax: number;
  moveInDate: string;
  gender: string;
  roomTypes: string[];
  accommodationTypes: string[];
  dietary: string;
  smoking: string;
  alcohol: string;
  sleepSchedule: string;
  petPolicy: string;
  furnishing: string;
  amenities: string[];
  bachelorsFriendly: boolean;
  guestsAllowed: string;
  moveInWindow: string;
  highMatchOnly: boolean;
  verifiedOnly: boolean;
}

export const DEFAULT_ADVANCED_FILTERS: AdvancedFilterState = {
  city: 'Bengaluru',
  budgetMin: 0,
  budgetMax: 100000,
  moveInDate: 'any',
  gender: 'any',
  roomTypes: [],
  accommodationTypes: [],
  dietary: 'any',
  smoking: 'any',
  alcohol: 'any',
  sleepSchedule: 'any',
  petPolicy: 'any',
  furnishing: 'any',
  amenities: [],
  bachelorsFriendly: false,
  guestsAllowed: 'any',
  moveInWindow: 'any',
  highMatchOnly: false,
  verifiedOnly: false,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  filters: AdvancedFilterState;
  onApply: (updated: AdvancedFilterState) => void;
  totalResultsCount: number;
}

export default function AdvancedFiltersModal({
  isOpen,
  onClose,
  filters: initialFilters,
  onApply,
  totalResultsCount,
}: Props) {
  const [draft, setDraft] = useState<AdvancedFilterState>({ ...DEFAULT_ADVANCED_FILTERS, ...initialFilters });

  useEffect(() => {
    if (isOpen) {
      setDraft({ ...DEFAULT_ADVANCED_FILTERS, ...initialFilters });
    }
  }, [isOpen, initialFilters]);

  if (!isOpen) return null;

  const toggleRoomType = (id: string) => {
    setDraft(prev => {
      const current = prev.roomTypes || [];
      return {
        ...prev,
        roomTypes: current.includes(id)
          ? current.filter(t => t !== id)
          : [...current, id],
      };
    });
  };

  const toggleAccommodationType = (id: string) => {
    setDraft(prev => {
      const current = prev.accommodationTypes || [];
      return {
        ...prev,
        accommodationTypes: current.includes(id)
          ? current.filter(t => t !== id)
          : [...current, id],
      };
    });
  };

  const toggleAmenity = (amenity: string) => {
    setDraft(prev => ({
      ...prev,
      amenities: (prev.amenities || []).includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...(prev.amenities || []), amenity],
    }));
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_ADVANCED_FILTERS, city: draft.city });
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[88vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Mobile Drag Handle */}
        <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF5A36] flex items-center justify-center">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1E2229]">Filters</h2>
              <span className="text-[10px] text-slate-400">Refine Your Property Discovery</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-slate-400 hover:text-[#FF5A36] flex items-center gap-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
              aria-label="Close filters"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Filters Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* 1. LOCATION (Integrated inside Filters sheet) */}
          <div>
            <label className="text-xs font-bold text-[#1E2229] uppercase tracking-wider block mb-2">
              Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-[#FF5A36] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={draft.city}
                onChange={(e) => setDraft(d => ({ ...d, city: e.target.value }))}
                aria-label="Select location"
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-2xl text-xs sm:text-sm font-semibold text-[#1E2229] outline-none focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/10 transition-all appearance-none cursor-pointer"
              >
                {cities.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 2. MONTHLY BUDGET */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#1E2229] uppercase tracking-wider">
                Monthly Budget
              </label>
              <span className="text-xs font-bold text-[#FF5A36]">
                {draft.budgetMax >= 100000 ? 'Up to ₹1,00,000+' : `Up to ₹${draft.budgetMax.toLocaleString('en-IN')}`}
              </span>
            </div>
            <div className="space-y-2">
              <input
                type="range"
                min="5000"
                max="100000"
                step="2500"
                value={draft.budgetMax}
                onChange={(e) => setDraft(d => ({ ...d, budgetMax: Number(e.target.value) }))}
                aria-label="Monthly budget range"
                className="w-full accent-[#FF5A36] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
                <span>₹5,000</span>
                <span>₹25,000</span>
                <span>₹50,000</span>
                <span>₹1,00,000+</span>
              </div>
            </div>
          </div>

          {/* 3. MOVE-IN DATE */}
          <div>
            <label className="text-xs font-bold text-[#1E2229] uppercase tracking-wider block mb-2">
              Move-in Date
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'any', label: 'Any date' },
                { id: 'immediate', label: 'Immediate (< 7d)' },
                { id: '15_days', label: 'Within 15 days' },
                { id: '30_days', label: 'Within 30 days' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, moveInDate: opt.id }))}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all text-center cursor-pointer ${
                    draft.moveInDate === opt.id
                      ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. GENDER PREFERENCE */}
          <div>
            <label className="text-xs font-bold text-[#1E2229] uppercase tracking-wider block mb-2">
              Gender
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'any', label: 'Any' },
                { id: 'female', label: 'Female' },
                { id: 'male', label: 'Male' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, gender: opt.id }))}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all text-center cursor-pointer ${
                    draft.gender === opt.id
                      ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5. ROOM TYPE */}
          <div>
            <label className="text-xs font-bold text-[#1E2229] uppercase tracking-wider block mb-2">
              Room Type
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: '1BHK', label: '1BHK' },
                { id: '2BHK', label: '2BHK' },
                { id: '3BHK', label: '3BHK' },
                { id: 'Private Room', label: 'Private Room' },
                { id: 'Shared Room', label: 'Shared Room' },
              ].map(type => {
                const isSelected = (draft.roomTypes || []).includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleRoomType(type.id)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{type.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#FF5A36]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 6. ACCOMMODATION TYPE */}
          <div>
            <label className="text-xs font-bold text-[#1E2229] uppercase tracking-wider block mb-2">
              Accommodation Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'PG', label: 'PG' },
                { id: 'Hostel', label: 'Hostel' },
                { id: 'Coliving', label: 'Coliving' },
              ].map(type => {
                const isSelected = (draft.accommodationTypes || []).includes(type.id);
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleAccommodationType(type.id)}
                    className={`py-2 px-2.5 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{type.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#FF5A36]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 7. FURNISHING */}
          <div>
            <label className="text-xs font-bold text-[#1E2229] uppercase tracking-wider block mb-2">
              Furnishing
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'any', label: 'Any' },
                { id: 'Fully Furnished', label: 'Furnished' },
                { id: 'Semi-Furnished', label: 'Semi-Furnished' },
                { id: 'Unfurnished', label: 'Unfurnished' },
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, furnishing: opt.id }))}
                  className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all text-center cursor-pointer ${
                    draft.furnishing === opt.id
                      ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 8. AMENITIES */}
          <div>
            <label className="text-xs font-bold text-[#1E2229] uppercase tracking-wider block mb-2">
              Amenities
            </label>
            <div className="flex flex-wrap gap-2">
              {amenitiesList.map(amenity => {
                const isSelected = (draft.amenities || []).includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={`py-1.5 px-2.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 font-semibold'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{amenity}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 9. VERIFIED ONLY TOGGLE */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="text-xs font-bold text-[#1E2229] block">Verified Only</span>
                <span className="text-[11px] text-slate-600">Only show listings with verified ownership</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDraft(d => ({ ...d, verifiedOnly: !d.verifiedOnly }))}
              aria-label="Toggle verified only"
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                draft.verifiedOnly ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  draft.verifiedOnly ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* 10. HIGH COMPATIBILITY CUT */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-[#FF5A36] shrink-0" />
              <div>
                <span className="text-xs font-bold text-[#1E2229] block">High Compatibility Only</span>
                <span className="text-[11px] text-slate-600">Only show rooms with 70%+ lifestyle match</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDraft(d => ({ ...d, highMatchOnly: !d.highMatchOnly }))}
              aria-label="Toggle high match only"
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                draft.highMatchOnly ? 'bg-[#FF5A36]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                  draft.highMatchOnly ? 'right-1' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Sticky Apply Button Bar */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4 sticky bottom-0 z-10 shrink-0 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
          <div className="text-xs text-slate-500">
            {totalResultsCount > 0 ? (
              <>Matching listings: <strong className="text-[#1E2229] text-sm font-bold">{totalResultsCount}</strong></>
            ) : (
              <span>Refine and discover</span>
            )}
          </div>
          <button
            type="button"
            onClick={handleApply}
            className="bg-[#FF5A36] hover:bg-[#E54E2B] text-white py-2.5 px-6 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer active:scale-95"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
