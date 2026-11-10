const {spawn,execFileSync}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
// Resolve the installed CLI on each machine; never depend on a developer's home.
let cli;
try { cli=require.resolve('firebase-tools/lib/bin/firebase.js'); }
catch {
 const globalRoot=execFileSync(process.platform==='win32'?'npm.cmd':'npm',['root','-g'],{encoding:'utf8',shell:process.platform==='win32',windowsHide:true}).trim();
 cli=path.join(globalRoot,'firebase-tools','lib','bin','firebase.js');
}
if(!fs.existsSync(cli))throw Error('Install Firebase CLI 15.15.0 before running isolated workflow tests.');
const started=Date.now();
const regressions=process.argv.includes('--regressions');
const backendOnly=process.argv.includes('--backend-only');
const browserSecurity=process.argv.includes('--browser-security-only');
const browserOnly=process.argv.includes('--browser-only')||browserSecurity;
const command=regressions?'node scripts/test-workflow-rule-regressions.cjs':browserOnly?'node scripts/test-workflow-browser-only.cjs'+(browserSecurity?' --security-only':''):'node scripts/test-workflow-emulator.cjs'+(backendOnly?' --backend-only':'');
const child=spawn(process.execPath,[cli,'emulators:exec','--config','app/firebase.workflow.json','--only','auth,firestore,storage','--project','demo-nestmate-workflows',command],{env:{...process.env,DEBUG:'',FIREBASE_DEBUG:'',CI:'true'},windowsHide:true,stdio:['ignore','pipe','pipe']});
// Firebase debug output can include process environment: never forward it.
let diagnostic='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{for(const line of String(chunk).split('\n'))if(/^(Error:|FAIL |PASS |.*rules.*[Ee]rror|.*[Ee]mulator.*(error|failed|exited)|.*(SyntaxError|ReferenceError|TypeError|AssertionError))/.test(line)&&!line.includes('environment'))diagnostic+=line+'\n';});
child.on('exit',code=>{const f='docs/workflow-correction/'+(regressions?'rules-results.json':backendOnly?'backend-only-results.json':browserSecurity?'browser-security-results.json':browserOnly?'browser-only-results.json':'emulator-results.json');if(fs.existsSync(f)&&fs.statSync(f).mtimeMs>=started){const report=JSON.parse(fs.readFileSync(f,'utf8'));console.log(regressions?JSON.stringify({tests:report.numTotalTests,passed:report.numPassedTests,failed:report.numFailedTests,failures:report.testResults?.flatMap(s=>s.assertionResults.filter(t=>t.status==='failed').map(t=>({name:t.fullName,error:t.failureMessages})))},null,2):JSON.stringify(report,null,2));}else console.log('No fresh result artifact: run did not complete the workflow script.');console.log('Emulator process exit:',code);if(code)console.log(diagnostic.slice(-7000));process.exitCode=code||0;});
