import assert from 'node:assert/strict';
import test from 'node:test';
import * as profiles from '../src/persistence/cloud-profile.js';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {createCloudPersistence} from '../src/persistence/cloud.js';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
import {replayCanonicalVictoryOutbox} from '../src/persistence/canonical-outbox.js';
import {reconcileDailyIntoCloudProfile} from '../src/persistence/daily-hydration.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
import {walletCommandsSupported} from '../src/persistence/wallet-command.js';
import {createCloudRetryScheduler} from '../src/persistence/cloud-retry-scheduler.js';
const {cloudSafelyCoversLocal,reconcileCloudAchievements,installCloudProfileLocally,achievementRecoveryDiagnostic}=profiles;

const profile=()=>({solved:{},historyBackup:{},badges:{},stars:{},performances:{},canonicalQuestState:{
 'fixture-quest':{solved:true,stars:1,performance:{seconds:45},badges:{autonomy:true,speed:false,noError:false,mastery:false}}
},daily:{},challenges:{},walletRevision:1,shards:9,xp:15,skyScore:0});
const storeFor=local=>{const data=new Map([['lumenProgressV1',JSON.stringify(local)]]);return {data,
 getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i]??null,get length(){return data.size}};};

test('server badge replay covers a stale canonical cache without replaying its rewards',()=>{
 const local=profile(),cloud=structuredClone(local);
 cloud.canonicalQuestState['fixture-quest'].badges.speed=true;
 assert.equal(cloudSafelyCoversLocal(local,cloud),true,'Verified additional badge is not a conflicting immutable reward');
 const storage=storeFor(local),remoteBefore=JSON.stringify(cloud);
 const result=reconcileCloudAchievements(storage,cloud);
 assert.equal(result.changed,true);
 const recovered=JSON.parse(storage.getItem('lumenProgressV1'));
 assert.deepEqual(recovered,cloud);assert.equal(JSON.stringify(cloud),remoteBefore);
 assert.equal(reconcileCloudAchievements(storage,cloud).changed,false);
 assert.equal(cloudSafelyCoversLocal(cloud,local),false,'A stale device cannot remove the new badge');
});

test('partial badge recovery keeps unconfirmed wallet state and requires a later verified cursor',()=>{
 const local=profile(),cloud=structuredClone(local);
 cloud.canonicalQuestState['fixture-quest'].badges.speed=true;cloud.shards=3;
 const storage=storeFor(local);
 assert.equal(cloudSafelyCoversLocal(local,cloud),false);
 const partial=reconcileCloudAchievements(storage,cloud);
 assert.equal(partial.changed,true);
 const recovered=JSON.parse(storage.getItem('lumenProgressV1'));
 assert.equal(recovered.shards,9);assert.equal(recovered.walletRevision,1);assert.equal(recovered.xp,15);
 assert.equal(recovered.canonicalQuestState['fixture-quest'].badges.speed,true);
 assert.equal(cloudSafelyCoversLocal(recovered,cloud),false,'A badge does not acknowledge a debit');
 assert.throws(()=>installCloudProfileLocally(storage,cloud),/divergent/);
 assert.equal(reconcileCloudAchievements(storage,cloud).changed,false,'Restart/retry does not grant a second reward');
 cloud.walletRevision=2;
 assert.equal(cloudSafelyCoversLocal(recovered,cloud),true);
 installCloudProfileLocally(storage,cloud);
 assert.deepEqual(JSON.parse(storage.getItem('lumenProgressV1')),cloud);
 assert([...storage.data.keys()].some(k=>k.startsWith('lumenBeforeCloudReconcile_')));
});

test('coverage accepts exactly the server supersets across all recognized badge combinations',()=>{
 const keys=['autonomy','speed','noError','mastery'];
 for(let left=0;left<16;left++)for(let right=0;right<16;right++){
  const local=profile(),cloud=profile();
  for(let bit=0;bit<keys.length;bit++){
   local.canonicalQuestState['fixture-quest'].badges[keys[bit]]=Boolean(left&(1<<bit));
   cloud.canonicalQuestState['fixture-quest'].badges[keys[bit]]=Boolean(right&(1<<bit));
  }
  assert.equal(cloudSafelyCoversLocal(local,cloud),(left&right)===left,`badge masks ${left}/${right}`);
 }
});

