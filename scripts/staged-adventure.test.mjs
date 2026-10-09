import test from "node:test";
import assert from "node:assert/strict";
import {STAGED_ADVENTURE,stagedQuestByIndex} from "../src/campaign/staged-adventure.js";
import {baseCampaignQuestCount,CONTENT_PACKS} from "../src/campaign/content.js";

test("generated adventure is append-only and never changes historical quests",()=>{
 assert.equal(baseCampaignQuestCount(),196);
 assert.equal(STAGED_ADVENTURE.quests.length,100);
 assert.equal(STAGED_ADVENTURE.constellations.length,10);
 assert.equal(STAGED_ADVENTURE.quests[0].legacyIndex,196);
 assert.equal(STAGED_ADVENTURE.quests.at(-1).legacyIndex,295);
 assert.equal(stagedQuestByIndex(195),null);
 assert.equal(stagedQuestByIndex(196)?.audit.solutions,1);
 assert.equal(stagedQuestByIndex(295)?.audit.solutions,1);
 assert.equal(CONTENT_PACKS.some(p=>p.id===STAGED_ADVENTURE.pack.id),false);
});
