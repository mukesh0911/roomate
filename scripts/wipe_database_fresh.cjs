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

  // 1. Check Protected Admin Registry
  console.log('1. Checking Superadmin Registry (PROTECTED)...');
  const adminDocs = await listDocuments('admins', token, projectId);
  console.log(`Protected Admins (${adminDocs.length}):`);
  for (const a of adminDocs) {
    console.log(`  - ${a.name.split('/').pop()}`);
  }

  const configDocs = await listDocuments('config', token, projectId);
  console.log(`Protected Config (${configDocs.length}):`);
  for (const c of configDocs) {
    console.log(`  - ${c.name.split('/').pop()}`);
  }

  // 2. Collections to completely purge
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
    'userKyc',
    'users',
    'privateUserData',
    'bookmarks'
  ];

  console.log('\n2. Purging Collections...');
  for (const col of purgeCollections) {
    const docs = await listDocuments(col, token, projectId);
    console.log(`- Collection '${col}': ${docs.length} documents found.`);
    for (const d of docs) {
      const docId = d.name.split('/').pop();
      if (col === 'chatRooms') {
        const msgs = await listDocuments(`chatRooms/${docId}/messages`, token, projectId);
        for (const m of msgs) {
          const mId = m.name.split('/').pop();
          if (isExecute) {
            await deleteDocument(m.name, token);
            console.log(`  [DELETED] chatRooms/${docId}/messages/${mId}`);
          } else {
            console.log(`  [WOULD DELETE] chatRooms/${docId}/messages/${mId}`);
          }
        }
      }
      if (isExecute) {
        const status = await deleteDocument(d.name, token);
        console.log(`  [DELETED] ${col}/${docId} (HTTP ${status})`);
      } else {
        console.log(`  [WOULD DELETE] ${col}/${docId}`);
      }
    }
  }

  // 3. Scan & Purge Storage Bucket
  console.log('\n3. Scanning & Purging Storage Bucket...');
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

  // 4. Reset Discovery Signals
  console.log('\n4. Resetting Discovery Signals...');
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

  // 5. Verify Post-Cleanup State
  if (isExecute) {
    console.log('\n5. Verifying Database State Post-Cleanup...');
    for (const col of purgeCollections) {
      const remainingDocs = await listDocuments(col, token, projectId);
      console.log(`  - ${col}: ${remainingDocs.length} remaining`);
    }

    const verifyAdmins = await listDocuments('admins', token, projectId);
    console.log(`  - admins (preserved): ${verifyAdmins.length} documents`);
    const verifyConfig = await listDocuments('config', token, projectId);
    console.log(`  - config (preserved): ${verifyConfig.length} documents`);
  }

  console.log('\n====================================================');
  console.log(isExecute ? 'FRESH DATABASE RESET COMPLETED SUCCESSFULLY' : 'DRY RUN COMPLETE — READY TO EXECUTE WITH --execute');
  console.log('====================================================');
}

main().catch(console.error);
