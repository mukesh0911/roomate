import { useState, useEffect, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  IndianRupee,
  Building2,
  Users,
  ShieldCheck,
  Home,
  Tag,
  Lock,
  ChevronDown
} from 'lucide-react';
import { useStore } from '@/store/useStore';

export default function HeroSearchModule() {
  const navigate = useNavigate();
  const searchInputId = useId();
  const { updateFilters } = useStore();

  const [activeTab, setActiveTab] = useState<'rooms' | 'flatmates'>('rooms');
  const [cityAreaQuery, setCityAreaQuery] = useState('');
  const [moveInDate, setMoveInDate] = useState('Any date');
  const [budgetRange, setBudgetRange] = useState('Any budget');
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [isDateOpen, setIsDateOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isDateOpen && !target.closest('.hero-date-dropdown')) {
        setIsDateOpen(false);
      }
      if (isBudgetOpen && !target.closest('.hero-budget-dropdown')) {
        setIsBudgetOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDateOpen(false);
        setIsBudgetOpen(false);
      }
    };
    if (isDateOpen || isBudgetOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isDateOpen, isBudgetOpen]);

  const budgetOptions = [
    { label: 'Any budget', min: 0, max: 100000 },
    { label: 'Under ₹10,000', min: 0, max: 10000 },
    { label: '₹10,000 - ₹20,000', min: 10000, max: 20000 },
    { label: '₹20,000 - ₹35,000', min: 20000, max: 35000 },
    { label: '₹35,000+', min: 35000, max: 100000 },
  ];

  const dateOptions = [
    'Any date',
    'Immediately',
    'Within 15 days',
    'Next month',
    'Flexible',
  ];

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const selectedBudget = budgetOptions.find((b) => b.label === budgetRange) || budgetOptions[0];

    // Build flatType filter based on active tab
    // Rooms & PGs tab → no flatType restriction (shows all types)
    // Flatmates tab → navigate to roommates tab, no flatType filter needed
    const flatTypeForTab: string[] = []; // both tabs show all types on explore

    updateFilters({
      city: cityAreaQuery.trim() || '',
      localities: cityAreaQuery.trim() ? [cityAreaQuery.trim()] : [],
      budgetMin: selectedBudget.min,
      budgetMax: selectedBudget.max,
      flatType: flatTypeForTab,
    });

    const params = new URLSearchParams({ tab: activeTab === 'flatmates' ? 'roommates' : 'rooms', q: cityAreaQuery.trim(), min: String(selectedBudget.min), max: String(selectedBudget.max), move: moveInDate });
    navigate('/explore?' + params.toString());
  };

  return (
    <div className="w-full max-w-xl lg:max-w-2xl">
      {/* 2 Tabs on top */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 mb-3">
        <button
          type="button"
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'rooms'
              ? 'bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/30 shadow-xs'
              : 'bg-white/90 text-gray-600 hover:text-gray-900 border border-gray-200/80'
          }`}
        >
          <Home className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'rooms' ? 'text-[#FF5A36]' : 'text-gray-400'}`} />
          <span className="truncate">Rooms &amp; PGs</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('flatmates')}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
            activeTab === 'flatmates'
              ? 'bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/30 shadow-xs'
              : 'bg-white/90 text-gray-600 hover:text-gray-900 border border-gray-200/80'
          }`}
        >
          <Users className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'flatmates' ? 'text-[#FF5A36]' : 'text-gray-400'}`} />
          <span className="truncate">Roommates</span>
        </button>
      </div>

      {/* Main Search Input Bar Card */}
      <div className="bg-white rounded-2xl sm:rounded-full p-2.5 sm:p-2 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100/90 transition-all">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0">
          {/* City / Area / Landmark */}
          <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 sm:py-1 bg-gray-50/80 sm:bg-transparent rounded-xl sm:rounded-none min-h-[40px]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              id={searchInputId}
              type="text"
              value={cityAreaQuery}
              onChange={(e) => setCityAreaQuery(e.target.value)}
              placeholder="Enter city, area or landmark"
              className="w-full bg-transparent text-xs sm:text-sm font-medium text-[#1E2229] placeholder:text-gray-400 focus:outline-none truncate"
            />
          </div>

          <div className="hidden sm:block h-7 w-px bg-gray-200 shrink-0" />

          {/* Move-in Date Dropdown */}
          <div className="hero-date-dropdown relative sm:w-36 px-3.5 py-2.5 sm:py-1 bg-gray-50/80 sm:bg-transparent rounded-xl sm:rounded-none min-h-[40px] flex items-center">
            <button
              type="button"
              onClick={() => {
                setIsDateOpen(!isDateOpen);
                setIsBudgetOpen(false);
              }}
              className="w-full flex items-center justify-between gap-1.5 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-[#1E2229] truncate">
                  {moveInDate === 'Any date' ? 'Move-in date' : moveInDate}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </button>

            {isDateOpen && (
              <div className="absolute left-0 right-0 sm:right-0 sm:left-auto top-full mt-2 w-full sm:w-44 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-40">
                {dateOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setMoveInDate(opt);
                      setIsDateOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 sm:py-1.5 text-xs font-medium hover:bg-orange-50/50 transition-colors ${
                      moveInDate === opt ? 'text-[#FF5A36] font-bold bg-[#FF5A36]/5' : 'text-slate-700'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="hidden sm:block h-7 w-px bg-gray-200 shrink-0" />

          {/* Budget Dropdown */}
          <div className="hero-budget-dropdown relative sm:w-36 px-3.5 py-2.5 sm:py-1 bg-gray-50/80 sm:bg-transparent rounded-xl sm:rounded-none min-h-[40px] flex items-center">
            <button
              type="button"
              onClick={() => {
                setIsBudgetOpen(!isBudgetOpen);
                setIsDateOpen(false);
              }}
              className="w-full flex items-center justify-between gap-1.5 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <IndianRupee className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-[#1E2229] truncate">
                  {budgetRange === 'Any budget' ? 'Budget range' : budgetRange}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            </button>

            {isBudgetOpen && (
              <div className="absolute left-0 right-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-40">
                {budgetOptions.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setBudgetRange(opt.label);
                      setIsBudgetOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 sm:py-1.5 text-xs font-medium hover:bg-orange-50/50 transition-colors ${
                      budgetRange === opt.label ? 'text-[#FF5A36] font-bold bg-[#FF5A36]/5' : 'text-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search CTA Button */}
          <button
            type="submit"
            aria-label="Search"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3 rounded-xl sm:rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-semibold text-xs sm:text-sm shadow-xs transition-all active:scale-[0.98] cursor-pointer shrink-0 mt-0.5 sm:mt-0 min-h-[40px]"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* Trust Micro-Bar */}
      {/* Mobile view: 4 items in a clean row matching the reference screenshot */}
      <div className="grid grid-cols-4 gap-1 mt-4 sm:hidden px-1">
        <div className="flex flex-col items-center text-center">
          <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs mb-1">
            ✓
          </div>
          <span className="text-[10px] text-gray-600 font-medium leading-tight">
            Verified<br />listings
          </span>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-6 h-6 rounded-full bg-orange-50 text-[#FF5A36] flex items-center justify-center text-xs mb-1">
            👥
          </div>
          <span className="text-[10px] text-gray-600 font-medium leading-tight">
            Genuine<br />people
          </span>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-6 h-6 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center text-xs mb-1">
            ✕
          </div>
          <span className="text-[10px] text-gray-600 font-medium leading-tight">
            No<br />brokerage
          </span>
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-6 h-6 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center text-xs mb-1">
            🔒
          </div>
          <span className="text-[10px] text-gray-600 font-medium leading-tight">
            Safe &amp;<br />private chat
          </span>
        </div>
      </div>

      {/* Desktop view: inline badges untouched */}
      <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-2 sm:mt-4 px-1 text-xs font-medium text-gray-600">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] shrink-0">
            ✓
          </div>
          <span className="truncate">Verified listings</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-4 h-4 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] shrink-0">
            ✓
          </div>
          <span className="truncate">Genuine people</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] shrink-0">
            ✓
          </div>
          <span className="truncate">No brokerage</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-4 h-4 rounded-full bg-teal-100 text-teal-600 flex items-center justify-center text-[10px] shrink-0">
            🛡
          </div>
          <span className="truncate">Safe &amp; private chat</span>
        </div>
      </div>

      {/* Top Cities Quick Links (Matching FlatMate Reference Screenshot 1 & 2) */}
      <div className="mt-3.5 pt-3 border-t border-gray-100/80 flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">
          Top Cities:
        </span>
        {['Delhi', 'Mumbai', 'Bangalore', 'Pune', 'Noida', 'Gurgaon', 'Hyderabad'].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              updateFilters({ city: c });
              navigate(`/explore?tab=${activeTab === 'flatmates' ? 'roommates' : 'rooms'}&city=${c}`);
            }}
            className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white hover:bg-orange-50 hover:text-[#FF5A36] text-slate-700 border border-gray-200/80 shadow-2xs transition-colors cursor-pointer"
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