test('contradictory canonical rewards preserve the exact local bytes',()=>{
 for(const change of ['stars','performance','badgeLoss','unknownBadge','invalidBadge','unknownField']){
  const local=profile(),cloud=structuredClone(local),entry=cloud.canonicalQuestState['fixture-quest'];
  if(change==='stars')entry.stars=999;
  if(change==='performance')entry.performance.seconds=12;
  if(change==='badgeLoss')entry.badges.autonomy=false;
  if(change==='invalidBadge')entry.badges.speed='true';
  if(change==='unknownField')entry.unclassifiedReward=1;
  if(change==='unknownBadge'){
   local.canonicalQuestState['fixture-quest'].badges.privateExtra='private-fixture';
   entry.badges.privateExtra='different-private-fixture';
  }
  const storage=storeFor(local),before=storage.getItem('lumenProgressV1');
  assert.equal(cloudSafelyCoversLocal(local,cloud),false,change);
  assert.throws(()=>reconcileCloudAchievements(storage,cloud),/Conflit de récompense/,change);
  assert.equal(storage.getItem('lumenProgressV1'),before,change);
 }
});

test('achievement failure diagnostics distinguish storage and reward conflicts without private values',()=>{
 for(const [error,reason] of [
  [{name:'QuotaExceededError'},'storage_quota'],[{code:22},'storage_quota'],
  [{name:'SecurityError'},'storage_unavailable'],
  [{code:'ACHIEVEMENT_BACKUP_UNVERIFIED'},'backup_unverified'],
  [{code:'ACHIEVEMENT_INSTALL_UNVERIFIED'},'local_install_unverified'],
  [{code:'ACHIEVEMENT_LOCAL_INVALID'},'invalid_local_profile'],
  [{code:'provider-private-fixture',message:'private-fixture'},'achievement_recovery_failed']
 ])assert.deepEqual(achievementRecoveryDiagnostic(error),{reason});
 const local=profile(),cloud=structuredClone(local);cloud.canonicalQuestState['fixture-quest'].performance.seconds=12;
 try{reconcileCloudAchievements(storeFor(local),cloud);assert.fail('Expected conflict')}
 catch(error){
  const diagnostic=achievementRecoveryDiagnostic(error);
  assert.deepEqual(diagnostic,{reason:'canonical_reward_conflict',fields:['canonicalQuestState'],conflictKeys:['performance']});
  assert(!JSON.stringify(diagnostic).includes('fixture-quest'));
  assert(!error.message.includes('fixture-quest'),'Private source keys are not part of exception text');
 }
 assert.deepEqual(achievementRecoveryDiagnostic({code:'CANONICAL_REWARD_CONFLICT',conflictKeys:['private-fixture','badges']}),{
  reason:'canonical_reward_conflict',fields:['canonicalQuestState'],conflictKeys:['unknown_field','badges']
 });
});

test('quota and unverified backup block partial installation without acknowledging the remote rewards',()=>{
 for(const mode of ['quota','silent-backup']){
  const local=profile(),cloud=structuredClone(local),storage=storeFor(local),before=storage.getItem('lumenProgressV1');
  cloud.canonicalQuestState['fixture-quest'].badges.speed=true;
  const write=storage.setItem;
  storage.setItem=(key,value)=>{
   if(key.startsWith('lumenBeforeCloudReconcile_')){
    if(mode==='quota')throw Object.assign(Error('private-fixture'),{name:'QuotaExceededError'});
    return;
   }
   write(key,value);
  };
  assert.throws(()=>reconcileCloudAchievements(storage,cloud),error=>{
   assert.equal(achievementRecoveryDiagnostic(error).reason,mode==='quota'?'storage_quota':'backup_unverified');return true;
  });
  assert.equal(storage.getItem('lumenProgressV1'),before);
 }
});

test('account status explains a held reconciliation while preserving a generic retry for other failures',()=>{
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8'),ctx=vm.createContext({cloudHydrationGeneration:0,});
 vm.runInContext(functionSource(source,'cloudReconciliationMessage'),ctx);
 for(const detail of ['storage_quota','canonical_reward_conflict','backup_unverified']){
  const message=ctx.cloudReconciliationMessage({reason:'partial_reconciliation',detail});
  assert.match(message,/conservées/);assert.doesNotMatch(message,/synchronisée/);
 }
 assert.match(ctx.cloudReconciliationMessage({reason:'network'}),/resynchroniser/);
});

