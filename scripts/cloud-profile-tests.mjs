import assert from 'node:assert/strict';
import {backupAndVerifyProfile,backupIfUnchanged,loadVerifiedProfile,sameCloudProfile,validateCloudProfile,restoreIntoEmptyGuestStorage,cloudSafelyCoversLocal,restoreRicherCloudProfile,reconcileCloudAchievements,initializeCloudProfile,compareAndSwapCloudProfile,installCloudProfileLocally} from '../src/persistence/cloud-profile.js';
const source={solved:{0:1,1:1},historyBackup:{0:1,1:1},badges:{0:{speed:true}},stars:{0:3},shards:7,daily:{dates:{"2026-10-09":1}},performances:{1:{bestTime:44}},xp:13};
let saved=null;
const fake={async rpc(method,args){
  if(method==='lumen_backup_profile'){saved=structuredClone(args.p_payload);return {error:null}}
  if(method==='lumen_restore_profile')return {data:saved,error:null};
  throw Error('Unexpected RPC: '+method)
}};
assert.equal((await backupAndVerifyProfile(fake,source)).solved,2);
assert.deepEqual(await loadVerifiedProfile(fake),source);
// A deferred UI auth event must not authorize profile work under a new token.
for(const action of [
 client=>loadVerifiedProfile(client,{userId:'expected-account'}),
 client=>initializeCloudProfile(client,source,{userId:'expected-account'}),
 client=>compareAndSwapCloudProfile(client,source,source,{userId:'expected-account'})
]){
 let guardedCalls=0;
 await assert.rejects(()=>action({rpc:async(method,args)=>{
  assert.equal(args.p_expected_user_id,'expected-account');guardedCalls++;
  return {error:{code:'42501',message:'private account detail'}};
 }}),error=>error.code==='42501'&&!error.message.includes('private account detail'));
 assert.equal(guardedCalls,1,'Account refusal cannot fall back to an unbound request');
}
assert.throws(()=>validateCloudProfile({solved:{}}),/Badges/);
await assert.rejects(()=>backupAndVerifyProfile({rpc:async()=>({error:{message:'network'}})},source),/refusée/);
await assert.rejects(()=>backupAndVerifyProfile({rpc:async method=>method==='lumen_backup_profile'?{error:null}:{data:{solved:{},badges:{}},error:null}},source),/non vérifiée/);
assert.equal(source.shards,7,'Local original untouched');
assert.ok(sameCloudProfile(source,structuredClone(source)));
await assert.rejects(()=>backupIfUnchanged(fake,{...source,shards:8},{...source,shards:6}),/modifiée/);
assert.equal(saved.shards,7,'Conflicting client must not overwrite cloud');
const guarded=await backupIfUnchanged(fake,{...source,shards:8},source);
assert.equal(guarded.shards,8,'Matching baseline can save');
assert.equal(saved.shards,8);

console.log('Cloud profile backup validation and read-back tests passed');

const storage=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))}};
const fresh=storage();assert.equal(restoreIntoEmptyGuestStorage(fresh,source).solved,2);
assert.deepEqual(JSON.parse(fresh.getItem('lumenProgressV1')),source);
assert.throws(()=>restoreIntoEmptyGuestStorage(fresh,source),/Progression déjà présente/);
const occupied=storage();occupied.setItem('lumenProgressV1',JSON.stringify({solved:{0:1},badges:{}}));
assert.throws(()=>restoreIntoEmptyGuestStorage(occupied,source),/Progression déjà présente/);
assert.equal(JSON.parse(occupied.getItem('lumenProgressV1')).solved[0],1);
const corrupt=storage();corrupt.setItem('lumenProgressV1','{not-json');
assert.throws(()=>restoreIntoEmptyGuestStorage(corrupt,source),/illisible/);

