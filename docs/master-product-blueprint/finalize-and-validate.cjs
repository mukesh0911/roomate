// Review refinements and documentation checks only. Never imports or writes application code.
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname,root=path.resolve(dir,'../..');
const get=n=>fs.readFileSync(path.join(dir,n+'.md'),'utf8');
const set=(n,s)=>fs.writeFileSync(path.join(dir,n+'.md'),s);
const required=['PRODUCT_VISION_AND_DOMAIN_MODEL','USER_TYPES_AND_CAPABILITY_MATRIX','COMPLETE_USER_EXPERIENCE_FLOW','INFORMATION_ARCHITECTURE','DISCOVERY_AND_LISTING_WORKFLOW','ENTITY_AND_DETAIL_PAGE_RELATIONSHIPS','INTERACTION_AND_COMMUNICATION_MODEL','FEATURE_LIFECYCLE_AND_STATE_DIAGRAMS','PAGE_BY_PAGE_PRODUCT_SPECIFICATION','DATA_SOURCE_OF_TRUTH_AND_MAPPING','CROSS_PAGE_CONSISTENCY_MAP','FAILURE_AND_RECOVERY_WORKFLOWS','EXISTING_APPLICATION_GAP_ANALYSIS','PRODUCT_LOGIC_AND_ARCHITECTURE_DECISIONS','MASTER_IMPLEMENTATION_ROADMAP','EXECUTIVE_SUMMARY'];
const table=(h,r)=>'| '+h.join(' | ')+' |\n| '+h.map(()=>'---').join(' | ')+' |\n'+r.map(row=>'| '+row.map(x=>String(x).replaceAll('|',' / ').replaceAll('\n',' ')).join(' | ')+' |').join('\n')+'\n';
const stateCount=(get('FEATURE_LIFECYCLE_AND_STATE_DIAGRAMS').match(/^stateDiagram-v2$/gm)||[]).length;
set('EXECUTIVE_SUMMARY',get('EXECUTIVE_SUMMARY').replace('10 entity state diagrams',stateCount+' entity state diagrams').replace('Ten independent state machines','Fourteen independent state machines'));
set('DATA_SOURCE_OF_TRUTH_AND_MAPPING',get('DATA_SOURCE_OF_TRUTH_AND_MAPPING').replace('The actual implementation comparison is added only after the target model is defined; see the mapping appendix generated in this folder’s comparison phase.','The actual implementation comparison follows the independently defined target model in the appendix below.'));
// Make the pre-write authorization order unambiguous; blocked members cannot create an application first.
set('INTERACTION_AND_COMMUNICATION_MODEL',get('INTERACTION_AND_COMMUNICATION_MODEL').replace(
 '  Action[Person Connect or listing Express interest] --> Kind{Listing context?}\n  Kind -->|Yes| App[Create/version application + answers]\n  Kind -->|No| Pair[Resolve pair state]\n  App --> Pair\n  Pair -->|Blocked/restricted| Stop[No request or send; safe explanation]',
 '  Action[Person Connect or listing Express interest] --> Authz{Authorize actors and all-context restrictions}\n  Authz -->|Blocked/restricted| Stop[No application, request or send; safe explanation]\n  Authz -->|Eligible| Kind{Listing context?}\n  Kind -->|Yes| App[Validate/version application + answers]\n  Kind -->|No| Pair[Resolve pair state before commit]\n  App --> Pair'));
