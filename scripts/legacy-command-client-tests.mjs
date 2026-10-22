import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyCommandsSupported,commitLegacyVictoryCommand,loadCommittedLegacyAttempt,replayLegacyVictoryOutbox} from '../src/persistence/legacy-command.js';
import {applyLegacyVictory,legacyVictoryRules} from '../src/campaign/legacy-victory.js';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {cloudSafelyCoversLocal,reconcileDominantLocalProfile,reconcileCompatibleCloudProfiles,restoreRicherCloudProfile,sameCloudProfile} from '../src/persistence/cloud-profile.js';
import {createCloudPersistence} from '../src/persistence/cloud.js';
const userId='00000000-0000-0000-0000-000000000001';
const facts={seconds:45,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-18',qualifiedAt:'2026-10-18T10:00:00.000Z'};
const base=()=>({solved:{},badges:{},stars:{},challenges:{},performances:{},noHint:{},xp:0,shards:3,skyHistoryVersion:4,skyScore:0});
async function isolatedLegacyFixture(){
 const {ctx,box,state}=uiFixture();
 const original=JSON.stringify(ctx.lumenProgress),raw=new Map([['lumenProgressV1',original]]);
 Object.assign(ctx,{cloudProfileReady:false,cloudProfileDirty:true,cloudProfileBusy:false,
  cloudProfileFailure:{reason:'partial_reconciliation'},canonicalRecoveryContext:{userId,client:ctx.lumenSupabase},
  canonicalActiveQuest:null,ATTEMPT_STATES:{RUNNING:'running',PAUSED:'paused'},
  attemptEngine:{snapshot:()=>({state:'ready'})},sessionStorage:{getItem:()=>null},
  document:{visibilityState:'visible'},navigator:{onLine:true},replayLegacyVictoryOutbox,
  localStorage:{getItem:k=>raw.get(k)??null},reloads:0,events:[],
  location:{reload:()=>ctx.reloads++},recordCloudDiagnostic:(event)=>ctx.events.push(event),
  createCloudRetryScheduler:options=>options,retryPendingCanonicalOutboxOnReconnect:async()=>{},
  refreshCanonicalOutboxNotice:async()=> (await box.pending(userId)).length});
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const name of ['canReplayCanonicalOutbox','canReplayLegacyOutbox','retryPendingLegacyOutboxOnReconnect']){
  if(source.includes('function '+name+'('))vm.runInContext(functionSource(source,name),ctx);
 }
 const start=source.indexOf('const canonicalRecovery=createCloudRetryScheduler('),end=source.indexOf('\nasync function retryAccountCloudSync',start);
 vm.runInContext(source.slice(start,end),ctx);
 await box.enqueue(userId,legacyVictoryRules()[0].questId,{facts},{operationId:'isolated-legacy-reset-0'});
 return {ctx,box,state,original,raw,run:()=>vm.runInContext('canonicalRecovery.run()',ctx)};
}

test('verified partial hydration recovers a queued historical command without replacing divergent local data',async()=>{
 const f=await isolatedLegacyFixture();
 await f.run();
 assert.equal(f.state.receipts.size,1,'A verified conflict must not prevent an independent command receipt');
 assert.equal((await f.box.pending(userId)).length,0);
 assert.equal(f.state.profile.xp,15);
 assert.equal(JSON.stringify(f.ctx.lumenProgress),f.original);
 assert.equal(f.raw.get('lumenProgressV1'),f.original);
 assert.equal(f.ctx.cloudProfileReady,false);assert.equal(f.ctx.reloads,0);
 assert.ok(f.ctx.events.includes('legacy_outbox_isolated_recovered'));
 assert.ok(f.state.calls.every(([name])=>!['lumen_cas_profile','lumen_backup_profile'].includes(name)));
});

