import assert from "node:assert/strict";
import {canonicalQuestList} from "../src/campaign/canonical-quests.js";
import {commitCanonicalVictory} from "../src/persistence/canonical-progress.js";
import {sameCloudProfile} from "../src/persistence/cloud-profile.js";

const quest=canonicalQuestList().find(q=>q.legacyIndex===null);
assert.ok(quest,"catalogue has a new canonical quest");
const baseline={solved:{},historyBackup:{},badges:{},stars:{},performances:{},canonicalQuestState:{},xp:0,shards:0,skyScore:0,daily:{},challenges:{}};
const reward={stars:1,badges:{autonomy:true}};
function harness({commitThenDrop=false,alwaysReject=false}={}){
 let cloud=structuredClone(baseline),writes=0,reads=0;
 const supabase={async rpc(name,args){
  if(name==="lumen_restore_profile"){reads++;return {data:structuredClone(cloud),error:null}}
  if(name==="lumen_cas_profile"){
   if(alwaysReject)return {data:false,error:{message:"offline"}};
   if(!sameCloudProfile(cloud,args.p_expected))return {data:false,error:null};
   cloud=structuredClone(args.p_payload);writes++;
   if(commitThenDrop){commitThenDrop=false;return {data:null,error:{message:"network response lost"}}}
   return {data:true,error:null};
  }
  throw Error(name);
 }};
 return {supabase,get cloud(){return cloud},get writes(){return writes},get reads(){return reads}};
}
{
 const h=harness({commitThenDrop:true});
 const result=await commitCanonicalVictory(h.supabase,quest.id,reward);
 assert.equal(result.alreadySaved,true,"lost response reconciled with committed quest");
 assert.equal(h.writes,1,"reward written once");
 assert.equal(h.cloud.xp,15,"autonomy XP applied once");
 const replay=await commitCanonicalVictory(h.supabase,quest.id,reward);
 assert.equal(replay.alreadySaved,true);
 assert.equal(h.writes,1,"retry does not double credit");
}
{
 const h=harness();
 const result=await commitCanonicalVictory(h.supabase,quest.id,reward);
 assert.equal(result.newlyCompleted,true);
 assert.equal(h.writes,1);
}
{
 const h=harness({alwaysReject:true});
 await assert.rejects(commitCanonicalVictory(h.supabase,quest.id,reward,{maxAttempts:2}),/Sauvegarde cloud impossible/);
 assert.equal(h.writes,0);
 assert.equal(h.cloud.xp,0,"failed writes cannot claim reward");
}

// Two devices start from the same cloud baseline. Only one CAS may succeed;
// both clients must eventually acknowledge the identical persisted reward.
{
 let remote=structuredClone(baseline),writes=0;
 let queued=0;
 const arrivals=[];
 const barrier=()=>new Promise(resolve=>{arrivals.push(resolve);if(++queued===2)arrivals.forEach(done=>done())});
 const supabase={async rpc(name,args){
  if(name==="lumen_restore_profile")return {data:structuredClone(remote),error:null};
  if(name==="lumen_cas_profile"){
   await barrier();
   if(!sameCloudProfile(remote,args.p_expected))return {data:false,error:null};
   remote=structuredClone(args.p_payload);writes++;
   return {data:true,error:null};
  }
  throw Error(name);
 }};
 const results=await Promise.all([
  commitCanonicalVictory(supabase,quest.id,reward),
  commitCanonicalVictory(supabase,quest.id,reward)
 ]);
 assert.equal(writes,1,"only one CAS wins across two devices");
 assert.equal(remote.xp,15,"one canonical reward across concurrent devices");
 assert.equal(results.filter(x=>x.newlyCompleted).length,1);
 assert.equal(results.filter(x=>x.alreadySaved).length,1);
}

// Replaying a completed inserted quest can improve badges without re-awarding XP/stars.
{
 const h=harness();
 await commitCanonicalVictory(h.supabase,quest.id,reward);
 const replay=await commitCanonicalVictory(h.supabase,quest.id,{stars:1,badges:{speed:true,mastery:true}});
 assert.equal(replay.newlyCompleted,false);
 assert.equal(h.cloud.xp,15,"replay does not award XP twice");
 assert.equal(h.cloud.canonicalQuestState[quest.id].stars,1,"replay does not award extra stars");
 assert.equal(h.cloud.canonicalQuestState[quest.id].badges.autonomy,true,"previous badges remain earned");
 assert.equal(h.cloud.canonicalQuestState[quest.id].badges.speed,true,"new speed badge is saved");
 assert.equal(h.cloud.canonicalQuestState[quest.id].badges.mastery,true,"new mastery badge is saved");
 assert.equal(h.writes,2,"only a real badge improvement triggers an additional write");
 await commitCanonicalVictory(h.supabase,quest.id,{stars:1,badges:{speed:true}});
 assert.equal(h.writes,2,"replaying without improvement is idempotent");
}
{
 const h=harness({commitThenDrop:true});
 await commitCanonicalVictory(h.supabase,quest.id,reward);
 const improved=await commitCanonicalVictory(h.supabase,quest.id,{badges:{noError:true}});
 assert.equal(improved.newlyCompleted,false);
 assert.equal(h.cloud.canonicalQuestState[quest.id].badges.noError,true);
 assert.equal(h.cloud.xp,15);
}
console.log("Canonical victories survive lost acknowledgements and competing devices without duplicate rewards");
