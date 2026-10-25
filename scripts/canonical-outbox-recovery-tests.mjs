import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanonicalVictoryOutbox,replayCanonicalVictoryOutbox} from '../src/persistence/canonical-outbox.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {classifyCanonicalRecoveryError} from '../src/persistence/canonical-recovery-errors.js';
import {functionSource} from './source-tools.mjs';

function prepareContext(ctx){
 ctx.cloudHydrationGeneration??=0;
 ctx.pendingVictoryView??=null;
 ctx.syncPresentation??={failed(){},acknowledged(){},celebration(){},snapshot:()=>({status:'confirmed',failures:0})};
 ctx.presentPendingVictory??=()=>{};
 ctx.questRewardDefinition??=()=>({stars:1,bonus:null});
 ctx.localCalendarDay??=()=> '2026-10-22';
 ctx.questFailed??=false;
 ctx.hintUsedInAttempt??=()=>!!ctx.usedHintThisGame||(ctx.attemptEngine?.snapshot()?.helpUses?.hint||0)>0;
 return vm.createContext(ctx);
}
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
 for(const change of ['account','client','quest','reset','generation']){
  let finish,persisting=false,uiUpdates=0;
  const attempt={attemptId:'persisted-attempt',resetCount:0};
  const context={canonicalActiveQuest:{id:'q',ordinal:10},canonicalVictoryInFlight:null,celebrated:false,activeGameSeconds:()=>10,
   attemptEngine:{snapshot:()=>({...attempt})},lumenUser:{id:'old'},lumenSupabase:{},
   performanceAttempt:()=>({autonomy:true,speed:true,noError:true,mastery:true}),usedHintThisGame:false,
   lumenProgress:{canonicalQuestState:{}},qaActive:false,canonicalOutboxNotice:null,
   canonicalVictoryOutbox:{pending:async()=>[],enqueue:async()=>{persisting=true;return new Promise(resolve=>{finish=resolve})}},
   updateAuthUI:()=>{uiUpdates++},console:{error:()=>{throw Error('Stale victory should return silently')}}};
  context.cloudProfileReady=false;context.classifyCanonicalRecoveryError=classifyCanonicalRecoveryError;prepareContext(context);vm.runInContext(functionSource(source,'celebrateCanonicalSuccess'),context);
  const running=vm.runInContext('celebrateCanonicalSuccess()',context);
  for(let i=0;i<10&&!persisting;i++)await Promise.resolve();
  assert.equal(persisting,true);
  if(change==='account')context.lumenUser={id:'new'};
  if(change==='client')context.lumenSupabase={};
  if(change==='generation')context.cloudHydrationGeneration++;
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
 prepareContext(context);vm.runInContext(functionSource(source,'retryPendingCanonicalOutboxOnReconnect'),context);
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
 context.inspectCommandOutboxes=async()=>({Canonical:await context.canonicalVictoryOutbox.inspect(),Legacy:await context.legacyVictoryOutbox.inspect(),Wallet:{pending:[],retryable:[],paused:[],issues:[],complete:true}});
 prepareContext(context);vm.runInContext(functionSource(source,'refreshCanonicalOutboxNotice'),context);
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
 prepareContext(context);
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
 let replay=0,retry=0,writes=0,acquisitions=0;
 const context={qaActive:false,lumenUser:{id:'a'},lumenSupabase:{},cloudProfileReady:false,
  retryPendingCanonicalOutboxOnReconnect:()=>{replay++},canonicalRecovery:{schedule:()=>{retry++}},
  acquisitionRecovery:{wake:()=>{acquisitions++}},
  scheduleCloudProfile:()=>{writes++}};
 prepareContext(context);vm.runInContext(functionSource(source,'retryPendingCloudWriteOnReconnect'),context);
 vm.runInContext('retryPendingCloudWriteOnReconnect()',context);
 assert.equal(replay,1);assert.equal(retry,1);assert.equal(acquisitions,1);assert.equal(writes,0);
});

