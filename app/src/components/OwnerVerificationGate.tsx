/**
 * OwnerVerificationGate — shown in Owner Dashboard and EditListing
 * when the owner has not yet completed identity verification.
 *
 * This component renders the full verification flow:
 *   1. Current status display (NOT_STARTED / SUBMITTED / UNDER_REVIEW / REJECTED / RESUBMISSION_REQUIRED)
 *   2. Document upload and submission form
 *   3. Real-time status updates via Firestore subscription
 *
 * It does NOT render when status === APPROVED (the listing is public).
 *
 * TRUST SIGNAL ACCURACY:
 *   We verify identity (via document review), NOT property ownership.
 *   The UI copy reflects this distinction.
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStorage } from '@/hooks/useStorage';
import {
  subscribeToOwnerVerification,
  submitOwnerVerification,
  verificationStatusLabel,
  verificationStatusDescription,
  type OwnerVerification,
  type OwnerVerificationStatus,
  type VerificationDocType,
} from '@/lib/ownerVerification';
import {
  ShieldCheck, Shield, AlertTriangle, CheckCircle2, Clock,
  Upload, FileText, X, Loader2, ArrowRight, RefreshCcw, Info
} from 'lucide-react';

// ─── Props ───────────────────────────────────────────────────────────────────

interface OwnerVerificationGateProps {
  /** If provided, shown as context for why verification is needed */
  listingTitle?: string;
  /** Called when the user dismisses or cancels (optional) */
  onDismiss?: () => void;
  /** Show as inline panel (default) or full-screen modal overlay */
  variant?: 'inline' | 'fullscreen';
}

// ─── Status visual config ─────────────────────────────────────────────────────

function StatusConfig(status: OwnerVerificationStatus | null | undefined) {
  switch (status) {
    case 'APPROVED':
      return {
        icon: <CheckCircle2 className="w-7 h-7 text-emerald-600" />,
        bg: 'bg-emerald-50/70',
        border: 'border-emerald-200/80',
        badge: 'bg-emerald-100/80 text-emerald-800 border-emerald-300',
        title: 'Identity Verified',
      };
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return {
        icon: <Clock className="w-7 h-7 text-amber-600" />,
        bg: 'bg-amber-50/70',
        border: 'border-amber-200/80',
        badge: 'bg-amber-100/80 text-amber-800 border-amber-300',
        title: 'Under Review',
      };
    case 'REJECTED':
      return {
        icon: <AlertTriangle className="w-7 h-7 text-red-600" />,
        bg: 'bg-red-50/70',
        border: 'border-red-200/80',
        badge: 'bg-red-100/80 text-red-800 border-red-300',
        title: 'Verification Rejected',
      };
    case 'RESUBMISSION_REQUIRED':
      return {
        icon: <RefreshCcw className="w-7 h-7 text-[#FF5A36]" />,
        bg: 'bg-[#FFF2EB]',
        border: 'border-[#FF5A36]/20',
        badge: 'bg-[#FFF2EB] text-[#FF5A36] border-[#FF5A36]/30',
        title: 'Resubmission Required',
      };
    default:
      return {
        icon: <Shield className="w-7 h-7 text-[#1E2229]/70" />,
        bg: 'bg-white',
        border: 'border-gray-200/80',
        badge: 'bg-gray-100 text-[#1E2229] border-gray-200',
        title: 'Verification Required',
      };
  }
}

