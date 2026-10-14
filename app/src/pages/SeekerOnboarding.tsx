import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { cities, localitiesByCity, professions } from '@/lib/staticData';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useStorage } from '@/hooks/useStorage';
import { useMatches } from '@/hooks/useMatches';
import { resolveEntityCoordinates } from '@/lib/locationResolver';
import { getPostOnboardingDestination } from '@/lib/roleNavigation';
import {
  Building2, User, Users, ShieldCheck, Check,
  ArrowRight, X, Sparkles, ChevronRight, Home, Camera,
  Briefcase, Calendar, CheckCircle2
} from 'lucide-react';

const CITY_SVG_ICONS: Record<string, React.ReactNode> = {
  'Bengaluru': (
    <svg className="w-5 h-5 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
      <path d="M12 2a4 4 0 0 0-4 4v4H4v8h16v-8h-4V6a4 4 0 0 0-4-4z" />
      <path d="M12 2v4M8 10h8M12 14v4M10 18h4" />
      <path d="M2 22h20" />
    </svg>
  ),
  'Mumbai': (
    <svg className="w-5 h-5 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
      <path d="M2 22h20" />
      <path d="M4 22V4h4v6a4 4 0 0 0 8 0V4h4v18" />
      <path d="M12 10v12" />
      <path d="M6 4l-2-2M18 4l2-2" />
    </svg>
  ),
  'Delhi NCR': (
    <svg className="w-5 h-5 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
      <path d="M2 22h20" />
      <path d="M6 22V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14" />
      <path d="M10 22v-6a2 2 0 0 1 4 0v6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  'Hyderabad': (
    <svg className="w-5 h-5 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
      <path d="M4 22V6M20 22V6M4 10h16" />
      <path d="M8 22v-6a4 4 0 0 1 8 0v6" />
      <path d="M4 6l4-4M20 6l-4-4" />
      <path d="M2 22h20" />
    </svg>
  ),
  'Pune': (
    <svg className="w-5 h-5 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
      <path d="M2 22h20" />
      <path d="M4 22v-8l4-4 4 4 4-4 4 4v8" />
      <path d="M10 22v-4h4v4" />
      <path d="M8 10V6M16 10V6" />
      <path d="M6 6h12" />
    </svg>
  ),
  'Chennai': (
    <svg className="w-5 h-5 stroke-current fill-none stroke-[1.5] stroke-linecap-round stroke-linejoin-round" viewBox="0 0 24 24">
      <path d="M12 2v20M8 6l4-4 4 4M6 10l6-4 6 4M4 14l8-4 8 4M2 18l10-4 10 4M2 22h20" />
    </svg>
  ),
};

