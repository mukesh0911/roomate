import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';
import {
  Search, Loader2, Trash2, Eye, X, ChevronLeft, ChevronRight,
  ExternalLink, Home, MapPin, CheckCircle2, PauseCircle, CheckCircle,
  AlertTriangle, Image as ImageIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';

const PAGE_SIZE = 20;

interface ListingRow {
  id: string;
  ownerName: string;
  ownerId?: string;
  city: string;
  locality: string;
  flatType: string;
  totalRent: number;
  partnerShare: number;
  status: string;
  views: number;
  applicants: number;
  images: string[];
  title: string;
  description: string;
  amenities: string[];
  createdAt?: any;
  [key: string]: unknown;
}

export default function AdminListings() {
  const { getAllListings, deleteListing, updateListingStatus } = useAdmin();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'rent_asc' | 'rent_desc' | 'views'>('newest');
  const [detail, setDetail] = useState<ListingRow | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState(false);

  // Deletion modal
  const [deleteTarget, setDeleteTarget] = useState<ListingRow | null>(null);

  const fetchListings = useCallback(async () => {
    try {
      const l = await getAllListings();
      setListings(l as ListingRow[]);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load listings');
    } finally {
      setLoading(false);
    }
  }, [getAllListings]);

  useEffect(() => {
    document.title = 'Listings Directory | NestMate Admin';
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Escape key and body scroll lock for detail modal and deleteTarget modal
  useEffect(() => {
    if (!detail && !deleteTarget) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteTarget) {
          setDeleteTarget(null);
        } else if (detail) {
          setDetail(null);
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
  }, [detail, deleteTarget]);

  const filtered = useMemo(() => {
    let r = listings;
    if (search.trim()) {
      const s = search.toLowerCase().trim();
      r = r.filter(l =>
        l.ownerName?.toLowerCase().includes(s) ||
        l.city?.toLowerCase().includes(s) ||
        l.locality?.toLowerCase().includes(s) ||
        l.title?.toLowerCase().includes(s) ||
        l.id.toLowerCase().includes(s)
      );
    }
    if (statusFilter !== 'all') {
      r = r.filter(l => l.status === statusFilter);
    }

    return [...r].sort((a, b) => {
      if (sortBy === 'newest') {
        const ta = (a.createdAt as any)?.toMillis?.() || (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
        const tb = (b.createdAt as any)?.toMillis?.() || (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
        return tb - ta;
      }
      if (sortBy === 'rent_asc') {
        const ra = a.partnerShare || a.totalRent || 0;
        const rb = b.partnerShare || b.totalRent || 0;
        return ra - rb;
      }
      if (sortBy === 'rent_desc') {
        const ra = a.partnerShare || a.totalRent || 0;
        const rb = b.partnerShare || b.totalRent || 0;
        return rb - ra;
      }
      if (sortBy === 'views') {
        return (b.views || 0) - (a.views || 0);
      }
      return 0;
    });
  }, [listings, search, statusFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedListings = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteListing(deleteTarget.id);
      setListings(prev => prev.filter(l => l.id !== deleteTarget.id));
      if (detail?.id === deleteTarget.id) setDetail(null);
      setDeleteTarget(null);
      toast.success('Listing permanently deleted');
    } catch {
      toast.error('Failed to delete listing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!detail) return;
    setActionLoading(true);
    try {
      await updateListingStatus(detail.id, newStatus);
      setListings(prev => prev.map(l => l.id === detail.id ? { ...l, status: newStatus } : l));
      setDetail(prev => prev ? { ...prev, status: newStatus } : null);
      toast.success(`Listing status updated to ${newStatus}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 text-fire animate-spin" />
        <p className="text-sm text-slate-400">Loading listings database...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header & Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Listings Directory</h2>
            <p className="text-xs text-slate-500">Monitor room inventory, rental rates, view statistics, and moderation state.</p>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            {filtered.length} Listings
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search owner, city, locality, title..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-fire transition-colors"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-fire">
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="paused">Paused</option>
            <option value="filled">Filled / Occupied</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-fire">
            <option value="newest">Sort: Newest First</option>
            <option value="rent_asc">Sort: Rent (Low to High)</option>
            <option value="rent_desc">Sort: Rent (High to Low)</option>
            <option value="views">Sort: Most Viewed</option>
          </select>
        </div>
      </div>

      {/* Listings Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Listing Title</th>
                <th className="px-4 py-3.5 hidden sm:table-cell">Owner</th>
                <th className="px-4 py-3.5 hidden md:table-cell">Location</th>
                <th className="px-4 py-3.5">Rent / Share</th>
                <th className="px-4 py-3.5 hidden lg:table-cell">Status</th>
                <th className="px-4 py-3.5 hidden lg:table-cell">Views</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedListings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No listings match the selected filters.
                  </td>
                </tr>
              ) : (
                pagedListings.map(l => (
                  <tr
                    key={l.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    onClick={() => { setDetail(l); setSelectedImageIdx(0); }}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {l.images?.[0] ? (
                            <img
                              src={l.images[0]}
                              className="w-full h-full object-cover"
                              alt=""
                              onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <Home className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-[180px]">{l.title || 'Untitled Room'}</p>
                          <p className="text-[11px] text-slate-400 capitalize">{l.flatType || 'Flat'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 hidden sm:table-cell">
                      <p className="truncate max-w-[130px] font-medium">{l.ownerName || 'Unknown Owner'}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 hidden md:table-cell">
                      <p className="truncate max-w-[140px] font-medium">{l.locality ? `${l.locality}, ${l.city}` : l.city}</p>
                    </td>
                    <td className="px-4 py-3.5 font-bold text-fire">
                      ₹{(l.partnerShare || l.totalRent || 0).toLocaleString()}
                      {l.partnerShare && <span className="text-[10px] text-slate-400 block font-normal">/person</span>}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        l.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        l.status === 'pending_verification' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        l.status === 'paused' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {l.status === 'pending_verification' ? 'Verification Pending' : l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 hidden lg:table-cell font-medium">
                      {l.views || 0}
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setDetail(l); setSelectedImageIdx(0); }}
                          className="text-xs text-fire font-semibold hover:text-orange-700 px-2 py-1">
                          Inspect
                        </button>
                        <button
                          onClick={() => setDeleteTarget(l)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          title="Delete Listing">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
              <span className="font-bold text-slate-800">{filtered.length}</span> listings
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

      {/* Listing Detail Modal */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setDetail(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="listing-detail-title"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 border border-slate-200 space-y-5"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  detail.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                  detail.status === 'pending_verification' ? 'bg-amber-100 text-amber-800' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {detail.status}
                </span>
                <h3 id="listing-detail-title" className="font-bold text-lg text-slate-900 mt-1">{detail.title || 'Untitled Listing'}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {detail.locality ? `${detail.locality}, ${detail.city}` : detail.city}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                aria-label="Close detail modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gallery Section */}
            {detail.images && detail.images.length > 0 ? (
              <div className="space-y-2">
                <div className="h-52 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative">
                  <img
                    src={detail.images[selectedImageIdx] || detail.images[0]}
                    className="w-full h-full object-cover"
                    alt=""
                    onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                  />
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md font-medium">
                    {selectedImageIdx + 1} of {detail.images.length}
                  </span>
                </div>
                {detail.images.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {detail.images.map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedImageIdx(i)}
                        className={`w-14 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                          selectedImageIdx === i ? 'border-fire ring-2 ring-fire/20' : 'border-slate-200 opacity-70 hover:opacity-100'
                        }`}>
                        <img
                          src={img}
                          className="w-full h-full object-cover"
                          alt=""
                          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-32 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                <ImageIcon className="w-7 h-7 mb-1 text-slate-300" />
                <p className="text-xs">No photos uploaded for this listing</p>
              </div>
            )}

            {/* Metrics and attributes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Total Rent</p>
                <p className="font-bold text-slate-900 mt-0.5">₹{detail.totalRent?.toLocaleString() || '—'}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Partner Share</p>
                <p className="font-bold text-fire mt-0.5">₹{detail.partnerShare?.toLocaleString() || '—'}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Flat Type</p>
                <p className="font-bold text-slate-900 mt-0.5">{detail.flatType || '—'}</p>
              </div>
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Views</p>
                <p className="font-bold text-slate-900 mt-0.5">{detail.views || 0}</p>
              </div>
            </div>

            {/* Owner & Description */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Owner</p>
                  <p className="font-bold text-slate-800">{detail.ownerName || 'Unknown'}</p>
                </div>
                <a
                  href={`/room/${detail.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:border-fire hover:text-fire transition-all">
                  <span>View Public Listing</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              {detail.description && (
                <div className="pt-2 border-t border-slate-200/60">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Description</p>
                  <p className="text-slate-600 leading-relaxed text-xs max-h-24 overflow-y-auto">{detail.description}</p>
                </div>
              )}
            </div>

            {/* Pending Verification Notice */}
            {detail.status === 'pending_verification' && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-900 font-bold">Awaiting Identity Verification</p>
                  <p className="text-[11px] text-amber-700">This room is invisible in explore tabs until the owner is approved.</p>
                </div>
                <Link
                  to="/admin/verifications"
                  className="text-xs font-bold px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors shrink-0">
                  Review Queue
                </Link>
              </div>
            )}

            {/* Admin Status Actions */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Override Status</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleStatusChange('active')}
                  disabled={actionLoading || detail.status === 'active'}
                  className="py-2 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-xs hover:bg-emerald-100 disabled:opacity-40 transition-colors">
                  Set Active
                </button>
                <button
                  onClick={() => handleStatusChange('paused')}
                  disabled={actionLoading || detail.status === 'paused'}
                  className="py-2 px-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 font-bold text-xs hover:bg-amber-100 disabled:opacity-40 transition-colors">
                  Set Paused
                </button>
                <button
                  onClick={() => handleStatusChange('filled')}
                  disabled={actionLoading || detail.status === 'filled'}
                  className="py-2 px-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 disabled:opacity-40 transition-colors">
                  Mark Filled
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styled Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-listing-title"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 id="delete-listing-title" className="text-base font-bold text-slate-900 mb-1">Delete Listing Permanently</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Are you sure you want to permanently delete "{deleteTarget.title || 'Untitled'}"? This action cannot be undone and will remove it from all searches.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