const pageCases=[
 ['P01','Search, city and category CTA','Submit a supported city, budget and move-in.','The discovery URL and result scope preserve all supported choices; no synthetic inventory appears on zero/error.'],
 ['P02','Sign in/register/reset/provider and close','Enter from a protected saved or shared entity; close and reopen; then sign in.','Close creates no account/action. Successful Auth reauthorizes the exact return context; no request is auto-sent. Reset feedback follows actual provider response.'],
 ['P03','Step navigation, intent, opt-in and finish','Choose find_room + team_up, skip optional lifestyle and decline directory opt-in.','Private requests remain available once required essentials exist; no public directory card or invented answers. Back keeps the own draft; finish returns to intended action.'],
 ['P04','All, filters, sort, clear and continuation','Open All with both physical kinds and load another page.','Cards retain listing identity/kind/unit. Cursor reflects all predicates, no duplicate page or person substituted; clear filters resets cursor and query.'],
 ['P05','Rooms/flat controls','Choose an entire-flat price scope, BHK and area.','RoomType, BHK and price unit remain separate; unsupported combinations explain limits instead of silently ignoring a filter.'],
 ['P06','People card and fit controls','Browse as an authorized member without opting into own directory publication.','Only eligible opted-in candidates appear; find_room-only/commercial-only profiles do not masquerade as team-up/residents. Unknown fit is labelled, not a fabricated baseline.'],
 ['P07','PG options and gallery','Open a PG with actual bed/room options and return.','The detail preserves the same listingId, actual per-unit price/capacity/charges; missing option facts stay unknown, context and scroll return.'],
 ['P08','Gallery/save/share/publisher/resident/interest','Open a listing outside discovery; submit required answers while its version changes.','Loader authorizes by ID; related profiles use real UIDs and scopes. Stale required answers need review. Neither save nor share grants contact access.'],
 ['P09','Person relationship controls','Reach the person from chat, Saved and listing publisher link.','Same UID; fields/actions vary by authorization/context. A publisher is not labelled resident without declaration. State and actions agree with Connections.'],
 ['P10','Place/people tabs, remove and retry','Save a private/unavailable entity that is absent from the feed.','Show scoped unavailable tombstone and removable own reference. Network error offers retry, not a successful empty list or leaked private identity.'],
 ['P11','Incoming/sent/accepted/closed','Accept while sender withdraws; refresh both sessions.','One current result wins with version conflict handling. A listing application remains separately visible and its stage is not silently changed.'],
 ['P12','Room/search/unread/composer/photo/partner/context','Send once with lost acknowledgement, retry, then read on the other account.','One message, real date, atomic summary and independent read cursors. Partner opens by UID; failed image upload leaves a draft. Contact sharing requires a separate explicit grant.'],
 ['P13','Inbox/read/target action','Open a notification for a declined/expired or no-longer-authorized request.','Show current scoped target state; stale button cannot accept another request. Own read marker persists without mutating the pair.'],
 ['P14','New, status filter, draft/edit/applicants','Open a pending or filled own listing and refresh.','Actual canonical states/rent/unit and applicant count remain. Available actions follow current authorization; no draft-to-Active display fallback.'],
 ['P15','Wizard step/back/photos/preview/draft/submit/close','Save draft with staged photos, return later, edit and submit.','Recover same listing ID/version; upload failure does not publish. Close/discard is explicit; submit acknowledges review, never announces live publication early.'],
 ['P16','Applicant filters/detail/answers/stage/consent','Shortlist then select one application while communication is pending.','Stage persists per listing/application; consent still needs recipient action; owner separately confirms real availability. New inquiry updates count without unrelated listing write.'],
 ['P17','Comparison selection/return/shortlist','Compare selected applications for one listing with missing lifestyle answers.','Known and unknown factors remain truthful; no viewer default diet/smoking/move-in. Comparison alone commits no decision; return preserves applicant filter.'],
 ['P18','Profile/preferences/photo/intents/Save/Discard','Edit name and avatar with three saved localities; discard, then save a new explicit change.','Discard keeps prior profile/photo/localities. Save only intended changes; no collateral locality loss or self-granted trust/staff fields.'],
 ['P19','Private upload/type/name/consent/status/resubmit','Resubmit rejected evidence while an old reviewer tab is open.','Private new version and actual review note/type/name appear. Old version decision conflicts safely. No government-verification badge or automatic property activation.'],
 ['P20','Credentials/privacy/blocks/data/outcome','Exercise each supported operation under current provider and retention policy.','Unavailable operation is explicit. Own block removal never clears peer block/restores chat; export/download and deletion show real jobs. Outcome alters only chosen intents, never peer occupancy.'],
 ['P21','Content/help/support form/Back','Open each public help/legal route directly; submit a supported case.','Actual reviewed content loads. Topic/message plus explicitly disclosed contact fields are validated; acknowledge a persisted ticket ID or actual channel result, never an email promise. Close cancels unsent text; retain failed draft/retry.'],
 ['P22','Queue/filter/inspect/decide/reason/grants/broadcast','Use moderator, ID reviewer and administrator separately; force a sanction or delivery error.','Only scoped actions/data allowed on backend. Required action failure stays pending/partial; exact-version reviews, explicit grants, real counters/environment and tracked delivery replace misleading success.']
];
let p=get('PAGE_BY_PAGE_PRODUCT_SPECIFICATION').split('\n## View-specific acceptance and secondary action contracts')[0];
p+='\n## View-specific acceptance and secondary action contracts\n\nThe following concrete cases supplement each page’s shared loading/error/access rules. Local presentation actions (gallery next/previous, grid/list, accordion, modal close, comparison selection and menu opening) change only view state, preserve keyboard/focus and never imply a domain commit. Read-marker and help/support actions are explicit secondary contracts below; they are not silently treated as consent or report sanctions.\n\n'+table(['View','Control group','Given / action','Required result and cancellation boundary'],pageCases)+
 '\n### Secondary read/support contracts\n\nNotification mark-one/mark-all-read is owner-only and idempotent against the recipient event IDs or observed cursor; it changes no domain request/application state. New concurrent unread events remain unread if outside the marked observed scope. Error leaves a retryable pending read marker; refresh reconciles the owner record.\n\nSupport case submission is separate from a safety report against a marketplace entity. A visitor/member sees supported topics and the actual operating channel, enters a nonempty bounded message, chooses reply contact explicitly and reviews disclosure. A signed-in actor UID is checked against Auth; a public ticket cannot forge staff status or privileged fields. The service validates the supported schema/rate controls, persists an immutable initial case and returns its ID; staff processing follows the case lifecycle with safe reply access and real delivery acknowledgement. Field length/rate/provider parameters are deployment configuration to review, not invented current guarantees. If no supported channel is operational, show its real availability instead of claiming submission.\n\nCopy/share waits for the browser result; if denied, retain selectable link text. Newsletter/social/language controls do not promise subscriptions, external destinations or translation without a real supported service and scope decision. Profile/contact controls show only the fields authorized for that context.\n';
