/**
 * Owner Identity Verification — NestMate Security Module
 *
 * Single source of truth for the owner identity verification state machine.
 * A listing may only become publicly visible AFTER the owner's identity
 * verification is APPROVED by a NestMate admin.
 *
 * State machine:
 *   NOT_STARTED → SUBMITTED → UNDER_REVIEW → APPROVED
 *                                           → REJECTED → RESUBMISSION_REQUIRED → SUBMITTED (loop)
 *
 * What is verified:
 *   NestMate admin manually reviews a submitted government-issued ID document.
 *   This verifies IDENTITY only — not property ownership.
 *   The public listing trust signal reflects this distinction accurately.
 *
 * External dependency:
 *   No integration with DigiLocker, Aadhaar OTP, or any government API.
 *   Verification is admin-manual. External API integration is a future dependency.
 */

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Unsubscribe } from 'firebase/firestore';

// ─── Verification State ────────────────────────────────────────────────────────

export type OwnerVerificationStatus =
  | 'NOT_STARTED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RESUBMISSION_REQUIRED';

export type VerificationDocType = 'aadhaar' | 'passport' | 'driving_license' | 'voter_id';

export interface OwnerVerification {
  /** UID of the owner */
  userId: string;
  /** Current state in the verification state machine */
  status: OwnerVerificationStatus;
  /** Type of document submitted */
  documentType?: VerificationDocType;
  /** Firebase Storage URL of the submitted document */
  documentUrl?: string;
  /** Owner's self-declared full name on the document */
  declaredName?: string;
  /** ISO timestamp of original submission */
  submittedAt?: unknown;
  /** ISO timestamp of most recent status update */
  updatedAt?: unknown;
  /** Admin who reviewed (UID or email key) */
  reviewedBy?: string;
  /** Timestamp of admin review action */
  reviewedAt?: unknown;
  /** Admin note explaining rejection reason or approval note */
  reviewNote?: string;
  /** How many times the owner has resubmitted */
  resubmissionCount?: number;
  /** Audit trail of all status transitions */
  auditTrail?: Array<{
    status: OwnerVerificationStatus;
    timestamp: unknown;
    actorId?: string;
    note?: string;
  }>;
}

// ─── Collection reference ─────────────────────────────────────────────────────

