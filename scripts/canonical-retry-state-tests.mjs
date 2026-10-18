import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {functionSource} from './source-tools.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {commitCanonicalVictoryViaLedger} from '../src/persistence/canonical-progress.js';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
import {replayCanonicalVictoryOutbox} from '../src/persistence/canonical-outbox.js';

function local(){const data=new Map();return {data,get length(){return data.size},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function indexed(){const data=new Map();return {data,entries:async p=>[...data].filter(([k])=>k.startsWith(p)),get:async k=>data.get(k)??null,put:async(k,v)=>{if(data.has(k)&&data.get(k)!==v){const e=Error('immutable');e.code='OUTBOX_CONFLICT';throw e}data.set(k,v)},remove:async(k,v)=>{if(data.has(k)&&data.get(k)!==v)throw Error('changed');data.delete(k)}};}
const reward={badges:{autonomy:true},stars:1};
const saved=id=>({profile:{canonicalQuestState:{[id]:{solved:true,badges:{autonomy:true}}}}});
const base={solved:{},badges:{},canonicalQuestState:{}};
const quest=canonicalQuestList().find(q=>q.legacyIndex===null);
const refusal=(code,status)=>Object.assign(Error('provider message must not be stored'),{code,status});

test('ledger errors retain only safe classification after unsuccessful read-back',async()=>{
 for(const [code,status,kind] of [['PGRST301',401,'auth'],['PGRST303',401,'auth'],['42501',403,'review'],['P0001',400,'review'],['22023',400,'review'],['PGRST003',504,'retry'],['40001',500,'retry'],['',429,'retry'],['',503,'retry'],['',0,'retry']]){
  const api={rpc:async name=>name==='lumen_restore_profile'?{data:base,error:null}:{data:null,error:{code,message:'private@example.test',details:'private payload'},status}};
  await assert.rejects(commitCanonicalVictoryViaLedger(api,quest.id,reward),error=>{
   assert.equal(error.recoveryKind,kind,code||String(status));
   assert.equal(error.message.includes('private'),false);return true;
  });
 }
});

test('a thrown lost response is still acknowledged by verified read-back',async()=>{
 let writes=0;
 const api={rpc:async name=>{if(name==='lumen_restore_profile')return {data:{...base,...saved(quest.id).profile},error:null};writes++;throw Error('response lost')}};
 const result=await commitCanonicalVictoryViaLedger(api,quest.id,reward);
 assert.equal(result.alreadySaved,true);assert.equal(writes,1);
});

test('verified server evidence overrides an auth refusal without pausing or duplicating the reward',async()=>{
 const box=createDurableCanonicalVictoryOutbox(local(),{fallback:indexed()});
 await box.enqueue('a',quest.id,reward);let writes=0;
 const api={rpc:async name=>name==='lumen_restore_profile'?{data:{...base,...saved(quest.id).profile},error:null}:(writes++,{data:null,error:{code:'PGRST301'},status:401})};
 await replayCanonicalVictoryOutbox(box,'a',(id,evidence)=>commitCanonicalVictoryViaLedger(api,id,evidence));
 assert.equal(writes,1);assert.equal((await box.inspect('a')).pending.length,0);assert.equal((await box.inspect('a')).paused.length,0);
});

test('review pause survives restart, preserves exact intent, and permits independent work',async()=>{
 const storage=local(),fallback=indexed(),box=createDurableCanonicalVictoryOutbox(storage,{fallback});
 await box.enqueue('a','q',reward,{operationId:'first'});await box.enqueue('a','q',reward,{operationId:'later'});await box.enqueue('a','other',reward,{operationId:'other'});
 const raw=fallback.data.get('lumenCanonicalVictoryOutboxV2:a:first'),calls=[];
 const commit=async id=>{calls.push(id);if(id==='q')throw refusal('P0001',400);return saved(id)};
 await replayCanonicalVictoryOutbox(box,'a',commit);
 const restarted=createDurableCanonicalVictoryOutbox(storage,{fallback});
 await replayCanonicalVictoryOutbox(restarted,'a',commit);
 assert.deepEqual(calls,['q','other']);
 assert.equal((await restarted.pending('a')).length,2);
 assert.equal((await restarted.inspect('a')).retryable.length,0);
 assert.equal(fallback.data.get('lumenCanonicalVictoryOutboxV2:a:first'),raw);
 assert.equal([...fallback.data.values()].some(v=>v.includes('provider message')),false);
 await restarted.resume('b',{kind:'all'});assert.equal((await restarted.inspect('a')).paused.length,1);
 await restarted.resume('a',{kind:'all'});
 await replayCanonicalVictoryOutbox(restarted,'a',async id=>saved(id));
 assert.equal((await restarted.pending('a')).length,0);
});

test('auth pause holds the account across restart until a verified-session resume',async()=>{
 const storage=local(),fallback=indexed(),box=createDurableCanonicalVictoryOutbox(storage,{fallback});
 await box.enqueue('a','q',reward);await box.enqueue('a','other',reward);let calls=0;
 await replayCanonicalVictoryOutbox(box,'a',async()=>{calls++;throw refusal('PGRST301',401)});
 const restarted=createDurableCanonicalVictoryOutbox(storage,{fallback});
 await replayCanonicalVictoryOutbox(restarted,'a',async id=>{calls++;return saved(id)});
 assert.equal(calls,1);assert.equal((await restarted.inspect('a')).authRequired,true);
 await restarted.resume('a',{kind:'auth'});
 await replayCanonicalVictoryOutbox(restarted,'a',async id=>saved(id));
 assert.equal((await restarted.pending('a')).length,0);
});

test('transient failures are not paused and can recover normally',async()=>{
 const box=createDurableCanonicalVictoryOutbox(local(),{fallback:indexed()});await box.enqueue('a','q',reward);
 await replayCanonicalVictoryOutbox(box,'a',async()=>{throw refusal('PGRST003',504)});
 assert.equal((await box.inspect('a')).paused.length,0);
 assert.equal((await box.inspect('a')).retryable.length,1);
 await replayCanonicalVictoryOutbox(box,'a',async id=>saved(id));assert.equal((await box.pending('a')).length,0);
});

test('a paused queue remains visible but does not request another automatic retry',async()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const context={lumenUser:{id:'a'},canonicalOutboxNotice:null,updateAuthUI:()=>{},legacyVictoryOutbox:{inspect:async()=>({pending:[],retryable:[],paused:[],issues:[],complete:true})},canonicalVictoryOutbox:{inspect:async()=>({pending:[{questId:'q'}],retryable:[],paused:[{kind:'review'}],issues:[],complete:true,authRequired:false})}};
 vm.createContext(context);vm.runInContext(functionSource(source,'refreshCanonicalOutboxNotice'),context);
 assert.equal(await vm.runInContext("refreshCanonicalOutboxNotice('a')",context),0);assert.equal(context.canonicalOutboxNotice,'attention');
});

test('a failed pause checkpoint holds only this session and never changes the durable victory',async()=>{
 const storage=local(),fallback=indexed(),box=createDurableCanonicalVictoryOutbox(storage,{fallback});
 await box.enqueue('a','q',reward,{operationId:'run'});
 const raw=fallback.data.get('lumenCanonicalVictoryOutboxV2:a:run');
 fallback.put=async()=>{throw Error('quota')};storage.setItem=()=>{throw Error('quota')};let calls=0;
 const commit=async()=>{calls++;throw refusal('P0001',400)};
 await replayCanonicalVictoryOutbox(box,'a',commit);await replayCanonicalVictoryOutbox(box,'a',commit);
 assert.equal(calls,1);assert.ok((await box.inspect('a')).issues.includes('retry_state_unpersisted'));
 assert.equal(fallback.data.get('lumenCanonicalVictoryOutboxV2:a:run'),raw);
 assert.equal((await createDurableCanonicalVictoryOutbox(storage,{fallback}).pending('a')).length,1);
});

test('corrupt retry metadata pauses only its quest; explicit retry resets metadata without erasing intent',async()=>{
 const storage=local(),fallback=indexed(),box=createDurableCanonicalVictoryOutbox(storage,{fallback});
 await box.enqueue('a','q',reward,{operationId:'run'});
 const raw=fallback.data.get('lumenCanonicalVictoryOutboxV2:a:run');
 fallback.data.set('lumenCanonicalVictoryRetryV1:a:v2-run','{broken');
 assert.equal((await box.inspect('a')).retryable.length,0);
 await box.resume('a',{kind:'auth'});assert.equal((await box.inspect('a')).paused.length,1);
 await box.resume('a',{kind:'all'});
 assert.equal((await box.inspect('a')).paused.length,0);
 assert.equal(fallback.data.get('lumenCanonicalVictoryOutboxV2:a:run'),raw);
});

test('manual retry cannot reload a different account after its async metadata reset',async()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');let resumed=0,reloaded=0;
 const context={lumenUser:{id:'a'},lumenSupabase:{},canonicalRecovery:{cancel:()=>{}},location:{reload:()=>{reloaded++}},
  canonicalVictoryOutbox:{resume:async uid=>{assert.equal(uid,'a');resumed++;context.lumenUser={id:'b'}}}};
 vm.createContext(context);vm.runInContext(functionSource(source,'retryAccountCloudSync'),context);
 await vm.runInContext('retryAccountCloudSync()',context);assert.equal(resumed,1);assert.equal(reloaded,0);
});

