import assert from "node:assert/strict";
import {canonicalQuestList} from "../src/campaign/canonical-quests.js";
import {adminCanonicalCatalogueTree} from "../src/campaign/admin-catalogue.js";
import {qualifyDifficulty,DIFFICULTY_LABELS} from "../src/campaign/difficulty.js";
const quests=canonicalQuestList();
assert.equal(quests.length,400);
assert.equal(new Set(quests.map(q=>q.id)).size,400);
for(const quest of quests){
 assert.ok(DIFFICULTY_LABELS.includes(quest.difficulty?.label),quest.id);
 assert.deepEqual(quest.difficulty,qualifyDifficulty(quest),quest.id);
}
const admin=adminCanonicalCatalogueTree().flatMap(p=>p.constellations.flatMap(c=>c.quests));
assert.equal(admin.length,400);
for(const row of admin)assert.equal(row.difficulty,quests.find(q=>q.id===row.id)?.difficulty.label,row.id);
for(const [score,label] of [[10,"Facile"],[30,"Intermédiaire"],[50,"Difficile"],[100,"Expert"]]){
 const q={size:5,audit:{proofSteps:score,rules:{}}};
 assert.equal(qualifyDifficulty(q).label,label);
}
assert.ok(DIFFICULTY_LABELS.includes(qualifyDifficulty({reg:Array.from({length:6},()=>[0,1,2,3,4,5])}).label));
console.log("400/400 canonical difficulties, admin parity, tiers and fallback OK");