test('replacing the cloud client invalidates the isolated permission and cancels its schedule',()=>{
 // Git checkouts may use CRLF on Windows; extraction must retain the same contract.
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
 const start=source.indexOf('const persistenceModel=')+'const persistenceModel='.length;
 const end=source.indexOf(';\nconst {loadLumenProfile',start);
 assert.ok(end>start);
 let cancelled=0;
 const context={cloudHydrationGeneration:0,lumenSupabase:{},canonicalRecoveryContext:{userId:'a'},canonicalRecovery:{cancel:()=>{cancelled++}}};
 prepareContext(context);const model=vm.runInContext('('+source.slice(start,end)+')',context);
 model.lumenSupabase={};assert.equal(context.canonicalRecoveryContext,null);assert.equal(cancelled,1);
 assert.equal(context.cloudHydrationGeneration,1,'Replacing a client invalidates pending hydration generations too');
});


test('two victory renders cannot capture different evidence for the same operation',async()=>{
 const source=readFileSync('src/ui/game-screen.js','utf8');let finish,enqueues=0,ready=false;
 const attempt={attemptId:'same-attempt',resetCount:0};
 const entry={operationId:'same-attempt-reset-0',questId:'q',reward};
 const ctx={canonicalActiveQuest:{id:'q',ordinal:241},canonicalVictoryInFlight:null,celebrated:false,
  activeGameSeconds:()=>10+enqueues,attemptEngine:{snapshot:()=>({...attempt})},lumenUser:{id:'a'},lumenSupabase:{},
  performanceAttempt:()=>({speed:true}),usedHintThisGame:false,lumenProgress:{canonicalQuestState:{}},qaActive:false,
  canonicalOutboxNotice:null,cloudProfileReady:false,canonicalRecovery:{schedule(){}},updateAuthUI(){},
  recordCloudDiagnostic(){},refreshCanonicalOutboxNotice:async()=>{},msg:{textContent:''},console:{error(){}},
  canonicalVictoryOutbox:{pending:async()=>ready?[entry]:[],enqueue:async()=>{
   enqueues++;if(enqueues>1)throw Error('Operation identity reused with different evidence');
   return new Promise(resolve=>{finish=()=>{ready=true;resolve(entry)}});
  }}};
 ctx.classifyCanonicalRecoveryError=classifyCanonicalRecoveryError;prepareContext(ctx);vm.runInContext(functionSource(source,'celebrateCanonicalSuccess'),ctx);
 const first=ctx.celebrateCanonicalSuccess();for(let i=0;i<10&&!finish;i++)await Promise.resolve();
 const second=ctx.celebrateCanonicalSuccess();for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(enqueues,1,'One immutable capture for one attempt/reset while persistence is pending');
 finish();await Promise.all([first,second]);
 assert(ctx.msg.textContent.includes('Victoire'));assert(!ctx.msg.textContent.includes('impossible'));
 assert.equal(ctx.canonicalVictoryInFlight,null,'Release the capture after failure so an explicit retry is possible');
});


test('a restored solved canonical board waits for startup Auth without claiming storage failure',async()=>{
 const source=readFileSync('src/ui/game-screen.js','utf8');const events=[];
 const ctx={canonicalActiveQuest:{id:'q',ordinal:241},canonicalVictoryInFlight:null,celebrated:false,
  activeGameSeconds:()=>10,attemptEngine:{snapshot:()=>({attemptId:'restored',resetCount:0})},
  lumenUser:null,lumenSupabase:{},authSessionPending:true,qaActive:false,
  performanceAttempt:()=>({}),usedHintThisGame:false,lumenProgress:{canonicalQuestState:{}},
  recordCloudDiagnostic:(...e)=>events.push(e),msg:{textContent:''},console:{error(){}},updateAuthUI(){}};
 ctx.classifyCanonicalRecoveryError=classifyCanonicalRecoveryError;prepareContext(ctx);vm.runInContext(functionSource(source,'celebrateCanonicalSuccess'),ctx);
 await ctx.celebrateCanonicalSuccess();
 assert.equal(events.some(e=>e[0]==='canonical_victory_failed'),false,'Pending Auth is not a failed durable capture');
 assert.equal(ctx.canonicalVictoryInFlight,null);
});

