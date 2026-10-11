// Offline integration rehearsal for #222. NEVER imported by the live game.
// Keeps historic numeric save keys immutable until a versioned cloud migration ships.
import fs from "node:fs";
import assert from "node:assert/strict";
import {buildMigrationPlan,migrateLegacySolved} from "./issue-222-migration-plan.mjs";
import {playableQuest} from "../src/campaign/playable-quests.js";
const staged=JSON.parse(fs.readFileSync(new URL("../content/generated/issue-222-additions.json",import.meta.url),"utf8"));
const plan=buildMigrationPlan();
const additions=new Map(staged.quests.map(q=>[q.id,q]));
assert.equal(staged.status,"staged-only");
assert.equal(additions.size,plan.missing,"All additions must have distinct identifiers");
const canonical=plan.records.map(slot=>{
 const quest=slot.requiresGeneration?additions.get(slot.proposedQuestId):playableQuest(slot.legacyIndex);
 assert(quest,"Missing grid at ordinal "+slot.ordinal);
 assert.equal(quest.id,slot.proposedQuestId,"Grid identity changed");
 assert.equal(quest.reg.length,quest.sol.length,"Invalid board dimensions");
 if(slot.requiresGeneration){
  assert.equal(quest.audit?.solutions,1,"New quest missing uniqueness audit");
  assert.equal(quest.audit?.ok,true,"New quest missing proof audit");
 }
 return Object.freeze({id:quest.id,ordinal:slot.ordinal,adventureId:slot.adventureId,
  constellationId:slot.constellationId,legacyIndex:slot.legacyIndex,size:quest.reg.length,
  reg:quest.reg,sol:quest.sol});
});
assert.equal(canonical.length,plan.total);
assert.equal(new Set(canonical.map(q=>q.id)).size,plan.total);
assert.deepEqual(canonical.map(q=>q.ordinal),Array.from({length:plan.total},(_,i)=>i+1));
for(const adventure of plan.adventures){
 const quests=canonical.filter(q=>q.adventureId===adventure.id);
 assert.equal(quests.length,100);
 assert.equal(quests[0].ordinal,adventure.firstQuest);
 assert.equal(quests.at(-1).ordinal,adventure.lastQuest);
 assert.equal(new Set(quests.map(q=>q.constellationId)).size,10);
}
const legacyProgress={solved:{"0":true,"78":true,"100":true,"195":true,"196":true,"295":true},badges:{"295":{speed:true}},stars:{"295":3},shards:8,entitlements:["real-adventure-04"]};
const prior=structuredClone(legacyProgress),mapped=migrateLegacySolved(prior.solved,plan);
assert.equal(mapped.length,6);
assert.deepEqual(legacyProgress,prior,"Dry-run must not mutate cloud data");
assert.equal(canonical.find(q=>q.id==="base-q001").legacyIndex,0);
assert.equal(canonical.find(q=>q.legacyIndex===295).id,playableQuest(295).id);
assert.equal(canonical.find(q=>q.legacyIndex===295).ordinal,400);
console.log(JSON.stringify({status:"STAGING_VERIFIED",total:canonical.length,generated:staged.quests.length,
 adventures:plan.adventures.map(a=>({id:a.id,count:canonical.filter(q=>q.adventureId===a.id).length})),
 historicBadgesPreserved:true,cloudProfileUntouched:true}));
