import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyCommandsSupported,commitLegacyVictoryCommand} from '../src/persistence/legacy-command.js';
import {applyLegacyVictory,legacyVictoryRules} from '../src/campaign/legacy-victory.js';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {cloudSafelyCoversLocal} from '../src/persistence/cloud-profile.js';
import {createCloudPersistence} from '../src/persistence/cloud.js';
const userId='00000000-0000-0000-0000-000000000001';
const facts={seconds:45,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-18',qualifiedAt:'2026-10-18T10:00:00.000Z'};
const base=()=>({solved:{},badges:{},stars:{},challenges:{},performances:{},noHint:{},xp:0,shards:3,skyHistoryVersion:4,skyScore:0});
function fixture(){
 const state={profile:base(),calls:[],receipts:new Map(),lost:false,missingReceipt:false,owner:userId};
 const client={rpc:async(name,args)=>{
  state.calls.push([name,args]);
  if(name==='lumen_legacy_command_version')return {data:1};
  if(name==='lumen_restore_profile')return {data:structuredClone(state.profile)};
  if(args.p_expected_user_id!==state.owner)return {error:{code:'42501'}};
  if(name==='lumen_get_legacy_command')return {data:state.missingReceipt?null:state.receipts.get(args.p_operation_id)??null};
  if(name!=='lumen_commit_legacy_command')throw Error('unexpected '+name);
  const request={version:1,operationId:args.p_operation_id,questId:args.p_quest_id,facts:args.p_facts};
  let receipt=state.receipts.get(args.p_operation_id);
  if(receipt&&JSON.stringify(receipt.request)!==JSON.stringify(request))return {error:{code:'22023'}};
  if(!receipt){
   const outcome=applyLegacyVictory(state.profile,0,args.p_facts);
   receipt={request,outcome,recordedAt:'2026-10-18T10:01:00Z'};state.receipts.set(args.p_operation_id,receipt);
  }
  if(state.lost)throw Error('lost after commit');
  return {data:receipt};
 }};
 return {state,client};
}
test('legacy victory sends immutable facts and verifies independent receipt and current projection',async()=>{
 const {state,client}=fixture();const q=legacyVictoryRules()[0];
 const result=await commitLegacyVictoryCommand(client,q.questId,facts,'run-reset-0',{userId});
 assert.equal(result.receipt.outcome.firstCompletion,true);assert.equal(result.profile.xp,15);
 assert.deepEqual(state.calls.map(c=>c[0]),['lumen_commit_legacy_command','lumen_get_legacy_command','lumen_restore_profile']);
});
test('lost response retries the same operation without a second reward or attempt',async()=>{
 const {state,client}=fixture();const q=legacyVictoryRules()[0];state.lost=true;
 await commitLegacyVictoryCommand(client,q.questId,facts,'run-reset-0',{userId});
 const again=await commitLegacyVictoryCommand(client,q.questId,facts,'run-reset-0',{userId});
 assert.equal(again.profile.xp,15);assert.equal(again.profile.performances[0].attempts,1);
 assert.equal(again.receipt.outcome.firstCompletion,true);
});
test('solved alone cannot acknowledge an operation and changed evidence is refused',async()=>{
 const {state,client}=fixture();const q=legacyVictoryRules()[0];state.missingReceipt=true;
 await assert.rejects(commitLegacyVictoryCommand(client,q.questId,facts,'run-reset-0',{userId}));
 state.missingReceipt=false;
 await assert.rejects(commitLegacyVictoryCommand(client,q.questId,{...facts,seconds:44},'run-reset-0',{userId}),e=>e.code==='22023');
 assert.equal(state.profile.performances[0].attempts,1);
});
test('wrong account and changes during receipt/profile reads cannot confirm a victory',async()=>{
 const {state,client}=fixture();state.owner='other';
 await assert.rejects(commitLegacyVictoryCommand(client,legacyVictoryRules()[0].questId,facts,'run',{userId}));
 assert.equal(state.profile.xp,0);
 let checks=0;
 await assert.rejects(commitLegacyVictoryCommand(fixture().client,legacyVictoryRules()[0].questId,facts,'run',{userId,sessionValid:()=>++checks<3}));
});
test('only explicit absent capability allows old-server compatibility',async()=>{
 assert.equal(await legacyCommandsSupported({rpc:async()=>({error:{code:'PGRST202'},status:404})}),false);
 for(const response of [{error:{code:'PGRST202'},status:503},{error:{code:'42501'},status:403},{data:2}])await assert.rejects(legacyCommandsSupported({rpc:async()=>response}));
});
test('historical rules preserve hint XP, same-run mastery, cooldown and one-time challenges',()=>{
 const p=base();Object.assign(p.solved,Object.fromEntries(Array.from({length:6},(_,i)=>[i,1])));
 p.performances[5]={version:2,badges:{mastery:true},bestTime:18,attempts:4};
 const r=applyLegacyVictory(p,5,{...facts,seconds:55,assistanceUsed:true});
 assert.equal(r.firstCompletion,false);assert.equal(r.questPassed,true);assert.equal(p.xp,25);assert.equal(p.shards,4);
 assert.equal(p.performances[5].badges.mastery,true);assert.equal(p.performances[5].badges.speed,true);
 assert.equal(p.performances[5].bestTime,18);assert.equal(p.performances[5].attempts,5);
 applyLegacyVictory(p,5,{...facts,qualifying:false});assert.equal(p.xp,25);assert.equal(p.shards,4);
 const other=base();const assisted=applyLegacyVictory(other,5,{...facts,assistanceUsed:true,challengeFailed:true});
 assert.equal(other.xp,15,'historical no-hint XP is distinct from effective assistance');assert.equal(assisted.savedPerformance.run.mastery,false);
});
test('legacy durable namespace cannot be replayed or acknowledged by a canonical client',async()=>{
 const records=new Map(),storage={get length(){return records.size},key:i=>[...records.keys()][i],getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
 const fallback={entries:async()=>[],put:async()=>{throw Error('denied')},get:async()=>null,remove:async()=>{}};
 const legacy=createDurableCanonicalVictoryOutbox(storage,{fallback,namespace:'Legacy'}),canonical=createDurableCanonicalVictoryOutbox(storage,{fallback});
 await legacy.enqueue(userId,'base-q001',{facts},{operationId:'run-reset-0'});
 assert.equal((await canonical.pending(userId)).length,0);assert.equal((await legacy.pending(userId)).length,1);
 await canonical.acknowledge(userId,'base-q001',undefined,'run-reset-0');assert.equal(records.size,1);
});
function uiFixture(){
 const {state,client}=fixture(),data=new Map(),store={get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const fallback={entries:async()=>[],put:async()=>{throw Error('denied')},get:async()=>null,remove:async()=>{}};
 const box=createDurableCanonicalVictoryOutbox(store,{fallback,namespace:'Legacy'});
 const attempt={attemptId:'ui-attempt',resetCount:0,startedAt:Date.parse(facts.qualifiedAt),qualifying:true};
 const ctx={lumenUser:{id:userId},lumenSupabase:client,levelIndex:0,attemptEngine:{snapshot:()=>attempt},canonicalQuestForLegacy:()=>({id:legacyVictoryRules()[0].questId}),
  authSessionPending:false,qaActive:false,legacyVictoryBusy:false,legacyCommandInFlight:false,legacyVictoryRetry:null,legacyVictoryOutbox:box,
  activeGameSeconds:()=>45,localCalendarDay:()=>facts.qualifiedDay,usedHintThisGame:false,questFailed:false,cloudProfileReady:true,cloudProfileDirty:false,cloudProfileTimer:null,
  canonicalOutboxRetryInFlight:false,lumenProgress:base(),legacyCommandsSupported,commitLegacyVictoryCommand,structuredClone,
  flushCloudProfile:async()=>true,sameCloudProfile:(a,b)=>JSON.stringify(a)===JSON.stringify(b),saveLumenProgress:()=>{},recordCloudDiagnostic:()=>{},
  refreshCanonicalOutboxNotice:async()=>{},canonicalRecovery:{schedule:()=>{}},scheduleCloudProfile:()=>{},msg:{textContent:'',append:()=>{}},document:{createElement:()=>({})}};
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');vm.createContext(ctx);vm.runInContext(functionSource(source,'captureLegacyCommandVictory'),ctx);
 return {ctx,box,state,run:()=>vm.runInContext('captureLegacyCommandVictory()',ctx)};
}
test('real UI coordinator persists pending victory before readiness without optimistic rewards',async()=>{
 const {ctx,box,state,run}=uiFixture();ctx.cloudProfileReady=false;
 const before=JSON.stringify(ctx.lumenProgress),result=await run();
 assert.equal(result.handled,true);assert.equal(result.saved,undefined);assert.equal(JSON.stringify(ctx.lumenProgress),before);
 assert.equal((await box.pending(userId)).length,1);assert.equal(state.receipts.size,0);
 assert.match(ctx.msg.textContent,/conservée sur cet appareil/);
});
test('real UI retry freezes time after lost receipt read and installs only verified current state',async()=>{
 const {ctx,box,state,run}=uiFixture();state.missingReceipt=true;
 await run();assert.equal(ctx.lumenProgress.xp,0);assert.equal(state.profile.xp,15);assert.equal((await box.pending(userId)).length,1);
 state.missingReceipt=false;ctx.activeGameSeconds=()=>90;
 const result=await run();assert.equal(result.saved,true);assert.equal(ctx.lumenProgress.xp,15);assert.equal(ctx.lumenProgress.performances[0].attempts,1);
 assert.equal((await box.pending(userId)).length,0);assert.equal([...state.receipts.values()][0].request.facts.seconds,45);
});
test('concurrent local spend during command I/O cannot be overwritten or acknowledged',async()=>{
 const {ctx,box,state,run}=uiFixture();const original=ctx.commitLegacyVictoryCommand;
 ctx.commitLegacyVictoryCommand=async(...args)=>{const r=await original(...args);ctx.lumenProgress.shards=2;return r};
 const result=await run();assert.equal(result.saved,undefined);assert.equal(ctx.lumenProgress.shards,2);assert.equal(ctx.lumenProgress.xp,0);
 assert.equal(state.profile.xp,15);assert.equal((await box.pending(userId)).length,1);
});
test('verified command profile covers earlier daily/challenge receipts but never conflicting amounts or a newer local revision',()=>{
 const p=base();p.daily={dates:{'2026-10-17':1},rewards:{'streak:2026-10-17':1}};p.challenges={'sky2-1':1};
 const cloud=structuredClone(p);cloud.legacyVictoryRevision=1;cloud.daily.dates['2026-10-18']=1;cloud.challenges['sky2-2']=1;
 assert.equal(cloudSafelyCoversLocal(p,cloud),true);
 cloud.daily.rewards['streak:2026-10-17']=2;assert.equal(cloudSafelyCoversLocal(p,cloud),false);
 cloud.daily.rewards['streak:2026-10-17']=1;p.legacyVictoryRevision=2;assert.equal(cloudSafelyCoversLocal(p,cloud),false);
});
test('legacy auth pause resumes only after verified same-account profile read',async()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const mode of ['valid','read-fails','account-switch']){
  let resumed=0,scheduled=0;
  const ctx={lumenUser:{id:userId},lumenSupabase:{},qaActive:false,authSessionPending:false,sessionStorage:{getItem:()=>null},
   legacyVictoryOutbox:{inspect:async()=>({authRequired:true}),resume:async(uid,opts)=>{assert.equal(uid,userId);assert.equal(opts.kind,'auth');resumed++}},
   loadVerifiedProfile:async()=>{if(mode==='read-fails')throw Error('offline');if(mode==='account-switch')ctx.lumenUser={id:'other'};return base()},
   refreshCanonicalOutboxNotice:async()=>{},canonicalRecovery:{schedule:()=>{scheduled++}},recordCloudDiagnostic:()=>{}};
  vm.createContext(ctx);vm.runInContext(functionSource(source,'resumeLegacyAfterAuthRefresh'),ctx);
  await vm.runInContext(`resumeLegacyAfterAuthRefresh('${userId}',lumenSupabase)`,ctx);
  assert.equal(resumed,mode==='valid'?1:0);assert.equal(scheduled,resumed);
 }
});
test('historical discovery cannot mutate command-owned rewards, including activation/account changes during its read',async()=>{
 for(const mode of ['legacy','activated','activation-during-read','account-switch']){
  const progress=base(),model={lumenUser:{id:userId},lumenProgress:progress};let reads=0,saves=0;
  if(mode==='activated')progress.legacyVictoryRevision=1;
  model.lumenSupabase={rpc:async()=>{reads++;if(mode==='activation-during-read')progress.legacyVictoryRevision=1;if(mode==='account-switch')model.lumenUser={id:'other'};return {data:[{puzzle_id:1,autonomy:true,speed:true,no_error:true,mastery:true}]}}};
  const cloud=createCloudPersistence(model,{saveLumenProgress:()=>{saves++},refreshJourney:()=>{}},{console,setTimeout});
  await cloud.cloudMergeHistoricalPerformance('isolated-anonymous-fixture');
  assert.equal(reads,mode==='activated'?0:1);assert.equal(saves,mode==='legacy'?1:0);
  assert.equal(!!progress.performances[0],mode==='legacy');
 }
});
