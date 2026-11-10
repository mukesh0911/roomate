const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDiscoveryGateway,projectPlace}=require('./discoveryGateway');
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
function harness(extra={}) {
 const reads={};
 const member={name:'Member',status:'active',onboardingComplete:true,roommateDiscoveryEnabled:true,housingPreferences:{activeIntents:['team_up']}};
 const records={'users/a':{...member},'users/b':{...member,email:'private',quiz:{secret:'private'},unknown:{private:true}},'listings/room':{ownerId:'b',title:'Room',status:'active',monthlyRent:12000,ownerName:'legacy identity',contact:'private',unknown:'private'},...extra};
 const snap=path=>({id:path.split('/').at(-1),exists:!!records[path],data:()=>records[path]});
 const query=(collection,filters=[])=>({where:(key,_op,value)=>query(collection,[...filters,[key,value]]),orderBy:()=>query(collection,filters),limit:()=>query(collection,filters),get:async()=>{const docs=Object.keys(records).filter(path=>path.startsWith(collection+'/')&&filters.every(([key,value])=>records[path][key]===value)).map(snap);return{docs,empty:!docs.length,size:docs.length};}});
 return {records,reads,...createDiscoveryGateway({getDb:()=>({doc:path=>({get:async()=>{reads[path]=(reads[path]||0)+1;return snap(path);}}),collection:name=>query(name)}),HttpsError})};
}
test('physical projection excludes identity anonymously and all unknown private fields',()=>{
 const projected=projectPlace('room',{ownerId:'b',ownerName:'Secret',email:'secret',address:'exact',monthlyRent:12000,nested:{secret:true}},false);
 assert.equal(projected.monthlyRent,12000);
 for(const key of ['ownerId','ownerName','email','address','nested'])assert.equal(projected[key],undefined);
});
test('anonymous people and incomplete members are denied',async()=>{
 const h=harness({'users/c':{status:'active',onboardingComplete:false}});
 await assert.rejects(h.read({data:{action:'people'}}),{code:'unauthenticated'});
 await assert.rejects(h.read({auth:{uid:'c'},data:{action:'people'}}),{code:'permission-denied'});
 await assert.rejects(h.interaction({auth:{uid:'c'},data:{targetUid:'b',listingId:'room'}}),{code:'permission-denied'});
});
test('public person response exposes neither raw quiz nor future private fields',async()=>{
 const h=harness();const {record}=await h.read({auth:{uid:'a'},data:{action:'person',id:'b'}});
 assert.equal(record.uid,'b');assert.equal(record.name,'Member');
 for(const key of ['email','quiz','unknown','blockedUserIds'])assert.equal(record[key],undefined);
 assert.equal(record.serverResolvedIntent.rawSources,undefined);
});
test('either-direction block removes discovery and prevents new identity lookup',async()=>{
 const h=harness();h.records['users/b'].blockedUserIds=['a'];
 assert.deepEqual((await h.read({auth:{uid:'a'},data:{action:'people'}})).records,[]);
 await assert.rejects(h.read({auth:{uid:'a'},data:{action:'person',id:'b'}}),{code:'permission-denied'});
});
test('opt-out and restricted accounts disappear; owner restriction hides physical inventory',async()=>{
 const h=harness();h.records['users/b'].roommateDiscoveryEnabled=false;
 assert.deepEqual((await h.read({auth:{uid:'a'},data:{action:'people'}})).records,[]);
 h.records['users/b'].status='deleting';
 await assert.rejects(h.read({data:{action:'place',id:'room'}}),{code:'not-found'});
 await assert.rejects(h.read({auth:{uid:'b'},data:{action:'people'}}),{code:'permission-denied'});
});
test('listing context exposes safe identity only to a complete active viewer',async()=>{
 const h=harness();h.records['users/b'].roommateDiscoveryEnabled=false;
 const {record}=await h.read({auth:{uid:'a'},data:{action:'place',id:'room'}});
 assert.equal(record.ownerId,'b');assert.equal(record.ownerName,'Member');assert.equal(record.contact,undefined);
 const context=await h.interaction({auth:{uid:'a'},data:{targetUid:'b',listingId:'room'}});
 assert.equal(context.accepted,false);assert.deepEqual(context.identity,{uid:'b',name:'Member',avatar:'',isVerified:false});
 const anon=await h.read({data:{action:'place',id:'room'}});assert.equal(anon.record.ownerId,undefined);
});


test('a page shares repeated owner/viewer reads only within that request and preserves order',async()=>{
 const h=harness({'listings/second':{ownerId:'b',title:'Second',status:'active',monthlyRent:15000}});
 const page=await h.read({auth:{uid:'a'},data:{action:'places'}});
 assert.deepEqual(page.records.map(row=>row.id),['room','second']);
 assert.equal(h.reads['users/a'],1);assert.equal(h.reads['users/b'],1);
 h.records['users/b'].status='suspended';
 assert.deepEqual((await h.read({auth:{uid:'a'},data:{action:'places'}})).records,[]);
 assert.equal(h.reads['users/b'],2,'permissions must be read fresh on the next request');
});


test('inline raster images remain complete across discovery and peer projections',async()=>{
 const avatar='data:image/avif;base64,'+Buffer.alloc(6000,1).toString('base64');
 const h=harness({'users/b':{name:'Member',status:'active',onboardingComplete:true,roommateDiscoveryEnabled:true,housingPreferences:{activeIntents:['team_up']},avatar}});
 assert.equal((await h.read({auth:{uid:'a'},data:{action:'person',id:'b'}})).record.avatar,avatar);
 assert.equal((await h.read({auth:{uid:'a'},data:{action:'place',id:'room'}})).record.ownerAvatar,avatar);
 assert.equal((await h.interaction({auth:{uid:'a'},data:{targetUid:'b',listingId:'room'}})).identity.avatar,avatar);
 assert.deepEqual(projectPlace('room',{images:[avatar,avatar.slice(0,4096),'data:image/svg+xml;base64,PHN2Zz4=']},false).images,[avatar]);
});

test('historical room members resolve opted-out peers without gaining send permission',async()=>{
 const h=harness({'chatRooms/legacy':{participants:['a','b']}});h.records['users/b'].roommateDiscoveryEnabled=false;
 await assert.rejects(h.interaction({auth:{uid:'a'},data:{targetUid:'b'}}),{code:'permission-denied'});
 const context=await h.interaction({auth:{uid:'a'},data:{targetUid:'b',roomId:'legacy'}});
 assert.equal(context.identity.uid,'b');assert.equal(context.accepted,false);
});

test('foreign, mismatched and fabricated rooms never disclose private peer identity',async()=>{
 const h=harness({'chatRooms/foreign':{participants:['b','c']},'chatRooms/mismatch':{participants:['a','c']},'chatRooms/group':{participants:['a','b','c']}});h.records['users/b'].roommateDiscoveryEnabled=false;
 for(const roomId of ['foreign','mismatch','group','absent'])await assert.rejects(h.interaction({auth:{uid:'a'},data:{targetUid:'b',roomId}}),{code:'permission-denied'});
});
