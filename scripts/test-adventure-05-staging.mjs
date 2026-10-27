import assert from 'node:assert/strict';
import {ADVENTURE_05_STAGING_PACK as pack,ADVENTURE_05_STAGING_CONSTELLATIONS as constellations,ADVENTURE_05_STAGING_QUESTS as quests,ADVENTURE_05_STAGING_GRIDS as grids,adventure05PreviewMap} from '../src/campaign/adventure-05-staging.js';
assert.equal(pack.id,'real-adventure-05');
assert.equal(pack.questCount,100);
assert.equal(constellations.length,10);
assert.equal(quests.length,100);
assert.equal(grids.size,100);
assert.equal(new Set(quests.map(q=>q.id)).size,100);
for(const c of constellations)assert.equal(quests.filter(q=>q.constellationId===c.id).length,10);
for(const q of quests){
 assert.equal(q.packId,pack.id);
 assert.equal(q.legacyIndex,null);
 assert.ok(grids.has(q.id));
}
console.log('PASS: Adventure 5 staging adapter: 10 constellations, 100 canonical-only quests, stable IDs.');

const preview=adventure05PreviewMap();
const sky=preview.skies.find(s=>s.id==='real-sky');
assert.ok(sky);
assert.equal(sky.packs.at(-1).id,pack.id);
assert.equal(sky.packs.at(-1).accessible,false);
assert.equal(sky.packs.at(-1).constellations.length,10);
assert.equal(sky.constellations.filter(c=>c.packId===pack.id).length,10);
const unlocked=adventure05PreviewMap([pack.id]).skies.find(s=>s.id==='real-sky');
assert.equal(unlocked.packs.at(-1).accessible,true);
console.log('PASS: opt-in sky preview respects pack access and preserves prior packs.');
