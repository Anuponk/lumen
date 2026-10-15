import assert from "node:assert/strict";
import {canonicalQuestList} from "../src/campaign/canonical-quests.js";
import {commitCanonicalVictoryViaLedger} from "../src/persistence/canonical-progress.js";
const quest=canonicalQuestList().find(q=>q.legacyIndex===null);
const reward={badges:{autonomy:true},stars:1};
const base={solved:{},historyBackup:{},badges:{},stars:{},canonicalQuestState:{},xp:0};
let profile=structuredClone(base),rpcCount=0;
const supabase={async rpc(name,args){
 if(name==="lumen_restore_profile")return {data:structuredClone(profile),error:null};
 if(name==="lumen_commit_canonical_victory"){
  rpcCount++;
  assert.equal(args.p_quest_id,quest.id);
  profile.canonicalQuestState[quest.id]={solved:true};
  profile.xp=15;
  return {data:{profile:structuredClone(profile),newlyCompleted:true},error:null};
 }
 throw Error("Unexpected RPC "+name);
}};
const saved=await commitCanonicalVictoryViaLedger(supabase,quest.id,reward);
assert.equal(saved.newlyCompleted,true);
assert.equal(saved.profile.xp,15);
assert.equal(rpcCount,1);
const lostAck={async rpc(name){
 if(name==="lumen_commit_canonical_victory"){rpcCount++;return {data:null,error:{message:"lost ack"}}}
 if(name==="lumen_restore_profile")return {data:structuredClone(profile),error:null};
 throw Error(name);
}};
const ack=await commitCanonicalVictoryViaLedger(lostAck,quest.id,reward);
assert.equal(ack.alreadySaved,true,"read back committed victory on lost ack");
assert.equal(rpcCount,2,"never retry ambiguous ledger write blindly");
const unavailable={async rpc(name){
 if(name==="lumen_commit_canonical_victory")return {data:null,error:{message:"offline"}};
 if(name==="lumen_restore_profile")return {data:structuredClone(base),error:null};
 throw Error(name);
}};
await assert.rejects(commitCanonicalVictoryViaLedger(unavailable,quest.id,reward),/unconfirmed/);
console.log("Ledger client confirms server results and never blind-retries ambiguous commits");
