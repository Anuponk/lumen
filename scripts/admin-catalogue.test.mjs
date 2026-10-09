import test from 'node:test';
import assert from 'node:assert/strict';
import {adminCatalogueTree} from '../src/campaign/admin-catalogue.js';
test('catalogue lists all adventures and 296 quests',()=>{
 const packs=adminCatalogueTree();
 assert.equal(packs.length,4);
 assert.equal(packs.flatMap(p=>p.constellations).length,34);
 assert.equal(packs.flatMap(p=>p.constellations.flatMap(c=>c.quests)).length,296);
 const generated=packs.at(-1);
 assert.equal(generated.constellations.length,10);
 assert.equal(generated.questCount,100);
 assert.equal(generated.constellations[0].quests[0].number,197);
 assert.equal(generated.constellations.at(-1).quests.at(-1).number,296);
 assert.ok(generated.constellations.every(c=>c.quests.every(q=>q.size>=7&&q.difficulty!=='non évaluée')));
});
