import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
const load=()=>import('../src/persistence/diagnostic-reporter.js');
const user='00000000-0000-0000-0000-000000053401';
async function fixture(options={}){
 const {createDiagnosticReporter}=await load();const values=options.values||new Map(),sent=[],timers=new Map();
 let serial=0,tick=Date.now(),connected=true;
 const ctx={userId:user,client:{},enabled:true,version:'Version 1.11.1+501',platform:'desktop',browser:'chromium'};
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(options.denied)throw Error('full');values.set(k,v)},removeItem:k=>values.delete(k)};
 const reporter=createDiagnosticReporter({storage,context:()=>ctx,uuid:()=>`00000000-0000-0000-0000-${String(++serial).padStart(12,'0')}`,
  now:()=>tick,online:()=>connected,schedule:(fn,delay)=>{timers.set(++serial,{fn,delay});return serial},cancel:id=>timers.delete(id),
  send:options.send||(async(_context,payload)=>{sent.push(payload);return {accepted:payload.p_events.map(e=>e.id)}})});
 return {reporter,ctx,values,sent,timers,advance:ms=>{tick+=ms},offline:()=>{connected=false},online:()=>{connected=true}};
}
test('diagnostics are off without explicit consent and anonymous sessions never queue',async()=>{
 const f=await fixture();f.ctx.enabled=false;f.reporter.capture('runtime_exception');await f.reporter.flush();assert.equal(f.sent.length,0);
 f.ctx.enabled=true;f.ctx.userId=null;f.reporter.capture('runtime_exception');assert.equal(f.reporter.pending(),0);
});
test('capture is immediate, defers transport and accepts only fixed technical context',async()=>{
 const f=await fixture();
 assert.equal(f.reporter.capture('hydration_failed',{stage:'achievement_backup',kind:'quota',message:'secret@example.invalid',profile:{token:'Bearer secret'},url:'https://private/?token=x'}),undefined);
 assert.equal(f.sent.length,0);assert.equal(f.reporter.pending(),1);
 await f.reporter.flush();assert.equal(f.sent.length,1);assert.equal(f.sent[0].p_expected_user_id,user);
 const event=f.sent[0].p_events[0];assert.equal(event.stage,'achievement_backup');assert.equal(event.kind,'quota');
 assert.equal(event.version,'1.11.1+501');assert(!JSON.stringify(event).includes('secret'));assert(!JSON.stringify(event).includes('profile'));
 assert.equal(f.reporter.pending(),0);
});
test('queue survives offline reload and sends original identities on reconnect',async()=>{
 const f=await fixture();f.offline();f.reporter.capture('sync_write_failed');await f.reporter.flush();assert.equal(f.sent.length,0);
 const restarted=await fixture({values:f.values});restarted.reporter.refresh();await restarted.reporter.flush();
 assert.equal(restarted.sent.length,1);assert.equal(restarted.sent[0].p_events[0].code,'sync_write_failed');
});
test('full or corrupt local storage cannot suppress in-memory delivery',async()=>{
 const f=await fixture({denied:true});f.reporter.capture('runtime_exception');await f.reporter.flush();assert.equal(f.sent.length,1);
 const g=await fixture({values:new Map([['lumenDiagnosticQueueV1','corrupt']])});g.reporter.capture('runtime_exception');await g.reporter.flush();assert.equal(g.sent.length,1);
});
test('queue is bounded, batches at most ten and unknown codes are rejected',async()=>{
 const f=await fixture();f.offline();f.reporter.capture('forbidden@example.invalid');
 for(let i=0;i<80;i++)f.reporter.capture('guided_undo',{stage:'guided'});
 assert(f.reporter.pending()<=30);assert((f.values.get('lumenDiagnosticQueueV1')||'').length<=16384);
 f.online();await f.reporter.flush();assert(f.sent[0].p_events.length<=10);
});
test('repeated exceptions coalesce but repeated Undo remains visible for #533',async()=>{
 const f=await fixture();for(let i=0;i<20;i++)f.reporter.capture('runtime_exception');assert.equal(f.reporter.pending(),1);
 for(let i=0;i<3;i++)f.reporter.capture('guided_undo',{stage:'guided'});assert.equal(f.reporter.pending(),4);
});
test('lost response retains the same event identity and does not block a later retry',async()=>{
 const attempts=[];let fail=true;
 const f=await fixture({send:async(_ctx,payload)=>{attempts.push(payload);if(fail)throw Error('offline');return {accepted:payload.p_events.map(e=>e.id)}}});
 f.reporter.capture('sync_write_failed');await f.reporter.flush();assert.equal(f.reporter.pending(),1);
 fail=false;f.advance(61000);await f.reporter.flush();assert.equal(f.reporter.pending(),0);
 assert.equal(attempts[0].p_events[0].id,attempts[1].p_events[0].id);
});
test('account/client switch while a request is in flight cannot clear the new queue',async()=>{
 let release;const f=await fixture({send:()=>new Promise(resolve=>{release=resolve})});
 f.reporter.capture('sync_write_failed');const inFlight=f.reporter.flush();
 await Promise.resolve();
 f.ctx.userId='00000000-0000-0000-0000-000000053402';f.ctx.client={};f.reporter.capture('runtime_exception');
 release({accepted:[]});await inFlight;assert.equal(f.reporter.pending(),1);
});
test('TTL expires diagnostic records without touching business storage',async()=>{
 const f=await fixture();f.values.set('lumenProgressV1','keep-original');f.reporter.capture('sync_write_failed');f.advance(86400001);await f.reporter.flush();
 assert.equal(f.sent.length,0);assert.equal(f.reporter.pending(),0);assert.equal(f.values.get('lumenProgressV1'),'keep-original');
});
test('server disabled response drops optional details and withdrawal clears only its queue',async()=>{
 const f=await fixture({send:async()=>({disabled:true,accepted:[]})});f.reporter.capture('sync_write_failed');await f.reporter.flush();assert.equal(f.reporter.pending(),0);
 f.values.set('lumenProgressV1','keep-original');f.reporter.clear();assert.equal(f.values.get('lumenProgressV1'),'keep-original');
});
test('runtime/resource listeners ignore messages, stacks, URLs and rejection contents',async()=>{
 const {installDiagnosticListeners}=await load();const listeners={},seen=[];const target={addEventListener:(name,fn)=>{listeners[name]=fn},removeEventListener:()=>{}};
 installDiagnosticListeners(target,{capture:(...args)=>seen.push(args)});
 listeners.error({message:'secret@example.invalid',filename:'https://private',target});
 listeners.error({target:{tagName:'SCRIPT',src:'secret'}});listeners.unhandledrejection({reason:{token:'secret'}});
 assert.deepEqual(seen.map(x=>x[0]),['runtime_exception','resource_failed','unhandled_rejection']);assert(!JSON.stringify(seen).includes('secret'));
});
test('a busy flush never releases another request slot',async()=>{
 let release,calls=0;const f=await fixture({send:()=>{calls++;return new Promise(resolve=>{release=resolve})}});
 f.reporter.capture('sync_write_failed');const inFlight=f.reporter.flush();await Promise.resolve();
 await f.reporter.flush();await f.reporter.flush();assert.equal(calls,1);
 release({accepted:[]});await inFlight;
});
test('a rejected obsolete request cannot drop or age the new account queue',async()=>{
 let reject;const f=await fixture({send:()=>new Promise((_,fail)=>{reject=fail})});
 f.reporter.capture('sync_write_failed');const inFlight=f.reporter.flush();await Promise.resolve();
 f.ctx.userId='00000000-0000-0000-0000-000000053402';f.ctx.client={};f.reporter.capture('runtime_exception');
 reject(Error('expired'));await inFlight;assert.equal(f.reporter.pending(),1);
});
test('hung transport times out without blocking capture or clearing the record',async()=>{
 const f=await fixture({send:()=>new Promise(()=>{})});f.reporter.capture('sync_write_failed');const inFlight=f.reporter.flush();await Promise.resolve();
 const timeout=[...f.timers.values()].find(t=>t.delay===5000);assert(timeout);timeout.fn();await inFlight;assert.equal(f.reporter.pending(),1);
});
test('#533 actual Undo instrumentation preserves error, repeated blocks and release in one private trace',async()=>{
 const f=await fixture(),source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const handler=source.match(/document\.getElementById\("undo"\)\.onclick=(\(\)=>\{[^\n]+\});/)[1];let undoCalls=0;
 const ctx=vm.createContext({incidentReporter:f.reporter,crypto:{randomUUID:()=> '00000000-0000-0000-0000-000000000099'},guidedDiagnosticTrace:null,
  document:{getElementById:()=>({})},celebrated:false,scriptedLearningActive:()=>false,hist:[[[0]],[[0]],[[0]]],state:[[2]],
  guidedPending:{r:0,c:0},guidedDeferred:null,attemptEngine:{snapshot:()=>({})},clearGuidedConflict(){if(++undoCalls===3){ctx.guidedPending=null;ctx.guidedDeferred=null}},
  clearHintDisplay(){},hintStage:0,hintFocus:null,msg:{textContent:''},render(){},persistAttemptBoard(){}});
 vm.runInContext(functionSource(source,'recordGuidedDiagnostic'),ctx);
 vm.runInContext("recordGuidedDiagnostic('guided_error','ready','blocked')",ctx);
 for(let i=0;i<3;i++)vm.runInContext('('+handler+')()',ctx);
 await f.reporter.flush();const events=f.sent[0].p_events;
 assert.deepEqual(events.map(e=>e.code),['guided_error','guided_undo','guided_input_blocked','guided_undo','guided_input_blocked','guided_undo','guided_input_released']);
 assert.equal(new Set(events.map(e=>e.trace)).size,1);assert.equal(events.at(-1).after,'ready');
 assert(!JSON.stringify(events).includes('guidedPending'));assert(!JSON.stringify(events).includes('board'));
});
test('cloud/outbox mapping keeps retry and acknowledgement chronology without arbitrary details',async()=>{
 const {mapCloudDiagnostic}=await load(),f=await fixture();
 for(const event of ['flush_failed','flush_retry_online','canonical_outbox_retry_started','canonical_outbox_reconnect_replayed']){
  const mapped=mapCloudDiagnostic(event,{reason:'network',profile:'secret'});f.reporter.capture(mapped.code,mapped);
 }
 await f.reporter.flush();assert.deepEqual(f.sent[0].p_events.map(e=>e.code),['sync_write_failed','sync_retry','outbox_retried','outbox_acknowledged']);
 assert.equal(new Set(f.sent[0].p_events.map(e=>e.trace)).size,1);assert(!JSON.stringify(f.sent).includes('secret'));
});
