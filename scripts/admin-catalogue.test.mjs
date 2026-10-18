import test from 'node:test';
import assert from 'node:assert/strict';
import {adminCatalogueTree} from '../src/campaign/admin-catalogue.js';
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS,RESERVED_ADVENTURE_03_CONSTELLATIONS} from '../src/campaign/content.js';
import {STAGED_ADVENTURE} from '../src/campaign/staged-adventure.js';
import {playableQuestCount} from '../src/campaign/playable-quests.js';

test('admin catalogue lists every registered pack and constellation with its numeric quests',()=>{
 const packs=adminCatalogueTree();
 assert.deepEqual(packs.map(p=>p.id),CONTENT_PACKS.map(p=>p.id));
 assert.deepEqual(packs.flatMap(p=>p.constellations).map(c=>c.id).sort(),CONTENT_CONSTELLATIONS.map(c=>c.id).sort());
 for(const pack of packs){
  const registered=CONTENT_PACKS.find(p=>p.id===pack.id);
  assert.equal(pack.questCount,registered.questCount);
  assert.deepEqual(pack.constellations.map(c=>c.id),registered.constellationIds);
  for(const c of pack.constellations){
   const source=CONTENT_CONSTELLATIONS.find(item=>item.id===c.id);
   assert.deepEqual(c.quests.map(q=>q.index),source.questIndices);
   assert.ok(c.quests.every(q=>q.number===q.index+1&&q.id&&q.size));
  }
 }
 const indices=packs.flatMap(p=>p.constellations.flatMap(c=>c.quests.map(q=>q.index)));
 assert.equal(new Set(indices).size,playableQuestCount(),'no missing or duplicated numeric quest');
 assert.deepEqual([...indices].sort((a,b)=>a-b),Array.from({length:playableQuestCount()},(_,i)=>i));
 // Reservations belong in the tree without inventing numeric save keys.
 for(const reserved of RESERVED_ADVENTURE_03_CONSTELLATIONS){
  const view=packs.find(p=>p.id===reserved.packId).constellations.find(c=>c.id===reserved.id);
  assert.deepEqual(view.quests,[]);
 }
 const generated=packs.find(p=>p.id===STAGED_ADVENTURE.pack.id);
 assert.deepEqual(generated.constellations.map(c=>c.id),STAGED_ADVENTURE.pack.constellationIds);
 assert.equal(generated.questCount,STAGED_ADVENTURE.quests.length);
 assert.deepEqual(generated.constellations.flatMap(c=>c.quests.map(q=>({id:q.id,index:q.index}))),STAGED_ADVENTURE.quests.map(q=>({id:q.id,index:q.legacyIndex})));
 assert.ok(generated.constellations.every(c=>c.quests.every(q=>q.size>=7&&q.difficulty!=='non évaluée')));
});
