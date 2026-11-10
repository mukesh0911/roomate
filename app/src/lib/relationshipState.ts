export interface ConnectionRecord {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: string;
  listingId?: string;
}

export interface LiveRelationships {
  accepted: ConnectionRecord[];
  received: ConnectionRecord[];
  sent: ConnectionRecord[];
  restricted?: ConnectionRecord[];
}

export function relationshipState(viewer: string | undefined, target: string | undefined,
  connections: LiveRelationships, blockedUserIds: string[] = [],
  conversations: { id: string; participants: string[]; authorized: boolean }[] = []) {
  if (!target) return { state: 'unavailable' as const };
  if (viewer === target) return { state: 'self' as const };
  if (blockedUserIds.includes(target)) return { state: 'blocked' as const };
  const records = [...connections.accepted, ...connections.received, ...connections.sent,
    ...(connections.restricted || [])].filter(c => Boolean(viewer) &&
      ((c.fromUserId === viewer && c.toUserId === target) ||
       (c.toUserId === viewer && c.fromUserId === target)));
  const blocked = records.find(c => c.status === 'blocked');
  if (blocked) return { state: 'blocked' as const, connectionId: blocked.id };
  const conversation = conversations.find(c => c.authorized && !!viewer &&
    c.participants.length === 2 && c.participants.includes(viewer) && c.participants.includes(target));
  if (conversation) return { state: 'accepted' as const, conversationId: conversation.id };
  const accepted = records.find(c => c.status === 'accepted');
  if (accepted) return { state: 'accepted' as const, connectionId: accepted.id };
  const pending = records.find(c => c.status === 'pending');
  if (pending) return { state: pending.fromUserId === viewer ? 'sent' as const : 'received' as const,
    connectionId: pending.id };
  const rejected = records.find(c => c.status === 'rejected');
  if (rejected) return { state: 'declined' as const, connectionId: rejected.id };
  if (records.some(c => !['rejected', 'declined', 'disconnected', 'withdrawn', 'superseded'].includes(c.status))) return { state: 'restricted' as const };
  return { state: 'none' as const };
}
