import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  ShieldCheck,
  Smartphone,
  AlertCircle,
  ArrowRight,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

export default function VerifyPhone() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    sendOTP,
    verifyAndLinkPhone,
    logout,
    initRecaptcha,
    error: authError,
  } = useAuth();

  const [step, setStep] = useState<'input' | 'otp'>('input');
  const [phone, setPhone] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If user already has a verified phone number, bounce to role-select or dashboard
  useEffect(() => {
    if (profile?.phone && profile.phone.trim().length > 0) {
      if (!profile.role || !profile.onboardingComplete) {
        navigate('/onboarding/seeker', { replace: true });
      } else {
        navigate('/explore?tab=rooms', { replace: true });
      }
    }
  }, [profile, navigate]);

  useEffect(() => {
    initRecaptcha('recaptcha-verify-phone-container');
    return () => {
      try {
        window.recaptchaVerifier?.clear();
      } catch {
        // The verifier may already be cleared after a completed or expired challenge.
      }
      window.recaptchaVerifier = null;
    };
  }, [initRecaptcha]);

  useEffect(() => {
    if (step === 'otp' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, countdown]);

  useEffect(() => {
    if (step === 'otp') {
      inputRefs.current[0]?.focus();
    }
  }, [step]);

  const validatePhone = (num: string) => /^[6-9]\d{9}$/.test(num.trim());

  const handleSendOTP = async () => {
    setError('');
    const clean = phone.trim().replace(/\D/g, '');
    if (!clean) {
      setError('Please enter your 10-digit mobile number');
      return;
    }
    if (!validatePhone(clean)) {
      setError('Please enter a valid 10-digit Indian mobile number starting with 6-9');
      return;
    }

    setLoading(true);
    try {
      const e164 = `+91${clean}`;
      const vId = await sendOTP(e164, 'recaptcha-verify-phone-container');
      setVerificationId(vId);
      setStep('otp');
      setCountdown(60);
      toast.success('Verification code sent to +91 ' + clean);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    setError('');
    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    setOtp(newOtp);

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit on last digit
    if (index === 5 && val) {
      const fullCode = [...newOtp.slice(0, 5), val].join('');
      if (fullCode.length === 6) {
        setTimeout(() => handleVerifyOTP(fullCode), 150);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const digits = pasted.split('');
    const next = ['', '', '', '', '', ''];
    digits.forEach((d, i) => { if (i < 6) next[i] = d; });
    setOtp(next);
    if (pasted.length === 6) {
      setTimeout(() => handleVerifyOTP(pasted), 150);
    } else if (digits.length < 6) {
      inputRefs.current[digits.length]?.focus();
    }
  };

  const handleVerifyOTP = async (codeToVerify?: string) => {
    const code = codeToVerify || otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const clean = phone.trim().replace(/\D/g, '');
      const e164 = `+91${clean}`;
      await verifyAndLinkPhone(verificationId, code, e164);
      toast.success('Phone number verified successfully!');

      if (!profile?.role || !profile.onboardingComplete) {
        navigate('/onboarding/seeker', { replace: true });
      } else {
        navigate('/explore?tab=rooms', { replace: true });
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    await handleSendOTP();
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] flex flex-col justify-center items-center px-4 py-12">
      {/* Invisible reCAPTCHA Anchor */}
      <div id="recaptcha-verify-phone-container" />

      <div className="w-full max-w-md">
        {/* Top NestMate Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFF2EB] border border-[#FF5A36]/20 text-[#FF5A36] text-xs font-bold uppercase tracking-wider mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Mandatory Member Verification</span>
          </div>
          <h1 className="font-serif text-3xl font-medium text-[#1E2229] tracking-tight">
            Verify Your Mobile Number
          </h1>
          <p className="text-xs text-gray-500 mt-2 max-w-xs mx-auto leading-relaxed">
            To ensure trust and eliminate ghost accounts, every NestMate member must verify a genuine Indian mobile number.
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xl shadow-gray-200/50 space-y-6">
          {/* User Google Badge */}
          <div className="flex items-center justify-between p-3.5 bg-[#FBFBFC] border border-gray-100 rounded-2xl">
            <div className="flex items-center gap-3 min-w-0">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google User'}
                  className="w-10 h-10 rounded-full object-cover border border-white shadow-2xs"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#1E2229] text-white font-bold flex items-center justify-center text-sm">
                  {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#1E2229] truncate">
                  {user?.displayName || 'Welcome'}
                </p>
                <p className="text-[11px] text-gray-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 border border-emerald-200/60">
              <CheckCircle2 className="w-3 h-3" />
              <span>Google Verified</span>
            </span>
          </div>

          {step === 'input' ? (
            /* STEP 1: Phone Input */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#1E2229] mb-2 uppercase tracking-wider">
                  Mobile Number (India)
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1.5 text-xs font-bold text-gray-700 select-none">
                    <span>🇮🇳</span>
                    <span>+91</span>
                    <span className="text-gray-300 ml-1">|</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    maxLength={10}
                    value={phone}
                    onChange={(e) => {
                      setError('');
                      setPhone(e.target.value.replace(/\D/g, ''));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendOTP();
                    }}
                    placeholder="98765 43210"
                    className="w-full pl-20 pr-4 py-3.5 bg-[#FBFBFC] border border-gray-200 rounded-2xl text-sm font-bold text-[#1E2229] placeholder:text-gray-400 focus:outline-none focus:border-[#FF5A36] focus:bg-white transition-all tracking-wider"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>Your number is kept private and never shown publicly without your consent.</span>
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200/80 rounded-2xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                disabled={loading || phone.trim().length !== 10}
                onClick={handleSendOTP}
                className="w-full py-4 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full font-bold text-xs shadow-md shadow-[#FF5A36]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* STEP 2: OTP Input */
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-xs text-gray-500">
                  Enter the 6-digit verification code sent to
                </p>
                <p className="font-mono font-bold text-sm text-[#1E2229] mt-0.5">
                  +91 {phone}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep('input');
                    setOtp(['', '', '', '', '', '']);
                    setError('');
                  }}
                  className="text-[11px] font-bold text-[#FF5A36] hover:underline mt-1 cursor-pointer"
                >
                  Change phone number
                </button>
              </div>

              {/* 6 Digit Inputs */}
              <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-2xl border transition-all focus:outline-none ${
                      digit
                        ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#FF5A36] shadow-xs'
                        : 'border-gray-200 bg-[#FBFBFC] text-[#1E2229] focus:border-[#FF5A36] focus:bg-white'
                    } ${error ? 'border-red-400 bg-red-50/50' : ''}`}
                  />
                ))}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200/80 rounded-2xl flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                disabled={loading || otp.join('').length !== 6}
                onClick={() => handleVerifyOTP()}
                className="w-full py-4 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full font-bold text-xs shadow-md shadow-[#FF5A36]/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify &amp; Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                {countdown > 0 ? (
                  <p className="text-xs text-gray-400">
                    Resend SMS code in <span className="font-mono font-bold text-gray-700">{countdown}s</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FF5A36] hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resend verification code</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Switch Google Account / Logout */}
          <div className="pt-4 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign in with a different Google account</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
