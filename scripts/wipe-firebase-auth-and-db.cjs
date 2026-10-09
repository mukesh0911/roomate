/**
 * NestMate — Automated Nuclear Database & Authentication Cleaner
 *
 * This script provides a complete platform wipe using the Firebase Admin SDK.
 * It deletes all documents across every Firestore collection AND deletes all
 * registered user accounts in Firebase Authentication.
 *
 * Usage:
 *   1. Download your Firebase service account key JSON from:
 *      Firebase Console -> Project Settings -> Service accounts -> Generate new private key
 *   2. Save it as `serviceAccountKey.json` in the root or scripts/ folder.
 *   3. Run:
 *      node scripts/wipe-firebase-auth-and-db.cjs ./serviceAccountKey.json
 *
 * Or if you only want to wipe Firestore:
 *   You can use the Admin Console directly at http://localhost:3002/admin/settings
 *   under "Danger Zone: Nuclear Factory Reset".
 */

const fs = require('fs');
const path = require('path');

// Check arguments
const keyArg = process.argv[2] || process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(keyArg)) {
  console.log('----------------------------------------------------------------------');
  console.log('⚠️  FIREBASE SERVICE ACCOUNT KEY NOT DETECTED');
  console.log('----------------------------------------------------------------------');
  console.log(`Looked for key file at: ${keyArg}`);
  console.log('\nTo wipe Firebase Authentication user accounts programmatically:');
  console.log('1. Go to Firebase Console -> Project Settings -> Service accounts');
  console.log('2. Click "Generate new private key"');
  console.log('3. Save the JSON file as "serviceAccountKey.json" in this directory');
  console.log('4. Run: node scripts/wipe-firebase-auth-and-db.cjs ./serviceAccountKey.json\n');
  console.log('ALTERNATIVE: Wipe Firestore directly from the UI:');
  console.log('Open http://localhost:3002/admin/settings in your browser and click:');
  console.log('  -> "Danger Zone: Nuclear Factory Reset"');
  console.log('----------------------------------------------------------------------');
  process.exit(1);
}

// Dynamically require firebase-admin
let admin;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.log('Installing firebase-admin dependency temporarily...');
  require('child_process').execSync('npm install --no-save firebase-admin', { stdio: 'inherit' });
  admin = require('firebase-admin');
}

const serviceAccount = JSON.parse(fs.readFileSync(keyArg, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();
const auth = admin.auth();

async function deleteCollection(collectionPath, batchSize = 100) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function wipeAll() {
  console.log('\n======================================================');
  console.log('🚨 STARTING COMPLETE FIREBASE FACTORY RESET');
  console.log('======================================================\n');

  // 1. Delete all Firestore Collections
  const collections = [
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
    'admins'
  ];

  console.log('Step 1: Purging all Firestore Collections...');
  for (const col of collections) {
    try {
      process.stdout.write(`  Clearing collection '${col}'... `);
      await deleteCollection(col);
      console.log('✓ Cleared');
    } catch (err) {
      console.log(`⚠️ Skipped (${err.message})`);
    }
  }

  // 2. Delete all Firebase Auth Users
  console.log('\nStep 2: Purging all Firebase Authentication User Accounts...');
  try {
    let nextPageToken;
    let totalAuthDeleted = 0;
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      const uids = listUsersResult.users.map((userRecord) => userRecord.uid);
      if (uids.length > 0) {
        const deleteResult = await auth.deleteUsers(uids);
        totalAuthDeleted += deleteResult.successCount;
        console.log(`  Deleted ${deleteResult.successCount} auth user(s)...`);
      }
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    console.log(`✓ Completely deleted ${totalAuthDeleted} user account(s) from Firebase Auth.`);
  } catch (err) {
    console.error(`⚠️ Error wiping Firebase Auth users: ${err.message}`);
  }

  console.log('\n======================================================');
  console.log('✅ FACTORY RESET COMPLETE! Database and accounts are clean.');
  console.log('======================================================\n');
}

wipeAll().catch(console.error);
