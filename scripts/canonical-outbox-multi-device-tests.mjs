import assert from "node:assert/strict";
import {canonicalQuestList} from "../src/campaign/canonical-quests.js";
import {createCanonicalVictoryOutbox,replayCanonicalVictoryOutbox} from "../src/persistence/canonical-outbox.js";
import {commitCanonicalVictory} from "../src/persistence/canonical-progress.js";
import {sameCloudProfile} from "../src/persistence/cloud-profile.js";
const quest=canonicalQuestList().find(q=>q.legacyIndex===null);
assert.ok(quest);
const reward={stars:1,badges:{autonomy:true}};
const baseline={solved:{},historyBackup:{},badges:{},stars:{},performances:{},canonicalQuestState:{},xp:0,shards:0,skyScore:0,daily:{},challenges:{}};
let remote=structuredClone(baseline),writes=0,offline=true;
const supabase={async rpc(name,args){
 if(offline)throw Error("offline");
 if(name==="lumen_restore_profile")return {data:structuredClone(remote),error:null};
 if(name==="lumen_cas_profile"){
  if(!sameCloudProfile(remote,args.p_expected))return {data:false,error:null};
  remote=structuredClone(args.p_payload);writes++;
  return {data:true,error:null};
 }
 throw Error(name);
}};
function storage(){
 const state=new Map();
 return {get length(){return state.size},key:i=>[...state.keys()][i]??null,getItem:k=>state.get(k)??null,setItem:(k,v)=>state.set(k,v),removeItem:k=>state.delete(k)};
}
const user="same-player",a=createCanonicalVictoryOutbox(storage()),b=createCanonicalVictoryOutbox(storage());
a.enqueue(user,quest.id,reward);
b.enqueue(user,quest.id,reward);
const commit=(id,r)=>commitCanonicalVictory(supabase,id,r);
await replayCanonicalVictoryOutbox(a,user,commit);
assert.equal(a.pending(user).length,1,"offline first device persists win");
offline=false;
await Promise.all([replayCanonicalVictoryOutbox(a,user,commit),replayCanonicalVictoryOutbox(b,user,commit)]);
assert.equal(remote.xp,15,"multi-device outbox replay credits only once");
assert.equal(writes,1,"only one server CAS write");
assert.equal(a.pending(user).length,0);
assert.equal(b.pending(user).length,0);
console.log("Multi-device offline outbox recovery credits canonical victory exactly once");
