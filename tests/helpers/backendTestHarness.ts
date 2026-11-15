/**
 * NestMate Backend & API Test Harness
 * Provides direct access to the certified test universe, database state verification,
 * and security rule evaluation without UI dependencies or mocked logic.
 */
import fs from 'fs';
import path from 'path';
import { ApiTestContext, ApiUserIdentity } from './apiTestContext';
import { BusinessRuleUtils } from './businessRuleUtils';
import { AccountFactory } from '../factories/accountFactory';
import { DataFactory } from '../factories/dataFactory';

const UNIVERSE_PATH = path.resolve(__dirname, '../data/seed-universe.json');

export interface SeedUniverseData {
  seekers: any[];
  owners: any[];
  admins: any[];
  listings: any[];
  connections: any[];
  chatRooms: any[];
  messages: any[];
  notifications: any[];
  reports: any[];
  verifications: any[];
}

export class BackendTestHarness {
  /**
   * Load the active deterministic seed universe from disk.
   */
  static loadUniverse(): SeedUniverseData {
    if (!fs.existsSync(UNIVERSE_PATH)) {
      throw new Error(`Certified universe artifact not found at ${UNIVERSE_PATH}. Run 'npm run test:seed' first.`);
    }
    return JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf-8'));
  }

  /**
   * Fetch a specific user document by UID from the certified universe.
   */
  static getUser(uid: string): any | null {
    const universe = this.loadUniverse();
    const allUsers = [...universe.seekers, ...universe.owners, ...universe.admins];
    return allUsers.find(u => u.uid === uid) || null;
  }

  /**
   * Fetch a listing by ID.
   */
  static getListing(id: string): any | null {
    const universe = this.loadUniverse();
    return universe.listings.find(l => l.id === id) || null;
  }

  /**
   * Fetch all listings owned by a specific owner ID.
   */
  static getListingsByOwner(ownerId: string): any[] {
    const universe = this.loadUniverse();
    return universe.listings.filter(l => l.ownerId === ownerId);
  }

  /**
   * Fetch a connection by ID.
   */
  static getConnection(id: string): any | null {
    const universe = this.loadUniverse();
    return universe.connections.find(c => c.id === id) || null;
  }

  /**
   * Fetch connections involving a user.
   */
  static getConnectionsForUser(userId: string): any[] {
    const universe = this.loadUniverse();
    return universe.connections.filter(c => c.fromUserId === userId || c.toUserId === userId);
  }

  /**
   * Fetch chat room by ID.
   */
  static getChatRoom(id: string): any | null {
    const universe = this.loadUniverse();
    return universe.chatRooms.find(r => r.id === id) || null;
  }

  /**
   * Fetch messages for a chat room.
   */
  static getMessages(roomId: string): any[] {
    const universe = this.loadUniverse();
    return universe.messages.filter(m => m.roomId === roomId);
  }

  /**
   * Fetch notifications for a target user ID.
   */
  static getNotifications(userId: string): any[] {
    const universe = this.loadUniverse();
    return (universe.notifications || []).filter(n => n.userId === userId);
  }

  /**
   * Fetch verification record by user ID.
   */
  static getVerification(userId: string): any | null {
    const universe = this.loadUniverse();
    return universe.verifications.find(v => v.userId === userId) || null;
  }

  /**
   * Fetch reports involving a reporter or target.
   */
  static getReports(): any[] {
    const universe = this.loadUniverse();
    return universe.reports || [];
  }

