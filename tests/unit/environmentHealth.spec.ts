import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { assertTestEnvironment, PROTECTED_ACCOUNTS, FORBIDDEN_PROJECTS } from '../helpers/environmentGuard';
import { ApiTestContext } from '../helpers/apiTestContext';

test.describe('Phase 11: Test Environment & Data Health Check (Fail-Fast Gateways)', () => {
  const dataDir = path.resolve(__dirname, '../data');
  const universePath = path.join(dataDir, 'seed-universe.json');
  const authDir = path.resolve(__dirname, '../.auth');

  test('GATEWAY-01: Test Environment Isolation & Production Protection', async () => {
    const envCheck = assertTestEnvironment('environmentHealth');
    expect(envCheck.isolated).toBe(true);
    expect(FORBIDDEN_PROJECTS).not.toContain(envCheck.project);
    expect(PROTECTED_ACCOUNTS).toContain('mukvr46@gmail.com');
    expect(PROTECTED_ACCOUNTS).toContain('mrmukeshram111@gmail.com');
  });

  test('GATEWAY-02: Firebase Configuration & Endpoints Validity', async () => {
    const appEnvPath = path.resolve(__dirname, '../../app/.env');
    expect(fs.existsSync(appEnvPath)).toBe(true);

    const content = fs.readFileSync(appEnvPath, 'utf8');
    expect(content).toContain('VITE_FIREBASE_API_KEY=');
    expect(content).toContain('VITE_FIREBASE_PROJECT_ID=');
    expect(content).toContain('VITE_FIREBASE_AUTH_DOMAIN=');
  });

  test('GATEWAY-03: Deterministic Universe Artifact & Version Compatibility', async () => {
    expect(fs.existsSync(universePath)).toBe(true);
    const universe = JSON.parse(fs.readFileSync(universePath, 'utf8'));

    expect(Array.isArray(universe.seekers)).toBe(true);
    expect(Array.isArray(universe.owners)).toBe(true);
    expect(Array.isArray(universe.admins)).toBe(true);
    expect(Array.isArray(universe.listings)).toBe(true);
    expect(Array.isArray(universe.connections)).toBe(true);
    expect(Array.isArray(universe.chatRooms)).toBe(true);
    expect(Array.isArray(universe.messages)).toBe(true);
    expect(Array.isArray(universe.notifications)).toBe(true);
    expect(Array.isArray(universe.reports)).toBe(true);
    expect(Array.isArray(universe.verifications)).toBe(true);
  });

  test('GATEWAY-04: Test Identities (All 12 States & Roles Present)', async () => {
    const universe = JSON.parse(fs.readFileSync(universePath, 'utf8'));
    const allUsers = [...universe.seekers, ...universe.owners, ...universe.admins];
    const userMap = new Map(allUsers.map((u: any) => [u.uid, u]));

    // 1. SEEKER_A
    expect(userMap.has('test_user_ref')).toBe(true);
    expect(userMap.get('test_user_ref').role).toBe('seeker');

    // 2. SEEKER_B
    expect(userMap.has('test_user_perfect_match')).toBe(true);
    expect(userMap.get('test_user_perfect_match').role).toBe('seeker');

    // 3. OWNER_A
    expect(userMap.has('test_user_owner_01')).toBe(true);
    expect(userMap.get('test_user_owner_01').role).toBe('owner');

    // 4. OWNER_B
    expect(userMap.has('test_user_owner_02')).toBe(true);
    expect(userMap.get('test_user_owner_02').role).toBe('owner');

    // 5. ADMIN
    expect(userMap.has('test_user_admin')).toBe(true);

    // 6. ONBOARDING_PENDING
    expect(userMap.has('test_user_onboarding_pending')).toBe(true);
    expect(userMap.get('test_user_onboarding_pending').onboardingComplete).toBe(false);

    // 7. SUSPENDED_USER
    expect(userMap.has('test_user_suspended')).toBe(true);
    expect(userMap.get('test_user_suspended').status).toBe('suspended');

    // 8. BANNED_USER
    expect(userMap.has('test_user_banned')).toBe(true);
    expect(userMap.get('test_user_banned').status).toBe('banned');

    // 9. OWNER_PENDING_VERIFICATION
    expect(userMap.has('test_user_owner_03')).toBe(true);

    // 10. OWNER_APPROVED
    expect(userMap.has('test_user_owner_01')).toBe(true);
    expect(userMap.get('test_user_owner_01').isVerified).toBe(true);

    // 11. OWNER_REJECTED
    expect(userMap.has('test_user_owner_rejected')).toBe(true);

    // 12. PREMIUM_USER
    expect(userMap.has('test_user_pro_user')).toBe(true);
    expect(userMap.get('test_user_pro_user').isPremium).toBe(true);
  });

  test('GATEWAY-05: Listing Existence Across All 7 Lifecycle States', async () => {
    const universe = JSON.parse(fs.readFileSync(universePath, 'utf8'));
    const statuses = new Set(universe.listings.map((l: any) => l.status));

    expect(statuses.has('active')).toBe(true);
    expect(statuses.has('pending_verification')).toBe(true);
    expect(statuses.has('draft')).toBe(true);
    expect(statuses.has('paused')).toBe(true);
    expect(statuses.has('filled')).toBe(true);
    expect(statuses.has('closed')).toBe(true);
    expect(universe.listings.some((l: any) => l.title.includes('Expired'))).toBe(true);
  });

  test('GATEWAY-06: Connection Existence Across All 4 States', async () => {
    const universe = JSON.parse(fs.readFileSync(universePath, 'utf8'));
    const statuses = new Set(universe.connections.map((c: any) => c.status));

    expect(statuses.has('pending')).toBe(true);
    expect(statuses.has('accepted')).toBe(true);
    expect(statuses.has('rejected')).toBe(true);
    expect(statuses.has('blocked')).toBe(true);
  });

  test('GATEWAY-07: Messaging, Notifications & Moderation Integrity', async () => {
    const universe = JSON.parse(fs.readFileSync(universePath, 'utf8'));

    expect(universe.chatRooms.length).toBeGreaterThan(0);
    expect(universe.messages.length).toBeGreaterThanOrEqual(3);
    expect(universe.notifications.length).toBeGreaterThanOrEqual(3);
    expect(universe.reports.length).toBeGreaterThanOrEqual(2);
    expect(universe.verifications.length).toBeGreaterThanOrEqual(4);
  });

  test('GATEWAY-08: Relationship & Foreign Key Integrity (Zero Broken References)', async () => {
    const universe = JSON.parse(fs.readFileSync(universePath, 'utf8'));
    const allUsers = [...universe.seekers, ...universe.owners, ...universe.admins];
    const userMap = new Map(allUsers.map((u: any) => [u.uid, u]));

    // All listing owners exist
    for (const listing of universe.listings) {
      expect(userMap.has(listing.ownerId)).toBe(true);
    }

    // All connection participants exist
    for (const conn of universe.connections) {
      expect(userMap.has(conn.fromUserId)).toBe(true);
      expect(userMap.has(conn.toUserId)).toBe(true);
    }

    // All chat room participants exist
    for (const room of universe.chatRooms) {
      for (const p of room.participants) {
        expect(userMap.has(p)).toBe(true);
      }
    }

    // All notification recipients exist
    for (const notif of universe.notifications) {
      expect(userMap.has(notif.userId)).toBe(true);
    }
  });

  test('GATEWAY-09: Playwright StorageState Artifacts Present and Valid', async () => {
    const required = ['seekerA.json', 'seekerB.json', 'ownerA.json', 'ownerB.json', 'admin.json'];
    for (const file of required) {
      const filePath = path.join(authDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(data.origins.length).toBeGreaterThan(0);
      expect(data.origins[0].localStorage.length).toBeGreaterThan(0);
    }
  });

  test('GATEWAY-10: API Test Context & Deterministic IDs Mapped', async () => {
    const ids = ApiTestContext.getUniverseIds();
    expect(ids.seekerA).toBe('test_user_ref');
    expect(ids.ownerA).toBe('test_user_owner_01');
    expect(ids.admin).toBe('test_user_admin');
    expect(ids.activeListing).toBe('test_listing_live_01');
    expect(ids.acceptedConnection).toBe('test_conn_a01');
  });
});