async function sessionFixture({conflict=false,quota=false,deferWallet=false}={}){
 const local=profile(),storage=storeFor(local),indexed=new Map(),events=[],calls=[],timers=[];
 storage.setItem('lumenCloudOwnerId','a');
 const fallback={
  entries:async prefix=>[...indexed].filter(([key])=>key.startsWith(prefix)),
  get:async key=>indexed.get(key)??null,
  put:async(key,value)=>{if(indexed.has(key)&&indexed.get(key)!==value)throw Error('changed');indexed.set(key,value)},
  remove:async(key,value)=>{if(indexed.has(key)&&indexed.get(key)!==value)throw Error('changed');indexed.delete(key)}
 };
 const canonical=createDurableCanonicalVictoryOutbox(storage,{fallback});
 const first={badges:local.canonicalQuestState['fixture-quest'].badges,performance:{seconds:45,bestTime:45,assisted:false},stars:1};
 const later=structuredClone(first);later.performance.seconds=later.performance.bestTime=100;
 const entry=await canonical.enqueue('a','fixture-quest',later,{operationId:'archived-reset-0'});
 await canonical.archiveRecreatedCapture('a',entry,{userId:'a',profile:local,receipt:{version:1,
  operationId:entry.operationId,questId:entry.questId,badges:first.badges,performance:first.performance,
  newlyCompleted:true,recordedAt:'2026-10-22T18:53:12Z'}});
 const archived=[...indexed].filter(([key])=>key.startsWith('lumenCanonicalRecreatedCaptureArchiveV1:'));
 assert.equal(archived.length,1);
 events.push({event:'canonical_attempt_receipt_recovered',archivedCapture:true});
 const walletStorage={...storage,get length(){return storage.length},setItem:(key,value)=>{
  if(key.startsWith('lumenWallet'))throw Object.assign(Error('full'),{name:'QuotaExceededError'});
  storage.setItem(key,value);
 }};
 const wallet=createDurableCanonicalVictoryOutbox(walletStorage,{namespace:'Wallet',fallback,
  onIssue:issue=>events.push({event:'wallet_outbox_storage',kind:issue.kind})});
 let walletEntry,walletBefore;
 const checkpointWallet=async()=>{
  walletEntry=await wallet.enqueue('a','wallet',{request:{kind:'spend'}},{operationId:'wallet-pending'});
  walletBefore=JSON.stringify(await wallet.pending('a'));
 };
 if(!deferWallet)await checkpointWallet();
 let remote=structuredClone(local);remote.shards=3;
 remote.canonicalQuestState['fixture-quest'].badges.speed=true;
 if(conflict)remote.canonicalQuestState['fixture-quest'].performance.seconds=12;
 let authCallback,resolveSession;
 const client={auth:{onAuthStateChange:fn=>{authCallback=fn},getSession:()=>new Promise(resolve=>{resolveSession=resolve})},rpc:async(name,args)=>{
  calls.push(name);
  if(name==='lumen_reconcile_acquisitions')return {error:{code:'PGRST202'},status:404};
  if(name==='lumen_wallet_command_version')return {error:{code:'PGRST202'},status:404};
  if(name==='lumen_restore_profile'){
   if(!walletEntry)await checkpointWallet();
   return {data:structuredClone(remote),error:null};
  }
  if(name==='lumen_get_wallet_command'){
   assert.equal(args.p_operation_id,walletEntry.operationId);return {data:null,error:null};
  }
  if(name==='lumen_cas_profile'||name.startsWith('lumen_commit_'))assert.fail('Recovery must not synthesize a reward or resubmit an archived capture');
  return {data:[],error:null};
 }};
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const start=source.indexOf('afterAuthCloudSync:async()=>{')+'afterAuthCloudSync:async()=>{'.length;
 const end=source.indexOf('},holdLegacyMergeForFullRestore',start);
 assert(end>start,'Actual production hydration hook found');
 const noop=()=>{},scheduler={cancel:noop,schedule:noop};
 const ctx=vm.createContext({cloudHydrationGeneration:0,...profiles,structuredClone,currentCatalogueOrigin,qaActive:false,lumenUser:{id:'a'},lumenSupabase:client,
  canonicalRecoveryContext:null,canonicalRecovery:scheduler,sessionStorage:{getItem:()=>null},localStorage:storage,
  cloudProfileReady:false,cloudProfileBaseline:null,cloudProfileFailure:null,lumenProgress:local,
  authSessionPending:false,navigator:{onLine:true},
  normalizeSequentialProgress:()=>0,sequentialSolvedCount:0,scheduleCloudProfile:()=>calls.push('schedule_flush'),
  walletCommandsSupported,walletOutbox:wallet,canonicalVictoryOutbox:canonical,legacyVictoryOutbox:{resume:async()=>{}},
  replayCanonicalVictoryOutbox,replayLegacyVictoryOutbox:async()=>[],
  commitCanonicalVictory:()=>assert.fail('An archived capture is not a new command'),
  recoverQueuedCanonicalReceipt:()=>assert.fail('Archive is already durable'),
  refreshCanonicalOutboxNotice:async()=>{},attemptEngine:{snapshot:()=>null},
  canonicalAttemptToResume:()=>null,canonicalQuestList:()=>[{id:'fixture-quest',legacyIndex:null}],
  currentQuestPosition:()=>0,reconcileDailyIntoCloudProfile,canonicalResumeOwner:null,
  recordCloudDiagnostic:(event,details={})=>events.push({event,...JSON.parse(JSON.stringify(details))}),
  updateShardMeter:()=>{},renderDaily:noop,updateAuthUI:noop,refreshJourney:noop,resumeCanonicalCampaignBoundary:noop,resumeHydratedCampaignSelection:noop,
  verifyLegacyProgressMirror:async()=>({ok:true,count:0}),resumeCanonicalVictoryAfterHydration:noop,
  maybeShowStreakLoss:noop,document:{getElementById:()=>null},location:{reload:()=>ctx.reloads++},reloads:0,
  console:{warn:(_message,error)=>{throw error}}
 });
 const hook=vm.runInContext('(async function(){'+source.slice(start,end)+'})',ctx);
 const model={get lumenUser(){return ctx.lumenUser},set lumenUser(value){ctx.lumenUser=value},lumenSupabase:client};
 const api=createCloudPersistence(model,{onAccountChanged:event=>{if(event.authEvent)events.push({event:'auth',type:event.authEvent})},
  refreshJourney:noop,renderDaily:noop,holdLegacyMergeForFullRestore:async()=>true,afterAuthCloudSync:hook
 },{console:{warn:()=>assert.fail('Auth unexpectedly failed')},setTimeout:fn=>timers.push(fn)});
 if(quota){const set=storage.setItem;storage.setItem=(key,value)=>{
  if(key.startsWith('lumenBeforeCloudReconcile_'))throw Object.assign(Error('private-fixture'),{name:'QuotaExceededError'});
  set(key,value);
 }}
 return {ctx,api,hook,storage,events,calls,archived,indexed,canonical,wallet,walletBefore,
  restart:()=>{
   ctx.walletOutbox=createDurableCanonicalVictoryOutbox(walletStorage,{namespace:'Wallet',fallback});
   ctx.canonicalVictoryOutbox=createDurableCanonicalVictoryOutbox(storage,{fallback});
  },
  get remote(){return remote},set remote(value){remote=value},
  fire:(...args)=>authCallback(...args),session:()=>resolveSession,
  assertEvidence:async()=>{
   assert.deepEqual([...indexed].filter(([key])=>key.startsWith('lumenCanonicalRecreatedCaptureArchiveV1:')),archived);
   assert.equal((await canonical.pending('a')).length,0);
   assert.equal(JSON.stringify(await wallet.pending('a')),walletBefore);
  }};
}

