import assert from 'node:assert/strict';
import {reconcileCompatibleCloudProfiles,cloudSafelyCoversLocal,reconcileDominantLocalProfile,sameCloudProfile} from '../src/persistence/cloud-profile.js';
import {badgeCooldownRemaining,BADGE_COOLDOWN_MS} from '../src/campaign/performance.js';

const oldAt='2026-10-17T23:59:00.000Z',newAt='2026-10-18T03:33:00.000Z';
const performance={version:3,questIndex:183,badges:{speed:true,mastery:true},attempts:2,bestTime:42,time:42};
const profile=metadata=>({solved:{183:1},historyBackup:{183:1},noHint:{},badges:{183:1},stars:{183:3},
 performances:{183:{...structuredClone(performance),...metadata}},canonicalQuestState:{},
 shards:5,xp:7,skyScore:3,daily:{},challenges:{},legacyAdventureAccess:['earned-adventure']});
function fixture(left,right,{race=false,failRead=false}={}){
 const local=profile(left),original=profile(right);
 let remote=structuredClone(original),writes=0;
 const map=new Map([['lumenProgressV1',JSON.stringify(local)]]);
 const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value))};
 const api={async rpc(name,args){
  if(name==='lumen_cas_profile'){
   assert([...map.keys()].some(key=>key.startsWith('lumenBeforeCloudReconcileLocal_')));
   assert([...map.keys()].some(key=>key.startsWith('lumenBeforeCloudReconcileRemote_')));
   if(race||!sameCloudProfile(remote,args.p_expected))return {data:false,error:null};
   remote=structuredClone(args.p_payload);writes++;return {data:true,error:null};
  }
  if(name==='lumen_restore_profile')return failRead?{data:null,error:{message:'offline'}}:{data:structuredClone(remote),error:null};
  throw Error(name);
 }};
 return {local,original,map,storage,api,get remote(){return remote},get writes(){return writes}};
}
const old={lastQualifiedAt:oldAt,lastQualifiedDay:'2026-10-18'};
const recent={lastQualifiedAt:newAt,lastQualifiedDay:'2026-10-18'};

