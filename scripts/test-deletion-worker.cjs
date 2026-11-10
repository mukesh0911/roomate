const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path');
const rootRequire=createRequire(path.resolve('package.json'));
const appRequire=createRequire(path.resolve('app/package.json'));
const {assertFails}=appRequire('@firebase/rules-unit-testing');

module.exports=async function testDeletion(env,sdk){
 const project=process.env.GCLOUD_PROJECT;
 assert.ok(project?.startsWith('demo-'));
 for(const key of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])assert.match(process.env[key]||'',/^(127\.0\.0\.1|localhost):\d+$/);
 process.env.STORAGE_EMULATOR_HOST='http://'+process.env.FIREBASE_STORAGE_EMULATOR_HOST;
 const {initializeApp,deleteApp}=rootRequire('firebase-admin/app');
 const {getFirestore,FieldValue,FieldPath}=rootRequire('firebase-admin/firestore');
 const {getAuth}=rootRequire('firebase-admin/auth');
 const {getStorage}=rootRequire('firebase-admin/storage');
 const {POLICY_VERSION,createDeletionWorker}=require('../app/functions/accountDeletion');
 const app=initializeApp({projectId:project,storageBucket:project+'.appspot.com'},'deletion-worker-fixture');
 const db=getFirestore(app),auth=getAuth(app),bucket=getStorage(app).bucket();
 const uid='deletion.member',roomId='deletion-history',email='deletion@workflow.test';
 try{
  await auth.createUser({uid,email,emailVerified:true,displayName:'Fixture Identity'});
  const seed=db.batch();
  seed.set(db.doc('users/'+uid),{status:'active',name:'Fixture Identity',avatar:'private-avatar',email,phone:'fixture-phone'});
  seed.set(db.doc('admins/'+email),{role:'admin',active:true});
  for(const collection of ['privateUserData','userContacts','publicProfiles','verifications','ownerVerifications'])seed.set(db.doc(collection+'/'+uid),{userId:uid,email,phone:'fixture-phone'});
  seed.set(db.doc('listings/deletion-listing'),{ownerId:uid,status:'active'});
  seed.set(db.doc('publicListings/deletion-listing'),{ownerId:uid,status:'active'});
  seed.set(db.doc('applications/deletion-application'),{applicantId:uid,ownerId:'b',listingId:'place',status:'pending'});
  seed.set(db.doc('applications/deletion-owned-inquiry'),{applicantId:'c',ownerId:uid,listingId:'deletion-listing',status:'pending'});
  seed.set(db.doc('applicationLocks/deletion-lock'),{applicantId:uid,listingId:'place'});
  seed.set(db.doc('applicationLocks/deletion-owned-lock'),{applicantId:'c',listingId:'deletion-listing'});
  seed.set(db.doc('reports/deletion-legacy-report'),{reportedBy:uid,targetId:'b',status:'pending'});
  for(const collection of ['connectionPairs','conversationPairs'])seed.set(db.doc(collection+'/deletion-pair'),{participants:[uid,'b'],roomId});
  seed.set(db.doc('chatRooms/'+roomId),{participants:[uid,'b'],participantNames:{[uid]:'Fixture Identity',b:'Peer'},participantAvatars:{[uid]:'private-avatar'},participantProfiles:{[uid]:{name:'Fixture Identity',phone:'fixture-phone'}},unreadBy:{[uid]:2,b:3}});
  for(let index=0;index<207;index++)seed.set(db.doc('chatRooms/'+roomId+'/messages/'+String(index).padStart(4,'0')),{senderId:index===206?'b':uid,content:'Shared text '+index,senderName:index===206?'Peer':'Fixture Identity',senderEmail:index===206?'peer@workflow.test':email});
  seed.set(db.doc('accountDeletionJobs/'+uid),{status:'queued',phase:'prepare',policyVersion:POLICY_VERSION,staffRegistryKey:email});
  await seed.commit();
  const shared='chats/'+roomId+'/'+uid+'/retained-photo';
  const privatePaths=['profiles/'+uid+'/photo','verificationDocs/'+uid+'/id','verifications/'+uid+'/id','listings/deletion-listing/photo'];
  for(const file of [shared,...privatePaths])await bucket.file(file).save(Buffer.from([1,2,3]),{metadata:{contentType:'image/png'}});

  let commits=0,historyFailed=false,storageFailed=false;
  const faultDb=new Proxy(db,{get(target,key){
   if(key==='batch')return()=>{const batch=target.batch(),commit=batch.commit.bind(batch);batch.commit=async()=>{commits++;if(commits===2&&!historyFailed){historyFailed=true;throw Error('Fixture interrupted second history page');}return commit();};return batch;};
   const value=target[key];return typeof value==='function'?value.bind(target):value;
  }});
  const worker=createDeletionWorker({db:faultDb,bucket:{deleteFiles:async options=>{if(!storageFailed){storageFailed=true;throw Error('Fixture storage failure');}return bucket.deleteFiles(options);}},auth,fieldValue:FieldValue,FieldPath,documentId:FieldPath.documentId()});
  await assert.rejects(worker(uid),/second history page/);
  let state=(await db.doc('accountDeletionJobs/'+uid).get()).data();assert.equal(state.status,'failed');assert.equal(state.phase,'shared_history');
  assert.equal((await db.doc('users/'+uid).get()).data().status,'deleting');
  assert.equal((await db.doc('users/'+uid).get()).data().email,undefined);
  assert.equal((await db.doc('admins/'+email).get()).exists,false);

  const stale=env.authenticatedContext(uid,{email,email_verified:true});
  await assertFails(sdk.updateDoc(sdk.doc(stale.firestore(),'users',uid),{name:'Recreated identity'}));
  await assertFails(sdk.setDoc(sdk.doc(stale.firestore(),'privateUserData',uid),{email}));
  await assertFails(sdk.setDoc(sdk.doc(stale.firestore(),'userContacts',uid),{phone:'fixture-phone'}));
  const storageSdk=appRequire('firebase/storage');
  const staleStorage=stale.storage('gs://'+bucket.name);
  await assertFails(storageSdk.uploadBytes(storageSdk.ref(staleStorage,'profiles/'+uid+'/resurrect'),new Uint8Array([1]),{contentType:'image/png'}));
  await assertFails(storageSdk.deleteObject(storageSdk.ref(staleStorage,shared)));

  await assert.rejects(worker(uid),/storage failure/);
  state=(await db.doc('accountDeletionJobs/'+uid).get()).data();assert.equal(state.phase,'storage');assert.equal(state.status,'failed');
  assert.equal((await auth.getUser(uid)).uid,uid);
  const before=(await db.doc('chatRooms/'+roomId).get()).data();
  assert.deepEqual(before.participantProfiles[uid],{name:'Deleted member',avatar:''});
  assert.equal(before.participantProfiles.deletion,undefined);
  assert.equal(before.participantNames.b,'Peer');assert.equal(before.unreadBy.b,3);
  assert.equal((await db.doc('chatRooms/'+roomId+'/messages/0000').get()).data().content,'Shared text 0');
  assert.equal((await db.doc('chatRooms/'+roomId+'/messages/0000').get()).data().senderEmail,undefined);
  assert.equal((await db.doc('chatRooms/'+roomId+'/messages/0206').get()).data().senderName,'Peer');
  assert.equal((await db.collection('chatRooms/'+roomId+'/messages').get()).size,207);
  await sdk.getDoc(sdk.doc(env.authenticatedContext('b').firestore(),'chatRooms',roomId,'messages','0000'));
  assert.equal((await bucket.file(shared).exists())[0],true);
  await storageSdk.getBytes(storageSdk.ref(env.authenticatedContext('b').storage('gs://'+bucket.name),shared));

  assert.deepEqual(await worker(uid),{deleted:true});
  await assert.rejects(auth.getUser(uid),{code:'auth/user-not-found'});
  assert.equal((await db.doc('accountDeletionJobs/'+uid).get()).data().status,'complete');
  const tombstone=(await db.doc('users/'+uid).get()).data();assert.equal(tombstone.name,'Deleted member');assert.equal(tombstone.status,'deleted');assert.equal(tombstone.email,undefined);
  for(const file of privatePaths)assert.equal((await bucket.file(file).exists())[0],false);
  assert.equal((await bucket.file(shared).exists())[0],true);
  for(const doc of ['applications/deletion-application','applications/deletion-owned-inquiry','applicationLocks/deletion-lock','applicationLocks/deletion-owned-lock','reports/deletion-legacy-report','conversationPairs/deletion-pair'])assert.equal((await db.doc(doc).get()).exists,false);
  assert.equal((await db.collection('accountDeletionJobs/'+uid+'/records').get()).size,0);
  assert.deepEqual(await worker(uid),{deleted:true});
  assert.equal((await db.collection('chatRooms/'+roomId+'/messages').get()).size,207);

  const {createAccountDeletionService}=require('../app/functions/accountDeletionService');
  class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
  const service=createAccountDeletionService({available:true,getDb:()=>db,getBucket:()=>bucket,getAuth:()=>auth,fieldValue:FieldValue,FieldPath,HttpsError});
  const serviceUid='deletion.service-member',serviceEmail='deletion-service@workflow.test';
  await auth.createUser({uid:serviceUid,email:serviceEmail,emailVerified:true});
  await db.doc('users/'+serviceUid).set({name:'Service Fixture',status:'active'});
  const requestAuth={uid:serviceUid,token:{email:serviceEmail,email_verified:true,auth_time:Math.floor(Date.now()/1000)}};
  await assert.rejects(service.requestDeletion({data:{confirmation:'DELETE'}}),{code:'unauthenticated'});
  await assert.rejects(service.requestDeletion({auth:requestAuth,data:{confirmation:'wrong'}}),{code:'invalid-argument'});
  await assert.rejects(service.requestDeletion({auth:{...requestAuth,token:{...requestAuth.token,auth_time:1}},data:{confirmation:'DELETE'}}),{code:'failed-precondition'});
  assert.equal((await db.doc('users/'+serviceUid).get()).data().status,'active');
  const queued=await service.requestDeletion({auth:requestAuth,data:{confirmation:'DELETE',uid:'b'}});
  assert.deepEqual(queued,{jobId:serviceUid,status:'queued',deleted:false});
  assert.deepEqual(await service.requestDeletion({auth:requestAuth,data:{confirmation:'DELETE'}}),queued);
  assert.equal((await db.doc('users/b').get()).data().status,'active');
  assert.equal((await db.doc('users/'+serviceUid).get()).data().status,'deleting');
  const ownClient=env.authenticatedContext(serviceUid).firestore();
  await sdk.getDoc(sdk.doc(ownClient,'accountDeletionJobs',serviceUid));
  await assertFails(sdk.updateDoc(sdk.doc(ownClient,'accountDeletionJobs',serviceUid),{status:'complete'}));
  const staffClient=env.authenticatedContext('administrator',{email:'administrator@example.test',email_verified:true}).firestore();
  await assertFails(sdk.setDoc(sdk.doc(staffClient,'accountDeletionJobs','forged-job'),{status:'queued',phase:'prepare',policyVersion:POLICY_VERSION}));
  assert.deepEqual(await service.processJob(serviceUid),{deleted:true});
  await assert.rejects(auth.getUser(serviceUid),{code:'auth/user-not-found'});
  assert.deepEqual(await service.requestDeletion({auth:requestAuth,data:{confirmation:'DELETE'}}),{jobId:serviceUid,status:'complete',deleted:true});
 }finally{await deleteApp(app);}
};