const richer=storage();
const walletSource={...source,walletRevision:2};
richer.setItem('lumenProgressV1',JSON.stringify({...source,shards:3,walletRevision:1,performances:{}}));
assert.equal(cloudSafelyCoversLocal({...source,shards:3,walletRevision:1,performances:{}},walletSource),true);
const restored=restoreRicherCloudProfile(richer,walletSource);
assert.equal(restored.changed,true);
assert.equal(JSON.parse(richer.getItem('lumenProgressV1')).shards,7);
assert.ok(richer.getItem(restored.backupKey),'original local profile backed up');
const divergent=storage();
divergent.setItem('lumenProgressV1',JSON.stringify({...source,shards:100}));
assert.throws(()=>restoreRicherCloudProfile(divergent,source),/divergent/);
assert.equal(JSON.parse(divergent.getItem('lumenProgressV1')).shards,100);
const newerBadge=storage();
newerBadge.setItem('lumenProgressV1',JSON.stringify({...source,badges:{unique:1}}));
assert.throws(()=>restoreRicherCloudProfile(newerBadge,source),/divergent/);
assert.throws(()=>restoreRicherCloudProfile(richer,source),/divergent/,'An old profile cannot drop the authoritative wallet cursor');

const conflictingLocal={solved:{127:1,128:1,130:1},badges:{first:1},shards:4,xp:45,performances:{127:{badges:{speed:false},bestTime:72}}};
const conflictingRemote={solved:{127:1,128:1},badges:{first:1},shards:13,xp:31,performances:{127:{badges:{speed:true,mastery:true,noError:true,autonomy:true},bestTime:51},128:{badges:{speed:true,mastery:true,noError:true,autonomy:true}}}};
const localStorageReconcile=storage();
localStorageReconcile.setItem('lumenProgressV1',JSON.stringify(conflictingLocal));
const reconcileResult=reconcileCloudAchievements(localStorageReconcile,conflictingRemote);
const reconciled=JSON.parse(localStorageReconcile.getItem('lumenProgressV1'));
assert.equal(reconcileResult.changed,true);
assert.equal(reconcileResult.currencyConflict,true);
assert.equal(reconciled.shards,4,'Never change mutable shard balance');
assert.equal(reconciled.xp,45,'Never change XP balance');
assert.equal(reconciled.solved[130],1,'Never lose locally solved quests');
assert.equal(reconciled.performances[127].badges.mastery,true,'Restore missing cloud badge');
assert.equal(reconciled.performances[128].badges.speed,true,'Restore cloud-only performance');
assert.equal(reconciled.performances[127].bestTime,51,'Preserve better performance');
assert.equal(JSON.parse(localStorageReconcile.getItem(reconcileResult.backupKey)).shards,4,'Backup created');
assert.equal(reconcileCloudAchievements(localStorageReconcile,conflictingRemote).changed,false,'Reconcile is idempotent');

const cloudSrc=(await import('node:fs')).readFileSync(new URL('../src/persistence/cloud.js',import.meta.url),'utf8');
const uiSrc=(await import('node:fs')).readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const html=(await import('node:fs')).readFileSync(new URL('../index.html',import.meta.url),'utf8');
assert.equal(cloudSrc.split('hooks.afterAuthCloudSync?.()').length-1,2,'Cloud sync must run after both session and sign-in auth flows');
assert.ok(uiSrc.includes('afterAuthCloudSync:async'),'Auth hook is wired');
assert.ok(uiSrc.includes('compareAndSwapCloudProfile(savingCloudClient,current,cloudProfileBaseline,{userId:savingUserId})'),'Atomic background write binds the expected account');
assert.ok(uiSrc.includes('installCloudProfileLocally(localStorage,cloud)'),'Cloud overrides local after login');
assert.ok(uiSrc.includes('holdLegacyMergeForFullRestore:async()=>true'),'Legacy merges disabled');
assert.doesNotMatch(html,/id="migrationCloud(?:Save|Restore)"/);