test('historical isolated recovery retains account, client, active-attempt and readiness guards',async()=>{
 const changes={
  unverified:c=>c.canonicalRecoveryContext=null,
  otherOwner:c=>c.canonicalRecoveryContext.userId='other',
  otherClient:c=>c.canonicalRecoveryContext.client={},
  restoreError:c=>c.cloudProfileFailure={reason:'restore_failed'},
  running:c=>c.attemptEngine.snapshot=()=>({state:'running'}),
  paused:c=>c.attemptEngine.snapshot=()=>({state:'paused'}),
  activeCanonical:c=>c.canonicalActiveQuest={id:'active'},
  authPending:c=>c.authSessionPending=true,
  passwordRecovery:c=>c.sessionStorage.getItem=()=> '1',
  storageDenied:c=>c.sessionStorage.getItem=()=>{throw Error('denied')},
  profileBusy:c=>c.cloudProfileBusy=true,
  commandBusy:c=>c.legacyCommandInFlight=true,
  victoryBusy:c=>c.legacyVictoryBusy=true,
  currentWinRetry:c=>c.legacyVictoryRetry=async()=>{},
  hidden:c=>c.document.visibilityState='hidden',
  offline:c=>c.navigator.onLine=false,
  qa:c=>c.qaActive=true,
  dirtyReadyProfile:c=>c.cloudProfileReady=true,
  replayBusy:c=>c.canonicalOutboxRetryInFlight=true
 };
 for(const [name,change] of Object.entries(changes)){
  const f=await isolatedLegacyFixture();change(f.ctx);
  await vm.runInContext('retryPendingLegacyOutboxOnReconnect()',f.ctx);
  assert.equal(f.state.calls.length,0,name);
  assert.equal((await f.box.pending(userId)).length,1,name);
  assert.equal(JSON.stringify(f.ctx.lumenProgress),f.original,name);
 }
});

test('historical recovery verifies a lost response and reloads only a fully ready clean profile',async()=>{
 const f=await isolatedLegacyFixture();f.state.lost=true;
 await f.run();await f.run();
 assert.equal(f.state.receipts.size,1);assert.equal(f.state.profile.performances[0].attempts,1);
 assert.equal(f.ctx.reloads,0);assert.equal((await f.box.pending(userId)).length,0);
 const ready=await isolatedLegacyFixture();
 ready.ctx.cloudProfileReady=true;ready.ctx.cloudProfileDirty=false;ready.ctx.canonicalRecoveryContext=null;
 await ready.run();assert.equal(ready.ctx.reloads,1);
});

test('a session change during historical receipt verification preserves its intent',async()=>{
 for(const change of ['owner','client','attempt']){
  const f=await isolatedLegacyFixture(),rpc=f.ctx.lumenSupabase.rpc;
  f.ctx.lumenSupabase.rpc=async(name,args)=>{
   const response=await rpc(name,args);
   if(name==='lumen_commit_legacy_command'){
    if(change==='owner')f.ctx.lumenUser={id:'other'};
    if(change==='client')f.ctx.lumenSupabase={};
    if(change==='attempt')f.ctx.attemptEngine.snapshot=()=>({state:'running'});
   }
   return response;
  };
  await f.run();
  assert.equal((await f.box.pending(userId)).length,1,change);
  assert.equal(f.ctx.reloads,0,change);assert.equal(JSON.stringify(f.ctx.lumenProgress),f.original,change);
  assert.equal(f.ctx.canonicalOutboxRetryInFlight,false,change);
 }
});

test('historical and canonical recovery share a lock throughout asynchronous queue inspection',async()=>{
 const f=await isolatedLegacyFixture(),inspect=f.box.inspect;
 let release,reads=0;const wait=new Promise(resolve=>{release=resolve});
 f.box.inspect=async(...args)=>{reads++;await wait;return inspect(...args)};
 const first=vm.runInContext('retryPendingLegacyOutboxOnReconnect()',f.ctx);
 assert.equal(f.ctx.canonicalOutboxRetryInFlight,true);
 await vm.runInContext('retryPendingLegacyOutboxOnReconnect()',f.ctx);
 assert.equal(reads,1);release();await first;
 assert.equal(f.state.receipts.size,1);assert.equal(f.ctx.canonicalOutboxRetryInFlight,false);
});

