import assert from "node:assert/strict";
import {canonicalQuestList} from "../src/campaign/canonical-quests.js";
import {commitCanonicalVictoryViaLedger} from "../src/persistence/canonical-progress.js";
import {acknowledgeCanonicalVictory} from "../src/persistence/canonical-progress.js";
import {createCanonicalVictoryOutbox,replayCanonicalVictoryOutbox} from "../src/persistence/canonical-outbox.js";
const quest=canonicalQuestList().find(q=>q.legacyIndex===null);
const reward={badges:{autonomy:true},stars:1};
const base={solved:{},historyBackup:{},badges:{},stars:{},canonicalQuestState:{},xp:0};
let profile=structuredClone(base),rpcCount=0;
const supabase={async rpc(name,args){
 if(name==="lumen_restore_profile")return {data:structuredClone(profile),error:null};
 if(name==="lumen_commit_canonical_victory"){
  rpcCount++;
  assert.equal(args.p_quest_id,quest.id);
  profile.canonicalQuestState[quest.id]={solved:true,badges:structuredClone(args.p_badges)};
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

// Exercise the transport imported by gameplay for both final Grande Ourse quests.
const finalQuests=canonicalQuestList().filter(q=>q.constellationId==="real-01").slice(-2);
assert.equal(finalQuests.length,2);
for(const q of finalQuests){
 assert.equal(q.legacyIndex,null);
 let cloud=acknowledgeCanonicalVictory({...structuredClone(base),shards:7,future:{keep:true}},q.id,reward).profile;
 const before=structuredClone(cloud),improvement={badges:{speed:true,noError:true,mastery:true}};
 let dropBefore=false,dropAfter=false,ignoreUpgrade=false;
 const client={async rpc(name,args){
  if(name==="lumen_restore_profile")return {data:structuredClone(cloud),error:null};
  assert.equal(name,"lumen_commit_canonical_victory","never fall back to snapshot CAS");
  if(dropBefore)return {data:null,error:{message:"offline before commit"}};
  if(!ignoreUpgrade)cloud=acknowledgeCanonicalVictory(cloud,args.p_quest_id,{badges:args.p_badges}).profile;
  if(dropAfter)return {data:null,error:{message:"ack lost after commit"}};
  return {data:{profile:structuredClone(cloud),newlyCompleted:false},error:null};
 }};
 const values=new Map(),storage={get length(){return values.size},key:i=>[...values.keys()][i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const outbox=createCanonicalVictoryOutbox(storage);
 outbox.enqueue("player",q.id,improvement);
 dropBefore=true;
 await assert.rejects(commitCanonicalVictoryViaLedger(client,q.id,improvement),/unconfirmed/,"a solved flag alone cannot acknowledge missing replay badges");
 await replayCanonicalVictoryOutbox(outbox,"player",(id,r)=>commitCanonicalVictoryViaLedger(client,id,r));
 assert.equal(outbox.pending("player").length,1,"offline replay keeps badges durable");
 dropBefore=false;ignoreUpgrade=true;
 await assert.rejects(commitCanonicalVictoryViaLedger(client,q.id,improvement),/verification failed/,"even a successful RPC must read back earned badges");
 ignoreUpgrade=false;dropAfter=true;
 const recovered=await replayCanonicalVictoryOutbox(outbox,"player",(id,r)=>commitCanonicalVictoryViaLedger(client,id,r));
 assert.equal(recovered.length,1);
 assert.equal(outbox.pending("player").length,0);
 assert.equal(cloud.canonicalQuestState[q.id].badges.mastery,true);
 assert.equal(cloud.canonicalQuestState[q.id].badges.autonomy,true);
 assert.equal(cloud.xp,before.xp);
 assert.equal(cloud.shards,before.shards);
 assert.deepEqual(cloud.future,before.future);
 assert.equal(cloud.canonicalQuestState[q.id].stars,before.canonicalQuestState[q.id].stars);
 const confirmed=structuredClone(cloud);
 await commitCanonicalVictoryViaLedger(client,q.id,improvement);
 assert.deepEqual(cloud,confirmed,"duplicate replay does not change rewards");
}
const ui=await import("node:fs/promises").then(fs=>fs.readFile(new URL("../src/ui/game-screen.js",import.meta.url),"utf8"));
assert.match(ui,/commitCanonicalVictoryViaLedger as commitCanonicalVictory/,"gameplay and outbox use transactional RPC");
const celebration=ui.slice(ui.indexOf("async function celebrateCanonicalSuccess()"),ui.indexOf("async function celebrateSuccess()"));
assert.match(celebration,/performanceAttempt\(\{questIndex:q.ordinal-1/,"canonical badges follow shared eligibility and run rules");
assert.match(celebration,/\.\.\.earnedLabels/,"replay success names newly saved badges");
console.log("Ledger client confirms server results and never blind-retries ambiguous commits");