// savePerformance writes cumulative summaries, not immutable run receipts.
// V2 badges remain earned under V3; a replay also updates attempts and stars.
for(const reverse of [false,true]){
 const v2={version:2,attempts:2,stars:1,bestTime:65,time:65,badges:{autonomy:true,mastery:true},lastQualifiedDay:'2026-10-17'};
 const v3={version:3,attempts:4,stars:2,bestTime:40,time:40,badges:{speed:true,noError:true},...recent};
 const f=fixture(...(reverse?[v3,v2]:[v2,v3]));
 const raw=f.map.get('lumenProgressV1'),result=await reconcileCompatibleCloudProfiles(f.api,f.storage,f.original);
 assert(['reconciled','cloud_dominant'].includes(result.status),'Known performance summary versions must reconcile');
 const saved=result.profile.performances[183];
 assert.equal(saved.version,3);assert.equal(saved.attempts,4);assert.equal(saved.stars,2);
 assert.equal(saved.bestTime,40);assert.equal(saved.time,40);
 assert.deepEqual(saved.badges,{autonomy:true,mastery:true,speed:true,noError:true});
 assert.equal(saved.lastQualifiedAt,newAt);
 assert.equal(result.profile.shards,5);assert.equal(result.profile.xp,7);assert.equal(result.profile.skyScore,3);
 assert.equal(f.map.get('lumenProgressV1'),raw);
 assert.equal(cloudSafelyCoversLocal(f.local,result.profile),true);
 assert.equal((await reconcileCompatibleCloudProfiles(f.api,f.storage,result.profile)).status,'cloud_dominant');
}
for(const version of [2,3]){
 for(const reverse of [false,true]){
  const f=fixture(...(reverse?[{version,attempts:8,stars:2},{version,attempts:3,stars:1}]:[{version,attempts:3,stars:1},{version,attempts:8,stars:2}]));
  const result=await reconcileCompatibleCloudProfiles(f.api,f.storage,f.original);
  assert(['reconciled','cloud_dominant'].includes(result.status));
  assert.equal(result.profile.performances[183].attempts,8,'Do not sum snapshots of overlapping attempts');
  assert.equal(result.profile.performances[183].stars,2);
 }
}
for(const [newer,older] of [[{version:3},{version:2}],[{attempts:3},{attempts:2}],[{stars:2},{stars:1}]]){
 assert.equal(cloudSafelyCoversLocal(profile(newer),profile(older)),false,'A stale restore must not downgrade summary metadata');
 assert.equal(cloudSafelyCoversLocal(profile(older),profile(newer)),true);
}
// Upgrading a schema cannot invent same-run mastery from separate badges.
{
 const f=fixture({version:2,badges:{autonomy:true}}, {version:3,badges:{speed:true,noError:true}});
 const result=await reconcileCompatibleCloudProfiles(f.api,f.storage,f.original);
 assert(['reconciled','cloud_dominant'].includes(result.status));
 assert.equal(!!result.profile.performances[183].badges.mastery,false);
}
for(const metadata of [{version:1},{version:4},{version:'3'},{version:null},{attempts:-1},{attempts:1.5},{stars:-1},{stars:'2'}]){
 for(const reverse of [false,true]){
  const f=fixture(...(reverse?[{version:3,attempts:2,stars:1},{version:2,attempts:2,stars:1,...metadata}]:[{version:2,attempts:2,stars:1,...metadata},{version:3,attempts:2,stars:1}]));
  const result=await reconcileCompatibleCloudProfiles(f.api,f.storage,f.original);
  assert.equal(result.status,'blocked');assert.equal(f.writes,0);
 }
}

// Reproduce the reported quest 183 conflict; merging either device order is safe.
for(const [left,right] of [[recent,old],[old,recent]]){
 const f=fixture(left,right),raw=f.map.get('lumenProgressV1');
 const result=await reconcileCompatibleCloudProfiles(f.api,f.storage,f.original);
 assert(['reconciled','cloud_dominant'].includes(result.status));
 assert.deepEqual(result.profile,profile(recent));
 assert.equal(badgeCooldownRemaining(result.profile.performances[183],Date.parse(newAt)+60000),BADGE_COOLDOWN_MS-60000);
 assert.equal(f.map.get('lumenProgressV1'),raw,'Do not install local state before verified hydration');
 assert.equal(cloudSafelyCoversLocal(f.local,result.profile),true);
 const writes=f.writes;
 assert.equal((await reconcileCompatibleCloudProfiles(f.api,f.storage,result.profile)).status,'cloud_dominant');
 assert.equal(f.writes,writes,'Retries do not replay rewards or write the same profile again');
 if(writes){
  assert([...f.map.entries()].some(([key,value])=>key.startsWith('lumenBeforeCloudReconcileLocal_')&&value===raw));
  assert([...f.map.entries()].some(([key,value])=>key.startsWith('lumenBeforeCloudReconcileRemote_')&&sameCloudProfile(JSON.parse(value),f.original)));
 }
}
assert.equal(cloudSafelyCoversLocal(profile(recent),profile(old)),false,'Stale cloud cannot reset cooldown');
assert.equal(cloudSafelyCoversLocal(profile(old),profile(recent)),true);

