import { useState, useEffect, useCallback } from 'react';
import { deleteUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where, orderBy, limit, updateDoc, deleteDoc, addDoc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { adminEmailKey } from '@/lib/adminKeys';
import {
  adminApproveOwnerVerification,
  adminRejectOwnerVerification,
  adminRequestResubmission,
  adminBeginReview,
} from '@/lib/ownerVerification';

// ─────────────────────────────────────────────────────────────────────────────
// Admin authorization model (must mirror firestore.rules isAdmin()):
//   An authenticated user is an admin IFF a document exists at
//   admins/{lowercased auth email}. The email comes from the Firebase Auth
//   token — never from client-supplied data. No hardcoded emails.
// Bootstrap: create admins/<email> in the Firebase console
// (see docs/security/ADMIN_BOOTSTRAP.md).
// ─────────────────────────────────────────────────────────────────────────────

const adminCache = new Map<string, boolean>();

export function useAdmin() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = loading
  const [checking, setChecking] = useState(true);

  // Check admin status
  useEffect(() => {
    if (authLoading) return; // Wait for Firebase Auth hydration
    if (!user?.uid) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }

    const checkAdmin = async () => {
      try {
        const email = (user.email || profile?.email || '').toLowerCase().trim();
        if (!email) {
          setIsAdmin(false);
          setChecking(false);
          return;
        }

        if (adminCache.has(email)) {
          setIsAdmin(adminCache.get(email)!);
          setChecking(false);
          return;
        }

        // Authoritative check against admins/{email}. This intentionally
        // mirrors firestore.rules: config lists and hard-coded emails are not
        // authorization sources.
        try {
          const adminDoc = await getDoc(doc(db, 'admins', adminEmailKey(email))).catch(() => null);
          const result = !!adminDoc?.exists();
          adminCache.set(email, result);
          setIsAdmin(result);
        } catch {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Admin check failed:', err);
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    };

    checkAdmin();
  }, [authLoading, user?.uid, user?.email, profile?.email]);

  // --- Dashboard metrics ---
  const getMetrics = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Total users
    const usersSnap = await getDocs(collection(db, 'users'));
    const totalUsers = usersSnap.size;

    // Signups today & yesterday
    let signupsToday = 0;
    let signupsYesterday = 0;
    usersSnap.docs.forEach(d => {
      const created = d.data().createdAt;
      if (!created) return;
      let ts = 0;
      if (created.toMillis) ts = created.toMillis();
      else if (created.toDate) ts = created.toDate().getTime();
      else if (typeof created === 'string' || typeof created === 'number') ts = new Date(created).getTime();
      if (!ts || isNaN(ts)) return;

      if (ts >= today.getTime()) signupsToday++;
      else if (ts >= yesterday.getTime() && ts < today.getTime()) signupsYesterday++;
    });

    // Active listings
    const listingsSnap = await getDocs(query(collection(db, 'listings'), where('status', '==', 'active')));
    const activeListings = listingsSnap.size;

    // Total listings
    const allListingsSnap = await getDocs(collection(db, 'listings'));
    const totalListings = allListingsSnap.size;

    // Pending listings (waiting for verification)
    let pendingListings = 0;
    try {
      const pendingListingsSnap = await getDocs(query(collection(db, 'listings'), where('status', '==', 'pending_verification'))).catch(() => ({ docs: [] }));
      pendingListings = pendingListingsSnap.docs.length;
    } catch {
      // Metrics remain usable with a zero count if this optional query is denied.
    }

    // Chat rooms (proxy for messages activity)
    const chatsSnap = await getDocs(collection(db, 'chatRooms'));
    const totalChats = chatsSnap.size;

    // Users by city
    const cityMap: Record<string, number> = {};
    usersSnap.docs.forEach(d => {
      const city = d.data().city;
      if (city) cityMap[city] = (cityMap[city] || 0) + 1;
    });
    const topCities = Object.entries(cityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([city, count]) => ({ city, count }));

    // Daily signups (last 30 days) normalized by calendar day
    const dailySignups: { date: string; count: number }[] = [];
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayMidnight);
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      dailySignups.push({ date: label, count: 0 });
    }

    usersSnap.docs.forEach(d => {
      const created = d.data().createdAt;
      if (!created) return;
      let dt: Date | null = null;
      if (created.toDate) dt = created.toDate();
      else if (created.toMillis) dt = new Date(created.toMillis());
      else if (typeof created === 'string' || typeof created === 'number') dt = new Date(created);
      if (!dt || isNaN(dt.getTime())) return;

      const dtMidnight = new Date(dt);
      dtMidnight.setHours(0, 0, 0, 0);
      const diffDays = Math.round((todayMidnight.getTime() - dtMidnight.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 30) {
        dailySignups[29 - diffDays].count++;
      }
    });

    // Seekers vs owners
    let seekers = 0, owners = 0;
    usersSnap.docs.forEach(d => {
      const role = d.data().role;
      if (role === 'seeker') seekers++;
      else if (role === 'owner') owners++;
    });

    // Pending verifications count (legacy + ownerVerifications)
    let pendingVerifications = 0;
    try {
      const [legacySnap, ownerSnap] = await Promise.all([
        getDocs(query(collection(db, 'verifications'), where('status', '==', 'pending'))).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'ownerVerifications')).catch(() => ({ docs: [] })),
      ]);
      const legacyPending = (legacySnap.docs || []).length;
      const ownerPending = (ownerSnap.docs || []).filter(
        (d: any) => d.data().status === 'SUBMITTED' || d.data().status === 'UNDER_REVIEW'
      ).length;
      pendingVerifications = legacyPending + ownerPending;
    } catch {
      // Metrics remain usable with a zero count if verification data is unavailable.
    }

    // Pending / open reports count
    let pendingReports = 0;
    try {
      const reportsSnap = await getDocs(collection(db, 'reports')).catch(() => ({ docs: [] }));
      pendingReports = (reportsSnap.docs || []).filter(
        (d: any) => d.data().status === 'pending' || d.data().status === 'under_review'
      ).length;
    } catch {
      // Metrics remain usable with a zero count if report data is unavailable.
    }

    return {
      totalUsers, signupsToday, signupsYesterday, activeListings, totalListings,
      pendingListings, totalChats, topCities, dailySignups, seekers, owners,
      pendingVerifications, pendingReports,
    };
  }, []);

  // --- User management ---
  const getAllUsers = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tb - ta;
      });
      return list;
    } catch (err) {
      console.error('getAllUsers error:', err);
      return [];
    }
  }, []);

  const suspendUser = useCallback(async (uid: string) => {
    await updateDoc(doc(db, 'users', uid), { status: 'suspended', updatedAt: serverTimestamp() });
    try {
      const lSnap = await getDocs(query(collection(db, 'listings'), where('ownerId', '==', uid)));
      await Promise.all(lSnap.docs.map(d => updateDoc(doc(db, 'listings', d.id), { status: 'paused', updatedAt: serverTimestamp() })));
    } catch {
      // User suspension still succeeds if listing cleanup is temporarily unavailable.
    }
  }, []);

  const banUser = useCallback(async (uid: string) => {
    await updateDoc(doc(db, 'users', uid), { status: 'banned', updatedAt: serverTimestamp() });
    try {
      const lSnap = await getDocs(query(collection(db, 'listings'), where('ownerId', '==', uid)));
      await Promise.all(lSnap.docs.map(d => updateDoc(doc(db, 'listings', d.id), { status: 'paused', updatedAt: serverTimestamp() })));
    } catch {
      // User banning still succeeds if listing cleanup is temporarily unavailable.
    }
  }, []);

  const reinstateUser = useCallback(async (uid: string) => {
    await updateDoc(doc(db, 'users', uid), { status: 'active', updatedAt: serverTimestamp() });
  }, []);

  const updateUserVerification = useCallback(async (uid: string, level: number, isVerified: boolean) => {
    await updateDoc(doc(db, 'users', uid), {
      verificationLevel: level,
      isVerified,
      updatedAt: serverTimestamp(),
    });
  }, []);

  // --- Listing management ---
  const getAllListings = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'listings'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tb - ta;
      });
      return list;
    } catch (err) {
      console.error('getAllListings error:', err);
      return [];
    }
  }, []);

  const updateListingStatus = useCallback(async (id: string, status: string) => {
    await updateDoc(doc(db, 'listings', id), { status, updatedAt: serverTimestamp() });
  }, []);

  const deleteListing = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'listings', id));
  }, []);

  // --- Broadcast notification ---
  const broadcastNotification = useCallback(async (
    title: string, description: string,
    target: 'all' | 'seekers' | 'owners',
  ) => {
    let q;
    if (target === 'seekers') q = query(collection(db, 'users'), where('role', '==', 'seeker'));
    else if (target === 'owners') q = query(collection(db, 'users'), where('role', '==', 'owner'));
    else q = query(collection(db, 'users'));

    const snap = await getDocs(q);
    const userDocs = snap.docs;

    // Save audit log to broadcasts collection
    try {
      await addDoc(collection(db, 'broadcasts'), {
        title,
        description,
        target,
        sentBy: user?.email || user?.uid || 'admin',
        recipientCount: userDocs.length,
        sentAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to log broadcast to broadcasts collection:', e);
    }

    // Chunk notification creation in batches of 50
    const CHUNK_SIZE = 50;
    for (let i = 0; i < userDocs.length; i += CHUNK_SIZE) {
      const chunk = userDocs.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(d =>
          addDoc(collection(db, 'notifications'), {
            userId: d.id, type: 'system', title, description,
            read: false, createdAt: serverTimestamp(),
          })
        )
      );
    }
    return userDocs.length;
  }, [user?.email, user?.uid]);

  const getBroadcastHistory = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'broadcasts'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const ta = a.sentAt?.toMillis ? a.sentAt.toMillis() : (a.sentAt ? new Date(a.sentAt).getTime() : 0);
        const tb = b.sentAt?.toMillis ? b.sentAt.toMillis() : (b.sentAt ? new Date(b.sentAt).getTime() : 0);
        return tb - ta;
      });
      return list;
    } catch (err) {
      console.error('getBroadcastHistory error:', err);
      return [];
    }
  }, []);

  // --- Reports ---
  const getAllReports = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'reports'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tb - ta;
      });
      return list;
    } catch (err) {
      console.error('getAllReports error:', err);
      return [];
    }
  }, []);

  const updateReportStatus = useCallback(async (id: string, status: string) => {
    await updateDoc(doc(db, 'reports', id), { status, updatedAt: serverTimestamp() });
  }, []);

  // --- Verifications ---
  const getAllVerifications = useCallback(async () => {
    try {
      // Fetch both the legacy verifications collection AND the authoritative ownerVerifications collection
      const [legacySnap, ownerSnap] = await Promise.all([
        getDocs(collection(db, 'verifications')).catch(() => ({ docs: [] })),
        getDocs(collection(db, 'ownerVerifications')).catch(() => ({ docs: [] })),
      ]);
      const legacyDocs = (legacySnap.docs || []).map((d: any) => ({ id: d.id, ...d.data(), _source: 'legacy' }));
      const ownerDocs = (ownerSnap.docs || []).map((d: any) => ({
        id: d.id,
        userId: d.id,
        type: d.data().documentType ?? 'aadhaar',
        status: mapOwnerVerifStatusToLegacy(d.data().status),
        documentUrl: d.data().documentUrl ?? '',
        submittedAt: d.data().submittedAt,
        reviewedAt: d.data().reviewedAt ?? null,
        reviewNote: d.data().reviewNote ?? null,
        _source: 'ownerVerification',
        _ownerVerifStatus: d.data().status,
        _declaredName: d.data().declaredName,
        _resubmissionCount: d.data().resubmissionCount ?? 0,
        _auditTrail: d.data().auditTrail ?? [],
      }));

      // Sort pending items to the top
      const all = [...ownerDocs, ...legacyDocs];
      all.sort((a, b) => {
        const aPending = a.status === 'pending' ? 1 : 0;
        const bPending = b.status === 'pending' ? 1 : 0;
        if (aPending !== bPending) return bPending - aPending;
        const ta = a.submittedAt?.toMillis ? a.submittedAt.toMillis() : (a.submittedAt ? new Date(a.submittedAt).getTime() : 0);
        const tb = b.submittedAt?.toMillis ? b.submittedAt.toMillis() : (b.submittedAt ? new Date(b.submittedAt).getTime() : 0);
        return tb - ta;
      });
      return all;
    } catch (err) {
      console.error('getAllVerifications error:', err);
      return [];
    }
  }, []);

  /** Map new state-machine status to legacy 'pending'|'approved'|'rejected' for UI compat */
  function mapOwnerVerifStatusToLegacy(status: string): 'pending' | 'approved' | 'rejected' {
    if (status === 'APPROVED') return 'approved';
    if (status === 'REJECTED') return 'rejected';
    return 'pending';
  }

  /**
   * Approve an owner verification.
   * For ownerVerification entries: delegates to adminApproveOwnerVerification()
   * which ALSO unlocks all pending_verification listings.
   * For legacy verifications: updates the verifications doc and user fields.
   */
  const approveVerification = useCallback(async (id: string, userId: string, type: string, source?: string) => {
    if (source === 'ownerVerification') {
      // New path: uses ownerVerification state machine + unlocks listings
      const adminUid = user?.uid ?? 'admin';
      const result = await adminApproveOwnerVerification(userId, adminUid);
      await addDoc(collection(db, 'notifications'), {
        userId,
        type: 'verification',
        title: 'Identity Verified — Your Listing is Now Live!',
        description: `Your identity has been verified by the NestMate team. ${result.listingsUnlocked > 0 ? `${result.listingsUnlocked} listing(s) are now publicly visible.` : ''}`,
        read: false,
        createdAt: serverTimestamp(),
      });
    } else {
      // Legacy path: updates the verifications doc and user trust fields
      await updateDoc(doc(db, 'verifications', id), { status: 'approved', reviewedAt: serverTimestamp() });
      const userUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (type === 'aadhaar' || type === 'student_id') {
        userUpdates.isVerified = true;
        userUpdates.verificationLevel = 3;
        userUpdates.isAadhaarVerified = type === 'aadhaar';
        userUpdates.isStudentIdVerified = type === 'student_id';
      } else if (type === 'work_id') {
        userUpdates.workEmailVerified = true;
        userUpdates.isWorkIdVerified = true;
      }
      await updateDoc(doc(db, 'users', userId), userUpdates);
      await addDoc(collection(db, 'notifications'), {
        userId, type: 'verification', title: 'Verification Approved',
        description: `Your ${type.replace('_', ' ')} verification has been approved!`,
        read: false, createdAt: serverTimestamp(),
      });
    }
  }, [user?.uid]);

  /**
   * Reject an owner verification with a mandatory note.
   */
  const rejectVerification = useCallback(async (id: string, userId: string, type: string, note: string, source?: string) => {
    if (source === 'ownerVerification') {
      const adminUid = user?.uid ?? 'admin';
      await adminRejectOwnerVerification(userId, adminUid, note);
      await addDoc(collection(db, 'notifications'), {
        userId,
        type: 'verification',
        title: 'Verification Rejected',
        description: `Your identity verification was rejected. Reason: ${note}. Please resubmit with a clearer document.`,
        read: false,
        createdAt: serverTimestamp(),
      });
    } else {
      // Legacy path
      await updateDoc(doc(db, 'verifications', id), { status: 'rejected', reviewedAt: serverTimestamp(), reviewNote: note });
      await addDoc(collection(db, 'notifications'), {
        userId, type: 'verification', title: 'Verification Rejected',
        description: `Your ${type.replace('_', ' ')} verification was rejected. Reason: ${note}`,
        read: false, createdAt: serverTimestamp(),
      });
    }
  }, [user?.uid]);

  /**
   * Request resubmission — a soft rejection with specific guidance.
   */
  const requestResubmission = useCallback(async (userId: string, note: string) => {
    const adminUid = user?.uid ?? 'admin';
    await adminRequestResubmission(userId, adminUid, note);
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'verification',
      title: 'Resubmission Required',
      description: `The NestMate team requires additional information for your verification. ${note}`,
      read: false,
      createdAt: serverTimestamp(),
    });
  }, [user?.uid]);

  /**
   * Admin claims a verification for review (UNDER_REVIEW state).
   */
  const beginReview = useCallback(async (userId: string) => {
    const adminUid = user?.uid ?? 'admin';
    await adminBeginReview(userId, adminUid);
  }, [user?.uid]);

  // Fetch all ownerVerifications for admin panel
  const getAllOwnerVerifications = useCallback(async () => {
    const snap = await getDocs(collection(db, 'ownerVerifications'));
    return snap.docs.map(d => ({ id: d.id, userId: d.id, ...d.data() }));
  }, []);

  // --- Admin management ---
  const getAdmins = useCallback(async () => {
    const snap = await getDocs(collection(db, 'admins'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }, []);

  /** Register an admin. Keyed by lowercased email so it matches the rules. */
  const addAdmin = useCallback(async (email: string, name: string, role = 'moderator') => {
    const key = adminEmailKey(email);
    await setDoc(doc(db, 'admins', key), { email: key, name, role, createdAt: serverTimestamp() });
  }, []);

  const removeAdmin = useCallback(async (id: string) => {
    // id IS the lowercased email key for docs created via addAdmin()
    await deleteDoc(doc(db, 'admins', id));
  }, []);

  const getAdminConfig = useCallback(async () => {
    const snap = await getDoc(doc(db, 'config', 'admin'));
    return snap.exists() ? (snap.data() as { adminEmails?: string[] }) : { adminEmails: [] };
  }, []);

  /**
   * Update the informational config list AND keep the authoritative
   * admins/{email} registry in sync (additive). Rules enforce access via
   * admins/{email}; this keeps both views consistent.
   */
  const updateAdminEmails = useCallback(async (emails: string[]) => {
    const ref = doc(db, 'config', 'admin');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { adminEmails: emails });
    } else {
      await setDoc(ref, { adminEmails: emails });
    }
    // Additive sync into the authoritative registry
    await Promise.all(
      emails
        .map(e => e.trim().toLowerCase())
        .filter(Boolean)
        .map(key =>
          setDoc(doc(db, 'admins', key), { email: key, role: 'moderator', createdAt: serverTimestamp() }, { merge: true })
        )
    );
  }, []);

  /**
   * Safely purge all demo and seed accounts and their dependent records while
   * protecting every account in the authoritative admin registry.
   */
  const cleanDemoAndSeedData = useCallback(async (onProgress?: (msg: string) => void) => {
    const log = (m: string) => onProgress?.(m);
    log('Scanning database collections for demo & seed data...');

    let totalDeleted = 0;
    const SEED_TAG = 'seed_user_';

    // Resolve protected identities from the same registry used by rules. Never
    // encode a person's address in client code as an authorization exception.
    const adminsSnap = await getDocs(collection(db, 'admins'));
    const protectedAdminEmails = new Set(
      adminsSnap.docs.flatMap(adminDoc => {
        const registryEmail = String(adminDoc.data().email || '').toLowerCase().trim();
        const idEmail = adminDoc.id.toLowerCase().trim();
        return [registryEmail, idEmail].filter(Boolean);
      })
    );

    // 1. Scan users
    log('Scanning user accounts...');
    const usersSnap = await getDocs(collection(db, 'users'));
    const seedUserIds = new Set<string>();

    const batches: Array<() => Promise<void>> = [];
    let currentBatch = writeBatch(db);
    let batchOps = 0;

    const queueDelete = (ref: any) => {
      currentBatch.delete(ref);
      batchOps++;
      if (batchOps >= 400) {
        const b = currentBatch;
        batches.push(() => b.commit());
        currentBatch = writeBatch(db);
        batchOps = 0;
      }
    };

    for (const uDoc of usersSnap.docs) {
      const data = uDoc.data();
      const email = (data.email || '').toLowerCase().trim();
      const uid = uDoc.id;

      // Never remove a registered admin or the operator's current profile.
      if (protectedAdminEmails.has(email) || uid === user?.uid) {
        continue;
      }

      const isSeedOrDemo =
        uid.startsWith(SEED_TAG) ||
        email.startsWith('demo.') ||
        email.endsWith('@nestmate-seed.com') ||
        email.includes('seed') ||
        data.isDemo === true ||
        data.isSeed === true;

      if (isSeedOrDemo) {
        seedUserIds.add(uid);
        queueDelete(uDoc.ref);
        queueDelete(doc(db, 'privateUserData', uid));
        totalDeleted++;
      }
    }
    log(`Identified ${seedUserIds.size} demo/seed accounts.`);

    // 2. Scan listings
    log('Scanning property listings...');
    const listingsSnap = await getDocs(collection(db, 'listings'));
    let seedListingsCount = 0;
    for (const lDoc of listingsSnap.docs) {
      const data = lDoc.data();
      const isSeedListing =
        data.isSeed === true ||
        data.isDemo === true ||
        data.sample === true ||
        seedUserIds.has(data.ownerId) ||
        (data.ownerId && data.ownerId.startsWith(SEED_TAG)) ||
        (data.title && (data.title.includes('[Demo]') || data.title.includes('Seed')));

      if (isSeedListing) {
        queueDelete(lDoc.ref);
        seedListingsCount++;
        totalDeleted++;
      }
    }
    log(`Identified ${seedListingsCount} demo/seed listings.`);

    // 3. Scan dependent collections
    const subCollections = ['connections', 'chatRooms', 'notifications', 'listingViews', 'reports', 'verifications'];
    for (const col of subCollections) {
      log(`Checking ${col}...`);
      try {
        const snap = await getDocs(collection(db, col));
        let count = 0;
        for (const d of snap.docs) {
          const data = d.data();
          const shouldDelete =
            (data.userId && seedUserIds.has(data.userId)) ||
            (data.ownerId && seedUserIds.has(data.ownerId)) ||
            (data.fromUserId && seedUserIds.has(data.fromUserId)) ||
            (data.toUserId && seedUserIds.has(data.toUserId)) ||
            (data.reporterId && seedUserIds.has(data.reporterId)) ||
            (data.reportedUserId && seedUserIds.has(data.reportedUserId)) ||
            (data.participants && data.participants.some((p: string) => seedUserIds.has(p))) ||
            col === 'listingViews';

          if (shouldDelete) {
            queueDelete(d.ref);
            count++;
            totalDeleted++;
          }
        }
        if (count > 0) log(`Queued ${count} ${col} for removal.`);
      } catch (err) {
        // Skip inaccessible collections
      }
    }

    if (batchOps > 0) {
      const b = currentBatch;
      batches.push(() => b.commit());
    }

    log(`Committing database changes in ${batches.length} batch(es)...`);
    for (const commitFn of batches) {
      await commitFn();
    }

    log(`Cleanup complete! Removed ${totalDeleted} demo & seed documents.`);
    return totalDeleted;
  }, [user?.uid]);

  /**
   * Nuclear wipe: Completely purges all collections across the entire database,
   * resets local storage/caches, and optionally deletes the current Firebase Auth account.
   */
  const wipeEntireDatabase = useCallback(async (
    options: { deleteCurrentAuthAccount?: boolean } = {},
    onProgress?: (msg: string) => void
  ) => {
    const log = (m: string) => onProgress?.(m);
    log('⚠️ INITIATING COMPLETE FACTORY RESET (NUCLEAR WIPE)...');

    let totalDeleted = 0;
    // Order matters: dependent child records first, core entities, and admin access dead last!
    const collectionsToWipe = [
      'connections',
      'notifications',
      'listingViews',
      'reports',
      'verifications',
      'reviews',
      'matches',
      'supportTickets',
      'analyticsEvents',
      'listings',
      'privateUserData',
      'users',
      'adminAuditLogs',
      'adminConfig',
      'admins', // Deleted last so admin permissions are retained during the wipe
    ];

    const batches: Array<() => Promise<void>> = [];
    let currentBatch = writeBatch(db);
    let batchOps = 0;

    const queueDelete = (ref: any) => {
      currentBatch.delete(ref);
      batchOps++;
      if (batchOps >= 400) {
        const b = currentBatch;
        batches.push(() => b.commit());
        currentBatch = writeBatch(db);
        batchOps = 0;
      }
    };

    // 1. Wipe chat subcollections first (messages), then chatRooms
    try {
      log('Scanning chat rooms and purging message subcollections...');
      const chatRoomsSnap = await getDocs(collection(db, 'chatRooms'));
      let msgCount = 0;
      for (const roomDoc of chatRoomsSnap.docs) {
        try {
          const msgsSnap = await getDocs(collection(db, 'chatRooms', roomDoc.id, 'messages'));
          for (const mDoc of msgsSnap.docs) {
            queueDelete(mDoc.ref);
            msgCount++;
            totalDeleted++;
          }
        } catch {
          // ignore if subcollection query fails
        }
        queueDelete(roomDoc.ref);
        totalDeleted++;
      }
      log(`✓ Purged ${chatRoomsSnap.size} chat rooms and ${msgCount} message(s).`);
    } catch (e) {
      log(`Note: chatRooms scan skipped: ${(e as Error)?.message || e}`);
    }

    // 2. Wipe each collection in order
    for (const col of collectionsToWipe) {
      log(`Scanning and purging collection: '${col}'...`);
      try {
        const snap = await getDocs(collection(db, col));
        let count = 0;
        for (const docSnap of snap.docs) {
          queueDelete(docSnap.ref);
          count++;
          totalDeleted++;
        }
        log(`✓ Purged ${count} document(s) from '${col}'.`);
      } catch (err) {
        log(`⚠️ Could not query '${col}': ${(err as Error)?.message || err}`);
      }
    }

    // Commit remaining batch ops
    if (batchOps > 0) {
      const b = currentBatch;
      batches.push(() => b.commit());
    }

    log(`Committing ${batches.length} batch deletion(s) to Firestore...`);
    for (let i = 0; i < batches.length; i++) {
      log(`Executing deletion batch ${i + 1} of ${batches.length}...`);
      await batches[i]();
    }

    log(`✅ All database collections cleared! Total documents erased: ${totalDeleted}.`);

    // 3. Clear browser local storage & session storage
    log('Clearing local client storage, session cache, and offline stores...');
    try {
      localStorage.clear();
      sessionStorage.clear();
      log('✓ Local and session storage completely cleared.');
    } catch {
      // storage clear ignore
    }

    // 4. Delete current auth user account if requested
    if (options.deleteCurrentAuthAccount && auth.currentUser) {
      const currentEmail = auth.currentUser.email || auth.currentUser.uid;
      log(`Deleting current Firebase Auth user (${currentEmail})...`);
      try {
        await deleteUser(auth.currentUser);
        log(`✓ Successfully deleted auth user account (${currentEmail}) from Firebase Authentication.`);
      } catch (err) {
        log(`⚠️ Notice: Deleting your current Firebase Auth user requires recent login: ${(err as Error)?.message || err}`);
      }
    }

    return totalDeleted;
  }, []);

  return {
    isAdmin, checking,
    getMetrics, getAllUsers, suspendUser, banUser, reinstateUser, updateUserVerification,
    getAllListings, updateListingStatus, deleteListing,
    broadcastNotification, getBroadcastHistory,
    getAllReports, updateReportStatus,
    getAllVerifications, getAllOwnerVerifications, approveVerification, rejectVerification,
    requestResubmission, beginReview,
    getAdmins, addAdmin, removeAdmin, getAdminConfig, updateAdminEmails,
    cleanDemoAndSeedData,
    wipeEntireDatabase,
  };
}

