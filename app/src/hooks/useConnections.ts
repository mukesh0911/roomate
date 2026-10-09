import { useCallback } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  orderBy,
  doc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  or,
  writeBatch,
  increment,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  FREE_CONNECT_LIMIT,
  findExistingConnectionId,
  countConnectionsSince,
} from '@/lib/connectionGuards';

export interface Connection {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: Timestamp;
  /** Sprint 3C — listing attribution: which listing this interest originated from (optional, legacy docs lack it) */
  listingId?: string;
  /** Screening questionnaire responses submitted by the seeker */
  screeningAnswers?: Record<string, any>;
}

export { FREE_CONNECT_LIMIT };

export type RelationshipState = 'connected' | 'pending_sent' | 'pending_received' | 'none';

export function getRelationshipState(
  currentUserId: string | undefined,
  targetUserId: string,
  connections: Connection[],
  chatRoomMap?: Record<string, string>
): RelationshipState {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return 'none';
  if (chatRoomMap && chatRoomMap[targetUserId]) return 'connected';

  const conn = connections.find(
    c =>
      (c.fromUserId === currentUserId && c.toUserId === targetUserId) ||
      (c.toUserId === currentUserId && c.fromUserId === targetUserId)
  );

  if (!conn) return 'none';
  if (conn.status === 'accepted') return 'connected';
  if (conn.status === 'pending') {
    return conn.fromUserId === currentUserId ? 'pending_sent' : 'pending_received';
  }
  return 'none';
}

