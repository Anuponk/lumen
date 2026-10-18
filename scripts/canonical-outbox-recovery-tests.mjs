import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalVictoryOutbox,replayCanonicalVictoryOutbox} from '../src/persistence/canonical-outbox.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';

const storage=()=>{const values=new Map();return {get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
const reward={badges:{autonomy:true},stars:1};
const saved=id=>({profile:{canonicalQuestState:{[id]:{solved:true,badges:{autonomy:true}}}}});

test('one refused quest does not stop another independent durable victory',async()=>{
 const box=createCanonicalVictoryOutbox(storage());
 box.enqueue('player','blocked',reward);box.enqueue('player','independent',reward);
 const calls=[];
 const confirmed=await replayCanonicalVictoryOutbox(box,'player',async id=>{
  calls.push(id);if(id==='blocked')throw Error('quest unavailable');return saved(id);
 });
 assert.deepEqual(calls,['blocked','independent']);
 assert.equal(confirmed.length,1);
 assert.deepEqual(box.pending('player').map(e=>e.questId),['blocked']);
});

test('a solved-only stale reply cannot discard pending earned badges',async()=>{
 const box=createCanonicalVictoryOutbox(storage());box.enqueue('player','replay',reward);
 const confirmed=await replayCanonicalVictoryOutbox(box,'player',async()=>({profile:{canonicalQuestState:{replay:{solved:true,badges:{}}}}}));
 assert.equal(confirmed.length,0);
 assert.equal(box.pending('player').length,1);
});

test('a session switch during commit keeps the old account intent',async()=>{
 const box=createCanonicalVictoryOutbox(storage());box.enqueue('old','quest',reward);
 let current=true;
 await replayCanonicalVictoryOutbox(box,'old',async id=>{current=false;return saved(id);},{sessionValid:()=>current});
 assert.equal(box.pending('old').length,1);assert.equal(box.pending('new').length,0);
});

test('asynchronous durable adapters are awaited before removing a victory',async()=>{
 let removed=false;
 const box={pending:async()=>[{userId:'player',questId:'quest',reward}],acknowledge:async()=>{await Promise.resolve();removed=true;}};
 const confirmed=await replayCanonicalVictoryOutbox(box,'player',async id=>saved(id));
 assert.equal(removed,true);assert.equal(confirmed.length,1);
});

test('an old victory cannot update the UI after account, quest or attempt-reset changes during persistence',async()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const change of ['account','quest','reset']){
  let finish,persisting=false,uiUpdates=0;
  const attempt={attemptId:'persisted-attempt',resetCount:0};
  const context={canonicalActiveQuest:{id:'q',ordinal:10},celebrated:false,activeGameSeconds:()=>10,
   attemptEngine:{snapshot:()=>({...attempt})},lumenUser:{id:'old'},lumenSupabase:{},
   performanceAttempt:()=>({autonomy:true,speed:true,noError:true,mastery:true}),usedHintThisGame:false,
   lumenProgress:{canonicalQuestState:{}},qaActive:false,canonicalOutboxNotice:null,
   canonicalVictoryOutbox:{pending:async()=>[],enqueue:async()=>{persisting=true;return new Promise(resolve=>{finish=resolve})}},
   updateAuthUI:()=>{uiUpdates++},console:{error:()=>{throw Error('Stale victory should return silently')}}};
  vm.createContext(context);vm.runInContext(functionSource(source,'celebrateCanonicalSuccess'),context);
  const running=vm.runInContext('celebrateCanonicalSuccess()',context);
  for(let i=0;i<10&&!persisting;i++)await Promise.resolve();
  assert.equal(persisting,true);
  if(change==='account')context.lumenUser={id:'new'};
  if(change==='quest')context.canonicalActiveQuest={id:'other',ordinal:11};
  if(change==='reset')attempt.resetCount++;
  finish({operationId:'persisted-attempt-reset-0',reward});await running;
  assert.equal(uiUpdates,0,change);assert.equal(context.celebrated,false,change);
  assert.equal(context.canonicalOutboxNotice,null,change);
 }
});

