import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useStorage } from '@/hooks/useStorage';
import {
  Bell, Lock, Eye, Moon, Camera, Loader2, AlertTriangle, Download, Trash2, ShieldCheck, X,
} from 'lucide-react';
import {
  collection, query, where, getDocs, doc, getDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { toast } from 'sonner';
import PageShell from '@/components/PageShell';

interface SettingsState {
  profilePublic: boolean;
  showLastSeen: boolean;
  discoverable: boolean;
  darkMode: boolean;
  pushMatches: boolean;
  pushMessages: boolean;
  pushRequests: boolean;
  emailUpdates: boolean;
  language: string;
}

const defaultSettings: SettingsState = {
  profilePublic: true,
  showLastSeen: true,
  discoverable: true,
  darkMode: false,
  pushMatches: true,
  pushMessages: true,
  pushRequests: true,
  emailUpdates: false,
  language: 'en',
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, logout, refreshProfile } = useAuth();
  const { updateProfile } = useUserProfile();
  const { uploadProfilePicture } = useStorage();

  const [activeTab, setActiveTab] = useState<'account' | 'privacy' | 'notifications' | 'appearance'>('account');
  const [toggles, setToggles] = useState<SettingsState>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarImgError, setAvatarImgError] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Download data state
  const [downloading, setDownloading] = useState(false);

  // Dynamic SEO title
  useEffect(() => {
    document.title = 'Settings | NestMate';
  }, []);

  // Sync profile settings and dark mode class
  useEffect(() => {
    if (profile?.settings) {
      setToggles(prev => {
        const next = { ...prev, ...profile.settings };
        if (next.darkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return next;
      });
    }
  }, [profile?.settings]);

  // Modal accessibility: body scroll lock and escape listener
  useEffect(() => {
    const hasOpenModal = showDeleteModal;
    if (!hasOpenModal) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!deleting) setShowDeleteModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDeleteModal, deleting]);

  const toggle = async (key: keyof SettingsState) => {
    const updated = { ...toggles, [key]: !toggles[key] };
    setToggles(updated);
    if (key === 'darkMode') {
      if (updated.darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
    if (user?.uid) {
      setSaving(true);
      try {
        await updateProfile(user.uid, { settings: updated } as any);
      } catch (err) {
        console.error('Failed to save settings:', err);
        toast.error('Failed to update setting. Please try again.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0] && user?.uid) {
      setAvatarUploading(true);
      try {
        const url = await uploadProfilePicture(e.target.files[0], user.uid);
        await updateProfile(user.uid, { avatar: url } as any);
        await refreshProfile(user.uid);
        setAvatarImgError(false);
        toast.success('Profile picture updated');
      } catch (err) {
        console.error('Failed to upload avatar:', err);
        toast.error('Failed to upload profile picture');
      } finally {
        setAvatarUploading(false);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // ─── SWITCH ROLE ──────────────────────────────────────────────
  // ─── DELETE ACCOUNT ──────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (!user?.uid || deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      const deleteAccount = httpsCallable<{ confirmation: string }, { deleted: boolean }>(
        functions,
        'requestAccountDeletion'
      );
      await deleteAccount({ confirmation: deleteConfirmText });

      toast.success('Your account has been deleted.');
      navigate('/');
    } catch (err: any) {
      console.error('Delete account failed:', err);
      if (err.code === 'functions/failed-precondition') {
        toast.error('For security, please log out and log back in before deleting your account.');
      } else {
        toast.error('Failed to delete account. Please try again.');
      }
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // ─── DOWNLOAD MY DATA ────────────────────────────────────────
  const handleDownloadData = async () => {
    if (!user?.uid) return;
    setDownloading(true);
    try {
      const uid = user.uid;
      const data: Record<string, any> = {};

      const profileSnap = await getDoc(doc(db, 'users', uid));
      data.profile = profileSnap.exists() ? profileSnap.data() : null;
      try {
        const privateSnap = await getDoc(doc(db, 'privateUserData', uid));
        data.privateContact = privateSnap.exists() ? privateSnap.data() : null;
      } catch {
        data.privateContact = null;
      }

      const listingsSnap = await getDocs(query(collection(db, 'listings'), where('ownerId', '==', uid)));
      data.listings = listingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const [c1, c2] = await Promise.all([
        getDocs(query(collection(db, 'connections'), where('fromUserId', '==', uid))),
        getDocs(query(collection(db, 'connections'), where('toUserId', '==', uid))),
      ]);
      data.connections = [...c1.docs, ...c2.docs].map(d => ({ id: d.id, ...d.data() }));

      const notifsSnap = await getDocs(query(collection(db, 'notifications'), where('userId', '==', uid)));
      data.notifications = notifsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nestmate-data-${uid.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Your data archive has been downloaded.');
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to export data archive. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const ToggleSwitch = ({ active, onClick, label }: { active: boolean; onClick: () => void; label?: string }) => (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label || (active ? 'On' : 'Off')}
      onClick={onClick}
      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${active ? 'bg-[#FF5A36]' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${active ? 'left-6' : 'left-1'}`} />
    </button>
  );

  return (
    <PageShell
      maxWidth="max-w-3xl"
      title="Account Settings"
      subtitle="Manage your profile identity, privacy preferences, and notification channels."
      actions={
        <div className="flex items-center gap-3">
          {saving && <span className="text-xs text-[#FF5A36] font-semibold animate-pulse">Saving...</span>}
          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-full border border-gray-200 shadow-2xs">
            <Moon className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-xs font-semibold text-gray-700">Dark Mode</span>
            <ToggleSwitch active={toggles.darkMode} onClick={() => toggle('darkMode')} label="Dark Mode" />
          </div>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex gap-1.5 bg-gray-100/90 rounded-full p-1.5 mb-6 overflow-x-auto scrollbar-hide border border-gray-200/60 shadow-2xs">
        {([
          { key: 'account', label: 'Account', icon: Lock },
          { key: 'privacy', label: 'Privacy', icon: Eye },
          { key: 'notifications', label: 'Notifications', icon: Bell },
          { key: 'appearance', label: 'Appearance', icon: Moon },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all flex-1 justify-center ${
              activeTab === tab.key
                ? 'bg-white shadow-xs text-[#FF5A36]'
                : 'text-gray-600 hover:text-[#1E2229]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs space-y-6">
            <h3 className="font-serif font-medium text-xl text-[#1E2229]">Account Information</h3>

            <div className="flex flex-col items-center justify-center py-2">
              <div className="relative group">
                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-serif font-bold text-[#FF5A36] overflow-hidden border-4 border-white shadow-sm">
                  {(profile?.avatar || user?.photoURL) && !avatarImgError ? (
                    <img
                      src={profile?.avatar || user?.photoURL || ''}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      onError={() => setAvatarImgError(true)}
                    />
                  ) : (
                    (profile?.name || user?.displayName ? (profile?.name || user?.displayName)![0].toUpperCase() : '?')
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#FF5A36] text-white rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-[#E54E2B] transition-colors">
                  {avatarUploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} disabled={avatarUploading} />
                </label>
                {profile?.isVerified && (
                  <div className="absolute -top-1 -right-1 bg-emerald-600 text-white p-1 rounded-full border-2 border-white shadow-sm" title="Verified Member">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <p className="font-serif font-medium text-lg text-[#1E2229]">{profile?.name || user?.displayName || 'NestMate User'}</p>
                {profile?.isVerified && <ShieldCheck className="w-4 h-4 text-emerald-600" />}
              </div>
              <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-[#FFF2EB] text-[#FF5A36] border-[#FF5A36]/20">
                NestMate member
              </span>
            </div>

            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-[#1E2229] uppercase tracking-wider block mb-2">Registered Phone</label>
                <input type="text" value={profile?.phone ? '+91 ' + profile.phone.slice(-10) : user?.phoneNumber || 'Not registered'} disabled className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-500 font-medium" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1E2229] uppercase tracking-wider block mb-2">Email Address</label>
                <input type="email" value={profile?.email || user?.email || 'Not specified'} disabled className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-500 font-medium" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1E2229] uppercase tracking-wider block mb-2">Full Display Name</label>
                <input type="text" value={profile?.name || ''} disabled className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-500 font-medium" />
                <p className="text-xs text-gray-400 mt-1.5">Edit your bio and lifestyle answers anytime on your <button onClick={() => navigate('/edit-profile')} className="text-[#FF5A36] font-semibold underline">Profile Page</button>.</p>
              </div>
            </div>
          </div>

          {/* Activity access: one account supports every marketplace action. */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-serif font-medium text-base text-[#1E2229]">Your NestMate activities</h3>
                <p className="text-xs text-gray-500 mt-0.5">Browse rooms, meet roommates, and post rooms with this same account.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate('/explore?tab=roommates')} className="px-4 py-2.5 border border-gray-200 text-[#1E2229] rounded-full text-xs font-semibold hover:border-[#FF5A36] hover:text-[#FF5A36] transition-all cursor-pointer">Browse Roommates</button>
                <button onClick={() => navigate('/edit-listing/new')} className="px-4 py-2.5 bg-[#FF5A36] text-white rounded-full text-xs font-semibold hover:bg-[#E54E2B] transition-all cursor-pointer">Post a Room</button>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div className={`rounded-3xl p-6 sm:p-7 border transition-all shadow-xs ${profile?.isVerified ? 'border-emerald-200 bg-emerald-50/50' : 'border-gray-100 bg-white'}`}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${profile?.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-[#FFF2EB] text-[#FF5A36]'}`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-medium text-base text-[#1E2229]">Trust & Identity Verification</h3>
                  <p className="text-xs text-gray-500">{profile?.isVerified ? 'Your official government ID is verified' : 'Get the official verified badge for your profile'}</p>
                </div>
              </div>
              {profile?.isVerified ? (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold uppercase tracking-wider">Verified</span>
              ) : (
                <button
                  onClick={() => {
                    navigate('/edit-profile');
                    toast.info('Please submit your ID document on the profile page.');
                  }}
                  className="px-5 py-2 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-semibold transition-all shadow-xs shadow-[#FF5A36]/20"
                >
                  Get Verified
                </button>
              )}
            </div>
            {!profile?.isVerified && (
              <p className="text-xs text-gray-500 leading-relaxed pt-1">
                Verified members gain priority in search results, receive authentic trust signals, and experience faster roommate connections.
              </p>
            )}
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full py-3.5 border border-gray-200 text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-50 hover:text-red-600 transition-all shadow-2xs"
          >
            Log Out of NestMate
          </button>

          {/* Download My Data */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xs space-y-3">
            <h3 className="font-serif font-medium text-lg text-[#1E2229]">Data Portability</h3>
            <p className="text-xs text-gray-500 leading-relaxed">Download a complete backup of your profile details, property listings, match history, and in-app threads as encrypted JSON.</p>
            <button
              onClick={handleDownloadData}
              disabled={downloading}
              className="w-full py-3 border border-gray-200 text-[#1E2229] rounded-full text-xs font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-gray-500" />}
              {downloading ? 'Preparing export...' : 'Export My Data Archive'}
            </button>
          </div>

          {/* Danger Zone */}
          <div className="bg-white rounded-3xl border border-red-200 p-6 sm:p-7 shadow-xs space-y-3">
            <h3 className="font-serif font-medium text-lg text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Danger Zone
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">Permanently delete your profile, unlist active properties, and erase all conversations. This action cannot be reversed.</p>
            <button
              onClick={() => { setDeleteConfirmText(''); setShowDeleteModal(true); }}
              className="w-full py-3 border border-red-200 text-red-600 rounded-full text-xs font-semibold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> Delete Account Permanently
            </button>
          </div>
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs space-y-5">
            <h3 className="font-serif font-medium text-xl text-[#1E2229]">Profile Visibility & Privacy</h3>
            <div className="space-y-4 divide-y divide-gray-100">
              {[
                { key: 'profilePublic' as const, label: 'Public Profile Visibility', desc: 'Allow other verified roommates and hosts to view your profile card' },
                { key: 'showLastSeen' as const, label: 'Show Online Status', desc: 'Display when you were last active to prospective roommates in chat' },
                { key: 'discoverable' as const, label: 'Search Engine Indexing', desc: 'Show your listing in public search queries and browse results' },
              ].map((item, idx) => (
                <div key={item.key} className={`flex items-center justify-between ${idx > 0 ? 'pt-4' : ''}`}>
                  <div>
                    <p className="text-sm font-semibold text-[#1E2229]">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <ToggleSwitch active={toggles[item.key]} onClick={() => toggle(item.key)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs space-y-5">
            <h3 className="font-serif font-medium text-xl text-[#1E2229]">Push & Alert Preferences</h3>
            <div className="space-y-4 divide-y divide-gray-100">
              {[
                { key: 'pushMatches' as const, label: 'High Compatibility Matches', desc: 'Notify me when a 85%+ lifestyle match publishes in my area' },
                { key: 'pushMessages' as const, label: 'Direct Messages', desc: 'Notify me instantly when prospective roommates message me' },
                { key: 'pushRequests' as const, label: 'Connection Invitations', desc: 'Notify me when a user sends or accepts a connect request' },
              ].map((item, idx) => (
                <div key={item.key} className={`flex items-center justify-between ${idx > 0 ? 'pt-4' : ''}`}>
                  <div>
                    <p className="text-sm font-semibold text-[#1E2229]">{item.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                  <ToggleSwitch active={toggles[item.key]} onClick={() => toggle(item.key)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-xs space-y-5">
            <h3 className="font-serif font-medium text-xl text-[#1E2229]">Interface Theme</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => !toggles.darkMode || toggle('darkMode')}
                className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-2.5 ${!toggles.darkMode ? 'border-[#FF5A36] bg-[#FFF2EB]/50' : 'border-gray-200'}`}
              >
                <div className="w-10 h-10 bg-[#FBFBFC] rounded-full border border-gray-200 shadow-2xs" />
                <p className="text-sm font-semibold text-[#1E2229]">Ivory Light</p>
              </button>
              <button
                onClick={() => toggles.darkMode || toggle('darkMode')}
                className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center justify-center gap-2.5 ${toggles.darkMode ? 'border-[#FF5A36] bg-[#FFF2EB]/50' : 'border-gray-200'}`}
              >
                <div className="w-10 h-10 bg-[#1E2229] rounded-full shadow-2xs" />
                <p className="text-sm font-semibold text-[#1E2229]">Obsidian Dark</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !deleting) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-xl border border-gray-100 space-y-4 relative">
            <button
              onClick={() => !deleting && setShowDeleteModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto text-red-600">
              <Trash2 className="w-7 h-7" />
            </div>
            <h2 className="font-serif font-medium text-2xl text-center text-[#1E2229]">Delete Account?</h2>
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              This permanently removes your identity, properties, shared chats and messages, reviews, reports, and uploaded files. Other participants will also lose shared conversation history. Type <strong className="text-red-600">DELETE</strong> to authorize.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-mono text-center text-red-600 font-bold tracking-widest focus:outline-none focus:border-red-400"
            />
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 border border-gray-200 rounded-full text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-xs shadow-red-600/20"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