test('historical acquisition seed installs once then completes hydration without another recovery RPC or victory',async()=>{
 const f=await sessionFixture(),local=JSON.parse(f.storage.getItem('lumenProgressV1'));
 local.legacyVictoryRevision=1;
 local.canonicalQuestState['fixture-quest'].performance={seconds:48,bestTime:48,assisted:false};
 f.storage.setItem('lumenProgressV1',JSON.stringify(local));
 Object.assign(f.ctx.lumenProgress,structuredClone(local));
 f.remote=structuredClone(local);
 f.remote.canonicalQuestState['fixture-quest'].runPerformance={seconds:48,bestTime:48,assisted:false,badges:{}};
 for(let restart=0;restart<2;restart++){
  await f.hook();
  assert.equal(f.ctx.cloudProfileReady,restart===1,JSON.stringify(f.events));assert.equal(f.ctx.cloudProfileFailure,null);
  assert.equal(f.ctx.reloads,1,'The ordinary verified installation reloads exactly once');
  assert.equal(f.ctx.lumenProgress.shards,local.shards);
  assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')).canonicalQuestState,f.remote.canonicalQuestState);
  assert.equal(f.calls.includes('lumen_reconcile_acquisitions'),false);
  await f.assertEvidence();f.restart();
 }
});

