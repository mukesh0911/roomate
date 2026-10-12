import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowLeft, ShieldCheck, Lock, User, MapPin, Info, Settings,
} from 'lucide-react';
import PageShell from '@/components/PageShell';
import { getDynamicPreferences } from '@/lib/dynamicTraits';

const QUIZ_LABELS: Record<string, { label: string; values?: Record<string, string> }> = {
  q1: { label: 'Sleep Schedule', values: { '1': 'Early Bird (10 PM)', '2': 'Night Owl (1 AM+)', '3': 'Flexible' } },
  q2: { label: 'Diet', values: { '1': 'Vegetarian', '2': 'Non-Vegetarian', '3': 'Eggetarian', '4': 'Vegan' } },
  q3: { label: 'Smoking', values: { '1': 'Non-Smoker', '2': 'Occasional Smoker', '3': 'Regular Smoker' } },
  q4: { label: 'Drinking', values: { '1': 'Non-Drinker', '2': 'Social Drinker', '3': 'Regular Drinker' } },
  q5: { label: 'Cleanliness', values: { '1': 'High Standard', '2': 'Moderate', '3': 'Relaxed' } },
  q6: { label: 'Work Mode', values: { '1': 'Work From Home', '2': 'Hybrid', '3': 'In-Office' } },
  q7: { label: 'Guests / Visitors', values: { '1': 'Rarely', '2': 'Weekends Only', '3': 'Anytime', '4': 'Prior Notice' } },
  q8: { label: 'Pets', values: { '1': 'Pet Friendly', '2': 'No Pets', '3': 'Comfortable with Pets' } },
  q9: { label: 'Social Vibe', values: { '1': 'Quiet & Private', '2': 'Balanced', '3': 'Very Social' } },
  q10: { label: 'Cooking', values: { '1': 'Cooks Daily', '2': 'Cooks Occasionally', '3': 'Orders / Maid' } },
  sleep_time: { label: 'Sleep Schedule' },
  wake_time: { label: 'Wake Time' },
  food_pref: { label: 'Dietary Preference' },
  smoking: { label: 'Smoking' },
  drinking: { label: 'Drinking' },
  cleanliness: { label: 'Cleanliness' },
  work_mode: { label: 'Work Mode' },
  pets: { label: 'Pets' },
  guests: { label: 'Guests Policy' },
};

