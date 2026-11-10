import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Globe,
  Menu,
  X,
  ChevronDown,
  User,
  LogOut,
  PlusCircle,
  LayoutDashboard,
  Building2,
  Users,
  Sparkles,
  ShieldCheck,
  Heart,
  ChevronRight,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/useStore';
import { cities } from '@/lib/staticData';

interface LandingNavbarProps {
  onListSpace: () => void;
}

export default function LandingNavbar({ onListSpace }: LandingNavbarProps) {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const { openAuthModal } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('EN');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open to prevent background scrolling
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Close mobile menu or dropdowns on Escape key and handle outside clicks
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setLangDropdownOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (langDropdownOpen && !(e.target as HTMLElement).closest('.nav-city-dropdown')) {
        setLangDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [langDropdownOpen]);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSignOut = async () => {
    await logout();
    setMobileMenuOpen(false);
  };

  const isAuthenticated = !!(user && profile);
  const dashboardPath = '/explore?tab=rooms';

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
        mobileMenuOpen
          ? 'bg-white border-b border-gray-100 shadow-xs'
          : scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-xs border-b border-border/60'
            : 'bg-transparent'
      }`}
    >
      <div className={`max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-all duration-200 ${
        scrolled || mobileMenuOpen ? 'h-14 sm:h-16' : 'h-16 sm:h-20'
      }`}>
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#FF5A36] flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105 shrink-0">
            <svg
              viewBox="0 0 24 24"
              className="w-4.5 h-4.5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 10.5L12 3l9 7.5" />
              <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
              <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-[#1E2229]">NestMate</span>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          <Link
            to="/explore?tab=rooms"
            className="text-xs font-semibold text-[#1E2229]/80 hover:text-[#FF5A36] transition-colors"
          >
            Find a Room
          </Link>
          <Link
            to="/explore?tab=roommates"
            className="text-xs font-semibold text-[#1E2229]/80 hover:text-[#FF5A36] transition-colors"
          >
            Find Roommates
          </Link>
          <button
            type="button"
            onClick={onListSpace}
            className="text-xs font-semibold text-[#1E2229]/80 hover:text-[#FF5A36] transition-colors cursor-pointer"
          >
            List Your Space
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('how-it-works')}
            className="text-xs font-semibold text-[#1E2229]/80 hover:text-[#FF5A36] transition-colors cursor-pointer"
          >
            How It Works
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('trust')}
            className="text-xs font-semibold text-[#1E2229]/80 hover:text-[#FF5A36] transition-colors cursor-pointer"
          >
            Safety
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('community')}
            className="text-xs font-semibold text-[#1E2229]/80 hover:text-[#FF5A36] transition-colors cursor-pointer"
          >
            Community
          </button>
        </nav>

        {/* Right: Actions */}
        <div className="hidden sm:flex items-center gap-3">
          {/* City Selector Pill */}
          <div className="nav-city-dropdown relative">
            <button
              type="button"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#1E2229] bg-white border border-gray-200/80 px-3.5 py-1.5 rounded-full hover:border-gray-300 hover:bg-gray-50/50 shadow-xs transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>{selectedLang !== 'EN' ? selectedLang : (useStore.getState().filters.city || profile?.city || 'All India')}</span>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${langDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 max-h-60 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    useStore.getState().updateFilters({ city: '' });
                    setSelectedLang('All India');
                    setLangDropdownOpen(false);
                    navigate('/explore');
                  }}
                  className="w-full text-left px-3.5 py-1.5 text-gray-700 hover:text-[#FF5A36] hover:bg-orange-50/40 transition-colors font-medium border-b border-gray-100"
                >
                  All India (All Cities)
                </button>
                {cities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => {
                      useStore.getState().updateFilters({ city });
                      setSelectedLang(city);
                      setLangDropdownOpen(false);
                      navigate(`/explore?city=${encodeURIComponent(city)}`);
                    }}
                    className="w-full text-left px-3.5 py-1.5 text-gray-700 hover:text-[#FF5A36] hover:bg-orange-50/40 transition-colors font-medium"
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <Link
                to={dashboardPath}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#1E2229] text-white text-xs font-semibold hover:bg-black transition-all shadow-xs"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="p-1.5 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/explore" onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); openAuthModal(); }}
                className="px-2.5 py-1.5 text-xs font-semibold text-[#1E2229] hover:text-[#FF5A36] transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/explore" onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); openAuthModal(); }}
                className="px-5 py-2 rounded-full bg-[#1E2229] text-xs font-semibold text-white hover:bg-black transition-all shadow-xs"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu right side: City Selector + Hamburger button */}
        <div className="flex items-center gap-2 sm:hidden">
          {/* Mobile City Selector Pill */}
          <div className="nav-city-dropdown relative shrink-0">
            <button
              type="button"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1 text-[11px] font-medium text-[#1E2229] bg-white border border-gray-200 px-2.5 py-1 rounded-full shadow-xs cursor-pointer max-w-[120px]"
            >
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-gray-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{selectedLang !== 'EN' ? selectedLang : (useStore.getState().filters.city || profile?.city || 'All India')}</span>
              <ChevronDown className="w-2.5 h-2.5 text-gray-400 shrink-0" />
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-40 max-h-60 overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    useStore.getState().updateFilters({ city: '' });
                    setSelectedLang('All India');
                    setLangDropdownOpen(false);
                    navigate('/explore');
                  }}
                  className="w-full text-left px-3 py-1.5 text-gray-700 hover:text-[#FF5A36] hover:bg-orange-50/40 transition-colors font-medium border-b border-gray-100"
                >
                  All India
                </button>
                {cities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => {
                      useStore.getState().updateFilters({ city });
                      setSelectedLang(city);
                      setLangDropdownOpen(false);
                      navigate(`/explore?city=${encodeURIComponent(city)}`);
                    }}
                    className="w-full text-left px-3 py-1.5 text-gray-700 hover:text-[#FF5A36] hover:bg-orange-50/40 transition-colors font-medium"
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-xl text-[#1E2229] hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-[#1E2229]" />
            ) : (
              <Menu className="w-5 h-5 text-[#1E2229]" />
            )}
          </button>
        </div>

        {/* Tablet Hamburger button */}
        <div className="hidden sm:flex lg:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-[#1E2229] hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6 text-[#1E2229]" />
            ) : (
              <Menu className="w-6 h-6 text-[#1E2229]" />
            )}
          </button>
        </div>
      </div>

      {/* Immersive Full-Height Mobile Navigation Drawer — Zero Gap, Premium UI/UX */}
      <div
        className={`fixed inset-x-0 bottom-0 top-14 sm:top-16 bg-[#FBFBFC] z-40 lg:hidden flex flex-col justify-between transition-all duration-300 ease-out overflow-y-auto overscroll-contain ${
          mobileMenuOpen
            ? 'opacity-100 pointer-events-auto translate-y-0 visible'
            : 'opacity-0 pointer-events-none -translate-y-2 invisible'
        }`}
      >
        {/* Top Section: Navigation Cards */}
        <div className="px-4 py-3 space-y-3">
          {/* Active City Indicator / Switcher */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-white rounded-2xl border border-gray-200/80 shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1E2229]">
              <MapPin className="w-4 h-4 text-[#FF5A36]" />
              <span>Location:</span>
              <span className="text-[#FF5A36] font-bold">
                {selectedLang !== 'EN' ? selectedLang : (useStore.getState().filters.city || profile?.city || 'All India')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/explore');
              }}
              className="text-[11px] font-bold text-[#FF5A36] hover:underline cursor-pointer"
            >
              Change
            </button>
          </div>

          {/* Links List */}
          <nav className="flex flex-col space-y-1 bg-white rounded-3xl border border-gray-200/70 p-2 shadow-2xs">
            <Link
              to="/explore?tab=rooms"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-orange-50/70 active:bg-orange-50 text-[#1E2229] hover:text-[#FF5A36] transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-orange-50 text-[#FF5A36] flex items-center justify-center shrink-0 border border-orange-100/60 group-hover:scale-105 transition-transform">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold block text-[#1E2229] group-hover:text-[#FF5A36] transition-colors leading-tight">
                    Find a Room
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    Verified private & shared flats
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#FF5A36] group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/explore?tab=roommates"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-orange-50/70 active:bg-orange-50 text-[#1E2229] hover:text-[#FF5A36] transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100/60 group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold block text-[#1E2229] group-hover:text-[#FF5A36] transition-colors leading-tight">
                    Find Roommates
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    Match with compatible people
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#FF5A36] group-hover:translate-x-0.5 transition-all" />
            </Link>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onListSpace();
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-orange-50/70 active:bg-orange-50 text-[#1E2229] hover:text-[#FF5A36] transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/60 group-hover:scale-105 transition-transform">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold block text-[#1E2229] group-hover:text-[#FF5A36] transition-colors leading-tight">
                    List Your Space
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    Zero brokerage, instant reach
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#FF5A36] group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-orange-50/70 active:bg-orange-50 text-[#1E2229] hover:text-[#FF5A36] transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/60 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold block text-[#1E2229] group-hover:text-[#FF5A36] transition-colors leading-tight">
                    How It Works
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    Matching, screening & moving in
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#FF5A36] group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('trust')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-orange-50/70 active:bg-orange-50 text-[#1E2229] hover:text-[#FF5A36] transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/60 group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-bold block text-[#1E2229] group-hover:text-[#FF5A36] transition-colors leading-tight">
                    Safety & Trust
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    ID-verified profiles & privacy
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#FF5A36] group-hover:translate-x-0.5 transition-all" />
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('community')}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-orange-50/70 active:bg-orange-50 text-[#1E2229] hover:text-[#FF5A36] transition-all group cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8.5 h-8.5 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100/60 group-hover:scale-105 transition-transform">
                  <Heart className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-sm font-bold block text-[#1E2229] group-hover:text-[#FF5A36] transition-colors leading-tight">
                    Community
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    Reviews & happy residents
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#FF5A36] group-hover:translate-x-0.5 transition-all" />
            </button>
          </nav>
        </div>

        {/* Bottom Actions & Trust */}
        <div className="px-5 pt-3 pb-8 sm:pb-6 border-t border-gray-200/60 bg-white/95 backdrop-blur-xs flex flex-col gap-2.5">
          {isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 p-3 bg-[#FAF8F5] rounded-2xl border border-gray-200/80 shadow-2xs">
                <div className="w-10 h-10 rounded-full bg-orange-100 text-[#FF5A36] font-bold flex items-center justify-center text-sm shrink-0 overflow-hidden">
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    (profile?.name || user?.email || 'U')[0].toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#1E2229] truncate">{profile?.name || user?.email?.split('@')[0]}</p>
                  <p className="text-[10px] text-stone-500 capitalize">{profile?.role || 'Member'}</p>
                </div>
              </div>
              <Link
                to={dashboardPath}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-3.5 rounded-full bg-[#1E2229] text-white font-bold text-sm text-center shadow-sm hover:bg-black active:scale-[0.99] transition-all"
              >
                Go to Dashboard
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/explore" onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); openAuthModal(); }}
                  className="py-3 rounded-full border border-gray-300 text-center text-sm font-bold text-[#1E2229] bg-white hover:bg-gray-50 active:scale-[0.99] transition-all shadow-xs"
                >
                  Sign In
                </Link>
                <Link
                  to="/explore" onClick={(event) => { event.preventDefault(); setMobileMenuOpen(false); openAuthModal(); }}
                  className="py-3 rounded-full bg-[#1E2229] text-white text-center text-sm font-bold shadow-md hover:bg-black active:scale-[0.99] transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <p className="text-center text-[10px] font-medium text-stone-400">
                Zero Brokerage · 100% Verified Listings · Free to Join
              </p>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