test('favorable recovery completes the production hydration hook in the current session without reload or a new victory',async()=>{
 for(const hold of ['wallet','quest-authority','cas-race']){
 const f=await sessionFixture({conflict:true}),rpc=f.ctx.lumenSupabase.rpc;
 if(hold!=='wallet')f.ctx.reconcileDominantLocalProfile=async()=>{throw Object.assign(Error('synthetic guarded writer refusal'),{code:hold==='quest-authority'?'QUEST_COMMAND_REQUIRED':'CLOUD_CAS_CONFLICT'});};
 const original=f.storage.getItem('lumenProgressV1');
 f.ctx.lumenSupabase.rpc=async(name,args)=>{
  if(name!=='lumen_reconcile_acquisitions')return rpc(name,args);
  assert.equal(args.p_expected_user_id,'a');
  const entry=f.remote.canonicalQuestState['fixture-quest'];
  // SQL fixtures verify the real merge; this transport models its result while
  // executing the actual owner-bound orchestration and native outbox adapters.
  entry.badges={...entry.badges,...args.p_local.canonicalQuestState['fixture-quest'].badges,speed:true};
  entry.runPerformance={version:3,bestTime:12,badges:entry.badges};
  return {data:{policy:'positive-acquisitions-v1',userId:'a',profile:structuredClone(f.remote)}};
 };
 await f.hook();
 assert.equal(f.ctx.cloudProfileReady,true);assert.equal(f.ctx.cloudProfileFailure,null);
 assert.equal(f.ctx.reloads,0);assert(f.calls.includes('schedule_flush'));
 assert.equal(f.ctx.lumenProgress.shards,3,'Confirmed server spending wins over the old local balance');
 assert.equal(f.ctx.lumenProgress.canonicalQuestState['fixture-quest'].badges.speed,true);
 assert([...f.storage.data.values()].includes(original));await f.assertEvidence();
 assert(f.events.some(e=>e.event==='hydration_reconciliation'&&e.reason==='positive_acquisitions'));
 assert(f.events.some(e=>e.event==='hydration_ready'&&e.profileReady));
 // Restart/verified token refresh consumes the converged snapshot and does not
 // recreate a victory or acknowledge any unrelated pending Wallet intention.
 f.restart();await f.hook();assert.equal(f.ctx.cloudProfileReady,true);assert.equal(f.ctx.reloads,0);
 await f.assertEvidence();
 }
});

test('the production backoff resumes a lost acquisition reply autonomously and bounds repeated failures',async()=>{
 for(const scenario of ['lost-reply','covered-reply','restore-outage','repeated-network','account-switch','active-game','offline']){
  const f=await sessionFixture({conflict:scenario!=='covered-reply'}),rpc=f.ctx.lumenSupabase.rpc,timers=[];let attempts=0;
  if(scenario==='covered-reply'){
   f.remote.walletRevision=2;f.remote.legacyVictoryRevision=1;
   const local=JSON.parse(f.storage.getItem('lumenProgressV1'));local.badges.localOnly=1;f.storage.setItem('lumenProgressV1',JSON.stringify(local));
   f.ctx.reconcileDominantLocalProfile=async()=>{throw Object.assign(Error('guarded'),{code:'QUEST_COMMAND_REQUIRED'});};
  }
  f.ctx.createCloudRetryScheduler=options=>createCloudRetryScheduler({...options,
   setTimer:fn=>{timers.push(fn);return fn},clearTimer:fn=>{const i=timers.indexOf(fn);if(i>=0)timers.splice(i,1)},random:()=>0});
  f.ctx.hydrateCloudProfile=f.hook;
  const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
  const start=source.indexOf('let acquisitionRecoveryAttempts=0;'),end=source.indexOf('async function retryAccountCloudSync',start);
  vm.runInContext(source.slice(start,end),f.ctx);
  let restoreFailed=false;
  f.ctx.lumenSupabase.rpc=async(name,args)=>{
   if(scenario==='restore-outage'&&name==='lumen_restore_profile'&&attempts===1&&!restoreFailed){restoreFailed=true;throw TypeError('temporary restore outage');}
   if(name!=='lumen_reconcile_acquisitions')return rpc(name,args);
   attempts++;
   f.remote.badges={...f.remote.badges,...args.p_local.badges};
   const entry=f.remote.canonicalQuestState['fixture-quest'];
   entry.badges={...entry.badges,...args.p_local.canonicalQuestState['fixture-quest'].badges,speed:true};
   entry.runPerformance={version:3,bestTime:12,badges:entry.badges};
   if(attempts===1||scenario==='repeated-network')throw TypeError('simulated response loss');
   return {data:{policy:'positive-acquisitions-v1',userId:'a',profile:structuredClone(f.remote)}};
  };
  await f.hook();assert.equal(f.ctx.cloudProfileReady,false);assert.equal(timers.length,1);
  if(scenario==='account-switch')f.ctx.lumenUser={id:'other'};
  if(scenario==='active-game')f.ctx.attemptEngine.snapshot=()=>({state:'RUNNING'});
  if(scenario==='offline')f.ctx.navigator.onLine=false;
  for(let i=0;i<10&&timers.length;i++){
   timers.shift()();
   // Drain async RPC/storage continuations, using the real production scheduler.
   for(let n=0;n<10;n++)await new Promise(resolve=>setImmediate(resolve));
  }
  assert.equal(timers.length,0,'No unbounded retry loop');assert.equal(f.ctx.reloads,0);
  if(scenario==='lost-reply'||scenario==='restore-outage'){assert.equal(f.ctx.cloudProfileReady,true);assert.equal(attempts,2);}
  if(scenario==='covered-reply'){assert.equal(f.ctx.cloudProfileReady,true);assert.equal(attempts,1,'Server read alone proves the committed union');}
  if(scenario==='repeated-network'){assert.equal(f.ctx.cloudProfileReady,false);assert.equal(attempts,6);}
  if(scenario==='account-switch'){assert.equal(f.ctx.cloudProfileReady,false);assert.equal(attempts,1);}
  if(scenario==='active-game'||scenario==='offline'){
   assert.equal(attempts,1,'Active play/offline must not emit recovery');
   f.ctx.attemptEngine.snapshot=()=>null;f.ctx.navigator.onLine=true;
   await vm.runInContext('acquisitionRecovery.wake()',f.ctx);
   assert.equal(f.ctx.cloudProfileReady,true);assert.equal(attempts,2);
  }
  await f.assertEvidence();
 }
});

