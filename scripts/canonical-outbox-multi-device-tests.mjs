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

// Distinct offline victories from two devices must converge without either
// snapshot overwriting the other, even if their commits race.
const otherQuest=canonicalQuestList().find(q=>q.legacyIndex===null&&q.id!==quest.id);
assert.ok(otherQuest,"second canonical quest exists");
remote=structuredClone(baseline);writes=0;
const deviceA=createCanonicalVictoryOutbox(storage()),deviceB=createCanonicalVictoryOutbox(storage());
deviceA.enqueue(user,quest.id,reward);
deviceB.enqueue(user,otherQuest.id,reward);
await Promise.all([
 replayCanonicalVictoryOutbox(deviceA,user,commit),
 replayCanonicalVictoryOutbox(deviceB,user,commit)
]);
assert.equal(remote.canonicalQuestState[quest.id]?.solved,true,"first offline victory retained");
assert.equal(remote.canonicalQuestState[otherQuest.id]?.solved,true,"second offline victory retained");
assert.equal(remote.xp,30,"two different canonical victories credited exactly once");
assert.equal(deviceA.pending(user).length,0);
assert.equal(deviceB.pending(user).length,0);


// Ambiguous cloud acknowledgement: the server committed, but the response was
// lost. A second device must preserve both distinct wins after reconnect.
remote=structuredClone(baseline);writes=0;
const interruptedA=createCanonicalVictoryOutbox(storage());
const interruptedB=createCanonicalVictoryOutbox(storage());
interruptedA.enqueue(user,quest.id,reward);
interruptedB.enqueue(user,otherQuest.id,reward);
let dropOneAcknowledgement=true;
const flakySupabase={async rpc(name,args){
 if(name==="lumen_restore_profile")return {data:structuredClone(remote),error:null};
 if(name==="lumen_cas_profile"){
  if(!sameCloudProfile(remote,args.p_expected))return {data:false,error:null};
  remote=structuredClone(args.p_payload);writes++;
  if(dropOneAcknowledgement){dropOneAcknowledgement=false;return {data:null,error:{message:"response lost"}}}
  return {data:true,error:null};
 }
 throw Error(name);
}};
const flakyCommit=(id,r)=>commitCanonicalVictory(flakySupabase,id,r);
await replayCanonicalVictoryOutbox(interruptedA,user,flakyCommit);
await replayCanonicalVictoryOutbox(interruptedB,user,flakyCommit);
await replayCanonicalVictoryOutbox(interruptedA,user,flakyCommit);
assert.equal(remote.canonicalQuestState[quest.id]?.solved,true);
assert.equal(remote.canonicalQuestState[otherQuest.id]?.solved,true);
assert.equal(remote.xp,30,"response loss and retry cannot duplicate rewards");
assert.equal(writes,2,"exactly one write per distinct quest");
assert.equal(interruptedA.pending(user).length,0);
assert.equal(interruptedB.pending(user).length,0);

console.log("Multi-device offline outbox recovery credits canonical victory exactly once");