test('legacy V1 pause survives restart and explicit retry retains its original evidence',async()=>{
 const storage=local(),fallback=indexed();
 const key='lumenCanonicalVictoryOutboxV1:a:q',raw=JSON.stringify({userId:'a',questId:'q',reward,createdAt:'2026-10-18T00:00:00Z'});
 storage.setItem(key,raw);
 let box=createDurableCanonicalVictoryOutbox(storage,{fallback}),calls=0;
 await replayCanonicalVictoryOutbox(box,'a',async()=>{calls++;throw refusal('42501',403)});
 box=createDurableCanonicalVictoryOutbox(storage,{fallback});
 await replayCanonicalVictoryOutbox(box,'a',async()=>{calls++;return saved('q')});
 assert.equal(calls,1);assert.equal(storage.getItem(key),raw);
 await box.resume('a',{kind:'all'});assert.equal(storage.getItem(key),raw);
 await replayCanonicalVictoryOutbox(box,'a',async()=>saved('q'));
 assert.equal(storage.getItem(key),null);assert.equal(fallback.data.size,0);
});

test('auth events release only auth pauses after a successful read for the same session',async()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const mode of ['verified','failed-read','account-changed','client-changed','password-recovery','auth-pending','no-auth-pause']){
  let reads=0,resumes=0,scheduled=0;
  const context={qaActive:false,lumenUser:{id:'a'},lumenSupabase:{},authSessionPending:false,
   sessionStorage:{getItem:()=>mode==='password-recovery'?'1':null},recordCloudDiagnostic:()=>{},refreshCanonicalOutboxNotice:async()=>{},
   canonicalRecovery:{schedule:()=>{scheduled++}},canonicalVictoryOutbox:{inspect:async()=>({authRequired:mode!=='no-auth-pause'}),resume:async(uid,opts)=>{assert.equal(uid,'a');assert.equal(opts.kind,'auth');resumes++}},
   loadVerifiedProfile:async()=>{reads++;if(mode==='failed-read')throw Error('offline');if(mode==='account-changed')context.lumenUser={id:'b'};if(mode==='client-changed')context.lumenSupabase={};if(mode==='auth-pending')context.authSessionPending=true;return base}};
  vm.createContext(context);vm.runInContext(functionSource(source,'resumeCanonicalAfterAuthRefresh'),context);
  await vm.runInContext("resumeCanonicalAfterAuthRefresh('a',lumenSupabase)",context);
  assert.equal(resumes,mode==='verified'?1:0,mode);assert.equal(scheduled,mode==='verified'?1:0,mode);
  assert.equal(reads,['password-recovery','no-auth-pause'].includes(mode)?0:1,mode);
 }
});
