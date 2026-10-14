import assert from 'node:assert/strict';
import manifest from '../content/generated/diverse-adventures-3-4.json' with {type:'json'};
import {canonicalQuestById,canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {playableQuest} from '../src/campaign/playable-quests.js';
import {qualifyDifficulty} from '../src/campaign/difficulty.js';
import {connected,countSolutions,replay,signature} from './generate-diverse-grids.mjs';
assert.equal(manifest.puzzles.length,100);
assert.equal(manifest.totals['real-adventure-03'],68);
assert.equal(manifest.totals['real-adventure-04'],32);
const all=canonicalQuestList(),seen=new Set();
for(const replacement of manifest.puzzles){
 const q=canonicalQuestById(replacement.id);
 assert.ok(q,'Missing canonical quest '+replacement.id);
 assert.equal(q.ordinal,replacement.ordinal);
 assert.equal(q.packId,replacement.packId);
 assert.deepEqual(q.reg,replacement.reg);
 assert.deepEqual(q.sol,replacement.sol);
 assert.deepEqual(q.difficulty,qualifyDifficulty(replacement));
 assert.equal(connected(q.reg),true);
 assert.equal(countSolutions(q),1);
 assert.ok(replay(q),'Explanation failed '+q.id);
 const sig=signature(q.reg);assert.ok(!seen.has(sig));seen.add(sig);
 if(q.legacyIndex!==null){
   const game=playableQuest(q.legacyIndex);
   assert.deepEqual(game.reg,q.reg);
   assert.deepEqual(game.sol,q.sol);
   assert.deepEqual(q.difficulty,qualifyDifficulty(game));
 }
}
for(const q of all.filter(q=>q.legacyIndex!==null&&q.legacyIndex<196)){
 const game=playableQuest(q.legacyIndex);
 assert.deepEqual(game.reg,q.reg,'Historical grid changed: '+q.id);
}
assert.deepEqual(Object.entries(manifest.totals).map(([packId,count])=>[packId,manifest.puzzles.filter(p=>p.packId===packId).length]),Object.entries(manifest.totals));
console.log('100 Adventure 3/4 overrides valid and historical puzzles preserved');
