const {test}=require('node:test'),assert=require('node:assert/strict');
const {createAccountJobs}=require('./accountJobs');
class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
const recent={uid:'owner',token:{auth_time:Math.floor(Date.now()/1000)}};
test('export rejects unauthenticated and stale/future sessions before database access',async()=>{
 const jobs=createAccountJobs({getDb(){throw Error('Unexpected database access');},HttpsError});
 await assert.rejects(jobs.exportRequest({data:{action:'start'}}),{code:'unauthenticated'});
 for(const action of ['start','retry','download'])for(const auth_time of [0,1,Math.floor(Date.now()/1000)+600])await assert.rejects(jobs.exportRequest({auth:{uid:'owner',token:{auth_time}},data:{action}}),{code:'failed-precondition'});
});
test('broadcast requires verified administrator claims and membership',async()=>{
 const jobs=createAccountJobs({getDb:()=>({doc:()=>({get:async()=>({exists:true,data:()=>({role:'moderator',active:true})})})}),HttpsError});
 for(const token of [{},{email:'staff@example.test',email_verified:false},{email:'staff@example.test',email_verified:true}])await assert.rejects(jobs.broadcastRequest({auth:{uid:'staff',token},data:{requestId:'id'}}),{code:'permission-denied'});
});
test('export status and download cannot select another account',async()=>{
 const paths=[];const jobs=createAccountJobs({getDb:()=>({doc:path=>{paths.push(path);return{get:async()=>({exists:false})};}}),HttpsError});
 assert.deepEqual(await jobs.exportRequest({auth:recent,data:{action:'status',uid:'someone-else'}}),{status:'none'});
 assert.deepEqual(paths,['accountExports/owner']);
});
test('workers reject malformed identifiers without accessing services',async()=>{
 const jobs=createAccountJobs({getDb(){throw Error('Unexpected access');},HttpsError});
 for(const id of ['../x','a/b','']){await assert.rejects(jobs.runExport(id),/Invalid export owner/);await assert.rejects(jobs.runBroadcast(id),/Invalid broadcast ID/);}
});

test('an unexpired worker lease rejects delivery events so platform retry cannot acknowledge unfinished work',async()=>{
 const jobs=createAccountJobs({getDb:()=>({doc:()=>({}),runTransaction:callback=>callback({get:async()=>({exists:true,data:()=>({status:'processing',leaseUntil:Date.now()+600000})}),update(){throw Error('Must not steal a live lease');}})}),HttpsError});
 await assert.rejects(jobs.runBroadcast('busy'),/lease is active/);
 await assert.rejects(jobs.runExport('busy'),/lease is active/);
});
