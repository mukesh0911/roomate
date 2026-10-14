import { Outlet, useLocation, useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Home, Flag, ShieldCheck,
  Bell, Settings, LogOut, Menu, X, Loader2, BarChart3
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/listings', label: 'Listings', icon: Home },
  { path: '/admin/marketplace', label: 'Marketplace', icon: BarChart3 },
  { path: '/admin/reports', label: 'Reports', icon: Flag },
  { path: '/admin/verifications', label: 'Verifications', icon: ShieldCheck },
  { path: '/admin/notifications', label: 'Notifications', icon: Bell },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, logout, isLoading: authLoading } = useAuth();
  const { isAdmin, checking, getMetrics } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<{
    pendingVerifications?: number;
    pendingReports?: number;
    pendingListings?: number;
  }>({});

  // Fetch pending item counts for sidebar badges
  useEffect(() => {
    if (isAdmin) {
      getMetrics().then(m => {
        setBadgeCounts({
          pendingVerifications: m.pendingVerifications,
          pendingReports: m.pendingReports,
          pendingListings: m.pendingListings,
        });
      }).catch(() => {});
    }
  }, [isAdmin, getMetrics]);

  // Escape key listener for mobile sidebar
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  // Gate: loading
  if (checking || authLoading) {
    return (
      <div className="h-screen w-screen bg-[#0F172A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-fire animate-spin" />
          <p className="text-sm text-white/50">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Gate: not logged in -> redirect to /login immediately
  if (!user) {
    return <Navigate to="/login?redirect=/admin" replace />;
  }

  // Gate: not admin -> redirect away from admin backoffice immediately
  if (isAdmin === false) {
    return <Navigate to="/explore?tab=rooms" replace />;
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path: string, exact?: boolean) => {
    const current = location.pathname.replace(/\/$/, '') || '/';
    const target = path.replace(/\/$/, '') || '/';
    if (exact) return current === target;
    return current.startsWith(target);
  };

  const getBadge = (path: string) => {
    if (path === '/admin/verifications' && (badgeCounts.pendingVerifications ?? 0) > 0) {
      return { count: badgeCounts.pendingVerifications!, color: 'bg-amber-500 text-white' };
    }
    if (path === '/admin/reports' && (badgeCounts.pendingReports ?? 0) > 0) {
      return { count: badgeCounts.pendingReports!, color: 'bg-red-500 text-white' };
    }
    if (path === '/admin/listings' && (badgeCounts.pendingListings ?? 0) > 0) {
      return { count: badgeCounts.pendingListings!, color: 'bg-amber-400/20 text-amber-300' };
    }
    return null;
  };

  const backToAppRoute = '/explore?tab=rooms';

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-[250px] bg-[#0F172A] flex-col shrink-0 h-full border-r border-slate-800/90 z-20 select-none">
        {/* Logo Header */}
        <div className="px-5 py-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl gradient-fire flex items-center justify-center shadow-md shadow-fire/20">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.88-2.88 7.19-5 9.88C9.92 16.21 7 11.85 7 9z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold text-sm tracking-tight">NestMate</span>
                <span className="text-[10px] bg-fire/20 text-fire px-1.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider">Admin</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Control Center</p>
            </div>
          </div>
        </div>

        {/* Navigation Items (Compact & sleek with customized scrollbar) */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            const badge = getBadge(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  active
                    ? 'bg-gradient-to-r from-fire to-orange-500 text-white shadow-sm shadow-fire/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${badge.color}`}>
                    {badge.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Admin Profile & Logout (Pinned to bottom, zero white space below) */}
        <div className="px-3 py-3.5 border-t border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5 px-1.5 mb-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white text-xs font-bold uppercase shadow-inner shrink-0">
              {profile?.name?.charAt(0) || user.email?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate leading-tight">{profile?.name || 'Administrator'}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-[270px] bg-[#0F172A] flex flex-col z-10 shadow-2xl">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-sm">NestMate Admin</span>
                <span className="text-[10px] bg-fire/20 text-fire px-1.5 py-0.5 rounded-full font-bold uppercase">Pro</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#334155_transparent]">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const active = isActive(item.path, item.exact);
                const badge = getBadge(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'bg-gradient-to-r from-fire to-orange-500 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>
                    {badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${badge.color}`}>
                        {badge.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold uppercase">
                  {profile?.name?.charAt(0) || user.email?.charAt(0) || 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{profile?.name || 'Administrator'}</p>
                  <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content - smooth scrolling panel with sticky top bar */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-[#F8FAFC]">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 h-14 flex items-center justify-between shadow-2xs shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Admin</span>
              <span className="text-xs text-slate-300">/</span>
              <h1 className="text-sm font-bold text-slate-800">
                {NAV_ITEMS.find(n => isActive(n.path, n.exact))?.label || 'Dashboard'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={backToAppRoute}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-fire bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg transition-all"
            >
              <span>← Back to App</span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
