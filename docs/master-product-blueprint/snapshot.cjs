// Read-only integrity check; outputs stay in this deliverable directory.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/autonomous-product-audit/source-discovery.json'),'utf8'));
const files=[...inventory.files,'app/public/sw.js','app/public/sitemap.xml','app/public/robots.txt','app/.firebaserc'];
const hashes=Object.fromEntries(files.filter(f=>fs.existsSync(path.join(root,f))).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const before=path.join(__dirname,'source-baseline.json');
if(!fs.existsSync(before))fs.writeFileSync(before,JSON.stringify(hashes,null,2));
else{const baseline=JSON.parse(fs.readFileSync(before,'utf8'));fs.writeFileSync(path.join(__dirname,'source-integrity.json'),JSON.stringify({checkedAt:new Date().toISOString(),filesChecked:Object.keys(baseline).length,changed:Object.keys(baseline).filter(f=>baseline[f]!==hashes[f]),missing:Object.keys(baseline).filter(f=>!(f in hashes))},null,2));}
const app=fs.readFileSync(path.join(root,'app/src/App.tsx'),'utf8');
fs.writeFileSync(path.join(__dirname,'current-route-snapshot.json'),JSON.stringify([...app.matchAll(/<Route path="([^"]+)"/g)].map(m=>({path:m[1],file:'app/src/App.tsx',line:app.slice(0,m.index).split('\n').length})),null,2));
console.log(`Read-only snapshot: ${Object.keys(hashes).length} files; no product writes.`);
