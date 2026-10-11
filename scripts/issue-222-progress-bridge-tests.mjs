import assert from "node:assert/strict";
import {canonicalQuestList,canonicalQuestById} from "../src/campaign/canonical-quests.js";
import {cloudSafelyCoversLocal,reconcileCloudAchievements} from "../src/persistence/cloud-profile.js";
import {CANONICAL_PROGRESS_VERSION,questIsCompleted,canonicalCompletionCount,firstIncompleteCanonicalQuest,acknowledgeCanonicalVictory,canonicalQuestForDisplay,commitCanonicalVictory} from "../src/persistence/canonical-progress.js";

assert.equal(CANONICAL_PROGRESS_VERSION,1);
const all=canonicalQuestList(),newQuest=all.find(q=>q.legacyIndex===null);
assert(newQuest);
const original={solved:{"0":true,"78":true,"195":true,"295":true},badges:{"295":{mastery:true}},stars:{"295":3},shards:12,xp:321,entitlements:["real-adventure-04"],otherFutureField:{a:1}};
const backup=structuredClone(original);
assert.equal(questIsCompleted(original,"base-q001"),true);
assert.equal(questIsCompleted(original,newQuest.id),false);
assert.equal(canonicalCompletionCount(original),4);
const done=acknowledgeCanonicalVictory(original,newQuest.id,{badges:{mastery:true},performance:{bestTime:41},stars:3});
assert.equal(done.newlyCompleted,true);
assert.deepEqual(original,backup,"Pure write must not touch authenticated cloud baseline");
assert.equal(questIsCompleted(done.profile,newQuest.id),true);
assert.equal(canonicalCompletionCount(done.profile),5);
assert.deepEqual(done.profile.solved,original.solved,"Never rekey numeric historic saves");
assert.deepEqual(done.profile.badges,original.badges);
assert.equal(done.profile.shards,12);
assert.deepEqual(done.profile.entitlements,original.entitlements);
assert.equal(done.profile.canonicalQuestState[newQuest.id].performance.bestTime,41);
const twice=acknowledgeCanonicalVictory(done.profile,newQuest.id,{stars:300});
assert.equal(twice.newlyCompleted,false,"Retry must not duplicate stable quest awards");
assert.deepEqual(twice.profile,done.profile);
assert.throws(()=>acknowledgeCanonicalVictory(original,"base-q001"),/Historic quests/);
assert.throws(()=>acknowledgeCanonicalVictory(original,"not-a-quest"),/Unknown quest/);
assert.throws(()=>canonicalCompletionCount({...original,canonicalQuestState:{"unknown":{solved:true}}}),/Unknown stable quest/);
assert.throws(()=>canonicalCompletionCount({...original,canonicalQuestState:{"base-q001":{solved:true}}}),/Historic quest/);
assert.equal(canonicalQuestForDisplay(newQuest.ordinal).questId,newQuest.id);
assert.equal(canonicalQuestById(canonicalQuestForDisplay(1).questId).legacyIndex,0);
assert.equal(firstIncompleteCanonicalQuest(original).ordinal,2);
const completedAllLegacy=Object.fromEntries(all.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,true]));
const firstNew=firstIncompleteCanonicalQuest({solved:completedAllLegacy});
assert.equal(firstNew.id,all.find(q=>q.legacyIndex===null).id);
console.log("Canonical progress bridge preserved old cloud keys, stable-ID writes and idempotent victories");

// Cloud restore / reconciliation tests: do not drop or double-credit new quests.
const remoteProfile={...structuredClone(original),canonicalQuestState:structuredClone(done.profile.canonicalQuestState)};
assert.equal(cloudSafelyCoversLocal(remoteProfile,original),false,"Stale cloud snapshots cannot replace canonical victories");
assert.equal(cloudSafelyCoversLocal(original,remoteProfile),true,"Richer remote profiles may be restored");
const store=new Map([["lumenProgressV1",JSON.stringify(original)]]);
const storage={getItem:key=>store.get(key)??null,setItem:(key,val)=>store.set(key,val)};
const reconciled=reconcileCloudAchievements(storage,remoteProfile);
assert.equal(reconciled.changed,true);
assert.deepEqual(JSON.parse(store.get("lumenProgressV1")).canonicalQuestState,done.profile.canonicalQuestState);
assert.equal(reconcileCloudAchievements(storage,remoteProfile).changed,false,"Same cloud victory must not award twice");
assert.throws(()=>reconcileCloudAchievements(storage,{...remoteProfile,canonicalQuestState:{[newQuest.id]:{solved:true,stars:999}}}),/Conflit de récompense/);
assert.equal(JSON.parse(store.get("lumenProgressV1")).canonicalQuestState[newQuest.id].stars,3,"Conflicting remote payload must not overwrite local rewards");

// Real RPC contract simulation: CAS, read-back and idempotent cross-device retry.
{
 let persisted=structuredClone(original),casCalls=0;
 const cloud={rpc:async(name,args)=>{
  if(name==="lumen_restore_profile")return {data:structuredClone(persisted),error:null};
  if(name==="lumen_cas_profile"){
   casCalls++;
   if(JSON.stringify(args.p_expected)!==JSON.stringify(persisted))return {data:false,error:null};
   persisted=structuredClone(args.p_payload);return {data:true,error:null};
  }
  throw Error("Unexpected RPC "+name);
 }};
 const first=await commitCanonicalVictory(cloud,newQuest.id,{stars:3,badges:{mastery:true}});
 assert.equal(first.newlyCompleted,true);
 assert.equal(!!persisted.canonicalQuestState[newQuest.id]?.solved,true);
 assert.equal(casCalls,1);
 const second=await commitCanonicalVictory(cloud,newQuest.id,{stars:300});
 assert.equal(second.newlyCompleted,false);
 assert.equal(second.alreadySaved,true);
 assert.equal(casCalls,1,"No second CAS when already completed");
 assert.equal(persisted.canonicalQuestState[newQuest.id].stars,3);
 assert.deepEqual(persisted.solved,original.solved);
}
