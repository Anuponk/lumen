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
  canonicalVictoryOutbox:{pending:async()=>{reads++;return pending}},recordCloudDiagnostic:()=>{}};
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
  canonicalVictoryOutbox:{inspect:async()=>({pending:[],issues:complete?[]:['indexed_unavailable'],complete})}};
 vm.createContext(context);vm.runInContext(functionSource(source,'refreshCanonicalOutboxNotice'),context);
 assert.equal(await vm.runInContext("refreshCanonicalOutboxNotice('a')",context),1);
 assert.equal(context.canonicalOutboxNotice,'checking');
 complete=true;
 assert.equal(await vm.runInContext("refreshCanonicalOutboxNotice('a')",context),0);
 assert.equal(context.canonicalOutboxNotice,null);
});