set('PAGE_BY_PAGE_PRODUCT_SPECIFICATION',p);
const workflows=JSON.parse(fs.readFileSync(path.join(root,'docs/autonomous-product-audit/workflow-catalog.json'),'utf8'));
const findings=JSON.parse(fs.readFileSync(path.join(root,'docs/autonomous-product-audit/audit-findings.json'),'utf8'));
const featureMap=JSON.parse(fs.readFileSync(path.join(dir,'feature-target-map.json'),'utf8'));
const workflowTargets=['T01','T01','T02','T05','T03 T04','T03 T27','T03 T27','T18 T19','T21','T22','T06 T23','T07','T08 T09 T10','T02 T08 T09','T11 T12','T13','T14','T02','T17 T31','T16','T02 T05','T25','T25','T25','T26','T30','T32','T32','T32','T29','T02 T03','T28'];
const workflowClasses=['Incorrectly implemented','Incorrectly implemented','Partially implemented','Disconnected','Partially implemented','Partially implemented','Partially implemented','Partially implemented','Partially implemented','Inconsistent with another section','Disconnected','Partially implemented','Partially implemented','Partially implemented','Partially implemented','Incorrectly implemented','Incorrectly implemented','Incorrectly implemented','Partially implemented','Partially implemented','Disconnected','Incorrectly implemented','Inconsistent with another section','Inconsistent with another section','Inconsistent with another section','Partially implemented','Disconnected','Incorrectly implemented','Unnecessary','Disconnected','Partially implemented','Disconnected'];
const wm=workflows.map((w,i)=>({...w,target:workflowTargets[i],classification:workflowClasses[i],sourceLocations:w.findings.map(id=>findings.find(f=>f.id===id)?.location).filter(Boolean)}));
fs.writeFileSync(path.join(dir,'existing-workflow-target-map.json'),JSON.stringify(wm,null,2));
let gap=get('EXISTING_APPLICATION_GAP_ANALYSIS').split('\n## Existing reconstructed workflow coverage')[0];
gap+='\n## Existing reconstructed workflow coverage\n\nAll 32 prior reconstructed W workflows are separately mapped here; W identifiers describe existing journeys and are not aliases for the independently designed T transitions. Original bounded status is preserved alongside the target classification. Rows with no attached defect use the active Auth/Explore/backend entry modules; a partial rating is not a complete runtime pass.\n\n'+table(['Existing workflow','Classification','Observed chain','Prior evidence status','Exact evidence / source','Target contract and dependency'],wm.map(w=>[w.id+' '+w.name,w.classification,w.steps,w.status,w.sourceLocations.map(s=>`[${s.file}:${s.line}](../../${s.file}#L${s.line})`).join('; ')||'[useAuth.ts:1](../../app/src/hooks/useAuth.ts#L1); [ExplorePage.tsx:1](../../app/src/pages/ExplorePage.tsx#L1)',w.target+'; '+w.dependencies]));
set('EXISTING_APPLICATION_GAP_ANALYSIS',gap);
// Structural checks: does not claim a Mermaid renderer or runtime test pass.
const errors=[],links=[],diagramKinds={},counts={documents:required.length,pages:22,targetTransitions:32,existingWorkflows:wm.length,decisions:22,features:featureMap.length,findings:findings.length,elements:JSON.parse(fs.readFileSync(path.join(dir,'element-traceability.json'),'utf8')).length,stateDiagrams:stateCount};
for(const name of required){
 const file=path.join(dir,name+'.md');
 if(!fs.existsSync(file)){errors.push('Missing '+name);continue;}
 const text=fs.readFileSync(file,'utf8');
 if((text.match(/^```/gm)||[]).length%2)errors.push('Unbalanced code fences '+name);
 for(const b of text.matchAll(/```mermaid\n([\s\S]*?)\n```/g)){
  const kind=b[1].split('\n')[0];diagramKinds[kind]=(diagramKinds[kind]||0)+1;
  if(!['flowchart TD','flowchart LR','sequenceDiagram','stateDiagram-v2','erDiagram'].includes(kind))errors.push('Unknown diagram kind '+name+': '+kind);
 }
 for(const m of text.matchAll(/\]\(([^)\n]+)\)/g)){
  const dest=m[1];if(/^(https?:|#)/.test(dest))continue;
  const relative=decodeURIComponent(dest.split('#')[0]);const target=path.resolve(dir,relative);
  if(!fs.existsSync(target))errors.push('Broken link '+name+': '+dest);
  links.push({document:name,target:dest});
 }
 for(const id of text.matchAll(/\b([PTD])(\d{2})\b/g)){
  const limit={P:22,T:32,D:22}[id[1]];if(+id[2]<1||+id[2]>limit)errors.push('Unknown contract '+id[0]+' in '+name);
 }
 if(text.includes('\uFFFD'))errors.push('Replacement character '+name);
}
const anchors=JSON.parse(fs.readFileSync(path.join(dir,'finding-anchor-validation.json'),'utf8'));
if(anchors.some(a=>!a.lineExists||!a.excerptMatches))errors.push('Invalid finding anchor');
if(counts.elements!==400||counts.features!==81||counts.findings!==52||counts.existingWorkflows!==32||stateCount!==14)errors.push('Unexpected inventory count');
const integrity=JSON.parse(fs.readFileSync(path.join(dir,'source-integrity.json'),'utf8'));
if(integrity.changed.length||integrity.missing.length)errors.push('Source integrity changed');
const report={checkedAt:new Date().toISOString(),scope:'Documentation structure, links, contract references, source anchors and baseline hashes; not runtime acceptance or rendered Mermaid validation.',counts,diagramKinds,localLinksChecked:links.length,exactFindingAnchorsMatched:anchors.filter(a=>a.excerptMatches).length,sourceFilesChecked:integrity.filesChecked,changedSourceFiles:integrity.changed,missingSourceFiles:integrity.missing,errors,passed:errors.length===0};
fs.writeFileSync(path.join(dir,'blueprint-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(errors.length)process.exitCode=1;
