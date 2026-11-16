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

function parseFirestoreValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('mapValue' in val) {
    const out = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      out[k] = parseFirestoreValue(v);
    }
    return out;
  }
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(parseFirestoreValue);
  }
  return val;
}

function parseDoc(doc) {
  const out = {};
  for (const [k, v] of Object.entries(doc.fields || {})) {
    out[k] = parseFirestoreValue(v);
  }
  return out;
}

async function listDocuments(collectionId, token, projectId = 'nestmate-eb562') {
  let docs = [];
  let pageToken = '';
  do {
    let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}?pageSize=100`;
    if (pageToken) url += `&pageToken=${pageToken}`;
    const res = await request(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.data.documents) {
      docs.push(...res.data.documents);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return docs;
}

async function main() {
  const token = await getAccessToken();
  const projectId = 'nestmate-eb562';
  
  // 1. Inspect admins
  console.log('=== ADMINS ===');
  const adminDocs = await listDocuments('admins', token);
  for (const d of adminDocs) {
    const id = d.name.split('/').pop();
    console.log(`Admin Doc ID: ${id}`, parseDoc(d));
  }

  // 2. Inspect users
  console.log('\n=== USERS ===');
  const userDocs = await listDocuments('users', token);
  console.log(`Total users found: ${userDocs.length}`);
  for (const d of userDocs) {
    const id = d.name.split('/').pop();
    const data = parseDoc(d);
    console.log(`User ID: ${id} | Email: ${data.email} | Name: ${data.name || data.displayName} | Role: ${data.role} | Status: ${data.status}`);
  }

  // 3. Inspect other collections counts
  const collections = [
    'config',
    'discoverySignals',
    'listings',
    'notifications',
    'ownerVerifications',
    'privateUserData',
    'verifications',
    'applications',
    'connections',
    'chatRooms',
    'reports'
  ];

  console.log('\n=== OTHER COLLECTIONS DOC COUNT ===');
  for (const col of collections) {
    const docs = await listDocuments(col, token);
    console.log(`Collection ${col}: ${docs.length} documents`);
    if (col === 'listings') {
      for (const d of docs) {
        const id = d.name.split('/').pop();
        const data = parseDoc(d);
        console.log(`  - Listing ID: ${id} | Title: ${data.title} | Owner: ${data.ownerId} | City: ${data.city}`);
      }
    }
    if (col === 'config') {
      for (const d of docs) {
        const id = d.name.split('/').pop();
        console.log(`  - Config ID: ${id}`, parseDoc(d));
      }
    }
  }
}

main().catch(console.error);
