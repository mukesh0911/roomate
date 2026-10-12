import { useCallback } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from './useAuth';
import { sanitizePublicProfile } from '@/lib/sanitizeProfile';
import { savePrivateUserData, stripPiiFromWrite } from '@/lib/privateUserData';
import { validateReport } from '@/lib/reportValidation';

export function useUserProfile() {
  /** Public profile only — contact PII stripped. */
  const getProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    const snap = await getDoc(doc(db, 'users', userId));
    if (!snap.exists()) return null;
    return sanitizePublicProfile({ uid: userId, ...snap.data() }) as UserProfile;
  }, []);

  const updateProfile = useCallback(async (userId: string, data: Partial<UserProfile>) => {
    const userRef = doc(db, 'users', userId);
    const existingSnap = await getDoc(userRef);
    const existing = existingSnap.exists() ? existingSnap.data() : {};

    const { phone, email, workEmail, whatsappNumber, ...rest } = data as Partial<UserProfile> & Record<string, unknown>;

    // Prefer explicit writes; otherwise migrate legacy public PII into private store
    const phoneToSave = phone !== undefined ? String(phone) : (existing.phone as string | undefined);
    const emailToSave = email !== undefined ? String(email) : (existing.email as string | undefined);
    const workEmailToSave = workEmail !== undefined ? String(workEmail) : (existing.workEmail as string | undefined);
    const whatsappToSave = whatsappNumber !== undefined ? String(whatsappNumber).trim() : (existing.whatsappNumber as string | undefined);

    if (phoneToSave || emailToSave || workEmailToSave || whatsappToSave !== undefined) {
      await savePrivateUserData(userId, {
        ...(phoneToSave ? { phone: phoneToSave } : {}),
        ...(emailToSave ? { email: emailToSave } : {}),
        ...(workEmailToSave ? { workEmail: workEmailToSave } : {}),
        ...(whatsappToSave !== undefined ? { whatsappNumber: whatsappToSave } : {}),
      });

      // Synchronize with userContacts (read-protected by Firestore rules for accepted connections)
      if (whatsappNumber !== undefined) {
        await setDoc(doc(db, 'userContacts', userId), {
          whatsappNumber: whatsappToSave || '',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    }

    const publicData = stripPiiFromWrite({ ...rest } as Record<string, unknown>);
    try {
      await setDoc(userRef, {
        ...publicData,
        // Clear legacy PII from publicly readable users doc
        phone: '',
        email: '',
        workEmail: '',
        whatsappNumber: '',
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (setDocErr: any) {
      console.error('CRITICAL setDoc failure:', setDocErr.code, setDocErr.message);
      throw setDocErr;
    }
  }, []);

  const setRole = useCallback(async (userId: string, role: 'seeker' | 'owner') => {
    await setDoc(doc(db, 'users', userId), {
      role,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }, []);

  const completeOnboarding = useCallback(
    async (userId: string, quizAnswers: Record<string, string>) => {
      await setDoc(doc(db, 'users', userId), {
        quizAnswers,
        onboardingComplete: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    },
    []
  );

  const saveBasicProfile = useCallback(
    async (
      userId: string,
      data: {
        name: string;
        age: number;
        gender: string;
        profession: string;
        company: string;
        phone?: string;
        avatar?: string;
      }
    ) => {
      await updateProfile(userId, data);
    },
    [updateProfile]
  );

  const saveLocationPreferences = useCallback(
    async (
      userId: string,
      data: {
        city: string;
        localities: string[];
        budget: number;
        moveInDate: string;
      }
    ) => {
      await updateProfile(userId, data);
    },
    [updateProfile]
  );

  /**
   * Toggle a profile UID in the user's savedProfileIds array.
   * Uses Firestore arrayUnion/arrayRemove — safe for concurrent updates.
   * Returns the new saved state (true = now saved).
   */
  const toggleSavedProfile = useCallback(
    async (userId: string, targetUid: string, currentlySaved: boolean): Promise<boolean> => {
      const userRef = doc(db, 'users', userId);
      if (currentlySaved) {
        await updateDoc(userRef, { savedProfileIds: arrayRemove(targetUid), updatedAt: serverTimestamp() });
        return false;
      } else {
        await updateDoc(userRef, { savedProfileIds: arrayUnion(targetUid), updatedAt: serverTimestamp() });
        return true;
      }
    },
    []
  );

  /**
   * Toggle a listing ID in the user's savedRoomIds array.
   * Returns the new saved state (true = now saved).
   */
  const toggleSavedRoom = useCallback(
    async (userId: string, roomId: string, currentlySaved: boolean): Promise<boolean> => {
      const userRef = doc(db, 'users', userId);
      if (currentlySaved) {
        await updateDoc(userRef, { savedRoomIds: arrayRemove(roomId), updatedAt: serverTimestamp() });
        return false;
      } else {
        await updateDoc(userRef, { savedRoomIds: arrayUnion(roomId), updatedAt: serverTimestamp() });
        return true;
      }
    },
    []
  );

  /**
   * Add a user UID to the skippedUserIds array (one-way — never un-skip).
   */
  const addSkippedUser = useCallback(
    async (userId: string, skippedUid: string): Promise<void> => {
      await updateDoc(doc(db, 'users', userId), {
        skippedUserIds: arrayUnion(skippedUid),
        updatedAt: serverTimestamp(),
      });
    },
    []
  );

  /**
   * Add a user UID to the blockedUserIds array.
   */
  const blockUser = useCallback(
    async (userId: string, targetUid: string): Promise<void> => {
      await updateDoc(doc(db, 'users', userId), {
        blockedUserIds: arrayUnion(targetUid),
        updatedAt: serverTimestamp(),
      });
    },
    []
  );

  /**
   * Create a report document in the 'reports' collection.
   * Validated client-side; the Firestore rules re-validate authoritatively
   * (reporterId must equal the auth token uid — spoofing is impossible).
   */
  const reportUser = useCallback(
    async (data: {
      reporterId: string;
      targetId: string;
      reason: string;
      description?: string;
    }): Promise<void> => {
      const result = validateReport(data, data.reporterId);
      if (!result.valid || !result.payload) {
        throw new Error(result.error || 'Invalid report.');
      }
      await addDoc(collection(db, 'reports'), {
        ...result.payload,
        createdAt: serverTimestamp(),
      });
    },
    []
  );

  const saveSearch = useCallback(
    async (userId: string, searchData: any): Promise<void> => {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        savedSearches: arrayUnion(searchData),
      });
    },
    []
  );

  const deleteSearch = useCallback(
    async (userId: string, searchData: any): Promise<void> => {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        savedSearches: arrayRemove(searchData),
      });
    },
    []
  );

  return {
    getProfile,
    updateProfile,
    setRole,
    completeOnboarding,
    saveBasicProfile,
    saveLocationPreferences,
    toggleSavedProfile,
    toggleSavedRoom,
    addSkippedUser,
    blockUser,
    reportUser,
    saveSearch,
    deleteSearch,
  };
}
