import { Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState, Suspense, lazy } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useActiveTracking } from '@/hooks/useActiveTracking';
import { isAccountActive, blockedStatusMessage } from '@/lib/accountStatus';
import { ShieldAlert, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

// ----- Pages -----
import LandingPage from '@/pages/LandingPage';
const AuthPage = lazy(() => import('@/pages/AuthPage'));
const PhoneLogin = lazy(() => import('@/pages/PhoneLogin'));
const OTPVerify = lazy(() => import('@/pages/OTPVerify'));
const VerifyPhone = lazy(() => import('@/pages/VerifyPhone'));
const RoleSelect = lazy(() => import('@/pages/RoleSelect'));
const SeekerOnboarding = lazy(() => import('@/pages/SeekerOnboarding'));
const OwnerOnboarding = lazy(() => import('@/pages/OwnerOnboarding'));
const SeekerDashboard = lazy(() => import('@/pages/SeekerDashboard'));
const OwnerDashboard = lazy(() => import('@/pages/OwnerDashboard'));
const MyListings = lazy(() => import('@/pages/MyListings'));
const ExplorePage = lazy(() => import('@/pages/ExplorePage'));
const RoomDetail = lazy(() => import('@/pages/RoomDetail'));
const MatchDetail = lazy(() => import('@/pages/MatchDetail'));
const ChatPage = lazy(() => import('@/pages/ChatPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const EditProfile = lazy(() => import('@/pages/EditProfile'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));

const HowItWorks = lazy(() => import('@/pages/HowItWorks'));
const PricingPage = lazy(() => import('@/pages/PricingPage'));
const AboutUs = lazy(() => import('@/pages/AboutUs'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const EditListing = lazy(() => import('@/pages/EditListing'));
const BrowseSeekers = lazy(() => import('@/pages/BrowseSeekers'));
// Keep the destructive development seed utility out of production bundles,
// not merely out of the production route table.
const SeedData = import.meta.env.DEV ? lazy(() => import('@/pages/SeedData')) : null;

// Target screens
const TrustCenter = lazy(() => import('@/pages/TrustCenter'));
const PreferencesPage = lazy(() => import('@/pages/PreferencesPage'));
const ProfilePreview = lazy(() => import('@/pages/ProfilePreview'));
const SafetyCenter = lazy(() => import('@/pages/SafetyCenter'));
const ApplicantCompare = lazy(() => import('@/pages/ApplicantCompare'));
const HelpSupport = lazy(() => import('@/pages/HelpSupport'));

// Admin pages - extra lazy since rarely visited
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminListings = lazy(() => import('@/pages/admin/AdminListings'));
const AdminMarketplace = lazy(() => import('@/pages/admin/AdminMarketplace'));
const AdminReports = lazy(() => import('@/pages/admin/AdminReports'));
const AdminVerifications = lazy(() => import('@/pages/admin/AdminVerifications'));
const AdminNotifications = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));

// Layout is NOT lazy — it's needed on every authenticated page
import Layout from '@/components/Layout';

// ----- Page title manager -----
const PAGE_TITLES: Record<string, string> = {
  '/': 'NestMate — Find Your Perfect Roommate in Bangalore',
  '/login': 'Log In | NestMate',
  '/how-it-works': 'How It Works | NestMate',
  '/about': 'About Us | NestMate',
  '/privacy': 'Privacy Policy | NestMate',
  '/terms': 'Terms of Service | NestMate',
  '/verify-phone': 'Verify Mobile Number | NestMate',
  '/role-select': 'Choose Your Role | NestMate',
  '/onboarding/seeker': 'Seeker Onboarding | NestMate',
  '/onboarding/owner': 'Owner Onboarding | NestMate',
  '/dashboard': 'Dashboard | NestMate',
  '/owner-dashboard': 'My Room Listings | NestMate',
  '/my-listings': 'My Room Listings | NestMate',
  '/explore': 'Explore Rooms & Roommates | NestMate',
  '/browse-rooms': 'Find Rooms | NestMate',
  '/browse-seekers': 'Find Roommates | NestMate',
  '/chat': 'Messages | NestMate',
  '/profile': 'My Profile | NestMate',
  '/edit-profile': 'Edit Profile | NestMate',
  '/settings': 'Settings | NestMate',
  '/notifications': 'Notifications | NestMate',
  '/trust': 'Trust & Safety Center | NestMate',
  '/preferences': 'Matching Preferences | NestMate',
  '/profile/preview': 'Public Profile Preview | NestMate',
  '/safety': 'Safety Center | NestMate',
  '/applicants/compare': 'Applicant Compare | NestMate',
  '/help': 'Help & Support | NestMate',
  '/pricing': 'Plans & Pricing | NestMate',
  '/admin': 'Admin Dashboard | NestMate',
};

function usePageTitle() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    const title = PAGE_TITLES[path] || 'NestMate';
    document.title = title;
  }, [location.pathname]);
}

