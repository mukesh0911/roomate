const {spawn}=require('node:child_process');
const {createRequire}=require('node:module'),path=require('node:path'),fs=require('node:fs');
const rootRequire=createRequire(path.resolve('package.json'));
module.exports=async function browserChecks(env,sdk){
 if(!process.env.FIREBASE_AUTH_EMULATOR_HOST||!process.env.GCLOUD_PROJECT.startsWith('demo-'))throw Error('Demo Auth emulator required.');
 const callableServer=spawn(process.execPath,[path.resolve('scripts/test-callable-server.cjs')],{env:process.env,windowsHide:true,stdio:'ignore'});
 const stopCallable=()=>{if(callableServer.exitCode===null)callableServer.kill();};
 process.once('exit',stopCallable);
 // Warm the actual SDK callable handlers before seeding fixtures.
 // Success requires the genuine unauthenticated rejection from each handler.
 for(const name of ['readDiscovery','getInteractionContext']) {
  const deadline=Date.now()+360000;let ready=false;
  while(Date.now()<deadline&&!ready) {
   if(callableServer.exitCode!==null){stopCallable();throw Error("Local callable HTTP host exited before readiness.");}
   try {
    const response=await fetch('http://127.0.0.1:19501/'+process.env.GCLOUD_PROJECT+'/us-central1/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:name==='readDiscovery'?{action:'people'}:{targetUid:'fixture'}}),signal:AbortSignal.timeout(180000)});
    const result=await response.json();ready=response.status===401&&result.error?.status==='UNAUTHENTICATED';
   } catch {}
   if(!ready)await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!ready){stopCallable();throw Error('Callable HTTP host did not become ready: '+name);}
 }
 const {initializeApp,deleteApp}=rootRequire('firebase-admin/app'),{getAuth}=rootRequire('firebase-admin/auth');
 const admin=initializeApp({projectId:process.env.GCLOUD_PROJECT},'workflow-browser');
 const password='IsolatedFixturePassword123!';
 for(const id of ['e','f'])await getAuth(admin).createUser({uid:id,email:id+'@workflow.test',password,emailVerified:true});
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  for(const id of ['e','f'])await sdk.setDoc(sdk.doc(db,'users',id),{name:id==='e'?'Browser Applicant':'Browser Host',city:'Pune',localities:['Baner'],status:'active',onboardingComplete:true,budget:20000,connectsUsed:0,blockedUserIds:[],housingPreferences:{activeIntents:['team_up']},roommateDiscoveryEnabled:true});
  await sdk.setDoc(sdk.doc(db,'listings','f-browser-place'),{ownerId:'f',ownerName:'Browser Host',title:'Browser Fixture Room',city:'Pune',locality:'Baner',roomType:'Private room',flatType:'2BHK',monthlyRent:12000,partnerShare:12000,totalRent:12000,deposit:0,status:'active',screeningQuestions:['Move date?'],images:['http://127.0.0.1:4186/assets/nestmate/photos/01-hero-woman.webp'],createdAt:sdk.Timestamp.now()});
 });
 const processEnv={...process.env,VITE_FIREBASE_API_KEY:'demo-key',VITE_FIREBASE_AUTH_DOMAIN:'demo-nestmate-workflows.firebaseapp.com',VITE_FIREBASE_PROJECT_ID:'demo-nestmate-workflows',VITE_FIREBASE_STORAGE_BUCKET:'demo-nestmate-workflows.appspot.com',VITE_FIREBASE_MESSAGING_SENDER_ID:'123456',VITE_FIREBASE_APP_ID:'demo-app',VITE_USE_FIREBASE_EMULATORS:'true',VITE_ACCOUNT_EXPORT_ENABLED:'true',VITE_BROADCASTS_ENABLED:'true',VITE_FIREBASE_AUTH_EMULATOR_PORT:'19080',VITE_FIRESTORE_EMULATOR_PORT:'18180',VITE_FIREBASE_STORAGE_EMULATOR_PORT:'19180',VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT:'19501'};
 const server=spawn(process.execPath,[path.resolve('app/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--strictPort','--port','4186'],{cwd:path.resolve('app'),env:processEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let serverOutput='';for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{serverOutput=(serverOutput+chunk.toString()).slice(-6000);});
 const {chromium}=rootRequire('@playwright/test');let browser;
 const results=[],errors=[],consoleErrors=[];
 const progress=phase=>fs.writeFileSync('docs/workflow-correction/browser-progress.json',JSON.stringify({phase,updatedAt:new Date().toISOString(),results},null,2));
 progress('preparing Vite');
 try{
  const until=Date.now()+180000;let ready=false;while(Date.now()<until){
   if(server.exitCode!==null)throw Error('Dedicated Vite server exited: '+serverOutput);
   try{const response=await fetch('http://127.0.0.1:4186/src/main.tsx',{signal:AbortSignal.timeout(15000)});if(response.ok){await response.text();ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,500));
  }if(!ready)throw Error('Dedicated Vite entry did not become ready: '+serverOutput);
  // Transform the existing large lazy route before starting assertion clocks.
  const exploreModule=await fetch('http://127.0.0.1:4186/src/pages/ExplorePage.tsx',{signal:AbortSignal.timeout(180000)});
  if(!exploreModule.ok)throw Error('Explore module failed to compile');await exploreModule.text();
  progress('launching browser');
  browser=await chromium.launch({headless:true});
  const contexts=await Promise.all([browser.newContext({viewport:{width:1440,height:1000}}),browser.newContext({viewport:{width:1440,height:1000}})]);
  for(const context of contexts) await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   return ['127.0.0.1','localhost'].includes(url.hostname)?route.continue():route.abort();
  });
  const pages=await Promise.all(contexts.map(c=>c.newPage()));
  for(const page of pages){page.setDefaultNavigationTimeout(180000);page.setDefaultTimeout(90000);}
  for(let i=0;i<pages.length;i++){
   progress('signing in fixture '+i);
   const page=pages[i];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text().slice(0,1000));});
   await page.goto('http://127.0.0.1:4186/',{waitUntil:'domcontentloaded'});
   await page.locator('a:has-text("Sign In"):visible').first().click();
   await page.getByLabel('Email',{exact:true}).fill((i===0?'e':'f')+'@workflow.test');
   await page.getByLabel('Password',{exact:true}).fill(password);
   await page.getByRole('button',{name:'Sign in with email',exact:true}).click();
   await page.getByRole('button',{name:'Sign in with email',exact:true}).waitFor({state:'hidden'});
  }
  const [a,b]=pages;
  const step=async(name,fn)=>{if(process.argv.includes('--security-only')&&!name.startsWith('Untrusted listing'))return;progress(name);try{await fn();results.push({name,status:'PASS'});progress(name+' complete');}catch(e){results.push({name,status:'FAIL',error:e.message});progress(name+' failed');throw e;}};
  await step('Discovery outage shows a retry state and recovers without losing the page',async()=>{
   const unavailable=route=>route.abort('failed');
   await a.route('**/readDiscovery',unavailable);
   await a.goto('http://127.0.0.1:4186/explore?tab=rooms',{waitUntil:'domcontentloaded'});
   await a.getByText('We could not load places',{exact:true}).waitFor();
   await a.unroute('**/readDiscovery',unavailable);
   await a.getByRole('button',{name:'Try again',exact:true}).click();
   await a.locator('article.card').filter({hasText:'Browser Fixture Room'}).waitFor();
   if(!a.url().includes('tab=rooms'))throw Error('Retry lost the selected discovery category');
  });
  await step('Featured Saved persists after reload and opens the actual listing ID',async()=>{
   await a.goto('http://127.0.0.1:4186/',{waitUntil:'domcontentloaded'});
   await a.locator('button[aria-label="Save Browser Fixture Room"]:visible').first().click();
   await a.locator('button[aria-label="Unsave Browser Fixture Room"]:visible').first().waitFor();
   await a.goto('http://127.0.0.1:4186/saved',{waitUntil:'domcontentloaded'});
   await a.locator('article.card').filter({hasText:'Browser Fixture Room'}).waitFor();
   await a.reload({waitUntil:'domcontentloaded'});
   await a.locator('article.card').filter({hasText:'Browser Fixture Room'}).waitFor();
   await a.goto('http://127.0.0.1:4186/',{waitUntil:'domcontentloaded'});
   await a.locator('button[aria-label="Unsave Browser Fixture Room"]:visible').first().waitFor();
   await a.getByText('Browser Fixture Room',{exact:true}).filter({visible:true}).first().click();
   await a.locator('[data-apply-place]:visible').first().waitFor();
   if(new URL(a.url()).searchParams.get('room')!=='f-browser-place')throw Error('Featured card lost the actual listing ID');
  });
  await step('Rooms Message requests listing consent; poster accepts in existing Connections UI',async()=>{
   await a.goto('http://127.0.0.1:4186/explore?tab=rooms',{waitUntil:'domcontentloaded'});
   const card=a.locator('article.card').filter({hasText:'Browser Fixture Room'});
   await card.waitFor();await card.getByRole('button',{name:'Connect with the poster'}).waitFor();await card.locator('[data-msg]').click();
   await a.getByText('Listing communication request sent.',{exact:false}).waitFor();
   await card.getByText('Pending',{exact:true}).waitFor();
   await a.goto('http://127.0.0.1:4186/explore?tab=all',{waitUntil:'domcontentloaded'});
   await a.locator('article.card').filter({hasText:'Browser Fixture Room'}).getByText('Pending',{exact:true}).waitFor();
   await a.goto('http://127.0.0.1:4186/saved',{waitUntil:'domcontentloaded'});
   await a.locator('article.card').filter({hasText:'Browser Fixture Room'}).getByText('Pending',{exact:true}).waitFor();
   await a.goto('http://127.0.0.1:4186/explore?tab=roommates',{waitUntil:'domcontentloaded'});
   const pendingPeer=a.locator('article').filter({hasText:'Browser Host'}).first();
   await pendingPeer.getByText('Pending',{exact:true}).waitFor();
   await env.withSecurityRulesDisabled(async ctx=>{const docs=await sdk.getDocs(sdk.query(sdk.collection(ctx.firestore(),'connections'),sdk.where('fromUserId','==','e'),sdk.where('toUserId','==','f')));if(docs.size!==1)throw Error('Duplicate cross-section request');});
   await b.goto('http://127.0.0.1:4186/connections',{waitUntil:'domcontentloaded'});
   await b.getByRole('button',{name:'Received',exact:true}).click();
   await b.locator('[data-conn-act="accept"]').first().click();
   await b.getByText('Connection request accepted!',{exact:false}).waitFor();
  });
  await step('Accepted consent is Message on room cards and details after reload',async()=>{
   await a.goto('http://127.0.0.1:4186/explore?tab=rooms',{waitUntil:'domcontentloaded'});
   const card=a.locator('article.card').filter({hasText:'Browser Fixture Room'});
   await card.getByRole('button',{name:'Message the poster'}).waitFor();
   const cardScore=await card.locator('.mp').innerText();
   await card.locator('.ph img').first().waitFor();
   await card.locator('.ph img').first().evaluate(img=>img.decode());
   await card.getByText('Browser Fixture Room',{exact:true}).click();
   await a.locator('[data-msg]:visible').first().getByText('Message',{exact:true}).waitFor();
   if(!(await a.locator('.rd').innerText()).includes('Browser Host'))throw Error('Incorrect listing owner');
   if(cardScore.includes('100%'))throw Error('Sparse preferences produced an unjustified full match');
  });
  await step('Roommates reuses listing permission and sends a real message',async()=>{
   await a.goto('http://127.0.0.1:4186/explore?tab=roommates',{waitUntil:'domcontentloaded'});
   const card=a.locator('article').filter({has:a.locator('[data-msg]')}).filter({hasText:'Browser Host'}).first();
   const profileScore=(await card.locator('.mc').innerText()).match(/(\d+)%/)[1];
   await card.locator('[data-msg]').click();
   await a.locator('.hn small').filter({hasText:profileScore+'% match'}).waitFor();
   await a.locator('#cin').fill('Browser message from listing consent');
   await a.evaluate(()=>{window.__draftRefreshObserved=false;const old=document.querySelector('#cin');const observer=new MutationObserver(()=>{if(document.querySelector('#cin')!==old){window.__draftRefreshObserved=true;observer.disconnect();}});observer.observe(document.querySelector('.th2'),{childList:true});});
   await a.waitForFunction(()=>new URL(location.href).searchParams.has('chat'));
   const roomId=new URL(a.url()).searchParams.get('chat');
   await env.withSecurityRulesDisabled(async ctx=>{await sdk.updateDoc(sdk.doc(ctx.firestore(),'chatRooms',roomId),{draftRefreshFixture:Date.now()});});
   await a.waitForFunction(()=>window.__draftRefreshObserved===true);
   if(await a.locator('#cin').inputValue()!=='Browser message from listing consent')throw Error('Realtime hydration discarded the unsent message draft');
   await a.locator('#csd').click();
   await a.getByText('Browser message from listing consent',{exact:false}).first().waitFor();
   if(!new URL(a.url()).searchParams.get('chat'))throw Error('Selected conversation has no stable URL');
   await a.reload({waitUntil:'domcontentloaded'});
   await a.locator('#cin').waitFor();
   await a.locator('.ms').getByText('Browser message from listing consent',{exact:false}).first().waitFor();
   await b.goto('http://127.0.0.1:4186/messages',{waitUntil:'domcontentloaded'});
   await b.getByText('Browser message from listing consent',{exact:false}).first().waitFor();
  });
  await step('Apply is independent; owner receives the actual questionnaire response',async()=>{
   await a.goto('http://127.0.0.1:4186/explore?room=f-browser-place',{waitUntil:'domcontentloaded'});
   await a.locator('[data-apply-place="f-browser-place"]:visible').first().click();
   await a.locator('#answer-0').fill('Next week');await a.locator('[data-app-submit]').click();
   await a.getByText('Application submitted',{exact:false}).waitFor();
   await b.goto('http://127.0.0.1:4186/listings',{waitUntil:'domcontentloaded'});
   await b.locator('[data-la="apl"]').first().click();
   await b.evaluate(()=>{window.__workflowClicks=[];document.addEventListener('click',event=>window.__workflowClicks.push(event.target.closest('button')?.outerHTML),true)});
   await b.locator('[data-apst]').first().click();
   try{await b.getByText('Application updated',{exact:false}).waitFor();}catch(error){
    const state=await b.evaluate(()=>({clicks:window.__workflowClicks,map:window.APC_MAP,toast:document.getElementById('tst')?.textContent}));throw Error(error.message+' Fixture diagnostics: '+JSON.stringify({...state,consoleErrors}));
   }
  });
  await step('Detail navigation preserves query state through browser Back and reload',async()=>{
   await a.goto('http://127.0.0.1:4186/explore?tab=rooms&q=Baner&max=20000',{waitUntil:'domcontentloaded'});
   const card=a.locator('article.card').filter({hasText:'Browser Fixture Room'});
   await card.waitFor(); await card.locator('.t').first().click();
   await a.waitForURL(url=>url.searchParams.get('room')==='f-browser-place');
   await a.locator('[data-apply-place]:visible').first().waitFor();
   await a.goBack({waitUntil:'domcontentloaded'});
   await a.waitForURL(url=>!url.searchParams.has('room'));
   await a.locator('article.card').filter({hasText:'Browser Fixture Room'}).waitFor();
   if(await a.locator('#q').inputValue()!=='Baner')throw Error('Back lost search query');
   if(new URL(a.url()).searchParams.get('max')!=='20000')throw Error('Back lost budget');
   await a.reload({waitUntil:'domcontentloaded'});
   await a.locator('article.card').filter({hasText:'Browser Fixture Room'}).waitFor();
   if(await a.locator('#q').inputValue()!=='Baner')throw Error('Reload lost search query');
  });
  await step('Account export downloads private current-user records through the callable and worker',async()=>{
   await env.withSecurityRulesDisabled(async ctx=>{
    await sdk.updateDoc(sdk.doc(ctx.firestore(),'users','e'),{exportOwnMarker:'owned-export-fixture'});
    await sdk.updateDoc(sdk.doc(ctx.firestore(),'users','f'),{exportPrivateMarker:'peer-private-export-fixture'});
   });
   await a.goto('http://127.0.0.1:4186/profile?section=settings',{waitUntil:'domcontentloaded'});
   const downloading=a.waitForEvent('download',{timeout:120000});
   await a.locator('[data-ex]').click();const download=await downloading;
   const contents=require('node:zlib').gunzipSync(fs.readFileSync(await download.path())).toString('utf8');
   if(!contents.includes('owned-export-fixture')||contents.includes('peer-private-export-fixture'))throw Error('Export scope does not isolate private accounts');
   if(download.suggestedFilename()!=='nestmate-data.ndjson.gz')throw Error('Unexpected export download format');
  });
  await step('Privacy and announcement settings persist and enforce discovery opt-in',async()=>{
   await a.goto('http://127.0.0.1:4186/profile?section=settings',{waitUntil:'domcontentloaded'});
   await a.locator('[data-st="1"]').click();
   await a.locator('[data-vis="hidden"]').click();
   await a.locator('[data-vis="hidden"][aria-pressed="true"]:not([disabled])').waitFor();
   await a.reload({waitUntil:'domcontentloaded'});
   await a.locator('[data-vis="hidden"][aria-pressed="true"]').waitFor();
   const discoveryResponse=b.waitForResponse(response=>response.url().endsWith('/readDiscovery') && response.request().postDataJSON()?.data?.action==='people');
   await b.goto('http://127.0.0.1:4186/explore?tab=roommates',{waitUntil:'domcontentloaded'});
   const discovery=await (await discoveryResponse).json();
   if(!Array.isArray(discovery.result?.records)||discovery.result.records.some(record=>record.uid==='e'))throw Error('Gateway did not enforce saved discovery opt-out');
   await env.withSecurityRulesDisabled(async ctx=>{
    const own=await sdk.getDoc(sdk.doc(ctx.firestore(),'users','e'));
    if(own.data().roommateDiscoveryEnabled!==false)throw Error('Discovery setting was not saved');
   });
   await b.goto('http://127.0.0.1:4186/explore?tab=roommates',{waitUntil:'domcontentloaded'});
   await b.locator('article .msgb').first().waitFor();
   if(await b.locator('article').filter({hasText:'Browser Applicant'}).count())throw Error('A historical connection reinserted an opted-out member into discovery');
   await a.locator('[data-vis="discoverable"]').click();
   await a.locator('[data-vis="discoverable"][aria-pressed="true"]:not([disabled])').waitFor();
   await a.locator('[data-st="2"]').click();
   await a.locator('[data-sw="broadcasts"]').click();
   await a.locator('[data-sw="broadcasts"][aria-checked="false"]:not([disabled])').waitFor();
   await a.reload({waitUntil:'domcontentloaded'});
   await a.locator('[data-sw="broadcasts"][aria-checked="false"]').waitFor();
   await env.withSecurityRulesDisabled(async ctx=>{
    const own=await sdk.getDoc(sdk.doc(ctx.firestore(),'users','e'));
    if(own.data().notificationPreferences?.broadcasts!==false)throw Error('Announcement preference was not saved');
   });
  });
  await step('Help route stores a real support ticket and denies peer reads',async()=>{
   await a.goto('http://127.0.0.1:4186/help',{waitUntil:'domcontentloaded'});
   await a.getByRole('heading',{name:'Help and support',exact:true}).waitFor();
   await a.getByLabel('Topic',{exact:true}).selectOption('account');
   await a.getByLabel('Message',{exact:true}).fill('Isolated browser support fixture: account access concern.');
   await a.getByRole('button',{name:'Send request',exact:true}).click();
   const receipt=a.getByRole('status').filter({hasText:'Your support request was stored.'});
   await receipt.waitFor();
   const id=(await receipt.locator('strong').textContent()).trim();
   await env.withSecurityRulesDisabled(async ctx=>{
    const ticket=await sdk.getDoc(sdk.doc(ctx.firestore(),'supportTickets',id));
    if(!ticket.exists()||ticket.data().userId!=='e'||ticket.data().topic!=='account'||ticket.data().status!=='open'||ticket.data().message!=='Isolated browser support fixture: account access concern.')throw Error('Ticket receipt does not match stored request');
   });
   let denied=false;
   try { await sdk.getDoc(sdk.doc(env.authenticatedContext('f').firestore(),'supportTickets',id)); }
   catch(error) { if(error.code==='permission-denied')denied=true;else throw error; }
   if(!denied)throw Error('Peer could read a private support request');
   await a.reload({waitUntil:'domcontentloaded'});
   await a.getByRole('heading',{name:'Help and support',exact:true}).waitFor();
  });
  await step('Untrusted listing and profile text cannot create delegated action controls',async()=>{
   const payload='<button class="injected-action" data-gone="1" data-app-submit="1">Injected action</button>';
   await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await sdk.updateDoc(sdk.doc(db,'listings','f-browser-place'),{title:payload,ownerName:payload,description:payload,amenities:[payload],houseRules:[payload]});
    await sdk.updateDoc(sdk.doc(db,'users','f'),{name:payload,bio:payload,profession:payload});
   });
   await a.goto('http://127.0.0.1:4186/explore?room=f-browser-place',{waitUntil:'domcontentloaded'});
   await a.locator('[data-apply-place]:visible').first().waitFor();
   if(await a.locator('.injected-action').count())throw Error('Listing text created an actionable element');
   const title=await a.locator('.rd h2').first().textContent();if(title!==payload)throw Error('Listing title was not preserved as literal text');
   await a.goto('http://127.0.0.1:4186/explore?tab=roommates',{waitUntil:'domcontentloaded'});
   await a.locator('article.rm').filter({hasText:payload.slice(0,80)}).first().waitFor();
   if(await a.locator('.injected-action').count())throw Error('Profile text created an actionable element');
   await env.withSecurityRulesDisabled(async ctx=>{
    await sdk.setDoc(sdk.doc(ctx.firestore(),'notifications','hostile-text-fixture'),{userId:'e',actorId:'f',type:'system',title:payload,description:payload,read:false,createdAt:sdk.Timestamp.now()});
   });
   await a.goto('http://127.0.0.1:4186/notifications',{waitUntil:'domcontentloaded'});
   await a.locator('.nt').filter({hasText:'Injected action'}).first().waitFor();
   if(await a.locator('.injected-action').count())throw Error('Notification text created an actionable element');
   await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    await sdk.updateDoc(sdk.doc(db,'listings','f-browser-place'),{title:'Browser Fixture Room',ownerName:'Browser Host',description:'',amenities:[],houseRules:[]});
    await sdk.updateDoc(sdk.doc(db,'users','f'),{name:'Browser Host',bio:'',profession:''});
   });
  });
  for(const width of [390,768,1440]){
   await a.setViewportSize({width,height:900});await a.goto('http://127.0.0.1:4186/explore?room=f-browser-place',{waitUntil:'domcontentloaded'});await a.locator('[data-apply-place]:visible').first().waitFor();
   const overflow=await a.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   const clippedFactor=await a.locator('.bars b').evaluateAll(labels=>labels.some(label=>label.scrollWidth>label.clientWidth+1));
   await a.locator('.kf').getByText('No deposit',{exact:true}).waitFor();
   results.push({name:'Actual detail layout at '+width,status:overflow||clippedFactor?'FAIL':'PASS'});
   await a.screenshot({path:'docs/workflow-correction/browser-detail-'+width+'.png',fullPage:true});
  }
 }catch(error){if(!results.some(r=>r.status==='FAIL'))results.push({name:'Browser setup or flow',status:'FAIL',error:error.message});
  if(browser)for(const [index,context] of browser.contexts().entries())for(const page of context.pages())await page.screenshot({path:'docs/workflow-correction/browser-failure-'+index+'.png',timeout:10000}).catch(()=>{});
 }
 finally{if(browser)await browser.close();server.kill();await deleteApp(admin);}
 stopCallable();process.removeListener('exit',stopCallable);
 fs.writeFileSync('docs/workflow-correction/browser-results.json',JSON.stringify({results,pageErrors:errors},null,2));
 return {results,pageErrors:errors};
};
