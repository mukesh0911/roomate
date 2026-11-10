// Isolated HTTP host for the actual exported Firebase onCall wrappers.
// Authorization is performed by firebase-functions + the real Auth emulator.
const {createRequire}=require('node:module'),path=require('node:path');
const requireFunctions=createRequire(path.resolve('app/functions/package.json'));
const project=process.env.GCLOUD_PROJECT;
if(!project?.startsWith('demo-'))throw Error('Explicit demo project required.');
for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env[key]||''))throw Error('Loopback emulators required.');
process.env.FIREBASE_CONFIG=JSON.stringify({projectId:project,storageBucket:project+'.appspot.com'});
const express=requireFunctions('express'),handlers=require('../app/functions/index.js');
const app=express();app.use(express.json({limit:'1mb'}));
for(const name of ['readDiscovery','getInteractionContext','requestAccountExport','queueBroadcast'])app.all('/'+project+'/us-central1/'+name,handlers[name]);
const server=app.listen(19501,'127.0.0.1');
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));

// Local event dispatch uses the actual worker factory. This does not verify deployed triggers.
const {getFirestore,FieldValue,FieldPath}=requireFunctions('firebase-admin/firestore');
const {getStorage}=requireFunctions('firebase-admin/storage');
const {HttpsError}=requireFunctions('firebase-functions/v2/https');
const jobs=require('../app/functions/accountJobs').createAccountJobs({getDb:getFirestore,getBucket:()=>getStorage().bucket(),HttpsError,fieldValue:FieldValue,documentId:FieldPath.documentId()});
let polling=false;
const timer=setInterval(async()=>{if(polling)return;polling=true;try{for(const [collection,run] of [['accountExports',jobs.runExport],['broadcasts',jobs.runBroadcast]]){const queued=await getFirestore().collection(collection).where('status','==','queued').limit(10).get();for(const job of queued.docs)await run(job.id).catch(()=>{});}}finally{polling=false;}},1000);
server.on('close',()=>clearInterval(timer));