assert.match(uiSrc,/function accountRequired\(\)\s*\{[\s\S]*?authSessionPending\|\|qaActive\|\|socialChallenge\|\|lumenUser/,'Guest invitation is optional and waits for auth resolution');
// #522 intentional product change: six visible discovery quests, then account.
// Dismissal still preserves every acquired reward; it opens the sky, not quest 7.
const {functionSource}=await import('./source-tools.mjs');
const vm=await import('node:vm');
const copy=JSON.stringify(source),box={hidden:false};
const ctx={accountOfferResumeNext:true,lumenProgress:source,document:{getElementById:()=>box},trackLumenEvent(){},solvedCount:()=>6,qaActive:false,openJourneyMap(){ctx.opened=true}};
vm.createContext(ctx);vm.runInContext(functionSource(uiSrc,'dismissAccountOffer'),ctx);ctx.dismissAccountOffer();
assert.equal(JSON.stringify(source),copy,'Dismissal preserves progression');assert.equal(ctx.opened,true);assert.equal(box.hidden,true);assert.equal(ctx.accountOfferResumeNext,false);
assert.ok(uiSrc.includes('following?.ordinal>QUEST_MILESTONES.discovery&&accountRequired()&&maybeOfferAccount()'),'Only continuation beyond discovery triggers the account gate');
assert.ok(uiSrc.includes('if(!canonicalActiveQuest&&accountRequired())queueMicrotask(()=>maybeOfferAccount())'),'Account gate survives reload');
assert.ok(uiSrc.includes('const accountLater=document.getElementById("accountOptinLater")'),'Continue without account is wired');
assert.ok(uiSrc.includes('if(closeAccount)closeAccount.onclick=dismissAccountOffer'),'Close button dismisses the account invitation');
assert.ok(html.includes('id="accountOptinLater"'),'Guest has an explicit continue option');

let server=null;
const cloudApi={async rpc(name,args){
 if(name==="lumen_initialize_profile"){server??=structuredClone(args.p_payload);return {data:structuredClone(server),error:null};}
 if(name==="lumen_restore_profile")return {data:structuredClone(server),error:null};
 if(name==="lumen_cas_profile"){
  if(!sameCloudProfile(server,args.p_expected))return {data:false,error:null};
  server=structuredClone(args.p_payload);return {data:true,error:null};
 }
 throw Error(name);
}};
const guest={solved:{0:1,1:1,2:1,3:1,4:1},badges:{first:1},shards:6};
assert.deepEqual(await initializeCloudProfile(cloudApi,guest),guest);
assert.equal((await initializeCloudProfile(cloudApi,{...guest,shards:100})).shards,6,'Existing cloud always wins');
const localCloudStorage=storage();
localCloudStorage.setItem('lumenProgressV1',JSON.stringify({...guest,shards:100}));
assert.throws(()=>installCloudProfileLocally(localCloudStorage,guest),/Profil local divergent/,'Higher local currency must not be silently overwritten');
assert.equal(JSON.parse(localCloudStorage.getItem('lumenProgressV1')).shards,100,'Blocked restore preserves local currency');
await assert.rejects(()=>compareAndSwapCloudProfile(cloudApi,{...guest,shards:7},{...guest,shards:100}),/Conflit/);
assert.equal((await compareAndSwapCloudProfile(cloudApi,{...guest,shards:7},guest)).shards,7);
assert.equal((await loadVerifiedProfile(cloudApi)).shards,7);

const staleBaseline=structuredClone(guest);
await assert.rejects(()=>compareAndSwapCloudProfile(cloudApi,{...guest,shards:9},staleBaseline),/Conflit/);
assert.equal((await loadVerifiedProfile(cloudApi)).shards,7,'Stale second device cannot overwrite first device rewards');
const noCloud={async rpc(name){if(name==='lumen_initialize_profile')return {data:null,error:{message:'offline'}};return {data:null,error:{message:'offline'}}}};
await assert.rejects(()=>initializeCloudProfile(noCloud,guest),/Initialisation cloud impossible/);

// Secondary progress mirror must be acknowledged, not silently ignored.
assert.ok(uiSrc.includes('legacy_mirror_failed'),'Mirror divergence must be observable');
assert.ok(uiSrc.includes('legacyMirrorVerified:mirror.ok'),'Hydration diagnostics must report mirror verification');
assert.ok(uiSrc.includes('await verifyLegacyProgressMirror()'),'Cloud save must verify the secondary progress table');
assert.ok(uiSrc.includes('preserveUnsyncedCloudProgress("legacy-mirror-failed")'),'Failed mirror must retain local recovery data');
assert.ok(uiSrc.includes('async function celebrateSuccess()'),'Victory completion may await durable cloud acknowledgement');
assert.ok(uiSrc.includes('if(!(await confirmCloudReward()))return;'),'Authenticated victory waits for committed cloud snapshot');
assert.ok(uiSrc.includes("textContent='Réessayer'"),'Persistent cloud failure retains an actionable retry');
assert.ok(uiSrc.includes("retryable:cloudProfileFailure?.reason!=='conflict'"),'A cloud conflict must be distinguished from a transient failure');
assert.ok(uiSrc.includes('const syncPresentation=createSyncPresentation'),'Transient and critical presentation follow explicit state');
assert.ok(uiSrc.includes('if(box)box.hidden=true'),'Successful Google login must not reopen the account offer');

assert.ok(uiSrc.includes('if(wasVisible)showAccountSavedConfirmation()'),'Cloud-save confirmation only after verified profile');
assert.doesNotMatch(uiSrc,/account_signin_success[^\n]*showAccountSavedConfirmation/,'OAuth completion alone must not claim cloud backup succeeded');

{
 const cloudBase={solved:{0:1,197:1,295:1},badges:{197:{speed:true}},performances:{197:{badges:{speed:true},bestTime:44}},stars:{197:3},xp:160,shards:9};
 const extended={...cloudBase,solved:{...cloudBase.solved,296:1,320:1},badges:{...cloudBase.badges,320:{mastery:true}},performances:{...cloudBase.performances,320:{badges:{mastery:true},bestTime:55}},stars:{...cloudBase.stars,320:3},xp:180};
 const fakeStore=new Map();
 const rpc={async rpc(method,args){
  if(method==="lumen_initialize_profile"){if(!fakeStore.has("cloud"))fakeStore.set("cloud",structuredClone(args.p_payload));return {data:structuredClone(fakeStore.get("cloud")),error:null}}
  if(method==="lumen_restore_profile")return {data:structuredClone(fakeStore.get("cloud")),error:null};
  if(method==="lumen_cas_profile"){if(!sameCloudProfile(fakeStore.get("cloud"),args.p_expected))return {data:false,error:null};fakeStore.set("cloud",structuredClone(args.p_payload));return {data:true,error:null}}
  throw Error("unexpected RPC "+method)
 }};
 const initial=await initializeCloudProfile(rpc,cloudBase);
 assert.equal(initial.solved[295],1);
 const applied=await compareAndSwapCloudProfile(rpc,extended,initial);
 assert.equal(applied.solved[320],1);
 const after=await initializeCloudProfile(rpc,cloudBase);
 assert.equal(after.solved[320],1,"existing account must not truncate appended quests");
 assert.equal(after.performances[320].badges.mastery,true);
 assert.equal(after.stars[320],3);
 assert.equal(after.shards,9);
 const secondDevice=storage();
 secondDevice.setItem("lumenProgressV1",JSON.stringify(cloudBase));
 installCloudProfileLocally(secondDevice,after);
 const restored=JSON.parse(secondDevice.getItem("lumenProgressV1"));
 assert.equal(restored.solved[320],1);
 assert.equal(restored.badges[320].mastery,true);
 assert.equal(restored.performances[320].bestTime,55);
 await assert.rejects(()=>compareAndSwapCloudProfile(rpc,cloudBase,initial),/conflit|modifi|stale|simultan|refus|sauvegarde/i);
}

// Regression: secondary progress mirror must repair missing quests and verify readback.
{
 const {createCloudPersistence}=await import('../src/persistence/cloud.js');
 const solved={0:1,1:1,2:1};let server=new Set([1]);let failWrite=false;
 const api={rpc:async(method,args)=>{
  if(method==='lumen_get_progress')return {data:[...server].map(puzzle_id=>({puzzle_id})),error:null};
  if(method==='lumen_save_progress'){
   if(failWrite)return {data:null,error:{message:'offline'}};
   server.add(args.p_puzzle_id);return {data:null,error:null};
  }
  throw Error('Unexpected mirror RPC '+method);
 }};
 const model={lumenSupabase:api,lumenUser:{id:'test'},lumenProgress:{solved,noHint:{}},usedHintThisGame:false};
 const hooks={activeGameSeconds:()=>12,campaignQuestCount:()=>10,saveLumenProgress:()=>{},refreshJourney:()=>{},init:()=>{}};
 const persistence=createCloudPersistence(model,hooks,{setTimeout,console,qaMode:false});
 assert.deepEqual(await persistence.verifyLegacyProgressMirror(),{ok:true,count:3});
 assert.deepEqual([...server].sort((a,b)=>a-b),[1,2,3]);
 server=new Set([1]);failWrite=true;
 assert.equal((await persistence.verifyLegacyProgressMirror()).ok,false,'Failed mirror write must not be treated as success');
 assert.equal((await persistence.cloudSavePuzzle(2)).ok,false,'Individual quest save failure must be reported');
 failWrite=false;
 assert.equal((await persistence.cloudSavePuzzle(2)).ok,true,'Individual quest save must be read-back verified');
}

// Multi-device reward conflict: merge monotonic awards and best times,
// preserve original snapshots, reject contradictory immutable run evidence.
{
 const {reconcileCompatibleCloudProfiles}=await import('../src/persistence/cloud-profile.js');
 const remote={solved:{0:1},historyBackup:{0:1},noHint:{},badges:{0:{speed:true,mastery:false}},stars:{0:1},performances:{0:{bestTime:60,badges:{speed:true}}},canonicalQuestState:{},daily:{},challenges:{},shards:3,xp:10,skyScore:2};
 const local=structuredClone(remote);local.badges[0]={speed:true,mastery:true};local.performances[0]={bestTime:42,badges:{speed:true,mastery:true}};
 const records=new Map([['lumenProgressV1',JSON.stringify(local)]]);
 const store={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,String(value))};
 let cloud=structuredClone(remote);
 const rpc={rpc:async(method,args)=>{
  if(method==='lumen_restore_profile')return {data:structuredClone(cloud),error:null};
  if(method==='lumen_cas_profile'){
   if(!sameCloudProfile(cloud,args.p_expected))throw Error('Fixture CAS baseline differs');
   cloud=structuredClone(args.p_payload);return {data:true,error:null};
  }
  throw Error('Unexpected reward reconciliation RPC '+method);
 }};
 const result=await reconcileCompatibleCloudProfiles(rpc,store,remote);
 assert.equal(result.status,'reconciled');
 assert.equal(cloud.badges[0].mastery,true);
 assert.equal(cloud.performances[0].bestTime,42);
 assert.equal(cloud.performances[0].badges.mastery,true);
 assert.ok([...records.keys()].some(key=>key.startsWith('lumenBeforeCloudReconcileLocal_')));
 assert.ok([...records.keys()].some(key=>key.startsWith('lumenBeforeCloudReconcileRemote_')));
 const contradictory=structuredClone(local);contradictory.performances[0].run={duration:42};
 cloud.performances[0].run={duration:55};
 records.set('lumenProgressV1',JSON.stringify(contradictory));
 const refused=await reconcileCompatibleCloudProfiles(rpc,store,structuredClone(cloud));
 assert.equal(refused.status,'blocked');
 assert.equal(refused.reason,'reward_conflict');
}

