import { useCallback } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  doc,
  serverTimestamp,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { auth } from '@/lib/firebase';

export interface Notification {
  id: string;
  userId: string;
  type: 'match' | 'message' | 'connect' | 'room' | 'agreement' | 'verification' | 'system';
  title: string;
  description: string;
  read: boolean;
  actionUrl?: string;
  actorId?: string;
  connectionId?: string;
  createdAt: Timestamp;
}

export function useNotifications() {
  /** Request browser push notification permissions */
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (err) {
      console.error('Failed to request notification permission', err);
      return false;
    }
  }, []);

  /** Subscribe to real-time notifications for a user */
  const subscribeToNotifications = useCallback(
    (userId: string, onChange: (notifs: Notification[]) => void) => {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId)
      );
      let isFirstRun = true;
      return onSnapshot(q, snap => {
        const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
        notifs.sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0));
        
        // Trigger native push notifications for new unread items
        if (!isFirstRun && 'Notification' in window && Notification.permission === 'granted') {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const newNotif = change.doc.data() as Notification;
              if (!newNotif.read) {
                new Notification(newNotif.title, {
                  body: newNotif.description,
                  icon: '/favicon.svg',
                });
              }
            }
          });
        }
        
        isFirstRun = false;
        onChange(notifs);
      });
    },
    []
  );

  /** Create a notification for a user */
  const createNotification = useCallback(
    async (data: Omit<Notification, 'id' | 'createdAt' | 'actorId'>) => {
      const actorId = auth.currentUser?.uid;
      if (!actorId) throw new Error('You must be signed in to create a notification.');
      await addDoc(collection(db, 'notifications'), {
        ...data,
        actorId,
        createdAt: serverTimestamp(),
      });
    },
    []
  );

  /** Mark a single notification as read */
  const markAsRead = useCallback(async (notifId: string) => {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  }, []);

  /** Mark all notifications as read for a user */
  const markAllRead = useCallback(async (userId: string) => {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })));
  }, []);

  /** Delete a notification */
  const deleteNotification = useCallback(async (notifId: string) => {
    await deleteDoc(doc(db, 'notifications', notifId));
  }, []);

  return {
    subscribeToNotifications,
    createNotification,
    markAsRead,
    markAllRead,
    deleteNotification,
    requestPermission,
  };
}
