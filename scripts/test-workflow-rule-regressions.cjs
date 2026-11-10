// Only invoked within the dedicated local demo emulator, never production.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
if(!process.env.GCLOUD_PROJECT?.startsWith('demo-')||!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_STORAGE_EMULATOR_HOST)throw Error('Explicit demo emulators required.');
const result=spawnSync(process.execPath,[path.resolve('app/node_modules/vitest/vitest.mjs'),'run',...(process.argv.includes('--storage-only')?['storage.rules.test.ts']:['firestore.rules.test.ts','storage.rules.test.ts']),'--maxWorkers=1','--reporter=json','--outputFile=../docs/workflow-correction/'+(process.argv.includes('--storage-only')?'storage-results.json':'rules-results.json')],{
 cwd:path.resolve('app'),env:{...process.env,RUN_RULES_TESTS:'1',RUN_STORAGE_RULES_TESTS:'1'},windowsHide:true,stdio:'inherit',
});
process.exitCode=result.status??1;