test('online and scheduled recovery cannot both start while the durable queue is being read',async()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 let finish,reads=0;const pending=new Promise(resolve=>{finish=resolve});
 const context={canonicalOutboxRetryInFlight:false,qaActive:false,lumenUser:{id:'a'},lumenSupabase:{},
  cloudProfileReady:true,cloudProfileBusy:false,cloudProfileDirty:false,canonicalActiveQuest:null,
  canonicalVictoryOutbox:{pending:async()=>{reads++;return pending}},recordCloudDiagnostic:()=>{},canReplayCanonicalOutbox:()=>true};
 vm.createContext(context);vm.runInContext(functionSource(source,'retryPendingCanonicalOutboxOnReconnect'),context);
 const a=vm.runInContext('retryPendingCanonicalOutboxOnReconnect()',context);
 const b=vm.runInContext('retryPendingCanonicalOutboxOnReconnect()',context);
 finish([]);await Promise.all([a,b]);
 assert.equal(reads,1);assert.equal(context.canonicalOutboxRetryInFlight,false);
 context.canonicalVictoryOutbox.pending=async()=>{throw Error('read failed')};
 await vm.runInContext('retryPendingCanonicalOutboxOnReconnect()',context);
 assert.equal(context.canonicalOutboxRetryInFlight,false,'A read failure must release the guard');
});

test('a temporarily unreadable queue keeps a visible pending check and retry demand',async()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 let complete=false;
 const context={lumenUser:{id:'a'},canonicalOutboxNotice:null,updateAuthUI:()=>{},
  legacyVictoryOutbox:{inspect:async()=>({pending:[],retryable:[],paused:[],issues:[],complete:true})},
  canonicalVictoryOutbox:{inspect:async()=>({pending:[],retryable:[],paused:[],issues:complete?[]:['indexed_unavailable'],complete})}};
 vm.createContext(context);vm.runInContext(functionSource(source,'refreshCanonicalOutboxNotice'),context);
 assert.equal(await vm.runInContext("refreshCanonicalOutboxNotice('a')",context),1);
 assert.equal(context.canonicalOutboxNotice,'checking');
 complete=true;
 assert.equal(await vm.runInContext("refreshCanonicalOutboxNotice('a')",context),0);
 assert.equal(context.canonicalOutboxNotice,null);
});

function isolatedContext(){
 const client={},user={id:'a'},values=new Map([['lumenProgressV1','{"shards":9,"performances":{"fixture":{"receipt":"local-only"}}}']]);
 const progress={shards:9,performances:{fixture:{receipt:'local-only'}}};
 let commits=0,acks=0,reloads=0;
 const context={canonicalOutboxRetryInFlight:false,legacyVictoryBusy:false,qaActive:false,lumenUser:user,lumenSupabase:client,
  authSessionPending:false,cloudProfileReady:false,cloudProfileBusy:false,cloudProfileDirty:true,
  cloudProfileFailure:{reason:'partial_reconciliation'},canonicalRecoveryContext:{userId:'a',client},canonicalActiveQuest:null,
  document:{visibilityState:'visible'},navigator:{onLine:true},sessionStorage:{getItem:()=>null},
  localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},lumenProgress:progress,
  canonicalVictoryOutbox:{pending:async()=>[{questId:'q',reward}],acknowledge:async()=>{acks++}},
  commitCanonicalVictory:async()=>{commits++;return saved('q')},replayCanonicalVictoryOutbox,
  recordCloudDiagnostic:()=>{},location:{reload:()=>{reloads++}}};
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 vm.createContext(context);
 vm.runInContext(functionSource(source,'canReplayCanonicalOutbox'),context);
 vm.runInContext(functionSource(source,'retryPendingCanonicalOutboxOnReconnect'),context);
 return {context,progress,values,get commits(){return commits},get acks(){return acks},get reloads(){return reloads}};
}

test('a verified legacy conflict does not block a queued server-ledger victory or replace local progress',async()=>{
 const f=isolatedContext(),raw=f.values.get('lumenProgressV1'),before=structuredClone(f.progress);
 await vm.runInContext('retryPendingCanonicalOutboxOnReconnect()',f.context);
 assert.equal(f.commits,1);assert.equal(f.acks,1);
 assert.equal(f.values.get('lumenProgressV1'),raw);assert.deepEqual(f.context.lumenProgress,before);
 assert.equal(f.context.lumenProgress,f.progress);assert.equal(f.context.cloudProfileReady,false);
 assert.equal(f.reloads,0,'Do not loop through full hydration or install the remote snapshot');
});

