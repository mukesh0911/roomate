import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { cities, localitiesByCity, flatTypes } from '@/lib/staticData';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useStore } from '@/store/useStore';
import {
  Building2, User, MapPin, ShieldCheck, Check,
  ArrowRight, X, Sparkles, ChevronRight,
  Home, Plus,
  Wifi, Wind, Flame, WashingMachine, Refrigerator, Tv, Car, Dumbbell, Zap
} from 'lucide-react';

export default function OwnerOnboarding() {
  const navigate = useNavigate();
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const { updateProfile } = useUserProfile();
  const { setCurrentRole } = useStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Owner Identity & Role
  const [ownerType, setOwnerType] = useState<'owner_flatmate' | 'landlord'>('owner_flatmate');
  const [ownerName, setOwnerName] = useState(authProfile?.name || user?.displayName || '');

  // 2. Property Basics & Space Details
  const [city, setCity] = useState(authProfile?.city || 'Bengaluru');
  const [locality, setLocality] = useState(authProfile?.localities?.[0] || '');
  const [flatType, setFlatType] = useState('2BHK');
  const [totalRooms, setTotalRooms] = useState('2');
  const [roomsToOffer, setRoomsToOffer] = useState('1');
  const [furnishing, setFurnishing] = useState('Semi-Furnished');
  const [monthlyRent, setMonthlyRent] = useState('15000');
  const [availableFrom, setAvailableFrom] = useState('Immediate');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    'WiFi', 'AC', 'Geyser', 'Washing Machine'
  ]);

  // 3. Household Expectations & Living Norms
  const [genderPref, setGenderPref] = useState<'any' | 'female' | 'male'>('any');
  const [dietPref, setDietPref] = useState<'any' | 'veg'>('any');
  const [smokingPolicy, setSmokingPolicy] = useState<'no_smoking' | 'social_ok'>('no_smoking');
  const [petPolicy, setPetPolicy] = useState<'no_pets' | 'pets_ok'>('pets_ok');
  const [drinkingPolicy, setDrinkingPolicy] = useState<'social_ok' | 'no_drinking'>('social_ok');
  const [guestPolicy, setGuestPolicy] = useState<'guests_welcome' | 'no_overnight'>('guests_welcome');
  const [quietHoursPolicy, setQuietHoursPolicy] = useState<'quiet_11pm' | 'flexible'>('quiet_11pm');
  const [cleanlinessPolicy, setCleanlinessPolicy] = useState<'high' | 'flexible'>('high');

  // House Rules checklist & custom rules
  const [selectedRules, setSelectedRules] = useState<string[]>([
    'No smoking inside', 'Maintain cleanliness', 'Quiet after 11 PM'
  ]);
  const [customRules, setCustomRules] = useState<string[]>([]);
  const [customRuleInput, setCustomRuleInput] = useState('');

  const availableLocalities = localitiesByCity[city] || [
    'Koramangala', 'Indiranagar', 'HSR Layout', 'Whitefield', 'BTM Layout'
  ];

  const AMENITIES_GRID = [
    { id: 'WiFi', label: 'WiFi', icon: Wifi },
    { id: 'AC', label: 'AC', icon: Wind },
    { id: 'Fridge', label: 'Fridge', icon: Refrigerator },
    { id: 'Washing Machine', label: 'Washing', icon: WashingMachine },
    { id: 'Geyser', label: 'Geyser', icon: Flame },
    { id: 'TV', label: 'TV', icon: Tv },
    { id: 'Parking', label: 'Parking', icon: Car },
    { id: 'Gym', label: 'Gym', icon: Dumbbell },
    { id: 'Power Backup', label: 'Backup', icon: Zap },
  ];

  const standardRules = [
    'No smoking inside', 'Veg kitchen only', 'Quiet after 11 PM',
    'No pets', 'No guests overnight', 'Maintain cleanliness', 'No parties'
  ];

  // Document title
  useEffect(() => {
    document.title = 'Owner Onboarding | NestMate';
  }, []);

  // Prefill from existing profile if available
  useEffect(() => {
    if (authProfile?.name && !ownerName) {
      setOwnerName(authProfile.name);
    }
    if (authProfile?.city) {
      setCity(authProfile.city);
    }
    if (authProfile?.localities && authProfile.localities.length > 0) {
      const savedLoc = authProfile.localities[0];
      setLocality(savedLoc);
    }
    if ((authProfile as any)?.ownerType) {
      setOwnerType((authProfile as any).ownerType);
    }
  }, [authProfile, ownerName]);

  // If owner has already completed onboarding upon initial mount, redirect to dashboard
  useEffect(() => {
    if (authProfile?.onboardingComplete) {
      navigate('/owner-dashboard', { replace: true });
    }
  }, [authProfile?.onboardingComplete, navigate]);

  const toggleAmenity = (item: string) => {
    setSelectedAmenities(prev =>
      prev.includes(item) ? prev.filter(a => a !== item) : [...prev, item]
    );
  };

  const toggleRule = (rule: string) => {
    setSelectedRules(prev =>
      prev.includes(rule) ? prev.filter(r => r !== rule) : [...prev, rule]
    );
  };

  const addCustomRule = () => {
    const trimmed = customRuleInput.trim();
    if (!trimmed) return;
    if (!customRules.includes(trimmed) && !selectedRules.includes(trimmed)) {
      setCustomRules(prev => [...prev, trimmed]);
    }
    setCustomRuleInput('');
  };

  const removeCustomRule = (rule: string) => {
    setCustomRules(prev => prev.filter(r => r !== rule));
  };

  const handleFinish = async (destination: 'listing' | 'dashboard' | 'verify') => {
    if (!user) {
      setError('Please log in to continue.');
      return;
    }

    if (!ownerName.trim()) {
      setError('Please enter your name.');
      return;
    }

    if (!city.trim()) {
      setError('Please select your property city.');
      return;
    }

    if (!locality.trim()) {
      setError('Please select or enter your property locality.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      setCurrentRole('owner');
      const googlePhoto = user.photoURL || user.providerData?.find(p => p.photoURL)?.photoURL || '';
      const resolvedAvatar = authProfile?.avatar || googlePhoto || '';

      const parsedRent = parseInt(monthlyRent.replace(/[^0-9]/g, ''), 10) || 0;
      const share = Math.round(parsedRent / ((parseInt(roomsToOffer, 10) || 1) + 1));

      await updateProfile(user.uid, {
        name: ownerName,
        role: 'owner',
        ownerType,
        city: city || 'Bengaluru',
        localities: [locality || (availableLocalities[0] || 'Central')],
        budget: share,
        moveInDate: availableFrom,
        ...(resolvedAvatar ? { avatar: resolvedAvatar } : {}),
        propertyBasics: {
          city: city || 'Bengaluru',
          locality: locality || (availableLocalities[0] || 'Central'),
          flatType,
          furnishing,
          monthlyRent: parsedRent,
          availableFrom,
          amenities: selectedAmenities,
          totalRooms: parseInt(totalRooms, 10) || 2,
          roomsToOffer: parseInt(roomsToOffer, 10) || 1,
        },
        householdExpectations: {
          genderPref,
          dietPref,
          smokingPolicy,
          petPolicy,
          drinkingPolicy,
          guestPolicy,
          quietHoursPolicy,
          cleanlinessPolicy,
          houseRules: [...selectedRules, ...customRules],
        },
        onboardingComplete: true,
      });

      await refreshProfile(user.uid);

      if (destination === 'listing') {
        // Carry property basics & house rules to prefill listing creator
        navigate('/edit-listing/new', {
          state: {
            prefill: {
              city: city || 'Bengaluru',
              locality: locality || (availableLocalities[0] || 'Central'),
              flatType,
              furnishing,
              monthlyRent: parsedRent,
              deposit: parsedRent * 2,
              availableFrom,
              amenities: selectedAmenities,
              houseRules: [
                ...selectedRules,
                dietPref === 'veg' ? 'Veg kitchen only' : null,
                smokingPolicy === 'no_smoking' ? 'No smoking inside' : null,
                petPolicy === 'no_pets' ? 'No pets' : 'Pets friendly',
                drinkingPolicy === 'no_drinking' ? 'No alcohol inside' : null,
                guestPolicy === 'no_overnight' ? 'No overnight guests' : null,
                quietHoursPolicy === 'quiet_11pm' ? 'Quiet after 11 PM' : null,
                ...customRules,
              ].filter(Boolean),
            }
          }
        });
      } else if (destination === 'verify') {
        navigate('/profile', { state: { openVerification: true } });
      } else {
        navigate('/owner-dashboard');
      }
    } catch (err: any) {
      console.error('Failed to complete owner onboarding:', err);
      setError(err.message || 'Failed to save onboarding. Please try again.');
      setLoading(false);
    }
  };

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
          onClick={() => {
            if (authProfile?.onboardingComplete) {
              navigate('/owner-dashboard');
            } else {
              navigate('/explore?tab=rooms');
            }
          }}
          aria-label="Close"
          className="absolute top-5 right-5 sm:top-7 sm:right-7 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Clean, Editorial Header with proper spacing */}
        <div className="text-center pt-2 sm:pt-0 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#FFF2EB] border border-[#FF5A36]/20 text-[#FF5A36] text-xs font-semibold mb-3.5 shadow-[0_1px_3px_rgba(229,80,26,0.06)]">
            <Building2 className="w-3.5 h-3.5 text-[#FF5A36]" />
            <span>NestMate Owner Setup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-medium text-slate-900 tracking-tight">
            Add your room details
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
            Set up your property basics and household expectations to get verified and discover roommates.
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
          
          {/* SECTION 1: ROLE SELECTION (Full-width 2-card selector with multi-layered depth) */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-slate-700 tracking-wide">
              I am listing as
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Live-in Flatmate */}
              <div
                onClick={() => setOwnerType('owner_flatmate')}
                className={`p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  ownerType === 'owner_flatmate'
                    ? 'border-[#FF5A36] bg-gradient-to-br from-[#FFFBF9] via-[#FFF8F4] to-[#FFF1EA] shadow-[0_4px_16px_rgba(229,80,26,0.12),0_12px_32px_-6px_rgba(229,80,26,0.16)] ring-1 ring-[#FF5A36]/20'
                    : 'border-slate-200/85 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.02),0_8px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04),0_16px_32px_-8px_rgba(0,0,0,0.08)] hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    ownerType === 'owner_flatmate'
                      ? 'bg-[#FFF0E8] text-[#FF5A36] shadow-[0_2px_8px_rgba(229,80,26,0.15)]'
                      : 'bg-slate-100/90 text-slate-500 shadow-2xs'
                  }`}>
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Live-in Roommate / Host</div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      I live here & have a spare room. Seekers match with your lifestyle compatibility.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option B: Landlord / Manager */}
              <div
                onClick={() => setOwnerType('landlord')}
                className={`p-5 sm:p-6 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  ownerType === 'landlord'
                    ? 'border-[#FF5A36] bg-gradient-to-br from-[#FFFBF9] via-[#FFF8F4] to-[#FFF1EA] shadow-[0_4px_16px_rgba(229,80,26,0.12),0_12px_32px_-6px_rgba(229,80,26,0.16)] ring-1 ring-[#FF5A36]/20'
                    : 'border-slate-200/85 bg-white shadow-[0_2px_6px_rgba(0,0,0,0.02),0_8px_20px_-4px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.04),0_16px_32px_-8px_rgba(0,0,0,0.08)] hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    ownerType === 'landlord'
                      ? 'bg-[#FFF0E8] text-[#FF5A36] shadow-[0_2px_8px_rgba(229,80,26,0.15)]'
                      : 'bg-slate-100/90 text-slate-500 shadow-2xs'
                  }`}>
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Landlord / Manager</div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      I own or manage the property. Prospective tenants apply directly with transparent rules.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 & 3: WIDE DESKTOP 2-COLUMN BALANCED WORKSPACE GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 xl:gap-16 pt-2">
            
            {/* LEFT COLUMN: PROPERTY & SPACE BASICS */}
            <div className="space-y-7 sm:space-y-8">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                <Building2 className="w-4 h-4 text-[#FF5A36]" />
                <h2 className="text-sm font-semibold text-slate-900 tracking-wide">
                  Property & Space Basics
                </h2>
              </div>

              {/* Location & Name (All India City + Locality + Display Name) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Your display name*
                  </label>
                  <div className="relative flex items-center bg-white border border-slate-200/90 rounded-xl px-4 py-3 sm:py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#FF5A36] focus-within:ring-4 focus-within:ring-[#FF5A36]/10 focus-within:shadow-[0_2px_8px_rgba(229,80,26,0.08)] transition-all">
                    <User className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
                    <input
                      type="text"
                      value={ownerName}
                      onChange={e => setOwnerName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    City in India*
                  </label>
                  <div className="relative flex items-center bg-white border border-slate-200/90 rounded-xl px-4 py-3 sm:py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#FF5A36] focus-within:ring-4 focus-within:ring-[#FF5A36]/10 focus-within:shadow-[0_2px_8px_rgba(229,80,26,0.08)] transition-all">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0 mr-2.5" />
                    <select
                      value={city}
                      onChange={e => {
                        const newCity = e.target.value;
                        setCity(newCity);
                      }}
                      className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-900 outline-none cursor-pointer"
                    >
                      {cities.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Locality & Rent Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Locality / Area*
                  </label>
                  <div className="relative flex items-center bg-white border border-slate-200/90 rounded-xl px-4 py-3 sm:py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#FF5A36] focus-within:ring-4 focus-within:ring-[#FF5A36]/10 focus-within:shadow-[0_2px_8px_rgba(229,80,26,0.08)] transition-all">
                    <MapPin className="w-4 h-4 text-[#FF5A36] shrink-0 mr-2.5" />
                    <input
                      type="text"
                      value={locality}
                      onChange={e => setLocality(e.target.value)}
                      placeholder={
                        city === 'Hyderabad'
                          ? 'e.g. Hitech City'
                          : city === 'Bengaluru'
                          ? 'e.g. Koramangala'
                          : city === 'Mumbai'
                          ? 'e.g. Bandra West'
                          : city === 'Delhi NCR'
                          ? 'e.g. Cyber City'
                          : city === 'Pune'
                          ? 'e.g. Hinjewadi'
                          : city === 'Chennai'
                          ? 'e.g. Anna Nagar'
                          : 'e.g. Locality name'
                      }
                      className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    {locality && (
                      <button
                        type="button"
                        onClick={() => setLocality('')}
                        className="text-slate-400 hover:text-slate-600 p-0.5 ml-1.5 transition-colors cursor-pointer"
                        title="Clear"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {availableLocalities && availableLocalities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {availableLocalities.slice(0, 5).map(loc => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setLocality(loc)}
                          className={`px-2.5 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                            locality.toLowerCase() === loc.toLowerCase()
                              ? 'bg-[#FFF2EB] border-[#FF5A36] text-[#FF5A36] font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Approx monthly rent (₹)*
                  </label>
                  <div className="relative flex items-center bg-white border border-slate-200/90 rounded-xl px-4 py-3 sm:py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#FF5A36] focus-within:ring-4 focus-within:ring-[#FF5A36]/10 focus-within:shadow-[0_2px_8px_rgba(229,80,26,0.08)] transition-all">
                    <span className="text-slate-400 font-medium mr-2 text-sm">₹</span>
                    <input
                      type="number"
                      value={monthlyRent}
                      onChange={e => setMonthlyRent(e.target.value)}
                      placeholder="15000"
                      className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                    />
                    <span className="text-xs text-slate-400 font-normal shrink-0">/ month</span>
                  </div>
                </div>
              </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Rooms available to offer
                  </label>
                  <div className="bg-slate-100/90 border border-slate-200/60 p-1.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] grid grid-cols-3 gap-1">
                    {[
                      { val: '1', label: '1 Room' },
                      { val: '2', label: '2 Rooms' },
                      { val: '3', label: '3+ Rooms' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setRoomsToOffer(opt.val)}
                        className={`py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          roomsToOffer === opt.val
                            ? 'bg-white text-slate-900 shadow-[0_2px_6px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/80 font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

              {/* Accommodation Type */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Accommodation type*
                </label>
                <div className="flex flex-wrap gap-2">
                  {flatTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setFlatType(type);
                        const match = type.match(/\d+/);
                        if (match) {
                          setTotalRooms(match[0]);
                        }
                      }}
                      className={`py-2 px-4 rounded-full border text-xs transition-all cursor-pointer ${
                        flatType === type
                          ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36] font-semibold shadow-[0_2px_8px_rgba(229,80,26,0.12)]'
                          : 'border-slate-200/90 bg-white text-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-slate-300 hover:shadow-[0_2px_6px_rgba(0,0,0,0.04)]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Furnishing Status (Full-width segmented control with complete text) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Furnishing status
                </label>
                <div className="bg-slate-100/90 border border-slate-200/60 p-1.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] grid grid-cols-3 gap-1.5">
                  {[
                    { val: 'Fully Furnished', label: 'Fully Furnished' },
                    { val: 'Semi-Furnished', label: 'Semi-Furnished' },
                    { val: 'Unfurnished', label: 'Unfurnished' },
                  ].map(ft => (
                    <button
                      key={ft.val}
                      type="button"
                      onClick={() => setFurnishing(ft.val)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                        furnishing === ft.val
                          ? 'bg-white text-slate-900 shadow-[0_2px_6px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/80 font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {ft.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Move-in Availability (Full-width segmented control with zero truncation) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Move-in availability
                </label>
                <div className="bg-slate-100/90 border border-slate-200/60 p-1.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { val: 'Immediate', label: 'Immediate' },
                    { val: '15 Days', label: '15 Days' },
                    { val: '30 Days', label: '30 Days' },
                    { val: 'Flexible', label: 'Flexible' },
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setAvailableFrom(opt.val)}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-center whitespace-nowrap ${
                        availableFrom === opt.val
                          ? 'bg-white text-slate-900 shadow-[0_2px_6px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] border border-slate-200/80 font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amenities Grid with proper spacing & shadows */}
              <div className="space-y-2.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Included amenities
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {AMENITIES_GRID.map(item => {
                    const IconComponent = item.icon;
                    const isSelected = selectedAmenities.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleAmenity(item.id)}
                        className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-200 cursor-pointer border ${
                          isSelected
                            ? 'border-[#FF5A36] bg-gradient-to-b from-[#FFFBF9] to-[#FFF2EB] shadow-[0_4px_14px_rgba(229,80,26,0.12),0_1px_2px_rgba(229,80,26,0.08)]'
                            : 'border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02),0_4px_12px_-2px_rgba(0,0,0,0.03)] hover:border-slate-300 hover:shadow-[0_4px_14px_rgba(0,0,0,0.06)] hover:-translate-y-0.5'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#FFF0E8] text-[#FF5A36] border border-[#FF5A36]/25 shadow-xs'
                            : 'bg-slate-50 text-slate-500 border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
                        }`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className={`text-[11px] mt-2 ${
                          isSelected ? 'text-[#FF5A36] font-semibold' : 'text-slate-600 font-medium'
                        }`}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: HOUSEHOLD NORMS & RULES */}
            <div className="space-y-7 sm:space-y-8">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                <Sparkles className="w-4 h-4 text-[#FF5A36]" />
                <h2 className="text-sm font-semibold text-slate-900 tracking-wide">
                  Household Norms & Lifestyle Fit
                </h2>
              </div>

              {/* Looking for Roommate Gender */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Looking for roommate gender
                </label>
                <div className="bg-slate-100/90 border border-slate-200/60 p-1.5 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] grid grid-cols-3 gap-1">
                  {[
                    { id: 'male', label: 'Male Only' },
                    { id: 'female', label: 'Female Only' },
                    { id: 'any', label: 'Any Gender' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setGenderPref(opt.id as any)}
                      className={`py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        genderPref === opt.id
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
                {/* Diet */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Kitchen / Food norms</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setDietPref('any')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        dietPref === 'any' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Non-veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setDietPref('veg')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        dietPref === 'veg' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Veg Only
                    </button>
                  </div>
                </div>

                {/* Smoking */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Smoking policy</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setSmokingPolicy('no_smoking')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        smokingPolicy === 'no_smoking' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🚭 No smoking
                    </button>
                    <button
                      type="button"
                      onClick={() => setSmokingPolicy('social_ok')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        smokingPolicy === 'social_ok' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🚬 Smoking ok
                    </button>
                  </div>
                </div>

                {/* Pets */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Pet policy</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setPetPolicy('pets_ok')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        petPolicy === 'pets_ok' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🐾 Pets welcome
                    </button>
                    <button
                      type="button"
                      onClick={() => setPetPolicy('no_pets')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        petPolicy === 'no_pets' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🚫 No pets
                    </button>
                  </div>
                </div>

                {/* Alcohol & Guests */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Alcohol & guest policy</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDrinkingPolicy(p => p === 'social_ok' ? 'no_drinking' : 'social_ok')}
                      className={`py-2 px-1.5 rounded-lg text-[11px] font-medium transition-all text-center border cursor-pointer ${
                        drinkingPolicy === 'social_ok'
                          ? 'bg-[#FFF2EB] border-[#FF5A36]/35 text-[#FF5A36] font-semibold shadow-[0_1px_4px_rgba(229,80,26,0.1)]'
                          : 'bg-white border-slate-200 text-slate-600 shadow-2xs'
                      }`}
                    >
                      🍷 {drinkingPolicy === 'social_ok' ? 'Alcohol OK' : 'No alcohol'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuestPolicy(p => p === 'guests_welcome' ? 'no_overnight' : 'guests_welcome')}
                      className={`py-2 px-1.5 rounded-lg text-[11px] font-medium transition-all text-center border cursor-pointer ${
                        guestPolicy === 'guests_welcome'
                          ? 'bg-[#FFF2EB] border-[#FF5A36]/35 text-[#FF5A36] font-semibold shadow-[0_1px_4px_rgba(229,80,26,0.1)]'
                          : 'bg-white border-slate-200 text-slate-600 shadow-2xs'
                      }`}
                    >
                      👥 {guestPolicy === 'guests_welcome' ? 'Guests OK' : 'No overnight'}
                    </button>
                  </div>
                </div>

                {/* Cleanliness */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Cleanliness standard</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setCleanlinessPolicy('high')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        cleanlinessPolicy === 'high' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🧹 High standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setCleanlinessPolicy('flexible')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        cleanlinessPolicy === 'flexible' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      ✨ Flexible
                    </button>
                  </div>
                </div>

                {/* Quiet Hours */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02),0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-shadow">
                  <span className="text-xs text-slate-600 font-medium">Quiet hours norm</span>
                  <div className="bg-slate-100/90 border border-slate-200/50 p-1 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setQuietHoursPolicy('quiet_11pm')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        quietHoursPolicy === 'quiet_11pm' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🌙 Quiet 11 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuietHoursPolicy('flexible')}
                      className={`py-2 px-1 rounded-lg text-xs font-medium transition-all text-center cursor-pointer ${
                        quietHoursPolicy === 'flexible' ? 'bg-white text-slate-900 font-bold shadow-[0_1px_4px_rgba(0,0,0,0.06)]' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🎸 Flexible
                    </button>
                  </div>
                </div>
              </div>

              {/* Highlights & House Rules (Pills with Checkmarks & Shadow) */}
              <div className="space-y-2.5 pt-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Highlights & house rules for your room
                </label>
                <div className="flex flex-wrap gap-2">
                  {standardRules.map(rule => {
                    const isChecked = selectedRules.includes(rule);
                    return (
                      <button
                        key={rule}
                        type="button"
                        onClick={() => toggleRule(rule)}
                        className={`py-2 px-3.5 rounded-full border text-xs transition-all duration-150 cursor-pointer inline-flex items-center gap-1.5 ${
                          isChecked
                            ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36] font-semibold shadow-[0_2px_6px_rgba(229,80,26,0.12)]'
                            : 'border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-slate-300 hover:shadow-[0_2px_6px_rgba(0,0,0,0.05)] hover:bg-slate-50/60'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        <span>{rule}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom rule input with proper padding and non-clipped Add button */}
                <div className="flex items-center gap-2.5 pt-1.5">
                  <div className="relative flex-1 min-w-0 flex items-center bg-white border border-slate-200/90 rounded-xl px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02),inset_0_1px_2px_rgba(0,0,0,0.02)] focus-within:border-[#FF5A36] focus-within:ring-4 focus-within:ring-[#FF5A36]/10 focus-within:shadow-[0_2px_8px_rgba(229,80,26,0.08)] transition-all">
                    <input
                      type="text"
                      value={customRuleInput}
                      onChange={e => setCustomRuleInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomRule())}
                      placeholder="Add custom rule (e.g. Working professionals only)..."
                      className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 min-w-0"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addCustomRule}
                    className="py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-semibold text-xs transition-all shadow-[0_2px_6px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.2)] cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {customRules.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1.5">
                    {customRules.map(rule => (
                      <span
                        key={rule}
                        className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-slate-100/90 border border-slate-200 text-slate-800 text-xs font-medium shadow-2xs"
                      >
                        <span>{rule}</span>
                        <button
                          type="button"
                          onClick={() => removeCustomRule(rule)}
                          className="hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* SECTION 4: PUBLISHING TRUST STANDARDS (Full-width reassurance bar with subtle elevation) */}
          <div className="bg-gradient-to-r from-slate-50/90 via-white to-[#FFF9F6] border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.02),0_8px_24px_-8px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4.5 h-4.5 text-[#FF5A36]" />
                <span className="text-xs sm:text-sm font-semibold text-slate-900">
                  NestMate Publishing Trust Standards
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
                <span>Tier 2 Govt ID Proof Required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#FF5A36] shrink-0 font-bold" />
                <span>Moderation Verified in &lt;24h</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#FF5A36] shrink-0 font-bold" />
                <span>100% Zero Brokerage Platform</span>
              </div>
            </div>
          </div>

          {/* ACTIONS ROW WITH LUXURY CALL-TO-ACTION ELEVATION */}
          <div className="pt-4 sm:pt-6 space-y-4 text-center">
            {/* Primary Submit Pill Button with refined, soft shadow */}
            <button
              type="button"
              onClick={() => handleFinish('listing')}
              disabled={loading}
              className="w-full sm:w-auto min-w-[300px] sm:min-w-[320px] px-9 py-4 rounded-full bg-gradient-to-r from-[#FF5A36] to-[#F26428] hover:from-[#E54E2B] hover:to-[#FF5A36] text-white font-bold text-sm sm:text-base transition-all duration-200 shadow-[0_4px_16px_rgba(229,80,26,0.22),0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_22px_rgba(229,80,26,0.32),0_2px_5px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] inline-flex items-center justify-center gap-2.5 mx-auto cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Your First Listing</span>
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
                onClick={() => handleFinish('dashboard')}
                disabled={loading}
                className="py-2.5 px-5 border border-slate-200/90 rounded-full text-xs font-semibold text-slate-700 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>

            {/* Bottom Role Switch Link */}
            <div className="pt-2 text-center">
              <p className="text-xs text-slate-400">
                Looking for a room or roommates instead?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/onboarding/seeker')}
                  className="font-semibold text-[#FF5A36] hover:underline cursor-pointer inline-flex items-center gap-0.5"
                >
                  <span>Switch to Seeker Onboarding</span>
                  <ChevronRight className="w-3 h-3 stroke-[2.5]" />
                </button>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
