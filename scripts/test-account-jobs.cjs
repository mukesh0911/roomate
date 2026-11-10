const assert=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module'),{gunzipSync}=require('node:zlib'),{Writable}=require('node:stream');
const req=createRequire(path.resolve('app/functions/package.json'));
module.exports=async(env,sdk)=>{
 if(!process.env.GCLOUD_PROJECT?.startsWith('demo-'))throw Error('Demo project required');
 const {initializeApp,deleteApp}=req('firebase-admin/app'),{getFirestore,FieldValue,FieldPath}=req('firebase-admin/firestore'),{getStorage}=req('firebase-admin/storage');
 const {assertFails}=createRequire(path.resolve('app/package.json'))('@firebase/rules-unit-testing');
 process.env.STORAGE_EMULATOR_HOST='http://'+process.env.FIREBASE_STORAGE_EMULATOR_HOST;
 const app=initializeApp({projectId:process.env.GCLOUD_PROJECT,storageBucket:process.env.GCLOUD_PROJECT+'.appspot.com'},'account-jobs');
 const db=getFirestore(app),bucket=getStorage(app).bucket();class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const {createAccountJobs}=require('../app/functions/accountJobs');const deps={getDb:()=>db,getBucket:()=>bucket,HttpsError,fieldValue:FieldValue,documentId:FieldPath.documentId()};
 const jobs=createAccountJobs(deps),auth={uid:'job-owner',token:{auth_time:Math.floor(Date.now()/1000)}},staff={uid:'job-admin',token:{email:'jobs-admin@example.test',email_verified:true}};
 try{
  const seed=db.batch();seed.set(db.doc('users/job-admin'),{status:'active',name:'Staff'});seed.set(db.doc('users/job-owner'),{status:'active',name:'Export Owner',quiz:{ownPrivateAnswer:'mine'}});seed.set(db.doc('privateUserData/job-owner'),{email:'owner@example.test'});seed.set(db.doc('users/job-peer'),{status:'active',name:'Peer',quiz:{secret:'PEER_PRIVATE_SHOULD_NOT_EXPORT'}});
  seed.set(db.doc('chatRooms/job-room'),{participants:['job-owner','job-peer']});seed.set(db.doc('chatRooms/job-room/messages/shared'),{senderId:'job-peer',content:'Shared with owner',senderEmail:'PEER_PRIVATE_SHOULD_NOT_EXPORT'});
  seed.set(db.doc('applications/job-answers'),{ownerId:'job-peer',applicantId:'job-owner',screeningAnswers:{'Move date?':'Next week'},internalReview:'PEER_PRIVATE_SHOULD_NOT_EXPORT'});
  seed.set(db.doc('admins/jobs-admin@example.test'),{role:'admin',active:true});
  for(let i=0;i<205;i++)seed.set(db.doc('users/job-target-'+String(i).padStart(4,'0')),{status:i===204?'banned':'active',housingPreferences:{activeIntents:['team_up']}});
  await seed.commit();
  await assert.rejects(jobs.exportRequest({data:{action:'start'}}),{code:'unauthenticated'});
  await assert.rejects(jobs.exportRequest({auth:{...auth,token:{auth_time:1}},data:{action:'start'}}),{code:'failed-precondition'});
  await jobs.exportRequest({auth,data:{action:'start',uid:'job-peer'}});
  assert.equal((await db.doc('accountExports/job-peer').get()).exists,false);
  const ownerDb=env.authenticatedContext('job-owner').firestore(),peerDb=env.authenticatedContext('job-peer').firestore();
  await assertFails(sdk.updateDoc(sdk.doc(ownerDb,'accountExports','job-owner'),{status:'complete'}));
  await assertFails(sdk.getDoc(sdk.doc(peerDb,'accountExports','job-owner')));
  let failUpload=true;
  const faultBucket={deleteFiles:opts=>bucket.deleteFiles(opts),file:name=>{
   const file=bucket.file(name);
   return {delete:opts=>file.delete(opts),createWriteStream:opts=>{
    if(failUpload){failUpload=false;return new Writable({write(_chunk,_encoding,callback){callback(Error('Fixture export upload failure'));}});}
    return file.createWriteStream(opts);
   }};
  }};
  const failing=createAccountJobs({...deps,getBucket:()=>faultBucket});await assert.rejects(failing.runExport('job-owner'),/Fixture export/);
  assert.equal((await jobs.exportRequest({auth,data:{action:'status'}})).status,'failed');
  await jobs.exportRequest({auth,data:{action:'retry'}});await jobs.runExport('job-owner');
  const ready=await jobs.exportRequest({auth,data:{action:'download'}});const [bytes]=await bucket.file(ready.objectPath).download();const text=gunzipSync(bytes).toString('utf8');assert.ok(text.includes('ownPrivateAnswer'));assert.ok(text.includes('Shared with owner'));assert.ok(text.includes('Next week'));assert.ok(!text.includes('PEER_PRIVATE_SHOULD_NOT_EXPORT'));
  const storageSdk=createRequire(path.resolve('app/package.json'))('firebase/storage');
  await storageSdk.getBytes(storageSdk.ref(env.authenticatedContext('job-owner',{auth_time:Math.floor(Date.now()/1000)}).storage('gs://'+bucket.name),ready.objectPath));
  await assertFails(storageSdk.getBytes(storageSdk.ref(env.authenticatedContext('job-peer').storage('gs://'+bucket.name),ready.objectPath)));
  await assertFails(storageSdk.getBytes(storageSdk.ref(env.authenticatedContext('job-owner',{auth_time:1}).storage('gs://'+bucket.name),ready.objectPath)));
  await db.doc('accountExports/job-owner').update({expiresAt:new Date(0)});
  await assertFails(storageSdk.getBytes(storageSdk.ref(env.authenticatedContext('job-owner',{auth_time:Math.floor(Date.now()/1000)}).storage('gs://'+bucket.name),ready.objectPath)));
  await jobs.exportRequest({auth,data:{action:'start'}});await jobs.runExport('job-owner');
  assert.equal((await bucket.file(ready.objectPath).exists())[0],false);
  const renewed=await jobs.exportRequest({auth,data:{action:'download'}});await db.doc('accountExports/job-owner').update({expiresAt:new Date(0)});await jobs.cleanupExports();assert.equal((await bucket.file(renewed.objectPath).exists())[0],false);
  await assert.rejects(jobs.broadcastRequest({auth,data:{requestId:'delivery',title:'Hello',description:'A real queued message',target:'all'}}),{code:'permission-denied'});
  const payload={requestId:'delivery',title:'Hello members',description:'A real queued message',target:'all'};await jobs.broadcastRequest({auth:staff,data:payload});await jobs.broadcastRequest({auth:staff,data:payload});
  await assertFails(sdk.setDoc(sdk.doc(env.authenticatedContext('job-admin',{email:'jobs-admin@example.test',email_verified:true}).firestore(),'broadcasts','forged'),{status:'complete'}));
  let commits=0;const faultDb=new Proxy(db,{get(target,key){if(key==='batch')return()=>{const batch=target.batch(),commit=batch.commit.bind(batch);batch.commit=async()=>{if(++commits===2)throw Error('Fixture second delivery page failed');return commit();};return batch;};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
  await assert.rejects(createAccountJobs({...deps,getDb:()=>faultDb}).runBroadcast('delivery'),/second delivery page/);
  const failed=(await db.doc('broadcasts/delivery').get()).data();assert.equal(failed.status,'failed');assert.ok(failed.cursor);assert.ok(failed.delivered>0);
  await jobs.broadcastRequest({auth:staff,data:{action:'retry',requestId:'delivery'}});await jobs.runBroadcast('delivery');
  const done=(await db.doc('broadcasts/delivery').get()).data(),notifications=await db.collection('notifications').where('broadcastId','==','delivery').get();assert.equal(done.status,'complete');assert.equal(done.delivered,notifications.size);assert.equal(new Set(notifications.docs.map(x=>x.data().userId)).size,notifications.size);assert.ok(!notifications.docs.some(x=>x.data().userId==='job-target-0204'));
  await jobs.runBroadcast('delivery');assert.equal((await db.collection('notifications').where('broadcastId','==','delivery').get()).size,notifications.size);
 }finally{await deleteApp(app);}
};
