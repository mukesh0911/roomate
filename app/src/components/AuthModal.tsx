import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { X, Sparkles, User, Building2, ShieldCheck, Loader2 } from 'lucide-react';
import { DEMO_MODE_ENABLED } from '@/lib/runtimeConfig';
import { savePrivateUserData } from '@/lib/privateUserData';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  redirectAfterLogin?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  title = 'Sign in to Connect with Roommates',
  subtitle,
  redirectAfterLogin,
}: AuthModalProps) {
  const navigate = useNavigate();
  const [loadingRole, setLoadingRole] = useState<'seeker' | 'owner' | null>(null);
  const resolvedSubtitle = subtitle || (DEMO_MODE_ENABLED
    ? 'Create your account or try a local demo to evaluate the complete workflow.'
    : 'Sign in or create your account to connect, chat, and save rooms.');

  if (!isOpen) return null;

  const handleDemoLogin = async (role: 'seeker' | 'owner') => {
    if (!DEMO_MODE_ENABLED) return;
    setLoadingRole(role);
    try {
      // Anonymous Auth is disabled on the NestMate Firebase project.
      // Use ephemeral email/password demo accounts instead (no paid dependency).
      const stamp = Date.now();
      const demoEmail = `demo.${role}.${stamp}@nestmate.app`;
      const demoPassword = `Demo!${stamp}`;
      const userCred = await createUserWithEmailAndPassword(auth, demoEmail, demoPassword);
      const uid = userCred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        name: role === 'seeker' ? 'Rohan (Demo Seeker)' : 'Priya (Demo Owner)',
        // Sprint 2E: quarantine flag — demo accounts are excluded from
        // discovery, matching and analytics via lib/demoUsers.ts
        isDemo: true,
        phone: '',
        email: '',
        role,
        age: role === 'seeker' ? 25 : 28,
        gender: role === 'seeker' ? 'male' : 'female',
        ...(role === 'seeker'
          ? {
            profession: 'Software Engineer',
            company: 'Zoho',
            localities: ['Velachery', 'Adyar'],
            budget: 12000,
            quizAnswers: { q1: '1', q2: '2', q3: '1', q4: '3', q5: '2', q6: '1', q7: '4', q8: '2', q9: '1', q10: '3' },
          }
          : { savedRoomIds: [] }),
        city: '',
        bio: '',
        onboardingComplete: true,
        isPremium: false,
        isVerified: false,
        // Sprint 4A (truth): even demo accounts start unverified.
        verificationLevel: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await savePrivateUserData(uid, {
        phone: role === 'seeker' ? '+919999900001' : '+919999900002',
        email: demoEmail,
      });

      toast.success(`Demo ${role} account ready`);
      onClose();
      if (redirectAfterLogin) {
        navigate(redirectAfterLogin);
      } else {
        navigate(role === 'owner' ? '/my-listings' : '/explore?tab=rooms');
      }
    } catch (err: any) {
      console.error('Demo login error:', err);
      toast.error(err?.message || 'Demo login failed. Please try email signup instead.');
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-border relative animate-scale-up max-h-[90dvh] overflow-y-auto pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 touch-target p-2 rounded-full text-ink/40 hover:text-ink hover:bg-cream/60 transition-all flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center pt-2 pb-4">
          <div className="w-12 h-12 rounded-2xl gradient-fire flex items-center justify-center mx-auto mb-3 shadow-md">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-ink tracking-tight">{title}</h2>
          <p className="text-xs text-ink/60 mt-1.5 leading-relaxed">{resolvedSubtitle}</p>
        </div>

        {DEMO_MODE_ENABLED && <div className="space-y-3 my-4">
          <div className="text-[11px] font-bold text-ink/40 uppercase tracking-wider text-center">
            Instant 1-Click Evaluation
          </div>

          <button
            onClick={() => handleDemoLogin('seeker')}
            disabled={loadingRole !== null}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-fire/30 bg-gradient-to-r from-fire/5 to-transparent hover:from-fire/10 hover:border-fire transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-fire/10 text-fire flex items-center justify-center group-hover:scale-105 transition-transform">
                {loadingRole === 'seeker' ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-sm font-bold text-ink">Continue as Seeker</div>
                <div className="text-[11px] text-ink/50">Browse matches &amp; send connects</div>
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-fire/40" />
          </button>

          <button
            onClick={() => handleDemoLogin('owner')}
            disabled={loadingRole !== null}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-navy/20 bg-gradient-to-r from-navy/5 to-transparent hover:from-navy/10 hover:border-navy/40 transition-all group text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-navy/10 text-navy flex items-center justify-center group-hover:scale-105 transition-transform">
                {loadingRole === 'owner' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Building2 className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-sm font-bold text-ink">Continue as Owner</div>
                <div className="text-[11px] text-ink/50">Manage listing &amp; applicants</div>
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-navy/40" />
          </button>
        </div>}

        {DEMO_MODE_ENABLED && <div className="relative my-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
            <span className="bg-white px-3 text-ink/40 font-bold">or</span>
          </div>
        </div>}

        <button
          onClick={() => {
            onClose();
            navigate('/login');
          }}
          className="w-full py-3.5 rounded-2xl bg-white border border-border text-ink text-sm font-bold hover:bg-stone-50 transition-all flex items-center justify-center gap-2.5 shadow-xs"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
