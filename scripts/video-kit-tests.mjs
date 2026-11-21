import assert from 'node:assert/strict';
import {SCENES, srt, validateScene, CTA_URL} from './marketing/video-kit-scenes.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';

// #759: the six kit videos only show real catalogue moves (no invented solution).
const quests = canonicalQuestList();
assert.deepEqual(SCENES.map(s => s.id), ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
for (const scene of SCENES) {
  assert.deepEqual(validateScene(scene, quests.find(q => q.id === scene.questId)), [], scene.id);
  assert(scene.duration >= 15 && scene.duration <= 30, scene.id + ' lasts 15–30 s');
  assert(scene.subtitles.at(-1).fr.includes(CTA_URL) && scene.subtitles.at(-1).en.includes(CTA_URL), scene.id + ' ends on the discovery CTA');
  for (const locale of ['fr', 'en']) assert.match(srt(scene, locale), /^1\n00:00:00,000 --> /, scene.id + ' ' + locale + ' SRT');
}
// The validator really refuses fake moves.
const q1 = quests.find(q => q.id === 'base-q001');
assert.match(validateScene({...SCENES[0], actions: [{at: 1, type: 'guardian', cell: [5, 5]}]}, q1).join(), /not in the solution/);
assert.match(validateScene({...SCENES[2], actions: [{at: 1, type: 'cross', cell: [5, 4]}]}, q1).join(), /hides a solution cell/);
assert.match(validateScene({...SCENES[0], pre: [[1, 2]]}, q1).join(), /must complete the grid/);
console.log('video kit tests passed');