test('isolated recovery still holds unverified accounts, different clients, active play and unsafe session states',async()=>{
 for(const change of [
  c=>c.canonicalRecoveryContext=null,
  c=>c.canonicalRecoveryContext.userId='other',
  c=>c.canonicalRecoveryContext.client={},
  c=>c.cloudProfileFailure={reason:'restore_failed'},
  c=>c.canonicalActiveQuest={id:'active'},
  c=>c.authSessionPending=true,
  c=>c.cloudProfileBusy=true,
  c=>c.document.visibilityState='hidden',
  c=>c.navigator.onLine=false,
  c=>c.qaActive=true,
  c=>c.lumenUser=null,
  c=>c.lumenSupabase=null,
  c=>c.sessionStorage.getItem=()=> '1',
  c=>c.sessionStorage.getItem=()=>{throw Error('storage denied')},
  c=>c.cloudProfileReady=true
 ]){
  const f=isolatedContext();change(f.context);
  await vm.runInContext('retryPendingCanonicalOutboxOnReconnect()',f.context);
  assert.equal(f.commits,0);assert.equal(f.acks,0);
 }
});

test('normal fully hydrated recovery remains available without an isolated permission',async()=>{
 const f=isolatedContext();
 f.context.cloudProfileReady=true;f.context.cloudProfileDirty=false;f.context.canonicalRecoveryContext=null;
 await vm.runInContext('retryPendingCanonicalOutboxOnReconnect()',f.context);
 assert.equal(f.commits,1);assert.equal(f.acks,1);assert.equal(f.reloads,1);
});

test('account switch during isolated commit keeps the old account intent and local state untouched',async()=>{
 const f=isolatedContext();let attempted=false;
 f.context.commitCanonicalVictory=async()=>{attempted=true;f.context.lumenUser={id:'other'};return saved('q')};
 const raw=f.values.get('lumenProgressV1');
 await vm.runInContext('retryPendingCanonicalOutboxOnReconnect()',f.context);
 assert.equal(attempted,true);assert.equal(f.acks,0);assert.equal(f.reloads,0);assert.equal(f.values.get('lumenProgressV1'),raw);
});

test('isolated network failure preserves the unacknowledged intent and local divergence',async()=>{
 const f=isolatedContext();let attempted=false;
 f.context.commitCanonicalVictory=async()=>{attempted=true;throw Error('offline')};
 const raw=f.values.get('lumenProgressV1');
 await vm.runInContext('retryPendingCanonicalOutboxOnReconnect()',f.context);
 assert.equal(attempted,true);assert.equal(f.acks,0);assert.equal(f.values.get('lumenProgressV1'),raw);
});

test('online wakes isolated recovery without starting legacy full-profile writes',()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 let replay=0,retry=0,writes=0;
 const context={qaActive:false,lumenUser:{id:'a'},lumenSupabase:{},cloudProfileReady:false,
  retryPendingCanonicalOutboxOnReconnect:()=>{replay++},canonicalRecovery:{schedule:()=>{retry++}},
  scheduleCloudProfile:()=>{writes++}};
 vm.createContext(context);vm.runInContext(functionSource(source,'retryPendingCloudWriteOnReconnect'),context);
 vm.runInContext('retryPendingCloudWriteOnReconnect()',context);
 assert.equal(replay,1);assert.equal(retry,1);assert.equal(writes,0);
});

test('replacing the cloud client invalidates the isolated permission and cancels its schedule',()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const start=source.indexOf('const persistenceModel=')+'const persistenceModel='.length;
 const end=source.indexOf(';\nconst {loadLumenProfile',start);
 assert.ok(end>start);
 let cancelled=0;
 const context={lumenSupabase:{},canonicalRecoveryContext:{userId:'a'},canonicalRecovery:{cancel:()=>{cancelled++}}};
 vm.createContext(context);const model=vm.runInContext('('+source.slice(start,end)+')',context);
 model.lumenSupabase={};assert.equal(context.canonicalRecoveryContext,null);assert.equal(cancelled,1);
});
