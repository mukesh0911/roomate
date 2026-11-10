const test=require('node:test');
const assert=require('node:assert/strict');
const {messageIdentityUpdate,ownedStoragePrefixes,createDeletionWorker}=require('./accountDeletion');
const {createAccountDeletionService}=require('./accountDeletionService');

test('identity cleanup preserves shared content and never changes the peer identity',()=>{
 const deleted=Symbol('deleted'),fields={delete:()=>deleted};
 const message={senderId:'member',senderName:'Old name',senderEmail:'old@example.test',senderPhone:'private',content:'Retained shared text',imagePath:'chats/room/member/photo'};
 const update=messageIdentityUpdate(message,'member',fields);
 assert.equal(update.senderName,'Deleted member');assert.equal(update.senderAvatar,'');
 assert.equal(update.senderEmail,deleted);assert.equal(update.senderPhone,deleted);
 for(const key of ['senderId','content','imagePath'])assert.equal(Object.hasOwn(update,key),false);
 assert.equal(messageIdentityUpdate(message,'another-member',fields),null);
});

test('private asset cleanup never includes retained shared chat prefixes',()=>{
 const prefixes=ownedStoragePrefixes('member',['listing-one','listing-two']);
 assert.ok(prefixes.includes('profiles/member/'));
 assert.ok(prefixes.includes('verificationDocs/member/'));
 assert.ok(prefixes.includes('listings/listing-two/'));
 assert.equal(prefixes.some(prefix=>prefix.startsWith('chats/')),false);
});

test('malformed account IDs are rejected before any privileged database access',async()=>{
 let touched=false;
 const worker=createDeletionWorker({db:{collection(){touched=true;throw Error('Unexpected database access')}}});
 for(const uid of ['',null,'.','..','member/path','a'.repeat(129)])await assert.rejects(worker(uid),/Invalid account ID/);
 assert.equal(touched,false);
});

test('a completed job never repeats privileged cleanup',async()=>{
 let touched=false;
 const worker=createDeletionWorker({
  db:{collection:()=>({doc:()=>({})}),runTransaction:callback=>callback({get:async()=>({exists:true,data:()=>({status:'complete'})})})},
  bucket:{deleteFiles(){touched=true;}},auth:{deleteUser(){touched=true;}},
 });
 assert.deepEqual(await worker('member'),{deleted:true});assert.equal(touched,false);
});

test('an unverified email claim cannot delete a staff registry row when requesting deletion',async()=>{
 const deleted=[],written=[];
 const db={collection:name=>({doc:id=>name+'/'+id}),runTransaction:callback=>callback({get:async()=>({exists:false}),set:(ref,value)=>written.push([ref,value]),delete:ref=>deleted.push(ref)})};
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const service=createAccountDeletionService({available:true,getDb:()=>db,fieldValue:{serverTimestamp:()=>0},HttpsError});
 const result=await service.requestDeletion({auth:{uid:'member',token:{email:'claimed@example.test',email_verified:false,auth_time:Math.floor(Date.now()/1000)}},data:{confirmation:'DELETE',uid:'another-member'}});
 assert.equal(result.jobId,'member');
 assert.equal(deleted.some(ref=>ref.startsWith('admins/')),false);
 assert.equal(written[0][1].staffRegistryKey,undefined);
 assert.ok(deleted.includes('privateUserData/member'));assert.ok(deleted.includes('userContacts/member'));
});
