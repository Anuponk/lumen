import assert from 'node:assert/strict';
import {verifiedAstronomicalFigure} from '../src/ui/astronomical-catalogue.js';
import {ADVENTURE_05_STAGING_PACK as pack,ADVENTURE_05_STAGING_CONSTELLATIONS as constellations,ADVENTURE_05_STAGING_QUESTS as quests,ADVENTURE_05_STAGING_GRIDS as grids,adventure05PreviewMap,adventure05QuestForPlay,adventure05CanonicalPreview,adventure05PreviewQuestDecision} from '../src/campaign/adventure-05-staging.js';
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

const first=quests[0];
assert.equal(adventure05QuestForPlay(first.id,[]),null);
assert.equal(adventure05QuestForPlay(first.id,['real-adventure-04']),null);
assert.equal(adventure05QuestForPlay('missing',[pack.id]),null);
const playable=adventure05QuestForPlay(first.id,[{entitlement:pack.id}]);
assert.equal(playable.id,first.id);
assert.equal(playable.legacyIndex,null);
assert.equal(playable.reg.length,playable.sol.length);
const oldCell=grids.get(first.id).reg[0][0];
playable.reg[0][0]=999;
assert.equal(grids.get(first.id).reg[0][0],oldCell);
console.log('PASS: entitlement-gated quest lookup rejects unauthorized access and protects source grids.');

for(const constellation of constellations){
 const figure=verifiedAstronomicalFigure(constellation);
 assert.ok(figure,'Missing audited astronomy for '+constellation.iau);
 assert.equal(figure.iau,constellation.iau);
 assert.ok(figure.pts.length>0&&figure.edges.length>0);
}
console.log('PASS: all ten Adventure 5 constellations resolve to audited Western figures.');

const canonical=adventure05CanonicalPreview();
assert.equal(canonical.length>=100,true);
assert.deepEqual(canonical.slice(-100).map(q=>q.id),quests.map(q=>q.id));
assert.equal(canonical.at(-100).ordinal,canonical.length-99);
assert.ok(canonical.slice(-100).every(q=>q.legacyIndex===null&&q.packId===pack.id));
console.log('PASS: Adventure 5 appends 100 stable canonical quests without reordering existing entries.');

const q1=quests[0],q2=quests[1],ent=[{entitlement:pack.id}];
assert.equal(adventure05PreviewQuestDecision(q1.id,[],{}).status,'pack-locked');
assert.equal(adventure05PreviewQuestDecision(q1.id,ent,{},false).status,'sync-required');
assert.equal(adventure05PreviewQuestDecision(q1.id,ent,{}).status,'ready');
assert.equal(adventure05PreviewQuestDecision(q2.id,ent,{}).status,'prerequisite');
assert.equal(adventure05PreviewQuestDecision(q2.id,ent,{canonicalQuestState:{[q1.id]:{solved:true}}}).status,'ready');
assert.equal(adventure05PreviewQuestDecision(q1.id,ent,{canonicalQuestState:{[q1.id]:{solved:true}}}).reason,'replay');
assert.equal(adventure05PreviewQuestDecision('unknown',ent,{}).status,'missing-content');
console.log('PASS: Adventure 5 preview navigation requires entitlement, cloud readiness and sequential progress.');
