import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useConnections } from '@/hooks/useConnections';
import { useChat } from '@/hooks/useChat';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import {
  Users, ArrowLeft, ShieldCheck, MessageCircle,
  CheckCircle2, User, Sparkles, Loader2, IndianRupee, Calendar, Briefcase,
  Utensils, Moon, Cigarette, X
} from 'lucide-react';

interface CandidateData {
  connectionId: string;
  applicantId: string;
  name: string;
  avatar?: string;
  age?: number;
  profession?: string;
  budget?: number;
  moveInDate?: string;
  isVerified?: boolean;
  quizAnswers?: Record<string, string>;
  bio?: string;
}

export default function ApplicantCompare() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { getMyConnections, acceptRequest } = useConnections();
  const { getOrCreateChatRoom } = useChat();

  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateData | null>(null);
  const [confirmSelectModal, setConfirmSelectModal] = useState(false);
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);

  // Document Title
  useEffect(() => {
    document.title = 'Compare Applicants | NestMate';
  }, []);

  // Modal accessibility: Escape key and body scroll locking
  useEffect(() => {
    if (confirmSelectModal) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setConfirmSelectModal(false);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [confirmSelectModal]);

  useEffect(() => {
    if (!user?.uid) return;
    const ownerUid = user.uid;

    const idsParam = searchParams.get('ids');
    const targetIds = idsParam ? idsParam.split(',').filter(Boolean).slice(0, 3) : [];

    async function loadCandidates() {
      setLoading(true);
      try {
        if (targetIds.length > 0) {
          // Load specific requested applicant profiles and resolve their connection documents
          const allOwnerConns = await getMyConnections(ownerUid);
          const loaded: CandidateData[] = [];
          for (const uid of targetIds) {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const udata = userSnap.data();
              const existingConn = allOwnerConns.find(c => c.fromUserId === uid || c.toUserId === uid);
              loaded.push({
                connectionId: existingConn ? existingConn.id : '',
                applicantId: uid,
                name: udata.name || 'Applicant',
                avatar: udata.avatar,
                age: udata.age,
                profession: udata.profession,
                budget: udata.budget,
                moveInDate: udata.moveInDate,
                isVerified: udata.isVerified,
                quizAnswers: udata.quizAnswers || {},
                bio: udata.bio,
              });
            }
          }
          setCandidates(loaded);
        } else {
          // Load from pending or accepted connections
          const conns = await getMyConnections(ownerUid);
          const validConns = conns.filter(c => c.status === 'pending' || c.status === 'accepted');
          const loaded: CandidateData[] = [];
          for (const c of validConns.slice(0, 3)) {
            const partnerId = c.fromUserId === ownerUid ? c.toUserId : c.fromUserId;
            const userSnap = await getDoc(doc(db, 'users', partnerId));
            if (userSnap.exists()) {
              const udata = userSnap.data();
              loaded.push({
                connectionId: c.id,
                applicantId: partnerId,
                name: udata.name || 'Applicant',
                avatar: udata.avatar,
                age: udata.age,
                profession: udata.profession,
                budget: udata.budget,
                moveInDate: udata.moveInDate,
                isVerified: udata.isVerified,
                quizAnswers: udata.quizAnswers || {},
                bio: udata.bio,
              });
            }
          }
          setCandidates(loaded);
        }
      } catch (err) {
        console.error('Failed to load compare candidates:', err);
        toast.error('Failed to load applicant details');
      } finally {
        setLoading(false);
      }
    }

    loadCandidates();
  }, [user?.uid, searchParams, getMyConnections]);

  const handleSelectCandidate = (candidate: CandidateData) => {
    setSelectedCandidate(candidate);
    setConfirmSelectModal(true);
  };

  const handleChatApplicant = async (applicantId: string) => {
    if (!user?.uid) return;
    try {
      const roomId = await getOrCreateChatRoom(user.uid, applicantId);
      navigate(`/chat/${roomId}`);
    } catch (err) {
      console.error('Failed to open chat:', err);
      navigate('/chat');
    }
  };

  const handleExecuteFill = async () => {
    if (!selectedCandidate || !user?.uid) return;
    const targetListingId = searchParams.get('listingId');
    try {
      if (targetListingId) {
        await updateDoc(doc(db, 'listings', targetListingId), {
          status: 'filled',
          updatedAt: serverTimestamp(),
        });
      }
      if (selectedCandidate.connectionId) {
        await acceptRequest(selectedCandidate.connectionId);
      }
      let actionUrl = '/chat';
      try {
        const roomId = await getOrCreateChatRoom(user.uid, selectedCandidate.applicantId);
        if (roomId) actionUrl = `/chat/${roomId}`;
      } catch {
        // Fallback to /chat
      }
      await addDoc(collection(db, 'notifications'), {
        userId: selectedCandidate.applicantId,
        type: 'match',
        title: 'You were selected!',
        description: `Great news! You have been selected as the new roommate. Open Messages to coordinate move-in.`,
        read: false,
        actionUrl,
        actorId: user.uid,
        connectionId: selectedCandidate.connectionId,
        createdAt: serverTimestamp(),
      });
      toast.success(`Selected ${selectedCandidate.name}! The room is marked Filled and notifications sent.`);
    } catch (e) {
      console.error('Failed to execute room fill:', e);
      toast.error('Failed to update room status in database.');
    }
    setConfirmSelectModal(false);
    setTimeout(() => {
      navigate('/owner-dashboard');
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] pb-24">
      {/* Confirm Select Modal */}
      {confirmSelectModal && selectedCandidate && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmSelectModal(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div className="relative bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-xl border border-gray-100 text-center space-y-4">
            <button
              type="button"
              onClick={() => setConfirmSelectModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="font-serif font-medium text-2xl text-[#1E2229]">
              Select {selectedCandidate.name}?
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed font-sans">
              Confirming selection will mark your room as <strong className="text-[#1E2229]">Filled</strong>, send polite updates to other pending applicants, and enable direct lease coordination.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSelectModal(false)}
                className="flex-1 py-3 border border-gray-200 rounded-full text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
              >
                Review Others
              </button>
              <button
                type="button"
                onClick={handleExecuteFill}
                className="flex-1 py-3 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-semibold shadow-sm shadow-[#FF5A36]/20 transition-all cursor-pointer"
              >
                Confirm Roommate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 py-4 px-4 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/owner-dashboard')}
            className="flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-[#1E2229] bg-white px-3.5 py-1.5 rounded-full border border-gray-200 shadow-2xs transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <h1 className="font-serif font-medium text-base sm:text-lg text-[#1E2229]">
              Compare Applicants
            </h1>
          </div>

          <span className="text-xs font-bold text-[#FF5A36] bg-[#FFF2EB] border border-[#FF5A36]/20 px-3 py-1 rounded-full">
            {candidates.length} Candidate{candidates.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-8">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-9 h-9 animate-spin text-[#FF5A36]" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Analyzing applicants side-by-side...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-12 text-center max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center mx-auto text-gray-400">
              <Users className="w-8 h-8" />
            </div>
            <h2 className="font-serif font-medium text-2xl text-[#1E2229]">No Applicants to Compare</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              When prospective tenants submit inquiries and connect with your property, you can compare up to 3 candidates here side-by-side.
            </p>
            <Link
              to="/owner-dashboard"
              className="inline-flex items-center gap-2 bg-[#FF5A36] hover:bg-[#E54E2B] text-white py-3 px-6 rounded-full font-semibold text-xs shadow-sm shadow-[#FF5A36]/20 transition-all"
            >
              Back to Owner Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-500 font-medium">
                Evaluating candidate lifestyle habits, budget alignment, and schedule preferences side-by-side.
              </p>
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full font-semibold border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5" /> AI Compatibility Enabled
              </div>
            </div>

            {/* MOBILE COMPARISON VIEW (< 768px): Touch-First Cards & Switcher */}
            <div className="md:hidden space-y-4">
              {/* Candidate Switcher Tabs */}
              {candidates.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {candidates.map((c, idx) => {
                    const isSelected = mobileActiveIndex === idx;
                    return (
                      <button
                        key={c.applicantId}
                        type="button"
                        onClick={() => setMobileActiveIndex(idx)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-[#1E2229] text-white border-[#1E2229] shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 shrink-0 border border-white/20">
                          {c.avatar ? (
                            <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-3.5 h-3.5 m-auto text-gray-400" />
                          )}
                        </div>
                        <span className="truncate max-w-[110px]">{c.name}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#FF5A36]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active Candidate Detailed Card */}
              {candidates[mobileActiveIndex] && (() => {
                const c = candidates[mobileActiveIndex];
                return (
                  <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 space-y-4 animate-fade-up">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0 shadow-2xs">
                          {c.avatar ? (
                            <img src={c.avatar} alt={c.name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-7 h-7 m-auto text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-serif font-medium text-lg text-[#1E2229] truncate">{c.name}</h3>
                            {c.isVerified && (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                                <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-medium truncate mt-0.5">
                            {c.age ? `${c.age} yrs` : 'Age Unspecified'} • {c.profession || 'Professional'}
                          </p>
                        </div>
                      </div>

                      {/* Candidate Index Badge */}
                      <span className="text-[11px] font-extrabold text-[#FF5A36] bg-[#FFF2EB] border border-[#FF5A36]/20 px-2.5 py-1 rounded-full shrink-0">
                        {mobileActiveIndex + 1} of {candidates.length}
                      </span>
                    </div>

                    {/* Bio if available */}
                    {c.bio && (
                      <p className="text-xs text-gray-600 bg-[#FBFBFC] p-3 rounded-2xl border border-gray-100 leading-relaxed italic">
                        "{c.bio}"
                      </p>
                    )}

                    {/* Metric Comparison Key-Value Grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Budget Range</p>
                        <p className="text-sm font-bold text-[#FF5A36] mt-0.5">
                          {c.budget ? `₹${c.budget.toLocaleString()}/mo` : 'Flexible'}
                        </p>
                      </div>

                      <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Move-in Date</p>
                        <p className="text-xs font-bold text-[#1E2229] mt-0.5 truncate">
                          {c.moveInDate || 'Immediate'}
                        </p>
                      </div>

                      <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Diet Preference</p>
                        <p className="text-xs font-bold text-[#1E2229] mt-0.5 capitalize truncate">
                          {c.quizAnswers?.food_pref?.replace('_', ' ') || 'Any Diet'}
                        </p>
                      </div>

                      <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Smoking Habit</p>
                        <p className="text-xs font-bold text-[#1E2229] mt-0.5 capitalize truncate">
                          {c.quizAnswers?.smoking || 'Non-smoker'}
                        </p>
                      </div>

                      <div className="bg-[#FBFBFC] border border-gray-100 rounded-2xl p-3 col-span-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sleep Schedule</p>
                            <p className="text-xs font-bold text-[#1E2229] mt-0.5 capitalize">
                              {c.quizAnswers?.sleep_time || 'Flexible'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Trust Level</p>
                            <p className="text-xs font-bold text-emerald-700 mt-0.5 text-right">
                              {c.isVerified ? 'Government ID' : 'Phone Verified'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Candidate Switcher Stepper buttons */}
                    {candidates.length > 1 && (
                      <div className="flex items-center justify-between pt-1 text-xs font-semibold text-gray-500">
                        <button
                          type="button"
                          disabled={mobileActiveIndex === 0}
                          onClick={() => setMobileActiveIndex(prev => Math.max(0, prev - 1))}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-30 cursor-pointer"
                        >
                          ← Previous
                        </button>
                        <span>{mobileActiveIndex + 1} / {candidates.length}</span>
                        <button
                          type="button"
                          disabled={mobileActiveIndex === candidates.length - 1}
                          onClick={() => setMobileActiveIndex(prev => Math.min(candidates.length - 1, prev + 1))}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 disabled:opacity-30 cursor-pointer"
                        >
                          Next →
                        </button>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => handleChatApplicant(c.applicantId)}
                        className="p-3 rounded-2xl border border-gray-200 text-gray-600 hover:text-[#FF5A36] hover:border-[#FF5A36]/30 hover:bg-[#FFF2EB]/40 transition-colors shadow-2xs shrink-0 cursor-pointer"
                        title="Chat with applicant"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectCandidate(c)}
                        className="flex-1 py-3.5 px-4 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-bold shadow-xs shadow-[#FF5A36]/20 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        Select {c.name.split(' ')[0]} as Roommate
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Side-by-Side Quick Summary Card for 2+ candidates */}
              {candidates.length > 1 && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4 space-y-3">
                  <h4 className="font-serif font-medium text-sm text-[#1E2229]">Side-by-Side Summary</h4>
                  <div className="divide-y divide-gray-100 text-xs">
                    {candidates.map((c, idx) => (
                      <div
                        key={c.applicantId}
                        onClick={() => setMobileActiveIndex(idx)}
                        className={`py-2.5 flex items-center justify-between cursor-pointer rounded-xl px-2 transition-colors ${
                          mobileActiveIndex === idx ? 'bg-[#FFF2EB]/60 font-semibold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-100 shrink-0">
                            {c.avatar ? (
                              <img
                                src={c.avatar}
                                alt={c.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <User className="w-4 h-4 m-auto text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-[#1E2229] truncate font-bold">{c.name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{c.moveInDate || 'Immediate'}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-[#FF5A36]">{c.budget ? `₹${c.budget.toLocaleString()}` : 'Flexible'}</p>
                          <p className="text-[10px] text-gray-500 capitalize">{c.quizAnswers?.food_pref?.replace('_', ' ') || 'Any'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* DESKTOP COMPARISON MATRIX (>= 768px) */}
            <div className="hidden md:block overflow-x-auto pb-4">
              <div className={`grid gap-4 min-w-[720px] ${candidates.length === 1 ? 'grid-cols-2' : candidates.length === 2 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                {/* Metric Label Column */}
                <div className="bg-white/60 rounded-3xl p-5 space-y-4 pt-36 text-xs font-bold text-gray-500 uppercase tracking-wider border border-gray-100">
                  <div className="h-12 flex items-center border-b border-gray-100">
                    <ShieldCheck className="w-3.5 h-3.5 mr-2 text-emerald-600 shrink-0" />
                    <span>Identity Trust</span>
                  </div>
                  <div className="h-12 flex items-center border-b border-gray-100">
                    <IndianRupee className="w-3.5 h-3.5 mr-2 text-[#FF5A36] shrink-0" />
                    <span>Budget Range</span>
                  </div>
                  <div className="h-12 flex items-center border-b border-gray-100">
                    <Calendar className="w-3.5 h-3.5 mr-2 text-slate-500 shrink-0" />
                    <span>Move-in Date</span>
                  </div>
                  <div className="h-12 flex items-center border-b border-gray-100">
                    <Briefcase className="w-3.5 h-3.5 mr-2 text-slate-500 shrink-0" />
                    <span>Profession</span>
                  </div>
                  <div className="h-12 flex items-center border-b border-gray-100">
                    <Utensils className="w-3.5 h-3.5 mr-2 text-slate-500 shrink-0" />
                    <span>Diet Preference</span>
                  </div>
                  <div className="h-12 flex items-center border-b border-gray-100">
                    <Cigarette className="w-3.5 h-3.5 mr-2 text-slate-500 shrink-0" />
                    <span>Smoking Habit</span>
                  </div>
                  <div className="h-12 flex items-center border-b border-gray-100">
                    <Moon className="w-3.5 h-3.5 mr-2 text-slate-500 shrink-0" />
                    <span>Sleep Schedule</span>
                  </div>
                  <div className="h-16 flex items-center">
                    <Sparkles className="w-3.5 h-3.5 mr-2 text-[#FF5A36] shrink-0" />
                    <span>Final Decision</span>
                  </div>
                </div>

                {/* Candidate Columns (up to 3) */}
                {candidates.map((c) => (
                  <div
                    key={c.applicantId}
                    className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 flex flex-col space-y-4 hover:shadow-md transition-shadow"
                  >
                    {/* Header: Photo & Name */}
                    <div className="h-32 text-center flex flex-col items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 mb-2 flex items-center justify-center shadow-2xs">
                        {c.avatar ? (
                          <img
                            src={c.avatar}
                            alt={c.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <User className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <h3 className="font-serif font-medium text-base text-[#1E2229] truncate w-full">{c.name}</h3>
                      <span className="text-xs text-gray-400 font-medium">{c.age ? `${c.age} yrs` : 'Age Unspecified'}</span>
                    </div>

                    {/* Verification */}
                    <div className="h-12 flex items-center border-b border-gray-100 text-xs">
                      {c.isVerified ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> ID Verified
                        </span>
                      ) : (
                        <span className="text-gray-400 font-medium text-xs">Phone Verified</span>
                      )}
                    </div>

                    {/* Budget Fit */}
                    <div className="h-12 flex items-center border-b border-gray-100 text-sm font-semibold text-[#1E2229]">
                      {c.budget ? `₹${c.budget.toLocaleString()}/mo` : 'Flexible Budget'}
                    </div>

                    {/* Move-in */}
                    <div className="h-12 flex items-center border-b border-gray-100 text-xs text-gray-700 font-medium">
                      {c.moveInDate || 'Immediate'}
                    </div>

                    {/* Profession */}
                    <div className="h-12 flex items-center border-b border-gray-100 text-xs text-gray-700 font-medium truncate">
                      {c.profession || 'Professional'}
                    </div>

                    {/* Diet */}
                    <div className="h-12 flex items-center border-b border-gray-100 text-xs text-gray-700 font-medium capitalize">
                      {c.quizAnswers?.food_pref?.replace('_', ' ') || 'Any Diet'}
                    </div>

                    {/* Smoking */}
                    <div className="h-12 flex items-center border-b border-gray-100 text-xs text-gray-700 font-medium capitalize">
                      {c.quizAnswers?.smoking || 'Non-smoker'}
                    </div>

                    {/* Sleep */}
                    <div className="h-12 flex items-center border-b border-gray-100 text-xs text-gray-700 font-medium capitalize">
                      {c.quizAnswers?.sleep_time || 'Flexible'}
                    </div>

                    {/* Actions */}
                    <div className="h-16 flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleChatApplicant(c.applicantId)}
                        className="p-3 rounded-2xl border border-gray-200 text-gray-600 hover:text-[#FF5A36] hover:border-[#FF5A36]/30 hover:bg-[#FFF2EB]/40 transition-colors shadow-2xs cursor-pointer"
                        title="Chat with applicant"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectCandidate(c)}
                        className="flex-1 py-3 px-4 bg-[#FF5A36] hover:bg-[#E54E2B] text-white rounded-full text-xs font-semibold shadow-xs shadow-[#FF5A36]/20 transition-all active:scale-[0.98] cursor-pointer"
                      >
                        Select Roommate
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