test('an auth refusal holds the historical queue without stopping canonical scheduler work',async()=>{
 const f=await isolatedLegacyFixture(),rpc=f.ctx.lumenSupabase.rpc;let attempts=0,canonical=0;
 f.ctx.lumenSupabase.rpc=async(name,args)=>{
  if(name==='lumen_commit_legacy_command'){attempts++;return {error:{code:'PGRST301'},status:401}}
  return rpc(name,args);
 };
 f.ctx.retryPendingCanonicalOutboxOnReconnect=async()=>canonical++;
 await f.run();await f.run();
 assert.equal(attempts,1);assert.equal(canonical,2);
 assert.equal((await f.box.inspect(userId)).authRequired,true);
 assert.equal((await f.box.pending(userId)).length,1);assert.equal(f.ctx.reloads,0);
});
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
  canonicalOutboxRetryInFlight:false,lumenProgress:base(),legacyCommandsSupported,commitLegacyVictoryCommand,loadCommittedLegacyAttempt,structuredClone,
  flushCloudProfile:async()=>true,sameCloudProfile:(a,b)=>JSON.stringify(a)===JSON.stringify(b),saveLumenProgress:()=>{},recordCloudDiagnostic:()=>{},
  refreshCanonicalOutboxNotice:async()=>{},canonicalRecovery:{schedule:()=>{}},scheduleCloudProfile:()=>{},msg:{textContent:'',append:()=>{}},document:{createElement:()=>({})},
  pendingVictoryView:null,presented:[],presentPendingVictory:(...args)=>ctx.presented.push(args),syncPresentation:{failed(){},acknowledged(){},celebration(){}}};
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');vm.createContext(ctx);vm.runInContext(functionSource(source,'captureLegacyCommandVictory'),ctx);
 return {ctx,box,state,run:()=>vm.runInContext('captureLegacyCommandVictory()',ctx)};
}
test('real UI coordinator persists pending victory before readiness without optimistic rewards',async()=>{
 const {ctx,box,state,run}=uiFixture();ctx.cloudProfileReady=false;
 const before=JSON.stringify(ctx.lumenProgress),result=await run();
 assert.equal(result.handled,true);assert.equal(result.saved,undefined);assert.equal(JSON.stringify(ctx.lumenProgress),before);
 assert.equal((await box.pending(userId)).length,1);assert.equal(state.receipts.size,0);
 assert.equal(ctx.presented.length,1,'A durably captured win receives its pending celebration');
 assert.match(ctx.msg.textContent,/conservée sur cet appareil/);
});

test('a restored board reuses the acknowledged run receipt without recapturing later elapsed time',async()=>{
 const {ctx,box,state,run}=uiFixture();
 assert.equal((await run()).saved,true);
 assert.equal((await box.pending(userId)).length,0);
 ctx.activeGameSeconds=()=>99;
 const restored=await run();
 assert.equal(restored.saved,true);assert.equal(restored.facts.seconds,45);
 assert.equal(state.profile.performances[0].attempts,1);assert.equal(state.receipts.size,1);
 assert.equal(state.calls.filter(([name])=>name==='lumen_commit_legacy_command').length,1,'Restart recovery only reads the existing receipt and current profile');
 assert.equal((await box.pending(userId)).length,0,'No changed intention is created for an acknowledged operation');
});

