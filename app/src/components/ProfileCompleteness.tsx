import { useNavigate } from 'react-router-dom';
import { Camera, FileText, Briefcase, Brain, Mail, ShieldCheck, MapPin, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import type { UserProfile } from '@/hooks/useAuth';

interface ProfileField {
  id: string;
  label: string;
  description: string;
  icon: ReactNode;
  done: boolean;
  weight: number;
  actionLabel: string;
  actionPath: string;
}

/** Shared profile completeness. Activity-specific setup is a nudge, not an account mode. */
export function getProfileFields(profile: UserProfile | null): ProfileField[] {
  if (!profile) return [];
  const hasLocality = Array.isArray(profile.localities) && profile.localities.some(locality => locality?.trim().length > 0);
  const hasCompatibility = profile.roommateDiscoveryEnabled === true
    && !!profile.quizAnswers
    && Object.keys(profile.quizAnswers).length >= 5;

  return [
    { id: 'photo', label: 'Add Profile Photo', description: 'A real photo builds trust with people you contact.', icon: <Camera className="w-4 h-4" />, done: !!profile.avatar?.trim(), weight: 15, actionLabel: 'Add Photo', actionPath: '/edit-profile' },
    { id: 'bio', label: 'Write Your Bio', description: 'Introduce yourself once for rooms and roommate discovery.', icon: <FileText className="w-4 h-4" />, done: !!profile.bio?.trim() && profile.bio.trim().length >= 5, weight: 15, actionLabel: 'Write Bio', actionPath: '/edit-profile' },
    { id: 'profession', label: 'Add Profession', description: 'Helps people understand your day-to-day routine.', icon: <Briefcase className="w-4 h-4" />, done: !!profile.profession?.trim(), weight: 15, actionLabel: 'Add Profession', actionPath: '/edit-profile' },
    { id: 'location', label: 'Set Search Location', description: 'Add a city and at least one preferred locality.', icon: <MapPin className="w-4 h-4" />, done: !!profile.city?.trim() && hasLocality, weight: 20, actionLabel: 'Set Location', actionPath: '/edit-profile' },
    { id: 'roommate', label: 'Set Up Roommate Discovery', description: 'Opt in and answer compatibility questions when you want roommate matches.', icon: <Brain className="w-4 h-4" />, done: hasCompatibility, weight: 15, actionLabel: 'Set Up', actionPath: '/edit-profile' },
    { id: 'workemail', label: 'Verify Work / College Email', description: 'Boost trust with a verified email.', icon: <Mail className="w-4 h-4" />, done: !!profile.workEmailVerified, weight: 15, actionLabel: 'Verify Email', actionPath: '/edit-profile' },
    { id: 'identity', label: 'Verify Government ID', description: 'Earn the highest trust tier.', icon: <ShieldCheck className="w-4 h-4" />, done: !!profile.isVerified || (profile.verificationLevel ?? 0) >= 1, weight: 5, actionLabel: 'Verify ID', actionPath: '/trust' },
  ];
}

export function computeCompleteness(profile: UserProfile | null): number {
  return getProfileFields(profile).reduce((sum, field) => sum + (field.done ? field.weight : 0), 0);
}

interface ProfileCompletenessProps {
  profile: UserProfile | null;
  compact?: boolean;
  className?: string;
}

export default function ProfileCompleteness({ profile, compact = false, className = '' }: ProfileCompletenessProps) {
  const navigate = useNavigate();
  const fields = getProfileFields(profile);
  const pct = computeCompleteness(profile);
  const firstNudge = fields.find(field => !field.done);
  const barColor = pct >= 85 ? 'bg-emerald-500' : pct >= 60 ? 'bg-[#FF5A36]' : 'bg-amber-400';

  if (compact) {
    return <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Profile {pct}% complete</span>
        {firstNudge && <button onClick={() => navigate(firstNudge.actionPath)} className="text-[10px] text-[#FF5A36] font-semibold hover:underline cursor-pointer">{firstNudge.actionLabel} →</button>}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} /></div>
      {firstNudge && <p className="text-[10px] text-gray-400 mt-1 truncate font-medium">{firstNudge.description}</p>}
    </div>;
  }

  return <div className={`bg-white rounded-3xl border border-gray-100 shadow-xs p-5 ${className}`}>
    <div className="flex items-center justify-between mb-3"><div><h3 className="font-serif font-medium text-base text-[#1E2229]">Profile Completeness</h3><p className="text-xs text-gray-400 font-medium">{pct < 100 ? `${100 - pct} points left to reach 100%` : 'Your profile is complete!'}</p></div><div className={`text-2xl font-bold ${pct >= 85 ? 'text-emerald-600' : pct >= 60 ? 'text-[#FF5A36]' : 'text-amber-500'}`}>{pct}%</div></div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4"><div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} /></div>
    <div className="space-y-2">{fields.map(field => <div key={field.id} onClick={field.done ? undefined : () => navigate(field.actionPath)} className={`flex items-center gap-3 p-3 rounded-2xl transition-all ${field.done ? 'opacity-60 bg-gray-50/60' : 'bg-[#FFF2EB]/40 border border-[#FF5A36]/15 cursor-pointer hover:bg-[#FFF2EB]/80'}`}><div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${field.done ? 'bg-emerald-50 text-emerald-600' : 'bg-[#FFF2EB] text-[#FF5A36]'}`}>{field.done ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> : field.icon}</div><div className="flex-1 min-w-0"><p className={`text-xs font-semibold ${field.done ? 'text-gray-400 line-through' : 'text-[#1E2229]'}`}>{field.label}</p>{!field.done && <p className="text-[10px] text-gray-400 leading-relaxed truncate font-medium">{field.description}</p>}</div>{field.done ? <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">+{field.weight}</span> : <ChevronRight className="w-4 h-4 text-[#FF5A36]/60 shrink-0" />}</div>)}</div>
  </div>;
}