test('SIGNED_IN plus INITIAL_SESSION preserves the indexed wallet and archived capture across restart and verified recovery',async()=>{
 for(const order of [['SIGNED_IN','INITIAL_SESSION'],['INITIAL_SESSION','SIGNED_IN']]){
  const f=await sessionFixture(),loading=f.api.initLumenCloud();
  while(!f.session())await Promise.resolve();
  for(const event of order)f.fire(event,{user:{id:'a'}});
  f.session()({data:{session:{user:{id:'a'}}}});await loading;
  assert.deepEqual(f.events.filter(e=>e.event==='auth').map(e=>e.type),order);
  assert.equal(f.ctx.reloads,1,'Verified badge improvement requests one reload, not an immutable reward conflict');
  assert.equal(f.ctx.cloudProfileReady,false);await f.assertEvidence();
  await f.hook();
  assert.equal(f.ctx.reloads,1,'Retry after restart is idempotent');
  assert.equal(f.ctx.cloudProfileReady,false);
  assert.equal(f.ctx.cloudProfileFailure.reason,'partial_reconciliation');
  assert.equal(JSON.parse(f.storage.getItem('lumenProgressV1')).shards,9);
  await f.assertEvidence();
  f.remote.walletRevision=2;await f.hook(); // separately verified server authority advances
  assert.equal(f.ctx.cloudProfileReady,false,'A rewritten local cache still requires its reload');
  await f.hook();
  assert.equal(f.ctx.cloudProfileReady,true);assert.equal(f.ctx.cloudProfileFailure,null);
  assert.equal(JSON.parse(f.storage.getItem('lumenProgressV1')).shards,3);
  await f.assertEvidence();
 }
});

test('#536 exact event order retains the wallet hold instead of an unexplained divergence',async()=>{
 for(const order of [['SIGNED_IN','INITIAL_SESSION'],['INITIAL_SESSION','SIGNED_IN']]){
  for(const [revision,reason] of [[1,'mutable_balance'],[0,'invalid_wallet_revision']]){
   const f=await sessionFixture({deferWallet:true});
   f.remote.canonicalQuestState=JSON.parse(f.storage.getItem('lumenProgressV1')).canonicalQuestState;
   f.remote.walletRevision=revision;
   const before=f.storage.getItem('lumenProgressV1'),loading=f.api.initLumenCloud();
   while(!f.session())await Promise.resolve();
   for(const event of order)f.fire(event,{user:{id:'a'}});
   f.session()({data:{session:{user:{id:'a'}}}});await loading;
   const sequence=f.events.filter(e=>['canonical_attempt_receipt_recovered','auth','wallet_outbox_storage'].includes(e.event));
   assert.deepEqual(sequence.map(e=>e.event==='auth'?e.type:e.kind||e.event),
    ['canonical_attempt_receipt_recovered',...order,'indexed_checkpoint']);
   assert.equal(f.ctx.cloudProfileReady,false);
   assert.equal(f.ctx.cloudProfileFailure.detail,reason,'A proven wallet hold must not become generic cloud_local_divergence');
   assert.equal(f.storage.getItem('lumenProgressV1'),before);await f.assertEvidence();
   f.restart();await f.hook();assert.equal(f.ctx.cloudProfileFailure.detail,reason);await f.assertEvidence();
  }
 }
});

