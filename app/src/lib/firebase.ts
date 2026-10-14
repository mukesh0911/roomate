import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
  .map(([key]) => key);

if (missingFirebaseConfig.length > 0) {
  throw new Error(
    `Missing Firebase configuration: ${missingFirebaseConfig.join(', ')}. ` +
    'Copy the required VITE_FIREBASE_* values into app/.env.local before starting the app.'
  );
}

// Prevent re-initialization during HMR
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

function getEmulatorPort(name: string, fallback: number): number {
  const value = Number(import.meta.env[name]);
  return Number.isInteger(value) && value > 0 && value <= 65535 ? value : fallback;
}

// E2E tests use the real Firebase client SDK against an isolated local
// Emulator Suite. This is explicit and fail-closed: production/default dev
// builds never connect to emulators merely because they run on localhost.
if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  const authPort = getEmulatorPort('VITE_FIREBASE_AUTH_EMULATOR_PORT', 9099);
  const firestorePort = getEmulatorPort('VITE_FIRESTORE_EMULATOR_PORT', 8080);
  const storagePort = getEmulatorPort('VITE_FIREBASE_STORAGE_EMULATOR_PORT', 9199);
  const functionsPort = getEmulatorPort('VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT', 5001);
  const marker = '__nestmateFirebaseEmulatorsConnected';
  const globalState = globalThis as typeof globalThis & Record<string, unknown>;
  if (!globalState[marker]) {
    connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', firestorePort);
    connectStorageEmulator(storage, '127.0.0.1', storagePort);
    connectFunctionsEmulator(functions, '127.0.0.1', functionsPort);
    globalState[marker] = true;
  }
}
export default app;
