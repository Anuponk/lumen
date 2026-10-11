import assert from "node:assert/strict";
import {canonicalQuestCount,canonicalQuestByOrdinal,canonicalQuestById,canonicalQuestForLegacy,canonicalQuestList,canonicalNextUnsolved} from "../src/campaign/canonical-quests.js";
import {playableQuest} from "../src/campaign/playable-quests.js";
const quests=canonicalQuestList();
assert.equal(canonicalQuestCount(),400);
assert.equal(new Set(quests.map(q=>q.id)).size,400);
for(let i=1;i<=400;i++)assert.equal(canonicalQuestByOrdinal(i)?.ordinal,i);
for(const q of quests){
 assert.equal(canonicalQuestById(q.id),q);
 assert.equal(q.sol.length,q.reg.length);
 if(q.legacyIndex!==null){
  assert.equal(canonicalQuestForLegacy(q.legacyIndex),q);
  assert.equal(playableQuest(q.legacyIndex).id,q.id);
 }else assert.equal(q.audit?.solutions,1);
}
assert.equal(quests.filter(q=>q.legacyIndex===null).length,104);
for(let i=0;i<4;i++)assert.equal(quests.slice(i*100,(i+1)*100).filter(q=>q.packId===quests[i*100].packId).length,100);
assert.equal(canonicalNextUnsolved({},{}).ordinal,1);
assert.equal(canonicalNextUnsolved(Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,true])),Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,true]))),null);
assert.equal(canonicalNextUnsolved({"0":true},{}).ordinal,2);
console.log("Canonical 400-quest registry: stable identity, legacy save keys and pagination verified");
