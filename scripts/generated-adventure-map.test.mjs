import test from "node:test";
import assert from "node:assert/strict";
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS,BASE_CONSTELLATIONS,baseCampaignQuestCount,packForLegacyQuest,contentMapModel} from "../src/campaign/content.js";
test("generated adventure appears in map but preserves historical quest indices",()=>{
 assert.equal(baseCampaignQuestCount(),196);
 assert.equal(BASE_CONSTELLATIONS.length,24);
 assert.equal(CONTENT_CONSTELLATIONS.length,34);
 const pack=CONTENT_PACKS.find(p=>p.id==="real-adventure-04");
 assert.ok(pack);
 assert.equal(pack.questCount,100);
 assert.equal(packForLegacyQuest(195)?.id,"real-adventure-03");
 assert.equal(packForLegacyQuest(196)?.id,"real-adventure-04");
 assert.equal(packForLegacyQuest(295)?.id,"real-adventure-04");
 const map=contentMapModel();
 const displayed=map.skies.flatMap(s=>s.packs).find(p=>p.id===pack.id);
 assert.equal(displayed.constellations.length,10);
 assert.equal(displayed.accessible,false);
});