export default function SeekerOnboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const { updateProfile } = useUserProfile();
  const { uploadProfilePicture } = useStorage();
  const { findMatches } = useMatches();

  const [loading, setLoading] = useState(false);
  const [matchScreenState, setMatchScreenState] = useState<'form' | 'loading' | 'success'>('form');
  const [matchCount, setMatchCount] = useState(0);
  const [error, setError] = useState('');

  // 1. Seeker Intent / Housing Mode
  const [housingIntent, setHousingIntent] = useState<'find_room' | 'team_up'>('find_room');
  const roommateSetupRequested = new URLSearchParams(location.search).get('roommate') === '1';
  const [roommateDiscoveryEnabled, setRoommateDiscoveryEnabled] = useState(() =>
    roommateSetupRequested || authProfile?.roommateDiscoveryEnabled === true
  );
  const returnDestination = new URLSearchParams(location.search).get('redirect');
  const postOnboardingDestination = getPostOnboardingDestination(housingIntent, returnDestination);
  const hasReturnDestination = postOnboardingDestination !== (housingIntent === 'team_up' ? '/explore?tab=roommates' : '/explore?tab=rooms');

  // 2. Personal Basics & Avatar
  const googlePhoto = user ? (user.photoURL || user.providerData?.find(p => p.photoURL)?.photoURL || '') : '';
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(() => {
    return authProfile?.avatar || googlePhoto || null;
  });
  const [name, setName] = useState(() => authProfile?.name || user?.displayName || '');
  const [age, setAge] = useState(() => authProfile?.age ? String(authProfile.age) : '24');
  const [gender, setGender] = useState<'female' | 'male' | 'other'>(() => (authProfile?.gender as any) || 'female');
  const [profession, setProfession] = useState(() => authProfile?.profession || 'Software Engineer');

  // 3. Location & Budget
  const [city, setCity] = useState(() => authProfile?.city || 'Bengaluru');
  const [localities, setLocalities] = useState<string[]>(() => {
    return authProfile?.localities && authProfile.localities.length > 0
      ? authProfile.localities
      : ['Koramangala', 'HSR Layout'];
  });
  const [budget, setBudget] = useState<number>(() => authProfile?.budget || 15000);
  const [moveIn, setMoveIn] = useState<string>(() => authProfile?.moveInDate || 'Immediate');

  // 4. Lifestyle & Compatibility Answers
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>(() => {
    return authProfile?.quizAnswers && Object.keys(authProfile.quizAnswers).length > 0
      ? authProfile.quizAnswers
      : {
        sleep_time: '10_to_12',
        wake_time: '6_to_8',
        food_pref: 'veg',
        smoking: 'never',
        drinking: 'socially',
        guests: 'sometimes',
        cleanliness: 'very',
        work_mode: 'hybrid',
        pets: 'ok',
        roommate_gender: 'any',
      };
  });

  // Sync avatar and name if auth profile loads asynchronously
  useEffect(() => {
    if (!avatarPreview && !avatarFile) {
      const existing = authProfile?.avatar || user?.photoURL || user?.providerData?.find(p => p.photoURL)?.photoURL;
      if (existing) setAvatarPreview(existing);
    }
    if (!name && authProfile?.name) {
      setName(authProfile.name);
    }
  }, [authProfile, user, avatarPreview, avatarFile, name]);

  // Completed users do not need to repeat setup; preserve any requested local destination.
  useEffect(() => {
    if (authProfile?.onboardingComplete && !roommateSetupRequested && matchScreenState === 'form') {
      navigate(postOnboardingDestination, { replace: true });
    }
  }, [authProfile?.onboardingComplete, roommateSetupRequested, matchScreenState, navigate, postOnboardingDestination]);

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const toggleLocality = (loc: string) => {
    setLocalities(prev => {
      if (prev.includes(loc)) {
        return prev.filter(l => l !== loc);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), loc];
      }
      return [...prev, loc];
    });
  };

  const setAnswer = (questionId: string, answerId: string) => {
    setQuizAnswers(prev => ({ ...prev, [questionId]: answerId }));
  };

  const availableLocalities = localitiesByCity[city] || [
    'Koramangala', 'HSR Layout', 'Indiranagar', 'Whitefield', 'Electronic City', 'BTM Layout'
  ];

  const handleFinish = async (destination: 'dashboard' | 'verify' = 'dashboard') => {
    if (!user) {
      setError('Please log in to continue.');
      return;
    }

    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const parsedAge = parseInt(age, 10);
    if (!age || isNaN(parsedAge) || parsedAge < 18 || parsedAge > 65) {
      setError('Please enter a valid age between 18 and 65.');
      return;
    }

    if (!city) {
      setError('Please select a target city.');
      return;
    }

    if (localities.length === 0) {
      setError('Please select at least one preferred area.');
      return;
    }

    setLoading(true);
    setError('');
    setMatchScreenState('loading');

    try {
      const resolvedGeo = resolveEntityCoordinates({
        uid: user.uid,
        city,
        locality: localities[0],
        localities,
      });

      const fallbackAvatar = avatarPreview && !avatarPreview.startsWith('blob:')
        ? avatarPreview
        : (authProfile?.avatar || user.photoURL || user.providerData?.find(p => p.photoURL)?.photoURL || '');

      await updateProfile(user.uid, {
        name: name.trim(),
        age: parsedAge,
        gender,
        profession,
        city,
        localities,
        budget,
        housingIntent,
        moveInDate: moveIn,
        ...(roommateDiscoveryEnabled ? { quizAnswers } : {}),
        roommateDiscoveryEnabled,
        onboardingComplete: true,
        ...(fallbackAvatar ? { avatar: fallbackAvatar } : {}),
        ...(resolvedGeo && {
          geoLocation: {
            lat: resolvedGeo.lat,
            lng: resolvedGeo.lng,
            formattedAddress: `${localities[0] || city}, ${city}`
          }
        }),
      });

      if (avatarFile) {
        try {
          const url = await uploadProfilePicture(avatarFile, user.uid, () => {});
          if (url) await updateProfile(user.uid, { avatar: url });
        } catch { /* non-blocking */ }
      }

      const updated = await refreshProfile(user.uid);
      if (updated && roommateDiscoveryEnabled) {
        try {
          const matches = await findMatches(updated, city);
          setMatchCount(matches.length);
        } catch { /* non-blocking */ }
      }

      if (destination === 'verify') {
        navigate('/profile', { state: { openVerification: true } });
        return;
      }

      setMatchScreenState('success');
    } catch (err: any) {
      console.error('Failed to complete seeker onboarding:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
      setMatchScreenState('form');
      setLoading(false);
    }
  };

  // ── Match Loading Screen ──
  if (matchScreenState === 'loading') {
    return (
      <div className="min-h-screen bg-[#FBFBFC] sm:bg-[#0E101A] flex flex-col justify-center items-center py-0 sm:py-14 lg:py-16 px-0 sm:px-6 lg:px-8 select-none font-sans text-slate-800">
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-b from-orange-500/15 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-xl bg-white sm:rounded-[36px] p-8 sm:p-12 text-center sm:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.1),0_12px_28px_-6px_rgba(0,0,0,0.25),0_36px_72px_-12px_rgba(0,0,0,0.45),0_64px_120px_-20px_rgba(0,0,0,0.55)] sm:border sm:border-slate-200/60">
          <div className="w-20 h-20 rounded-full bg-[#FFF2EB] border border-[#FF5A36]/20 flex items-center justify-center mx-auto mb-6 shadow-sm animate-pulse">
            <Sparkles className="w-8 h-8 text-[#FF5A36]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-medium text-slate-900 tracking-tight mb-2">
            Finding your matches…
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
            Running 10-point lifestyle compatibility and location affinity matching across {city}.
          </p>
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-3 h-3 rounded-full bg-[#FF5A36] animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Match Success Screen ──
  if (matchScreenState === 'success') {
    return (
      <div className="min-h-screen bg-[#FBFBFC] sm:bg-[#0E101A] flex flex-col justify-center items-center py-0 sm:py-14 lg:py-16 px-0 sm:px-6 lg:px-8 select-none font-sans text-slate-800">
        <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-b from-orange-500/15 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 w-full max-w-xl bg-white sm:rounded-[36px] p-8 sm:p-12 text-center sm:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.1),0_12px_28px_-6px_rgba(0,0,0,0.25),0_36px_72px_-12px_rgba(0,0,0,0.45),0_64px_120px_-20px_rgba(0,0,0,0.55)] sm:border sm:border-slate-200/60">
          <div className="w-20 h-20 rounded-full bg-emerald-50 border border-emerald-200/70 flex items-center justify-center mx-auto mb-6 shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-medium text-slate-900 tracking-tight mb-2">
            You're all set, {name.split(' ')[0]}!
          </h2>
          <p className="text-sm sm:text-base text-slate-600 mb-2">
            {roommateDiscoveryEnabled ? <>We discovered{' '}
              <span className="font-bold text-[#FF5A36] text-xl">
                {matchCount > 0 ? matchCount : 'new'}
              </span>{' '}compatible roommates in {city}.</> : 'Your shared NestMate profile is ready.'}
          </p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mb-8">
            {roommateDiscoveryEnabled
              ? 'Ranked by mutual budget overlap, lifestyle norms, and neighborhood proximity.'
              : 'You can set up roommate discovery later without changing accounts.'}
          </p>

          <button
            type="button"
            onClick={() => navigate(postOnboardingDestination, { replace: true })}
            className="w-full sm:w-auto min-w-[280px] px-9 py-4 rounded-full bg-gradient-to-r from-[#FF5A36] to-[#F26428] hover:from-[#E54E2B] hover:to-[#FF5A36] text-white font-bold text-sm sm:text-base transition-all duration-200 shadow-[0_4px_16px_rgba(229,80,26,0.22),0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_22px_rgba(229,80,26,0.32),0_2px_5px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] inline-flex items-center justify-center gap-2.5 mx-auto cursor-pointer"
          >
            <span>{hasReturnDestination ? 'Continue' : housingIntent === 'team_up' ? 'View My Matches' : 'View Rooms'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Main Seeker Setup Experience ──
  return (
    <div className="min-h-screen bg-[#FBFBFC] sm:bg-[#0E101A] flex flex-col justify-center items-center py-0 sm:py-14 lg:py-16 px-0 sm:px-6 lg:px-8 select-none font-sans text-slate-800">
      {/* Ambient background lighting on desktop */}
      <div className="hidden sm:block absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-b from-orange-500/15 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="hidden sm:block absolute bottom-0 right-10 w-[750px] h-[450px] bg-[#1E3A5F]/25 rounded-full blur-3xl pointer-events-none" />

      {/* Main Luxury Container: EXPANDED max-w-5xl / lg:max-w-6xl WITH MULTI-LAYER SHADOW & GENEROUS PADDING */}
      <div className="relative z-10 w-full max-w-5xl lg:max-w-6xl xl:max-w-6xl bg-white sm:rounded-[36px] p-6 sm:p-10 md:p-12 lg:p-14 xl:p-16 sm:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.1),0_12px_28px_-6px_rgba(0,0,0,0.25),0_36px_72px_-12px_rgba(0,0,0,0.45),0_64px_120px_-20px_rgba(0,0,0,0.55)] sm:border sm:border-slate-200/60 my-0 sm:my-auto">

        {/* Top-Right Dismiss Button */}
        <button
          type="button"
          onClick={() => navigate(postOnboardingDestination)}
          aria-label="Close"
          className="absolute top-5 right-5 sm:top-7 sm:right-7 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Clean, Editorial Header with proper spacing */}
        <div className="text-center pt-2 sm:pt-0 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FFF2EB] border border-[#FF5A36]/20 text-[#FF5A36] text-xs font-semibold mb-3.5 shadow-[0_1px_3px_rgba(229,80,26,0.06)]">
            <Sparkles className="w-3.5 h-3.5 text-[#FF5A36]" />
            <span>NestMate profile setup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-medium text-slate-900 tracking-tight">
            Set up your NestMate profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Add your shared details once. Roommate compatibility is optional and can be enabled when you want it.
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium flex items-center justify-between shadow-[0_2px_8px_rgba(239,68,68,0.08)]">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="text-red-400 hover:text-red-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="space-y-10 sm:space-y-11">

          {/* SECTION 1: SEEKER INTENT (Full-width 2-card selector) */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700 tracking-wide">
              I am looking to
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Find an Existing Room */}
              <div
                onClick={() => setHousingIntent('find_room')}
                className={`p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  housingIntent === 'find_room'
                    ? 'border-[#FF5A36] bg-gradient-to-br from-[#FFFBF9] via-[#FFF8F4] to-[#FFF1EA] shadow-[0_4px_16px_rgba(229,80,26,0.12),0_12px_32px_-6px_rgba(229,80,26,0.16)] ring-1 ring-[#FF5A36]/20'
                    : 'border-slate-200/85 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.02),0_8px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04),0_16px_32px_-8px_rgba(0,0,0,0.08)] hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    housingIntent === 'find_room'
                      ? 'bg-[#FFF0E8] text-[#FF5A36] shadow-[0_2px_8px_rgba(229,80,26,0.15)]'
                      : 'bg-slate-100/90 text-slate-500 shadow-2xs'
                  }`}>
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Find an Existing Room</div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Move into an already occupied flat with available rooms and verified roommates.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option B: Team-Up to Rent Together */}
              <div
                onClick={() => { setHousingIntent('team_up'); setRoommateDiscoveryEnabled(true); }}
                className={`p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  housingIntent === 'team_up'
                    ? 'border-[#FF5A36] bg-gradient-to-br from-[#FFFBF9] via-[#FFF8F4] to-[#FFF1EA] shadow-[0_4px_16px_rgba(229,80,26,0.12),0_12px_32px_-6px_rgba(229,80,26,0.16)] ring-1 ring-[#FF5A36]/20'
                    : 'border-slate-200/85 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.02),0_8px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04),0_16px_32px_-8px_rgba(0,0,0,0.08)] hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    housingIntent === 'team_up'
                      ? 'bg-[#FFF0E8] text-[#FF5A36] shadow-[0_2px_8px_rgba(229,80,26,0.15)]'
                      : 'bg-slate-100/90 text-slate-500 shadow-2xs'
                  }`}>
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Team-Up & Rent Together</div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Connect with like-minded seekers to jointly search, pool budget, and lease a fresh flat.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 & 3: WIDE DESKTOP 2-COLUMN BALANCED WORKSPACE GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 xl:gap-16 pt-2">

            {/* LEFT COLUMN: SEEKER IDENTITY & SEARCH CRITERIA */}
            <div className={roommateDiscoveryEnabled ? 'space-y-7 sm:space-y-8' : 'hidden'}>
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                <User className="w-4 h-4 text-[#FF5A36]" />
                <h2 className="text-sm font-semibold text-slate-900 tracking-wide">
                  Profile & Room Search Preferences
                </h2>
              </div>

              {/* Photo Upload & Identity */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 shadow-[0_2px_6px_rgba(0,0,0,0.02)] flex items-center gap-4">
                <label className="relative cursor-pointer group shrink-0">
                  <div className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all flex items-center justify-center bg-slate-50 ${
                    avatarPreview ? 'border-[#FF5A36] shadow-xs' : 'border-dashed border-slate-300'
                  }`}>
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-semibold">
                    <span>Change</span>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                </label>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900">Profile Photo</div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    A clear photo increases trust and match response rates by 4.2x.
                  </p>
                  {avatarPreview && !avatarFile && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 mt-1">
                      <Check className="w-3 h-3" /> Synced from Google
                    </span>
                  )}
                </div>
              </div>

              {/* Display Name & Age */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Your display name*
                  </label>
                  <div className="relative flex items-center bg-white border border-slate-200/90 rounded-xl px-4 py-3 sm:py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#FF5A36] focus-within:ring-4 focus-within:ring-[#FF5A36]/10 focus-within:shadow-[0_2px_8px_rgba(229,80,26,0.08)] transition-all">
                    <User className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Ananya Rao"
                      className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Your age* (18–65)
                  </label>
                  <div className="relative flex items-center bg-white border border-slate-200/90 rounded-xl px-4 py-3 sm:py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#FF5A36] focus-within:ring-4 focus-within:ring-[#FF5A36]/10 focus-within:shadow-[0_2px_8px_rgba(229,80,26,0.08)] transition-all">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
                    <input
                      type="number"
                      min={18}
                      max={65}
                      value={age}
                      onChange={e => setAge(e.target.value)}
                      placeholder="24"
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Gender Identity & Profession */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    I identify as*
                  </label>
                  <div className="bg-slate-100/90 border border-slate-200/60 p-1.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] grid grid-cols-3 gap-1">
                    {[
                      { id: 'female', label: 'Female' },
                      { id: 'male', label: 'Male' },
                      { id: 'other', label: 'Other' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setGender(opt.id as any)}
                        className={`py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center ${
                          gender === opt.id
                            ? 'bg-white text-slate-900 shadow-[0_2px_6px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/80 font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Profession*
                  </label>
                  <div className="relative flex items-center bg-white border border-slate-200/90 rounded-xl px-4 py-3 sm:py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#FF5A36] focus-within:ring-4 focus-within:ring-[#FF5A36]/10 focus-within:shadow-[0_2px_8px_rgba(229,80,26,0.08)] transition-all">
                    <Briefcase className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
                    <select
                      value={profession}
                      onChange={e => setProfession(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-900 outline-none cursor-pointer"
                    >
                      {professions.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Target City */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Target city*
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {cities.map(c => {
                    const isSelected = city === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setCity(c);
                          const newDefaults = localitiesByCity[c] || [];
                          setLocalities(newDefaults.slice(0, 2));
                        }}
                        className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36] font-semibold shadow-[0_2px_8px_rgba(229,80,26,0.12)]'
                            : 'border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white text-[#FF5A36]' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {CITY_SVG_ICONS[c] || <Building2 className="w-4 h-4" />}
                        </div>
                        <span className="truncate">{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Localities (Up to 3) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Preferred areas in {city}*
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {localities.length}/3 selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableLocalities.map(loc => {
                    const isSelected = localities.includes(loc);
                    return (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => toggleLocality(loc)}
                        className={`py-2 px-3.5 rounded-full border text-xs transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                          isSelected
                            ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36] font-semibold shadow-[0_2px_6px_rgba(229,80,26,0.12)]'
                            : 'border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        <span>{loc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Monthly Budget & Move-in Availability */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Monthly rent budget (₹)*
                  </label>
                  <span className="text-sm font-bold text-[#FF5A36]">
                    ₹{budget.toLocaleString()}<span className="text-xs font-normal text-slate-400">/mo</span>
                  </span>
                </div>
                <div className="space-y-2.5">
                  <input
                    type="range"
                    min={4000}
                    max={40000}
                    step={1000}
                    value={budget}
                    onChange={e => setBudget(parseInt(e.target.value, 10))}
                    className="w-full accent-[#FF5A36] cursor-pointer"
                  />
                  <div className="flex justify-between gap-1.5">
                    {[8000, 12000, 16000, 22000, 30000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setBudget(val)}
                        className={`py-1.5 px-2.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                          budget === val
                            ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        ₹{(val / 1000)}k
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Move-in Availability */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Target move-in timeline*
                </label>
                <div className="bg-slate-100/90 border border-slate-200/60 p-1.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { val: 'Immediate', label: 'Immediate' },
                    { val: '15 Days', label: 'Within 15 Days' },
                    { val: '30 Days', label: 'Within 30 Days' },
                    { val: 'Flexible', label: 'Flexible' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setMoveIn(opt.val)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                        moveIn === opt.val
                          ? 'bg-white text-slate-900 shadow-[0_2px_6px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/80 font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: LIFESTYLE NORMS & FLATMATES COMPATIBILITY FIT */}
            <div className="space-y-7 sm:space-y-8">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-[#FF5A36]" />
                <h2 className="text-sm font-semibold text-slate-900 tracking-wide">
                  Lifestyle Norms & Compatibility Fit
                </h2>
              </div>

              {/* Preferred Roommate Gender */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Preferred roommate gender
                </label>
                <div className="bg-slate-100/90 border border-slate-200/60 p-1.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] grid grid-cols-3 gap-1">
                  {[
                    { id: 'female', label: 'Female Only' },
                    { id: 'male', label: 'Male Only' },
                    { id: 'any', label: 'Any Gender' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAnswer('roommate_gender', opt.id)}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        quizAnswers.roommate_gender === opt.id
                          ? 'bg-white text-slate-900 shadow-[0_2px_6px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/80 font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Living Norms Cards Grid with rich elevation & spacing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Sleep Schedule */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Sleep schedule</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    {[
                      { id: 'before_10', label: 'Before 10 PM' },
                      { id: '10_to_12', label: '10 PM - 12 AM' },
                      { id: 'after_12', label: 'Night Owl' },
                      { id: 'varies', label: 'Varies' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswer('sleep_time', opt.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                          quizAnswers.sleep_time === opt.id
                            ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wake-Up Schedule */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Wake up schedule</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    {[
                      { id: 'before_6', label: 'Before 6 AM' },
                      { id: '6_to_8', label: '6 AM - 8 AM' },
                      { id: '8_to_10', label: '8 AM - 10 AM' },
                      { id: 'after_10', label: 'After 10 AM' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswer('wake_time', opt.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                          quizAnswers.wake_time === opt.id
                            ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Food & Kitchen */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Kitchen / Food preference</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    {[
                      { id: 'veg', label: 'Vegetarian' },
                      { id: 'non_veg', label: 'Non-veg' },
                      { id: 'vegan', label: 'Vegan' },
                      { id: 'no_pref', label: 'Any / No pref' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswer('food_pref', opt.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                          quizAnswers.food_pref === opt.id
                            ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Smoking Policy */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Smoking policy</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    {[
                      { id: 'never', label: '🚭 Never' },
                      { id: 'outside', label: 'Outside only' },
                      { id: 'socially', label: 'Socially' },
                      { id: 'regularly', label: 'Regular' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswer('smoking', opt.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                          quizAnswers.smoking === opt.id
                            ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Drinking Policy */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Drinking habit</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-3 gap-1">
                    {[
                      { id: 'never', label: 'Never' },
                      { id: 'socially', label: '🍷 Social' },
                      { id: 'regularly', label: 'Regular' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswer('drinking', opt.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                          quizAnswers.drinking === opt.id
                            ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Guests & Visitors */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Guests & visitors</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    {[
                      { id: 'rarely', label: 'Rarely / Never' },
                      { id: 'sometimes', label: 'Sometimes' },
                      { id: 'often', label: 'Often' },
                      { id: 'very_often', label: 'Frequent' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswer('guests', opt.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                          quizAnswers.guests === opt.id
                            ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cleanliness Standards */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Cleanliness standards</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-3 gap-1">
                    {[
                      { id: 'very', label: '✨ Very tidy' },
                      { id: 'somewhat', label: 'Moderate' },
                      { id: 'relaxed', label: 'Relaxed' },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswer('cleanliness', opt.id)}
                        className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                          quizAnswers.cleanliness === opt.id
                            ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Work Mode & Pets */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <div>
                    <span className="text-xs text-slate-600 font-medium block mb-1.5">Work mode</span>
                    <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-3 gap-1">
                      {[
                        { id: 'hybrid', label: 'Hybrid' },
                        { id: 'wfh', label: 'Remote' },
                        { id: 'wfo', label: 'Office' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAnswer('work_mode', opt.id)}
                          className={`py-1.5 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                            quizAnswers.work_mode === opt.id
                              ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-600 font-medium block mb-1.5">Pets policy</span>
                    <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-3 gap-1">
                      {[
                        { id: 'love', label: '🐾 Love' },
                        { id: 'ok', label: 'Pets OK' },
                        { id: 'no', label: 'No Pets' },
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setAnswer('pets', opt.id)}
                          className={`py-1.5 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                            quizAnswers.pets === opt.id
                              ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* SECTION 4: PUBLISHING TRUST STANDARDS (Full-width reassurance bar) */}
          <div className="bg-gradient-to-r from-slate-50/90 via-white to-[#FFF9F6] border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.02),0_8px_24px_-8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4.5 h-4.5 text-[#FF5A36]" />
                <span className="text-xs sm:text-sm font-semibold text-slate-900">
                  NestMate Seeker Trust & Matching Standards
                </span>
              </div>
              <Link
                to="/trust"
                className="text-xs font-medium text-[#FF5A36] hover:underline inline-flex items-center gap-0.5"
              >
                <span>Trust & Safety Center</span>
                <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#FF5A36] shrink-0 font-bold" />
                <span>Tier 2 Govt ID Verified Members</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#FF5A36] shrink-0 font-bold" />
                <span>10-Point Lifestyle Compatibility Engine</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#FF5A36] shrink-0 font-bold" />
                <span>100% Zero Brokerage Platform</span>
              </div>
            </div>
          </div>

          {/* ACTIONS ROW WITH LUXURY CALL-TO-ACTION ELEVATION */}
          <div className="pt-4 sm:pt-6 space-y-4 text-center">
            {/* Primary Submit Pill Button */}
            <button
              type="button"
              onClick={() => handleFinish('dashboard')}
              disabled={loading}
              className="w-full sm:w-auto min-w-[300px] sm:min-w-[320px] px-9 py-4 rounded-full bg-gradient-to-r from-[#FF5A36] to-[#F26428] hover:from-[#E54E2B] hover:to-[#FF5A36] text-white font-bold text-sm sm:text-base transition-all duration-200 shadow-[0_4px_16px_rgba(229,80,26,0.22),0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_22px_rgba(229,80,26,0.32),0_2px_5px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] inline-flex items-center justify-center gap-2.5 mx-auto cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{hasReturnDestination ? 'Complete Setup & Continue' : housingIntent === 'team_up' ? 'Find Compatible Roommates' : 'Find a Room'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Secondary Actions */}
            <div className="flex items-center justify-center gap-3.5 pt-1">
              <button
                type="button"
                onClick={() => handleFinish('verify')}
                disabled={loading}
                className="py-2.5 px-5 border border-slate-200/90 rounded-full text-xs font-semibold text-slate-700 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Verify Identity Now
              </button>
              <button
                type="button"
                onClick={() => navigate(postOnboardingDestination)}
                disabled={loading}
                className="py-2.5 px-5 border border-slate-200/90 rounded-full text-xs font-semibold text-slate-700 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>

            {/* Shared account setup: listing creation remains available after completion. */}
            <div className="pt-2 text-center">
              <p className="text-xs text-slate-400">
                Have a room to list? Complete this shared profile setup, then post your listing.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
