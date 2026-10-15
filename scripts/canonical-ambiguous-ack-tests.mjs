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
console.log("Canonical victory ambiguous acknowledgements are verified without duplicate rewards");
