import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useStore } from '@/store/useStore';
import { hydrateOwnProfile, savePrivateUserData } from '@/lib/privateUserData';
import type { UserHousingPreferences } from '@/lib/userIntent';

export function extractGooglePhoto(
  firebaseUser: FirebaseUser | null,
  additionalProfile?: Record<string, any> | null
): string {
  if (!firebaseUser && !additionalProfile) return '';
  const rawUrl =
    (additionalProfile?.picture as string) ||
    firebaseUser?.photoURL ||
    firebaseUser?.providerData?.find((p) => p.photoURL)?.photoURL ||
    '';
  if (!rawUrl) return '';
  // Upgrade Google photo resolution: replace e.g. =s96-c with =s400-c
  if (rawUrl.includes('googleusercontent.com')) {
    return rawUrl.replace(/=s\d+(-c)?$/, '=s400-c');
  }
  return rawUrl;
}

async function persistPublicUser(
  uid: string,
  data: Record<string, unknown>,
  privateFields?: { phone?: string; email?: string; workEmail?: string }
) {
  if (privateFields && (privateFields.phone || privateFields.email || privateFields.workEmail)) {
    await savePrivateUserData(uid, privateFields);
  }
  const { phone: _p, email: _e, workEmail: _w, ...rest } = data;
  await setDoc(
    doc(db, 'users', uid),
    {
      ...rest,
      phone: '',
      email: '',
      workEmail: '',
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

declare global {
  interface Window {
    confirmationResult?: any;
  }
}

export interface UserProfile {
  uid: string;
  phone: string;
  name: string;
  email: string;
  role: 'seeker' | 'owner' | null;
  city: string;
  localities: string[];
  budget: number;
  budgetMin?: number;
  preferredRoomTypes?: string[];
  roommateGenderPreference?: 'Any' | 'Female' | 'Male';
  moveInDate: string;
  profession: string;
  company: string;
  bio?: string;
  age: number;
  gender: string;
  avatar: string;
  geoLocation?: { lat: number; lng: number; formattedAddress?: string } | null;
  quizAnswers: Record<string, string>;
  onboardingComplete: boolean;
  isPremium: boolean;
  isVerified: boolean;
  phoneVerified?: boolean;
  connectsUsed: number;
  connectsLimit: number;
  verificationLevel: number;
  settings?: Record<string, any>;
  locality?: string;
  // Persisted user action arrays
  savedProfileIds: string[];   // UIDs of saved match profiles
  savedRoomIds: string[];      // IDs of saved listings
  skippedUserIds: string[];    // UIDs excluded from match feed
  blockedUserIds: string[];    // UIDs blocked by user
  savedSearches?: {            // Saved search filters
    id: string;
    filters: any;
    name: string;
    createdAt: any;
  }[];
  workEmail?: string;
  workEmailVerified?: boolean;
  whatsappNumber?: string;
  socialLinks?: {
    linkedin?: string;
    instagram?: string;
  };
  ownerType?: string;
  propertyBasics?: any;
  householdExpectations?: any;
  preferences?: any;
  housingIntent?: string;
  housingPreferences?: UserHousingPreferences;
  /** Explicit opt-in to appear in the roommate discovery directory. */
  roommateDiscoveryEnabled?: boolean;
  preferredRoomType?: string;
  state?: string;
  lastActiveAt?: any;
  createdAt: any;
  updatedAt: any;
}

interface AuthSingletonState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
}

let authSingleton: AuthSingletonState = {
  user: auth.currentUser,
  profile: null,
  isLoading: true,
  error: null,
};

const authListeners = new Set<() => void>();

function getAuthSnapshot(): AuthSingletonState {
  return authSingleton;
}

function subscribeAuth(cb: () => void) {
  authListeners.add(cb);
  return () => {
    authListeners.delete(cb);
  };
}

function setAuthSingleton(partial: Partial<AuthSingletonState>) {
  authSingleton = { ...authSingleton, ...partial };
  authListeners.forEach(cb => cb());
}

let authListenerInitialized = false;
let authLoadGeneration = 0;

function initSharedAuthListener() {
  if (authListenerInitialized) return;
  authListenerInitialized = true;

  onAuthStateChanged(auth, async (firebaseUser) => {
    const generation = ++authLoadGeneration;
    const isCurrent = () => generation === authLoadGeneration && auth.currentUser?.uid === firebaseUser?.uid;
    if (firebaseUser) {
      setAuthSingleton({ user: firebaseUser, profile: null, isLoading: true, error: null });
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const profileSnap = await getDoc(userRef);
        if (!isCurrent()) return;

        if (profileSnap.exists()) {
          const data = profileSnap.data() as UserProfile;
          const googlePhoto = extractGooglePhoto(firebaseUser);
          if (googlePhoto && (!data.avatar || data.avatar.trim() === '' || data.avatar.includes('dicebear'))) {
            data.avatar = googlePhoto;
          }
          const hydrated = await hydrateOwnProfile({ ...data, uid: firebaseUser.uid });
          if (!isCurrent()) return;
          setAuthSingleton({ user: firebaseUser, profile: hydrated, isLoading: false, error: null });
        } else {
          // Signup may have committed and hydrated the same account while this
          // earlier missing-document read was in flight. Preserve that result.
          const createdProfile = authSingleton.profile?.uid === firebaseUser.uid ? authSingleton.profile : null;
          setAuthSingleton({ user: firebaseUser, profile: createdProfile, isLoading: false, error: null });
        }
      } catch (err: any) {
        if (!isCurrent()) return;
        console.error('Unable to read user profile during auth load:', err);
        setAuthSingleton({ user: firebaseUser, profile: null, isLoading: false, error: 'Unable to load profile data. Please refresh or contact support.' });
      }
    } else {
      setAuthSingleton({ user: null, profile: null, isLoading: false, error: null });
    }
  });
}


export function useAuth() {
  initSharedAuthListener();
  const state = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot);
  const { user, profile, isLoading, error } = state;

  const setError = useCallback((err: string | null) => {
    setAuthSingleton({ error: err });
  }, []);

  const setUser = useCallback((u: FirebaseUser | null) => {
    if (u && auth.currentUser?.uid !== u.uid) return;
    setAuthSingleton({ user: u });
  }, []);

  const setProfile = useCallback((p: UserProfile | null) => {
    if (p && auth.currentUser?.uid !== p.uid) return;
    setAuthSingleton({ profile: p });
  }, []);

  const refreshProfile = useCallback(async (uid?: string): Promise<UserProfile | null> => {
    const profileUid = uid || user?.uid;
    if (!profileUid || profileUid !== auth.currentUser?.uid) return null;
    const generation = authLoadGeneration;

    try {
      const profileSnap = await getDoc(doc(db, 'users', profileUid));
      if (profileSnap.exists()) {
        const rawData = profileSnap.data() as UserProfile;
        const googlePhoto = extractGooglePhoto(user);
        if (googlePhoto && (!rawData.avatar || rawData.avatar.trim() === '' || rawData.avatar.includes('dicebear'))) {
          rawData.avatar = googlePhoto;
        }
        const data = await hydrateOwnProfile({ ...rawData, uid: profileUid });
        if (generation !== authLoadGeneration || auth.currentUser?.uid !== profileUid) return null;
        setProfile(data);
        return data;
      }
    } catch (err: any) {
      console.error('Unable to refresh profile:', err);
    }
    return null;
  }, [setProfile, user]);

  /**
   * Sign in with email + password.
   * Returns { isNew, role, onboardingComplete } for post-login routing.
   */
  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<{ isNew: boolean; role: string | null; onboardingComplete: boolean }> => {
      setError(null);
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        const firebaseUser = result.user;

        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        const isNew = !userSnap.exists();

        if (isNew) {
          const defaultName = firebaseUser.displayName || email.split('@')[0];
          const phone = firebaseUser.phoneNumber || '';
          const userEmail = firebaseUser.email || email;
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            phone: '',
            name: defaultName,
            email: '',
            role: null,
            city: '',
            localities: [],
            budget: 0,
            moveInDate: '',
            profession: '',
            company: '',
            bio: '',
            // Sprint 4A (truth): age/gender are NOT invented at signup.
            age: 0,
            gender: '',
            avatar: firebaseUser.photoURL || '',
            quizAnswers: {},
            onboardingComplete: false,
            isPremium: false,
            connectsUsed: 0,
            connectsLimit: 5,
            // Sprint 4A (truth): unverified by default — no implied verification.
            verificationLevel: 0,
            isVerified: false,
            workEmailVerified: false,
            savedProfileIds: [],
            savedRoomIds: [],
            skippedUserIds: [],
            blockedUserIds: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await persistPublicUser(
            firebaseUser.uid,
            newProfile as unknown as Record<string, unknown>,
            { phone, email: userEmail }
          );
          setProfile(await hydrateOwnProfile({ ...newProfile, phone, email: userEmail }));
          setUser(firebaseUser);
          return { isNew: true, role: null, onboardingComplete: false };
        } else {
          const data = userSnap.data() as UserProfile;
          setProfile(await hydrateOwnProfile({ ...data, uid: firebaseUser.uid }));
          setUser(firebaseUser);
          return { isNew: false, role: data.role || null, onboardingComplete: !!data.onboardingComplete };
        }
      } catch (err: any) {
        let msg = err.message || 'Sign in failed';
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
          msg = 'Invalid email or password. Please try again.';
        } else if (err.code === 'auth/too-many-requests') {
          msg = 'Too many failed attempts. Please try again later.';
        }
        setError(msg);
        const thrownError: any = new Error(msg);
        thrownError.code = err.code;
        throw thrownError;
      }
    },
    [setError, setProfile, setUser]
  );

  /**
   * Create account with email + password.
   * Creates a minimal Firestore profile; caller should redirect to /role-select.
   */
  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<void> => {
      setError(null);
      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = result.user;

        const newProfile: Partial<UserProfile> = {
          uid: firebaseUser.uid,
          phone: '',
          name: '',
          email: '',
          role: null,
          city: '',
          localities: [],
          // BUG-2 FIX: budget is collected during onboarding, not fabricated.
          budget: 0,
          moveInDate: '',
          profession: '',
          company: '',
          age: 0,
          gender: '',
          avatar: '',
          quizAnswers: {},
          onboardingComplete: false,
          isPremium: false,
          connectsUsed: 0,
          connectsLimit: 5,
          verificationLevel: 0,
          isVerified: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await persistPublicUser(
          firebaseUser.uid,
          newProfile as Record<string, unknown>,
          { email: firebaseUser.email || email, phone: '' }
        );
        setProfile(await hydrateOwnProfile({ ...newProfile, uid: firebaseUser.uid, email: firebaseUser.email || email } as UserProfile));
        setUser(firebaseUser);
      } catch (err: any) {
        let msg = err.message || 'Account creation failed';
        if (err.code === 'auth/email-already-in-use') {
          msg = 'An account with this email already exists. Try signing in.';
        } else if (err.code === 'auth/invalid-email') {
          msg = 'Please enter a valid email address.';
        } else if (err.code === 'auth/weak-password') {
          msg = 'Password is too weak. Use at least 6 characters.';
        }
        setError(msg);
        throw new Error(msg);
      }
    },
    [setError, setProfile, setUser]
  );

  /**
   * Send a password reset email.
   */
  const resetPassword = useCallback(async (email: string): Promise<void> => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      let msg = err.message || 'Failed to send reset email';
      if (err.code === 'auth/user-not-found') {
        msg = 'No account found with this email address.';
      }
      setError(msg);
      throw new Error(msg);
    }
  }, [setError]);

  /**
   * Google Sign-in flow
   * Continues seamlessly, creates profile if new.
   */
  const signInWithGoogle = useCallback(async (): Promise<{ isNew: boolean; role?: string | null; onboardingComplete?: boolean; email?: string | null; hasPhone: boolean }> => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const additionalInfo = getAdditionalUserInfo(result);
      const googlePhoto = extractGooglePhoto(firebaseUser, additionalInfo?.profile);

      const userRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userRef);
      const isNew = !userSnap.exists();

      if (isNew) {
        const defaultName = firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'User');
        const phone = firebaseUser.phoneNumber || '';
        const email = firebaseUser.email || '';
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          phone: '',
          name: defaultName,
          email: '',
          role: null,
          city: '',
          localities: [],
          budget: 0,
          moveInDate: '',
          profession: '',
          company: '',
          bio: '',
          // Sprint 4A (truth): age/gender are NOT invented at signup.
          age: 0,
          gender: '',
          avatar: googlePhoto || '',
          quizAnswers: {},
          onboardingComplete: false,
          isPremium: false,
          connectsUsed: 0,
          connectsLimit: 5,
          // Sprint 4A (truth): unverified by default — no implied verification.
          verificationLevel: 0,
          isVerified: false,
          workEmailVerified: false,
          savedProfileIds: [],
          savedRoomIds: [],
          skippedUserIds: [],
          blockedUserIds: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await persistPublicUser(
          firebaseUser.uid,
          newProfile as unknown as Record<string, unknown>,
          { phone, email }
        );
        setProfile(await hydrateOwnProfile({ ...newProfile, phone, email }));
        setUser(firebaseUser);
        const hasPhone = !!firebaseUser.phoneNumber;
        return { isNew: true, role: null, onboardingComplete: false, email: firebaseUser.email, hasPhone };
      } else {
        const existingProfile = userSnap.data() as UserProfile;
        if (googlePhoto && (!existingProfile.avatar || existingProfile.avatar.trim() === '' || existingProfile.avatar.includes('dicebear'))) {
          existingProfile.avatar = googlePhoto;
        }
        const hydrated = await hydrateOwnProfile({ ...existingProfile, uid: firebaseUser.uid });
        setProfile(hydrated);
        setUser(firebaseUser);
        const hasPhone = existingProfile.phoneVerified === true || !!firebaseUser.phoneNumber || !!(hydrated.phone && hydrated.phone.trim().length > 0);
        return { isNew: false, role: existingProfile.role || null, onboardingComplete: !!existingProfile.onboardingComplete, email: firebaseUser.email, hasPhone };
      }
    } catch (err: any) {
      let msg = err.message || 'Google Sign-in failed';
      if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Sign-in cancelled.';
      }
      setError(msg);
      throw new Error(msg);
    }
  }, [setError, setProfile, setUser]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
    useStore.getState().resetAll();
  }, [setProfile, setUser]);

  return {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    error,
    // Email/Password auth (primary)
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    // Google auth
    signInWithGoogle,
    // Shared
    logout,
    refreshProfile,
  };
}