test('offline receipt lookup still captures a durable new victory before holding',async()=>{
 const {ctx,box,state,run}=uiFixture();
 ctx.loadCommittedLegacyAttempt=async()=>{throw TypeError('Failed to fetch')};
 await run();
 assert.equal((await box.pending(userId)).length,1);
 assert.equal(state.receipts.size,0);assert.equal(ctx.lumenProgress.xp,0);
 assert.equal(ctx.presented.length,1);
});
test('real UI retry freezes time after lost receipt read and installs only verified current state',async()=>{
 const {ctx,box,state,run}=uiFixture();state.missingReceipt=true;
 await run();assert.equal(ctx.lumenProgress.xp,0);assert.equal(state.profile.xp,15);assert.equal((await box.pending(userId)).length,1);
 state.missingReceipt=false;ctx.activeGameSeconds=()=>90;
 const result=await run();assert.equal(result.saved,true);assert.equal(ctx.lumenProgress.xp,15);assert.equal(ctx.lumenProgress.performances[0].attempts,1);
 assert.equal(result.facts.seconds,45,'Success/share/analytics use original run time, excluding cloud latency');
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

const revisionBase=()=>({...base(),daily:{},historyBackup:{},canonicalQuestState:{}});
function revisionFixture(local,cloud,{race=false,readFailure=false}={}){
 const raw=JSON.stringify(local),data=new Map([['lumenProgressV1',raw]]),calls=[];
 let remote=structuredClone(cloud);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};
 const client={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='lumen_cas_profile'){
   assert.equal([...data.keys()].filter(k=>k.startsWith('lumenBeforeCloudReconcile')).length,2);
   assert.equal(args.p_payload.legacyVictoryRevision,cloud.legacyVictoryRevision);
   assert(sameCloudProfile(args.p_expected,cloud));
   if(race)return {data:false};
   remote=structuredClone(args.p_payload);return {data:true};
  }
  if(name==='lumen_restore_profile')return readFailure?{error:{message:'offline'}}:{data:structuredClone(remote)};
  throw Error('unexpected '+name);
 }};
 return {raw,data,storage,client,calls};
}
test('hydration reconciles older revisions and local tutorial flags without losing server rewards',async()=>{
 for(const revision of [undefined,0,1]){
  const cloud={...revisionBase(),legacyVictoryRevision:2};cloud.solved[0]=1;cloud.xp=15;
  cloud.performances[0]={version:3,badges:{speed:true},attempts:1};
  const local={...structuredClone(cloud),speedBadgeIntroSeen:1};
  if(revision===undefined)delete local.legacyVictoryRevision;else local.legacyVictoryRevision=revision;
  const f=revisionFixture(local,cloud);
  assert.equal((await reconcileDominantLocalProfile(f.client,f.storage,cloud)).reason,'missing_cloud_achievements');
  const result=await reconcileCompatibleCloudProfiles(f.client,f.storage,cloud);
  assert.equal(result.status,'reconciled');assert.deepEqual(result.profile,{...cloud,speedBadgeIntroSeen:1});
  assert.deepEqual(f.calls,['lumen_cas_profile','lumen_restore_profile']);assert.equal(f.storage.getItem('lumenProgressV1'),f.raw);
  const backups=[...f.data].filter(([k])=>k.startsWith('lumenBeforeCloudReconcile'));
  assert(backups.some(([,v])=>v===f.raw));assert(backups.some(([,v])=>sameCloudProfile(JSON.parse(v),cloud)));
  assert.equal(cloudSafelyCoversLocal(local,result.profile),true);
  restoreRicherCloudProfile(f.storage,result.profile);
  assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')),result.profile);
  assert.equal((await reconcileCompatibleCloudProfiles(f.client,f.storage,result.profile)).status,'cloud_dominant');
  assert.equal(f.calls.length,2,'No duplicate write or reward');
 }
});
test('server revision alone is retained without a write',async()=>{
 const cloud={...revisionBase(),legacyVictoryRevision:3},f=revisionFixture(revisionBase(),cloud);
 assert.equal((await reconcileCompatibleCloudProfiles(f.client,f.storage,cloud)).status,'cloud_dominant');assert.equal(f.calls.length,0);
});
test('newer local and malformed revisions block stale authority in both reconciliation paths',async()=>{
 for(const [left,right] of [[3,2],[1,undefined],[-1,1],[1,-1],[1.5,2],[1,1.5],['2',2],[1,'2'],[null,2],[1,null],[Number.MAX_SAFE_INTEGER+1,2],[1,Number.MAX_SAFE_INTEGER+1]]){
  const local={...revisionBase(),legacyVictoryRevision:left},cloud={...revisionBase()};if(right!==undefined)cloud.legacyVictoryRevision=right;
  assert.equal(cloudSafelyCoversLocal(local,cloud),false);
  for(const reconcile of [reconcileDominantLocalProfile,reconcileCompatibleCloudProfiles]){
   const f=revisionFixture(local,cloud),result=await reconcile(f.client,f.storage,cloud);
   assert.equal(result.status,'blocked');assert(['stale_legacy_revision','invalid_legacy_revision'].includes(result.reason),result.reason);
   assert.deepEqual(result.fields,['legacyVictoryRevision']);assert.equal(f.calls.length,0);assert.equal(f.data.size,1);
  }
 }
});
test('revision classification retains unknown-field refusal and unmigrated compatibility',async()=>{
 const cloud={...revisionBase(),legacyVictoryRevision:1},f=revisionFixture({...revisionBase(),unknownReceipt:'pending'},cloud);
 const result=await reconcileCompatibleCloudProfiles(f.client,f.storage,cloud);
 assert.equal(result.reason,'unclassified_field');assert.deepEqual(result.fields,['unknownReceipt']);assert.equal(f.calls.length,0);
 const old=revisionFixture({...revisionBase(),speedBadgeIntroSeen:1},revisionBase()),recovered=await reconcileCompatibleCloudProfiles(old.client,old.storage,revisionBase());
 assert.equal(recovered.status,'reconciled');assert(!Object.hasOwn(recovered.profile,'legacyVictoryRevision'));
});
test('revision handling preserves CAS refusal, independent read-back and both recovery snapshots',async()=>{
 for(const failure of [{race:true},{readFailure:true}]){
  const cloud={...revisionBase(),legacyVictoryRevision:1},f=revisionFixture({...revisionBase(),speedBadgeIntroSeen:1},cloud,failure);
  await assert.rejects(reconcileCompatibleCloudProfiles(f.client,f.storage,cloud));
  assert.equal(f.storage.getItem('lumenProgressV1'),f.raw);assert.equal([...f.data.keys()].filter(k=>k.startsWith('lumenBeforeCloudReconcile')).length,2);
 }
});