test('#536 overlapping wallet and reward refusals remain separately classified',async()=>{
 const f=await sessionFixture({conflict:true,deferWallet:true});
 const before=f.storage.getItem('lumenProgressV1');await f.hook();
 const reconciliation=f.events.find(e=>e.event==='hydration_reconciliation');
 const achievement=f.events.find(e=>e.event==='cloud_achievements_recovery_blocked');
 assert.equal(reconciliation.reason,'mutable_balance');
 assert.equal(reconciliation.domain,'wallet');
 assert.equal(reconciliation.stage,'bidirectional_reconciliation');
 assert.equal(achievement.reason,'canonical_reward_conflict');
 assert.equal(achievement.domain,'reward');
 assert.equal(achievement.stage,'achievement_recovery');
 assert.equal(f.ctx.cloudProfileFailure.detail,'canonical_reward_conflict');
 assert.equal(f.storage.getItem('lumenProgressV1'),before);await f.assertEvidence();
});

test('#536 an invalid XP projection is a reward refusal, not a wallet refusal',async()=>{
 const f=await sessionFixture();
 const local=JSON.parse(f.storage.getItem('lumenProgressV1'));
 f.remote.canonicalQuestState=local.canonicalQuestState;f.remote.shards=local.shards;f.remote.xp=-1;
 const before=f.storage.getItem('lumenProgressV1');await f.hook();
 const result=f.events.find(e=>e.event==='hydration_reconciliation');
 assert.equal(result.reason,'invalid_balance');assert.deepEqual(result.fields,['xp']);
 assert.equal(result.domain,'reward');assert.equal(f.ctx.cloudProfileFailure.domain,'reward');
 assert.equal(f.storage.getItem('lumenProgressV1'),before);await f.assertEvidence();
});

test('#536 storage refusal at wallet receipt read-back is not a reward or Auth conflict',async()=>{
 const f=await sessionFixture({deferWallet:true}),rpc=f.ctx.lumenSupabase.rpc;
 f.ctx.console.warn=()=>{};
 f.ctx.lumenSupabase.rpc=async(name,args)=>{
  if(name==='lumen_get_wallet_command')throw Object.assign(Error('private-provider-message'),{name:'SecurityError'});
  return rpc(name,args);
 };
 const before=f.storage.getItem('lumenProgressV1');await f.hook();
 const failure=f.events.find(e=>e.event==='hydration_failed');
 assert.equal(failure.stage,'wallet_receipt_read');assert.equal(failure.domain,'storage');
 assert.equal(failure.detail,'storage_unavailable');
 assert(!JSON.stringify(f.events).includes('private-provider-message'));
 assert.equal(f.storage.getItem('lumenProgressV1'),before);await f.assertEvidence();
});

test('#536 offline interruption preserves every intent and retry retains the known wallet refusal',async()=>{
 const f=await sessionFixture(),rpc=f.ctx.lumenSupabase.rpc;
 f.remote.canonicalQuestState=JSON.parse(f.storage.getItem('lumenProgressV1')).canonicalQuestState;
 const before=f.storage.getItem('lumenProgressV1');f.ctx.console.warn=()=>{};
 f.ctx.lumenSupabase.rpc=async()=>{throw TypeError('private-network-details')};
 await f.hook();assert.equal(f.ctx.cloudProfileReady,false);
 assert.equal(f.events.find(e=>e.event==='hydration_failed').stage,'cloud_restore');
 assert.equal(f.storage.getItem('lumenProgressV1'),before);await f.assertEvidence();
 f.ctx.lumenSupabase.rpc=rpc;f.restart();await f.hook();
 assert.equal(f.ctx.cloudProfileFailure.detail,'mutable_balance');
 assert.equal(f.storage.getItem('lumenProgressV1'),before);await f.assertEvidence();
 assert(!JSON.stringify(f.events).includes('private-network-details'));
});

test('#536 backup and installation failures report their exact storage boundary without reward values',()=>{
 for(const fault of ['backup-quota','backup-denied','install-silent']){
  const local=profile(),cloud=structuredClone(local),storage=storeFor(local),write=storage.setItem;
  const before=storage.getItem('lumenProgressV1');cloud.canonicalQuestState['fixture-quest'].badges.speed=true;
  storage.setItem=(key,value)=>{
   if(key.startsWith('lumenBeforeCloudReconcile_')&&fault!=='install-silent')
    throw Object.assign(Error('private-storage-details'),{name:fault==='backup-quota'?'QuotaExceededError':'SecurityError'});
   if(fault==='install-silent'&&key==='lumenProgressV1'&&value!==before)return;
   write(key,value);
  };
  assert.throws(()=>reconcileCloudAchievements(storage,cloud),error=>{
   const diagnostic=profiles.hydrationFailureDiagnostic(error,'achievement_recovery');
   assert.equal(diagnostic.stage,fault==='install-silent'?'achievement_install':'achievement_backup');
   assert.equal(diagnostic.domain,'storage');
   assert(!JSON.stringify(diagnostic).includes('private-storage-details'));return true;
  });
  assert.equal(storage.getItem('lumenProgressV1'),before);
 }
 const diagnostic=profiles.hydrationFailureDiagnostic({name:'private-name',code:'private-code',stage:'private-stage'},'cloud_restore');
 assert.equal(diagnostic.errorCode,'unknown');assert.equal(diagnostic.errorName,'Error');
 assert.equal(diagnostic.stage,'cloud_restore');assert(!JSON.stringify(diagnostic).includes('private-'));
});