// The dominant-local path must also reject overwriting a newer remote cooldown.
{
 const f=fixture(old,recent);
 assert.equal((await reconcileDominantLocalProfile(f.api,f.storage,f.original)).reason,'missing_cloud_achievements');
 assert.equal(f.writes,0);
}
// Midnight, legacy records, absent/null metadata, offsets and equal instants.
const cases=[
 [{lastQualifiedAt:oldAt,lastQualifiedDay:'2026-10-17'},recent,recent],
 [{lastQualifiedAt:null,lastQualifiedDay:'2026-10-17'},recent,recent],
 [{},recent,recent],
 [{lastQualifiedDay:'2026-10-17'},{lastQualifiedDay:'2026-10-18'},{lastQualifiedDay:'2026-10-18'}],
 [{lastQualifiedDay:'2026-10-17'},{lastQualifiedAt:newAt},{lastQualifiedAt:newAt,lastQualifiedDay:null}],
 [{lastQualifiedAt:'2026-10-18T05:33:00+02:00'},recent,recent]
];
for(const [a,b,expected] of cases){
 for(const [left,right] of [[a,b],[b,a]]){
  const f=fixture(left,right),result=await reconcileCompatibleCloudProfiles(f.api,f.storage,f.original);
  assert(['reconciled','cloud_dominant'].includes(result.status));
  assert.deepEqual(result.profile.performances[183],{...performance,...expected});
 }
}
for(const bad of [{lastQualifiedAt:'invalid'},{lastQualifiedAt:123},{lastQualifiedAt:'2026-10-18'},
 {lastQualifiedAt:'2026-02-30T03:33:00.000Z'},
 {lastQualifiedDay:'2026-02-30'},{lastQualifiedDay:123},
 {run:{duration:42}},{rewardReceipt:'local-receipt'},{attempts:-1}]){
 for(const reverse of [false,true]){
  const left={...old,...bad},right={...recent,run:{duration:55},rewardReceipt:'cloud-receipt'};
  const f=fixture(...(reverse?[right,left]:[left,right]));
  const result=await reconcileCompatibleCloudProfiles(f.api,f.storage,f.original);
  assert.equal(result.status,'blocked');assert.equal(result.reason,'reward_conflict');
  assert.equal(f.writes,0);assert.deepEqual(f.remote,f.original);
 }
}
for(const options of [{race:true},{failRead:true}]){
 const f=fixture(recent,old,options),raw=f.map.get('lumenProgressV1');
 await assert.rejects(reconcileCompatibleCloudProfiles(f.api,f.storage,f.original));
 assert.equal(f.map.get('lumenProgressV1'),raw);
 assert([...f.map.values()].includes(raw),'Recovery copies survive a failed CAS/read-back');
}
// Restart after a successful CAS whose read-back was lost: recover through a
// fresh storage adapter, without replaying the write or minting any reward.
{
 const f=fixture(recent,old,{failRead:true});
 const original=f.map.get('lumenProgressV1');
 await assert.rejects(reconcileCompatibleCloudProfiles(f.api,f.storage,f.original));
 assert.equal(f.writes,1,'CAS committed before the read-back failed');
 assert.equal(f.map.get('lumenProgressV1'),original);
 const restartedMap=new Map(JSON.parse(JSON.stringify([...f.map])));
 const storage={getItem:key=>restartedMap.get(key)??null,setItem:(key,value)=>restartedMap.set(key,String(value))};
 let retries=0;
 const api={async rpc(name){
  if(name==='lumen_restore_profile')return {data:structuredClone(f.remote),error:null};
  retries++;throw Error('An already committed profile must not be written again');
 }};
 const restored=await reconcileCompatibleCloudProfiles(api,storage,structuredClone(f.remote));
 assert.equal(restored.status,'cloud_dominant');
 assert.deepEqual(restored.profile,profile(recent));
 assert.equal(retries,0);
 assert.equal(restartedMap.get('lumenProgressV1'),original,'Only verified hydration may install local state');
 assert([...restartedMap.values()].includes(original),'Restart retains recovery evidence');
}
console.log('Performance reconciliation: V2/V3 summaries, conservative counters, no invented mastery/rewards, stale restore protection, latest cooldown, both device orders, legacy restore, idempotency, backups, CAS and restart after lost read-back passed');