test('a protected historical projection refusal becomes recoverable partial hydration, without fallback or data loss',async()=>{
 for(const reconcile of [reconcileDominantLocalProfile,reconcileCompatibleCloudProfiles]){
  const cloud={...revisionBase(),legacyVictoryRevision:1};
  const local={...structuredClone(cloud),solved:{0:1}};
  const f=revisionFixture(local,cloud);let writes=0;
  f.client.rpc=async name=>{
   assert.equal(name,'lumen_cas_profile');writes++;
   return {error:{code:'22023',message:'legacy victory command required; preserve pending data and update client'}};
  };
  const result=await reconcile(f.client,f.storage,cloud);
  assert.equal(result.status,'blocked');assert.equal(result.reason,'legacy_command_required');
  assert.deepEqual(result.fields,['solved'],'Authority refusal identifies differing protected fields without payloads');
  assert.equal(writes,1);assert.equal(f.storage.getItem('lumenProgressV1'),f.raw);
  assert.equal([...f.data.keys()].filter(k=>k.startsWith('lumenBeforeCloudReconcile')).length,2);
 }
});


test('authority refusal reports bounded performance metadata without exposing values or arbitrary keys',async()=>{
 for(const reconcile of [reconcileDominantLocalProfile,reconcileCompatibleCloudProfiles]){
  const cloud={...revisionBase(),legacyVictoryRevision:7,performances:{0:{version:3,attempts:1,badges:{speed:true}}}};
  const local={...structuredClone(cloud),performances:{0:{version:3,attempts:2,badges:{speed:true},lastQualifiedAt:'2026-10-20T07:00:00Z',lastQualifiedDay:'2026-10-20',privateNote:'must-not-leak'}}};
  const f=revisionFixture(local,cloud);let writes=0;
  f.client.rpc=async name=>{assert.equal(name,'lumen_cas_profile');writes++;return {error:{code:'22023',message:'legacy victory command required; preserve pending data and update client'}}};
  const before=JSON.stringify({local,cloud});
  const result=await reconcile(f.client,f.storage,cloud);
  assert.deepEqual(result.fields,['performances']);assert.equal(result.conflictId,'0');
  assert.deepEqual(result.conflictKeys,['attempts','other']);
  assert(!JSON.stringify(result).includes('privateNote'));assert(!JSON.stringify(result).includes('must-not-leak'));
  assert(!JSON.stringify(result).includes('lastQualified'));assert(!JSON.stringify(result).includes('2026-10-20'));
  assert.equal(writes,1);assert.equal(f.storage.getItem('lumenProgressV1'),f.raw);
  assert.equal(JSON.stringify({local,cloud}),before);
 }
});


