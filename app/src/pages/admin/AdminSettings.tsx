import { useState, useEffect } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Loader2, Trash2, Plus, Users,
  AlertTriangle, CheckCircle2, ShieldCheck, Mail, Database, AlertOctagon, Flame
} from 'lucide-react';

interface AdminRow {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminSettings() {
  const {
    getAdmins, addAdmin, removeAdmin, getAdminConfig, updateAdminEmails,
    cleanDemoAndSeedData, wipeEntireDatabase
  } = useAdmin();
  const { user, profile } = useAuth();

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Database maintenance state (Safe purge)
  const [showCleanModal, setShowCleanModal] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanLogs, setCleanLogs] = useState<string[]>([]);
  const [cleanResult, setCleanResult] = useState<number | null>(null);

  // Factory Reset / Nuclear wipe state (Deletes all accounts & database)
  const [showNuclearModal, setShowNuclearModal] = useState(false);
  const [nuclearConfirmText, setNuclearConfirmText] = useState('');
  const [deleteCurrentAuth, setDeleteCurrentAuth] = useState(true);
  const [wipingAll, setWipingAll] = useState(false);
  const [nuclearLogs, setNuclearLogs] = useState<string[]>([]);
  const [nuclearResult, setNuclearResult] = useState<number | null>(null);

  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'moderator'>('moderator');
  const [adding, setAdding] = useState(false);

  // Whitelist state
  const [emailList, setEmailList] = useState('');
  const [savingEmails, setSavingEmails] = useState(false);

  // Delete modal
  const [adminToDelete, setAdminToDelete] = useState<AdminRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentUserEmail = (user?.email || profile?.email || '').toLowerCase().trim();