test('verified hydration rechecks the same restored board, never a switched account or run',()=>{
 const source=readFileSync('src/ui/game-screen.js','utf8');
 for(const change of ['none','account','client','quest','index','attempt','reset','owner','not-ready','pending','recovery','celebrated']){
  let scheduled,rendered=0;const attempt={attemptId:'restored',resetCount:0};
  const client={};const ctx={qaActive:false,lumenUser:{id:'a'},lumenSupabase:client,
   canonicalResumeOwner:'a',canonicalActiveQuest:{id:'q'},levelIndex:20,celebrated:false,cloudProfileReady:true,
   authSessionPending:false,sessionStorage:{getItem:()=>null},attemptEngine:{snapshot:()=>({...attempt})},
   setTimeout:fn=>{scheduled=fn},render:()=>{rendered++}};
  prepareContext(ctx);vm.runInContext(functionSource(source,'resumeCanonicalVictoryAfterHydration'),ctx);
  ctx.resumeCanonicalVictoryAfterHydration('a',client);assert.equal(typeof scheduled,'function');
  if(change==='account')ctx.lumenUser={id:'b'};
  if(change==='client')ctx.lumenSupabase={};
  if(change==='quest')ctx.canonicalActiveQuest={id:'other'};
  if(change==='index')ctx.levelIndex++;
  if(change==='attempt')attempt.attemptId='other';
  if(change==='reset')attempt.resetCount++;
  if(change==='owner')ctx.canonicalResumeOwner='b';
  if(change==='not-ready')ctx.cloudProfileReady=false;
  if(change==='pending')ctx.authSessionPending=true;
  if(change==='recovery')ctx.sessionStorage.getItem=()=> '1';
  if(change==='celebrated')ctx.celebrated=true;
  scheduled();assert.equal(rendered,change==='none'?1:0,change);
 }
 const hydration=source.slice(source.indexOf('afterAuthCloudSync:async()=>{'),source.indexOf('holdLegacyMergeForFullRestore'));
 assert(hydration.indexOf('resumeCanonicalVictoryAfterHydration(accountId,hydrationClient)')>hydration.indexOf('recordCloudDiagnostic("hydration_ready"'),'Resume follows verified hydration');
});


test('a paused earlier quest can recover its exact receipt after the active quest has advanced',async()=>{
 const entry={version:2,userId:'a',questId:'previous',operationId:'old-reset-0',reward,createdAt:'2026-10-20T15:00:00Z'};
 let recovered=0,writes=0,acks=0;
 const box={inspect:async()=>({pending:[entry],paused:[{questId:'previous',operationId:entry.operationId,kind:'review',code:'22023'}]}),acknowledge:async()=>{acks++}};
 const result=await replayCanonicalVictoryOutbox(box,'a',async()=>{writes++;throw Error('Must not submit changed evidence')},{recoverCommitted:async value=>{assert.equal(value,entry);recovered++;return saved('previous')}});
 assert.equal(recovered,1);assert.equal(result.length,1);assert.equal(writes,0);assert.equal(acks,0,'Recovery archives the entry; replay must not falsely acknowledge changed evidence');
});

test('receipt recovery cannot release unrelated review holds or auth holds',async()=>{
 for(const pause of [{kind:'review',code:'42501'},{kind:'review',code:'UNKNOWN'},{kind:'auth',code:'PGRST301'}]){
  let reads=0;const entry={questId:'q',operationId:'r',reward};
  const box={inspect:async()=>({pending:[entry],paused:[{questId:'q',operationId:'r',...pause}],authRequired:pause.kind==='auth'})};
  const result=await replayCanonicalVictoryOutbox(box,'a',async()=>{throw Error('paused')},{recoverCommitted:async()=>{reads++;return saved('q')}});
  assert.equal(reads,0);assert.equal(result.length,0);
 }
});


test('a review hold remains without a receipt and session changes cannot acknowledge recovery',async()=>{
 for(const change of ['missing','session']){
  let valid=true,writes=0,acks=0;
  const entry={userId:'a',questId:'q',operationId:'old-reset-0',reward};
  const box={inspect:async()=>({pending:[entry],paused:[{questId:'q',operationId:entry.operationId,kind:'review',code:'22023'}]}),acknowledge:async()=>{acks++}};
  const result=await replayCanonicalVictoryOutbox(box,'a',async()=>{writes++},{sessionValid:()=>valid,recoverCommitted:async()=>{if(change==='session'){valid=false;return saved('q')}return null}});
  assert.equal(result.length,0);assert.equal(writes,0);assert.equal(acks,0);
 }
});
