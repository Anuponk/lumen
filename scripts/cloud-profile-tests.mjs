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
richer.setItem('lumenProgressV1',JSON.stringify({...source,shards:3,performances:{}}));
assert.equal(cloudSafelyCoversLocal({...source,shards:3,performances:{}},source),true);
const restored=restoreRicherCloudProfile(richer,source);
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
assert.equal(restoreRicherCloudProfile(richer,source).changed,false);

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
assert.ok(uiSrc.includes('compareAndSwapCloudProfile(lumenSupabase,current,cloudProfileBaseline)'),'Atomic background write wired');
assert.ok(uiSrc.includes('installCloudProfileLocally(localStorage,cloud)'),'Cloud overrides local after login');
assert.ok(uiSrc.includes('holdLegacyMergeForFullRestore:async()=>true'),'Legacy merges disabled');
assert.doesNotMatch(html,/id="migrationCloud(?:Save|Restore)"/);

assert.ok(uiSrc.includes('function accountRequired(){return !qaActive&&!socialChallenge&&((!!lumenUser&&!cloudProfileReady)||(!lumenUser&&solvedCount()>=5))}'),'Five quests are playable as guest, then account required');
assert.ok(uiSrc.includes('if(accountRequired()){maybeOfferAccount();hideSuccess();return}'),'Cannot advance beyond guest limit');
assert.ok(uiSrc.includes('if(accountRequired())queueMicrotask(()=>maybeOfferAccount())'),'Reload cannot bypass guest gate');
assert.ok(uiSrc.includes('if(accountRequired())return;'),'Account offer cannot be dismissed when required');

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
assert.equal(installCloudProfileLocally(localCloudStorage,guest),true);
assert.equal(JSON.parse(localCloudStorage.getItem('lumenProgressV1')).shards,6);
await assert.rejects(()=>compareAndSwapCloudProfile(cloudApi,{...guest,shards:7},{...guest,shards:100}),/Conflit/);
assert.equal((await compareAndSwapCloudProfile(cloudApi,{...guest,shards:7},guest)).shards,7);
assert.equal((await loadVerifiedProfile(cloudApi)).shards,7);

const staleBaseline=structuredClone(guest);
await assert.rejects(()=>compareAndSwapCloudProfile(cloudApi,{...guest,shards:9},staleBaseline),/Conflit/);
assert.equal((await loadVerifiedProfile(cloudApi)).shards,7,'Stale second device cannot overwrite first device rewards');
const noCloud={async rpc(name){if(name==='lumen_initialize_profile')return {data:null,error:{message:'offline'}};return {data:null,error:{message:'offline'}}}};
await assert.rejects(()=>initializeCloudProfile(noCloud,guest),/Initialisation cloud impossible/);

assert.ok(uiSrc.includes('async function celebrateSuccess()'),'Victory completion may await durable cloud acknowledgement');
assert.ok(uiSrc.includes('if(!(await confirmCloudReward()))return;'),'Authenticated victory waits for committed cloud snapshot');
assert.ok(uiSrc.includes('Ta victoire n\'est pas encore confirmée sur le cloud'),'Failed cloud write is visible and retryable');
