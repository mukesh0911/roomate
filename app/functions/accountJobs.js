const {resolveUserHousingIntent}=require('./sharedUserIntent');
const {randomUUID}=require('node:crypto');
const {Readable}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const {createGzip}=require('node:zlib');
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=128&&!value.includes('/')&&value!=='.'&&value!=='..';
const generationId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,128}$/.test(value);
const EXPORT_QUERIES=[['listings','ownerId'],['connections','fromUserId'],['connections','toUserId'],['applications','applicantId'],['applications','ownerId'],['notifications','userId'],['supportTickets','userId'],['reports','reporterId'],['reports','reportedBy']];
function createAccountJobs({getDb,getBucket,HttpsError,fieldValue,documentId,now=Date.now}){
 const fail=(code,message)=>{throw new HttpsError(code,message);};
 const uidOf=request=>{if(!request.auth)fail('unauthenticated','Sign in first.');if(!validId(request.auth.uid))fail('invalid-argument','Invalid account.');return request.auth.uid;};
 function recent(request){const seconds=Number(request.auth.token?.auth_time);if(!Number.isFinite(seconds)||seconds>now()/1000+60||now()/1000-seconds>900)fail('failed-precondition','Sign out and sign in again before requesting or downloading an export.');}
 async function administrator(request){const uid=uidOf(request),token=request.auth.token||{};if(token.email_verified!==true||typeof token.email!=='string')fail('permission-denied','Administrator access required.');const row=await getDb().doc('admins/'+token.email.toLowerCase()).get();if(!row.exists||row.data().role!=='admin'||row.data().active===false||row.data().enabled===false)fail('permission-denied','Administrator access required.');const account=await getDb().doc('users/'+uid).get();if(!account.exists||(account.data().status||'active')!=='active')fail('permission-denied','An active administrator account is required.');return uid;}
 async function exportRequest(request){
  const uid=uidOf(request),action=request.data?.action||'start';
  if(!['start','status','retry','download'].includes(action))fail('invalid-argument','Unsupported export action.');
  if(['start','retry','download'].includes(action))recent(request);
  const db=getDb(),ref=db.doc('accountExports/'+uid);
  if(action==='start'||action==='retry')await db.runTransaction(async tx=>{
   const [account,job]=await Promise.all([tx.get(db.doc('users/'+uid)),tx.get(ref)]);
   if(!account.exists||['deleting','deleted'].includes(account.data().status))fail('failed-precondition','This account is unavailable for a new export.');
   const state=job.exists?job.data():null;
   if(state?.status==='queued'&&action==='start')return;
   if(state&&['processing','cleaning'].includes(state.status)&&state.leaseUntil>now())return;
   if(state&&state.status==='complete'&&state.expiresAt?.toMillis()>now())return;
   if(state&&['queued','processing','failed','cleaning'].includes(state.status)){
    tx.update(ref,{status:'queued',leaseUntil:0,expiresAt:new Date(now()+86400000),updatedAt:fieldValue.serverTimestamp()});return;
   }
   tx.set(ref,{uid,generation:randomUUID(),...(state&&generationId(state.generation)?{previousGeneration:state.generation}:{}),status:'queued',leaseUntil:0,records:0,expiresAt:new Date(now()+86400000),createdAt:fieldValue.serverTimestamp(),updatedAt:fieldValue.serverTimestamp()});
  });
  const row=await ref.get();if(!row.exists)return{status:'none'};const state=row.data();
  const result={status:state.status,records:state.records||0,expiresAt:state.expiresAt?.toMillis()||null};
  if(action==='download'){
   if(state.status!=='complete'||!state.expiresAt||state.expiresAt.toMillis()<=now())fail('failed-precondition','A completed, unexpired export is required.');
   if(!/^export_[a-zA-Z0-9_-]+\.ndjson\.gz$/.test(state.objectName||''))fail('failed-precondition','Export artifact unavailable.');
   result.objectPath='accountExports/'+uid+'/'+state.generation+'/'+state.objectName;result.fileName='nestmate-data.ndjson.gz';
  }
  return result;
 }
 async function broadcastRequest(request){
  const uid=await administrator(request),db=getDb(),action=request.data?.action||'create',id=request.data?.requestId;
  if(!generationId(id))fail('invalid-argument','A valid request identifier is required.');
  const ref=db.doc('broadcasts/'+id);
  if(action==='retry'){
   await db.runTransaction(async tx=>{const row=await tx.get(ref);if(!row.exists)fail('not-found','Broadcast not found.');const state=row.data();if(state.schemaVersion!==1)fail('failed-precondition','Legacy broadcasts require review before delivery.');if(state.status==='complete')return;if(state.status==='processing'&&state.leaseUntil>now())fail('failed-precondition','Delivery is already processing.');tx.update(ref,{status:'queued',leaseUntil:0,updatedAt:fieldValue.serverTimestamp()});});
  }else if(action==='create'){
   const {title,description,target}=request.data||{};
   if(typeof title!=='string'||title.trim().length<3||title.length>80||typeof description!=='string'||description.trim().length<10||description.length>240||!['all','seekers','owners'].includes(target))fail('invalid-argument','Check the title, message and audience.');
   await db.runTransaction(async tx=>{const row=await tx.get(ref);if(row.exists){const old=row.data();if(old.title!==title||old.description!==description||old.target!==target||old.createdBy!==uid)fail('already-exists','This request identifier was already used.');return;}tx.set(ref,{schemaVersion:1,title,description,target,createdBy:uid,sentBy:request.auth.token.email,status:'queued',cursor:null,delivered:0,scanned:0,leaseUntil:0,sentAt:fieldValue.serverTimestamp(),updatedAt:fieldValue.serverTimestamp()});});
  }else fail('invalid-argument','Unsupported broadcast action.');
  return{id,status:(await ref.get()).data().status};
 }
 async function lease(ref,complete){return getDb().runTransaction(async tx=>{const row=await tx.get(ref);if(!row.exists)return null;const state=row.data();if(complete.includes(state.status))return null;if(state.leaseUntil>now())throw Error('Job lease is active; retry after it expires.');const leaseId=randomUUID();tx.update(ref,{status:'processing',leaseId,leaseUntil:now()+600000,updatedAt:fieldValue.serverTimestamp()});return{...state,leaseId};});}
 async function failed(ref,leaseId){await getDb().runTransaction(async tx=>{const row=await tx.get(ref);if(row.exists&&row.data().leaseId===leaseId)tx.update(ref,{status:'failed',leaseUntil:0,updatedAt:fieldValue.serverTimestamp()});});}
 async function runBroadcast(id){
  if(!generationId(id))throw Error('Invalid broadcast ID');const db=getDb(),ref=db.doc('broadcasts/'+id),state=await lease(ref,['complete']);if(!state)return;
  try{if(state.schemaVersion!==1)throw Error('Unreviewed broadcast schema');for(;;){
   const job=await ref.get(),current=job.data();if(current.leaseId!==state.leaseId)throw Error('Delivery lease changed');
   let query=db.collection('users').orderBy(documentId).limit(200);if(current.cursor)query=query.startAfter(current.cursor);const page=await query.get(),batch=db.batch();let delivered=0;
   for(const user of page.docs){const data=user.data();if((data.status||'active')!=='active'||data.notificationPreferences?.broadcasts===false)continue;
    const intents=resolveUserHousingIntent({...data,uid:user.id}).activeIntents;
    if(current.target==='seekers'&&!intents.some(x=>['find_room','team_up'].includes(x)))continue;
    if(current.target==='owners'&&(await db.collection('listings').where('ownerId','==',user.id).limit(1).get()).empty)continue;
    batch.set(db.doc('notifications/broadcast_'+id+'_'+user.id),{userId:user.id,type:'system',title:current.title,description:current.description,broadcastId:id,read:false,createdAt:fieldValue.serverTimestamp()});delivered++;
   }
   const done=page.size<200;
   batch.update(ref,{cursor:page.docs.at(-1)?.id||current.cursor||null,delivered:(current.delivered||0)+delivered,scanned:(current.scanned||0)+page.size,status:done?'complete':'processing',leaseUntil:done?0:now()+600000,updatedAt:fieldValue.serverTimestamp()}, {lastUpdateTime:job.updateTime});
   await batch.commit();if(done)return;
  }}catch(error){await failed(ref,state.leaseId);throw error;}
 }
 async function* pages(query){let cursor;for(;;){let q=query.orderBy(documentId).limit(200);if(cursor)q=q.startAfter(cursor);const page=await q.get();for(const row of page.docs)yield row;if(page.size<200)return;cursor=page.docs.at(-1);}}
 function safeRecord(collection,data){
  const fields=collection==='applications'?['listingId','ownerId','applicantId','status','screeningAnswers','answers','questionSnapshot','listingVersion','createdAt','updatedAt']:collection==='reports'?['reporterId','reportedBy','targetId','targetType','reason','details','status','createdAt','updatedAt']:collection==='connections'?['fromUserId','toUserId','listingId','status','createdAt','updatedAt']:null;
  return fields?Object.fromEntries(fields.filter(key=>data[key]!==undefined).map(key=>[key,data[key]])):data;
 }
 async function runExport(uid){
  if(!validId(uid))throw Error('Invalid export owner');const db=getDb(),ref=db.doc('accountExports/'+uid),state=await lease(ref,['complete','expired']);if(!state)return;if(!generationId(state.generation))throw Error('Invalid export generation');
  let records=0;const objectName='export_'+state.leaseId+'.ndjson.gz';
  const file=getBucket().file('accountExports/'+uid+'/'+state.generation+'/'+objectName);
  const line=value=>Buffer.from(JSON.stringify(value,(_key,v)=>v&&typeof v.toDate==='function'?v.toDate().toISOString():v)+'\n');
  async function* content(){
   yield line({type:'manifest',schemaVersion:1,generatedAt:new Date(now()).toISOString(),owner:uid,format:'NDJSON',scope:'Account records, owned listings, shared applications/connections and conversation history. Files are referenced, not embedded. Records are read over time, not an atomic snapshot.'});
   for(const collection of ['users','privateUserData','userContacts','publicProfiles','verifications','ownerVerifications']){const row=await db.doc(collection+'/'+uid).get();if(row.exists){records++;yield line({type:'record',path:row.ref.path,data:row.data()});}}
   const seen=new Set();for(const [collection,field] of EXPORT_QUERIES)for await(const row of pages(db.collection(collection).where(field,'==',uid))){if(seen.has(row.ref.path))continue;seen.add(row.ref.path);records++;yield line({type:'record',path:row.ref.path,data:safeRecord(collection,row.data())});}
   for await(const room of pages(db.collection('chatRooms').where('participants','array-contains',uid))){
    const data=room.data();yield line({type:'conversation',id:room.id,participants:data.participants,listingContexts:data.listingContexts||[]});records++;
    for await(const message of pages(room.ref.collection('messages'))){const m=message.data();yield line({type:'message',roomId:room.id,id:message.id,data:Object.fromEntries(['senderId','content','imagePath','imageUrl','createdAt'].filter(key=>m[key]!==undefined).map(key=>[key,m[key]]))});records++;}
   }
  }
  try{
   if(generationId(state.previousGeneration))await getBucket().deleteFiles({prefix:'accountExports/'+uid+'/'+state.previousGeneration+'/'});
   await getBucket().deleteFiles({prefix:'accountExports/'+uid+'/'+state.generation+'/'});
   await pipeline(Readable.from(content()),createGzip(),file.createWriteStream({resumable:false,metadata:{contentType:'application/gzip',cacheControl:'private, no-store'}}));
   await db.runTransaction(async tx=>{const [row,account]=await Promise.all([tx.get(ref),tx.get(db.doc('users/'+uid))]);if(!account.exists||['deleting','deleted'].includes(account.data().status))throw Error('Account unavailable');if(row.data()?.leaseId!==state.leaseId)throw Error('Export lease changed');tx.update(ref,{status:'complete',records,objectName,previousGeneration:fieldValue.delete(),expiresAt:new Date(now()+86400000),leaseUntil:0,updatedAt:fieldValue.serverTimestamp()});});
  }catch(error){await file.delete({ignoreNotFound:true}).catch(()=>{});await failed(ref,state.leaseId);throw error;}
 }
 async function cleanupExports(){
  const db=getDb();for await(const row of pages(db.collection('accountExports').where('expiresAt','<=',new Date(now())).orderBy('expiresAt'))){
   const state=await db.runTransaction(async tx=>{const current=await tx.get(row.ref),data=current.data();if(!data||data.status==='expired'||data.leaseUntil>now()||data.expiresAt?.toMillis()>now()||!validId(row.id)||!generationId(data.generation))return null;const leaseId=randomUUID();tx.update(row.ref,{status:'cleaning',leaseId,leaseUntil:now()+600000});return{...data,leaseId};});
   if(!state)continue;
   try{if(generationId(state.previousGeneration))await getBucket().deleteFiles({prefix:'accountExports/'+row.id+'/'+state.previousGeneration+'/'});await getBucket().deleteFiles({prefix:'accountExports/'+row.id+'/'+state.generation+'/'});await db.runTransaction(async tx=>{const current=await tx.get(row.ref);if(current.data()?.leaseId===state.leaseId)tx.update(row.ref,{status:'expired',leaseUntil:0,updatedAt:fieldValue.serverTimestamp()});});}
   catch(error){await failed(row.ref,state.leaseId);throw error;}
  }
 }
 return{exportRequest,broadcastRequest,runExport,runBroadcast,cleanupExports};
}
module.exports={createAccountJobs,EXPORT_QUERIES};
