import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useListings } from '@/hooks/useListings';
import { useStorage } from '@/hooks/useStorage';
import { resolveEntityCoordinates } from '@/lib/locationResolver';
import { cities, localitiesByCity, flatTypes, furnishingTypes, amenitiesList, houseRulesList } from '@/lib/staticData';
import {
  ArrowLeft, Save, Trash2, ToggleLeft, ToggleRight, Loader2,
  AlertTriangle, Upload, X, Image as ImageIcon, ShieldAlert, Sparkles,
  MapPin, Home, CheckCircle2, Check
} from 'lucide-react';
import OwnerVerificationGate from '@/components/OwnerVerificationGate';
import { subscribeToOwnerVerification, type OwnerVerification } from '@/lib/ownerVerification';
import { CURATED_SCREENING_QUESTIONS, type ScreeningQuestion } from '@/lib/screeningQuestions';

export default function EditListing() {
  const { id } = useParams<{ id: string }>();
  // Sprint 2E: id === 'new' means "create a listing" — an already-onboarded
  // owner can publish directly without re-running the onboarding wizard.
  const isNew = id === 'new';
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { getListingById, updateListing, deleteListing, createListing } = useListings();
  const { uploadListingImages } = useStorage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ownerVerified, setOwnerVerified] = useState<boolean | undefined>(undefined);
  const [ownerVerification, setOwnerVerification] = useState<OwnerVerification | null>(null);

  // Photo management state
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    flatType: '',
    furnishing: '',
    city: '',
    locality: '',
    monthlyRent: 0,
    deposit: 0,
    partnersNeeded: 1,
    availableFrom: '',
    genderPreference: 'any',
    amenities: [] as string[],
    houseRules: [] as string[],
    screeningQuestions: [] as ScreeningQuestion[],
    status: 'active' as 'active' | 'paused' | 'filled' | 'closed' | 'pending_verification' | 'draft',
  });

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToOwnerVerification(user.uid, setOwnerVerification);
    return unsub;
  }, [user?.uid]);

  // Dynamic document title
  useEffect(() => {
    document.title = isNew ? 'Create Listing | NestMate' : `${form.title ? form.title + ' — Edit' : 'Edit Listing'} | NestMate`;
  }, [isNew, form.title]);

  // Escape key and scroll lock for Delete Confirmation Modal
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDeleteConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (!id) return;
    if (isNew) {
      if (location.state && (location.state as any).prefill) {
        const p = (location.state as any).prefill;
        setForm(prev => ({
          ...prev,
          city: p.city || prev.city,
          locality: p.locality || prev.locality,
          flatType: p.flatType || prev.flatType,
          furnishing: p.furnishing || prev.furnishing,
          monthlyRent: p.monthlyRent || prev.monthlyRent,
          deposit: p.deposit || prev.deposit,
          availableFrom: p.availableFrom || prev.availableFrom,
          amenities: p.amenities || prev.amenities,
          houseRules: p.houseRules || prev.houseRules,
        }));
      }
      setLoading(false);
      return;
    }
    getListingById(id).then((result) => {
      if (!result || !result.listing) {
        setError('Listing not found');
        setLoading(false);
        return;
      }
      const listing = result.listing;
      if (listing.ownerId !== user?.uid) {
        setError('You do not own this listing');
        setLoading(false);
        return;
      }
      setForm({
        title: listing.title || '',
        description: listing.description || '',
        flatType: listing.flatType || '',
        furnishing: listing.furnishing || '',
        city: listing.city || '',
        locality: listing.locality || '',
        monthlyRent: (listing as any).monthlyRent || listing.totalRent || 0,
        deposit: listing.deposit || 0,
        partnersNeeded: (listing as any).partnersNeeded || 1,
        availableFrom: listing.availableFrom || '',
        genderPreference: (listing as any).genderPreference || (listing as any).preferredGender || 'any',
        amenities: listing.amenities || [],
        houseRules: listing.houseRules || [],
        screeningQuestions: (listing as any).screeningQuestions || [],
        status: listing.status || 'active',
      });
      setOwnerVerified(listing.ownerVerified);
      setExistingImages(listing.images || []);
      setLoading(false);
    });
  }, [id, user?.uid, isNew, location.state]);

  const handleSave = async () => {
    if (!id || !user?.uid) return;

    const effectiveLocality = form.locality || (localitiesByCity[form.city] || [])[0] || '';
    // Sprint 2E: required-field validation before any write for new listings
    if (isNew && (!form.title.trim() || !form.city || !effectiveLocality || !(form.monthlyRent > 0))) {
      setError('Please fill in title, city, locality and monthly rent.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const { monthlyRent, ...restForm } = form;
      const share = Math.round(monthlyRent / (form.partnersNeeded + 1));
      const finalLocality = form.locality || effectiveLocality;

      // Create first so we have a real listing id for image uploads
      let listingId = id;
      if (isNew) {
        listingId = await createListing(user.uid, {
          ...restForm,
          locality: finalLocality,
          totalRent: monthlyRent,
          partnerShare: share,
          images: [],
        } as any);
      }

      let finalImages = [...existingImages];

      // Upload new photos if any
      if (newFiles.length > 0) {
        setIsUploading(true);
        const uploadedUrls = await uploadListingImages(newFiles, listingId, (pct) => setUploadProgress(pct));
        finalImages = [...finalImages, ...uploadedUrls];
        setIsUploading(false);
      }

      const coords = resolveEntityCoordinates({
        id: listingId,
        city: form.city,
        locality: form.locality,
      });

      // Security: unverified owner cannot update status to active
      const isApproved = ownerVerified === true || ownerVerification?.status === 'APPROVED';
      const safeStatus = !isApproved
        ? (form.status === 'paused' ? 'paused' : 'pending_verification')
        : form.status;

      await updateListing(listingId, {
        ...(isNew ? {} : { ...restForm, status: safeStatus }),
        totalRent: monthlyRent,
        partnerShare: share,
        images: finalImages,
        ...(coords && { lat: coords.lat, lng: coords.lng }),
      } as any);
      setSuccess(isNew ? 'Listing created! Identity verification required before it goes live.' : 'Listing updated successfully!');
      setTimeout(() => navigate('/owner-dashboard'), 1600);
    } catch (err: any) {
      setError(err.message || 'Failed to save listing');
    } finally {
      setSaving(false);
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    setSaving(true);
    try {
      await deleteListing(id);
      navigate('/owner-dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
      setSaving(false);
    }
  };

  const isPendingVerification = form.status === 'pending_verification' || ownerVerified === false;

  const toggleStatus = async () => {
    if (isPendingVerification) return;
    const next = form.status === 'active' ? 'paused' : 'active';
    setForm({ ...form, status: next });
    // Never write to the placeholder 'new' id — status persists on save
    if (id && !isNew) {
      await updateListing(id, { status: next } as any);
    }
  };

  const toggleAmenity = (a: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter(x => x !== a)
        : [...prev.amenities, a],
    }));
  };

  const toggleHouseRule = (r: string) => {
    setForm(prev => ({
      ...prev,
      houseRules: prev.houseRules.includes(r)
        ? prev.houseRules.filter(x => x !== r)
        : [...prev.houseRules, r],
    }));
  };

  const toggleScreeningQuestion = (q: ScreeningQuestion) => {
    setForm(prev => ({
      ...prev,
      screeningQuestions: prev.screeningQuestions.some(existing => existing.id === q.id)
        ? prev.screeningQuestions.filter(existing => existing.id !== q.id)
        : [...prev.screeningQuestions, q],
    }));
  };

  // Photo management handlers
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const totalPhotos = existingImages.length + newFiles.length + files.length;
      if (totalPhotos > 10) {
        setError('Maximum 10 photos allowed');
        return;
      }
      setNewFiles(prev => [...prev, ...files]);
      const previews = files.map(f => URL.createObjectURL(f));
      setNewPreviews(prev => [...prev, ...previews]);
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeNewPhoto = (index: number) => {
    URL.revokeObjectURL(newPreviews[index]);
    setNewFiles(prev => prev.filter((_, i) => i !== index));
    setNewPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const totalPhotos = existingImages.length + newFiles.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-[#E5501A]" />
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Loading listing details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBF9F6] pb-28 md:pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6">

        {/* Top bar with back and status toggle */}
        <div className="flex items-center justify-between gap-2.5 mb-6 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => navigate('/owner-dashboard')}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-gray-600 hover:text-[#1A1A2E] bg-white px-3.5 sm:px-4 py-2 rounded-full border border-gray-200/80 shadow-2xs hover:shadow-xs transition-all shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> <span>Dashboard<span className="hidden sm:inline"> / Portfolio</span></span>
          </button>

          {!isNew && (
            <button
              onClick={toggleStatus}
              disabled={isPendingVerification}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-full text-xs font-semibold transition-all shadow-2xs ${
                isPendingVerification
                  ? 'bg-amber-50 text-amber-800 border border-amber-200/80 cursor-not-allowed'
                  : form.status === 'active'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}
              title={isPendingVerification ? 'Listing is held pending identity verification' : undefined}
            >
              {isPendingVerification ? (
                <><ShieldAlert className="w-4 h-4 text-amber-600" /> Pending Verification</>
              ) : form.status === 'active' ? (
                <><ToggleRight className="w-4 h-4 text-emerald-600" /> Listing Active</>
              ) : (
                <><ToggleLeft className="w-4 h-4 text-gray-400" /> Listing Paused</>
              )}
            </button>
          )}
        </div>

        {/* Page Title */}
        <div className="mb-6">
          <h1 className="font-serif font-medium text-3xl sm:text-4xl text-[#1A1A2E]">
            {isNew ? 'Create New Property' : 'Edit Property Details'}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {isNew ? 'List a room or flat to start receiving verified tenant applications.' : 'Keep your room photos, pricing, and house rules up to date.'}
          </p>
        </div>

        {/* Gate if unverified */}
        {isPendingVerification && ownerVerification?.status !== 'APPROVED' && (
          <div className="mb-6">
            <OwnerVerificationGate listingTitle={form.title || 'Your Listing'} />
          </div>
        )}

        {/* Feedback alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6 text-sm flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 mb-6 text-sm flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Form Content */}
        <div className="space-y-6">

          {/* Photos Section */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-4 sm:p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div>
                <h3 className="font-serif font-medium text-lg sm:text-xl text-[#1A1A2E] flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-[#FFF2EB] text-[#E5501A] flex items-center justify-center text-sm shrink-0">
                    <ImageIcon className="w-4 h-4" />
                  </span>
                  Room & Property Photos
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 sm:ml-10.5">High-quality photos receive 3x more match inquiries ({totalPhotos}/10)</p>
              </div>

              {totalPhotos < 10 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-[#E5501A] font-semibold hover:text-[#D0400B] transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFF2EB] border border-[#E5501A]/20 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" /> Add Photos
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {totalPhotos === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-12 border-2 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#E5501A]/60 hover:bg-[#FFF2EB]/20 transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-100 group-hover:bg-[#FFF2EB] flex items-center justify-center text-gray-400 group-hover:text-[#E5501A] transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[#1A1A2E]">Upload room and living area photos</p>
                  <p className="text-xs text-gray-400 mt-0.5">JPG or PNG up to 5MB each • Up to 10 photos</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Existing uploaded images */}
                {existingImages.map((url, i) => (
                  <div key={`existing-${i}`} className="relative group aspect-square rounded-2xl overflow-hidden border border-gray-200 shadow-2xs">
                    <img src={url} alt={`Room photo ${i + 1}`} className="w-full h-full object-cover" />
                    {i === 0 && (
                      <span className="absolute top-2 left-2 px-2.5 py-0.5 bg-[#E5501A] text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-xs">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeExistingImage(i)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* New photo previews */}
                {newPreviews.map((url, i) => (
                  <div key={`new-${i}`} className="relative group aspect-square rounded-2xl overflow-hidden border-2 border-[#E5501A]/40 shadow-2xs">
                    <img src={url} alt={`New upload ${i + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-[#E5501A] text-white text-[10px] font-bold rounded-full">
                      New
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewPhoto(i)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Add more tile */}
                {totalPhotos < 10 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#E5501A]/50 flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-[#FFF2EB]/30 group"
                  >
                    <Upload className="w-5 h-5 text-gray-400 group-hover:text-[#E5501A] transition-colors" />
                    <span className="text-xs font-semibold text-gray-500 group-hover:text-[#E5501A]">Add More</span>
                  </button>
                )}
              </div>
            )}

            {isUploading && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>Uploading photos...</span>
                  <span className="text-[#E5501A] font-bold">{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E5501A] rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Basic Details */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 md:p-8 space-y-5">
            <h3 className="font-serif font-medium text-xl text-[#1A1A2E] flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-[#FFF2EB] text-[#E5501A] flex items-center justify-center text-sm">
                <Home className="w-4 h-4" />
              </span>
              Basic Details
            </h3>

            <div>
              <label htmlFor="listing-title" className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                Listing Title *
              </label>
              <input
                id="listing-title"
                type="text"
                placeholder="e.g. Sunny Private Room in 2BHK with Balcony"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[#1A1A2E] placeholder:text-gray-400 focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                Description & Highlights
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Describe your flat, vibe, proximity to tech parks or metro stations, and living preferences..."
                rows={4}
                className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl p-4 text-sm text-[#1A1A2E] placeholder:text-gray-400 focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-medium resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                  Flat Configuration *
                </label>
                <select
                  value={form.flatType}
                  onChange={e => setForm({ ...form, flatType: e.target.value })}
                  className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-medium"
                >
                  <option value="">Select Configuration</option>
                  {flatTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                  Furnishing Status *
                </label>
                <select
                  value={form.furnishing}
                  onChange={e => setForm({ ...form, furnishing: e.target.value })}
                  className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-medium"
                >
                  <option value="">Select Furnishing</option>
                  {furnishingTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Location & Pricing */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 md:p-8 space-y-5">
            <h3 className="font-serif font-medium text-xl text-[#1A1A2E] flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-[#FFF2EB] text-[#E5501A] flex items-center justify-center text-sm">
                <MapPin className="w-4 h-4" />
              </span>
              Location & Pricing
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                  City *
                </label>
                <select
                  value={form.city}
                  onChange={e => {
                    const newCity = e.target.value;
                    setForm({ ...form, city: newCity });
                  }}
                  className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-medium"
                >
                  <option value="">Select City</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                  Locality / Neighborhood *
                </label>
                <div className="relative flex items-center bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[#1A1A2E] focus-within:border-[#E5501A] focus-within:ring-2 focus-within:ring-[#E5501A]/10 transition-all font-medium">
                  <MapPin className="w-4 h-4 text-[#E5501A] shrink-0 mr-2.5" />
                  <input
                    type="text"
                    value={form.locality}
                    onChange={e => setForm({ ...form, locality: e.target.value })}
                    placeholder={
                      form.city === 'Hyderabad'
                        ? 'e.g. Hitech City'
                        : form.city === 'Bengaluru'
                        ? 'e.g. Koramangala'
                        : form.city === 'Mumbai'
                        ? 'e.g. Bandra West'
                        : form.city === 'Delhi NCR'
                        ? 'e.g. Cyber City'
                        : form.city === 'Pune'
                        ? 'e.g. Hinjewadi'
                        : form.city === 'Chennai'
                        ? 'e.g. Anna Nagar'
                        : 'e.g. Locality name'
                    }
                    className="w-full bg-transparent outline-none placeholder:text-gray-400 text-sm font-medium"
                  />
                  {form.locality && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, locality: '' })}
                      className="text-gray-400 hover:text-gray-600 p-0.5 ml-1.5 transition-colors cursor-pointer"
                      title="Clear"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {(localitiesByCity[form.city] || []).length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mr-0.5">
                      Popular:
                    </span>
                    {(localitiesByCity[form.city] || []).slice(0, 5).map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setForm({ ...form, locality: loc })}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                          form.locality === loc
                            ? 'bg-[#FFF2EB] text-[#E5501A] border-[#E5501A]/40 font-bold'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                  Monthly Rent (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                  <input
                    type="number"
                    value={form.monthlyRent || ''}
                    placeholder="18000"
                    onChange={e => setForm({ ...form, monthlyRent: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl pl-8 pr-4 py-3 text-sm text-[#1A1A2E] placeholder:text-gray-400 focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                  Security Deposit (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₹</span>
                  <input
                    type="number"
                    value={form.deposit || ''}
                    placeholder="36000"
                    onChange={e => setForm({ ...form, deposit: parseInt(e.target.value) || 0 })}
                    className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl pl-8 pr-4 py-3 text-sm text-[#1A1A2E] placeholder:text-gray-400 focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                  Roommates Needed
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={form.partnersNeeded}
                  onChange={e => setForm({ ...form, partnersNeeded: parseInt(e.target.value) || 1 })}
                  className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                  Available From
                </label>
                <input
                  type="date"
                  value={form.availableFrom}
                  onChange={e => setForm({ ...form, availableFrom: e.target.value })}
                  className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#1A1A2E] uppercase tracking-wider block mb-2">
                  Gender Preference
                </label>
                <select
                  value={form.genderPreference}
                  onChange={e => setForm({ ...form, genderPreference: e.target.value })}
                  className="w-full bg-gray-50/80 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-[#1A1A2E] focus:outline-none focus:border-[#E5501A] focus:ring-2 focus:ring-[#E5501A]/10 transition-all font-medium"
                >
                  <option value="any">Any Gender</option>
                  <option value="female">Female Only</option>
                  <option value="male">Male Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Amenities Section */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 md:p-8 space-y-4">
            <h3 className="font-serif font-medium text-xl text-[#1A1A2E]">Amenities & Inclusions</h3>
            <p className="text-xs text-gray-500">Tap to select all facilities available to prospective roommates.</p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              {amenitiesList.map(a => {
                const isSelected = form.amenities.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmenity(a)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-[#FFF2EB] text-[#E5501A] border-[#E5501A]/40 shadow-2xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#E5501A]/30'
                    }`}
                  >
                    {isSelected && <span className="mr-1.5">✓</span>}
                    {a}
                  </button>
                );
              })}
            </div>
          </div>

          {/* House Rules & Compatibility */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 md:p-8 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-serif font-medium text-xl text-[#1A1A2E]">House Rules & Living Norms</h3>
                <span className="text-[11px] bg-emerald-50 text-emerald-800 px-3 py-0.5 rounded-full font-bold border border-emerald-200">
                  Powers AI Compatibility
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Seekers with matching lifestyle norms will receive high compatibility scores on your listing.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {houseRulesList.map(rule => {
                const isSelected = form.houseRules.includes(rule);
                return (
                  <button
                    key={rule}
                    type="button"
                    onClick={() => toggleHouseRule(rule)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-[#E5501A] text-white border-[#E5501A] shadow-2xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {rule}
                  </button>
                );
              })}
            </div>

            <div className="bg-[#FFF2EB]/70 border border-[#E5501A]/15 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-[#E5501A] shrink-0 mt-0.5" />
              <div className="text-xs text-[#1A1A2E]/80 leading-relaxed">
                <span className="font-semibold text-[#1A1A2E] block mb-0.5">Smart Match Intelligence</span>
                Seekers looking in <span className="font-medium text-[#1A1A2E]">{form.city || 'your city'}</span> with a budget fitting ₹{form.monthlyRent ? form.monthlyRent.toLocaleString() : '0'}/mo and matching your norms will be highlighted as top tier applicants.
              </div>
            </div>
          </div>

          {/* Screening Questions Section */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 md:p-8 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-serif font-medium text-xl text-[#1A1A2E]">Screening Questions for Inquiries</h3>
                <span className="text-[11px] bg-orange-50 text-[#E5501A] px-3 py-0.5 rounded-full font-bold border border-orange-200">
                  {form.screeningQuestions.length} Selected
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Choose the questions seekers must answer when expressing interest in this property.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {CURATED_SCREENING_QUESTIONS.map(q => {
                const isSelected = form.screeningQuestions.some(sq => sq.id === q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => toggleScreeningQuestion(q)}
                    className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'border-[#E5501A] bg-orange-50/40 shadow-xs'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
                        {q.type.replace('_', ' ')}
                      </span>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-[#E5501A] bg-[#E5501A] text-white' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                    <p className="text-xs font-bold text-[#1A1A2E] leading-snug">
                      {q.title}
                    </p>
                    {q.description && (
                      <p className="text-[11px] text-gray-500 line-clamp-2">
                        {q.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Action Buttons (Desktop / Tablet) */}
          <div className="hidden md:flex gap-4 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || isUploading}
              className="flex-1 py-4 bg-[#E5501A] text-white rounded-full font-semibold text-sm hover:bg-[#D0400B] active:scale-[0.98] transition-all shadow-sm shadow-[#E5501A]/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving || isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {isUploading ? `Uploading Photos (${uploadProgress}%)...` : isNew ? 'Publish Property' : 'Save Changes'}
            </button>

            {!isNew && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-6 py-4 border border-red-200 text-red-600 rounded-full font-semibold text-sm hover:bg-red-50 active:scale-[0.98] transition-all flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
          </div>

        </div>

        {/* Sticky Mobile Bottom Bar (< 768px) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-3.5 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-40 flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isUploading}
            className="flex-1 py-3 bg-[#E5501A] text-white rounded-full font-bold text-xs hover:bg-[#D0400B] active:scale-[0.98] transition-all shadow-sm shadow-[#E5501A]/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving || isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isUploading ? `Uploading (${uploadProgress}%)...` : isNew ? 'Publish Property' : 'Save Changes'}</span>
          </button>

          {!isNew && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-3 border border-red-200 text-red-600 rounded-full font-semibold text-xs hover:bg-red-50 active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Delete property"
              title="Delete property"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div
            onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          >
            <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-100 shadow-xl space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-serif font-medium text-xl text-[#1A1A2E]">Delete Property Listing?</h3>
                  <p className="text-xs text-gray-500 mt-0.5">This action permanently unlists your room.</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed font-sans">
                Are you sure you want to delete <strong className="text-[#1A1A2E]">{form.title || 'this listing'}</strong>? All active applicant threads and bookmarks for this property will be archived.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  Keep Listing
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-1 py-3 bg-red-600 text-white rounded-full text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