const DOC_TYPES: { value: VerificationDocType; label: string; desc: string }[] = [
  { value: 'aadhaar', label: 'Aadhaar Card', desc: 'Front and back photo or masked e-Aadhaar PDF' },
  { value: 'passport', label: 'Passport', desc: 'Front and address pages clearly visible' },
  { value: 'driving_license', label: 'Driving License', desc: 'Valid Indian state transport card' },
  { value: 'voter_id', label: 'Voter ID', desc: 'Official election commission card' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function OwnerVerificationGate({
  listingTitle,
  onDismiss,
  variant = 'inline',
}: OwnerVerificationGateProps) {
  const { user } = useAuth();
  const { uploadVerificationDocument } = useStorage();

  const [verification, setVerification] = useState<OwnerVerification | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(true);

  // Submission form state
  const [showForm, setShowForm] = useState(false);
  const [docType, setDocType] = useState<VerificationDocType>('aadhaar');
  const [declaredName, setDeclaredName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time subscription to verification status
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToOwnerVerification(user.uid, (v) => {
      setVerification(v);
      setVerificationLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  const currentStatus = verification?.status ?? 'NOT_STARTED';
  const cfg = StatusConfig(currentStatus);

  const canSubmit = currentStatus === 'NOT_STARTED'
    || currentStatus === 'REJECTED'
    || currentStatus === 'RESUBMISSION_REQUIRED';

  const isPending = currentStatus === 'SUBMITTED' || currentStatus === 'UNDER_REVIEW';

  // Don't render anything if approved — caller should conditionally mount this
  if (currentStatus === 'APPROVED') return null;

  if (verificationLoading) {
    return (
      <div className={`flex items-center justify-center py-16 ${variant === 'fullscreen' ? 'min-h-screen bg-[#FBFBFC]' : ''}`}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-[#FF5A36]" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Checking verification status...</p>
        </div>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('File must be smaller than 10MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setSubmitError('Please upload a JPG, PNG, WEBP, or PDF file');
      return;
    }
    setDocFile(file);
    setSubmitError('');
    if (file.type.startsWith('image/')) {
      setDocPreview(URL.createObjectURL(file));
    } else {
      setDocPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!user?.uid) return;
    if (!docFile) { setSubmitError('Please upload your identity document'); return; }
    if (!declaredName.trim()) { setSubmitError('Please enter your full name as it appears on the document'); return; }

    setSubmitting(true);
    setSubmitError('');
    setUploadProgress(0);

    try {
      // Upload document to Firebase Storage (in a protected path)
      const documentUrl = await uploadVerificationDocument(docFile, user.uid, (pct) => setUploadProgress(pct));

      // Submit verification record
      await submitOwnerVerification(user.uid, {
        documentType: docType,
        documentUrl,
        declaredName: declaredName.trim(),
      });

      setSubmitSuccess(true);
      setShowForm(false);
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Main render ──────────────────────────────────────────────────────────

  const containerClass = variant === 'fullscreen'
    ? 'min-h-screen bg-[#FBFBFC] flex items-start justify-center p-6 pt-12 md:pt-16'
    : '';

  return (
    <div className={containerClass}>
      <div className="w-full max-w-2xl mx-auto space-y-4">

        {/* Gate Banner Card */}
        <div className={`rounded-3xl border ${cfg.bg} ${cfg.border} p-6 md:p-8 shadow-xs transition-all`}>
          <div className="flex items-start gap-4 md:gap-5">
            <div className="w-12 h-12 rounded-2xl bg-white/80 shadow-xs flex items-center justify-center shrink-0 border border-gray-100">
              {cfg.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h2 className="font-serif font-medium text-xl text-[#1E2229]">{cfg.title}</h2>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${cfg.badge}`}>
                  {verificationStatusLabel(currentStatus)}
                </span>
              </div>

              {listingTitle && (
                <p className="text-xs text-gray-500 mb-2">
                  Target Listing: <span className="font-semibold text-[#1E2229]">{listingTitle}</span>
                </p>
              )}

              <p className="text-sm text-gray-600 leading-relaxed font-sans">
                {verificationStatusDescription(currentStatus)}
              </p>

              {/* Admin rejection note */}
              {(currentStatus === 'REJECTED' || currentStatus === 'RESUBMISSION_REQUIRED') && verification?.reviewNote && (
                <div className="mt-3.5 p-3.5 bg-white/90 rounded-2xl border border-red-200/80 shadow-2xs">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Reviewer Note
                  </p>
                  <p className="text-sm text-[#1E2229] leading-relaxed">{verification.reviewNote}</p>
                </div>
              )}

              {/* Resubmission count */}
              {(verification?.resubmissionCount ?? 0) > 0 && (
                <p className="text-xs text-gray-400 mt-2 font-medium">
                  Attempt #{(verification?.resubmissionCount ?? 0) + 1}
                </p>
              )}
            </div>

            {/* Dismiss button (optional) */}
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="shrink-0 p-2 hover:bg-black/5 rounded-full text-gray-400 hover:text-[#1E2229] transition-colors"
                title="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-6 pt-5 border-t border-gray-200/60 flex gap-3 flex-wrap items-center">
            {canSubmit && !showForm && (
              <button
                onClick={() => { setShowForm(true); setSubmitError(''); }}
                className="flex items-center gap-2 px-6 py-3 bg-[#FF5A36] text-white rounded-full font-semibold text-sm hover:bg-[#E54E2B] active:scale-[0.98] transition-all shadow-sm shadow-[#FF5A36]/20"
              >
                <ShieldCheck className="w-4 h-4" />
                {currentStatus === 'NOT_STARTED' ? 'Begin Verification' : 'Resubmit Documents'}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            {isPending && (
              <div className="flex items-center gap-2 text-sm text-gray-600 font-medium bg-white/60 px-4 py-2 rounded-full border border-gray-200/60">
                <Loader2 className="w-4 h-4 animate-spin text-[#FF5A36]" />
                Under manual review — typically verified within 12–24 hours
              </div>
            )}
          </div>
        </div>

        {/* Submit success alert */}
        {submitSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 flex items-start gap-4 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-serif font-medium text-emerald-950 text-base">Documents submitted successfully!</p>
              <p className="text-sm text-emerald-800 mt-1 leading-relaxed">
                Our verification team will review your ID document within 12–24 hours. Your listing will automatically switch to public once approved.
              </p>
            </div>
          </div>
        )}

        {/* Submission Form Modal/Card */}
        {showForm && canSubmit && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-serif font-medium text-xl text-[#1E2229] flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center text-sm">
                    <FileText className="w-4 h-4" />
                  </span>
                  Submit Identity Verification
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 ml-10.5">Quick 1-minute secure document submission</p>
              </div>
              <button
                onClick={() => { setShowForm(false); setSubmitError(''); }}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Honest disclaimer notice */}
            <div className="bg-[#FFF2EB]/60 border border-[#FF5A36]/15 rounded-2xl p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-[#FF5A36] shrink-0 mt-0.5" />
              <p className="text-xs text-[#1E2229]/80 leading-relaxed font-sans">
                <strong className="text-[#1E2229] font-semibold">Privacy Guarantee:</strong> We verify your legal identity to protect prospective roommates from scammers. We do not claim or verify real estate deed ownership. Documents are encrypted and handled exclusively by authorized NestMate safety reviewers.
              </p>
            </div>

            {/* Full legal name */}
            <div>
              <label className="text-xs font-semibold text-[#1E2229] uppercase tracking-wider block mb-2">
                Full Name (as printed on your ID) *
              </label>
              <input
                type="text"
                value={declaredName}
                onChange={e => setDeclaredName(e.target.value)}
                placeholder="e.g. Rajesh Kumar Sharma"
                className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[#1E2229] placeholder:text-gray-400 focus:outline-none focus:border-[#FF5A36] focus:ring-2 focus:ring-[#FF5A36]/10 transition-all"
              />
            </div>

            {/* Document type selection cards */}
            <div>
              <label className="text-xs font-semibold text-[#1E2229] uppercase tracking-wider block mb-2.5">
                Select Document Type *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DOC_TYPES.map(dt => {
                  const isSelected = docType === dt.value;
                  return (
                    <button
                      key={dt.value}
                      type="button"
                      onClick={() => setDocType(dt.value)}
                      className={`p-3.5 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#FF5A36] bg-[#FFF2EB] text-[#1E2229] shadow-2xs'
                          : 'border-gray-200 bg-white hover:border-[#FF5A36]/40 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold ${isSelected ? 'text-[#FF5A36]' : 'text-[#1E2229]'}`}>
                          {dt.label}
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-[#FF5A36] bg-[#FF5A36]' : 'border-gray-300'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                      <span className="text-[11px] text-gray-500 leading-tight">
                        {dt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Document upload dropzone */}
            <div>
              <label className="text-xs font-semibold text-[#1E2229] uppercase tracking-wider block mb-2">
                Upload Document File *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              {!docFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-8 px-4 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center gap-2.5 hover:border-[#FF5A36]/60 hover:bg-[#FFF2EB]/30 transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 group-hover:bg-[#FFF2EB] flex items-center justify-center text-gray-500 group-hover:text-[#FF5A36] transition-colors">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[#1E2229]">
                      Click to browse or drop document here
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Supports JPG, PNG, WEBP, or PDF · Max 10MB
                    </p>
                  </div>
                </button>
              ) : (
                <div className="border border-gray-200 bg-gray-50/60 rounded-3xl p-4 relative">
                  {docPreview ? (
                    <div className="bg-white rounded-2xl p-2 border border-gray-100 shadow-2xs overflow-hidden">
                      <img src={docPreview} alt="Document preview" className="w-full max-h-52 object-contain rounded-xl" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3.5 p-3 bg-white rounded-2xl border border-gray-100">
                      <div className="w-10 h-10 rounded-xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1E2229] truncate">{docFile.name}</p>
                        <p className="text-xs text-gray-500">{(docFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { setDocFile(null); setDocPreview(null); }}
                    className="absolute top-6 right-6 w-8 h-8 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors text-white shadow-sm"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="mt-3 flex items-center justify-between px-1">
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ready for upload
                    </span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs text-[#FF5A36] font-semibold hover:underline"
                    >
                      Change document
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload progress */}
            {submitting && uploadProgress > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>Uploading encrypted file...</span>
                  <span className="text-[#FF5A36] font-bold">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF5A36] rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error banner */}
            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 font-medium">{submitError}</p>
              </div>
            )}

            {/* Submit button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !docFile || !declaredName.trim()}
                className="w-full py-3.5 bg-[#FF5A36] text-white rounded-full font-semibold text-sm hover:bg-[#E54E2B] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-[#FF5A36]/20"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting Document...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Submit for Official Review
                  </>
                )}
              </button>
              <p className="text-[11px] text-center text-gray-400 mt-2.5">
                Your listing will automatically switch to Live and Verified once our team approves your identity.
              </p>
            </div>
          </div>
        )}

        {/* What happens next step timeline */}
        {(currentStatus === 'NOT_STARTED' || currentStatus === 'SUBMITTED' || currentStatus === 'UNDER_REVIEW') && !showForm && !submitSuccess && (
          <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 shadow-xs">
            <h4 className="font-serif font-medium text-lg text-[#1E2229] mb-5">How NestMate Verification Works</h4>
            <div className="space-y-4">
              {[
                {
                  step: 1,
                  label: 'Submit Government ID',
                  desc: 'Aadhaar, Passport, Driving License, or Voter ID',
                  done: currentStatus !== 'NOT_STARTED',
                },
                {
                  step: 2,
                  label: 'Safety Team Review',
                  desc: 'Documents verified within 12–24 business hours',
                  done: false,
                },
                {
                  step: 3,
                  label: 'Listing Goes Live & Verified',
                  desc: 'Your property receives the Verified Host trust badge',
                  done: false,
                },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    item.done
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/20'
                  }`}>
                    {item.done ? <CheckCircle2 className="w-4 h-4" /> : item.step}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${item.done ? 'text-emerald-800' : 'text-[#1E2229]'}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
