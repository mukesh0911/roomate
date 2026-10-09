import { useState, useCallback } from 'react';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { assignSharedPhones } from '@/lib/phoneShare';

export interface PhoneSharing {
  requestedBy: string | null;
  requestedAt: Timestamp | null;
  acceptedBy: string | null;
  acceptedAt: Timestamp | null;
  requesterPhone?: string | null;
  ownerPhone: string | null;
  seekerPhone: string | null;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  matchId: string;
  lastMessage: string;
  lastMessageAt: Timestamp | null;
  createdAt: Timestamp;
  typingStatus?: Record<string, boolean>;
  phoneSharing?: PhoneSharing;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  read: boolean;
  createdAt: Timestamp;
  imageUrl?: string;
  isSystem?: boolean;
}

export function useChat() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const subscribeToChatRooms = useCallback(
    (userId: string, onChange: (rooms: ChatRoom[]) => void) => {
      const q = query(
        collection(db, 'chatRooms'),
        where('participants', 'array-contains', userId)
      );
      return onSnapshot(q, (snap) => {
        const rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatRoom));
        rooms.sort((a, b) => {
          const tA = (a.lastMessageAt as any)?.toMillis?.() || (a.createdAt as any)?.toMillis?.() || 0;
          const tB = (b.lastMessageAt as any)?.toMillis?.() || (b.createdAt as any)?.toMillis?.() || 0;
          return tB - tA;
        });
        onChange(rooms);
      });
    },
    []
  );

  const subscribeToMessages = useCallback(
    (roomId: string, onNewMessages: (msgs: Message[]) => void) => {
      const q = query(
        collection(db, 'chatRooms', roomId, 'messages'),
        orderBy('createdAt', 'asc')
      );
      return onSnapshot(q, (snap) => {
        const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
        onNewMessages(msgs);
      });
    },
    []
  );

  const getChatRooms = useCallback(async (userId: string): Promise<ChatRoom[]> => {
    const q = query(
      collection(db, 'chatRooms'),
      where('participants', 'array-contains', userId)
    );
    const snap = await getDocs(q);
    const rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatRoom));
    rooms.sort((a, b) => {
      const tA = (a.lastMessageAt as any)?.toMillis?.() || (a.createdAt as any)?.toMillis?.() || 0;
      const tB = (b.lastMessageAt as any)?.toMillis?.() || (b.createdAt as any)?.toMillis?.() || 0;
      return tB - tA;
    });
    return rooms;
  }, []);

  const getOrCreateChatRoom = useCallback(
    async (userIdA: string, userIdB: string, matchId?: string): Promise<string> => {
      const q = query(
        collection(db, 'chatRooms'),
        where('participants', 'array-contains', userIdA)
      );
      const snap = await getDocs(q);
      const existing = snap.docs.find((d) => {
        const data = d.data() as ChatRoom;
        return data.participants.includes(userIdB);
      });
      if (existing) return existing.id;

      const ref = await addDoc(collection(db, 'chatRooms'), {
        participants: [userIdA, userIdB],
        matchId: matchId || '',
        lastMessage: '',
        lastMessageAt: null,
        createdAt: serverTimestamp(),
        typingStatus: {},
        phoneSharing: {
          requestedBy: null, requestedAt: null,
          acceptedBy: null, acceptedAt: null,
          requesterPhone: null,
          ownerPhone: null, seekerPhone: null,
        },
      });
      return ref.id;
    },
    []
  );

  const sendMessage = useCallback(
    async (roomId: string, senderId: string, content: string, imageUrl?: string): Promise<void> => {
      const msgData: Record<string, unknown> = {
        senderId,
        content,
        read: false,
        createdAt: serverTimestamp(),
      };
      if (imageUrl) msgData.imageUrl = imageUrl;

      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), msgData);
      await updateDoc(doc(db, 'chatRooms', roomId), {
        lastMessage: imageUrl ? '📷 Photo' : content,
        lastMessageAt: serverTimestamp(),
        [`typingStatus.${senderId}`]: false,
      });
    },
    []
  );

  const sendSystemMessage = useCallback(
    async (roomId: string, senderId: string, content: string): Promise<void> => {
      await addDoc(collection(db, 'chatRooms', roomId, 'messages'), {
        senderId,
        content,
        read: true,
        isSystem: true,
        createdAt: serverTimestamp(),
      });
    },
    []
  );

  const markMessagesRead = useCallback(
    async (roomId: string, userId: string) => {
      const q = query(
        collection(db, 'chatRooms', roomId, 'messages'),
        where('read', '==', false)
      );
      const snap = await getDocs(q);
      const batch = snap.docs
        .filter((d) => d.data().senderId !== userId)
        .map((d) => updateDoc(d.ref, { read: true }));
      await Promise.all(batch);
    },
    []
  );

  // --- Typing Indicator ---
  const setTyping = useCallback(
    async (roomId: string, userId: string, isTyping: boolean) => {
      try {
        await updateDoc(doc(db, 'chatRooms', roomId), {
          [`typingStatus.${userId}`]: isTyping,
        });
      } catch (e) {
        // silently fail — typing is non-critical
      }
    },
    []
  );

  // --- Phone Sharing ---
  const requestPhoneShare = useCallback(
    async (roomId: string, requesterId: string, requesterName: string, requesterPhone: string) => {
      await updateDoc(doc(db, 'chatRooms', roomId), {
        'phoneSharing.requestedBy': requesterId,
        'phoneSharing.requestedAt': serverTimestamp(),
        'phoneSharing.requesterPhone': requesterPhone,
      });
      await sendSystemMessage(roomId, requesterId, `📱 ${requesterName} wants to share phone numbers`);
    },
    [sendSystemMessage]
  );

  const acceptPhoneShare = useCallback(
    async (
      roomId: string,
      accepterId: string,
      accepterName: string,
      accepterPhone: string,
      requesterPhone: string,
      requesterRole: 'owner' | 'seeker' | null,
      accepterRole: 'owner' | 'seeker' | null
    ) => {
      const { ownerPhone, seekerPhone } = assignSharedPhones({
        requesterPhone,
        accepterPhone,
        requesterRole,
      });

      await updateDoc(doc(db, 'chatRooms', roomId), {
        'phoneSharing.acceptedBy': accepterId,
        'phoneSharing.acceptedAt': serverTimestamp(),
        'phoneSharing.ownerPhone': ownerPhone,
        'phoneSharing.seekerPhone': seekerPhone,
      });
      await sendSystemMessage(roomId, accepterId, `✅ Phone numbers are now shared between both parties`);
    },
    [sendSystemMessage]
  );

  return {
    chatRooms,
    messages,
    isLoading,
    subscribeToChatRooms,
    subscribeToMessages,
    getChatRooms,
    getOrCreateChatRoom,
    sendMessage,
    sendSystemMessage,
    markMessagesRead,
    setTyping,
    requestPhoneShare,
    acceptPhoneShare,
  };
}
