import test from "node:test";
import assert from "node:assert/strict";
import {STAGED_ADVENTURE,stagedQuestByIndex} from "../src/campaign/staged-adventure.js";
import {baseCampaignQuestCount,CONTENT_PACKS} from "../src/campaign/content.js";
import snapshot from "../content/generated/first-adventure.json" with {type:"json"};
import {playableQuest} from "../src/campaign/playable-quests.js";

test("generated adventure is append-only and never changes historical quests",()=>{
 assert.equal(baseCampaignQuestCount(),196);
 assert.equal(STAGED_ADVENTURE.quests.length,100);
 assert.equal(STAGED_ADVENTURE.constellations.length,10);
 assert.equal(STAGED_ADVENTURE.quests[0].legacyIndex,196);
 assert.equal(STAGED_ADVENTURE.quests.at(-1).legacyIndex,295);
 assert.equal(stagedQuestByIndex(195),null);
 assert.equal(stagedQuestByIndex(196)?.audit.solutions,1);
 assert.equal(stagedQuestByIndex(295)?.audit.solutions,1);
 // Snapshot staging provenance is separate from map registration (#199),
 // the playable bridge (#203), and the player's access rights.
 assert.equal(snapshot.manifest.mode,"staging-only");
 const registered=CONTENT_PACKS.find(p=>p.id===STAGED_ADVENTURE.pack.id);
 assert.ok(registered,"generated pack is registered in the current map");
 assert.equal(registered.access,"locked","registration does not grant access");
 assert.equal(registered.questCount,STAGED_ADVENTURE.quests.length);
 assert.deepEqual(registered.questIndices,STAGED_ADVENTURE.quests.map(q=>q.legacyIndex));
 assert.deepEqual(registered.constellationIds,STAGED_ADVENTURE.constellations.map(c=>c.id));
 for(const quest of STAGED_ADVENTURE.quests){
  const playable=playableQuest(quest.legacyIndex);
  assert.equal(playable.id,quest.id);
  assert.equal(playable.source,"generated");
  assert.equal(playable.audit.ok,true);
  assert.equal(playable.audit.solutions,1);
 }
});