export function useConnections() {
  /** Count outgoing connections sent this calendar month */
  const getMonthlyConnectCount = useCallback(async (userId: string): Promise<number> => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startMs = startOfMonth.getTime();

    const q = query(
      collection(db, 'connections'),
      where('fromUserId', '==', userId)
    );
    const snap = await getDocs(q);
    const msList = snap.docs.map(d => {
      const createdAt = d.data().createdAt;
      if (!createdAt) return 0;
      return createdAt.toMillis ? createdAt.toMillis() : (createdAt instanceof Date ? createdAt.getTime() : 0);
    });
    return countConnectionsSince(msList, startMs);
  }, []);

  /**
   * Send a connect request from `fromId` to `toId`. Returns the connection doc ID.
   *
   * Sprint 3C — optional `opts.listingId` records which listing the interest
   * originated from. Firestore rules enforce that a supplied listingId must
   * reference an existing listing owned by `toId`, so a client cannot claim
   * another owner's listing. Legacy connections (no listingId) are unaffected.
   */
  const sendRequest = useCallback(
    async (
      fromId: string,
      toId: string,
      opts?: { listingId?: string; screeningAnswers?: Record<string, any> }
    ): Promise<string> => {
      if (fromId === toId) throw new Error("Cannot connect with yourself");

      const q = query(
        collection(db, 'connections'),
        where('fromUserId', '==', fromId),
        where('toUserId', '==', toId)
      );
      const existing = await getDocs(q);
      const q2 = query(
        collection(db, 'connections'),
        where('fromUserId', '==', toId),
        where('toUserId', '==', fromId)
      );
      const existing2 = await getDocs(q2);

      const allDocs = [...existing.docs, ...existing2.docs];
      if (allDocs.length > 0) {
        // Return existing connection id if already exists (accepted or pending)
        const activeDoc = allDocs.find(d => d.data().status === 'accepted' || d.data().status === 'pending');
        return activeDoc ? activeDoc.id : allDocs[0].id;
      }

      // Pre-check quota before dispatching
      const userSnap = await getDoc(doc(db, 'users', fromId));
      const userData = userSnap.exists() ? userSnap.data() : null;
      const isPremium = userData?.isPremium === true;
      const currentConnectsUsed = userData?.connectsUsed ?? 0;

      if (!isPremium && currentConnectsUsed >= FREE_CONNECT_LIMIT) {
        throw new Error(`Free connection limit reached (${FREE_CONNECT_LIMIT}/${FREE_CONNECT_LIMIT}). Upgrade to NestMate Pro for unlimited connections.`);
      }

      // Only attach listingId when provided AND non-empty; rules validate ownership.
      const listingId = opts?.listingId?.trim();
      const screeningAnswers = opts?.screeningAnswers;

      // Atomically create connection record AND increment user's connectsUsed counter
      const batch = writeBatch(db);
      const connRef = doc(collection(db, 'connections'));
      batch.set(connRef, {
        fromUserId: fromId,
        toUserId: toId,
        status: 'pending',
        createdAt: serverTimestamp(),
        ...(listingId ? { listingId } : {}),
        ...(screeningAnswers ? { screeningAnswers } : {}),
      });
      batch.set(doc(db, 'users', fromId), {
        connectsUsed: increment(1),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await batch.commit();

      return connRef.id;
    },
    []
  );

  /** Get all pending requests sent TO a specific user */
  const getIncomingRequests = useCallback(async (userId: string): Promise<Connection[]> => {
    const q = query(
      collection(db, 'connections'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    const conns = snap.docs.map(d => ({ id: d.id, ...d.data() } as Connection));
    conns.sort((a, b) => {
      const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return bMs - aMs;
    });
    return conns;
  }, []);

  /** Get all connections for a user (any direction, any status) */
  const getMyConnections = useCallback(async (userId: string, status?: string): Promise<Connection[]> => {
    const results: Connection[] = [];

    const q1 = query(collection(db, 'connections'), where('fromUserId', '==', userId));
    const q2 = query(collection(db, 'connections'), where('toUserId', '==', userId));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    [...s1.docs, ...s2.docs].forEach(d => {
      const data = { id: d.id, ...d.data() } as Connection;
      if (!status || data.status === status) results.push(data);
    });
    return results;
  }, []);

  /** Get a single connection document by ID */
  const getConnectionById = useCallback(async (connectionId: string): Promise<Connection | null> => {
    const snap = await getDoc(doc(db, 'connections', connectionId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Connection;
  }, []);

  /** Accept a connection request */
  const acceptRequest = useCallback(async (connectionId: string) => {
    const snap = await getDoc(doc(db, 'connections', connectionId));
    if (!snap.exists()) throw new Error('Connection request not found.');
    const { fromUserId, toUserId } = snap.data();
    if (!fromUserId || !toUserId) throw new Error('Connection participants are invalid.');

    // One atomic state transition. Firestore rules validate each acceptedPairs
    // document against the post-batch accepted connection via getAfter().
    const batch = writeBatch(db);
    batch.update(doc(db, 'connections', connectionId), { status: 'accepted' });
    batch.set(doc(db, 'acceptedPairs', `${fromUserId}_${toUserId}`), {
      user1: fromUserId,
      user2: toUserId,
      connectionId,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db, 'acceptedPairs', `${toUserId}_${fromUserId}`), {
      user1: toUserId,
      user2: fromUserId,
      connectionId,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  }, []);

  /** Reject a connection request */
  const rejectRequest = useCallback(async (connectionId: string) => {
    const snap = await getDoc(doc(db, 'connections', connectionId));
    if (snap.exists()) {
      const { fromUserId, toUserId } = snap.data();
      if (fromUserId && toUserId) {
        try {
          await Promise.all([
            deleteDoc(doc(db, 'acceptedPairs', `${fromUserId}_${toUserId}`)),
            deleteDoc(doc(db, 'acceptedPairs', `${toUserId}_${fromUserId}`)),
          ]);
        } catch {}
      }
    }
    await updateDoc(doc(db, 'connections', connectionId), {
      status: 'rejected',
    });
  }, []);

  /** Block a user */
  const blockUser = useCallback(async (connectionId: string) => {
    const snap = await getDoc(doc(db, 'connections', connectionId));
    if (snap.exists()) {
      const { fromUserId, toUserId } = snap.data();
      if (fromUserId && toUserId) {
        try {
          await Promise.all([
            deleteDoc(doc(db, 'acceptedPairs', `${fromUserId}_${toUserId}`)),
            deleteDoc(doc(db, 'acceptedPairs', `${toUserId}_${fromUserId}`)),
          ]);
        } catch {}
      }
    }
    await updateDoc(doc(db, 'connections', connectionId), {
      status: 'blocked',
    });
  }, []);

  /** Subscribe to incoming pending requests (real-time) — used by OwnerDashboard */
  const subscribeToIncoming = useCallback(
    (userId: string, onChange: (conns: Connection[]) => void) => {
      const q = query(
        collection(db, 'connections'),
        where('toUserId', '==', userId),
        where('status', '==', 'pending')
      );
      return onSnapshot(q, snap => {
        const conns = snap.docs.map(d => ({ id: d.id, ...d.data() } as Connection));
        conns.sort((a, b) => {
          const aMs = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bMs = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bMs - aMs;
        });
        onChange(conns);
      });
    },
    []
  );

  /**
   * Subscribe to ALL connections involving a user in either direction (real-time).
   * Used by SeekerDashboard and MatchDetail so button states update instantly
   * when the other party accepts/rejects without a page refresh.
   *
   * Firestore does not support OR queries across two fields directly, so we run
   * two listeners and merge them in memory, deduplicating by connection ID.
   */
  const subscribeToMyConnections = useCallback(
    (userId: string, onChange: (conns: Connection[]) => void) => {
      const map = new Map<string, Connection>();

      const notify = () => onChange(Array.from(map.values()));

      const qSent = query(
        collection(db, 'connections'),
        where('fromUserId', '==', userId)
      );
      const qReceived = query(
        collection(db, 'connections'),
        where('toUserId', '==', userId)
      );

      const unsubSent = onSnapshot(qSent, snap => {
        snap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Connection));
        // Remove any docs that were deleted from this query
        snap.docChanges().filter(c => c.type === 'removed').forEach(c => map.delete(c.doc.id));
        notify();
      });

      const unsubReceived = onSnapshot(qReceived, snap => {
        snap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() } as Connection));
        snap.docChanges().filter(c => c.type === 'removed').forEach(c => map.delete(c.doc.id));
        notify();
      });

      // Return a combined unsubscribe function
      return () => {
        unsubSent();
        unsubReceived();
      };
    },
    []
  );

  return {
    sendRequest,
    getIncomingRequests,
    getMyConnections,
    getConnectionById,
    acceptRequest,
    rejectRequest,
    blockUser,
    subscribeToIncoming,
    subscribeToMyConnections,
    getMonthlyConnectCount,
  };
}

/**
 * Generate a valid WhatsApp deep link.
 * Handles Indian numbers (adds country code 91 if 10 digits) or international numbers.
 * Strips formatting characters, spaces, and hyphens.
 */
export function formatWhatsAppDeepLink(phone: string, text?: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (!clean) return '';
  // If 10 digits, default to Indian country code 91
  const fullNumber = clean.length === 10 ? `91${clean}` : clean;
  const baseUrl = `https://wa.me/${fullNumber}`;
  return text ? `${baseUrl}?text=${encodeURIComponent(text)}` : baseUrl;
}

/**
 * Fetch private WhatsApp contact information for an accepted connection partner.
 * Protected by Firestore security rules (only accessible to parties with an accepted connection).
 */
export async function getConnectedUserWhatsApp(targetUserId: string): Promise<string | null> {
  if (!targetUserId) return null;
  try {
    const snap = await getDoc(doc(db, 'userContacts', targetUserId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return data?.whatsappNumber || null;
  } catch (err) {
    // If not accepted connection, Firestore security rules will safely reject the read
    return null;
  }
}
