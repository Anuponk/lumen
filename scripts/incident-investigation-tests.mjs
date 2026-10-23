import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
const load=()=>import('../src/ui/incident-investigation.js');
const session='00000000-0000-0000-0000-000000000001',trace='00000000-0000-0000-0000-000000000002';
const event=(code,sequence,extra={})=>({session_id:session,trace_id:trace,sequence,code,stage:'guided',kind:'unknown',app_version:'1.11.1+500',platform:'desktop',browser:'chromium',before_state:'unknown',after_state:'unknown',...extra});
const scenario=()=>['guided_error','guided_undo','guided_input_blocked','guided_undo','guided_input_blocked','guided_undo','guided_input_released'].map((code,i)=>event(code,i+1,{after_state:code.endsWith('blocked')?'blocked':code.endsWith('released')?'ready':'unknown'}));

test('observed versions sort numerically and keep aggregate counts separate from episode counts',async()=>{
 const {buildIncidentInvestigation}=await load();
 const data={timeline:[event('guided_error',1,{app_version:'1.11.1+99'}),event('guided_input_blocked',2,{app_version:'1.11.1+100'})],
  signatures:[{code:'guided_error',stage:'guided',app_version:'1.11.1+99',occurrences:8,sessions:2},
   {code:'guided_input_blocked',stage:'guided',app_version:'1.11.1+100',occurrences:2,sessions:1},
   {code:'runtime_exception',stage:'runtime',app_version:'1.12.0+1',occurrences:3,sessions:1}]};
 const before=JSON.stringify(data),model=buildIncidentInvestigation(data);
 assert.deepEqual(model.versions,[{version:'1.12.0+1',occurrences:3,signatures:1,episodes:0},
  {version:'1.11.1+100',occurrences:2,signatures:1,episodes:1},{version:'1.11.1+99',occurrences:8,signatures:1,episodes:1}]);
 assert.equal(model.episodes.length,1,'A release change never splits or merges session evidence');
 assert.equal(JSON.stringify(data),before);
});
test('unknown versions stay visible without exposing untrusted labels or inventing observations',async()=>{
 const {buildIncidentInvestigation}=await load();
 const model=buildIncidentInvestigation({timeline:[event('guided_error',1,{app_version:'Bearer PRIVATE'})],
  signatures:[{code:'guided_error',app_version:'<private@example.invalid>',occurrences:-3,sessions:5}]});
 assert.deepEqual(model.versions,[{version:'unknown',occurrences:0,signatures:1,episodes:1}]);
 assert(!JSON.stringify(model.versions).includes('PRIVATE')&&!JSON.stringify(model.versions).includes('private@'));
 assert.deepEqual(buildIncidentInvestigation({}).versions,[]);
});
test('#533 correlates ordered error/undo/blocked/additional undo/release without claiming save recovery',async()=>{
 const {buildIncidentInvestigation}=await load();const rows=scenario();const m=buildIncidentInvestigation({timeline:rows.reverse()});
 assert.equal(m.episodes.length,1);assert.deepEqual(m.episodes[0].events.map(e=>e.code),scenario().map(e=>e.code));
 assert.equal(m.episodes[0].state,'released');assert.equal(m.episodes[0].partial,true);
});
test('bounded samples never cross-correlate sessions or infer resolution from a retry/ack',async()=>{
 const {buildIncidentInvestigation}=await load();
 const m=buildIncidentInvestigation({timeline:[event('hydration_blocked',1),event('outbox_acknowledged',2),event('guided_input_blocked',3),event('guided_input_released',1,{session_id:trace})]});
 assert.equal(m.episodes.length,2);assert.equal(m.episodes.find(e=>e.events.length===3).state,'blocked');
 assert(buildIncidentInvestigation({timeline:Array.from({length:150},(_,i)=>event('guided_undo',i+1))}).episodes[0].events.length<=100);
});
test('reports and GitHub drafts omit identifiers, dates, arbitrary fields and secret-shaped context',async()=>{
 const {buildIncidentInvestigation,incidentReport,githubIssueDraft}=await load();
 const e=event('guided_error',1,{email:'secret@example.invalid',message:'Bearer SECRET',profile:{save:'SECRET'},app_version:'secret@example.invalid',stage:'https://private/?token=SECRET'});
 const episode=buildIncidentInvestigation({timeline:[e]}).episodes[0],report=incidentReport(episode),url=githubIssueDraft(episode);
 for(const text of [report,decodeURIComponent(url)])for(const forbidden of ['SECRET','secret@','private','Bearer',session,trace])assert(!text.includes(forbidden),forbidden);
 const u=new URL(url);assert.equal(u.origin,'https://github.com');assert.equal(u.pathname,'/Anuponk/lumen/issues/new');assert(url.length<=2000);assert(report.includes('#534'));
 assert.equal(buildIncidentInvestigation({timeline:[event('secret@example.invalid',1)]}).episodes.length,0);
});
test('detail alerts are grouped and do not create a competing cloud/outbox alarm',async()=>{
 const {buildIncidentInvestigation,incidentAlerts}=await load();
 const rows=[...scenario().slice(0,5),event('sync_write_failed',10)];
 for(let i=1;i<=4;i++)rows.push(event('runtime_exception',1,{session_id:`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`,stage:'runtime'}));
 const alerts=incidentAlerts(buildIncidentInvestigation({timeline:rows}));assert.equal(alerts.length,2);assert.equal(new Set(alerts.map(a=>a.key)).size,2);
 assert(alerts.every(a=>!a.key.includes('sync')&&!a.key.includes('outbox')));
 assert.equal(incidentAlerts(buildIncidentInvestigation({timeline:scenario()})).length,0);
});
test('signature counts remain available without exporting raw signature/context',async()=>{
 const {buildIncidentInvestigation}=await load();
 const row={code:'runtime_exception',stage:'runtime',app_version:'1.11.1+500',occurrences:9,sessions:3,signature:'SECRET',email:'secret@example.invalid'};
 const model=buildIncidentInvestigation({signatures:[row,{...row,code:'SECRET'}]});
 assert.equal(model.signatures.length,1);assert.equal(model.signatures[0].occurrences,9);
 assert(!JSON.stringify(model).includes('SECRET'));assert(!JSON.stringify(model).includes('secret@'));
});
test('cockpit refuses non-admin requests and ignores an in-flight result after account switch',async()=>{
 const source=readFileSync('src/ui/game-screen.js','utf8');let calls=0,release;
 const result=new Promise(resolve=>{release=resolve});
 const context=vm.createContext({lumenUser:{id:'synthetic-admin'},lumenSupabase:{rpc:()=>{calls++;return result}},hasInternalCapability:()=>false,
  document:{getElementById:()=>({textContent:'',value:'7'})}});
 vm.runInContext(functionSource(source,'loadAdminCockpit')+';globalThis.load=loadAdminCockpit',context);
 await context.load();assert.equal(calls,0);
 context.hasInternalCapability=()=>true;const pending=context.load();assert.equal(calls,6,'The quest metrics RPC shares the existing guarded cockpit load');
 context.lumenUser={id:'different-account'};context.document.getElementById=()=>{throw Error('stale result reached DOM')};
 release({data:{},error:null});await pending;
});
