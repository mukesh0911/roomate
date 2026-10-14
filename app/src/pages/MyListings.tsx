import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useListings, type Listing } from '@/hooks/useListings';
import {
  Building2, Home, Plus, Eye, Edit3, Pause, Play, Trash2,
  MapPin, Shield, ShieldCheck, CheckCircle2, AlertTriangle,
  Loader2, MessageCircle, RefreshCw, Sparkles, ExternalLink
} from 'lucide-react';
import { subscribeToOwnerVerification, type OwnerVerification } from '@/lib/ownerVerification';
import { getAvailabilityState, getFreshnessAnchorMs, formatRelativeDays } from '@/lib/listingFreshness';
import OwnerVerificationGate from '@/components/OwnerVerificationGate';

export default function MyListings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getMyListings, updateListing, deleteListing, confirmAvailability, closeListing } = useListings();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionListingId, setActionListingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Listing | null>(null);
  const [ownerVerification, setOwnerVerification] = useState<OwnerVerification | null>(null);

  useEffect(() => {
    document.title = 'My Listings | NestMate';
  }, []);

  // Subscribe to owner verification
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToOwnerVerification(user.uid, setOwnerVerification);
    return unsub;
  }, [user?.uid]);

  // Load user listings
  const loadListings = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const items = await getMyListings(user.uid);
      setListings(items || []);
    } catch (err) {
      console.error('Failed to load listings:', err);
    } finally {
      setLoading(false);
    }
  }, [getMyListings, user?.uid]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  // Toggle active/paused status
  const handleToggleStatus = async (listing: Listing) => {
    if (listing.status === 'pending_verification' || listing.ownerVerified === false) return;
    const nextStatus = listing.status === 'active' ? 'paused' : 'active';
    setActionListingId(listing.id);
    try {
      await updateListing(listing.id, { status: nextStatus } as any);
      setListings(prev => prev.map(l => l.id === listing.id ? { ...l, status: nextStatus } : l));
    } catch (err) {
      console.error('Failed to toggle status:', err);
    } finally {
      setActionListingId(null);
    }
  };

  // Confirm availability freshness
  const handleConfirmAvailability = async (listingId: string) => {
    setActionListingId(listingId);
    try {
      await confirmAvailability(listingId);
      await loadListings();
    } catch (err) {
      console.error('Failed to confirm availability:', err);
    } finally {
      setActionListingId(null);
    }
  };

  // Delete listing
  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setActionListingId(showDeleteConfirm.id);
    try {
      await deleteListing(showDeleteConfirm.id);
      setListings(prev => prev.filter(l => l.id !== showDeleteConfirm.id));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete listing:', err);
    } finally {
      setActionListingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] pb-24 md:pb-16 pt-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-gray-100 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl sm:text-3xl font-medium text-[#1E2229]">
                My Room Listings
              </h1>
              {listings.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFF2EB] text-[#FF5A36] border border-[#FF5A36]/20">
                  {listings.length} {listings.length === 1 ? 'Room' : 'Rooms'}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              Manage your posted rooms, availability status, and tenant inquiries.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/edit-listing/new')}
            className="self-start sm:self-auto px-5 py-2.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs sm:text-sm font-bold rounded-full transition-all shadow-sm shadow-[#FF5A36]/20 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Post a Room</span>
          </button>
        </div>

        {/* Verification Alert (if any listing requires verification) */}
        {listings.some(l => l.status === 'pending_verification' || l.ownerVerified === false) && ownerVerification?.status !== 'APPROVED' && (
          <div className="mb-8">
            <OwnerVerificationGate listingTitle="Your Room Listing" />
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF5A36]" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Loading your rooms...</p>
          </div>
        ) : listings.length === 0 ? (
          /* Clean Empty State */
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-gray-150 shadow-xs text-center max-w-xl mx-auto my-6 space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-[#FFF2EB] text-[#FF5A36] flex items-center justify-center mx-auto shadow-xs">
              <Home className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-2xl font-medium text-[#1E2229]">
                You haven't listed any rooms yet
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-md mx-auto">
                Have an available room or looking for a compatible flatmate? Post your space in under 3 minutes and start receiving verified inquiries.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/edit-listing/new')}
                className="px-6 py-3.5 bg-[#FF5A36] hover:bg-[#E54E2B] text-white text-xs sm:text-sm font-bold rounded-full transition-all shadow-sm shadow-[#FF5A36]/20 inline-flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Post a Room Now</span>
              </button>
            </div>
          </div>
        ) : (
          /* Listings Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {listings.map(listing => {
              const availState = getAvailabilityState(listing);
              const confirmedAgo = formatRelativeDays(getFreshnessAnchorMs(listing));
              const isPending = listing.status === 'pending_verification' || listing.ownerVerified === false;
              const isActioning = actionListingId === listing.id;

              return (
                <div
                  key={listing.id}
                  className="bg-white rounded-3xl border border-gray-150 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Card Media & Badges */}
                  <div>
                    <div className="relative aspect-video bg-gray-100 overflow-hidden">
                      {listing.images && listing.images.length > 0 ? (
                        <img
                          src={listing.images[0]}
                          alt={listing.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#1E2229] flex flex-col items-center justify-center text-white gap-2">
                          <Home className="w-8 h-8 text-[#FF5A36]" />
                          <span className="text-xs font-bold text-gray-400">NestMate Property</span>
                        </div>
                      )}

                      {/* Status Badges Overlay */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-md shadow-xs ${
                          isPending
                            ? 'bg-amber-500/80 text-white'
                            : listing.status === 'active'
                              ? 'bg-emerald-600/85 text-white'
                              : 'bg-black/60 text-white'
                        }`}>
                          {isPending ? 'PENDING VERIFICATION' : listing.status === 'active' ? '● LIVE' : 'PAUSED'}
                        </span>
                        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/90 text-[#1E2229] backdrop-blur-md shadow-xs">
                          {listing.flatType || 'Flat Share'}
                        </span>
                      </div>

                      {/* Views Count */}
                      <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full text-xs font-semibold bg-black/60 text-white backdrop-blur-md">
                        {listing.views || 0} Views
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 sm:p-6 space-y-4">
                      <div>
                        <h3 className="font-bold text-lg text-[#1E2229] truncate">
                          {listing.title || `${listing.locality} Flat`}
                        </h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-[#FF5A36] shrink-0" />
                          <span>{listing.locality}, {listing.city}</span>
                        </p>
                      </div>

                      <div className="flex items-baseline justify-between pt-1 border-t border-gray-100">
                        <div>
                          <p className="font-serif text-2xl font-bold text-[#FF5A36]">
                            ₹{listing.totalRent?.toLocaleString() || '0'}
                            <span className="text-xs font-normal text-gray-500"> / month</span>
                          </p>
                          {listing.deposit ? (
                            <p className="text-[11px] text-gray-400 mt-0.5">Deposit: ₹{listing.deposit.toLocaleString()}</p>
                          ) : null}
                        </div>

                        {/* Availability Freshness Pill */}
                        <div className="text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            availState === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                          }`}>
                            {availState === 'available' ? `Available · ${confirmedAgo}` : 'Needs Confirmation'}
                          </span>
                        </div>
                      </div>

                      {/* Confirm Availability Quick Action */}
                      {availState !== 'closed' && (
                        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#FBFBFC] border border-gray-150 text-xs">
                          <span className="text-gray-500 text-[11px]">Keep listing active in search</span>
                          <button
                            type="button"
                            onClick={() => handleConfirmAvailability(listing.id)}
                            disabled={isActioning}
                            className="px-3 py-1 bg-white hover:bg-gray-50 text-[#1E2229] font-bold text-[11px] rounded-full border border-gray-200 shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                          >
                            <RefreshCw className={`w-3 h-3 text-[#FF5A36] ${isActioning ? 'animate-spin' : ''}`} />
                            <span>Confirm Available</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Action Bar */}
                  <div className="p-4 sm:p-5 border-t border-gray-100 bg-[#FBFBFC] flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {/* View Public Listing */}
                      <button
                        type="button"
                        onClick={() => navigate(`/room/${listing.id}`)}
                        className="px-3.5 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-full border border-gray-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                        title="View how seekers see this room"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#FF5A36]" />
                        <span>View</span>
                      </button>

                      {/* Edit Listing */}
                      <button
                        type="button"
                        onClick={() => navigate(`/edit-listing/${listing.id}`)}
                        className="px-3.5 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-full border border-gray-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Edit photos, rent, or amenities"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Edit</span>
                      </button>

                      {/* Pause / Resume */}
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(listing)}
                        disabled={isPending || isActioning}
                        className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-full border border-gray-200 shadow-2xs transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
                        title={listing.status === 'active' ? 'Pause Listing' : 'Resume Listing'}
                      >
                        {listing.status === 'active' ? (
                          <><Pause className="w-3 h-3 text-amber-600" /> <span>Pause</span></>
                        ) : (
                          <><Play className="w-3 h-3 text-emerald-600" /> <span>Resume</span></>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Inquiries / Messages */}
                      <button
                        type="button"
                        onClick={() => navigate('/chat')}
                        className="p-2 text-gray-500 hover:text-[#FF5A36] hover:bg-white rounded-full transition-all cursor-pointer"
                        title="View tenant inquiries in Messages"
                        aria-label="Messages"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(listing)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                        title="Delete listing"
                        aria-label="Delete listing"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(null); }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-gray-100 shadow-xl space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-xl text-[#1E2229]">Delete Room Listing?</h3>
                <p className="text-xs text-gray-500 mt-0.5">This action permanently unlists your room.</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed font-sans">
              Are you sure you want to delete <strong className="text-[#1E2229]">{showDeleteConfirm.title || 'this listing'}</strong>? All active inquiries and saved bookmarks will be archived.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 py-3 border border-gray-200 rounded-full text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all cursor-pointer"
              >
                Keep Listing
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!!actionListingId}
                className="flex-1 py-3 bg-red-600 text-white rounded-full text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {actionListingId ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
