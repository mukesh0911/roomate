const fs = require('fs');
const path = require('path');
const https = require('https');

async function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config.tokens.access_token;
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function listDocuments(collectionId, token, projectId = 'nestmate-eb562') {
  let docs = [];
  let pageToken = '';
  do {
    let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}?pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await request(url, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.data && res.data.documents) {
      docs.push(...res.data.documents);
    }
    pageToken = res.data ? res.data.nextPageToken : null;
  } while (pageToken);
  return docs;
}

async function deleteDocument(docPath, token) {
  // docPath is full name e.g. "projects/nestmate-eb562/databases/(default)/documents/listings/yoyt0O0j25ZqJTOy3alQ"
  const url = `https://firestore.googleapis.com/v1/${docPath}`;
  const res = await request(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.status;
}

async function listStorageFiles(bucket, token) {
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o`;
  const res = await request(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.data && res.data.items ? res.data.items.map(i => i.name) : [];
}

async function deleteStorageFile(bucket, fileName, token) {
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(fileName)}`;
  const res = await request(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return res.status;
}

async function main() {
  const isExecute = process.argv.includes('--execute');
  const token = await getAccessToken();
  const projectId = 'nestmate-eb562';
  const bucket = 'nestmate-eb562.firebasestorage.app';

  console.log('====================================================');
  console.log(`MODE: ${isExecute ? 'EXECUTE (DELETING DATA)' : 'DRY RUN (NO CHANGES MADE)'}`);
  console.log(`Target Project: ${projectId}`);
  console.log(`Target Bucket: ${bucket}`);
  console.log('====================================================\n');

  // 1. Identify protected admin credentials
  console.log('1. Checking Admin Registry...');
  const adminDocs = await listDocuments('admins', token, projectId);
  const protectedAdminEmails = adminDocs.map(d => d.name.split('/').pop().toLowerCase());
  console.log(`Protected Admin Emails: ${protectedAdminEmails.join(', ')}`);

  // 2. Identify collections to purge
  const purgeCollections = [
    'listings',
    'notifications',
    'ownerVerifications',
    'verifications',
    'applications',
    'connections',
    'connectionPairs',
    'conversationPairs',
    'chatRooms',
    'reports',
    'accountDeletionJobs',
    'accountExports',
    'supportTickets',
    'userKyc'
  ];

  console.log('\n2. Scanning Data Collections for Deletion...');
  for (const col of purgeCollections) {
    const docs = await listDocuments(col, token, projectId);
    console.log(`- Collection '${col}': ${docs.length} documents found.`);
    for (const d of docs) {
      const docId = d.name.split('/').pop();
      if (isExecute) {
        const status = await deleteDocument(d.name, token);
        console.log(`  [DELETED] ${col}/${docId} (HTTP ${status})`);
      } else {
        console.log(`  [WOULD DELETE] ${col}/${docId}`);
      }
    }
  }

  // 3. Scan Storage Bucket
  console.log('\n3. Scanning Storage Bucket...');
  const storageFiles = await listStorageFiles(bucket, token);
  console.log(`Storage files found: ${storageFiles.length}`);
  for (const file of storageFiles) {
    if (isExecute) {
      const status = await deleteStorageFile(bucket, file, token);
      console.log(`  [DELETED FILE] ${file} (HTTP ${status})`);
    } else {
      console.log(`  [WOULD DELETE FILE] ${file}`);
    }
  }

  // 4. Handle Users and PrivateUserData
  console.log('\n4. Evaluating Users & PrivateUserData...');
  const userDocs = await listDocuments('users', token, projectId);
  for (const d of userDocs) {
    const uid = d.name.split('/').pop();
    // Check if this user is an admin
    // Read privateUserData to find their email
    const pUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/privateUserData/${uid}`;
    const pRes = await request(pUrl, { headers: { 'Authorization': `Bearer ${token}` } });
    const userEmail = pRes.data && pRes.data.fields && pRes.data.fields.email ? pRes.data.fields.email.stringValue.toLowerCase() : '';
    const isAdmin = protectedAdminEmails.includes(userEmail);

    if (isAdmin) {
      console.log(`  [PRESERVING ADMIN USER] UID: ${uid} (Email: ${userEmail})`);
      if (isExecute) {
        // Reset listing-specific & test data on admin user doc, but keep admin account active
        const patchUrl = `https://firestore.googleapis.com/v1/${d.name}?updateMask.fieldPaths=savedRoomIds&updateMask.fieldPaths=savedProfileIds&updateMask.fieldPaths=bio&updateMask.fieldPaths=housingIntent&updateMask.fieldPaths=isVerified&updateMask.fieldPaths=verificationLevel&updateMask.fieldPaths=housingPreferences`;
        const resetPayload = {
          fields: {
            savedRoomIds: { arrayValue: {} },
            savedProfileIds: { arrayValue: {} },
            bio: { stringValue: '' },
            housingIntent: { stringValue: 'find_room' },
            isVerified: { booleanValue: false },
            verificationLevel: { integerValue: 0 },
            housingPreferences: {
              mapValue: {
                fields: {
                  activeIntents: { arrayValue: { values: [{ stringValue: 'find_room' }] } },
                  preferredCities: { arrayValue: { values: [{ stringValue: 'Bengaluru' }] } },
                  preferredLocalities: { arrayValue: {} }
                }
              }
            }
          }
        };
        const patchRes = await request(patchUrl, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(resetPayload)
        });
        console.log(`  [RESET ADMIN PROFILE DATA] UID: ${uid} (HTTP ${patchRes.status})`);
      } else {
        console.log(`  [WOULD RESET TEST LISTING / BIO DATA] UID: ${uid}`);
      }
    } else {
      console.log(`  [NON-ADMIN USER] UID: ${uid} (Email: ${userEmail})`);
      if (isExecute) {
        await deleteDocument(d.name, token);
        await deleteDocument(`projects/${projectId}/databases/(default)/documents/privateUserData/${uid}`, token);
        console.log(`  [DELETED NON-ADMIN USER] ${uid}`);
      } else {
        console.log(`  [WOULD DELETE NON-ADMIN USER] ${uid}`);
      }
    }
  }

  // 5. Discovery signals reset
  console.log('\n5. Resetting Discovery Signals...');
  if (isExecute) {
    const sigUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/discoverySignals/global`;
    const sigRes = await request(sigUrl, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          updatedAt: { timestampValue: new Date().toISOString() }
        }
      })
    });
    console.log(`  [UPDATED] discoverySignals/global (HTTP ${sigRes.status})`);
  } else {
    console.log('  [WOULD UPDATE] discoverySignals/global with current timestamp');
  }

  // 6. Verify Admin Protection
  console.log('\n6. Verifying Admin Protection Integrity...');
  const verifyAdmins = await listDocuments('admins', token, projectId);
  console.log(`Admin documents remaining: ${verifyAdmins.length}`);
  for (const a of verifyAdmins) {
    console.log(`  - Preserved Admin: ${a.name.split('/').pop()}`);
  }

  const verifyConfig = await listDocuments('config', token, projectId);
  console.log(`Config documents remaining: ${verifyConfig.length}`);
  for (const c of verifyConfig) {
    console.log(`  - Preserved Config: ${c.name.split('/').pop()}`);
  }

  console.log('\n====================================================');
  console.log(isExecute ? 'DATABASE CLEANUP COMPLETED SUCCESSFULLY' : 'DRY RUN COMPLETE — READY TO EXECUTE');
  console.log('====================================================');
}

main().catch(console.error);