test('counter-only reconciliation preserves server rewards, receipts cursor and local recovery copies',async()=>{
 for(const reconcile of [reconcileDominantLocalProfile,reconcileCompatibleCloudProfiles]){
  const cloud={...revisionBase(),catalogueOrigin:2,legacyVictoryRevision:7,performances:{195:{version:3,attempts:1,badges:{speed:true}}}};
  const local=structuredClone(cloud);local.performances[195].attempts=4;
  const f=revisionFixture(local,cloud),result=await reconcile(f.client,f.storage,cloud);
  assert.equal(result.status,'reconciled');assert.equal(result.profile.performances[195].attempts,4);
  const withoutCount=structuredClone(result.profile);withoutCount.performances[195].attempts=1;
  assert.deepEqual(withoutCount,cloud,'No completion, badge, reward or server cursor is manufactured');
  assert.deepEqual(f.calls,['lumen_cas_profile','lumen_restore_profile']);
  assert.equal(f.storage.getItem('lumenProgressV1'),f.raw);
  assert.equal([...f.data.keys()].filter(k=>k.startsWith('lumenBeforeCloudReconcile')).length,2);
 }
});


test('durable victory retry rehydrates like the account menu instead of resending a stale baseline',async()=>{
 for(const failure of ['not-ready','stale-baseline']){
  const {ctx,box,state,run}=uiFixture();let button,flushes=0,resumes=0;
  ctx.msg.append=(_space,element)=>{button=element};
  ctx.document.createElement=()=>({remove(){}});
  ctx.cloudProfileReady=failure!=='not-ready';
  ctx.cloudProfileDirty=failure==='stale-baseline';
  ctx.flushCloudProfile=async()=>{flushes++;return false};
  ctx.celebrateSuccess=()=>run();
  ctx.location={reload:()=>ctx.reloads++};ctx.reloads=0;
  ctx.canonicalVictoryOutbox={resume:async()=>resumes++};
  ctx.canonicalRecovery.cancel=()=>{};ctx.updateAuthUI=()=>{};
  const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
  vm.runInContext(functionSource(source,'retryAccountCloudSync'),ctx);
  await run();assert(button,'A failed victory offers an explicit retry');
  const entry=JSON.stringify(await box.pending(userId)),attempt=JSON.stringify(ctx.attemptEngine.snapshot()),beforeFlushes=flushes;
  await button.onclick();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(ctx.reloads,1,'End-of-grid retry must request fresh verified hydration, just like the menu');
  assert.equal(resumes,1);assert.equal(flushes,beforeFlushes,'Never retry the same blocked baseline');
  assert.equal(JSON.stringify(await box.pending(userId)),entry,'Keep exact operation identity and facts until confirmation');
  assert.equal(JSON.stringify(ctx.attemptEngine.snapshot()),attempt);assert.equal(ctx.lumenProgress.xp,0);
  const confirmed=await replayLegacyVictoryOutbox(box,userId,(id,f,op,options)=>commitLegacyVictoryCommand(ctx.lumenSupabase,id,f,op,options));
  assert.equal(confirmed.length,1);assert.equal(state.receipts.size,1);assert.equal(state.profile.performances[0].attempts,1);
  assert.equal(state.profile.xp,15);assert.equal((await box.pending(userId)).length,0);
  assert.equal((await replayLegacyVictoryOutbox(box,userId,()=>{throw Error('No second grant')})).length,0);
 }
});

test('a victory retry cannot resume queues or reload after its account, client or attempt changes',async()=>{
 for(const change of ['owner','client','reset']){
  const {ctx,run}=uiFixture();let button,release,legacyResumes=0,reloads=0;
  ctx.cloudProfileReady=false;ctx.msg.append=(_space,element)=>{button=element};
  ctx.document.createElement=()=>({remove(){}});ctx.celebrateSuccess=()=>run();
  ctx.canonicalVictoryOutbox={resume:()=>new Promise(resolve=>{release=resolve})};
  ctx.legacyVictoryOutbox.resume=async()=>legacyResumes++;
  ctx.location={reload:()=>reloads++};ctx.canonicalRecovery.cancel=()=>{};
  const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
  vm.runInContext(functionSource(source,'retryAccountCloudSync'),ctx);
  await run();const retry=button.onclick();
  for(let i=0;i<20&&!release;i++)await Promise.resolve();
  assert(release,'Retry enters the shared recovery path');
  if(change==='owner')ctx.lumenUser={id:'different'};
  if(change==='client')ctx.lumenSupabase={};
  if(change==='reset')ctx.attemptEngine.snapshot().resetCount++;
  release();await retry;
  assert.equal(legacyResumes,0,change);assert.equal(reloads,0,change);
 }
});
