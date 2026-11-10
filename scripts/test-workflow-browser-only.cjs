const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{createRequire}=require('node:module');
const appRequire=createRequire(path.resolve('app/package.json'));
const {initializeTestEnvironment}=appRequire('@firebase/rules-unit-testing');
const sdk=appRequire('firebase/firestore');
const browserChecks=require('./test-workflow-browser.cjs');
const files=['scripts/test-callable-server.cjs','scripts/test-workflow-browser.cjs','app/functions/accountJobs.js','app/src/lib/accountJobs.ts','app/functions/package-lock.json','app/src/lib/exploreEngine.js','app/src/lib/exploreNavigation.ts','app/src/pages/ExplorePage.tsx','app/src/App.tsx','app/src/pages/HelpPage.tsx','app/src/lib/support.ts','app/src/components/landing/LandingFooter.tsx','app/src/lib/nestmateBackend.ts','app/src/lib/listingTruth.ts','app/src/lib/sanitizeRenderedHtml.ts','app/src/components/landing/FeaturedListingsSection.tsx','app/src/nestmate-explore.css','app/src/lib/discoveryGateway.ts','app/functions/discoveryGateway.js','app/functions/sharedMatching.js','app/functions/sharedUserIntent.js','app/functions/index.js','app/firestore.indexes.json','app/firestore.rules','app/storage.rules','app/package-lock.json'];
const hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
(async()=>{
 const projectId=process.env.GCLOUD_PROJECT;
 if(!projectId?.startsWith('demo-'))throw Error('Explicit isolated demo project required.');
 const address=name=>{
  const [host,port]=String(process.env[name]||'').split(':');
  if(!['127.0.0.1','localhost'].includes(host)||!Number(port))throw Error('Explicit loopback emulator required: '+name);
  return {host,port:Number(port)};
 };
 const firestore=address('FIRESTORE_EMULATOR_HOST'),storage=address('FIREBASE_STORAGE_EMULATOR_HOST');
 address('FIREBASE_AUTH_EMULATOR_HOST');
 const sourceHashes=hashes();
 const env=await initializeTestEnvironment({projectId,firestore,storage});
 try{
  const {results,pageErrors}=await browserChecks(env,sdk);
  const sourceChangedDuringRun=JSON.stringify(sourceHashes)!==JSON.stringify(hashes());
  const report={project:projectId,results,pageErrors,sourceHashes,sourceChangedDuringRun};
  fs.writeFileSync('docs/workflow-correction/'+(process.argv.includes('--security-only')?'browser-security-results.json':'browser-only-results.json'),JSON.stringify(report,null,2));
  if(sourceChangedDuringRun||pageErrors.length||results.some(r=>r.status!=='PASS'))process.exitCode=1;
 }finally{await env.cleanup();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
