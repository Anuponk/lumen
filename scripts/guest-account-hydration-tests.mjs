import assert from 'node:assert/strict';
import {recordQualifyingStart,markQualifiedStart} from '../src/campaign/qualification-window.js';
import {networkContext,withNetworkContext} from './fixtures/network-context.mjs';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import * as profiles from '../src/persistence/cloud-profile.js';
import * as guestAccount from '../src/persistence/guest-account.js';
import {reconcileDailyIntoCloudProfile} from '../src/persistence/daily-hydration.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
import {preserveAttemptSnapshot} from '../src/campaign/campaign-resume.js';
import {functionSource} from './source-tools.mjs';
import {ATTEMPT_STATES} from '../src/game/attempt-engine.js';
const source=process.argv.includes('--baseline')?execFileSync('../.tools/mingit/cmd/git.exe',['show','HEAD:src/ui/game-screen.js'],{encoding:'utf8'}):readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const start=source.indexOf('afterAuthCloudSync:async()=>{')+'afterAuthCloudSync:async()=>{'.length,end=source.indexOf('},holdLegacyMergeForFullRestore',start);
const guest={solved:{0:1,1:1},historyBackup:{0:1,1:1},badges:{first:1},stars:{},performances:{0:{version:3,badges:{speed:true},bestTime:45}},noHint:{0:1},daily:{dates:{},rewards:{}},challenges:{},shards:2,xp:30,skyScore:2,skyHistoryVersion:4,catalogueOrigin:currentCatalogueOrigin};
// Server contract of lumen_reconcile_acquisitions (migration 20261025145734):
// positive flags and quest completions are unioned, xp/skyScore keep max, and
// shards, walletRevision, daily and receipts stay exactly the server's.
function serverAcquisitions(remote,local){
 const p=structuredClone(remote);
 for(const key of ['badges','stars','noHint','historyBackup','challenges','solved'])
  for(const [id,value] of Object.entries(local[key]||{}))if(value===true||value===1)(p[key]??={})[id]=1;
 for(const [id,record] of Object.entries(local.performances||{}))(p.performances??={})[id]??=structuredClone(record);
 for(const key of ['xp','skyScore'])if(Number.isSafeInteger(local[key]))p[key]=Math.max(local[key],Number(p[key]||0));
 return p;
}
function fixture({cloud=null,owner=null,offline=false,failVerification=false,switchDuringRead=false,advanceDuringHydration=false,modernClaim=false,local=guest,digestCas=false,walletRefusal=false,concurrentSpend=false,dailyRows=[],acquisitions=false,acquisitionsError=null,acquisitionsConcurrentSpend=false}={}){
 const data=new Map([['lumenProgressV1',JSON.stringify(local)]]);
 if(owner)data.set('lumenCloudOwnerId',owner);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i]??null,get length(){return data.size}};
 let remote=structuredClone(cloud),initialized=0,reads=0,reloads=0,handoffs=0,claimReceipt=null;
 const calls=[],events=[],noop=()=>{};
 const client={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='lumen_guest_claim_version')return modernClaim?{data:1}:{error:{code:'PGRST202'},status:404};
  if(offline)return {error:{code:'503'}};
  if(name==='lumen_claim_guest_profile'){
   assert.equal(args.p_expected_user_id,'a');assert.equal(args.p_manifest.userId,'a');
   assert.equal(args.p_manifest.sourceRaw,JSON.stringify(guest));
   if(!claimReceipt){initialized++;remote=JSON.parse(args.p_manifest.seedRaw);claimReceipt={version:1,userId:'a',claimId:args.p_manifest.claimId,sourceDigest:args.p_manifest.sourceDigest,seedDigest:args.p_manifest.seedDigest,policy:args.p_manifest.policy,status:'initialized'}}
   return {data:structuredClone(claimReceipt)};
  }
  if(name==='lumen_get_guest_claim')return {data:structuredClone(claimReceipt)};
  if(name==='lumen_restore_profile'){
   reads++;if(switchDuringRead)ctx.lumenUser={id:'b'};
   if(failVerification&&initialized)return {error:{code:'503'}};
   return {data:structuredClone(remote)};
  }
  if(name==='lumen_initialize_profile'){initialized++;remote??=structuredClone(args.p_payload);return {data:structuredClone(remote)}}
  if(name==='lumen_cas_profile_digest'&&digestCas){
   assert.equal(args.p_expected_user_id,'a');
   if(concurrentSpend){
    concurrentSpend=false;remote.shards--;remote.walletRevision++;
    return {data:{version:1,matched:false,applied:false}};
   }
   const next=args.p_payload;
   if(walletRefusal||['shards','walletRevision','daily'].some(key=>!profiles.sameCloudProfile(next[key],remote[key]))){
    return {error:{code:'22023',message:'wallet command required; preserve pending data and update client'},status:400};
   }
   remote=structuredClone(next);return {data:{version:1,matched:true,applied:true}};
  }
  if(name==='lumen_reconcile_acquisitions'&&acquisitions){
   assert.equal(args.p_expected_user_id,'a');
   if(acquisitionsError)return {error:{code:acquisitionsError}};
   if(acquisitionsConcurrentSpend){acquisitionsConcurrentSpend=false;remote.shards--;remote.walletRevision++;}
   if(!profiles.sameCloudProfile(args.p_expected,remote))return {data:null};
   remote=serverAcquisitions(remote,args.p_local);
   return {data:{policy:'positive-acquisitions-v1',userId:'a',profile:structuredClone(remote)}};
  }
  if(name==='lumen_cas_profile'){
   if(!profiles.sameCloudProfile(args.p_expected,remote))return {data:false};
   remote=structuredClone(args.p_payload);return {data:true};
  }
  if(name==='lumen_get_daily'||name==='lumen_get_engagement'){
   if(advanceDuringHydration){const next=structuredClone(guest);next.solved[2]=1;next.historyBackup[2]=1;next.xp=45;storage.setItem('lumenProgressV1',JSON.stringify(next));}
   return {data:name==='lumen_get_daily'?dailyRows:[]};
  }
  throw Error('Unexpected RPC '+name);
 }};
 const ctx=vm.createContext({...networkContext(),cloudHydrationGeneration:0,...profiles,...guestAccount,structuredClone,currentCatalogueOrigin,
  qaActive:false,lumenUser:{id:'a'},lumenSupabase:client,lumenProgress:structuredClone(local),localStorage:storage,
  sequentialSolvedCount:0,normalizeSequentialProgress:()=>Object.keys(remote?.solved||{}).length,
  sessionStorage:{getItem:()=>null},canonicalRecoveryContext:null,canonicalRecovery:{cancel:noop,schedule:noop},
  cloudProfileReady:false,cloudProfileBaseline:null,cloudProfileFailure:null,canonicalResumeOwner:null,acquisitionRecoveryAttempts:0,preserveAttemptSnapshot,
  walletCommandsSupported:async()=>false,canonicalVictoryOutbox:{resume:async()=>{},pending:async()=>[]},
  walletOutbox:{pending:async()=>[]},
  legacyVictoryOutbox:{resume:async()=>{}},replayCanonicalVictoryOutbox:async()=>[],replayLegacyVictoryOutbox:async()=>[],
  commitCanonicalVictory:noop,commitLegacyVictoryCommand:noop,refreshCanonicalOutboxNotice:async()=>{},
  attemptEngine:{snapshot:()=>null},canonicalAttemptToResume:()=>null,canonicalQuestList:()=>[],
  reconcileDailyIntoCloudProfile,recordCloudDiagnostic:(event,details)=>events.push({event,details}),
  updateShardMeter:()=>{},renderDaily:noop,updateAuthUI:noop,refreshJourney:noop,resumeCanonicalCampaignBoundary:noop,resumeHydratedCampaignSelection:({ownershipChanged})=>{if(ownershipChanged)handoffs++},
  resumeCanonicalVictoryAfterHydration:noop,maybeShowStreakLoss:noop,afterVerifiedHydration:async()=>{},verifyLegacyProgressMirror:async()=>({ok:true,count:2}),
  document:{getElementById:()=>null},location:{reload:()=>reloads++},console:{warn:noop}
 });
 return {ctx,storage,data,calls,events,hook:vm.runInContext('(async()=>{'+source.slice(start,end)+'})',ctx),get remote(){return remote},get initialized(){return initialized},get reloads(){return reloads},get handoffs(){return handoffs}};
}
{
 const cloud={...structuredClone(guest),solved:{},historyBackup:{},badges:{},performances:{},noHint:{},daily:{},walletRevision:4,xp:0,skyScore:0};
 const f=fixture({cloud,digestCas:true}),raw=f.storage.getItem('lumenProgressV1');
 await f.hook();
 assert.equal(f.ctx.cloudProfileReady,true,'Historical guest achievements hydrate without rewriting protected daily scaffolding');
 assert.equal(f.calls.filter(name=>name==='lumen_cas_profile_digest').length,1);
 assert.deepEqual(f.remote,{...guest,daily:{},walletRevision:4,canonicalQuestState:{}},'The verified server wallet stays exact and guest achievements survive');
 assert([...f.data].some(([key,value])=>key.startsWith('lumenGuestBeforeAccount_')&&value===raw));
 await f.hook();
 assert.equal(f.calls.filter(name=>name==='lumen_cas_profile_digest').length,1,'Repeated hydration does not write again');
}
{
 const local={...guest,daily:{dates:{'2026-11-17':1},rewards:{'streak:2026-11-17':1}}};
 const cloud={...guest,daily:{dates:{},rewards:{}},walletRevision:4};
 const f=fixture({cloud,local,digestCas:true}),raw=f.storage.getItem('lumenProgressV1');
 await f.hook();
 assert.equal(f.ctx.cloudProfileReady,false);
 assert.equal(f.ctx.cloudProfileFailure.detail,'wallet_daily_divergence');
 assert(!f.calls.some(name=>name.startsWith('lumen_cas_profile')),'A historical date or reward does not enter CAS');
 assert.deepEqual(f.remote,cloud);
 assert.equal(f.storage.getItem('lumenProgressV1'),raw);
 assert([...f.data].some(([key,value])=>key.startsWith('lumenBeforeCloudReconcileRemote_')&&value===JSON.stringify(cloud)));
}
for(const scenario of [
 {options:{walletRefusal:true},reason:'wallet_command_required',domain:'wallet',fallbacks:0},
 {options:{concurrentSpend:true},reason:'cloud_cas_conflict',domain:'profile',fallbacks:1}
]){
 const cloud={...guest,solved:{},walletRevision:4};
 const f=fixture({cloud,digestCas:true,...scenario.options}),raw=f.storage.getItem('lumenProgressV1');
 await f.hook();
 assert.equal(f.ctx.cloudProfileReady,false);
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),null);
 assert.equal(f.storage.getItem('lumenProgressV1'),raw);
 assert.equal(f.calls.filter(name=>name==='lumen_cas_profile_digest').length,1);
 assert.equal(f.calls.filter(name=>name==='lumen_cas_profile').length,scenario.fallbacks);
 const report=f.events.find(event=>event.event==='hydration_reconciliation').details;
 assert.equal(report.reason,scenario.reason);
 assert.equal(report.domain,scenario.domain);
 assert.deepEqual(f.remote,scenario.options.concurrentSpend?{...cloud,shards:1,walletRevision:5}:cloud);
 const restarted=fixture({cloud:f.remote,local:JSON.parse(raw),digestCas:true,...(scenario.options.walletRefusal?scenario.options:{})});
 await restarted.hook();
 assert.equal(restarted.storage.getItem('lumenProgressV1'),raw);
 assert.equal(restarted.ctx.cloudProfileReady,false);
 assert.deepEqual(restarted.remote,f.remote);
}
{
 const cloud={...guest,walletRevision:4},f=fixture({cloud,digestCas:true,dailyRows:[{play_date:'2026-11-17'}]});
 await f.hook();
 assert.equal(f.ctx.cloudProfileReady,true,'The read-only daily history does not require a protected wallet write');
 assert(!f.calls.some(name=>name.startsWith('lumen_cas_profile')));
 assert.deepEqual(f.remote,cloud);
}
{
 const f=fixture();await f.hook();
 assert.deepEqual(f.remote,guest,'Registration persists the complete guest, including its net balance');
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),'a');
 assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')),guest);
 const device2=new Map(),storage2={getItem:k=>device2.get(k)??null,setItem:(k,v)=>device2.set(k,v)};
 profiles.installCloudProfileLocally(storage2,f.remote);
 assert.deepEqual(JSON.parse(device2.get('lumenProgressV1')),guest,'Second device restores all earned fields');
 await f.hook();assert.equal(f.initialized,1,'Repeated auth does not replay rewards');
}
for(const options of [{offline:true},{failVerification:true},{switchDuringRead:true}]){
 const f=fixture(options),before=f.storage.getItem('lumenProgressV1');await f.hook();
 assert.equal(f.storage.getItem('lumenProgressV1'),before);
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),null);
 assert.equal(f.ctx.cloudProfileReady,false);
}
{
 const f=fixture({cloud:guest});await f.hook();assert.equal(f.storage.getItem('lumenCloudOwnerId'),'a');
 assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')),guest);
}
{
 const f=fixture({cloud:{solved:{},badges:{},shards:3,xp:0}}),raw=f.storage.getItem('lumenProgressV1');await f.hook();
 assert.equal(f.storage.getItem('lumenProgressV1'),raw,'Ambiguous preexisting account cannot erase or borrow a guest balance');
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),null);
 assert(f.events.some(e=>e.event==='hydration_reconciliation'&&e.details.stage==='guest_reconciliation'&&e.details.result==='blocked'&&e.details.reason==='mutable_balance'),'An actual guest conflict reports its bounded cause, not only a generic hydration failure');
}
console.log('Actual hydration: guest registration, second device, retry, offline, interrupted readback, account switch and existing cloud passed');
// #801 (+665 diagnostic): an ownerless historical Chrome profile whose shards
// AND daily ledger diverge from the verified wallet, with all outboxes empty.
// The client must never write the balance; the server acquisition recovery
// merges positive achievements and keeps the wallet authority exactly.
{
 const local={...structuredClone(guest),shards:11,xp:80,solved:{0:1,1:1,2:1},historyBackup:{0:1,1:1,2:1},badges:{first:1,night:1},
  daily:{dates:{'2026-10-02':1},rewards:{'streak:2026-10-02':2}}};
 const cloud={...structuredClone(guest),solved:{0:1},historyBackup:{0:1},badges:{},xp:10,shards:4,walletRevision:6,daily:{dates:{'2026-11-18':1},rewards:{}}};
 const f=fixture({cloud,local,digestCas:true,acquisitions:true}),raw=f.storage.getItem('lumenProgressV1');
 await f.hook();
 assert.equal(f.ctx.cloudProfileReady,true,'#801: the historical profile reaches a ready account without storage erasure');
 assert.equal(f.ctx.cloudProfileFailure,null);
 assert(!f.calls.some(name=>name.startsWith('lumen_cas_profile')),'#801: no client CAS can carry a wallet balance or daily ledger');
 assert.equal(f.calls.filter(name=>name==='lumen_reconcile_acquisitions').length,1);
 assert.equal(f.remote.shards,4,'Wallet balance stays the server value (no credit from the local 11)');
 assert.equal(f.remote.walletRevision,6,'Wallet cursor is untouched');
 assert.deepEqual(f.remote.daily,cloud.daily,'Daily ledger keeps server authority (no replayed streak reward)');
 assert.equal(f.remote.solved[2],1,'Local quest completion is recovered');
 assert.equal(f.remote.badges.night,1,'Local badge is recovered');
 assert.equal(f.remote.xp,80,'Cumulative XP keeps its max policy');
 assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')),f.remote,'The verified server result is installed locally');
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),'a');
 assert([...f.data].some(([key,value])=>key.startsWith('lumenGuestBeforeAccount_')&&value===raw),'Exact historical bytes stay archived');
 assert([...f.data].some(([key,value])=>key.startsWith('lumenBeforeCloudReconcileLocal_')&&value===raw));
 const recovered=f.events.find(e=>e.event==='guest_acquisitions_recovered');
 assert(recovered,'Recovery is diagnosed');
 assert.equal(recovered.details.from,'mutable_balance');
 assert(!JSON.stringify(f.events).match(/"(?:11|80)"|2026-10-02/),'Diagnostics never echo balances or dates');
 const before=structuredClone(f.remote);
 await f.hook();
 assert.equal(f.calls.filter(name=>name==='lumen_reconcile_acquisitions').length,1,'Reload/reconnect does not repeat the recovery');
 assert.deepEqual(f.remote,before,'Second login neither credits nor debits anything');
 assert.equal(f.ctx.cloudProfileReady,true,'The same blocker does not return after a reload');
}
// A concurrent spend on another device between read and recovery: the server
// refuses the stale expectation and the client re-reads, never forcing a write.
{
 const local={...structuredClone(guest),shards:9};
 const cloud={...structuredClone(guest),solved:{0:1},historyBackup:{0:1},shards:4,walletRevision:6};
 const f=fixture({cloud,local,digestCas:true,acquisitions:true,acquisitionsConcurrentSpend:true});
 await f.hook();
 assert.equal(f.ctx.cloudProfileReady,true);
 assert.equal(f.calls.filter(name=>name==='lumen_reconcile_acquisitions').length,2,'One controlled retry after the CAS expectation changed');
 assert.equal(f.remote.shards,3,'The other device spend is kept, never overwritten');
 assert.equal(f.remote.walletRevision,7);
 assert.equal(f.remote.solved[1],1);
}
// A refused or unavailable recovery keeps every copy, the guest owner state and
// the explicit wallet review; it is classified, not reported as a sync success.
for(const acquisitionsError of ['22023','503']){
 const local={...structuredClone(guest),shards:9};
 const cloud={...structuredClone(guest),solved:{0:1},historyBackup:{0:1},shards:4,walletRevision:6};
 const f=fixture({cloud,local,digestCas:true,acquisitions:true,acquisitionsError}),raw=f.storage.getItem('lumenProgressV1');
 await f.hook();
 assert.equal(f.ctx.cloudProfileReady,false);
 assert.equal(f.ctx.cloudProfileFailure.domain,'wallet');
 assert.equal(f.storage.getItem('lumenProgressV1'),raw,'Local bytes are never deleted to unblock login');
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),null);
 assert.deepEqual(f.remote,cloud,'No server write on a refused recovery');
 assert(f.events.some(e=>e.event==='acquisition_recovery_pending'),'The refused recovery is diagnosed');
}
// A cache carrying an account authority cursor without an owner is not a guest:
// merging it into whichever account signs in could mix two identities.
{
 const local={...structuredClone(guest),shards:9,walletRevision:6};
 const cloud={...structuredClone(guest),solved:{0:1},historyBackup:{0:1},shards:4,walletRevision:6};
 const f=fixture({cloud,local,digestCas:true,acquisitions:true});
 await f.hook();
 assert(!f.calls.includes('lumen_reconcile_acquisitions'),'An ownerless account cache is never merged into another account');
 assert.equal(f.ctx.cloudProfileReady,false);
 assert.deepEqual(f.remote,cloud);
}
console.log('Actual hydration #801: historical wallet/daily divergence recovery, concurrent spend, refused recovery and identity guard passed');
{
 const local={...structuredClone(guest),'private-field':'private-fixture@example.test'},f=fixture({cloud:guest,local});
 const raw=f.storage.getItem('lumenProgressV1');await f.hook();
 const report=f.events.find(e=>e.event==='hydration_reconciliation');
 assert.equal(report.details.reason,'unclassified_field');
 assert.deepEqual(Array.from(report.details.fields),['unknown_field']);
 assert(!JSON.stringify(f.events).includes('private-'),'Guest diagnostics cannot expose unknown field names or values');
 assert.equal(f.storage.getItem('lumenProgressV1'),raw,'Unknown guest evidence stays intact');
}
for(const backupFailed of [false,true]){
 const local={solved:{},badges:{},stars:{},performances:{},challenges:{},daily:{dates:{},rewards:{}},xp:0,shards:3,catalogueOrigin:currentCatalogueOrigin};
 const cloud={...structuredClone(guest),shards:99,walletRevision:7};delete cloud.catalogueOrigin;
 const f=fixture({cloud,local});
 const attempt={attemptId:'guest-run',questId:'0',mode:'campaign',state:'READY',qualifying:true,board:[[1,0],[0,0]]};
 const key='lumenActiveAttemptV1';
 f.ctx.ATTEMPT_STATES=ATTEMPT_STATES;f.ctx.levelIndex=0;f.ctx.canonicalActiveQuest=null;f.ctx.localCalendarDay=()=>new Date().toISOString().slice(0,10);
 f.ctx.saveLumenProgress=()=>f.storage.setItem('lumenProgressV1',JSON.stringify(f.ctx.lumenProgress));
 f.ctx.trackAttemptEvent=()=>{};f.ctx.attemptMode=()=>attempt.mode;
 // #908: the first move of a qualifying run also records its start (window from start).
 f.ctx.qualificationOwner=()=>'guest';f.ctx.activeQuest=()=>({id:'base-q001'});f.ctx.recordQualifyingStart=recordQualifyingStart;f.ctx.premiumQuotaGate=()=>null;f.ctx.recordQuotaAttempt=()=>{};f.ctx.markQualifiedStart=markQualifiedStart;f.ctx.localStorage=f.storage;
 f.ctx.attemptEngine={storageKey:key,snapshot:()=>attempt,start:()=>{attempt.state='RUNNING';f.storage.setItem(key,JSON.stringify(attempt))}};
 const begin=vm.runInContext('('+functionSource(source,'ensureAttemptStarted')+')',f.ctx);begin();
 const raw=f.storage.getItem('lumenProgressV1'),attemptRaw=f.storage.getItem(key);
 // #998: a never-won quest gets no performance entry (the legacy guard refuses it);
 assert.equal(Object.keys(JSON.parse(raw).performances).length,0,'No guarded performance entry on a first qualifying start');
 assert.equal(attempt.state,'RUNNING','Actual first-gesture producer ran before login');
 if(backupFailed){const set=f.storage.setItem;f.storage.setItem=(k,v)=>{if(!k.startsWith('lumenBeforeAccountSwitchAttempt_'))set(k,v)};}
 await f.hook();
 if(backupFailed){
  assert.equal(f.storage.getItem('lumenProgressV1'),raw);assert.equal(f.storage.getItem(key),attemptRaw);
  assert.equal(f.storage.getItem('lumenCloudOwnerId'),null);assert.equal(f.ctx.cloudProfileReady,false);
  assert.deepEqual(f.remote,cloud);continue;
 }
 assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')),cloud,'Start-only guest metadata must not block account restoration');
 assert([...f.data.values()].includes(raw),'The complete start-only guest profile is archived');
 assert([...f.data].some(([k,v])=>k.startsWith('lumenBeforeAccountSwitchAttempt_')&&v===attemptRaw),'Guest board and run identity are archived before account installation');
 assert.deepEqual(f.remote,cloud,'Guest start cannot change the account cooldown, rewards or wallet');
 assert.equal(f.handoffs,1,'Existing account selects its campaign immediately after installation');
 assert.equal(f.ctx.cloudProfileReady,true);
 assert.equal(f.reloads,0,'Account selection does not require a document restart');
 await f.hook();assert.equal(f.handoffs,1,'Same-owner Auth refresh never replaces a selected run');
}
{
 const local={solved:{},badges:{},stars:{},performances:{},challenges:{},daily:{dates:{},rewards:{}},xp:0,shards:3,catalogueOrigin:currentCatalogueOrigin};
 const cloud={...structuredClone(guest),shards:99,walletRevision:7};delete cloud.catalogueOrigin;
 const f=fixture({cloud,local}),raw=f.storage.getItem('lumenProgressV1');await f.hook();
 assert.deepEqual(JSON.parse(f.storage.getItem('lumenProgressV1')),cloud,'A first login from a virgin browser restores the full authenticated cloud');
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),'a');
 assert([...f.data.values()].includes(raw),'The exact guest starter original is retained');
 assert.equal(f.initialized,0,'Existing cloud is not initialized again');
 assert(!f.calls.includes('lumen_cas_profile'),'A virgin device does not mint starter currency or rewrite account history');
 await f.hook();assert.equal(f.ctx.cloudProfileReady,true,'Reload reaches ready with the restored owned cache');
 assert.deepEqual(f.remote,cloud,'Repeated hydration does not credit or debit the wallet');
}
{
 const f=fixture({modernClaim:true});await f.hook();
 assert.equal(f.reloads,1,'First owner installation follows the existing verified reload boundary');
 assert.equal(f.handoffs,0,'New account seeding keeps the guest run rather than selecting another quest');
 assert.deepEqual(f.remote,guest);assert.equal(f.storage.getItem('lumenCloudOwnerId'),'a');
 assert.ok(f.calls.includes('lumen_get_guest_claim'));assert.ok(!f.calls.includes('lumen_initialize_profile'));
 assert.equal([...f.data.keys()].filter(key=>key.startsWith('lumenGuestClaimV1:')).length,1);
 await f.hook();assert.equal(f.initialized,1,'Repeated auth cannot create a second guest grant');
 assert.equal(f.ctx.cloudProfileReady,true,'The next verified hydration reaches ready without a second claim');
 const denied=fixture({modernClaim:true,failVerification:true}),before=denied.storage.getItem('lumenProgressV1');await denied.hook();
 assert.equal(denied.storage.getItem('lumenProgressV1'),before);assert.equal(denied.storage.getItem('lumenCloudOwnerId'),null);assert.equal(denied.ctx.cloudProfileReady,false);
 console.log('Actual hydration: modern guest receipt, repeated auth, exact net balance and failed readback conservation passed');
}
{
 const f=fixture({modernClaim:true}),attempt={attemptId:'retained-guest-run',questId:1,mode:'campaign',state:'PAUSED',board:[[1,0],[0,0]],startedAt:123};
 const key='lumenActiveAttemptV1',raw=JSON.stringify(attempt);f.storage.setItem(key,raw);
 f.ctx.attemptEngine={storageKey:key,snapshot:()=>attempt};await f.hook();
 assert.equal(f.storage.getItem(key),raw,'Guest registration keeps the active run exactly');
 assert([...f.data].some(([k,v])=>k.startsWith('lumenBeforeAccountSwitchAttempt_')&&v===raw),'The previous verified guest-attempt archive guarantee also remains on registration');
 assert.equal(f.handoffs,0,'Registration does not navigate away from the preserved guest run');
}
{
 const f=fixture({advanceDuringHydration:true});await f.hook();
 assert.equal(JSON.parse(f.storage.getItem('lumenProgressV1')).solved[2],1,'An achievement earned during hydration is not replaced by the earlier guest capture');
 assert.equal(f.storage.getItem('lumenCloudOwnerId'),null,'A later guest achievement remains pending until covered by the server');
}
