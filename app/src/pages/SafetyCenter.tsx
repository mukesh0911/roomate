import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import {
  ShieldAlert, Shield, AlertTriangle, Phone,
  ArrowLeft, Flag, ExternalLink, UserX, Check, X
} from 'lucide-react';

export default function SafetyCenter() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { reportUser } = useUserProfile();

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam_or_scam');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const [blockedUsers, setBlockedUsers] = useState<{ id: string; name: string }[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  useEffect(() => {
    document.title = 'Safety Center | NestMate';
  }, []);

  // Escape key and body scroll lock for report modal
  useEffect(() => {
    if (!reportModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReportModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [reportModalOpen]);

  const blockedIds: string[] = useMemo(() => profile?.blockedUserIds || [], [profile?.blockedUserIds]);

  useEffect(() => {
    if (!blockedIds || blockedIds.length === 0) {
      setBlockedUsers([]);
      return;
    }
    let cancelled = false;
    async function loadBlocked() {
      setLoadingBlocked(true);
      try {
        const loaded: { id: string; name: string }[] = [];
        for (const bid of blockedIds) {
          try {
            const snap = await getDoc(doc(db, 'users', bid));
            if (snap.exists()) {
              const data = snap.data();
              loaded.push({ id: bid, name: data.name || 'User' });
            } else {
              loaded.push({ id: bid, name: 'User' });
            }
          } catch {
            loaded.push({ id: bid, name: 'User' });
          }
        }
        if (!cancelled) setBlockedUsers(loaded);
      } finally {
        if (!cancelled) setLoadingBlocked(false);
      }
    }
    loadBlocked();
    return () => { cancelled = true; };
  }, [blockedIds]);

  const handleUnblock = async (targetId: string, name: string) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        blockedUserIds: arrayRemove(targetId),
        updatedAt: serverTimestamp(),
      });
      await refreshProfile();
      setBlockedUsers(prev => prev.filter(u => u.id !== targetId));
      toast.success(`Unblocked ${name || 'user'}`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to unblock user');
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) {
      toast.error('Please sign in to report an issue');
      return;
    }
    setSubmittingReport(true);
    try {
      await reportUser({
        reporterId: user.uid,
        targetId: 'safety_general_inquiry',
        reason: reportReason,
        description: reportDetails.trim(),
      });
      toast.success('Report submitted to moderation team');
      setReportModalOpen(false);
      setReportDetails('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment pb-24">
      {/* Report Modal */}
      {reportModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setReportModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="safety-report-modal-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-border"
          >
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-red-500" />
                <h3 id="safety-report-modal-title" className="font-bold text-base text-slate-900">Report an Issue or User</h3>
              </div>
              <button
                type="button"
                onClick={() => setReportModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Report</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-orange"
                >
                  <option value="spam_or_scam">Scam / Advance Deposit Demand</option>
                  <option value="harassment">Harassment or Inappropriate Behavior</option>
                  <option value="fake_profile">Fake Profile or False Information</option>
                  <option value="inappropriate_behavior">Discrimination or Rule Violation</option>
                  <option value="other">Other Safety Concern</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Incident Details</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Describe what occurred, including user names, property localities, or messages..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-brand-orange resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="flex-[2] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="bg-white border-b border-slate-100 py-4 px-4 sticky top-0 z-30 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                navigate(-1);
              } else {
                navigate('/explore?tab=rooms');
              }
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-500" />
            <h1 className="text-sm font-bold text-slate-900">Safety Center</h1>
          </div>
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
          >
            Report Problem
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* Emergency Band */}
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-5 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-red-950 mb-1">
                Emergency Information & Helplines
              </h2>
              <p className="text-xs text-red-900 leading-relaxed mb-3">
                NestMate is a roommate marketplace and <strong>is not an emergency service</strong>. If you are in immediate physical danger, please contact local law enforcement right away.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <a
                  href="tel:112"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call 112 (National Emergency)</span>
                </a>
                <a
                  href="https://cybercrime.gov.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-red-300 text-red-800 font-bold hover:bg-red-100 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>National Cybercrime Portal</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 1. In-App Protections & Meet-Safe Checklist */}
        <div className="card-nestmate p-6">
          <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-orange" />
            Meet-Safe Guidelines for Room Visits
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Follow these precautions before inspecting flats or meeting prospective roommates.
          </p>

          <div className="space-y-3">
            {[
              'First meeting in daylight: Arrange the initial property visit during daytime hours.',
              'Share live location: Send your real-time GPS location to a friend before entering the building.',
              'Inspect before paying: Never transfer token or advance deposits before a physical inspection.',
              'Keep communication on NestMate: Avoid shifting to external platforms before mutual introduction.',
              'Never share OTP or banking details: NestMate moderators will never ask for your passwords or OTP.',
            ].map((text, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                <div className="w-4 h-4 rounded-full bg-teal/10 text-teal flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3" />
                </div>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Moderation SLAs & Reporting */}
        <div className="card-nestmate p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />
              Structured Reporting & Protection
            </h2>
            <button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="text-xs font-bold text-brand-orange hover:underline cursor-pointer"
            >
              Open Form
            </button>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            When you report a user or listing for harassment, scam attempts, or fake listings, our moderation team acts according to strict turnaround standards:
          </p>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3.5 rounded-2xl bg-red-50/50 border border-red-200">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">Safety & Abuse</span>
              <p className="text-lg font-bold text-slate-900">&lt; 12 Hours</p>
              <p className="text-[11px] text-slate-500">Immediate freeze on reported profiles.</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">General Reports</span>
              <p className="text-lg font-bold text-slate-900">&lt; 48 Hours</p>
              <p className="text-[11px] text-slate-500">Every report receives an audit update.</p>
            </div>
          </div>
        </div>

        {/* 3. Blocked Accounts Management */}
        <div className="card-nestmate p-6">
          <div className="flex items-center gap-2 mb-1">
            <UserX className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Blocked Accounts</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4">
            Blocking is mutual and bidirectional: blocked users cannot find you in discovery, view your listings, or send messages.
          </p>

          {loadingBlocked ? (
            <p className="text-xs text-slate-400 py-3 text-center">Loading blocked accounts...</p>
          ) : blockedUsers.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              No blocked accounts. You can block users directly from their profile or chat.
            </div>
          ) : (
            <div className="space-y-2">
              {blockedUsers.map((bu) => (
                <div key={bu.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{bu.name || 'User'}</span>
                    <span className="text-[10px] text-slate-400 font-mono">ID: {bu.id.slice(0, 8)}•••</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnblock(bu.id, bu.name)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 px-3 py-1 rounded-lg cursor-pointer"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="p-6 bg-slate-900 text-white rounded-3xl text-center">
          <h3 className="text-base font-bold mb-1">Encountered an issue or suspicious behavior?</h3>
          <p className="text-xs text-white/70 max-w-sm mx-auto mb-4">
            Submit a structured report and our trust &amp; safety operations team will review it immediately.
          </p>
          <button
            type="button"
            onClick={() => setReportModalOpen(true)}
            className="btn-fire py-3 px-6 rounded-2xl font-bold text-xs shadow-md cursor-pointer"
          >
            Report a Problem to Moderation
          </button>
        </div>

      </div>
    </div>
  );
}
