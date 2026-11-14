// #695: read-only review of a completed quest (model + ranking review mode).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { questReviewModel, NO_OFFICIAL_TIME } from '../src/ui/quest-review.js';
import { createRankingView } from '../src/ui/ranking.js';

const format = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const quest = { id: 'base-q004', ordinal: 4, constellationId: 'real-01', gridRevision: 1 };

test('review shows saved badges as owned, the star, and never a new reward', () => {
  const model = questReviewModel({ quest, badges: { autonomy: true, mastery: true }, record: {}, lit: 4, count: 6, constellationName: 'Grande Ourse', format });
  assert.deepEqual(
    model.slots.map((s) => [s.key, s.state]),
    [['star', 'owned'], ['autonomy', 'owned'], ['speed', 'missing'], ['noError', 'missing'], ['mastery', 'owned']],
  );
  assert(!model.slots.some((s) => s.state === 'new'));
  assert.equal(model.kicker, 'TON BILAN · QUÊTE 4');
  assert.equal(model.title, 'Grande Ourse');
  assert.deepEqual([model.lit, model.count], [4, 6]);
});

test('time is the official record of the current grid revision only', () => {
  const record = { officialTimes: { 0: 200, 1: 83 } };
  assert.equal(questReviewModel({ quest, record, format }).time, 'Record : 1:23');
  // A time earned on the former board (revision 0) is not shown for revision 1.
  assert.equal(questReviewModel({ quest, record: { officialTimes: { 0: 200 } }, format }).time, NO_OFFICIAL_TIME);
  assert.equal(questReviewModel({ quest: { ...quest, gridRevision: undefined }, record, format }).time, 'Record : 3:20');
});

function fakeDocument() {
  const make = (tag) => {
    const e = { tag, children: [], dataset: {}, hidden: false, className: '', textContent: '', attributes: {} };
    e.setAttribute = (k, v) => (e.attributes[k] = v);
    e.append = (...c) => e.children.push(...c);
    e.replaceChildren = (...c) => (e.children = [...c]);
    e.querySelector = () => null;
    Object.defineProperty(e, 'childNodes', { get: () => e.children });
    e.animate = () => { e.animated = true; };
    return e;
  };
  return { createElement: make };
}

test('ranking review mode reads the board only: no flush, neutral copy, no animation', async () => {
  const calls = [];
  const client = {
    flush: async () => (calls.push('flush'), []),
    board: async () => (calls.push('board'), { top: [{ position: 1, place: 1, nickname: 'A', score: 60, mine: true }], personal: { position: 1, place: 1, score: 60 }, participating: true }),
  };
  const updates = [];
  const view = createRankingView({ client, getContext: () => ({ owner: 'o', client }), format, document: fakeDocument(), onUpdate: (u) => updates.push(u.state) });
  view.show(quest, null, { review: true });
  assert.equal(view.root.children.at(-1).textContent, 'Chargement du classement…');
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(calls, ['board'], 'A review never flushes the ranking outbox');
  assert.deepEqual(updates, ['pending', 'ready']);
  const animated = (e) => !!e.animated || (e.children || []).some(animated);
  assert.equal(animated(view.root), false, 'No podium entrance animation in a review');
  // Errors stay neutral: no "victory saved" claim outside a victory.
  const failing = { flush: async () => [], board: async () => { throw Error('down'); } };
  const errorView = createRankingView({ client: failing, getContext: () => ({ owner: 'o', client: failing }), format, document: fakeDocument() });
  errorView.show(quest, null, { review: true });
  await new Promise((r) => setTimeout(r, 0));
  const text = errorView.root.children.at(-1).textContent;
  assert.doesNotMatch(text, /victoire/i);
  assert.equal(errorView.root.dataset.state, 'error');
});

test('wiring: completed tiles open the review; replay keeps the cooldown entry', () => {
  const source = fs.readFileSync('src/ui/game-screen.js', 'utf8');
  assert.equal(source.split('if(solved){openQuestReview(quest);return}').length - 1, 2, 'Both Mon ciel tile paths open the review');
  assert.doesNotMatch(source, /if\(solved\)\{startReplay\(legacy\);return\}/);
  assert.match(source, /retry\.onclick=\(\)=>\{closeQuestReview\(\);if\(quest\.legacyIndex===null\)startCanonicalQuest\(quest\);else startReplay\(quest\.legacyIndex\)\}/);
  assert.match(source, /if\(summary\.rank&&!victoryFacts\.review\)victoryCelebration\.amplify/);
  const review = source.slice(source.indexOf('function openQuestReview('), source.indexOf('function closeQuestReview('));
  assert.doesNotMatch(review, /victoryCelebration\.start|celestialCelebration\.start|showCelestialVictory|saveProgress|recordVictory|rankingClient\.stage/, 'A review starts no effect and writes nothing');
});
