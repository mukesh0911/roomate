import { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import type { UserProfile } from '@/hooks/useAuth';
import { getDoc, doc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import {
  Search, Loader2, X, CheckCircle, Shield, Ban, AlertTriangle,
  Flag, ChevronLeft, ChevronRight, ExternalLink, ShieldAlert
} from 'lucide-react';
import type { Timestamp } from 'firebase/firestore';
import { Link } from 'react-router-dom';

const PAGE_SIZE = 20;

interface Report {
  id: string;
  reporterId: string;
  targetId: string;
  reason: string;
  description: string;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

const REASON_LABELS: Record<string, string> = {
  fake_profile: 'Fake Profile',
  harassment: 'Harassment',
  spam: 'Spam',
  inappropriate_content: 'Inappropriate Content',
  misleading_listing: 'Misleading Listing',
  other: 'Other Violation',
};

function formatDate(ts: Timestamp | string | Date | undefined): string {
  if (!ts) return '—';
  if ((ts as Timestamp).toDate) {
    return (ts as Timestamp).toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  if (typeof ts === 'string' || ts instanceof Date) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  return '—';
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'pending' ? 'bg-red-50 text-red-700 border border-red-200' :
    status === 'under_review' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
    'bg-emerald-50 text-emerald-700 border border-emerald-200';
  const label = status === 'under_review' ? 'Under Review' : status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export default function AdminReports() {
  const { getAllReports, updateReportStatus, suspendUser, banUser } = useAdmin();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Profile cache for reporter/reported names
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});

  // Detail panel
  const [selected, setSelected] = useState<Report | null>(null);

  // Confirm modal
  const [confirmAction, setConfirmAction] = useState<{ type: 'suspend' | 'ban'; userId: string; userName: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load reports
  const fetchReports = async () => {
    try {
      const r = await getAllReports();
      setReports(r as Report[]);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'User Reports | NestMate Admin';
  }, []);

  useEffect(() => {
    fetchReports();
  }, [getAllReports]);

  // Escape key & body scroll lock for selected drawer or confirmAction modal
  useEffect(() => {
    if (!selected && !confirmAction) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmAction) {
          setConfirmAction(null);
        } else if (selected) {
          setSelected(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [selected, confirmAction]);

  // Parallel fetch profiles for missing unique user IDs
  useEffect(() => {
    if (reports.length === 0) return;
    const ids = new Set<string>();
    reports.forEach(r => {
      if (r.reporterId) ids.add(r.reporterId);
      if (r.targetId) ids.add(r.targetId);
    });

    const missingIds = Array.from(ids).filter(uid => !profiles[uid]);
    if (missingIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        missingIds.map(async uid => {
          try {
            const snap = await getDoc(doc(db, 'users', uid));
            return { uid, data: snap.exists() ? (snap.data() as UserProfile) : null };
          } catch {
            return { uid, data: null };
          }
        })
      );

      if (!cancelled) {
        setProfiles(prev => {
          const next = { ...prev };
          results.forEach(r => {
            if (r.data) next[r.uid] = r.data;
          });
          return next;
        });
      }
    })();

    return () => { cancelled = true; };
  }, [reports]);

  // Filtered + searched
  const filtered = useMemo(() => {
    let result = reports;
    if (reasonFilter !== 'all') result = result.filter(r => r.reason === reasonFilter);
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter);
    if (search.trim()) {
      const s = search.toLowerCase().trim();
      result = result.filter(r => {
        const reporter = profiles[r.reporterId];
        const reported = profiles[r.targetId];
        return (
          reporter?.name?.toLowerCase().includes(s) ||
          reported?.name?.toLowerCase().includes(s) ||
          reporter?.email?.toLowerCase().includes(s) ||
          reported?.email?.toLowerCase().includes(s) ||
          r.description?.toLowerCase().includes(s)
        );
      });
    }
    return result;
  }, [reports, reasonFilter, statusFilter, search, profiles]);

  useEffect(() => {
    setPage(1);
  }, [search, reasonFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedReports = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Actions
  const handleMarkReviewed = async (id: string) => {
    try {
      await updateReportStatus(id, 'under_review');
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'under_review' as const } : r));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: 'under_review' } : null);
      toast.success('Marked as under review');
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await updateReportStatus(id, 'dismissed');
      setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' as const } : r));
      if (selected?.id === id) setSelected(null);
      toast.success('Report dismissed without penalties');
    } catch {
      toast.error('Failed to dismiss report');
    }
  };

  const handleWarn = async (report: Report) => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: report.targetId,
        type: 'system',
        title: 'Community Guidelines Warning',
        description: `Your account received a moderation flag for ${REASON_LABELS[report.reason] || report.reason}. Please maintain respectful communication and adhere to community policies.`,
        read: false,
        createdAt: serverTimestamp(),
      });
      toast.success('Official warning dispatched to user');
    } catch {
      toast.error('Failed to send warning');
    }
  };

  // Fixed auto-resolve on ban/suspend
  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'suspend') await suspendUser(confirmAction.userId);
      else await banUser(confirmAction.userId);

      await addDoc(collection(db, 'notifications'), {
        userId: confirmAction.userId,
        type: 'system',
        title: confirmAction.type === 'suspend' ? 'Account Suspended' : 'Account Banned',
        description: confirmAction.type === 'suspend'
          ? 'Your account has been suspended following community moderation review. Contact support for appeals.'
          : 'Your account has been permanently terminated due to policy violations.',
        read: false,
        createdAt: serverTimestamp(),
      });

      // Auto-resolve report upon taking action
      if (selected) {
        await updateReportStatus(selected.id, 'resolved');
        setReports(prev => prev.map(r => r.id === selected.id ? { ...r, status: 'resolved' as const } : r));
      }

      toast.success(`User ${confirmAction.type === 'suspend' ? 'suspended' : 'banned'} & report resolved`);
      setConfirmAction(null);
      setSelected(null);
    } catch {
      toast.error('Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getName = (uid: string) => profiles[uid]?.name || (uid ? uid.slice(0, 8) + '...' : 'Unknown');
  const getAvatar = (uid: string) => profiles[uid]?.avatar || '';
  const getEmail = (uid: string) => profiles[uid]?.email || '';

  // Repeat offender report count
  const offenderReportCount = useMemo(() => {
    if (!selected?.targetId) return 0;
    return reports.filter(r => r.targetId === selected.targetId).length;
  }, [reports, selected]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 text-fire animate-spin" />
        <p className="text-sm text-slate-400">Loading moderation reports...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">User Reports & Moderation</h2>
            <p className="text-xs text-slate-500">Review user-submitted incident reports, misconduct flags, and policy violations.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200/60 px-3 py-1.5 rounded-xl">
              {reports.filter(r => r.status === 'pending').length} Pending Reports
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reporter, reported user, or details..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-fire transition-colors"
            />
          </div>

          {/* Reason Filter */}
          <select
            value={reasonFilter}
            onChange={e => setReasonFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-fire">
            <option value="all">All Violation Types</option>
            {Object.entries(REASON_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-fire">
            <option value="all">All Statuses</option>
            <option value="pending">Pending (Urgent)</option>
            <option value="under_review">Under Review</option>
            <option value="resolved">Resolved / Closed</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Reported User</th>
                <th className="px-4 py-3.5 hidden sm:table-cell">Reporter</th>
                <th className="px-4 py-3.5">Reason</th>
                <th className="px-4 py-3.5 hidden md:table-cell">Filed Date</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    No reports match the selected filters.
                  </td>
                </tr>
              ) : (
                pagedReports.map(report => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => setSelected(report)}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                          {getAvatar(report.targetId) ? (
                            <img
                              src={getAvatar(report.targetId)}
                              className="w-full h-full object-cover"
                              alt=""
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            getName(report.targetId).charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-[130px]">{getName(report.targetId)}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{getEmail(report.targetId)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell text-slate-600">
                      <p className="font-medium truncate max-w-[130px]">{getName(report.reporterId)}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{getEmail(report.reporterId)}</p>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {REASON_LABELS[report.reason] || report.reason}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 hidden md:table-cell font-medium">
                      {formatDate(report.createdAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelected(report)}
                        className="text-xs text-fire font-semibold hover:text-orange-700 px-2 py-1">
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{(page - 1) * PAGE_SIZE + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{Math.min(page * PAGE_SIZE, filtered.length)}</span> of{' '}
              <span className="font-bold text-slate-800">{filtered.length}</span> reports
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 px-3">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Slide-out Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
          <div
            className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-500" /> Moderation Incident File
              </h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 flex-1">
              {/* Repeat offender alert */}
              {offenderReportCount > 1 && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-900">Repeat Flagged User</p>
                    <p className="text-[11px] text-red-700 mt-0.5">
                      {offenderReportCount} reports have been registered against this user account.
                    </p>
                  </div>
                </div>
              )}

              {/* Reported User Card */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reported User</p>
                  <Link
                    to={`/admin/users?search=${encodeURIComponent(getName(selected.targetId))}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-fire hover:underline">
                    <span>Inspect Account</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                <div className="flex items-center gap-3 bg-red-50/50 rounded-2xl p-3.5 border border-red-100">
                  <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-600 shrink-0 overflow-hidden">
                    {getAvatar(selected.targetId) ? (
                      <img
                        src={getAvatar(selected.targetId)}
                        className="w-full h-full object-cover"
                        alt=""
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      getName(selected.targetId).charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{getName(selected.targetId)}</p>
                    <p className="text-xs text-slate-500 truncate">{getEmail(selected.targetId) || 'No email'}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">UID: {selected.targetId}</p>
                  </div>
                </div>
              </div>

              {/* Reporter Card */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Reporting Party</p>
                <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 overflow-hidden">
                    {getAvatar(selected.reporterId) ? (
                      <img
                        src={getAvatar(selected.reporterId)}
                        className="w-full h-full object-cover"
                        alt=""
                        onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                      />
                    ) : (
                      getName(selected.reporterId).charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{getName(selected.reporterId)}</p>
                    <p className="text-xs text-slate-500 truncate">{getEmail(selected.reporterId) || 'No email'}</p>
                  </div>
                </div>
              </div>

              {/* Infraction Details */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Category</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">{REASON_LABELS[selected.reason] || selected.reason}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase font-bold">Current Status</p>
                  <div className="mt-1"><StatusBadge status={selected.status} /></div>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Submitted Description</p>
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {selected.description || 'No additional details provided by reporter.'}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Timestamp</p>
                <p className="text-xs font-semibold text-slate-700 mt-0.5">{formatDate(selected.createdAt)}</p>
              </div>

              {/* Moderation Actions */}
              <div className="space-y-2 pt-4 border-t border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Resolution Actions</p>

                {selected.status === 'pending' && (
                  <button
                    onClick={() => handleMarkReviewed(selected.id)}
                    className="w-full py-2.5 border border-slate-200 bg-white text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                    <Shield className="w-4 h-4" /> Move to Under Review
                  </button>
                )}

                <button
                  onClick={() => handleWarn(selected)}
                  className="w-full py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Dispatch Official Warning Notice
                </button>

                <button
                  onClick={() => setConfirmAction({ type: 'suspend', userId: selected.targetId, userName: getName(selected.targetId) })}
                  className="w-full py-2.5 bg-orange-50 border border-orange-200 text-fire rounded-xl text-xs font-bold hover:bg-orange-100 transition-all flex items-center justify-center gap-2">
                  <Shield className="w-4 h-4" /> Suspend Reported Account
                </button>

                <button
                  onClick={() => setConfirmAction({ type: 'ban', userId: selected.targetId, userName: getName(selected.targetId) })}
                  className="w-full py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                  <Ban className="w-4 h-4" /> Permanently Ban Reported User
                </button>

                {selected.status !== 'resolved' && (
                  <button
                    onClick={() => handleDismiss(selected.id)}
                    className="w-full py-2.5 text-slate-500 rounded-xl text-xs font-semibold hover:text-slate-800 hover:bg-slate-100 transition-all">
                    Dismiss without Penalties
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-report-action-title"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setConfirmAction(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <h3 id="confirm-report-action-title" className="text-base font-bold text-slate-900 mb-2">
              Confirm {confirmAction.type === 'suspend' ? 'Suspension' : 'Permanent Ban'}
            </h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {confirmAction.type === 'suspend'
                ? `Temporarily suspend ${confirmAction.userName}? This will automatically mark this report as resolved and pause user access.`
                : `Permanently ban ${confirmAction.userName}? This will resolve the report, de-list their properties, and bar login.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center ${
                  confirmAction.type === 'ban' ? 'bg-red-600 hover:bg-red-700' : 'bg-fire hover:bg-orange-600'
                }`}>
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