export default function ProfilePreview() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [avatarImgError, setAvatarImgError] = useState(false);

  // Dynamic SEO title
  useEffect(() => {
    document.title = 'Profile Preview | NestMate';
  }, []);

  const dynamicBadges = useMemo(() => {
    if (!profile) return [];
    return getDynamicPreferences({
      quizAnswers: profile.quizAnswers,
      householdExpectations: (profile as any).householdExpectations,
      profession: profile.profession,
    });
  }, [profile]);

  if (!profile) {
    return (
      <PageShell maxWidth="max-w-md">
        <div className="text-center py-12">
          <p className="text-sm text-gray-500 mb-4">Please log in to preview your profile.</p>
          <Link
            to="/login"
            className="px-5 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-semibold shadow-xs"
          >
            Go to Login
          </Link>
        </div>
      </PageShell>
    );
  }

  // Privacy flags
  const isBlurred = (profile as any)?.settings?.blurPhoto || false;
  const isNameInitials = (profile as any)?.settings?.showInitialsOnly || false;
  const isPubliclyVisible = (profile as any)?.isPubliclyVisibleProfile !== false;

  // Masked name logic
  const displayName = isNameInitials
    ? `${profile.name?.charAt(0) || 'U'}.`
    : profile.name || 'Anonymous User';

  return (
    <PageShell
      maxWidth="max-w-2xl"
      title="Public Profile Preview"
      subtitle="See exactly how prospective roommates and hosts view your profile in discovery."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/profile'))}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:text-[#1E2229] hover:border-gray-300 transition-all cursor-pointer bg-white shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <Link
            to="/settings"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-[#FF5A36] hover:border-[#FF5A36]/30 transition-all cursor-pointer bg-white shadow-2xs"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Adjust</span>
          </Link>
        </div>
      }
      withBottomNavPad
    >
      <div className="space-y-6 pb-20">
        {/* Banner Notice */}
        <div className="bg-[#FFF2EB]/60 border border-[#FF5A36]/20 rounded-3xl p-4 sm:p-5 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#FF5A36] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xs font-serif font-bold text-[#1E2229] mb-0.5">
                Exact Stranger View
              </h2>
              <p className="text-[11px] text-gray-600 leading-relaxed font-sans">
                This shows precisely how other roommate seekers in your city see your profile before connecting. Phone numbers and private verification documents are strictly hidden.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAnnotations(a => !a)}
            className="text-[11px] font-semibold px-3 py-1.5 bg-white border border-gray-200 text-[#1E2229] rounded-full shrink-0 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
          >
            {showAnnotations ? 'Hide Tags' : 'Show Tags'}
          </button>
        </div>

        {/* Profile Card Projection */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 sm:p-7 relative overflow-hidden">
          {/* Public Visibility Chip */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-sans">
              Profile Card
            </span>
            <span className={`text-xs font-semibold px-3 py-0.5 rounded-full ${
              isPubliclyVisible ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {isPubliclyVisible ? 'Active in Discovery' : 'Hidden from Discovery'}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6">
            {/* Avatar with optional blur & onError fallback */}
            <div className="relative">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-gray-200 bg-[#FBFBFC] flex items-center justify-center shadow-xs">
                {profile.avatar && !avatarImgError ? (
                  <img
                    src={profile.avatar}
                    alt={displayName}
                    className={`w-full h-full object-cover ${isBlurred ? 'blur-md' : ''}`}
                    onError={() => setAvatarImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-[#FFF2EB] text-[#FF5A36] font-serif font-bold text-2xl flex items-center justify-center">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {showAnnotations && isBlurred && (
                <span className="absolute -bottom-2 -right-2 bg-[#1E2229] text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-xs">
                  Photo Blurred
                </span>
              )}
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                <h2 className="font-serif font-medium text-xl text-[#1E2229]">{displayName}</h2>
                {profile.isVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verified
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-gray-500 mb-3 font-medium">
                {[profile.gender, profile.age ? `${profile.age} yrs` : null, profile.profession]
                  .filter(Boolean)
                  .join(' · ')}
              </p>

              {/* Localities */}
              {profile.localities && profile.localities.length > 0 && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-gray-600 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Targeting: <strong className="text-[#1E2229]">{profile.localities.join(', ')}</strong></span>
                </div>
              )}

              {/* Budget */}
              {profile.budget && (
                <p className="text-xs text-gray-600">
                  Budget: <strong className="text-[#1E2229] font-bold">₹{profile.budget.toLocaleString()}/mo</strong>
                </p>
              )}
            </div>
          </div>

          {/* Dynamic Badges */}
          {dynamicBadges.length > 0 && (
            <div className="mb-6 pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">
                  Lifestyle Badges
                </span>
                {showAnnotations && (
                  <span className="text-[10px] text-emerald-700 font-semibold">Matched Signals</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {dynamicBadges.map((badge, idx) => {
                  const Icon = badge.icon;
                  return (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{badge.label}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* About / Bio */}
          {profile.bio && (
            <div className="mb-6 bg-[#FBFBFC] rounded-2xl p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">About</span>
                {showAnnotations && (
                  <span className="text-[10px] text-emerald-700 font-semibold">Visible to Everyone</span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed font-sans">{profile.bio}</p>
            </div>
          )}

          {/* Lifestyle Attributes Preview */}
          {profile.quizAnswers && Object.keys(profile.quizAnswers).length > 0 && (
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">
                  Lifestyle Habits & Household Norms
                </span>
                {showAnnotations && (
                  <span className="text-[10px] text-emerald-700 font-semibold">Public for Matching</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(profile.quizAnswers).map(([key, val]) => {
                  const meta = QUIZ_LABELS[key.toLowerCase()];
                  const label = meta?.label || key.replace(/_/g, ' ');
                  const readableVal = meta?.values?.[String(val)] || String(val).replace(/_/g, ' ');
                  return (
                    <span
                      key={key}
                      className="text-xs px-3 py-1.5 rounded-full bg-[#FBFBFC] border border-gray-200 text-gray-700 font-medium"
                    >
                      <strong className="capitalize text-[#1E2229]">{label}:</strong> {readableVal}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Masked Contact Guarantee */}
          <div className="p-4 rounded-2xl border border-dashed border-gray-300 bg-[#FBFBFC] flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <Lock className="w-4 h-4 text-gray-400 shrink-0" />
              <span>Mobile Number: <strong className="font-mono text-[#1E2229]">+91 ••••• •••••</strong></span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-white border border-gray-200 px-2.5 py-0.5 rounded-full">
              Connections Only
            </span>
          </div>
        </div>

        {/* Adjust Visibility CTA */}
        <div className="text-center pt-2">
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] active:scale-[0.98] text-white font-semibold text-xs sm:text-sm py-3 px-6 shadow-xs transition-all shadow-[#FF5A36]/20"
          >
            <Settings className="w-4 h-4" />
            <span>Adjust Privacy & Visibility Settings</span>
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
