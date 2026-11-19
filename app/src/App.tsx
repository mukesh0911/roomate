import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import LandingPage from '@/pages/LandingPage';
import { RouteErrorBoundary } from '@/lib/RouteErrorBoundary';
import AuthModal from '@/components/AuthModal';
import { useStore } from '@/store/useStore';
import { getSafeReturnDestination } from '@/lib/roleNavigation';

const ExplorePage = lazy(() => import('@/pages/ExplorePage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));

function LoginRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const openAuthModal = useStore(state => state.openAuthModal);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const returnTo = getSafeReturnDestination(params.get('returnTo')) || '/explore';
    openAuthModal({
      title: 'Sign in to NestMate',
      subtitle: 'Sign in or create an account to continue.',
      redirect: returnTo,
    });
    navigate('/', { replace: true });
  }, [location.search, navigate, openAuthModal]);

  return <main role="status" aria-live="polite" style={{ padding: '2rem' }}>Opening sign-in…</main>;
}

export default function App() {
  const {
    authModalOpen,
    authModalTitle,
    authModalSubtitle,
    authModalRedirect,
    closeAuthModal,
  } = useStore();

  return (
    <>
      <Toaster position="top-center" richColors closeButton />
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        title={authModalTitle}
        subtitle={authModalSubtitle}
        redirectAfterLogin={authModalRedirect}
      />
      <RouteErrorBoundary>
      <Suspense fallback={<main role="status" aria-live="polite" style={{ padding: '2rem' }}>Loading NestMate…</main>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/explore" element={<ExplorePage initialNav="explore" />} />
        <Route path="/saved" element={<ExplorePage initialNav="saved" />} />
        <Route path="/messages" element={<ExplorePage initialNav="messages" />} />
        <Route path="/notifications" element={<ExplorePage initialNav="notifications" />} />
        <Route path="/connections" element={<Navigate to="/messages?box=requests" replace />} />
        <Route path="/listings" element={<ExplorePage initialNav="listings" />} />
        <Route path="/profile" element={<ExplorePage initialNav="profile" />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      </RouteErrorBoundary>
    </>
  );
}