  /**
   * Complete foreign-key and database integrity audit.
   * Returns broken reference count and list of anomalies.
   */
  static auditIntegrity(): { brokenRefs: number; totalChecked: number; anomalies: string[] } {
    const universe = this.loadUniverse();
    const allUsers = [...universe.seekers, ...universe.owners, ...universe.admins];
    const userMap = new Map(allUsers.map(u => [u.uid, u]));
    const connMap = new Map(universe.connections.map(c => [c.id, c]));
    const roomMap = new Map(universe.chatRooms.map(r => [r.id, r]));

    const anomalies: string[] = [];
    let brokenRefs = 0;
    let totalChecked = 0;

    // 1. Listings -> Owners
    universe.listings.forEach(l => {
      totalChecked++;
      if (!userMap.has(l.ownerId)) {
        anomalies.push(`Listing ${l.id} ownerId ${l.ownerId} not found in users.`);
        brokenRefs++;
      }
    });

    // 2. Connections -> Users
    universe.connections.forEach(c => {
      totalChecked += 2;
      if (!userMap.has(c.fromUserId)) {
        anomalies.push(`Connection ${c.id} fromUserId ${c.fromUserId} not found.`);
        brokenRefs++;
      }
      if (!userMap.has(c.toUserId)) {
        anomalies.push(`Connection ${c.id} toUserId ${c.toUserId} not found.`);
        brokenRefs++;
      }
    });

    // 3. ChatRooms -> Users & Connections
    universe.chatRooms.forEach(cr => {
      cr.participants.forEach((p: string) => {
        totalChecked++;
        if (!userMap.has(p)) {
          anomalies.push(`ChatRoom ${cr.id} participant ${p} not found in users.`);
          brokenRefs++;
        }
      });
      if (cr.connectionId) {
        totalChecked++;
        if (!connMap.has(cr.connectionId)) {
          anomalies.push(`ChatRoom ${cr.id} connectionId ${cr.connectionId} not found.`);
          brokenRefs++;
        }
      }
    });

    // 4. Messages -> ChatRooms & Users
    universe.messages.forEach(m => {
      totalChecked++;
      const room = roomMap.get(m.roomId);
      if (!room) {
        anomalies.push(`Message ${m.id} roomId ${m.roomId} not found.`);
        brokenRefs++;
      } else if (!room.participants.includes(m.senderId)) {
        anomalies.push(`Message ${m.id} sender ${m.senderId} not in room participants.`);
        brokenRefs++;
      }
    });

    // 5. Notifications -> Users
    (universe.notifications || []).forEach(n => {
      totalChecked++;
      if (!userMap.has(n.userId)) {
        anomalies.push(`Notification ${n.id} userId ${n.userId} not found.`);
        brokenRefs++;
      }
    });

    // 6. Verifications -> Users
    universe.verifications.forEach(v => {
      totalChecked++;
      if (!userMap.has(v.userId)) {
        anomalies.push(`Verification ${v.id} userId ${v.userId} not found.`);
        brokenRefs++;
      }
    });

    // 7. Reports -> Users
    universe.reports.forEach(r => {
      totalChecked += 2;
      if (!userMap.has(r.reporterId)) {
        anomalies.push(`Report ${r.id} reporterId ${r.reporterId} not found.`);
        brokenRefs++;
      }
      if (!userMap.has(r.targetId)) {
        anomalies.push(`Report ${r.id} targetId ${r.targetId} not found.`);
        brokenRefs++;
      }
    });

    return { brokenRefs, totalChecked, anomalies };
  }

  // ─────────────────────────────────────────────────────────────
  // Server-Side Firestore Rule Evaluation Engine (Mirror of firestore.rules)
  // Evaluates authorization boundaries with exact same logic as Firestore rules
  // ─────────────────────────────────────────────────────────────

  /**
   * Evaluates if caller is an admin per firestore.rules isAdmin()
   */
  static isAdmin(authEmail?: string | null): boolean {
    if (!authEmail) return false;
    return ['admin@nestmate-test.com', 'admin@nestmate.in', 'mukvr46@gmail.com', 'mrmukeshram111@gmail.com'].includes(authEmail.toLowerCase().trim());
  }

  /**
   * Evaluates if caller can read privateUserData/{userId}
   * Rules: allow read, write: if isOwner(userId) || isAdmin();
   */
  static canAccessPrivateUserData(callerUid: string, targetUserId: string, callerEmail?: string): boolean {
    if (this.isAdmin(callerEmail)) return true;
    return !!callerUid && callerUid === targetUserId;
  }

  /**
   * Evaluates if caller can update user doc trust fields (isVerified, isPremium, etc.)
   * Rules: trustFieldsUnchanged() enforced on user update unless isAdmin()
   */
  static canMutateUserTrustFields(callerEmail?: string): boolean {
    return this.isAdmin(callerEmail);
  }

  /**
   * Evaluates if caller can modify user status (suspended, banned, active)
   * Rules: statusUnchanged() enforced on user update unless isAdmin()
   */
  static canMutateUserStatus(callerEmail?: string): boolean {
    return this.isAdmin(callerEmail);
  }

  /**
   * Evaluates if caller can create a listing
   * Rules: isActiveUser() && request.resource.data.ownerId == auth.uid && newListingFieldsSafe()
   */
  static canCreateListing(caller: { uid: string; status?: string; role?: string }, listingData: any): { allowed: boolean; reason?: string } {
    if (!caller.uid) return { allowed: false, reason: 'UNAUTHENTICATED' };
    if (caller.status === 'suspended' || caller.status === 'banned') return { allowed: false, reason: 'INACTIVE_USER_MUTATION_BLOCKED' };
    if (listingData.ownerId !== caller.uid) return { allowed: false, reason: 'OWNER_MISMATCH_SPOOFING_PROHIBITED' };
    if (listingData.ownerVerified === true) return { allowed: false, reason: 'OWNER_CANNOT_SELF_VERIFY_LISTING' };
    if (listingData.status === 'active') return { allowed: false, reason: 'NEW_LISTING_CANNOT_START_AS_ACTIVE' };
    if (!['pending_verification', 'paused'].includes(listingData.status || 'pending_verification')) {
      return { allowed: false, reason: 'INVALID_INITIAL_LISTING_STATUS' };
    }
    return { allowed: true };
  }

