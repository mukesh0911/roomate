/** Features that must never be exposed by a production bundle. */
export const DEMO_MODE_ENABLED =
  import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || 'hello@nestmate.in';
