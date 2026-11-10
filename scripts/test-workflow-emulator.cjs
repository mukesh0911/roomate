// Isolated demo project only. Executes the actual backend against real rules.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const appRequire=createRequire(path.resolve('app/package.json'));
const functionsRequire=createRequire(path.resolve('app/functions/package.json'));
const {initializeTestEnvironment,assertFails}=appRequire('@firebase/rules-unit-testing');
const sdk=appRequire('firebase/firestore');
const {build}=appRequire('esbuild');
const out=path.resolve('app/.workflow-tests/backend.cjs');
const results=[];
const crypto=require('node:crypto');
const evidenceFiles=['app/src/lib/exploreNavigation.ts','app/src/App.tsx','app/src/pages/HelpPage.tsx','app/src/lib/support.ts','app/src/components/landing/LandingFooter.tsx','app/src/lib/exploreEngine.js','app/src/lib/nestmateBackend.ts','app/src/pages/ExplorePage.tsx','app/src/nestmate-explore.css','app/src/pages/AdminPage.tsx','app/src/components/landing/FeaturedListingsSection.tsx','app/src/components/landing/LivingOptionsSection.tsx','app/src/components/landing/HeroSearchModule.tsx','app/src/lib/listingTruth.ts','app/src/lib/sanitizeRenderedHtml.ts','app/functions/discoveryGateway.js','app/functions/sharedUserIntent.js','app/functions/sharedMatching.js','app/src/lib/discoveryGateway.ts','app/src/lib/accountJobs.ts','app/functions/accountJobs.js','app/functions/index.js','app/functions/accountDeletion.js','app/functions/accountDeletionService.js','app/firestore.rules','app/storage.rules','app/package-lock.json'];
const hashes=()=>Object.fromEntries(evidenceFiles.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
async function main(){
 const startingSource=hashes();
 fs.writeFileSync('docs/workflow-correction/run-progress.json',JSON.stringify({phase:'initializing',startedAt:new Date().toISOString(),results:[]},null,2));
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.GCLOUD_PROJECT?.startsWith('demo-'))throw Error('Explicit isolated demo emulator required.');
 fs.mkdirSync(path.dirname(out),{recursive:true});
 await build({entryPoints:['app/src/lib/nestmateBackend.ts'],outfile:out,bundle:true,platform:'node',format:'cjs',external:['firebase/*'],plugins:[{name:'test-firebase',setup(b){b.onLoad({filter:/[\\/]discoveryGateway\.ts$/}, args => ({contents:fs.readFileSync(args.path,'utf8').replace(/async function call\(name: string, data: Record<string, unknown>\): Promise<any> \{[\s\S]*?\n\}/, 'async function call(name: string, data: Record<string, unknown>): Promise<any> { return revive(await (globalThis as any).__workflowGateway[name]({auth:(globalThis as any).__workflow.actor,data})); }'),loader:'ts'}));b.onResolve({filter:/^\.\/firebase$/},()=>({path:'context',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const auth={get currentUser(){return globalThis.__workflow.actor}}; export const db=new Proxy({}, {has(_,k){return k==="_delegate"},get(_,k){const d=globalThis.__workflow.db;if(k==="_delegate")return d._delegate||d;return d[k]}});export const storage={};',loader:'js'}));}}]});
 const adminApp=functionsRequire('firebase-admin/app').initializeApp({projectId:process.env.GCLOUD_PROJECT},'gateway-backend');
 const adminDb=functionsRequire('firebase-admin/firestore').getFirestore(adminApp);
 class HttpsError extends Error { constructor(code,message){super(message);this.code=code;} }
 const gateway=require('../app/functions/discoveryGateway').createDiscoveryGateway({getDb:()=>adminDb,HttpsError});
 globalThis.__workflowGateway={readDiscovery:gateway.read,getInteractionContext:gateway.interaction};
 const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
 const [storageHost,storagePort]=process.env.FIREBASE_STORAGE_EMULATOR_HOST.split(':');
 // CLI loads the exact hashed rule files before running this script. Avoid
 // recompiling/uploading the same large policy for a second time on startup.
 const env=await initializeTestEnvironment({projectId:process.env.GCLOUD_PROJECT,firestore:{host,port:Number(port)},storage:{host:storageHost,port:Number(storagePort)}});
 const dbs={};for(const id of ['a','b','c','d','g','h','moderator','administrator'])dbs[id]=env.authenticatedContext(id,['moderator','administrator'].includes(id)?{email:id+'@example.test',email_verified:true}:{}).firestore();
 globalThis.__workflow={actor:{uid:'a',displayName:'Alice'},db:dbs.a};
 let backend=require(out);
 const as=id=>{globalThis.__workflow={actor:{uid:id,displayName:id},db:dbs[id]};};
 const check=async(name,fn)=>{try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',error:e.message});console.error(name,e);}finally{fs.writeFileSync('docs/workflow-correction/run-progress.json',JSON.stringify({phase:'backend',results},null,2));}};
 const expect=require('node:assert/strict');
 try{
  await env.withSecurityRulesDisabled(async ctx=>{
   const db=ctx.firestore();
   for(const id of ['a','b','c','d','g','h','moderator'])await sdk.setDoc(sdk.doc(db,'users',id),{name:id,status:'active',connectsUsed:0,blockedUserIds:[],onboardingComplete:true,roommateDiscoveryEnabled:true,housingPreferences:{activeIntents:['team_up']}});
   await sdk.setDoc(sdk.doc(db,'admins','moderator@example.test'),{role:'moderator',active:true});
   await sdk.setDoc(sdk.doc(db,'admins','administrator@example.test'),{role:'admin',active:true});
   await sdk.setDoc(sdk.doc(db,'reports','moderation-fixture'),{reporterId:'a',targetId:'d',reason:'spam',status:'pending'});
   await sdk.setDoc(sdk.doc(db,'verifications','a'),{userId:'a',documentPath:'verificationDocs/a/private.jpg'});
   await sdk.setDoc(sdk.doc(db,'listings','place'),{ownerId:'b',title:'Actual room',status:'active',monthlyRent:12000,screeningQuestions:['Move date?'],createdAt:sdk.Timestamp.now()});
  });
  await check('Private source reads denied; gateway returns only explicit public fields',async()=>{
   await assertFails(sdk.getDoc(sdk.doc(dbs.a,'users','b')));
   await assertFails(sdk.getDoc(sdk.doc(env.unauthenticatedContext().firestore(),'users','b')));
   await assertFails(sdk.getDoc(sdk.doc(dbs.a,'listings','place')));
   await env.withSecurityRulesDisabled(async ctx=>{ await sdk.updateDoc(sdk.doc(ctx.firestore(),'users','b'),{email:'secret@example.test',quiz:{privateAnswer:'secret'},bio:'private bio',futurePrivateField:{secret:true}}); });
   const anonymous=await gateway.read({data:{action:'place',id:'place'}});
   expect.equal(anonymous.record.ownerId,undefined);expect.equal(anonymous.record.ownerName,undefined);
   await expect.rejects(gateway.read({data:{action:'people'}}),{code:'unauthenticated'});
   const member=await gateway.read({auth:{uid:'a'},data:{action:'person',id:'b'}});
   for(const key of ['email','quiz','bio','futurePrivateField','blockedUserIds','communicationRevokedAt']) expect.equal(member.record[key],undefined);
   expect.equal(member.record.uid,'b');expect.equal(member.record.serverResolvedIntent.rawSources,undefined);
   await expect.rejects(gateway.interaction({auth:{uid:'a'},data:{targetUid:'other/path'}}),{code:'invalid-argument'});
  });
  await check('New listing follows review, then appears in All and Rooms with canonical owner and score',async()=>{
   as('h');const listing=await backend.createNewListingBackend({title:'Created audit room',city:'Pune',loc:'Baner',rent:12000,dep:0,bhk:'2BHK',type:'Private room',gd:'Any'},globalThis.__workflow.actor);
   expect.equal(listing.status,'pending_verification');
   await expect.rejects(gateway.read({auth:{uid:'g'},data:{action:'place',id:listing.id}}));
   as('administrator');await backend.updateListingStatusBackend(listing.id,'active');
   as('g');const all=await backend.fetchBoundedExploreListings({category:'all',pageSize:24,currentUserProfile:{city:'Pune',budget:15000}});
   const rooms=await backend.fetchBoundedExploreListings({category:'rooms',pageSize:24,currentUserProfile:{city:'Pune',budget:15000}});
   const a=all.rooms.find(r=>r.id===listing.id),b=rooms.rooms.find(r=>r.id===listing.id);
   expect.ok(a);expect.ok(b);expect.equal(a.ownerId,'h');expect.equal(a.rent,12000);expect.equal(a.matchPct,b.matchPct);
   const member=await gateway.read({auth:{uid:'g'},data:{action:'person',id:'h'}});expect.equal(member.record.uid,a.ownerId);
   await env.withSecurityRulesDisabled(async ctx=>{await sdk.deleteDoc(sdk.doc(ctx.firestore(),'listings',listing.id));});
  });
  let request,room,app,app2;
  await check('New connect, duplicate reuse and exactly one quota charge',async()=>{
   as('a');request=await backend.sendConnectionRequestBackend('b');expect.equal(await backend.sendConnectionRequestBackend('b'),request);
   expect.equal((await sdk.getDoc(sdk.doc(dbs.a,'users','a'))).data().connectsUsed,1);
   expect.equal((await sdk.getDoc(sdk.doc(dbs.b,'notifications',request+'_pending'))).data().userId,'b');
  });
  await check('Pending cannot message, recipient accepts, shared room reused',async()=>{
   as('a');await expect.rejects(backend.getOrCreateChatRoomBackend('b'));
   as('b');await backend.updateConnectionStatusBackend(request,'accepted');
   as('a');room=await backend.getOrCreateChatRoomBackend('b');expect.equal(await backend.getOrCreateChatRoomBackend('b'),room);
   as('b');expect.equal(await backend.getOrCreateChatRoomBackend('a'),room);
   as('a');expect.equal(await backend.sendConnectionRequestBackend('b','place'),request);
   expect.equal((await sdk.getDoc(sdk.doc(dbs.a,'users','a'))).data().connectsUsed,1);
  });
  await check('Message retries are idempotent and unread state belongs to recipient',async()=>{
   as('a');await backend.sendMessageBackend(room,'Hello','','message-1');await backend.sendMessageBackend(room,'Hello','','message-1');
   expect.equal((await sdk.getDocs(sdk.collection(dbs.b,'chatRooms',room,'messages'))).size,1);
   expect.equal((await sdk.getDoc(sdk.doc(dbs.b,'chatRooms',room))).data().unreadBy.b,1);
   as('b');await backend.markConversationReadBackend(room);expect.equal((await sdk.getDoc(sdk.doc(dbs.b,'chatRooms',room))).data().unreadBy.b,0);
   await assertFails(sdk.getDoc(sdk.doc(dbs.c,'chatRooms',room)));
  });
  await check('Independent applications, shortlist/select do not fill or affect other applicant',async()=>{
   as('a');app=await backend.submitApplicationBackend('place',{'Move date?':'Tomorrow'});expect.equal(await backend.submitApplicationBackend('place',{'Move date?':'Tomorrow'}),app);
   as('c');app2=await backend.submitApplicationBackend('place',{'Move date?':'Next week'});
   as('b');await backend.updateApplicationStatusBackend(app,'shortlisted');await backend.updateApplicationStatusBackend(app,'selected');
   expect.equal((await sdk.getDoc(sdk.doc(dbs.b,'applications',app2))).data().status,'pending');
   expect.equal((await sdk.getDoc(sdk.doc(dbs.b,'listings','place'))).data().status,'active');
  });
  await check('Applicant decline and host rejection preserve independent messaging',async()=>{
   as('a');await backend.updateApplicationStatusBackend(app,'declined_by_applicant');
   app=await backend.submitApplicationBackend('place',{'Move date?':'Later'});
   as('b');await backend.updateApplicationStatusBackend(app,'rejected');
   as('a');await backend.sendMessageBackend(room,'Still discussing','','message-2');
   as('c');await backend.updateApplicationStatusBackend(app2,'withdrawn');
   expect.equal((await sdk.getDoc(sdk.doc(dbs.c,'applications',app2))).data().status,'withdrawn');
  });
  await check('Disconnect denies new sends and preserves history',async()=>{
   await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await sdk.setDoc(sdk.doc(db,'connections','legacy-person-duplicate'),{fromUserId:'b',toUserId:'a',status:'accepted',createdAt:sdk.Timestamp.fromMillis(1)});
    await sdk.setDoc(sdk.doc(db,'acceptedPairs','b_a'),{user1:'b',user2:'a',connectionId:'legacy-person-duplicate'});
   });
   as('a');await backend.disconnectConnectionBackend(request);
   // A peer cannot replay an older accepted alias to recover permission.
   await assertFails(sdk.updateDoc(sdk.doc(dbs.a,'users','a'),{personCommunicationRevokedAt:{}}));
   await assertFails(sdk.updateDoc(sdk.doc(dbs.a,'users','a'),{personCommunicationRevokedAt:{b:sdk.Timestamp.fromMillis(0)}}));

   await expect.rejects(backend.sendMessageBackend(room,'Forbidden','','message-3'));
   expect.equal((await sdk.getDocs(sdk.collection(dbs.a,'chatRooms',room,'messages'))).size,2);
  });
  await check('Listing consent is separate and reuses pair room without a person connection',async()=>{
   await env.withSecurityRulesDisabled(async ctx=>{await sdk.updateDoc(sdk.doc(ctx.firestore(),'users','b'),{roommateDiscoveryEnabled:false});});
   as('a');await expect.rejects(backend.getOrCreateChatRoomBackend('b','place'),/Request communication consent/);
   const listingRequest=await backend.sendConnectionRequestBackend('b','place');
   as('b');await backend.updateConnectionStatusBackend(listingRequest,'accepted');
   as('a');expect.equal(await backend.getOrCreateChatRoomBackend('b','place'),room);
   expect.equal((await sdk.getDoc(sdk.doc(dbs.a,'connections',request))).data().status,'disconnected');
   await backend.sendMessageBackend(room,'Listing permission','','message-4');
  });
  await check('Global block applies to listings, messages and requests; unblock restores no consent',async()=>{
   as('b');await backend.blockUserBackend('a');
   as('a');await expect.rejects(backend.sendMessageBackend(room,'Blocked','','message-5'));
   await expect.rejects(backend.sendConnectionRequestBackend('b'));
   await expect.rejects(backend.submitApplicationBackend('place',{'Move date?':'Now'}));
   as('b');await backend.unblockUserBackend('a');
   as('a');await expect.rejects(backend.sendMessageBackend(room,'Not restored','','message-6'));
  });
  await check('Declined request stays in history and a later request gets a new ID',async()=>{
   as('c');const first=await backend.sendConnectionRequestBackend('d');
   as('d');await backend.updateConnectionStatusBackend(first,'rejected');
   as('c');const next=await backend.sendConnectionRequestBackend('d');expect.notEqual(first,next);
   expect.equal((await sdk.getDoc(sdk.doc(dbs.c,'connections',first))).data().status,'rejected');
  });
  await check('Moderator cannot grant staff or read private identity evidence',async()=>{
   await assertFails(sdk.setDoc(sdk.doc(dbs.moderator,'admins','attacker@example.test'),{role:'admin'}));
   await assertFails(sdk.getDoc(sdk.doc(dbs.moderator,'verifications','a')));
  });
  await check('Direct application self-selection, foreign writes and fabricated events are denied',async()=>{
   await assertFails(sdk.updateDoc(sdk.doc(dbs.c,'applications',app2),{status:'selected',updatedAt:sdk.serverTimestamp()}));
   await assertFails(sdk.updateDoc(sdk.doc(dbs.d,'applications',app),{status:'rejected',updatedAt:sdk.serverTimestamp()}));
   await assertFails(sdk.setDoc(sdk.doc(dbs.c,'notifications','spoof'),{userId:'b',actorId:'c',type:'application',applicationId:app,title:'False',description:'False',read:false,createdAt:sdk.serverTimestamp()}));
  });
  await check('Simultaneous reverse requests serialize at the rules boundary',async()=>{
   const request=async(from,to)=>sdk.runTransaction(dbs[from],async tx=>{
    const lockRef=sdk.doc(dbs[from],'connectionPairs',from+'___'+to),lock=await tx.get(lockRef);
    if(lock.exists())return lock.data().connectionId;
    const actor=sdk.doc(dbs[from],'users',from),user=await tx.get(actor),id='race-'+from+'-'+to;
    tx.update(actor,{connectsUsed:user.data().connectsUsed+1,lastConnectionId:id,updatedAt:sdk.serverTimestamp()});
    tx.set(sdk.doc(dbs[from],'connections',id),{fromUserId:from,toUserId:to,status:'pending',createdAt:sdk.serverTimestamp(),updatedAt:sdk.serverTimestamp()});
    const index={participants:[from,to],connectionId:id};tx.set(lockRef,index);tx.set(sdk.doc(dbs[from],'connectionPairs',to+'___'+from),index);
    return id;
   });
   const attempts=await Promise.allSettled([request('g','h'),request('h','g')]);
   const committed=attempts.filter(r=>r.status==='fulfilled');expect.ok(committed.length>=1);
   // Rules can deny a losing cross-client write before the SDK reports its
   // optimistic conflict. Reconcile the authoritative lock, never create a duplicate.
   const [left,right]=await Promise.all([sdk.getDoc(sdk.doc(dbs.g,'connectionPairs','g___h')),sdk.getDoc(sdk.doc(dbs.h,'connectionPairs','h___g'))]);expect.equal(left.data().connectionId,right.data().connectionId);
   const [g,h]=await Promise.all([sdk.getDoc(sdk.doc(dbs.g,'users','g')),sdk.getDoc(sdk.doc(dbs.h,'users','h'))]);expect.equal(g.data().connectsUsed+h.data().connectsUsed,1);
  });
  await check('Storage attachments require current communication permission',async()=>{
   const storageSdk=appRequire('firebase/storage');
   as('c');const pending=await backend.sendConnectionRequestBackend('b');as('b');await backend.updateConnectionStatusBackend(pending,'accepted');as('c');const chat=await backend.getOrCreateChatRoomBackend('b');
   const object=storageSdk.ref(env.authenticatedContext('c').storage(),'chats/'+chat+'/c/fixture');
   await storageSdk.uploadBytes(object,new Uint8Array([1,2,3]),{contentType:'image/png'});
   await assertFails(storageSdk.uploadBytes(object,new Uint8Array([4,5,6]),{contentType:'image/png'})).catch(error=>{throw Error('Own attachment overwrite: '+error.message)});
   await assertFails(storageSdk.uploadBytes(storageSdk.ref(env.authenticatedContext('b').storage(),'chats/'+chat+'/c/foreign'),new Uint8Array([1]),{contentType:'image/png'})).catch(error=>{throw Error('Foreign uploader path: '+error.message)});
   await backend.disconnectConnectionBackend(pending);
   await assertFails(storageSdk.uploadBytes(storageSdk.ref(env.authenticatedContext('c').storage(),'chats/'+chat+'/c/after-disconnect'),new Uint8Array([1,2,3]),{contentType:'image/png'}));
  });
  await check('Owner application query and live adapter preserve application IDs',async()=>{
   as('b');const apps=await sdk.getDocs(sdk.query(sdk.collection(dbs.b,'applications'),sdk.where('ownerId','==','b')));expect.ok(apps.size>0);
   let stop,timer;try{await new Promise((resolve,reject)=>{
    timer=setTimeout(()=>reject(Error('Owner listener did not deliver an application ID')),15000);
    stop=backend.subscribeOwnerListings('b',items=>{if(items.some(item=>item.ap.some(applicant=>applicant.applicationId))){clearTimeout(timer);resolve();}});
   });}finally{clearTimeout(timer);stop?.();}
  });
  await check('Moderator can inspect and resolve reports but cannot change identity evidence',async()=>{
   const report=sdk.doc(dbs.moderator,'reports','moderation-fixture');expect.equal((await sdk.getDoc(report)).data().status,'pending');
   await sdk.updateDoc(report,{status:'resolved',resolution:'no_action'});
   expect.equal((await sdk.getDoc(report)).data().status,'resolved');
   await assertFails(sdk.updateDoc(sdk.doc(dbs.moderator,'verifications','a'),{status:'APPROVED'}));
  });
  await check('Identity review rejects a stale document and never publishes a listing',async()=>{
   await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();await sdk.setDoc(sdk.doc(db,'verifications','d'),{userId:'d',status:'PENDING',documentPath:'verificationDocs/d/current.jpg'});
    await sdk.setDoc(sdk.doc(db,'listings','identity-review-fixture'),{ownerId:'d',status:'pending_verification'});
   });
   as('administrator');await expect.rejects(backend.adminApproveVerificationBackend('d','administrator@example.test','Reviewed','verificationDocs/d/stale.jpg'),/changed/);
   expect.equal((await sdk.getDoc(sdk.doc(dbs.d,'verifications','d'))).data().status,'PENDING');
   await backend.adminApproveVerificationBackend('d','administrator@example.test','Reviewed','verificationDocs/d/current.jpg');
   expect.equal((await sdk.getDoc(sdk.doc(dbs.d,'users','d'))).data().isVerified,true);
   expect.equal((await sdk.getDoc(sdk.doc(dbs.d,'listings','identity-review-fixture'))).data().status,'pending_verification');
  });
  await check('Deletion worker resumes failed pages, retains shared history and denies stale-session resurrection',async()=>{await require('./test-deletion-worker.cjs')(env,sdk);});
  await check('Export privacy, expiry, retries and durable paged broadcast delivery',async()=>{await require('./test-account-jobs.cjs')(env,sdk);});
  if(!process.argv.includes('--backend-only')) {
    const ui=await require('./test-workflow-browser.cjs')(env,sdk);
    results.push(...ui.results);
    if(ui.pageErrors.length)results.push({name:'Browser page errors',status:'FAIL',errors:ui.pageErrors});
  }
 }finally{await env.cleanup();await functionsRequire('firebase-admin/app').deleteApp(adminApp);}
 const finishingSource=hashes(),sourceChangedDuringRun=evidenceFiles.some(f=>startingSource[f]!==finishingSource[f]);
 fs.mkdirSync('docs/workflow-correction',{recursive:true});fs.writeFileSync('docs/workflow-correction/'+(process.argv.includes('--backend-only')?'backend-only-results.json':'emulator-results.json'),JSON.stringify({project:process.env.GCLOUD_PROJECT,results,sourceChangedDuringRun,sourceHashes:startingSource},null,2));
 console.log(JSON.stringify(results,null,2));if(sourceChangedDuringRun||results.some(r=>r.status==='FAIL'))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
