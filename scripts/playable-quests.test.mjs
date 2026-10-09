import test from "node:test";
import assert from "node:assert/strict";
import {playableQuest,playableQuestById,playableQuestCount,generatedQuestForConstellation} from "../src/campaign/playable-quests.js";
import {CAMPAIGN_SIZE_SCHEDULE,CAMPAIGN6_ORDER} from "../src/campaign/data.js";
import {CAT} from "../src/campaign/catalogue.js";

test("historical quest grid identity remains unchanged",()=>{
 for(let i=0;i<196;i++){
  const [size,index]=CAMPAIGN_SIZE_SCHEDULE[i];
  const expected=CAT[size][size==="6"?CAMPAIGN6_ORDER[index]:index];
  const actual=playableQuest(i);
  assert.ok(actual,"missing historical quest "+i);
  assert.deepEqual(actual.reg,expected.reg);
  assert.deepEqual(actual.sol,expected.sol);
 }
});
test("generated quests resolve with audited unique solutions",()=>{
 assert.equal(playableQuestCount(),296);
 assert.equal(playableQuest(-1),null);
 assert.equal(playableQuest(296),null);
 const ids=new Set();
 for(let i=196;i<296;i++){
  const q=playableQuest(i);
  assert.ok(q);
  assert.equal(q.source,"generated");
  assert.equal(q.audit.solutions,1);
  assert.deepEqual(playableQuestById(q.id).reg,q.reg);
  ids.add(q.id);
 }
 assert.equal(ids.size,100);
 assert.equal(generatedQuestForConstellation("iau-ant").length,10);
});
