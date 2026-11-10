import type { Location, NavigateFunction } from 'react-router-dom';
import type { useAuth } from '@/hooks/useAuth';
import type { useStore } from '@/store/useStore';
type AuthState = ReturnType<typeof useAuth>;
export interface ExploreEngineOptions {
  initialNav: string;
  location: Pick<Location, 'pathname'>;
  searchParams: URLSearchParams;
  user: AuthState['user'];
  profile: AuthState['profile'];
  logout: AuthState['logout'];
  refreshProfile: AuthState['refreshProfile'];
  openAuthModal: ReturnType<typeof useStore.getState>['openAuthModal'];
  navigate: NavigateFunction;
}
/** Mount existing renderer; returned cleanup releases subscriptions, listeners and previews. */
export function mountExploreEngine(options: ExploreEngineOptions): () => void;
