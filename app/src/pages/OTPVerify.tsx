import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function OTPVerify() {
  const navigate = useNavigate();
  const location = useLocation();

  // Restore pending OTP verification if page was refreshed
  const savedState = (() => {
    try {
      const raw = sessionStorage.getItem('nestmate_otp_pending');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();

  const phone: string = location.state?.phone || savedState?.phone || '';
  const verificationId: string = location.state?.verificationId || savedState?.verificationId || '';

  const { verifyOTP, error: authError } = useAuth();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check if this is a test phone number
  const isTestPhone = ['+91 650 555 3434', '+91 650 555 3435', '+91 650 555 3436'].includes(phone);
  const isDevelopment = import.meta.env.DEV;

  // Redirect if no verificationId anywhere
  useEffect(() => {
    if (!verificationId) {
      navigate('/login');
    }
  }, [verificationId, navigate]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setError('');
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (index === 5 && value) {
      const code = [...newOtp.slice(0, 5), value].join('');
      if (code.length === 6) setTimeout(() => handleVerify(code), 200);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code?: string) => {
    const finalCode = code || otp.join('');
    if (finalCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { isNew, role, onboardingComplete } = await verifyOTP(verificationId, finalCode);
      try { sessionStorage.removeItem('nestmate_otp_pending'); } catch {
        // Storage can be unavailable in privacy-restricted browser contexts.
      }
      setLoading(false);
      if (isNew || !role || !onboardingComplete) {
        navigate('/onboarding/seeker');
      } else {
        navigate('/explore?tab=rooms');
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  const handleResend = () => {
    try { sessionStorage.removeItem('nestmate_otp_pending'); } catch {
      // Navigation must still work when session storage is unavailable.
    }
    navigate('/login', { state: { phone } });
  };

  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">
        {/* Back */}
        <button
          onClick={() => {
            try { sessionStorage.removeItem('nestmate_otp_pending'); } catch {
              // Navigation must still work when session storage is unavailable.
            }
            navigate('/login');
          }}
          className="flex items-center gap-2 text-sm text-ink/60 hover:text-ink mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to phone number
        </button>

        <div className="card-nestmate p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-fire/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-fire" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            </div>
            <h2 className="type-h2 mb-2">Verify your number</h2>
            <p className="text-sm text-ink/60">
              Code sent to <span className="font-medium text-ink">{phone}</span>
            </p>
          </div>

          {/* OTP Inputs */}
          <div className="flex justify-center gap-2 sm:gap-3 mb-6">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2 transition-all focus:border-fire focus:ring-2 focus:ring-fire/20 focus:outline-none bg-cream/50 ${
                  digit ? 'border-fire bg-fire/5 text-fire' : 'border-border'
                } ${error ? 'border-red-400' : ''}`}
              />
            ))}
          </div>

          {/* Development Test OTP */}
          {isDevelopment && isTestPhone && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs font-medium text-green-800 mb-2">🧪 Test OTP Code:</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-mono font-bold text-green-700">123456</span>
                <button
                  onClick={() => setOtp(['1', '2', '3', '4', '5', '6'])}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Auto-fill
                </button>
              </div>
            </div>
          )}

          {(error || authError) && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-red-500 mb-4">
              <AlertCircle className="w-3.5 h-3.5" />
              {error || authError}
            </p>
          )}

          {/* Verify Button */}
          <button
            onClick={() => handleVerify()}
            disabled={loading || otp.join('').length !== 6}
            className="w-full btn-fire disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying…
              </span>
            ) : 'Verify & Continue'}
          </button>

          {/* Resend */}
          <p className="text-center text-sm text-ink/60">
            {countdown > 0 ? (
              <>Resend code in <span className="font-medium text-fire">00:{countdown.toString().padStart(2, '0')}</span></>
            ) : (
              <button onClick={handleResend} className="text-fire font-medium hover:underline">
                Resend OTP
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