// ----- Loading fallback -----
function PageLoader() {
  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center" role="status" aria-label="Loading page">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-fire animate-spin" />
        <p className="text-sm text-ink/40">Loading...</p>
      </div>
    </div>
  );
}

interface AuthState {
  uid: string | null;
  role: 'seeker' | 'owner' | null;
  onboardingComplete: boolean;
  status: string;
  loading: boolean;
  hasPhone: boolean;
}

// Full-screen notice for suspended/banned accounts (server-enforced via rules too)
function BlockedAccountScreen({ status }: { status: string }) {
  const message = blockedStatusMessage(status);
  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-ink/10 p-8 text-center">
        <ShieldAlert className="w-12 h-12 text-fire mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-ink mb-2">Account Restricted</h1>
        <p className="text-sm text-ink/60 mb-6">{message || 'Your account access is restricted.'}</p>
        <button
          onClick={() => signOut(auth)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

// Intercepts any URL where /admin has been appended to an arbitrary path
// (e.g. /explore/admin, /dashboard/admin, /room/123/admin) and redirects directly to /admin
function AdminRedirectWatcher() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const p = location.pathname.toLowerCase();
    if (p !== '/admin' && !p.startsWith('/admin/')) {
      const idx = p.indexOf('/admin');
      if (idx !== -1) {
        const targetAdminPath = location.pathname.slice(idx);
        navigate(targetAdminPath + location.search + location.hash, { replace: true });
      }
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  return null;
}

// Guard authenticated routes (auth + account status)
function PrivateRoute({ children, isAuthenticated, status }: { children: React.ReactNode, isAuthenticated: boolean, status: string }) {
  const location = useLocation();
  if (auth.currentUser && !isAuthenticated) return <PageLoader />;
  if (!isAuthenticated) {
    const redirectTarget = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectTarget}`} replace />;
  }
  if (!isAccountActive(status)) return <BlockedAccountScreen status={status} />;
  return <>{children}</>;
}

// Intelligent login route — honors ?redirect=/admin even if already authenticated
function LoginRoute({ isAuthenticated, authState, getDashboardRoute }: { isAuthenticated: boolean, authState: AuthState, getDashboardRoute: () => string }) {
  const location = useLocation();
  const redirect = new URLSearchParams(location.search).get('redirect');
  if (isAuthenticated) {
    if (redirect && (redirect === '/admin' || redirect.startsWith('/admin'))) {
      return <Navigate to={redirect} replace />;
    }
    return <Navigate to={getDashboardRoute()} replace />;
  }
  return <AuthPage />;
}

// Guard interactive routes — enforces authentication, account status,
// completed onboarding, and role-based routing. Server-side rules are the
// authoritative enforcement layer; this guard is UX + defense-in-depth.
function OnboardingGuard({ children, isAuthenticated, authState, expectedRole }: {
  children: React.ReactNode,
  isAuthenticated: boolean,
  authState: AuthState,
  expectedRole?: 'seeker' | 'owner'
}) {
  const location = useLocation();
  if (authState.loading || (auth.currentUser && authState.uid !== auth.currentUser.uid)) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAccountActive(authState.status)) return <BlockedAccountScreen status={authState.status} />;

  // Incomplete onboarding must never reach interactive features.
  // Keep the original destination so a sign-in or incomplete-profile detour
  // finishes where the user intended to go. The shared seeker setup supports
  // both room discovery and listing creation in the unified product model.
  if (!authState.onboardingComplete) {
    const returnTarget = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`/onboarding/seeker?redirect=${returnTarget}`} replace />;
  }

  const activeRole = authState.role || 'seeker';

  // Role mismatch — redirect to the correct dashboard for user's active role
  if (expectedRole && activeRole !== expectedRole) {
    return <Navigate to={activeRole === 'seeker' ? '/explore?tab=rooms' : '/my-listings'} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const [authState, setAuthState] = useState<AuthState>({
    uid: null,
    role: null,
    onboardingComplete: false,
    status: 'active',
    loading: true,
    hasPhone: false,
  });


  const location = useLocation();

  // Track user activity status
  useActiveTracking();

  // Dynamic page titles
  usePageTitle();

  // Real-time auth + profile sync
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let fallbackTimer: any = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      if (firebaseUser) {
        // Set loading: true so OnboardingGuard waits for the profile snapshot
        setAuthState(prev => ({ ...prev, uid: firebaseUser.uid, loading: true }));

        // Fallback timer: if Firestore server doesn't respond within 2500ms, fail closed
        fallbackTimer = setTimeout(() => {
          setAuthState(prev => prev.loading ? { uid: firebaseUser.uid, role: null, onboardingComplete: false, status: 'active', loading: false, hasPhone: !!firebaseUser.phoneNumber } : prev);
        }, 2500);

        unsubscribeProfile = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const isServer = !snap.metadata.fromCache;
              const isOnboarded = data.onboardingComplete === true;

              // If snapshot is from cache but indicates incomplete onboarding,
              // wait for the authoritative server snapshot before deciding to bounce.
              if (!isOnboarded && !isServer) {
                return;
              }

              if (fallbackTimer) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
              }
              const hasPhone = data.phoneVerified === true || !!(data.phone && String(data.phone).trim().length > 0) || !!firebaseUser.phoneNumber;
              setAuthState({
                uid: firebaseUser.uid,
                role: data.role || null,
                // Trust only the real DB field — never assume completion
                onboardingComplete: isOnboarded,
                status: data.status || 'active',
                loading: false,
                hasPhone,
              });
              if (data.settings?.darkMode) {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
            } else if (!snap.metadata.fromCache) {
              // Authoritative confirmation from server: profile doc does not exist
              if (fallbackTimer) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
              }
              setAuthState({ uid: firebaseUser.uid, role: null, onboardingComplete: false, status: 'active', loading: false, hasPhone: !!firebaseUser.phoneNumber });
              document.documentElement.classList.remove('dark');
            } else {
              // Local cache miss (fromCache: true, exists: false)
              // The server snapshot is in flight; keep loading: true until it arrives
            }
          },
          (err) => {
            console.error('Profile listener error:', err);
            if (fallbackTimer) {
              clearTimeout(fallbackTimer);
              fallbackTimer = null;
            }
            // Fail closed: treat as incomplete until profile is readable
            setAuthState({ uid: firebaseUser.uid, role: null, onboardingComplete: false, status: 'active', loading: false, hasPhone: !!firebaseUser.phoneNumber });
          }
        );
      } else {
        setAuthState({ uid: null, role: null, onboardingComplete: false, status: 'active', loading: false, hasPhone: false });
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  // Only block with full-screen PageLoader on protected / onboarding / auth routes.
  // Public browsing routes ('/', '/explore', '/room/:id', etc.) must render immediately without waiting for auth state.
  const isPublicRoute =
    location.pathname === '/' ||
    location.pathname === '/explore' ||
    location.pathname.startsWith('/room/') ||
    location.pathname.startsWith('/flatmate/') ||
    location.pathname.startsWith('/match/') ||
    location.pathname === '/about' ||
    location.pathname === '/how-it-works' ||
    location.pathname === '/privacy' ||
    location.pathname === '/terms' ||
    location.pathname === '/trust' ||
    location.pathname === '/safety' ||
    location.pathname === '/pricing' ||
    location.pathname === '/help';

  if (authState.loading && !isPublicRoute) {
    return <PageLoader />;
  }

  const isAuthenticated = !!authState.uid;

function DashboardRedirect() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const target = tab ? `/explore?tab=${tab}` : '/explore?tab=rooms';
  return <Navigate to={target} replace />;
}

function BrowseSeekersRedirect() {
  return <Navigate to="/explore?tab=roommates" replace />;
}

function BrowseRoomsRedirect() {
  return <Navigate to="/explore?tab=rooms" replace />;
}

  const getDashboardRoute = (): string => {
    if (!isAuthenticated) return '/login';
    return '/explore?tab=rooms';
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <AdminRedirectWatcher />
      <Routes>
        {/* Auth routes */}
        <Route path="/login" element={<LoginRoute isAuthenticated={isAuthenticated} authState={authState} getDashboardRoute={getDashboardRoute} />} />
        <Route path="/phone-login" element={<Navigate to="/login" replace />} />
        <Route path="/verify-otp" element={<Navigate to="/login" replace />} />
        <Route path="/verify-phone" element={<Navigate to={!isAuthenticated ? '/login' : (authState.onboardingComplete ? '/explore?tab=rooms' : '/onboarding/seeker')} replace />} />

        {/* Post-auth onboarding — unified profile setup */}
        <Route path="/role-select" element={
          !isAuthenticated
            ? <Navigate to="/login" replace />
            : authState.onboardingComplete
              ? <Navigate to="/explore?tab=rooms" replace />
              : <Navigate to="/onboarding/seeker" replace />
        } />
        <Route path="/onboarding/seeker" element={
          !isAuthenticated
            ? <Navigate to="/login" replace />
            : <PrivateRoute isAuthenticated={isAuthenticated} status={authState.status}><SeekerOnboarding /></PrivateRoute>
        } />
        <Route path="/onboarding/owner" element={<Navigate to="/edit-listing/new" replace />} />

        {/* Public & App routes with shared Layout */}
        <Route element={<Layout />}>
          {/* Unauthenticated public browsing */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/browse-rooms" element={<BrowseRoomsRedirect />} />
          <Route path="/browse-seekers" element={<BrowseSeekersRedirect />} />
          <Route path="/find-rooms" element={<BrowseRoomsRedirect />} />
          <Route path="/find-flatmates" element={<BrowseSeekersRedirect />} />
          <Route path="/room/:id" element={<RoomDetail />} />
          <Route path="/match/:id" element={<MatchDetail />} />
          <Route path="/trust" element={<TrustCenter />} />
          <Route path="/safety" element={<SafetyCenter />} />
          <Route path="/help" element={<HelpSupport />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<PrivacyPolicy />} />

          {/* Out-of-scope routes redirected */}
          <Route path="/map" element={<Navigate to="/explore" replace />} />
          <Route path="/pricing" element={<PricingPage />} />

          {/* Authenticated user routes */}
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="/my-listings" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><MyListings /></OnboardingGuard>} />
          <Route path="/owner-dashboard" element={<Navigate to="/my-listings" replace />} />
          <Route path="/edit-listing/:id" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><EditListing /></OnboardingGuard>} />
          <Route path="/chat" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><ChatPage /></OnboardingGuard>} />
          <Route path="/chat/:roomId" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><ChatPage /></OnboardingGuard>} />
          <Route path="/profile" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><ProfilePage /></OnboardingGuard>} />
          <Route path="/profile/preview" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><ProfilePreview /></OnboardingGuard>} />
          <Route path="/edit-profile" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><EditProfile /></OnboardingGuard>} />
          <Route path="/verify" element={<Navigate to="/edit-profile#verification" replace />} />
          <Route path="/preferences" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState} expectedRole="seeker"><PreferencesPage /></OnboardingGuard>} />
          <Route path="/applicants/compare" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><ApplicantCompare /></OnboardingGuard>} />
          <Route path="/settings" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><SettingsPage /></OnboardingGuard>} />
          <Route path="/notifications" element={<OnboardingGuard isAuthenticated={isAuthenticated} authState={authState}><NotificationsPage /></OnboardingGuard>} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={
          <PrivateRoute isAuthenticated={isAuthenticated} status={authState.status}>
            <AdminLayout />
          </PrivateRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="marketplace" element={<AdminMarketplace />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Dev-only: seed utility is compiled out of production builds */}
        {import.meta.env.DEV && SeedData && <Route path="/dev/seed" element={<SeedData />} />}

        {/* Deep Link & Convenience Redirects */}
        <Route path="/home" element={<Navigate to="/explore?tab=rooms" replace />} />
        <Route path="/connections" element={<Navigate to="/explore?tab=connections" replace />} />
        <Route path="/applicants" element={<Navigate to="/my-listings" replace />} />
        <Route path="/create-listing" element={<Navigate to="/edit-listing/new" replace />} />
        <Route path="/listings" element={<Navigate to="/my-listings" replace />} />
        <Route path="/my-profile" element={<Navigate to="/profile" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      <AppRoutes />
    </>
  );
}