  useEffect(() => {
    document.title = 'Security & Admin Access | NestMate Admin';
    const load = async () => {
      try {
        const [adminList, config] = await Promise.all([getAdmins(), getAdminConfig()]);
        setAdmins(adminList as AdminRow[]);
        setEmailList((config.adminEmails || []).join('\n'));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [getAdmins, getAdminConfig]);

  // Modal Escape key listener and body scroll lock
  useEffect(() => {
    const isAnyModalOpen = showCleanModal || showNuclearModal || !!adminToDelete;
    if (!isAnyModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showCleanModal && !cleaning) {
          setShowCleanModal(false);
        } else if (showNuclearModal && !wipingAll) {
          setShowNuclearModal(false);
        } else if (adminToDelete && !deleting) {
          setAdminToDelete(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCleanModal, showNuclearModal, adminToDelete, cleaning, wipingAll, deleting]);

  const handleAddAdmin = async () => {
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error('Email address is required');
      return;
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setAdding(true);
    try {
      await addAdmin(cleanEmail, newName.trim() || cleanEmail, newRole);
      const updated = await getAdmins();
      setAdmins(updated as AdminRow[]);
      setNewEmail('');
      setNewName('');
      setNewRole('moderator');
      toast.success(`Added ${cleanEmail} as ${newRole}`);
    } catch {
      toast.error('Failed to add admin');
    } finally {
      setAdding(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!adminToDelete) return;

    setDeleting(true);
    try {
      await removeAdmin(adminToDelete.id);
      setAdmins(prev => prev.filter(a => a.id !== adminToDelete.id));
      toast.success(`Removed ${adminToDelete.email || adminToDelete.name} from admins`);
      setAdminToDelete(null);
    } catch {
      toast.error('Failed to remove admin');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEmails = async () => {
    setSavingEmails(true);
    try {
      const rawLines = emailList.split('\n');
      const validEmails: string[] = [];
      const invalidEmails: string[] = [];

      for (const line of rawLines) {
        const trimmed = line.trim().toLowerCase();
        if (!trimmed) continue;
        if (EMAIL_REGEX.test(trimmed)) {
          if (!validEmails.includes(trimmed)) validEmails.push(trimmed);
        } else {
          invalidEmails.push(trimmed);
        }
      }

      if (invalidEmails.length > 0) {
        toast.warning(`Ignored invalid email format(s): ${invalidEmails.slice(0, 3).join(', ')}`);
      }

      await updateAdminEmails(validEmails);
      setEmailList(validEmails.join('\n'));
      toast.success(`Successfully saved ${validEmails.length} whitelisted admin emails`);
    } catch {
      toast.error('Failed to save whitelist');
    } finally {
      setSavingEmails(false);
    }
  };

  const handleExecuteCleanup = async () => {
    setCleaning(true);
    setCleanLogs([]);
    setCleanResult(null);

    try {
      const deletedCount = await cleanDemoAndSeedData((msg) => {
        setCleanLogs(prev => [...prev, msg]);
      });
      setCleanResult(deletedCount);
      toast.success(`Successfully purged ${deletedCount} demo & seed records.`);
    } catch (err) {
      toast.error('Failed to complete cleanup. Check logs.');
      setCleanLogs(prev => [...prev, `❌ Error: ${err instanceof Error ? err.message : 'Unknown failure'}`]);
    } finally {
      setCleaning(false);
    }
  };

  const handleExecuteNuclearWipe = async () => {
    if (nuclearConfirmText.trim() !== 'DELETE ALL DATA') {
      toast.error('Please type "DELETE ALL DATA" to confirm complete wipe');
      return;
    }

    setWipingAll(true);
    setNuclearLogs([]);
    setNuclearResult(null);

    try {
      const deletedCount = await wipeEntireDatabase(
        { deleteCurrentAuthAccount: deleteCurrentAuth },
        (msg) => {
          setNuclearLogs(prev => [...prev, msg]);
        }
      );
      setNuclearResult(deletedCount);
      toast.success(`Factory reset complete! Removed ${deletedCount} documents.`);
      // Reload admins and email list
      const [adminList, config] = await Promise.all([getAdmins(), getAdminConfig()]);
      setAdmins(adminList as AdminRow[]);
      setEmailList((config.adminEmails || []).join('\n'));
    } catch (err) {
      toast.error('Failed to complete wipe. Check logs.');
      setNuclearLogs(prev => [...prev, `❌ Error: ${err instanceof Error ? err.message : 'Unknown failure'}`]);
    } finally {
      setWipingAll(false);
    }
  };

  const isSelf = (a: AdminRow) => {
    const aEmail = (a.email || '').toLowerCase().trim();
    return aEmail !== '' && aEmail === currentUserEmail;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 text-fire animate-spin" />
        <p className="text-sm text-gray-500">Loading admin security settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Security & Admin Access</h1>
        <p className="text-sm text-gray-500">
          Manage administrator roles, granted permissions, and platform-wide email whitelists.
        </p>
      </div>

      {/* Admin Accounts List Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-fire/10 flex items-center justify-center text-fire">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Configured Administrators</h2>
              <p className="text-xs text-gray-400">Users with direct platform moderation authority</p>
            </div>
          </div>
          <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
            {admins.length} active
          </span>
        </div>

        {/* Current Admins List */}
        {admins.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-sm text-gray-400">No custom admins configured in the database.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {admins.map(a => {
              const self = isSelf(a);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-gray-50/80 hover:bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm shrink-0">
                      {(a.name || a.email || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">{a.name || a.email}</p>
                        {self && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.2 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>{a.email}</span>
                        <span>•</span>
                        <span className={`capitalize font-semibold text-[11px] ${
                          a.role === 'admin' ? 'text-fire' : 'text-blue-600'
                        }`}>
                          {a.role || 'moderator'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAdminToDelete(a)}
                    disabled={self}
                    className="p-2 text-gray-400 hover:text-red-600 disabled:opacity-20 disabled:cursor-not-allowed hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title={self ? "Self-deletion disabled to prevent lockout" : "Revoke admin access"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Admin Form */}
        <div className="border-t border-gray-100 pt-5 space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Grant Admin Privilege</p>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-5 relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="admin@nestmate.com"
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-fire/20 focus:border-fire transition-all"
              />
            </div>
            <div className="sm:col-span-4">
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Full Name (optional)"
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-fire/20 focus:border-fire transition-all"
              />
            </div>
            <div className="sm:col-span-3">
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'admin' | 'moderator')}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-fire/20 focus:border-fire text-gray-700"
              >
                <option value="moderator">Moderator</option>
                <option value="admin">Full Admin</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleAddAdmin}
              disabled={adding || !newEmail.trim()}
              className="px-5 py-2.5 bg-fire hover:bg-fire-dark text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm cursor-pointer"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Administrator
            </button>
          </div>
        </div>
      </div>

      {/* Global Email Whitelist Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Email Whitelist (System Override)</h2>
            <p className="text-xs text-gray-400">
              Users logging in with any of these email addresses automatically bypass access gates.
            </p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 space-y-1 border border-slate-200">
          <p className="font-semibold text-slate-800">Whitelist Rules:</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-500">
            <li>Enter one email address per line.</li>
            <li>Case insensitive; trailing spaces are automatically trimmed.</li>
            <li>Changes take effect immediately across all active sessions.</li>
          </ul>
        </div>

        <textarea
          value={emailList}
          onChange={e => setEmailList(e.target.value)}
          rows={5}
          placeholder="moderator@example.test&#10;admin@example.test"
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-fire/20 focus:border-fire font-mono resize-none transition-all"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveEmails}
            disabled={savingEmails}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm cursor-pointer"
          >
            {savingEmails ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving Whitelist...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Save Whitelist
              </>
            )}
          </button>
        </div>
      </div>

      {/* Database Clean Up & Maintenance Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Database Clean Up (Demo & Seed Data)</h2>
              <p className="text-xs text-gray-400">
                Purge sample data, demo accounts, and mock listings to maintain a clean production environment.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200 text-xs text-amber-900 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Safe Purge Policy
          </p>
          <p className="text-amber-800 leading-relaxed">
            This operation scans and deletes all demo users (<code>demo.*</code>, <code>isDemo: true</code>), seed accounts (<code>seed_user_*</code>, <code>@nestmate-seed.com</code>), and their sample listings.
          </p>
          <p className="text-amber-900 font-semibold">
            🛡️ Your real administrator account (<strong>{currentUserEmail || user?.email || 'system admin'}</strong>) is strictly protected and will NOT be touched.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => {
              setShowCleanModal(true);
              setCleanLogs([]);
              setCleanResult(null);
            }}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Purge Demo & Seed Data
          </button>
        </div>
      </div>

      {/* Danger Zone: Complete Factory Reset (Nuclear Wipe) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-red-200 space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-300 flex items-center justify-center text-red-600">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">Danger Zone: Nuclear Factory Reset</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">
                  Destructive
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Permanently erase ALL accounts, property listings, chats, connections, and database collections.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 rounded-xl p-3.5 border border-red-200 text-xs text-red-900 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5 text-red-700">
            <Flame className="w-4 h-4 text-red-600" />
            Complete Platform Eradication
          </p>
          <p className="text-red-800 leading-relaxed">
            This will empty every single Firestore collection (<code>users</code>, <code>listings</code>, <code>chatRooms</code>, <code>messages</code>, <code>notifications</code>, <code>verifications</code>, <code>connections</code>, <code>reports</code>, <code>reviews</code>) down to <strong>0 records</strong>, clear all local browser data, and delete your Firebase Authentication user.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => {
              setShowNuclearModal(true);
              setNuclearConfirmText('');
              setNuclearLogs([]);
              setNuclearResult(null);
            }}
            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Flame className="w-4 h-4" />
            Delete All Accounts & Database
          </button>
        </div>
      </div>

      {/* Clean Up Modal */}
      {showCleanModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          onClick={() => { if (!cleaning) setShowCleanModal(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clean-up-title"
            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scale-up max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <Database className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 id="clean-up-title" className="font-bold text-gray-900 text-lg">Clean Up Demo & Seed Data</h3>
                <p className="text-xs text-gray-500">Safely wipe test accounts and mock listings</p>
              </div>
            </div>

            <div className="text-xs text-gray-600 space-y-2 shrink-0">
              <p>The following will be permanently removed:</p>
              <ul className="list-disc list-inside text-gray-500 space-y-0.5 bg-gray-50 p-2.5 rounded-lg">
                <li>Demo user profiles & phone test accounts</li>
                <li>Seed accounts created via sample generators</li>
                <li>Sample room listings & associated mock reviews</li>
                <li>Test chatrooms, messages, and demo notifications</li>
              </ul>
              <p className="text-emerald-700 font-semibold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                ✓ Administrator account (<strong>{currentUserEmail || user?.email || 'system admin'}</strong>) is preserved.
              </p>
            </div>

            {/* Live Progress Logs */}
            {cleanLogs.length > 0 && (
              <div className="bg-slate-950 text-slate-200 font-mono text-[11px] p-3.5 rounded-xl max-h-48 overflow-y-auto space-y-1 shrink-0 border border-slate-800">
                {cleanLogs.map((l, i) => (
                  <p key={i} className="leading-tight">{l}</p>
                ))}
              </div>
            )}

            {cleanResult !== null && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Done! Removed {cleanResult} records from the database.
              </div>
            )}

            <div className="flex gap-3 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCleanModal(false)}
                disabled={cleaning}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                {cleanResult !== null ? 'Close' : 'Cancel'}
              </button>
              {cleanResult === null && (
                <button
                  type="button"
                  onClick={handleExecuteCleanup}
                  disabled={cleaning}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {cleaning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Purging Database...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" /> Start Safe Clean Up
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nuclear Wipe Modal */}
      {showNuclearModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
          onClick={() => { if (!wipingAll) setShowNuclearModal(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nuclear-wipe-title"
            className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-scale-up max-h-[90vh] flex flex-col border border-red-500/20"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertOctagon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 id="nuclear-wipe-title" className="font-bold text-gray-900 text-lg">Nuclear Factory Reset (Delete Everything)</h3>
                <p className="text-xs text-red-500 font-semibold">IRREVERSIBLE: Completely empties database & accounts</p>
              </div>
            </div>

            <div className="text-xs text-gray-600 space-y-2 shrink-0 bg-red-50/70 p-3.5 rounded-xl border border-red-200">
              <p className="font-bold text-red-900">The following will be completely destroyed:</p>
              <ul className="list-disc list-inside text-red-800 space-y-1">
                <li><strong>All user profiles & private contact records</strong> (Seekers, Owners, Admins)</li>
                <li><strong>All property listings</strong> & uploaded asset metadata</li>
                <li><strong>All chat rooms, conversation threads & chat messages</strong></li>
                <li><strong>All connections, roommate matches, reviews & reports</strong></li>
                <li><strong>All notifications, verification documents & audit logs</strong></li>
              </ul>
            </div>

            <div className="space-y-3 shrink-0">
              <label className="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer select-none bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                <input
                  type="checkbox"
                  checked={deleteCurrentAuth}
                  onChange={e => setDeleteCurrentAuth(e.target.checked)}
                  disabled={wipingAll}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                />
                <span>Also delete my active account from Firebase Auth (<strong>{currentUserEmail || 'current user'}</strong>)</span>
              </label>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Type <span className="text-red-600 font-mono bg-red-50 px-1.5 py-0.5 rounded border border-red-200">DELETE ALL DATA</span> to confirm:
                </label>
                <input
                  type="text"
                  value={nuclearConfirmText}
                  onChange={e => setNuclearConfirmText(e.target.value)}
                  placeholder="DELETE ALL DATA"
                  disabled={wipingAll}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
            </div>

            {/* Live Progress Logs */}
            {nuclearLogs.length > 0 && (
              <div className="bg-slate-950 text-slate-200 font-mono text-[11px] p-3.5 rounded-xl max-h-48 overflow-y-auto space-y-1 shrink-0 border border-slate-800">
                {nuclearLogs.map((l, i) => (
                  <p key={i} className="leading-tight">{l}</p>
                ))}
              </div>
            )}

            {nuclearResult !== null && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-2 shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Done! Completely cleared {nuclearResult} document(s) from database.
              </div>
            )}

            <div className="flex gap-3 pt-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowNuclearModal(false)}
                disabled={wipingAll}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                {nuclearResult !== null ? 'Close' : 'Cancel'}
              </button>
              {nuclearResult === null && (
                <button
                  type="button"
                  onClick={handleExecuteNuclearWipe}
                  disabled={wipingAll || nuclearConfirmText.trim() !== 'DELETE ALL DATA'}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                >
                  {wipingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Wiping Everything...
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4" /> Permanently Delete All
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Revocation Confirmation Modal */}
      {adminToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setAdminToDelete(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-admin-title"
            className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 id="revoke-admin-title" className="font-bold text-gray-900 text-lg">Revoke Admin Access</h3>
                <p className="text-xs text-gray-500">This action takes effect immediately.</p>
              </div>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Are you sure you want to revoke admin privileges from{' '}
              <strong>{adminToDelete.name || adminToDelete.email}</strong> ({adminToDelete.email})?
              They will no longer be able to access the admin panel or moderate platform content.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdminToDelete(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Revoke Access
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
