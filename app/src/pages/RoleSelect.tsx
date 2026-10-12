import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Search, Home, CheckCircle } from 'lucide-react';

export default function RoleSelect() {
  const navigate = useNavigate();
  const { setCurrentRole } = useStore();
  const { user, profile, isLoading } = useAuth();
  const { setRole } = useUserProfile();

  useEffect(() => {
    if (!isLoading && profile?.onboardingComplete) {
      navigate(profile.role === 'owner' ? '/owner-dashboard' : '/dashboard', { replace: true });
    }
  }, [isLoading, profile?.onboardingComplete, profile?.role, navigate]);

  const handleSelectRole = async (role: 'seeker' | 'owner') => {
    setCurrentRole(role);
    try {
      if (user?.uid) {
        await setRole(user.uid, role);
      }
    } catch (err: any) {
      console.error('Failed to save selected role:', err);
    }

    navigate(role === 'seeker' ? '/onboarding/seeker' : '/onboarding/owner');
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] flex items-center justify-center px-4 py-12 page-transition">
      <div className="w-full max-w-3xl">
        {/* Scam Safety Alert Banner - FlatMate Reference */}
        <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-4 mb-8 flex items-start gap-3 text-left shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-bold text-sm">
            ⚠️
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-900">Safety &amp; Scam Advisory</h4>
            <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
              Never transfer token money, security deposit, or visit fees before seeing the flat in person and verifying identity. NestMate is a 100% zero-brokerage platform.
            </p>
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-[#FF5A36] mb-3 tracking-widest uppercase">Step 1 of 1</p>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#1E2229] mb-3">I want to…</h1>
          <p className="text-gray-500 max-w-md mx-auto text-sm">
            Choose your primary role. You can always switch later from your profile settings.
          </p>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Seeker Card */}
          <button
            type="button"
            onClick={() => handleSelectRole('seeker')}
            className="group relative bg-white border border-gray-200/90 rounded-3xl p-8 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-[#1E2229]/30 overflow-hidden cursor-pointer"
          >
            {/* Background Number */}
            <span className="absolute top-4 right-4 text-[120px] font-display italic font-bold text-[#1E2229]/[0.03] leading-none select-none">
              01
            </span>

            <div className="relative">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-[#1E2229]/10 transition-colors">
                <Search className="w-7 h-7 text-[#1E2229]" />
              </div>

              <h3 className="text-xl font-bold mb-2 text-[#1E2229]">Find a Room &amp; Roommate</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
                I don't have a flat yet. I want to find both a compatible roommate and a place to live.
              </p>

              <ul className="space-y-2.5 mb-8">
                {[
                  'Browse compatible roommates',
                  'Discover rooms in your budget',
                  'Take the lifestyle compatibility quiz',
                  'Connect and move in together',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-[#1E2229] flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="w-full py-3 bg-[#1E2229] hover:bg-black text-white rounded-xl font-semibold text-center text-xs sm:text-sm transition-all shadow-xs group-hover:shadow-md">
                Continue as Seeker
              </div>
            </div>
          </button>

          {/* Owner Card */}
          <button
            type="button"
            onClick={() => handleSelectRole('owner')}
            className="group relative bg-white border border-gray-200/90 rounded-3xl p-8 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-[#FF5A36]/40 overflow-hidden cursor-pointer"
          >
            {/* Background Number */}
            <span className="absolute top-4 right-4 text-[120px] font-display italic font-bold text-[#FF5A36]/[0.03] leading-none select-none">
              02
            </span>

            <div className="relative">
              <div className="w-14 h-14 bg-[#FFF2EB] rounded-2xl flex items-center justify-center mb-5 group-hover:bg-[#FFE3D4] transition-colors">
                <Home className="w-7 h-7 text-[#FF5A36]" />
              </div>

              <h3 className="text-xl font-bold mb-2 text-[#1E2229]">List My Room / Flat</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
                I already have a flat or room. I want to find a compatible person to share it with.
              </p>

              <ul className="space-y-2.5 mb-8">
                {[
                  'List your room with photos & amenities',
                  'Set roommate lifestyle preferences',
                  'Review verified applicant profiles',
                  'Direct chat without any broker commission',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-[#FF5A36] flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="w-full py-3 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-xl font-semibold text-center text-xs sm:text-sm transition-all shadow-xs group-hover:shadow-md">
                Continue as Owner
              </div>
            </div>
          </button>
        </div>

        {/* Tip */}
        <p className="text-center text-xs text-gray-400 mt-8">
          You can switch between Seeker and Owner modes anytime from your profile settings.
        </p>
      </div>
    </div>
  );
}
