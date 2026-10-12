// Offline integration rehearsal for #222. NEVER imported by the live game.
// Keeps historic numeric save keys immutable until a versioned cloud migration ships.
import fs from "node:fs";
import assert from "node:assert/strict";
import {buildMigrationPlan,migrateLegacySolved} from "./issue-222-migration-plan.mjs";
import {playableQuest,playableQuestCount} from "../src/campaign/playable-quests.js";
import {canonicalQuestList,canonicalQuestForLegacy,canonicalQuestByOrdinal,canonicalDisplayForLegacy} from "../src/campaign/canonical-quests.js";
import {adminCanonicalCatalogueTree} from "../src/campaign/admin-catalogue.js";
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
// #341: production, staging migration and admin cockpit must share one catalogue.
const live=canonicalQuestList(),admin=adminCanonicalCatalogueTree();
assert.equal(live.length,400);
assert.deepEqual(live.map(q=>q.ordinal),Array.from({length:400},(_,i)=>i+1));
assert.deepEqual(live.map(q=>q.id),canonical.map(q=>q.id),"Runtime and migration quest identities diverge");
assert.deepEqual(live.map(q=>q.constellationId),canonical.map(q=>q.constellationId),"Runtime and migration constellation assignments diverge");
assert.equal(admin.length,4);
for(const adventure of admin){
 assert.equal(adventure.questCount,100,adventure.id+" must contain 100 quests");
 assert.equal(adventure.constellations.length,10,adventure.id+" must contain 10 constellations");
 for(const constellation of adventure.constellations){
  assert.equal(constellation.questCount,10,constellation.id+" must contain 10 quests");
  assert.equal(constellation.quests.length,10,constellation.id+" must expose 10 cockpit quests");
  assert.deepEqual(constellation.quests.map(q=>q.number),live.filter(q=>q.constellationId===constellation.id).map(q=>q.ordinal));
 }
}
const legacy=live.filter(q=>q.legacyIndex!==null);
assert.equal(legacy.length,playableQuestCount());
assert.equal(new Set(legacy.map(q=>q.legacyIndex)).size,playableQuestCount());
for(const q of legacy){
 assert.equal(canonicalQuestForLegacy(q.legacyIndex)?.id,q.id);
 assert.equal(canonicalQuestByOrdinal(q.ordinal)?.id,q.id);
 assert.equal(canonicalDisplayForLegacy(q.legacyIndex)?.number,q.ordinal);
 assert.equal(playableQuest(q.legacyIndex)?.id,q.id,"Legacy save identity changed");
}
assert.equal(live.find(q=>q.legacyIndex===99)?.constellationId,"real-13","Legacy 11th quest must be rebalanced without changing save key");
assert.equal(live.find(q=>q.id==="planned-real-13-q10")?.constellationId,"real-20","Generated quest must remain present after rebalance");
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