export function ownerVerificationRef(userId: string) {
  return doc(db, 'ownerVerifications', userId);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getOwnerVerification(userId: string): Promise<OwnerVerification | null> {
  try {
    const snap = await getDoc(ownerVerificationRef(userId));
    if (!snap.exists()) return null;
    return { userId: snap.id, ...snap.data() } as OwnerVerification;
  } catch {
    return null;
  }
}

/**
 * Real-time subscription to the owner's verification document.
 * Returns an unsubscribe function.
 */
export function subscribeToOwnerVerification(
  userId: string,
  callback: (verification: OwnerVerification | null) => void
): Unsubscribe {
  return onSnapshot(ownerVerificationRef(userId), (snap) => {
    if (!snap.exists()) {
      callback(null);
    } else {
      callback({ userId: snap.id, ...snap.data() } as OwnerVerification);
    }
  });
}

// ─── Write (Owner actions) ────────────────────────────────────────────────────

/**
 * Owner submits identity verification for admin review.
 * Creates the ownerVerifications/{userId} document or updates it
 * when resubmitting after rejection.
 */
export async function submitOwnerVerification(
  userId: string,
  data: {
    documentType: VerificationDocType;
    documentUrl: string;
    declaredName: string;
  }
): Promise<void> {
  const existingSnap = await getDoc(ownerVerificationRef(userId));
  const existing = existingSnap.exists() ? existingSnap.data() : null;

  const isResubmission = existing?.status === 'REJECTED' || existing?.status === 'RESUBMISSION_REQUIRED';

  const auditEntry = {
    status: 'SUBMITTED' as OwnerVerificationStatus,
    timestamp: new Date().toISOString(),
    actorId: userId,
    note: isResubmission ? 'Owner resubmitted after rejection' : 'Initial submission',
  };

  await setDoc(
    ownerVerificationRef(userId),
    {
      userId,
      status: 'SUBMITTED' as OwnerVerificationStatus,
      documentType: data.documentType,
      documentUrl: data.documentUrl,
      declaredName: data.declaredName,
      submittedAt: existing?.submittedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
      resubmissionCount: isResubmission ? (existing?.resubmissionCount ?? 0) + 1 : 0,
      reviewedBy: null,
      reviewedAt: null,
      reviewNote: null,
      auditTrail: [...(existing?.auditTrail ?? []), auditEntry],
    },
    { merge: true }
  );
}

// ─── Write (Admin actions) ────────────────────────────────────────────────────

/**
 * Admin approves the verification.
 * Side effects:
 *   1. Sets ownerVerifications/{userId}.status = APPROVED
 *   2. Sets users/{userId}.isVerified = true, verificationLevel = 3
 *   3. Sets ALL of the owner's pending_verification listings to:
 *      status: 'active', ownerVerified: true
 *
 * This is the ONLY path that makes listings publicly visible.
 */
export async function adminApproveOwnerVerification(
  userId: string,
  adminId: string,
  note?: string
): Promise<{ listingsUnlocked: number }> {
  void userId; void adminId; void note;
  throw new Error('Open the current private submission in /admin for versioned manual review. Identity approval does not publish listings.');
}

/**
 * Admin rejects the verification with a mandatory reason note.
 * Side effects:
 *   1. Sets ownerVerifications/{userId}.status = REJECTED
 *   2. Listings remain in pending_verification (not public)
 */
export async function adminRejectOwnerVerification(
  userId: string,
  adminId: string,
  note: string
): Promise<void> {
  const existing = await getDoc(ownerVerificationRef(userId));
  const existingTrail = existing.exists() ? (existing.data()?.auditTrail ?? []) : [];

  await setDoc(
    ownerVerificationRef(userId),
    {
      status: 'REJECTED' as OwnerVerificationStatus,
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
      reviewNote: note,
      updatedAt: serverTimestamp(),
      auditTrail: [
        ...existingTrail,
        { status: 'REJECTED', timestamp: new Date().toISOString(), actorId: adminId, note },
      ],
    },
    { merge: true }
  );
}

/**
 * Admin requests resubmission (soft rejection with specific guidance).
 */
export async function adminRequestResubmission(
  userId: string,
  adminId: string,
  note: string
): Promise<void> {
  const existing = await getDoc(ownerVerificationRef(userId));
  const existingTrail = existing.exists() ? (existing.data()?.auditTrail ?? []) : [];

  await setDoc(
    ownerVerificationRef(userId),
    {
      status: 'RESUBMISSION_REQUIRED' as OwnerVerificationStatus,
      reviewedBy: adminId,
      reviewedAt: serverTimestamp(),
      reviewNote: note,
      updatedAt: serverTimestamp(),
      auditTrail: [
        ...existingTrail,
        { status: 'RESUBMISSION_REQUIRED', timestamp: new Date().toISOString(), actorId: adminId, note },
      ],
    },
    { merge: true }
  );
}

/**
 * Admin sets status to UNDER_REVIEW (claiming the verification for review).
 */
export async function adminBeginReview(userId: string, adminId: string): Promise<void> {
  const existing = await getDoc(ownerVerificationRef(userId));
  const existingTrail = existing.exists() ? (existing.data()?.auditTrail ?? []) : [];

  await setDoc(
    ownerVerificationRef(userId),
    {
      status: 'UNDER_REVIEW' as OwnerVerificationStatus,
      reviewedBy: adminId,
      updatedAt: serverTimestamp(),
      auditTrail: [
        ...existingTrail,
        { status: 'UNDER_REVIEW', timestamp: new Date().toISOString(), actorId: adminId },
      ],
    },
    { merge: true }
  );
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function isOwnerVerificationApproved(status: OwnerVerificationStatus | null | undefined): boolean {
  return status === 'APPROVED';
}

export function canOwnerPublishListing(status: OwnerVerificationStatus | null | undefined): boolean {
  return status === 'APPROVED';
}

export function verificationStatusLabel(status: OwnerVerificationStatus | null | undefined): string {
  switch (status) {
    case 'NOT_STARTED': return 'Not Started';
    case 'SUBMITTED': return 'Under Review';
    case 'UNDER_REVIEW': return 'Under Review';
    case 'APPROVED': return 'Verified';
    case 'REJECTED': return 'Rejected';
    case 'RESUBMISSION_REQUIRED': return 'Resubmission Required';
    default: return 'Verification Required';
  }
}

export function verificationStatusDescription(status: OwnerVerificationStatus | null | undefined): string {
  switch (status) {
    case 'NOT_STARTED':
      return 'You need to verify your identity before your listing can go live. Submit a government-issued ID for admin review.';
    case 'SUBMITTED':
      return 'Your identity documents have been submitted and are awaiting admin review. Your listing will go live once approved.';
    case 'UNDER_REVIEW':
      return 'A NestMate admin is currently reviewing your identity documents. This typically takes 1–2 business days.';
    case 'APPROVED':
      return 'Your identity has been verified. Your listing is now publicly visible.';
    case 'REJECTED':
      return 'Your verification was rejected. Please review the admin note and resubmit with a clearer document.';
    case 'RESUBMISSION_REQUIRED':
      return 'The NestMate team requires additional information. Please resubmit with the requested changes.';
    default:
      return 'Complete identity verification to publish your listing.';
  }
}