test('the same hydration sequence reports a safe specific hold on true conflicts or quota and can retry',async()=>{
 for(const fault of ['conflict','quota']){
  const f=await sessionFixture({conflict:fault==='conflict',quota:fault==='quota'});
  const before=f.storage.getItem('lumenProgressV1');
  await f.hook();
  assert.equal(f.ctx.cloudProfileReady,false);assert.equal(f.ctx.reloads,0);
  assert.equal(f.storage.getItem('lumenProgressV1'),before);
  const blocked=f.events.find(e=>e.event==='cloud_achievements_recovery_blocked');
  assert.equal(blocked.reason,fault==='conflict'?'canonical_reward_conflict':'storage_quota');
  if(fault==='conflict'){assert.deepEqual(blocked.fields,['canonicalQuestState']);assert.deepEqual(blocked.conflictKeys,['performance','badges']);}
  await f.assertEvidence();
  await f.hook();assert.equal(f.storage.getItem('lumenProgressV1'),before);
  assert.equal(f.ctx.cloudProfileReady,false);await f.assertEvidence();
 }
});

test('hydration never echoes a private or unknown quest key into its diagnostics',async()=>{
 const f=await sessionFixture({conflict:true}),privateKey='private-fixture@example.test';
 f.remote.shards=9; // Reach full reward reconciliation, not only the wallet hold.
 const local=JSON.parse(f.storage.getItem('lumenProgressV1'));
 local.canonicalQuestState[privateKey]=local.canonicalQuestState['fixture-quest'];delete local.canonicalQuestState['fixture-quest'];
 f.remote.canonicalQuestState[privateKey]=f.remote.canonicalQuestState['fixture-quest'];delete f.remote.canonicalQuestState['fixture-quest'];
 const before=JSON.stringify(local);f.storage.setItem('lumenProgressV1',before);
 await f.hook();
 const blocked=f.events.find(e=>e.event==='cloud_achievements_recovery_blocked');
 assert.equal(blocked.reason,'canonical_reward_conflict');assert.equal(blocked.conflictId,undefined);
 assert(!JSON.stringify(f.events).includes(privateKey));
 assert.equal(f.storage.getItem('lumenProgressV1'),before);assert.equal(f.ctx.cloudProfileReady,false);
 await f.assertEvidence();
});

test('an account switch during daily or reconciliation awaits cannot confirm another account profile',async()=>{
 for(const stage of ['daily','dominant','compatible']){
  const f=await sessionFixture();let switched=false,otherRaw;
  const switchAccount=()=>{
   switched=true;f.ctx.lumenUser={id:'b'};
   // Even identical game data does not authorize installing A's baseline for B.
   otherRaw=JSON.stringify(f.remote);f.storage.setItem('lumenProgressV1',otherRaw);
   f.storage.setItem('lumenCloudOwnerId','b');
  };
  if(stage==='daily'){
   const rpc=f.ctx.lumenSupabase.rpc;
   f.ctx.lumenSupabase.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='lumen_get_daily')switchAccount();return result;};
  }else{
   const key=stage==='dominant'?'reconcileDominantLocalProfile':'reconcileCompatibleCloudProfiles',reconcile=f.ctx[key];
   f.ctx[key]=async(...args)=>{const result=await reconcile(...args);switchAccount();return result;};
  }
  await f.hook();
  assert(switched,stage);assert.equal(f.ctx.cloudProfileReady,false,stage+' must not mark B ready from A data');
  assert.equal(f.ctx.cloudProfileBaseline,null,stage+' must not install A baseline');
  assert.equal(f.storage.getItem('lumenProgressV1'),otherRaw);assert.equal(f.storage.getItem('lumenCloudOwnerId'),'b');
  assert(!f.events.some(e=>e.event==='hydration_ready'));await f.assertEvidence();
 }
});
