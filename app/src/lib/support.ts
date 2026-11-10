import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export const supportTopics = ['account', 'verification', 'safety', 'listing', 'other'] as const;
export async function submitSupportTicket(topic: string, message: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to send a support request.');
  const text = message.trim();
  if (!supportTopics.includes(topic as typeof supportTopics[number]) || !text || text.length > 4000) {
    throw new Error('Choose a topic and enter a message of up to 4,000 characters.');
  }
  const ticket = await addDoc(collection(db, 'supportTickets'), {
    userId: user.uid, userName: (user.displayName || '').slice(0, 120),
    ...(user.email ? { userEmail: user.email } : {}),
    topic, message: text, status: 'open', createdAt: serverTimestamp(),
  });
  return ticket.id;
}
