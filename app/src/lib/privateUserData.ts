import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/** Owner-only contact fields — never store these on publicly readable `users/{uid}`. */
export interface PrivateUserData {
  phone?: string;
  email?: string;
  workEmail?: string;
  whatsappNumber?: string;
  updatedAt?: unknown;
}

export function privateUserDataRef(userId: string) {
  return doc(db, 'privateUserData', userId);
}

export async function getPrivateUserData(userId: string): Promise<PrivateUserData> {
  const snap = await getDoc(privateUserDataRef(userId));
  if (!snap.exists()) return {};
  return snap.data() as PrivateUserData;
}

export async function savePrivateUserData(
  userId: string,
  data: Partial<PrivateUserData>
): Promise<void> {
  const cleaned: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.phone !== undefined) cleaned.phone = data.phone;
  if (data.email !== undefined) cleaned.email = data.email;
  if (data.workEmail !== undefined) cleaned.workEmail = data.workEmail;
  if (data.whatsappNumber !== undefined) cleaned.whatsappNumber = data.whatsappNumber;
  await setDoc(privateUserDataRef(userId), cleaned, { merge: true });
}

/**
 * Merge private contact fields into the caller's own profile for UI use.
 * Does not write anything back to the public `users` document.
 */
export async function hydrateOwnProfile<T extends { uid: string; phone?: string; email?: string; workEmail?: string; whatsappNumber?: string }>(
  profile: T
): Promise<T> {
  try {
    const priv = await getPrivateUserData(profile.uid);
    // Loading a profile is read-only. Legacy PII cleanup requires an explicitly
    // approved migration with backup and verification, never a login side effect.
    return {
      ...profile,
      phone: priv.phone ?? profile.phone ?? '',
      email: priv.email ?? profile.email ?? '',
      workEmail: priv.workEmail ?? profile.workEmail ?? '',
      whatsappNumber: priv.whatsappNumber ?? profile.whatsappNumber ?? '',
    };
  } catch (err) {
    console.warn('Failed to hydrate private user data:', err);
    return profile;
  }
}

/** Fields that must never be written to the public users collection. */
export const PUBLIC_PII_KEYS = ['phone', 'email', 'workEmail', 'whatsappNumber'] as const;

export function stripPiiFromWrite<T extends Record<string, unknown>>(data: T): Omit<T, 'phone' | 'email' | 'workEmail' | 'whatsappNumber'> {
  const next = { ...data };
  for (const key of PUBLIC_PII_KEYS) {
    delete next[key];
  }
  return next as Omit<T, 'phone' | 'email' | 'workEmail' | 'whatsappNumber'>;
}