// A server refusal must remain diagnosable without exposing provider text or a save.
for(const [message,code,expected] of [
 ['legacy victory command required; preserve pending data and update client','22023','LEGACY_COMMAND_REQUIRED'],
 ['earned XP cannot decrease','22023','LEGACY_XP_REGRESSION'],
 ['canonical acquisition removal rejected','23514','CANONICAL_ACQUISITION_REMOVAL'],
 ['canonical badge removal rejected','23514','CANONICAL_BADGE_REMOVAL'],
 ['invalid canonical snapshot','23514','INVALID_CANONICAL_SNAPSHOT'],
 ['Catalogue origin cannot be erased or rewritten','23514','CATALOGUE_ORIGIN_REWRITE'],
 ['Catalogue origin disagrees with existing cohort','23514','CATALOGUE_ORIGIN_CONFLICT'],
 ['Unsupported catalogue origin','22023','UNSUPPORTED_CATALOGUE_ORIGIN'],
 ['provider message containing fixture-private-data','42501','42501'],
 ['provider message containing fixture-private-data','PGRST202','PGRST202'],
 ['provider message containing fixture-private-data','token-fixture-private-data','CLOUD_WRITE_REFUSED']
]){
 let calls=0;
 const rejected={rpc:async()=>{calls++;return {data:null,error:{message,code,details:'fixture-private-data',hint:'fixture-private-data'}}}};
 await assert.rejects(compareAndSwapCloudProfile(rejected,guest,guest),error=>{
  assert.equal(error.code,expected);assert.match(error.message,/^Sauvegarde cloud impossible/);
  assert(!JSON.stringify({message:error.message,...error}).includes('fixture-private-data'));
  assert.equal(error.details,undefined);assert.equal(error.hint,undefined);assert.equal(error.cause,undefined);
  return true;
 });
 assert.equal(calls,1,'No retry or fallback write after a refused snapshot');
}
await assert.rejects(compareAndSwapCloudProfile({rpc:async()=>({data:false})},guest,guest),error=>error.code==='CLOUD_CAS_CONFLICT');
console.log('Safe cloud write diagnostics distinguish authority refusals, provider codes and stale CAS without raw error details');