  /**
   * Evaluates if caller can mutate an existing listing
   * Rules: isOwner(resource.data.ownerId) && listingStatusValid() && ownerVerifiedUnchanged() && listingStatusUpdateSafe() || isAdmin()
   */
  static canUpdateListing(
    caller: { uid: string; email?: string; status?: string },
    existingListing: any,
    updates: any
  ): { allowed: boolean; reason?: string } {
    if (this.isAdmin(caller.email)) return { allowed: true };
    if (!caller.uid) return { allowed: false, reason: 'UNAUTHENTICATED' };
    if (caller.status === 'suspended' || caller.status === 'banned') return { allowed: false, reason: 'INACTIVE_USER_MUTATION_BLOCKED' };
    if (existingListing.ownerId !== caller.uid) return { allowed: false, reason: 'CROSS_OWNER_MUTATION_PROHIBITED' };
    if ('ownerVerified' in updates && updates.ownerVerified !== existingListing.ownerVerified) {
      return { allowed: false, reason: 'OWNER_VERIFIED_FIELD_IMMUTABLE_BY_NON_ADMIN' };
    }
    if (updates.status === 'active' && existingListing.ownerVerified !== true) {
      return { allowed: false, reason: 'UNVERIFIED_LISTING_CANNOT_BE_ACTIVATED_BY_OWNER' };
    }
    return { allowed: true };
  }

  /**
   * Evaluates if caller can create a connection
   * Rules: allow create: if isAuthenticated() && isActiveUser() && fromUserId == auth.uid && toUserId != auth.uid && status == 'pending' && (isAdmin || isPremium || connectionQuotaAvailable())
   */
  static canCreateConnection(
    caller: { uid: string; email?: string; status?: string; connectsUsed?: number; isPremium?: boolean },
    connectionData: any
  ): { allowed: boolean; reason?: string } {
    if (!caller.uid) return { allowed: false, reason: 'UNAUTHENTICATED' };
    if (caller.status === 'suspended' || caller.status === 'banned') return { allowed: false, reason: 'INACTIVE_USER_MUTATION_BLOCKED' };
    if (connectionData.fromUserId !== caller.uid) return { allowed: false, reason: 'SENDER_IDENTITY_MISMATCH' };
    if (connectionData.toUserId === caller.uid) return { allowed: false, reason: 'SELF_CONNECTION_PROHIBITED' };
    if (connectionData.status !== 'pending') return { allowed: false, reason: 'NEW_CONNECTION_MUST_BE_PENDING' };
    
    // Server-side quota check
    const isPremium = caller.isPremium === true;
    const connectsUsed = caller.connectsUsed ?? 0;
    const quotaAvailable = isPremium || connectsUsed < 5 || this.isAdmin(caller.email);
    if (!quotaAvailable) {
      return { allowed: false, reason: 'PERMISSION_DENIED: FREE_CONNECTION_LIMIT_REACHED (5/5)' };
    }

    return { allowed: true };
  }

  /**
   * Evaluates if caller can read a chat room and its messages
   * Rules: allow read: if isAuthenticated() && (request.auth.uid in resource.data.participants || isAdmin());
   */
  static canAccessChat(caller: { uid: string; email?: string }, roomParticipants: string[]): boolean {
    if (this.isAdmin(caller.email)) return true;
    if (!caller.uid) return false;
    return roomParticipants.includes(caller.uid);
  }

  /**
   * Evaluates if caller can read a notification
   * Rules: allow read: if isAuthenticated() && (request.auth.uid == resource.data.userId || isAdmin());
   */
  static canAccessNotification(caller: { uid: string; email?: string }, notificationTargetUserId: string): boolean {
    if (this.isAdmin(caller.email)) return true;
    if (!caller.uid) return false;
    return caller.uid === notificationTargetUserId;
  }

  /**
   * Evaluates if caller can submit/approve owner verification
   */
  static canTransitionVerification(
    caller: { uid: string; email?: string },
    targetUserId: string,
    fromStatus: string,
    toStatus: string
  ): { allowed: boolean; reason?: string } {
    if (this.isAdmin(caller.email)) return { allowed: true };
    if (caller.uid !== targetUserId) return { allowed: false, reason: 'CROSS_USER_VERIFICATION_PROHIBITED' };
    // Owner can only submit
    if (['APPROVED', 'UNDER_REVIEW', 'REJECTED', 'RESUBMISSION_REQUIRED'].includes(toStatus)) {
      return { allowed: false, reason: 'NON_ADMIN_CANNOT_APPROVE_OR_REVIEW_VERIFICATION' };
    }
    if (toStatus === 'SUBMITTED' && ['NOT_STARTED', 'REJECTED', 'RESUBMISSION_REQUIRED', 'SUBMITTED'].includes(fromStatus)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'INVALID_TRANSITION' };
  }
}
