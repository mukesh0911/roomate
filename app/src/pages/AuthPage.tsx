import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Users,
  Leaf,
  Home,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    resetPassword,
    error: authError,
  } = useAuth();

  const redirectParam = new URLSearchParams(location.search).get('redirect') || '';
  const isAdminRedirect = redirectParam === '/admin' || redirectParam.startsWith('/admin');

  const [authMethod, setAuthMethod] = useState<'google' | 'email' | 'forgot'>(() => {
    return isAdminRedirect ? 'email' : 'google';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Status state
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const displayError = error || authError;
  const showEmulatorHelpers = import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';
  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      const { isNew, role, onboardingComplete } = await signInWithGoogle();
      if (isAdminRedirect) {
        navigate(redirectParam || '/admin');
        return;
      }

      if (redirectParam && !redirectParam.startsWith('/admin')) {
        navigate(redirectParam);
        return;
      }

      if (isNew || !role) {
        navigate('/role-select');
      } else if (!onboardingComplete) {
        navigate(role === 'owner' ? '/onboarding/owner' : '/onboarding/seeker');
      } else {
        navigate(role === 'owner' ? '/owner-dashboard' : '/explore?tab=rooms');
      }
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    setError('');
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Enter your email');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const { isNew, role, onboardingComplete } = await signInWithEmail(cleanEmail, password);
      if (isAdminRedirect) {
        navigate(redirectParam || '/admin');
        return;
      }
      if (redirectParam && !redirectParam.startsWith('/admin')) {
        navigate(redirectParam);
        return;
      }
      if (isNew || !role) {
        navigate('/role-select');
      } else if (!onboardingComplete) {
        navigate(role === 'owner' ? '/onboarding/owner' : '/onboarding/seeker');
      } else {
        navigate(role === 'owner' ? '/owner-dashboard' : '/explore?tab=rooms');
      }
    } catch (e: any) {
      if (e?.code === 'auth/user-not-found' || e?.code === 'auth/invalid-credential') {
        try {
          await signUpWithEmail(cleanEmail, password);
          if (isAdminRedirect) {
            navigate(redirectParam || '/admin');
            return;
          }
          navigate('/role-select');
          return;
        } catch (signupErr: any) {
          if (signupErr?.code === 'auth/email-already-in-use' || signupErr?.message?.includes('email-already-in-use')) {
            setError('Incorrect password. An account with this email already exists.');
            return;
          }
          setError(signupErr.message || 'Authentication failed. Please check your credentials.');
          return;
        }
      }
      setError(e.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError('Enter your email above');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSuccess('Password reset email sent! Check your inbox.');
    } catch (e: any) {
      setError(e.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1E2229] relative selection:bg-[#FF5A36]/20">

      {/* ========================================================================= */}
      {/* DESKTOP VIEW (>= 1024px) - CENTERED AUTH CARD                             */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex min-h-screen flex-col items-center justify-center p-6 xl:p-8 relative overflow-hidden">
        {/* Centered Auth Card Container */}
        <div className="w-full max-w-[430px] relative z-10 my-auto">
          {/* Brand Logo Header */}
          <div className="flex justify-center mb-6">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-2xl bg-[#FF5A36] flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105">
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 10.5L12 3l9 7.5" />
                  <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
                  <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
                </svg>
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-[#1E2229] leading-none block">NestMate</span>
                <span className="text-[9px] font-extrabold tracking-[0.22em] text-[#8C8CA1] uppercase block mt-1">
                  PEOPLE · PLACES · POSSIBILITIES
                </span>
              </div>
            </Link>
          </div>

          <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-stone-200/80 p-7 sm:p-8 xl:p-9 relative transition-all">
              {/* 3D Phone with Heart on Peach Cloud */}
              <div className="flex justify-center -mt-2 mb-1">
                <img
                  src="/assets/auth/ref-phone-3d-perfect.png"
                  alt="NestMate App"
                  className="w-20 h-auto object-contain select-none"
                />
              </div>

              {/* GOOGLE AUTH MODE */}
              {authMethod === 'google' && (
                <div>
                  <div className="text-center mb-6">
                    <h2 className="text-[22px] xl:text-[25px] font-bold text-[#1E2229] tracking-tight">
                      Find Your Place &amp; People
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-500 mt-1.5 leading-relaxed">
                      Join thousands finding verified flatmates &amp; furnished spaces across India
                    </p>
                  </div>

                  {/* Primary Google Signup CTA */}
                  <div className="space-y-4 mb-6">
                    <button
                      type="button"
                      onClick={handleGoogle}
                      disabled={loading}
                      className="w-full min-h-[50px] flex items-center justify-center gap-3 py-3.5 px-5 bg-white hover:bg-stone-50/90 border border-stone-200/90 hover:border-stone-300 rounded-2xl text-sm font-bold text-[#1E2229] transition-all cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-xs active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="w-5 h-5 border-2 border-stone-300 border-t-[#FF5A36] rounded-full animate-spin" />
                      ) : (
                        <>
                          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          <span>Continue with Google</span>
                        </>
                      )}
                    </button>
                  </div>

                  {displayError && (
                    <p
                      className="flex items-center gap-1.5 text-xs text-red-500 mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
                      role="alert"
                    >
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {displayError}
                    </p>
                  )}

                  {/* 3 Trust Badges Row */}
                  <div className="grid grid-cols-3 gap-2 py-3 px-2 bg-[#FAF7F2] rounded-2xl border border-stone-100 mb-5">
                    <div className="flex flex-col items-center text-center gap-1">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Lock className="w-3 h-3" />
                      </div>
                      <span className="text-[9px] font-semibold text-stone-600 leading-tight">
                        Number stays private
                      </span>
                    </div>

                    <div className="flex flex-col items-center text-center gap-1">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <Leaf className="w-2.5 h-2.5" />
                      </div>
                      <span className="text-[9px] font-semibold text-stone-600 leading-tight">
                        100% free to connect
                      </span>
                    </div>

                    <div className="flex flex-col items-center text-center gap-1">
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                        <Users className="w-2.5 h-2.5" />
                      </div>
                      <span className="text-[9px] font-semibold text-stone-600 leading-tight">
                        Real verified roommates
                      </span>
                    </div>
                  </div>

                  {/* Legal Footer */}
                  <p className="text-center text-[10px] text-stone-400 mb-4">
                    By continuing, you agree to our{' '}
                    <Link to="/terms" className="underline hover:text-stone-600">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="underline hover:text-stone-600">
                      Privacy Policy
                    </Link>
                    .
                  </p>

                  {/* Admin Sign In link */}
                  <div className="text-center pt-3 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMethod('email');
                        setError('');
                      }}
                      className="text-[11px] font-medium text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                    >
                      Administrator Access? Sign in with Email
                    </button>
                  </div>
                </div>
              )}

              {/* EMAIL AUTH MODE */}
              {authMethod === 'email' && (
                <div>
                  <button
                    onClick={() => {
                      setAuthMethod('google');
                      setError('');
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-[#1E2229] mb-4 transition-colors cursor-pointer"
                  >
                    ← Back to Google Sign In
                  </button>

                  {isAdminRedirect && (
                    <div className="mb-4 p-3 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-sm flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-[#FF5A36]/20 border border-[#FF5A36]/30 flex items-center justify-center font-bold text-[#FF5A36] shrink-0 mt-0.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#FF5A36]" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Administrator Access</p>
                        <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                          Sign in with an account present in the administrator registry.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-5">
                    <h2 className="text-xl font-bold text-[#1E2229]">
                      {isAdminRedirect ? 'Admin Sign In' : 'Sign in with Email'}
                    </h2>
                    <p className="text-xs text-stone-500 mt-1">
                      {isAdminRedirect ? 'Enter your admin credentials' : 'Enter your email and password'}
                    </p>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError('');
                        }}
                        placeholder="you@example.com"
                        aria-label="Email address"
                        className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 hover:border-stone-300 focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/10 text-sm font-medium outline-hidden"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && document.getElementById('pw-input')?.focus()}
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <input
                        id="pw-input"
                        type={showPass ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError('');
                        }}
                        placeholder="Password (min 6 characters)"
                        aria-label="Password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-stone-200 hover:border-stone-300 focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/10 text-sm font-medium outline-hidden"
                        onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {displayError && (
                    <p
                      className="flex items-center gap-1.5 text-xs text-red-500 mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
                      role="alert"
                    >
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {displayError}
                    </p>
                  )}

                  <button
                    onClick={handleEmailSubmit}
                    disabled={loading}
                    className="w-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-sm py-3 px-6 rounded-2xl shadow-md shadow-[#FF5A36]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 mb-3"
                  >
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>{isAdminRedirect ? 'Sign In to Admin Portal' : 'Continue with Email'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex justify-between items-center text-xs text-stone-500 pt-2">
                    <button
                      type="button"
                      onClick={() => setAuthMethod('forgot')}
                      className="hover:underline text-stone-500 cursor-pointer"
                    >
                      Forgot password?
                    </button>
                    <button
                      type="button"
                      onClick={handleGoogle}
                      className="text-[#FF5A36] font-semibold hover:underline cursor-pointer"
                    >
                      Use Google instead
                    </button>
                  </div>
                </div>
              )}

              {/* FORGOT PASSWORD MODE */}
              {authMethod === 'forgot' && (
                <div>
                  <button
                    onClick={() => {
                      setAuthMethod('email');
                      setError('');
                      setSuccess('');
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-[#1E2229] mb-4 transition-colors cursor-pointer"
                  >
                    ← Back to Email Sign In
                  </button>
                  <div className="text-center mb-5">
                    <h2 className="text-xl font-bold text-[#1E2229]">Reset Password</h2>
                    <p className="text-xs text-stone-500 mt-1">
                      We'll send a password reset link to your email.
                    </p>
                  </div>

                  <div className="relative mb-4">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      placeholder="you@example.com"
                      aria-label="Email address"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 hover:border-stone-300 focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/10 text-sm font-medium outline-hidden"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleForgot()}
                    />
                  </div>

                  {displayError && (
                    <p className="flex items-center gap-1.5 text-xs text-red-500 mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {displayError}
                    </p>
                  )}
                  {success && (
                    <p className="flex items-center gap-1.5 text-xs text-emerald-600 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                      {success}
                    </p>
                  )}

                  <button
                    onClick={handleForgot}
                    disabled={loading}
                    className="w-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-sm py-2.5 px-6 rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              )}
            </div>
          </div>

        {/* Discreet bottom dev quick-fill for local testing */}
        {showEmulatorHelpers && (
          <div className="absolute bottom-2 left-6 z-20 text-[10px] text-stone-400 opacity-60 hover:opacity-100 flex gap-2">
            <span>Dev:</span>
            <button
              type="button"
              onClick={() => {
                setEmail('seeker.a@nestmate.test');
                setPassword('Nestmate-Emulator-Only-123!');
                setAuthMethod('email');
              }}
              className="underline hover:text-[#FF5A36]"
            >
              Fill Demo Seeker
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setEmail('admin.qa@nestmate.test');
                setPassword('Nestmate-Emulator-Only-123!');
                setAuthMethod('email');
              }}
              className="underline hover:text-[#FF5A36]"
            >
              Fill Admin
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MOBILE VIEW (< 1024px)                                                    */}
      {/* ========================================================================= */}
      <div className="lg:hidden min-h-screen flex flex-col justify-center px-4 py-8 relative z-10">
        {/* Mobile Brand Logo Header */}
        <div className="flex justify-center mb-6">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-[#FF5A36] flex items-center justify-center text-white shadow-xs transition-transform group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
                <path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
              </svg>
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-[#1E2229] leading-none block">NestMate</span>
              <span className="text-[9px] font-extrabold tracking-[0.22em] text-[#8C8CA1] uppercase block mt-1">
                PEOPLE · PLACES · POSSIBILITIES
              </span>
            </div>
          </Link>
        </div>

        {/* Mobile Auth Card */}
        <div className="w-full max-w-[400px] mx-auto px-1 sm:px-0">
          <div className="bg-white rounded-[28px] sm:rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.06)] border border-stone-200/80 p-6 sm:p-7 relative transition-all">
            {/* Playful & Trustworthy Brand Element */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FFF2EB] to-[#FFF7ED] text-[#FF5A36] flex items-center justify-center mx-auto mb-3.5 border border-[#FF5A36]/20 shadow-xs">
              <Home className="w-6 h-6 text-[#FF5A36]" />
            </div>

            {authMethod === 'google' && (
              <div>
                <div className="text-center mb-5">
                  <h2 className="text-xl sm:text-[22px] font-bold text-[#1E2229] tracking-tight">
                    Find Your Place &amp; People
                  </h2>
                  <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                    Join verified flatmates &amp; furnished spaces in your city
                  </p>
                </div>

                {/* Google Sign-in CTA */}
                <div className="space-y-4 mb-5">
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={loading}
                    className="w-full min-h-[48px] flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-stone-50 border border-stone-200/90 hover:border-stone-300 rounded-2xl text-xs sm:text-sm font-bold text-[#1E2229] shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-stone-300 border-t-[#FF5A36] rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>
                </div>

                {displayError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-500 mb-4 bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {displayError}
                  </p>
                )}

                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-2 py-2.5 px-2 bg-[#FAF7F2] rounded-2xl border border-stone-100 mb-4">
                  <div className="flex flex-col items-center text-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Lock className="w-2.5 h-2.5" />
                    </div>
                    <span className="text-[9px] font-semibold text-stone-600 leading-tight">
                      Privacy first
                    </span>
                  </div>

                  <div className="flex flex-col items-center text-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <Leaf className="w-2.5 h-2.5" />
                    </div>
                    <span className="text-[9px] font-semibold text-stone-600 leading-tight">
                      Zero brokerage
                    </span>
                  </div>

                  <div className="flex flex-col items-center text-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                      <Users className="w-2.5 h-2.5" />
                    </div>
                    <span className="text-[9px] font-semibold text-stone-600 leading-tight">
                      Verified profiles
                    </span>
                  </div>
                </div>

                {/* Legal Note */}
                <p className="text-center text-[10px] text-stone-400 mb-3">
                  By continuing, you agree to our{' '}
                  <Link to="/terms" className="underline hover:text-stone-600">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="underline hover:text-stone-600">
                    Privacy Policy
                  </Link>
                  .
                </p>

                {/* Admin Link */}
                <div className="text-center pt-2.5 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod('email');
                      setError('');
                    }}
                    className="text-[11px] font-medium text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                  >
                    Administrator sign in with Email
                  </button>
                </div>
              </div>
            )}

            {/* MOBILE EMAIL AUTH */}
            {authMethod === 'email' && (
              <div>
                <button
                  onClick={() => {
                    setAuthMethod('google');
                    setError('');
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-[#1E2229] mb-3 cursor-pointer"
                >
                  ← Back to Google Sign In
                </button>

                {isAdminRedirect && (
                  <div className="mb-4 p-3 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xs flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-[#FF5A36]/20 border border-[#FF5A36]/30 flex items-center justify-center font-bold text-[#FF5A36] shrink-0 mt-0.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#FF5A36]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Administrator Access</p>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                        Sign in with an account present in the administrator registry.
                      </p>
                    </div>
                  </div>
                )}

                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-[#1E2229]">
                    {isAdminRedirect ? 'Admin Sign In' : 'Sign in with Email'}
                  </h2>
                  <p className="text-xs text-stone-500 mt-1">
                    {isAdminRedirect ? 'Enter your admin credentials' : 'Enter your email and password'}
                  </p>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      placeholder="you@example.com"
                      aria-label="Email address"
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 hover:border-stone-300 focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/10 text-sm font-medium outline-hidden"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && document.getElementById('mobile-pw-input')?.focus()}
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      id="mobile-pw-input"
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="Password (min 6 chars)"
                      aria-label="Password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-stone-200 hover:border-stone-300 focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/10 text-sm font-medium outline-hidden"
                      onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {displayError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-500 mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {displayError}
                  </p>
                )}

                <button
                  onClick={handleEmailSubmit}
                  disabled={loading}
                  className="w-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-sm py-3 px-5 rounded-2xl shadow-md cursor-pointer disabled:opacity-50 mb-3 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{isAdminRedirect ? 'Sign In to Admin Portal' : 'Continue with Email'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex justify-between items-center text-xs text-stone-500 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod('forgot');
                      setError('');
                      setSuccess('');
                    }}
                    className="hover:underline text-stone-500 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogle}
                    className="text-[#FF5A36] font-semibold hover:underline cursor-pointer"
                  >
                    Use Google instead
                  </button>
                </div>
              </div>
            )}

            {/* MOBILE FORGOT PASSWORD AUTH */}
            {authMethod === 'forgot' && (
              <div>
                <button
                  onClick={() => {
                    setAuthMethod('email');
                    setError('');
                    setSuccess('');
                  }}
                  className="flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-[#1E2229] mb-3 cursor-pointer"
                >
                  ← Back to Email Sign In
                </button>

                <div className="text-center mb-4">
                  <h2 className="text-lg font-bold text-[#1E2229]">Reset Password</h2>
                  <p className="text-xs text-stone-500 mt-1">
                    We'll send a password reset link to your email.
                  </p>
                </div>

                <div className="relative mb-4">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    placeholder="you@example.com"
                    aria-label="Email address"
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 hover:border-stone-300 focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/10 text-sm font-medium outline-hidden"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleForgot()}
                  />
                </div>

                {displayError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-500 mb-3 bg-red-50 border border-red-200 rounded-xl px-3 py-2" role="alert">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    {displayError}
                  </p>
                )}
                {success && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-600 mb-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    {success}
                  </p>
                )}

                <button
                  onClick={handleForgot}
                  disabled={loading}
                  className="w-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white font-bold text-sm py-2.5 px-6 rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Discreet mobile dev helper */}
        {showEmulatorHelpers && (
          <div className="px-6 py-2 text-center text-[10px] text-stone-400 opacity-60 flex justify-center gap-3">
            <span>Dev:</span>
            <button
              type="button"
              onClick={() => {
                setEmail('seeker.a@nestmate.test');
                setPassword('Nestmate-Emulator-Only-123!');
                setAuthMethod('email');
              }}
              className="underline hover:text-[#FF5A36]"
            >
              Demo Seeker
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setEmail('admin.qa@nestmate.test');
                setPassword('Nestmate-Emulator-Only-123!');
                setAuthMethod('email');
              }}
              className="underline hover:text-[#FF5A36]"
            >
              Admin
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
