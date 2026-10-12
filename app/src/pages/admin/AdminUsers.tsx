import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import type { UserProfile } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Search, Loader2, X, Shield, Ban, RefreshCw,
  ChevronLeft, ChevronRight, CheckCircle, ExternalLink,
  Award, ShieldAlert, Copy, ArrowUpDown
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const { getAllUsers, suspendUser, banUser, reinstateUser, updateUserVerification } = useAdmin();
  const [users, setUsers] = useState<(UserProfile & { status?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'verification'>('newest');
  const [selectedUser, setSelectedUser] = useState<(UserProfile & { status?: string }) | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Confirmation dialog state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: 'suspend' | 'ban' | 'reinstate';
    user: UserProfile & { status?: string };
  } | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const u = await getAllUsers();
      setUsers(u as (UserProfile & { status?: string })[]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [getAllUsers]);

  useEffect(() => {
    document.title = 'User Registry | NestMate Admin';
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Escape key & body scroll lock for selectedUser drawer or confirmModal
  useEffect(() => {
    if (!selectedUser && !confirmModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmModal) {
          setConfirmModal(null);
        } else if (selectedUser) {
          setSelectedUser(null);
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
  }, [selectedUser, confirmModal]);

  const filtered = useMemo(() => {
    let result = users;

    // Search filter
    if (search.trim()) {
      const s = search.toLowerCase().trim();
      result = result.filter(u =>
        u.name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        u.phone?.includes(s) ||
        u.uid.toLowerCase().includes(s)
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(u => (u.status || 'active') === statusFilter);
    }

    // Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'newest') {
        const ta = (a.createdAt as any)?.toMillis?.() || (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        const tb = (b.createdAt as any)?.toMillis?.() || (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        return tb - ta;
      }
      if (sortBy === 'oldest') {
        const ta = (a.createdAt as any)?.toMillis?.() || (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        const tb = (b.createdAt as any)?.toMillis?.() || (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        return ta - tb;
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'verification') {
        return (b.verificationLevel || 0) - (a.verificationLevel || 0);
      }
      return 0;
    });
  }, [users, search, roleFilter, statusFilter, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedUsers = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const executeAction = async () => {
    if (!confirmModal) return;
    const { action, user } = confirmModal;
    setActionLoading(true);
    try {
      if (action === 'suspend') await suspendUser(user.uid);
      else if (action === 'ban') await banUser(user.uid);
      else await reinstateUser(user.uid);

      const updatedStatus = action === 'reinstate' ? 'active' : action === 'suspend' ? 'suspended' : 'banned';
      toast.success(`User ${action}ed successfully`);
      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, status: updatedStatus } : u));
      if (selectedUser?.uid === user.uid) {
        setSelectedUser(prev => prev ? { ...prev, status: updatedStatus } : null);
      }
      setConfirmModal(null);
    } catch {
      toast.error(`Failed to ${action} user`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateVerification = async (level: number) => {
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      await updateUserVerification(selectedUser.uid, level, level > 0);
      setUsers(prev => prev.map(u => u.uid === selectedUser.uid ? { ...u, verificationLevel: level, isVerified: level > 0 } : u));
      setSelectedUser(prev => prev ? { ...prev, verificationLevel: level, isVerified: level > 0 } : null);
      toast.success(`Verification set to Level ${level}`);
    } catch {
      toast.error('Failed to update verification level');
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label}`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 text-fire animate-spin" />
        <p className="text-sm text-slate-400">Loading user registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">User Registry</h2>
            <p className="text-xs text-slate-500">Manage user profiles, trust verification tiers, and moderation status.</p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            {filtered.length} Total Users
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, phone, UID..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-fire transition-colors"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-fire">
            <option value="all">All Roles (Seeker & Owner)</option>
            <option value="seeker">Seekers Only</option>
            <option value="owner">Owners Only</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-fire">
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
            <option value="banned">Banned Only</option>
          </select>

          {/* Sort By */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-fire">
              <option value="newest">Sort: Newest Joined</option>
              <option value="oldest">Sort: Oldest Joined</option>
              <option value="name">Sort: Name (A-Z)</option>
              <option value="verification">Sort: Verification Tier</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">User</th>
                <th className="px-4 py-3.5 hidden sm:table-cell">Contact</th>
                <th className="px-4 py-3.5 hidden md:table-cell">City</th>
                <th className="px-4 py-3.5">Role</th>
                <th className="px-4 py-3.5 hidden lg:table-cell">Verification</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No users found matching your filters.
                  </td>
                </tr>
              ) : (
                pagedUsers.map(u => (
                  <tr
                    key={u.uid}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => setSelectedUser(u)}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0 overflow-hidden">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              className="w-full h-full object-cover"
                              alt=""
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            u.name?.charAt(0) || '?'
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-[140px]">{u.name || 'Anonymous User'}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate max-w-[140px]">{u.uid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 hidden sm:table-cell">
                      <p className="truncate max-w-[160px] font-medium text-slate-700">{u.email || '—'}</p>
                      <p className="text-[11px] text-slate-400">{u.phone || 'No phone'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell font-medium">{u.city || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        u.role === 'seeker' ? 'bg-blue-50 text-blue-700 border border-blue-200/60' :
                        u.role === 'owner' ? 'bg-teal-50 text-teal-700 border border-teal-200/60' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {u.role ? u.role.toUpperCase() : 'NONE'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        (u.verificationLevel || 0) >= 3 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        (u.verificationLevel || 0) >= 1 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        <Award className="w-3 h-3" /> Level {u.verificationLevel || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        u.status === 'banned' ? 'bg-red-50 text-red-700 border border-red-200' :
                        u.status === 'suspended' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {u.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedUser(u)}
                        className="text-xs text-fire font-semibold hover:text-orange-700 hover:underline px-2 py-1">
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
              <span className="font-bold text-slate-800">{filtered.length}</span> users
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

      {/* User Detail Slide-out Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelectedUser(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" />
          <div
            className="relative w-full max-w-md bg-white shadow-2xl h-full overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-fire" />
                <h3 className="font-bold text-slate-900 text-sm">User Details & Moderation</h3>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1">
              {/* Profile Card */}
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-600 shrink-0 overflow-hidden shadow-inner">
                  {selectedUser.avatar ? (
                    <img
                      src={selectedUser.avatar}
                      className="w-full h-full object-cover"
                      alt=""
                      onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                    />
                  ) : (
                    selectedUser.name?.charAt(0) || '?'
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-slate-900 truncate">{selectedUser.name || 'Anonymous'}</p>
                  <p className="text-xs text-slate-500 truncate">{selectedUser.email || 'No email'}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => copyToClipboard(selectedUser.uid, 'UID')}
                      className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      <Copy className="w-2.5 h-2.5" /> {selectedUser.uid.slice(0, 10)}...
                    </button>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedUser.status === 'banned' ? 'bg-red-100 text-red-700' :
                      selectedUser.status === 'suspended' ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedUser.status || 'active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Account Metadata</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    ['Role', (selectedUser.role || 'none').toUpperCase()],
                    ['City', selectedUser.city || '—'],
                    ['Phone', selectedUser.phone || '—'],
                    ['Gender', selectedUser.gender || '—'],
                    ['Profession', selectedUser.profession || '—'],
                    ['Company', selectedUser.company || '—'],
                    ['Age', selectedUser.age?.toString() || '—'],
                    ['Premium Status', selectedUser.isPremium ? 'Active' : 'Standard'],
                    ['Connects Used', `${selectedUser.connectsUsed || 0} / ${selectedUser.connectsLimit || 5}`],
                    ['Onboarded', selectedUser.onboardingComplete ? 'Yes' : 'No'],
                  ].map(([label, val]) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">{label}</p>
                      <p className="text-xs font-bold text-slate-800 mt-0.5 truncate">{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification Tier Editor */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-fire" /> Verification Tier
                  </p>
                  <span className="text-[11px] font-extrabold text-fire bg-orange-50 px-2 py-0.5 rounded-full">
                    Level {selectedUser.verificationLevel || 0}
                  </span>
                </div>
                <p className="text-xs text-slate-500">Admins can manually set trust levels or grant identity badges.</p>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[0, 1, 2, 3].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => handleUpdateVerification(lvl)}
                      disabled={actionLoading}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${
                        (selectedUser.verificationLevel || 0) === lvl
                          ? 'bg-fire text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}>
                      Level {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cross-Link Shortcuts */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Related Activity</p>
                {selectedUser.role === 'owner' && (
                  <Link
                    to={`/admin/listings?search=${encodeURIComponent(selectedUser.name || selectedUser.email || '')}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors">
                    <span>View Listings by this Owner</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </Link>
                )}
                <Link
                  to={`/admin/reports?search=${encodeURIComponent(selectedUser.name || selectedUser.email || '')}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 transition-colors">
                  <span>View Reports concerning this User</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </Link>
              </div>

              {/* Moderation Actions */}
              <div className="space-y-2 pt-4 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Moderation Controls</p>

                {(selectedUser.status !== 'suspended' && selectedUser.status !== 'banned') && (
                  <button
                    onClick={() => setConfirmModal({ open: true, action: 'suspend', user: selectedUser })}
                    className="w-full py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all flex items-center justify-center gap-2">
                    <ShieldAlert className="w-4 h-4" /> Suspend Account (Temporary)
                  </button>
                )}

                {selectedUser.status !== 'banned' && (
                  <button
                    onClick={() => setConfirmModal({ open: true, action: 'ban', user: selectedUser })}
                    className="w-full py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                    <Ban className="w-4 h-4" /> Permanently Ban User
                  </button>
                )}

                {(selectedUser.status === 'suspended' || selectedUser.status === 'banned') && (
                  <button
                    onClick={() => setConfirmModal({ open: true, action: 'reinstate', user: selectedUser })}
                    className="w-full py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Reinstate Account to Active
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {confirmModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setConfirmModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <h3 id="confirm-modal-title" className="text-base font-bold text-slate-900 mb-2 capitalize">
              Confirm {confirmModal.action} User
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-6">
              {confirmModal.action === 'ban'
                ? `Are you sure you want to permanently ban "${confirmModal.user.name || confirmModal.user.email}"? Their active listings will be paused and login blocked.`
                : confirmModal.action === 'suspend'
                ? `Are you sure you want to temporarily suspend "${confirmModal.user.name || confirmModal.user.email}"? They will receive a suspension notice upon login.`
                : `Are you sure you want to reinstate "${confirmModal.user.name || confirmModal.user.email}"? Their access will be fully restored.`}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={executeAction}
                disabled={actionLoading}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 ${
                  confirmModal.action === 'ban' ? 'bg-red-600 hover:bg-red-700' :
                  confirmModal.action === 'suspend' ? 'bg-amber-600 hover:bg-amber-700' :
                  'bg-emerald-600 hover:bg-emerald-700'
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
