import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStore } from '@/store/useStore';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useReviews } from '@/hooks/useReviews';
import { useMatches } from '@/hooks/useMatches';
import { useConnections, formatWhatsAppDeepLink } from '@/hooks/useConnections';
import { useChat } from '@/hooks/useChat';
import { useListings } from '@/hooks/useListings';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Crown, Shield, Star, Settings, Bell, Lock, HelpCircle, LogOut, SwitchCamera,
  ChevronRight, TrendingUp, MessageSquare, MessageCircle, CheckCircle2, Linkedin, Instagram,
  ShieldCheck, Users, Sliders, Building2, Sparkles, Brain, Share2
} from 'lucide-react';
import TrustBadge from '@/components/TrustBadge';
import ProfileCompleteness from '@/components/ProfileCompleteness';
import StateEmpty from '@/components/StateEmpty';
import PageShell from '@/components/PageShell';
import { toast } from 'sonner';

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, logout, refreshProfile } = useAuth();
  const { currentRole, setCurrentRole } = useStore();
  const { setRole } = useUserProfile();
  const { reviews, getReviewsForUser } = useReviews();
  const { findMatches } = useMatches();
  const { getMyConnections } = useConnections();
  const { chatRooms, getOrCreateChatRoom } = useChat();
  const { getMyListings } = useListings();

  const [topMatchScore, setTopMatchScore] = useState<number>(0);
  const [connectsCount, setConnectsCount] = useState<number>(0);
  const [ownerListings, setOwnerListings] = useState<any[]>([]);
  const [acceptedConnections, setAcceptedConnections] = useState<{ connection: any; profile: any }[]>([]);
  const trustVerificationRef = useRef<HTMLDivElement>(null);

  // Dynamic Document Title
  useEffect(() => {
    if (profile?.name) {
      document.title = `${profile.name} — Profile | NestMate`;
    } else {
      document.title = 'My Profile | NestMate';
    }
  }, [profile?.name]);

  // Handle openVerification from onboarding or navigation state
  useEffect(() => {
    if (location.state?.openVerification) {
      setTimeout(() => {
        trustVerificationRef.current?.scrollIntoView({ behavior: 'smooth' });
        toast.info('Complete verification to boost your trust score & response rate');
      }, 200);
    }
  }, [location.state]);

  // Derive the effective role from Firebase profile or Zustand store
  const effectiveRole = profile?.role || currentRole || 'seeker';

  useEffect(() => {
    if (user?.uid) {
      getReviewsForUser(user.uid);
      getMyConnections(user.uid).then(conns => {
        if (conns) setConnectsCount(conns.length);
      });
      getMyConnections(user.uid, 'accepted').then(async conns => {
        const list = [];
        for (const conn of conns) {
          const otherId = conn.fromUserId === user.uid ? conn.toUserId : conn.fromUserId;
          const [userSnap, contactSnap] = await Promise.all([
            getDoc(doc(db, 'users', otherId)),
            getDoc(doc(db, 'userContacts', otherId)).catch(() => null),
          ]);
          if (userSnap.exists()) {
            const contactData = contactSnap && contactSnap.exists() ? contactSnap.data() : {};
            list.push({
              connection: conn,
              profile: {
                uid: userSnap.id,
                ...userSnap.data(),
                whatsappNumber: contactData?.whatsappNumber || '',
              },
            });
          }
        }
        setAcceptedConnections(list);
      }).catch(() => { });
      if (profile && effectiveRole === 'seeker') {
        findMatches(profile, profile.city).then(matches => {
          if (matches && matches.length > 0) {
            const top = Math.max(...matches.map(m => m.compatibilityScore || 0));
            setTopMatchScore(top);
          }
        });
      }
      if (effectiveRole === 'owner') {
        getMyListings(user.uid).then(listings => {
          setOwnerListings(listings || []);
        }).catch(() => {});
      }
    }
  }, [user?.uid, profile, effectiveRole, findMatches, getMyConnections, getMyListings, getReviewsForUser]);

  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  // Dynamic activity milestones from genuine user data
  const activities = useMemo(() => {
    const list: { icon: any; iconBg: string; title: string; subtitle: string; time: string }[] = [];

    // 1. Connection activities
    acceptedConnections.forEach(conn => {
      const otherName = conn.profile?.name || 'a member';
      list.push({
        icon: Users,
        iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/70',
        title: `Connected with ${otherName}`,
        subtitle: 'Mutual roommate connection established · Chat unlocked',
        time: conn.connection?.createdAt?.toDate
          ? conn.connection.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : 'Recent',
      });
    });

    // 2. Identity Verification
    if (profile?.isVerified) {
      list.push({
        icon: ShieldCheck,
        iconBg: 'bg-blue-50 text-blue-600 border border-blue-200/70',
        title: 'Identity Verified via Government ID',
        subtitle: 'Earned Verified Pro standing & enhanced marketplace trust',
        time: 'Verified',
      });
    }

    // 3. Compatibility Quiz
    const quizCount = profile?.quizAnswers ? Object.keys(profile.quizAnswers).length : 0;
    if (quizCount > 0) {
      list.push({
        icon: Brain,
        iconBg: 'bg-purple-50 text-purple-600 border border-purple-200/70',
        title: 'Compatibility Quiz Completed',
        subtitle: `${quizCount} lifestyle preferences recorded for dynamic matching`,
        time: 'Active',
      });
    }

    // 4. Joined NestMate
    if (profile?.createdAt || user?.metadata?.creationTime) {
      const joinDate = profile?.createdAt?.toDate
        ? profile.createdAt.toDate()
        : user?.metadata?.creationTime
          ? new Date(user.metadata.creationTime)
          : null;
      list.push({
        icon: Sparkles,
        iconBg: 'bg-amber-50 text-amber-600 border border-amber-200/70',
        title: 'Joined the NestMate Community',
        subtitle: profile?.city ? `Profile registered in ${profile.city}` : 'Profile registered on NestMate',
        time: joinDate ? joinDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Active Member',
      });
    }

    return list;
  }, [acceptedConnections, profile, user]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSwitchRole = async () => {
    const newRole = effectiveRole === 'seeker' ? 'owner' : 'seeker';
    setCurrentRole(newRole);
    if (user?.uid) {
      await setRole(user.uid, newRole);
      // BUG-4 FIX: wait for profile to update before navigating so App.tsx
      // onSnapshot sees the new role and doesn't bounce back to the old dashboard.
      await refreshProfile(user.uid);
    }
    navigate(newRole === 'seeker' ? '/explore?tab=rooms' : '/owner-dashboard');
  };

  return (
    <PageShell maxWidth="max-w-6xl">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column (Desktop 35%) */}
        <div className="w-full lg:w-[360px] shrink-0 space-y-5">
          {/* Profile Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="h-28 bg-gradient-to-r from-[#FF5A36] via-[#F97316] to-[#FB923C] relative">
              <button
                onClick={() => navigate('/settings')}
                className="absolute top-3 right-3 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/30 transition-all cursor-pointer"
                aria-label="Open settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 pb-5">
              <div className="relative -mt-14 mb-3 flex flex-col items-center">
                <div className="relative">
                  <div className="w-28 h-28 rounded-full border-4 border-white p-0.5 bg-white shadow-md overflow-hidden shrink-0">
                    {profile?.avatar || user?.photoURL ? (
                      <img
                        src={profile?.avatar || user?.photoURL || undefined}
                        alt={profile?.name || user?.displayName || 'Profile photo'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-[#FFF2EB] flex items-center justify-center text-2xl font-bold text-[#FF5A36]">
                        {(profile?.name || user?.displayName || 'G').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {profile?.isPremium && (
                    <div className="absolute bottom-0 right-0 w-7 h-7 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                      <Crown className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 mt-3 mb-1">
                  <h2 className="font-serif font-medium text-xl text-[#1E2229] text-center">{profile?.name || user?.displayName || 'Guest User'}</h2>
                  <TrustBadge profile={profile} authProviders={user?.providerData?.map(p => p.providerId)} size="md" showLabel showTooltip />
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mb-3 font-medium text-center">{profile?.profession || 'Member'}{profile?.city ? ` · ${profile.city}` : ''}</p>
                <div className="flex gap-2 mb-1 flex-wrap items-center justify-center">
                  {profile?.workEmailVerified && (
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-blue-600" />Corporate Verified
                    </span>
                  )}
                  {profile?.isVerified && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-600" />Verified Member
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                {effectiveRole === 'owner' ? (
                  <>
                    <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-2.5 cursor-pointer hover:bg-[#FFF2EB]/40 transition-colors" onClick={() => navigate('/owner-dashboard?tab=listings')}>
                      <p className="text-lg font-bold text-[#1E2229]">{ownerListings.length}</p>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Properties</p>
                    </div>
                    <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-2.5 cursor-pointer hover:bg-[#FFF2EB]/40 transition-colors" onClick={() => navigate('/owner-dashboard?tab=applicants')}>
                      <p className="text-lg font-bold text-[#1E2229]">{connectsCount || 0}</p>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Applicants</p>
                    </div>
                    <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-2.5 cursor-pointer hover:bg-[#FFF2EB]/40 transition-colors" onClick={() => navigate('/chat')}>
                      <p className="text-lg font-bold text-[#1E2229]">{chatRooms?.length || 0}</p>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Chats</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-2.5">
                      <p className="text-lg font-bold text-[#1E2229]">{connectsCount || profile?.connectsUsed || 0}</p>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Connects</p>
                    </div>
                    <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-2.5 cursor-pointer hover:bg-[#FFF2EB]/40 transition-colors" onClick={() => navigate('/chat')}>
                      <p className="text-lg font-bold text-[#1E2229]">{chatRooms?.length || 0}</p>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Chats</p>
                    </div>
                    <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-2.5">
                      <p className="text-lg font-bold text-[#FF5A36]">{topMatchScore > 0 ? `${topMatchScore}%` : '—'}</p>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Top Match</p>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => navigate('/edit-profile')}
                className="w-full py-2.5 rounded-full border border-gray-200 text-xs sm:text-sm font-semibold text-[#1E2229] hover:bg-gray-50 transition-all cursor-pointer shadow-xs"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Preferences / Hosting Details */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-serif font-medium text-base text-[#1E2229]">
                {effectiveRole === 'owner' ? 'Hosting Details' : 'Preferences'}
              </h4>
              <button
                onClick={() => navigate(effectiveRole === 'owner' ? '/owner-dashboard?tab=listings' : '/preferences')}
                className="text-xs text-[#FF5A36] font-semibold hover:underline cursor-pointer"
              >
                {effectiveRole === 'owner' ? 'Manage' : 'Edit'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {effectiveRole === 'owner' ? (
                [
                  { label: 'Role', value: 'Property Owner' },
                  { label: 'City', value: profile?.city || 'Not specified' },
                  { label: 'Properties', value: `${ownerListings.length} Listed` },
                  { label: 'Status', value: profile?.isVerified ? 'Verified Owner' : 'Pending' },
                ].map(p => (
                  <div key={p.label} className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-2.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{p.label}</p>
                    <p className="text-xs sm:text-sm font-semibold text-[#1E2229] truncate mt-0.5">{p.value}</p>
                  </div>
                ))
              ) : (
                [
                  { label: 'Budget', value: profile?.budget ? `₹${profile.budget.toLocaleString()}/mo` : 'Flexible' },
                  { label: 'Role', value: 'Room Seeker' },
                  { label: 'City', value: profile?.city || 'Not specified' },
                  { label: 'Move-in', value: profile?.moveInDate ? new Date(profile.moveInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Flexible' },
                ].map(p => (
                  <div key={p.label} className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-2.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{p.label}</p>
                    <p className="text-xs sm:text-sm font-semibold text-[#1E2229] truncate mt-0.5">{p.value}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Trust, Socials & Contact Overview */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-serif font-medium text-base text-[#1E2229]">Trust &amp; Socials</h4>
              <button onClick={() => navigate('/edit-profile')} className="text-xs text-[#FF5A36] font-semibold cursor-pointer hover:underline">
                Edit
              </button>
            </div>

            {/* Social Links */}
            {(profile?.socialLinks?.linkedin || profile?.socialLinks?.instagram || profile?.workEmailVerified) ? (
              <div className="space-y-2">
                {profile.socialLinks?.linkedin && (
                  <a href={profile.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-[#0077B5]/10 rounded-2xl text-[#0077B5] hover:bg-[#0077B5]/20 transition-colors font-semibold text-xs sm:text-sm">
                    <Linkedin className="w-4 h-4" />
                    <span>LinkedIn Profile</span>
                  </a>
                )}
                {profile.socialLinks?.instagram && (
                  <a href={profile.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-[#E1306C]/10 rounded-2xl text-[#E1306C] hover:bg-[#E1306C]/20 transition-colors font-semibold text-xs sm:text-sm">
                    <Instagram className="w-4 h-4" />
                    <span>Instagram Profile</span>
                  </a>
                )}
              </div>
            ) : null}

            {/* Private Contact Information (WhatsApp) */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Contact</span>
                <span className="text-[10px] text-gray-400">Shared only with accepted connections</span>
              </div>
              {profile?.whatsappNumber ? (
                <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide">WhatsApp Number</p>
                      <p className="text-xs sm:text-sm font-bold text-[#1E2229] truncate">{profile.whatsappNumber}</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/edit-profile')} className="text-xs font-semibold text-[#FF5A36] hover:underline cursor-pointer ml-2 shrink-0">
                    Edit
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 bg-[#FBFBFC] border border-gray-100 rounded-2xl">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-500 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#1E2229]">WhatsApp Number</p>
                      <p className="text-[11px] text-gray-500 truncate">Add your WhatsApp number</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/edit-profile')} className="text-xs font-bold text-[#FF5A36] hover:underline cursor-pointer ml-2 shrink-0">
                    Add
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Account Menu */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-2 space-y-0.5">
            <button onClick={handleSwitchRole} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#FBFBFC] transition-all text-left text-xs sm:text-sm font-semibold text-[#1E2229] cursor-pointer">
              <SwitchCamera className="w-4 h-4 text-[#FF5A36]" />
              <span className="flex-1">Switch to {effectiveRole === 'seeker' ? 'Owner' : 'Seeker'} Mode</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            {effectiveRole === 'seeker' ? (
              <button onClick={() => navigate('/preferences')} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#FBFBFC] transition-all text-left text-xs sm:text-sm font-semibold text-[#1E2229] cursor-pointer">
                <Sliders className="w-4 h-4 text-gray-500" />
                <span className="flex-1">Roommate Preferences</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            ) : (
              <button onClick={() => navigate('/owner-dashboard?tab=listings')} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#FBFBFC] transition-all text-left text-xs sm:text-sm font-semibold text-[#1E2229] cursor-pointer">
                <Building2 className="w-4 h-4 text-gray-500" />
                <span className="flex-1">My Properties & Listings</span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </button>
            )}
            <button onClick={() => navigate('/safety')} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#FBFBFC] transition-all text-left text-xs sm:text-sm font-semibold text-[#1E2229] cursor-pointer">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="flex-1">Safety & Verification Center</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#FBFBFC] transition-all text-left text-xs sm:text-sm font-semibold text-[#1E2229] cursor-pointer">
              <Lock className="w-4 h-4 text-gray-500" />
              <span className="flex-1">Privacy & Security</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button onClick={() => navigate('/notifications')} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#FBFBFC] transition-all text-left text-xs sm:text-sm font-semibold text-[#1E2229] cursor-pointer">
              <Bell className="w-4 h-4 text-gray-500" />
              <span className="flex-1">Notifications</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <button onClick={() => navigate('/help')} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#FBFBFC] transition-all text-left text-xs sm:text-sm font-semibold text-[#1E2229] cursor-pointer">
              <HelpCircle className="w-4 h-4 text-gray-500" />
              <span className="flex-1">Help & Support</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
            <div className="pt-1 border-t border-gray-100">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-rose-50 transition-all text-left text-xs sm:text-sm font-semibold text-rose-600 cursor-pointer">
                <LogOut className="w-4 h-4" />
                <span className="flex-1">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (Desktop 65%) */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Trust & Verification Banner */}
          {!profile?.isVerified ? (
            <div ref={trustVerificationRef} className="bg-gradient-to-br from-[#1E2229] via-[#24243E] to-[#1E2229] rounded-3xl p-6 relative overflow-hidden text-white shadow-xs border border-slate-700/50">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[#FF5A36]/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
              <div className="relative">
                <span className="bg-[#FFF2EB]/15 text-[#FF7A45] text-[10px] font-bold px-3 py-1 rounded-full mb-3 inline-flex items-center gap-1.5 border border-[#FF5A36]/30">
                  <ShieldCheck className="w-3.5 h-3.5" /> Trust & Verification
                </span>
                <h3 className="font-serif font-medium text-xl sm:text-2xl text-white mb-2">Fast-Track Your Trust Score</h3>
                <p className="text-xs sm:text-sm text-slate-300 mb-5 max-w-md leading-relaxed">
                  Verified members get 3x higher response rates, instant applicant contact reveals, and trusted community standing.
                </p>
                <button
                  onClick={() => navigate(effectiveRole === 'owner' ? '/owner-dashboard?tab=listings' : '/trust')}
                  className="rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] active:scale-[0.98] text-white font-semibold px-5 py-2.5 text-xs sm:text-sm transition-all shadow-xs cursor-pointer inline-flex items-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {effectiveRole === 'owner' ? 'Verify Property & ID' : 'Get Verified Badge'}
                </button>
              </div>
            </div>
          ) : (
            <div ref={trustVerificationRef} className="bg-gradient-to-r from-emerald-50/80 via-white to-white rounded-3xl p-5 border border-emerald-200/80 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-sm sm:text-base text-[#1E2229]">Verified Community Member</h3>
                    <span className="bg-[#E6F9EE] text-[#129B52] border border-emerald-200/80 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Level 2 Verified
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed max-w-lg">
                    Your Government ID is verified. You have maximum search visibility, verified badges, and trusted access to chats.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/safety')}
                className="shrink-0 px-4 py-2 rounded-full font-bold text-xs bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs transition-colors cursor-pointer"
              >
                Trust Center →
              </button>
            </div>
          )}

          {/* Profile Completeness Meter (Placed in Right Column to perfectly balance layout) */}
          <ProfileCompleteness profile={profile} />

          {/* My Connections / Friends */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif font-medium text-base text-[#1E2229] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FF5A36]" /> My Connections ({acceptedConnections.length})
              </h4>
              {acceptedConnections.length > 0 && (
                <button onClick={() => navigate('/chat')} className="text-xs text-[#FF5A36] font-semibold hover:underline cursor-pointer">View All Chats</button>
              )}
            </div>
            {acceptedConnections.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {acceptedConnections.map(conn => {
                  const p = conn.profile;
                  return (
                    <div key={conn.connection.id} className="p-3 bg-[#FBFBFC] rounded-2xl border border-gray-100 flex items-center gap-3 hover:bg-[#FFF2EB]/20 transition-colors">
                      {p.avatar ? (
                        <img
                          src={p.avatar}
                          alt={p.name}
                          className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full border border-gray-200 bg-[#FFF2EB] flex items-center justify-center text-sm font-bold text-[#FF5A36]">{(p.name || 'U').charAt(0).toUpperCase()}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-[#1E2229] truncate">{p.name}</p>
                        <p className="text-[11px] text-gray-500 truncate">{p.profession || 'Member'} · {p.city}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.whatsappNumber ? (
                          <a
                            href={formatWhatsAppDeepLink(p.whatsappNumber, `Hi ${p.name}, connecting via NestMate!`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-all shadow-xs cursor-pointer inline-flex items-center justify-center"
                            title={`Message ${p.name} on WhatsApp`}
                            aria-label={`Message ${p.name} on WhatsApp`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        ) : null}
                        <button
                          onClick={async () => {
                            const targetId = p.uid || conn.connection.fromUserId;
                            const roomId = await getOrCreateChatRoom(user!.uid, targetId);
                            navigate(`/chat/${roomId}`);
                          }}
                          className="p-2 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full transition-all shadow-xs cursor-pointer"
                          title="Message on NestMate"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <StateEmpty
                compact
                icon={Users}
                title="No connections yet"
                description="Connect with roommates or property owners on NestMate"
              />
            )}
          </div>

          {/* Dynamic Milestones & Activity Feed */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif font-medium text-base text-[#1E2229] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#FF5A36]" /> Recent Milestones &amp; Activity
              </h4>
              <span className="text-[11px] font-semibold text-gray-400">
                {activities.length} Events
              </span>
            </div>

            {activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((act, idx) => {
                  const Icon = act.icon;
                  return (
                    <div key={idx} className="p-3 bg-[#FBFBFC] rounded-2xl border border-gray-100 flex items-start gap-3 transition-colors hover:bg-[#FFF2EB]/20">
                      <div className={`w-8 h-8 rounded-xl ${act.iconBg} flex items-center justify-center shrink-0 shadow-2xs mt-0.5`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="text-xs sm:text-sm font-bold text-[#1E2229] truncate">{act.title}</p>
                          <span className="text-[10px] font-semibold text-gray-400 shrink-0">{act.time}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 leading-snug">{act.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <StateEmpty
                compact
                icon={TrendingUp}
                title="No activity yet"
                description="Your activity will appear here as you use NestMate"
              />
            )}
          </div>

          {/* Community Reviews & Vouches Section */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-serif font-medium text-base text-[#1E2229]">Community Reviews &amp; Vouches</h4>
              <div className="flex items-center gap-1.5 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-xs font-bold text-amber-900">{averageRating}</span>
                <span className="text-[10px] text-amber-700">({reviews.length})</span>
              </div>
            </div>

            {reviews.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {reviews.map(review => (
                  <div key={review.id} className="bg-[#FBFBFC] p-4 rounded-2xl border border-gray-100">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        {review.reviewerAvatar ? (
                          <img
                            src={review.reviewerAvatar}
                            alt={review.reviewerName}
                            className="w-8 h-8 rounded-full border border-gray-200 object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-[#FFF2EB] border border-gray-200 flex items-center justify-center text-xs font-bold text-[#FF5A36]">
                            {(review.reviewerName || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-xs sm:text-sm font-bold text-[#1E2229]">{review.reviewerName}</p>
                          <p className="text-[10px] text-gray-400">
                            {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Just now'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <Star
                            key={star}
                            className={`w-3 h-3 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.text && <p className="text-xs sm:text-sm text-gray-600 mt-2 leading-relaxed">{review.text}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 px-4 rounded-2xl bg-[#FBFBFC] border border-gray-100 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-2xl bg-white border border-gray-200/80 flex items-center justify-center text-gray-400 mb-2 shadow-2xs">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-100" />
                </div>
                <p className="text-xs font-bold text-[#1E2229]">No reviews or vouches yet</p>
                <p className="text-[11px] text-gray-500 max-w-xs mt-0.5 mb-3">
                  Reviews from past roommates or hosts will appear here to boost your profile standing.
                </p>
                <button
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(window.location.origin + `/match/${user?.uid}`);
                      toast.success('Public profile link copied! Share with roommates to receive vouches.');
                    } else {
                      navigate(`/match/${user?.uid}`);
                    }
                  }}
                  className="px-4 py-2 rounded-full font-bold text-xs bg-white hover:bg-gray-50 border border-gray-200 text-[#1E2229] shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#FF5A36]" />
                  <span>Share Profile for Vouches</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
