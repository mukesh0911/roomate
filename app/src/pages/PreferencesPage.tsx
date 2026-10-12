import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import {
  ArrowLeft, Sparkles, Save, Loader2,
} from 'lucide-react';
import PageShell from '@/components/PageShell';

export default function PreferencesPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { updateProfile } = useUserProfile();

  const [saving, setSaving] = useState(false);

  // Must-Haves (Hard Filters)
  const [mustHaves, setMustHaves] = useState({
    genderRestricted: false,
    preferredGender: 'any',
    vegOnly: false,
    nonSmoking: false,
    noPets: false,
    nonDrinking: false,
  });

  // Nice-To-Haves (Soft Scoring Weights)
  const [softPrefs, setSoftPrefs] = useState({
    cleanliness: 'high',
    sleepSchedule: 'early',
    socialVibe: 'balanced',
    workMode: 'hybrid',
  });

  // Budget & Move-in
  const [budget, setBudget] = useState(15000);
  const [moveInDate, setMoveInDate] = useState('');
  const [matchAlerts, setMatchAlerts] = useState(false);

  // Dynamic SEO title
  useEffect(() => {
    document.title = 'Matching Preferences | NestMate';
  }, []);

  // Hydrate from existing profile
  useEffect(() => {
    if (profile) {
      if (profile.budget) setBudget(profile.budget);
      if (profile.moveInDate) setMoveInDate(profile.moveInDate);
      
      const p = (profile as any).preferences;
      if (p) {
        if (p.mustHaves) setMustHaves(prev => ({ ...prev, ...p.mustHaves }));
        if (p.softPrefs) setSoftPrefs(prev => ({ ...prev, ...p.softPrefs }));
        if (typeof p.matchAlerts === 'boolean') setMatchAlerts(p.matchAlerts);
      }
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateProfile(user.uid, {
        budget,
        moveInDate,
        preferences: {
          mustHaves,
          softPrefs,
          matchAlerts,
          updatedAt: new Date().toISOString(),
        },
      });
      await refreshProfile(user.uid);
      toast.success('Preferences saved. Your matches are updating!');
      navigate('/explore?tab=roommates');
    } catch (err: any) {
      console.error('Failed to update preferences:', err);
      toast.error(err.message || 'Failed to update preferences');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setMustHaves({
      genderRestricted: false,
      preferredGender: 'any',
      vegOnly: false,
      nonSmoking: false,
      noPets: false,
      nonDrinking: false,
    });
    setSoftPrefs({
      cleanliness: 'high',
      sleepSchedule: 'early',
      socialVibe: 'balanced',
      workMode: 'hybrid',
    });
    setBudget(15000);
    setMoveInDate('');
    setMatchAlerts(false);
    toast.info('Preferences reset to defaults');
  };

  return (
    <PageShell
      maxWidth="max-w-2xl"
      title="Matching Preferences"
      subtitle={`Fine-tune your dealbreakers and priorities to discover ideal roommates in ${profile?.city || 'your area'}.`}
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/explore?tab=roommates')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-600 hover:text-[#1E2229] hover:border-gray-300 transition-all cursor-pointer bg-white shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <button
            onClick={resetToDefaults}
            className="px-3.5 py-1.5 rounded-full border border-gray-200 text-xs font-semibold text-gray-500 hover:text-[#FF5A36] hover:border-[#FF5A36]/30 transition-all cursor-pointer bg-white shadow-2xs"
          >
            Reset
          </button>
        </div>
      }
      withBottomNavPad
    >
      <div className="space-y-6 pb-24">
        {/* Intro Card */}
        <div className="bg-[#FFF2EB]/70 border border-[#FF5A36]/20 rounded-2xl p-4 sm:p-5 shadow-xs">
          <h2 className="text-sm font-serif font-bold text-[#1E2229] mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FF5A36]" />
            Hard Dealbreakers vs. Soft Preferences
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed font-sans">
            Must-haves strictly eliminate incompatible listings from your discovery feed. Nice-to-haves guide the 0–100% weighted compatibility scoring.
          </p>
        </div>

        {/* SECTION 1: MUST-HAVES (HARD CONSTRAINTS) */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-xs space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
              Hard Exclusion Filters
            </span>
            <h2 className="text-lg font-serif font-bold text-[#1E2229] mt-2">Must-Have Dealbreakers</h2>
            <p className="text-xs text-gray-500 font-sans">We will never show you listings or roommates violating these rules.</p>
          </div>

          <div className="space-y-4 divide-y divide-gray-100">
            {/* Preferred Gender */}
            <div className="pt-2 first:pt-0">
              <span className="text-xs font-bold text-gray-800 block mb-2">Preferred Flatmate Gender</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'any', label: 'Any Gender' },
                  { id: 'female', label: 'Female Only' },
                  { id: 'male', label: 'Male Only' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMustHaves(m => ({ ...m, preferredGender: opt.id }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      mustHaves.preferredGender === opt.id
                        ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Veg Kitchen Only */}
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Strict Vegetarian Kitchen</span>
                <span className="text-[11px] text-gray-500 block mt-0.5">
                  {mustHaves.vegOnly ? '✓ We will only show vegetarian-only households' : 'Off: Non-veg friendly households will also appear'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={mustHaves.vegOnly}
                onChange={(e) => setMustHaves(m => ({ ...m, vegOnly: e.target.checked }))}
                className="w-4 h-4 rounded text-[#FF5A36] focus:ring-[#FF5A36] cursor-pointer mt-1"
              />
            </div>

            {/* Non-Smoking Household */}
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Non-Smoking Household</span>
                <span className="text-[11px] text-gray-500 block mt-0.5">
                  {mustHaves.nonSmoking ? '✓ Eliminates flats where smoking is allowed' : 'Off: Social smokers will be ranked with lifestyle tags'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={mustHaves.nonSmoking}
                onChange={(e) => setMustHaves(m => ({ ...m, nonSmoking: e.target.checked }))}
                className="w-4 h-4 rounded text-[#FF5A36] focus:ring-[#FF5A36] cursor-pointer mt-1"
              />
            </div>

            {/* No Pets */}
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Pet-Free Environment</span>
                <span className="text-[11px] text-gray-500 block mt-0.5">
                  {mustHaves.noPets ? '✓ Eliminates flats with dogs or cats' : 'Off: Homes with pets will remain visible'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={mustHaves.noPets}
                onChange={(e) => setMustHaves(m => ({ ...m, noPets: e.target.checked }))}
                className="w-4 h-4 rounded text-[#FF5A36] focus:ring-[#FF5A36] cursor-pointer mt-1"
              />
            </div>

            {/* Non-Drinking Household */}
            <div className="pt-4 flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-gray-800 block">Non-Drinking Flat</span>
                <span className="text-[11px] text-gray-500 block mt-0.5">
                  {mustHaves.nonDrinking ? '✓ Only shows flats strictly observing alcohol-free living' : 'Off: Normal social preferences apply'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={mustHaves.nonDrinking}
                onChange={(e) => setMustHaves(m => ({ ...m, nonDrinking: e.target.checked }))}
                className="w-4 h-4 rounded text-[#FF5A36] focus:ring-[#FF5A36] cursor-pointer mt-1"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: NICE-TO-HAVES (SOFT RANKING SCORING) */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-xs space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
              Scoring Weights
            </span>
            <h2 className="text-lg font-serif font-bold text-[#1E2229] mt-2">Nice-To-Have Priorities</h2>
            <p className="text-xs text-gray-500 font-sans">Profiles matching these receive higher percentage compatibility.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">Cleanliness Standard</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'high', label: 'Strict / Daily' },
                  { id: 'medium', label: 'Moderate' },
                  { id: 'relaxed', label: 'Relaxed' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSoftPrefs(p => ({ ...p, cleanliness: opt.id }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      softPrefs.cleanliness === opt.id
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">Sleep & Quiet Hours</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'early', label: 'Early Bird (10 PM)' },
                  { id: 'night_owl', label: 'Night Owl (1 AM+)' },
                  { id: 'flexible', label: 'Flexible / Varied' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSoftPrefs(p => ({ ...p, sleepSchedule: opt.id }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      softPrefs.sleepSchedule === opt.id
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">Social Atmosphere</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'private', label: 'Quiet & Private' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'social', label: 'Very Social' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSoftPrefs(p => ({ ...p, socialVibe: opt.id }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      softPrefs.socialVibe === opt.id
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1.5">Work Schedule</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'wfh', label: 'Work From Home' },
                  { id: 'hybrid', label: 'Hybrid' },
                  { id: 'office', label: 'In-Office' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSoftPrefs(p => ({ ...p, workMode: opt.id }))}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      softPrefs.workMode === opt.id
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: BUDGET & MOVE-IN */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-xs space-y-4">
          <h2 className="text-lg font-serif font-bold text-[#1E2229]">Budget & Timeline</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Max Monthly Budget (₹)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₹</span>
                <input
                  type="number"
                  min={1000}
                  max={500000}
                  value={budget}
                  onChange={(e) => setBudget(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-8 pr-4 py-3 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#FF5A36]"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Target Move-in Date</label>
              <input
                type="date"
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-medium text-gray-800 focus:outline-none focus:border-[#FF5A36]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-gray-800 block">Instant Match Alerts</span>
              <span className="text-[11px] text-gray-500 block mt-0.5">
                Receive notifications when an 85%+ compatibility match appears in {profile?.city || 'your area'}
              </span>
            </div>
            <input
              type="checkbox"
              checked={matchAlerts}
              onChange={(e) => setMatchAlerts(e.target.checked)}
              className="w-4 h-4 rounded text-[#FF5A36] focus:ring-[#FF5A36] cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-gray-200 z-40 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <span className="text-xs text-gray-500 hidden sm:inline-block">
            Changes update matching weights across {profile?.city || 'your area'} listings
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto ml-auto bg-[#FF5A36] hover:bg-[#E54E2B] text-white py-3 px-8 rounded-full font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer shadow-[#FF5A36]/20"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Update Preferences</span>
              </>
            )}
          </button>
        </div>
      </div>
    </PageShell>
  );
}
