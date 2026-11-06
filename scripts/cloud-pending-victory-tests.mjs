import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {functionSource} from './source-tools.mjs';
import {createCloudRetryScheduler} from '../src/persistence/cloud-retry-scheduler.js';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
import {mapCloudDiagnostic} from '../src/persistence/diagnostic-reporter.js';

const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
function memory(){const rows=new Map();return {get length(){return rows.size},key:i=>[...rows.keys()][i],getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,String(v)),removeItem:k=>rows.delete(k)}}
async function fixture(domain='Canonical'){
 const storage=memory(),box=createDurableCanonicalVictoryOutbox(storage,{namespace:domain});
 const entry=await box.enqueue('owner','quest',{facts:{seconds:18}},{operationId:'attempt-reset-0'});
 const client={},pending={userId:'owner',client,questId:'quest',operationId:entry.operationId,attemptId:'attempt',resetCount:0};
 let retry,timerId=0;const timers=new Map(),calls=[];
 const c=vm.createContext({console,structuredClone,lumenUser:{id:'owner'},lumenSupabase:client,qaActive:false,
  authSessionPending:false,cloudProfileReady:true,cloudProfileBusy:false,cloudProfileDirty:false,
  canonicalActiveQuest:domain==='Canonical'?{id:'quest'}:null,legacyVictoryBusy:false,legacyCommandInFlight:false,
  canonicalVictoryInFlight:null,canonicalOutboxRetryInFlight:false,pendingVictoryRetryInFlight:false,
  pendingVictoryView:pending,celebrated:false,attemptEngine:{snapshot:()=>({attemptId:'attempt',resetCount:0})},
  sessionStorage:{getItem:()=>null},document:{visibilityState:'visible'},navigator:{onLine:true},
  canonicalVictoryOutbox:domain==='Canonical'?box:null,legacyVictoryOutbox:domain==='Legacy'?box:null,
  legacyVictoryRetry:domain==='Legacy'?async()=>c.celebrateSuccess():null,
  recordCloudDiagnostic:()=>{},refreshCanonicalOutboxNotice:async()=> (await box.pending('owner')).length,
  retryPendingLegacyOutboxOnReconnect:async()=>false,retryPendingCanonicalOutboxOnReconnect:async()=>{},
  createCloudRetryScheduler:opts=>{
   // acquisition recovery is irrelevant to a fully verified ready profile.
   if(retry)return {};
   retry=createCloudRetryScheduler({...opts,random:()=>1,setTimer:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId},clearTimer:id=>timers.delete(id)});
   return retry;
  },
  celebrateSuccess:async()=>{
   if(c.celebrated||c.pendingVictoryView)return;
   calls.push(entry.operationId);
   if(c.failCommit){c.pendingVictoryView=pending;return}
   // This stands in for the existing verified receipt + read-back path.
   await box.acknowledge('owner','quest',entry.reward,entry.operationId);c.celebrated=true;
  }
 });
 for(const name of ['canReplayCanonicalOutbox','canRetryPresentedVictory','retryPresentedVictory']){
  if(source.includes('function '+name+'('))vm.runInContext(functionSource(source,name),c);
 }
 const start=source.indexOf('const canonicalRecovery=createCloudRetryScheduler('),end=source.indexOf('\n// Reuse the existing bounded-backoff scheduler',start);
 vm.runInContext(source.slice(start,end),c);
 return {c,box,entry,retry,calls,timers};
}
for(const domain of ['Canonical','Legacy'])test(`${domain}: a ready pending victory recovers automatically with its frozen operation while the result stays open`,async()=>{
 const f=await fixture(domain);await f.retry.wake();
 assert.deepEqual(f.calls,['attempt-reset-0']);assert.equal((await f.box.pending('owner')).length,0);
 assert.equal(f.c.celebrated,true);assert.equal(f.timers.size,0);
});

test('repeated transient failures retain the exact intent and bounded retry, then acknowledge once',async()=>{
 const f=await fixture();f.c.failCommit=true;await f.retry.wake();
 assert.equal(f.calls.length,1);assert.equal((await f.box.pending('owner'))[0].operationId,f.entry.operationId);
 assert.equal([...f.timers.values()][0]?.ms,2000);
 f.c.failCommit=false;await f.retry.wake();
 assert.equal(f.calls.length,2);assert.equal((await f.box.pending('owner')).length,0);assert.equal(f.timers.size,0);
});

for(const kind of ['auth','review'])test(`${kind} holds do not get bypassed by automatic foreground retry`,async()=>{
 const f=await fixture();await f.box.pause('owner',f.entry,{code:kind==='auth'?'PGRST301':'22023'});
 await f.retry.wake();assert.equal(f.calls.length,0);assert.equal((await f.box.pending('owner')).length,1);assert.equal(f.timers.size,0);
});

test('unsafe session, local edits, active writes, hidden/offline state and reset do not retry',async()=>{
 const changes=[c=>c.lumenUser={id:'other'},c=>c.lumenSupabase={},c=>c.authSessionPending=true,
  c=>c.cloudProfileReady=false,c=>c.cloudProfileDirty=true,c=>c.cloudProfileBusy=true,
  c=>c.canonicalOutboxRetryInFlight=true,c=>c.legacyVictoryBusy=true,c=>c.canonicalVictoryInFlight={},
  c=>c.navigator.onLine=false,c=>c.document.visibilityState='hidden',c=>c.qaActive=true,
  c=>c.sessionStorage.getItem=()=> '1',c=>c.attemptEngine.snapshot=()=>({attemptId:'attempt',resetCount:1})];
 for(const change of changes){const f=await fixture();change(f.c);await f.retry.wake();assert.equal(f.calls.length,0);assert.equal((await f.box.pending('owner')).length,1)}
});

test('a session change during durable inspection retains the victory without a command',async()=>{
 const f=await fixture(),inspect=f.box.inspect;
 f.box.inspect=async uid=>{const state=await inspect(uid);f.c.lumenUser={id:'different'};return state};
 await f.retry.wake();assert.equal(f.calls.length,0);assert.equal((await f.box.pending('owner')).length,1);
});

test('simultaneous online and timer wakeups cannot send the same foreground operation concurrently',async()=>{
 const f=await fixture(),inspect=f.box.inspect;let release;
 f.box.inspect=async uid=>{await new Promise(resolve=>{release=resolve});return inspect(uid)};
 const timer=f.retry.wake();for(let i=0;i<20&&!release;i++)await Promise.resolve();
 const online=vm.runInContext('retryPresentedVictory({automatic:true})',f.c);
 release();await Promise.all([timer,online]);assert.equal(f.calls.length,1);assert.equal((await f.box.pending('owner')).length,0);
});

test('victory failures enter the existing privacy-safe shared incident stream',()=>{
 for(const event of ['canonical_victory_failed','legacy_victory_pending']){
  assert.deepEqual(mapCloudDiagnostic(event,{stage:'command',durable:true,errorCode:'42501',reason:'intent_recorded',message:'private',profile:{secret:true}}),
   {code:'outbox_retry_failed',stage:'outbox_retry',kind:'conflict'});
  assert.equal(mapCloudDiagnostic(event,{errorCode:'PGRST301',durable:true}).kind,'auth');
 }
});
