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
 const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8'),ctx=vm.createContext({});
 vm.runInContext(functionSource(source,'cloudReconciliationMessage'),ctx);
 for(const detail of ['storage_quota','canonical_reward_conflict','backup_unverified']){
  const message=ctx.cloudReconciliationMessage({reason:'partial_reconciliation',detail});
  assert.match(message,/conservées/);assert.doesNotMatch(message,/synchronisée/);
 }
 assert.match(ctx.cloudReconciliationMessage({reason:'network'}),/resynchroniser/);
});

async function sessionFixture({conflict=false,quota=false}={}){
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
 const walletStorage={...storage,get length(){return storage.length},setItem:(key,value)=>{
  if(key.startsWith('lumenWallet'))throw Object.assign(Error('full'),{name:'QuotaExceededError'});
  storage.setItem(key,value);
 }};
 const wallet=createDurableCanonicalVictoryOutbox(walletStorage,{namespace:'Wallet',fallback});
 const walletEntry=await wallet.enqueue('a','wallet',{request:{kind:'spend'}},{operationId:'wallet-pending'});
 const walletBefore=JSON.stringify(await wallet.pending('a'));
 let remote=structuredClone(local);remote.shards=3;
 remote.canonicalQuestState['fixture-quest'].badges.speed=true;
 if(conflict)remote.canonicalQuestState['fixture-quest'].performance.seconds=12;
 let authCallback,resolveSession;
 const client={auth:{onAuthStateChange:fn=>{authCallback=fn},getSession:()=>new Promise(resolve=>{resolveSession=resolve})},rpc:async(name,args)=>{
  calls.push(name);
  if(name==='lumen_restore_profile')return {data:structuredClone(remote),error:null};
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
 const ctx=vm.createContext({...profiles,structuredClone,currentCatalogueOrigin,qaActive:false,lumenUser:{id:'a'},lumenSupabase:client,
  canonicalRecoveryContext:null,canonicalRecovery:scheduler,sessionStorage:{getItem:()=>null},localStorage:storage,
  cloudProfileReady:false,cloudProfileBaseline:null,cloudProfileFailure:null,lumenProgress:local,
  walletOutbox:wallet,canonicalVictoryOutbox:canonical,legacyVictoryOutbox:{resume:async()=>{}},
  replayCanonicalVictoryOutbox,replayLegacyVictoryOutbox:async()=>[],
  commitCanonicalVictory:()=>assert.fail('An archived capture is not a new command'),
  recoverQueuedCanonicalReceipt:()=>assert.fail('Archive is already durable'),
  refreshCanonicalOutboxNotice:async()=>{},attemptEngine:{snapshot:()=>null},
  canonicalAttemptToResume:()=>null,canonicalQuestList:()=>[{id:'fixture-quest',legacyIndex:null}],
  currentQuestPosition:()=>0,reconcileDailyIntoCloudProfile,canonicalResumeOwner:null,
  recordCloudDiagnostic:(event,details={})=>events.push({event,...JSON.parse(JSON.stringify(details))}),
  renderDaily:noop,updateAuthUI:noop,refreshJourney:noop,resumeCanonicalCampaignBoundary:noop,
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
  get remote(){return remote},set remote(value){remote=value},
  fire:(...args)=>authCallback(...args),session:()=>resolveSession,
  assertEvidence:async()=>{
   assert.deepEqual([...indexed].filter(([key])=>key.startsWith('lumenCanonicalRecreatedCaptureArchiveV1:')),archived);
   assert.equal((await canonical.pending('a')).length,0);
   assert.equal(JSON.stringify(await wallet.pending('a')),walletBefore);
  }};
}

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
