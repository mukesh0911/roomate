import { useState, useEffect, useCallback } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Link } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Users, Home, MessageSquare, TrendingUp, ArrowUpRight, ArrowDownRight,
  Flag, ShieldCheck, Loader2, RefreshCw, AlertCircle, Sparkles
} from 'lucide-react';

interface Metrics {
  totalUsers: number;
  signupsToday: number;
  signupsYesterday: number;
  activeListings: number;
  totalListings: number;
  pendingListings?: number;
  totalChats: number;
  topCities: { city: string; count: number }[];
  dailySignups: { date: string; count: number }[];
  seekers: number;
  owners: number;
  pendingVerifications?: number;
  pendingReports?: number;
}

export default function AdminDashboard() {
  const { getMetrics } = useAdmin();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const m = await getMetrics();
      setMetrics(m);
    } catch (e) {
      console.error('Failed to load metrics:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getMetrics]);

  useEffect(() => {
    document.title = 'Admin Dashboard | NestMate';
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-9 h-9 text-fire animate-spin" />
        <p className="text-sm font-medium text-slate-400">Loading marketplace metrics...</p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-base font-semibold text-slate-700">Failed to load platform metrics.</p>
        <button
          type="button"
          onClick={() => fetchMetrics(true)}
          className="mt-4 px-4 py-2 bg-fire text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const signupTrend = metrics.signupsYesterday > 0
    ? Math.round(((metrics.signupsToday - metrics.signupsYesterday) / metrics.signupsYesterday) * 100)
    : metrics.signupsToday > 0 ? 100 : 0;

  const cards = [
    {
      label: 'New Signups Today',
      value: metrics.signupsToday,
      trend: signupTrend,
      icon: TrendingUp,
      color: 'bg-orange-50 text-fire',
      sub: `${metrics.signupsYesterday} yesterday`,
    },
    {
      label: 'Total Registered Users',
      value: metrics.totalUsers,
      sub: `${metrics.seekers} seekers · ${metrics.owners} owners`,
      icon: Users,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Active Listings',
      value: metrics.activeListings,
      sub: `${metrics.totalListings} total · ${metrics.pendingListings || 0} pending review`,
      icon: Home,
      color: 'bg-teal-50 text-teal-600',
    },
    {
      label: 'Active Chat Rooms',
      value: metrics.totalChats,
      sub: 'Peer-to-peer discussions',
      icon: MessageSquare,
      color: 'bg-indigo-50 text-indigo-600',
    },
  ];

  const totalPendingActionItems = (metrics.pendingVerifications || 0) + (metrics.pendingReports || 0) + (metrics.pendingListings || 0);

  return (
    <div className="space-y-6">
      {/* Top Header Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Platform Overview</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Real-time statistics across users, rooms, and moderation queues.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh Stats</span>
          </button>
        </div>
      </div>

      {/* Action Required Banner if pending items exist */}
      {totalPendingActionItems > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border border-amber-300/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {totalPendingActionItems} Item{totalPendingActionItems > 1 ? 's' : ''} Require Moderation Attention
              </p>
              <p className="text-xs text-amber-700/90 mt-0.5">
                {(metrics.pendingVerifications || 0)} verification{metrics.pendingVerifications !== 1 ? 's' : ''}, {(metrics.pendingReports || 0)} report{metrics.pendingReports !== 1 ? 's' : ''}, and {(metrics.pendingListings || 0)} unapproved listing{metrics.pendingListings !== 1 ? 's' : ''} are awaiting review.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(metrics.pendingVerifications || 0) > 0 && (
              <Link to="/admin/verifications" className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors">
                Review Verifications
              </Link>
            )}
            {(metrics.pendingReports || 0) > 0 && (
              <Link to="/admin/reports" className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors">
                Review Reports
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-slate-300 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center shadow-xs`}>
                  <Icon className="w-5 h-5" />
                </div>
                {'trend' in card && card.trend !== undefined && (
                  <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${card.trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                    {card.trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(card.trend)}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{card.value.toLocaleString()}</p>
              <p className="text-xs font-semibold text-slate-600 mt-1">{card.label}</p>
              {card.sub && <p className="text-[11px] text-slate-400 mt-0.5">{card.sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily Signups Chart */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Daily Signups (Last 30 Days)</h3>
              <p className="text-xs text-slate-400">Account creations per calendar day</p>
            </div>
            <span className="text-xs font-bold text-fire bg-orange-50 px-2.5 py-1 rounded-lg">
              {metrics.dailySignups.reduce((acc, d) => acc + d.count, 0)} Total
            </span>
          </div>
          <div className="h-[230px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.dailySignups} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748B' }} interval="preserveStartEnd" stroke="#E2E8F0" />
                <YAxis tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} stroke="#E2E8F0" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    fontSize: 12,
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Signups"
                  stroke="#FF5A36"
                  strokeWidth={2.5}
                  dot={{ r: 2, fill: '#FF5A36' }}
                  activeDot={{ r: 5, fill: '#FF5A36' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Cities Chart */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">User Distribution by City</h3>
              <p className="text-xs text-slate-400">Top locations by registered user density</p>
            </div>
          </div>
          <div className="h-[230px] w-full min-w-0">
            {metrics.topCities.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Sparkles className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-xs font-medium">No city distribution data yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Will populate as users complete profile onboarding</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.topCities} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="city" tick={{ fontSize: 10, fill: '#64748B' }} stroke="#E2E8F0" />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} stroke="#E2E8F0" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      fontSize: 12,
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Bar dataKey="count" name="Users" fill="#1E3A5F" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Moderation & Management Quick Action Hub */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Moderation Hub & Queues</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/admin/verifications" className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-amber-400 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              {(metrics.pendingVerifications ?? 0) > 0 ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {metrics.pendingVerifications} Pending
                </span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Clear
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-800 group-hover:text-fire transition-colors">Verifications Queue</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {(metrics.pendingVerifications ?? 0) > 0
                ? `${metrics.pendingVerifications} document(s) waiting for KYC review`
                : 'All identity proofs processed'}
            </p>
          </Link>

          <Link to="/admin/reports" className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-red-400 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <Flag className="w-5 h-5" />
              </div>
              {(metrics.pendingReports ?? 0) > 0 ? (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 animate-pulse">
                  {metrics.pendingReports} Open
                </span>
              ) : (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Clear
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-800 group-hover:text-fire transition-colors">User Reports</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {(metrics.pendingReports ?? 0) > 0
                ? `${metrics.pendingReports} report(s) need moderator resolution`
                : 'No open user reports'}
            </p>
          </Link>

          <Link to="/admin/listings" className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-teal-400 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Home className="w-5 h-5" />
              </div>
              {(metrics.pendingListings ?? 0) > 0 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {metrics.pendingListings} Pending
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-slate-800 group-hover:text-fire transition-colors">Listings Directory</p>
            <p className="text-xs text-slate-400 mt-0.5">{metrics.totalListings} total listings across all active cities</p>
          </Link>

          <Link to="/admin/users" className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition-all group">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-sm font-bold text-slate-800 group-hover:text-fire transition-colors">User Accounts</p>
            <p className="text-xs text-slate-400 mt-0.5">{metrics.totalUsers} registered seekers and owners</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
