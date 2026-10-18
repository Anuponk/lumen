import test from "node:test";
import assert from "node:assert/strict";
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS,BASE_CONSTELLATIONS,GENERATED_CONSTELLATIONS,RESERVED_ADVENTURE_03_CONSTELLATIONS,baseCampaignQuestCount,packForLegacyQuest,contentMapModel} from "../src/campaign/content.js";
import {STAGED_ADVENTURE} from "../src/campaign/staged-adventure.js";
test("generated adventure appears in map but preserves historical quest indices",()=>{
 assert.deepEqual(CONTENT_CONSTELLATIONS.map(c=>c.id),[...BASE_CONSTELLATIONS,...GENERATED_CONSTELLATIONS,...RESERVED_ADVENTURE_03_CONSTELLATIONS].map(c=>c.id));
 const pack=CONTENT_PACKS.find(p=>p.id===STAGED_ADVENTURE.pack.id);
 assert.ok(pack);
 assert.equal(pack.questCount,STAGED_ADVENTURE.quests.length);
 assert.equal(pack.questIndices[0],baseCampaignQuestCount());
 // Frozen save-key compatibility anchors, not current catalogue size limits.
 assert.equal(packForLegacyQuest(195)?.id,"real-adventure-03");
 assert.equal(packForLegacyQuest(196)?.id,"real-adventure-04");
 assert.equal(packForLegacyQuest(295)?.id,"real-adventure-04");
 const map=contentMapModel();
 const displayed=map.skies.flatMap(s=>s.packs).find(p=>p.id===pack.id);
 assert.deepEqual(displayed.constellations.map(c=>c.id),STAGED_ADVENTURE.pack.constellationIds);
 assert.deepEqual(map.skies.flatMap(s=>s.packs.flatMap(p=>p.constellations)).map(c=>c.id).sort(),CONTENT_CONSTELLATIONS.map(c=>c.id).sort());
 assert.equal(displayed.accessible,false);
 const started={solved:{[pack.questIndices[0]]:1}};
 assert.equal(contentMapModel([], {progress:started}).skies.flatMap(s=>s.packs).find(p=>p.id===pack.id).accessible,true);
 assert.equal(contentMapModel([pack.id]).skies.flatMap(s=>s.packs).find(p=>p.id===pack.id).accessible,true);
});
