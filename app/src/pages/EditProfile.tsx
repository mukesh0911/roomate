import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { resolveEntityCoordinates } from '@/lib/locationResolver';
import { mergePreferredLocalities } from '@/lib/profileLocalities';
import {
  ArrowLeft, Save, RefreshCw, Loader2, Linkedin, Instagram,
  MessageCircle, Shield, CheckCircle2, XCircle, Upload, Clock, FileText
} from 'lucide-react';
import { cities, localitiesByCity, professions } from '@/lib/staticData';
import { collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useStorage } from '@/hooks/useStorage';
import { toast } from 'sonner';
import StateEmpty from '@/components/StateEmpty';

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { updateProfile } = useUserProfile();

  // Document Title
  useEffect(() => {
    document.title = 'Edit Profile | NestMate';
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: '',
    profession: '',
    bio: '',
    city: '',
    locality: '',
    workEmail: '',
    whatsappNumber: '',
    linkedin: '',
    instagram: '',
  });

  const [workEmailVerified, setWorkEmailVerified] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [retaking, setRetaking] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { uploadGenericImage, uploadProfilePicture } = useStorage();

  const googlePhoto = user ? (user.photoURL || user.providerData?.find(p => p.photoURL)?.photoURL || '') : '';
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarProgress, setAvatarProgress] = useState(0);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    setUploadingAvatar(true);
    setAvatarProgress(0);
    try {
      const url = await uploadProfilePicture(file, user.uid, pct => setAvatarProgress(pct));
      if (url) {
        await updateProfile(user.uid, { avatar: url });
        await refreshProfile();
        toast.success('Profile photo updated!');
      }
    } catch (err: any) {
      console.error('Failed to upload avatar:', err);
      toast.error('Failed to upload profile photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUseGooglePhoto = async () => {
    if (!user?.uid || !googlePhoto) return;
    try {
      await updateProfile(user.uid, { avatar: googlePhoto });
      await refreshProfile();
      toast.success('Profile photo updated from Google account!');
    } catch (err: any) {
      console.error('Failed to set Google photo:', err);
      toast.error('Failed to set Google photo.');
    }
  };

  // Verification states
  const [verifications, setVerifications] = useState<any[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedDocType, setSelectedDocType] = useState<'aadhaar' | 'work_id' | 'student_id'>('aadhaar');

  useEffect(() => {
    if (!user?.uid) return;
    const fetchVerifications = async () => {
      setVerificationLoading(true);
      try {
        const q = query(collection(db, 'verifications'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setVerifications(list);
      } catch (err) {
        console.error('Error fetching verifications:', err);
      } finally {
        setVerificationLoading(false);
      }
    };
    fetchVerifications();
  }, [user?.uid]);

  useEffect(() => {
    if (window.location.hash === '#verification') {
      const timer = setTimeout(() => {
        const el = document.getElementById('verification');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    setUploadingDoc(true);
    setUploadProgress(0);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      // Owner-only Storage path (see storage.rules /verifications/{userId}/**).
      // Never under profiles/** — those objects are readable by all authenticated users.
      const path = `verifications/${user.uid}/${selectedDocType}_${Date.now()}.${ext}`;
      const url = await uploadGenericImage(file, path, (pct) => setUploadProgress(pct));

      // Submit for admin review — never self-grant verified status (LB-01)
      const newDocRef = await addDoc(collection(db, 'verifications'), {
        userId: user.uid,
        type: selectedDocType,
        status: 'pending',
        documentUrl: url,
        submittedAt: new Date(),
      });

      setVerifications(prev => [...prev, {
        id: newDocRef.id,
        userId: user.uid,
        type: selectedDocType,
        status: 'pending',
        documentUrl: url,
        submittedAt: { toDate: () => new Date() },
      }]);

      toast.success('Document submitted for review. An admin will verify it shortly.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload document.');
    } finally {
      setUploadingDoc(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        age: profile.age?.toString() || '',
        gender: (profile.gender || '').toLowerCase(),
        profession: profile.profession || '',
        bio: profile.bio || '',
        city: profile.city || '',
        locality: profile.localities?.[0] || profile.locality || '',
        workEmail: profile.workEmail || '',
        whatsappNumber: profile.whatsappNumber || '',
        linkedin: profile.socialLinks?.linkedin || '',
        instagram: profile.socialLinks?.instagram || '',
      });
      setWorkEmailVerified(profile.workEmailVerified || false);
    }
  }, [profile]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    const parsedAge = parseInt(formData.age, 10);
    if (!formData.age || isNaN(parsedAge) || parsedAge < 18 || parsedAge > 100) {
      errs.age = 'Age must be between 18 and 100';
    }
    if (!formData.city.trim()) errs.city = 'City is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      const errList = Object.values(errors);
      toast.error(errList.length > 0 ? errList[0] : 'Please fill in all required fields (Name, Age >= 18, City).');
      return;
    }
    if (!user?.uid) return;
    setSaving(true);
    try {
      const localities = mergePreferredLocalities(profile?.localities, formData.locality);
      const primaryLocality = localities[0] || formData.locality;
      const coords = resolveEntityCoordinates({
        uid: user.uid,
        city: formData.city,
        locality: primaryLocality,
      });

      await updateProfile(user.uid, {
        name: formData.name,
        age: parseInt(formData.age),
        gender: formData.gender,
        profession: formData.profession,
        bio: formData.bio,
        city: formData.city,
        locality: primaryLocality,
        localities,
        workEmail: formData.workEmail,
        whatsappNumber: formData.whatsappNumber,
        // workEmailVerified is admin/OTP-only — never self-grant from typing an email
        socialLinks: {
          linkedin: formData.linkedin,
          instagram: formData.instagram,
        },
        ...(coords && { geoLocation: { lat: coords.lat, lng: coords.lng, formattedAddress: `${primaryLocality || formData.city}, ${formData.city}` } }),
      });
      await refreshProfile();
      setSuccess('Profile updated successfully!');
      toast.success('Profile updated successfully!');
      setTimeout(() => navigate('/profile'), 1000);
    } catch (err: any) {
      console.error('Error updating profile', err);
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleRetakeQuiz = async () => {
    if (!user?.uid) return;
    setRetaking(true);
    try {
      // Compatibility setup is an activity, not a role change. Preserve the
      // existing answers until the member explicitly saves updated ones.
      navigate('/onboarding/seeker?roommate=1&redirect=%2Fexplore%3Ftab%3Droommates');
    } catch (err) {
      console.error('Error resetting quiz', err);
      setRetaking(false);
    }
  };



  if (!profile) {
    return (
      <div className="min-h-screen bg-[#FBFBFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#FF5A36] animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFC] pb-24">
      {/* Header */}
      <div className="bg-[#FBFBFC]/95 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200/60 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/profile')} className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors cursor-pointer" aria-label="Back to profile">
            <ArrowLeft className="w-5 h-5 text-[#1E2229]" />
          </button>
          <h1 className="font-serif font-medium text-lg sm:text-xl text-[#1E2229]">Edit Profile</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] active:scale-[0.98] text-white px-4 py-1.5 text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-xs transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-2" role="alert">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Profile Photo */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="font-serif font-medium text-base text-[#1E2229]">Profile Photo</h2>
            <p className="text-xs text-gray-500 mt-0.5">A clear photo helps potential roommates recognize and trust you</p>
          </div>

          <div className="flex items-center gap-5 pt-1">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-2 border-[#FF5A36] p-0.5 bg-[#FBFBFC] overflow-hidden shrink-0 shadow-xs">
                {(profile?.avatar || user?.photoURL) && !(profile?.avatar || user?.photoURL)?.includes('dicebear') ? (
                  <img
                    src={profile?.avatar || user?.photoURL || undefined}
                    alt={profile?.name || user?.displayName || 'User'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div aria-hidden="true" className="w-full h-full rounded-full bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center font-bold text-2xl">
                    {(profile?.name || user?.displayName || '?').trim().charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {uploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {avatarProgress}%
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] text-white px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingAvatar ? 'Uploading...' : 'Upload New Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingAvatar}
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </label>

                {googlePhoto && profile?.avatar !== googlePhoto && (
                  <button
                    type="button"
                    onClick={handleUseGooglePhoto}
                    disabled={uploadingAvatar}
                    className="rounded-full bg-white border border-gray-200 px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 text-[#1E2229] hover:bg-gray-50 shadow-xs cursor-pointer transition-all"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Use Google Photo</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-gray-400 font-medium">JPG, PNG or WEBP up to 5MB</p>
            </div>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6 space-y-4">
          <h2 className="font-serif font-medium text-base text-[#1E2229]">Basic Information</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Full Name</label>
            <input
              type="text"
              id="profile-name"
              placeholder="Full Name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-medium text-[#1E2229] bg-white focus:outline-none focus:border-[#FF5A36] shadow-xs ${errors.name ? 'border-rose-400' : 'border-gray-200'}`}
            />
            {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Age</label>
              <input
                type="number"
                value={formData.age}
                onChange={e => setFormData({ ...formData, age: e.target.value })}
                className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-medium text-[#1E2229] bg-white focus:outline-none focus:border-[#FF5A36] shadow-xs ${errors.age ? 'border-rose-400' : 'border-gray-200'}`}
              />
              {errors.age && <p className="text-xs text-rose-500 mt-1">{errors.age}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Gender</label>
              <select
                value={formData.gender}
                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-[#1E2229] focus:outline-none focus:border-[#FF5A36] shadow-xs"
              >
                <option value="">Select</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Profession</label>
            <select
              value={formData.profession}
              onChange={e => setFormData({ ...formData, profession: e.target.value })}
              className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-[#1E2229] focus:outline-none focus:border-[#FF5A36] shadow-xs"
            >
              <option value="">Select</option>
              {professions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-500">Bio</label>
              <span className="text-[11px] text-gray-400 font-medium">{formData.bio.length}/500</span>
            </div>
            <textarea
              maxLength={500}
              value={formData.bio}
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-[#1E2229] focus:outline-none focus:border-[#FF5A36] shadow-xs min-h-[100px] resize-none"
              placeholder="Tell potential roommates a bit about yourself..."
            />
          </div>
        </div>

        {/* Location */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6 space-y-4">
          <h2 className="font-serif font-medium text-base text-[#1E2229]">Location</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">City</label>
              <select
                value={formData.city}
                onChange={e => setFormData({ ...formData, city: e.target.value, locality: '' })}
                className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-medium text-[#1E2229] bg-white focus:outline-none focus:border-[#FF5A36] shadow-xs ${errors.city ? 'border-rose-400' : 'border-gray-200'}`}
              >
                <option value="">Select city</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.city && <p className="text-xs text-rose-500 mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Primary locality</label>
              <select
                value={formData.locality}
                onChange={e => setFormData({ ...formData, locality: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-[#1E2229] focus:outline-none focus:border-[#FF5A36] shadow-xs"
                disabled={!formData.city}
              >
                <option value="">Select locality</option>
                {formData.locality && !localitiesByCity[formData.city]?.includes(formData.locality) && (
                  <option value={formData.locality}>{formData.locality}</option>
                )}
                {formData.city && localitiesByCity[formData.city]?.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              {profile?.localities && profile.localities.length > 1 && (
                <p className="mt-1.5 text-[11px] text-gray-400">Your other preferred areas are kept when you save.</p>
              )}
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6 space-y-4">
          <h2 className="font-serif font-medium text-base text-[#1E2229]">Social Profiles</h2>
          <p className="text-xs text-gray-500 -mt-2 mb-2">Add your social profiles to build trust with potential roommates.</p>

          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Linkedin className="w-4.5 h-4.5 text-[#0077B5]" />
              </div>
              <input
                type="url"
                placeholder="LinkedIn Profile URL"
                value={formData.linkedin}
                onChange={e => setFormData({ ...formData, linkedin: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-[#1E2229] focus:outline-none focus:border-[#FF5A36] shadow-xs"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Instagram className="w-4.5 h-4.5 text-[#E1306C]" />
              </div>
              <input
                type="url"
                placeholder="Instagram Handle or URL"
                value={formData.instagram}
                onChange={e => setFormData({ ...formData, instagram: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-[#1E2229] focus:outline-none focus:border-[#FF5A36] shadow-xs"
              />
            </div>

            {/* WhatsApp Number (Private until connection accepted) */}
            <div className="pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-[#1E2229] block mb-1">
                WhatsApp Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <MessageCircle className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <input
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  value={formData.whatsappNumber}
                  onChange={e => setFormData({ ...formData, whatsappNumber: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm font-medium text-[#1E2229] focus:outline-none focus:border-[#FF5A36] shadow-xs"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5 pl-1 leading-relaxed">
                Add a WhatsApp number so you can share it with people you connect with on NestMate.
              </p>
            </div>
          </div>
        </div>

        {/* Identity Verification Portal */}
        <div id="verification" className="bg-white rounded-3xl border border-gray-100 shadow-xs p-5 sm:p-6 space-y-4 scroll-mt-24">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#FF5A36]" />
            <h2 className="font-serif font-medium text-base text-[#1E2229]">Trust & Verification</h2>
          </div>
          <p className="text-xs text-gray-500 -mt-2">Upload government ID or work credentials to achieve higher tier badges and boost match visibility.</p>

          {/* Active status */}
          {verificationLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#FF5A36]" /> Loading verifications...
            </div>
          ) : verifications.length > 0 ? (
            <div className="space-y-2.5 pt-1">
              {verifications.map((v) => (
                <div key={v.id} className="flex justify-between items-center bg-[#FBFBFC] border border-gray-100 p-3.5 rounded-2xl">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#1E2229] capitalize">{v.type.replace('_', ' ')} Upload</p>
                    {v.status === 'pending' && (
                      <p className="text-[10px] text-amber-600 font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> Under Review</p>
                    )}
                    {v.status === 'approved' && (
                      <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</p>
                    )}
                    {v.status === 'rejected' && (
                      <div className="space-y-1">
                        <p className="text-[10px] text-rose-500 font-semibold flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejected</p>
                        {v.reviewNote && <p className="text-[9px] text-rose-600 bg-rose-50 p-1 rounded-lg">Reason: {v.reviewNote}</p>}
                      </div>
                    )}
                  </div>

                  {v.status === 'rejected' && (
                    <button
                      onClick={() => {
                        setVerifications(prev => prev.filter(x => x.id !== v.id));
                      }}
                      className="text-[10px] font-bold text-[#FF5A36] hover:underline cursor-pointer"
                    >
                      Retry Upload
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <StateEmpty
              compact
              icon={FileText}
              title="No documents yet"
              description="You haven't submitted any verification documents yet."
            />
          )}

          {/* Upload Controls */}
          {(!verifications.some(v => v.status === 'pending' || v.status === 'approved')) && (
            <div className="pt-2 space-y-4 border-t border-gray-100">
              <div className="grid grid-cols-3 gap-2">
                {(['aadhaar', 'work_id', 'student_id'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedDocType(type)}
                    className={`py-2 px-2 rounded-full text-xs font-semibold capitalize transition-all border cursor-pointer ${selectedDocType === type
                        ? 'bg-[#FF5A36] text-white border-[#FF5A36] shadow-xs'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div>
                <label className="border-2 border-dashed border-gray-200 hover:border-[#FF5A36]/60 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#FBFBFC]">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleUploadDoc}
                    className="hidden"
                    disabled={uploadingDoc}
                  />
                  {uploadingDoc ? (
                    <div className="text-center space-y-2">
                      <Loader2 className="w-8 h-8 animate-spin text-[#FF5A36] mx-auto" />
                      <p className="text-xs font-bold text-[#1E2229]">Uploading {uploadProgress}%</p>
                    </div>
                  ) : (
                    <div className="text-center space-y-2">
                      <Upload className="w-8 h-8 text-gray-300 mx-auto" />
                      <p className="text-xs font-bold text-[#1E2229]">Upload Document Photo</p>
                      <p className="text-[10px] text-gray-400 font-medium">JPG, PNG, or PDF up to 5MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Retake Quiz */}
        {(
          <div className="bg-gradient-to-br from-[#FFF2EB] to-[#FBFBFC] border border-[#FF5A36]/20 rounded-3xl p-6 text-center shadow-xs">
            <h2 className="font-serif font-medium text-lg text-[#1E2229] mb-1.5">Update Your Compatibility Profile</h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 max-w-md mx-auto">Changed your habits or preferences? Retake the quiz to get better roommate matches.</p>
            <button
              onClick={handleRetakeQuiz}
              disabled={retaking}
              className="rounded-full border border-[#FF5A36] text-[#FF5A36] hover:bg-[#FF5A36] hover:text-white font-semibold text-xs sm:text-sm py-2.5 px-5 transition-all shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              {retaking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Retake Compatibility Quiz
            </button>
          </div>
        )}

        {/* Bottom Save Changes CTA */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-[#FF5A36] hover:bg-[#E54E2B] active:scale-[0.98] text-white font-semibold text-sm sm:text-base w-full py-3.5 flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}
