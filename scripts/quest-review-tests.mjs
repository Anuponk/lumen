// #695: read-only review of a completed quest (model + ranking review mode).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { questReviewModel, NO_OFFICIAL_TIME } from '../src/ui/quest-review.js';
import { createRankingView } from '../src/ui/ranking.js';
import { createRankingClient } from '../src/persistence/ranking.js';

const format = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const quest = { id: 'base-q004', ordinal: 4, constellationId: 'real-01', gridRevision: 1 };

test('#775: a refused older capture cannot hide a confirmed current victory', async () => {
  const data=new Map(),storage={get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const connection={async rpc(name,args){
    if(name==='lumen_ranking_finish')return args.p_operation_id==='old-reset-0'?{error:{code:'22023'}}:{data:{status:'confirmed',questId:quest.id,improved:true}};
    if(name==='lumen_ranking_board')return {data:{top:[],personal:{position:1,score:16},participating:true}};
    return {data:{eligible:true}};
  }};
  const context=()=>({owner:'owner',client:connection}),client=createRankingClient({storage,getContext:context});
  const attempt={rankingVersion:1,startedAt:1,mode:'campaign'};
  client.stage({id:'old'},{...attempt,attemptId:'old'});client.stage(quest,{...attempt,attemptId:'current'});
  const view=createRankingView({client,getContext:context,format,document:fakeDocument()});
  view.show(quest,'current-reset-0');await new Promise(r=>setTimeout(r,0));
  assert.equal(view.root.dataset.state,'ready');
  assert.deepEqual(client.entries('owner').map(e=>e.questId),['old']);
});

test('#775: reconnect refresh waits for the current capture and then shows its receipt', async () => {
  const data=new Map(),storage={get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  let connected=false,boardReads=0;
  const connection={async rpc(name,args){
    if(name==='lumen_ranking_finish')return args.p_operation_id==='old-reset-0'||!connected?{error:{code:'22023'}}:{data:{status:'ineligible',questId:quest.id,improved:false}};
    if(name==='lumen_ranking_board'){boardReads++;return {data:{top:[],participating:true}}}
    return {data:{eligible:true}};
  }};
  const context=()=>({owner:'owner',client:connection}),client=createRankingClient({storage,getContext:context});
  const attempt={rankingVersion:1,startedAt:1,mode:'campaign'};
  client.stage({id:'old'},{...attempt,attemptId:'old'});client.stage(quest,{...attempt,attemptId:'current'});
  const view=createRankingView({client,getContext:context,format,document:fakeDocument()});
  view.show(quest,'current-reset-0');await new Promise(r=>setTimeout(r,0));
  assert.equal(view.root.dataset.state,'pending');
  await view.refresh([]);assert.equal(boardReads,0,'An online/timer wake never reads an old board while this capture remains');
  connected=true;await client.flush().catch(error=>view.refresh(error.results));
  assert.equal(view.root.dataset.state,'ready');
  await view.refresh();
  const text=e=>[e.textContent,...(e.children||[]).map(text)].join(' ');
  assert.match(text(view.root),/pas retenu au classement/,'A later timer refresh retains the non-qualification notice');
  assert.deepEqual(client.entries('owner').map(e=>e.questId),['old']);
});

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

// #761: a victory podium never presents an old board as the current result.
test('victory podium: failed or pending sync shows a pending state, ineligible is explicit', async () => {
  const board = { top: [{ position: 1, place: 1, nickname: 'L', score: 55 }, { position: 2, place: 2, nickname: 'A', score: 65, mine: true }], personal: { position: 2, place: 2, score: 65 }, participating: true };
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const calls = [];
  const failing = { flush: async () => { throw Error('Ranking unavailable'); }, board: async () => (calls.push('board'), board), entries: () => [] };
  const v1 = createRankingView({ client: failing, getContext: () => ({ owner: 'o', client: failing }), format, document: fakeDocument() });
  v1.show(quest, 'op-1');
  await tick();
  assert.equal(v1.root.dataset.state, 'pending');
  assert.match(v1.root.children.at(-1).textContent, /synchronisation a échoué/);
  assert.deepEqual(calls, [], 'The stale board is not read as this victory result');
  const pending = { flush: async () => [{ status: 'pending' }], board: async () => (calls.push('board'), board), entries: () => [{ operationId: 'op-2' }] };
  const v2 = createRankingView({ client: pending, getContext: () => ({ owner: 'o', client: pending }), format, document: fakeDocument() });
  v2.show(quest, 'op-2');
  await tick();
  assert.equal(v2.root.dataset.state, 'pending');
  assert.match(v2.root.children.at(-1).textContent, /attend la confirmation/);
  assert.deepEqual(calls, []);
  const refused = { flush: async () => [], board: async () => board, entries: () => [], takeResult: () => ({ status: 'ineligible', questId: quest.id, improved: false }) };
  const v3 = createRankingView({ client: refused, getContext: () => ({ owner: 'o', client: refused }), format, document: fakeDocument() });
  v3.show(quest, 'op-3');
  await tick();
  assert.equal(v3.root.dataset.state, 'ready');
  const text = (e) => [e.textContent, ...(e.children || []).map(text)].join(' ');
  assert.match(text(v3.root), /pas retenu au classement/);
  assert.match(text(v3.root), /record personnel est bien enregistré/);
});

test('wiring #761: badge/ranking qualification is re-evaluated at run start and reset', () => {
  const source = fs.readFileSync('src/ui/game-screen.js', 'utf8');
  const start = source.slice(source.indexOf('function ensureAttemptStarted('), source.indexOf('attemptEngine.start();', source.indexOf('function ensureAttemptStarted(')));
  assert.match(start, /!a\.qualifying&&!socialChallenge&&currentBadgeQualification\(\)\)\{a=attemptEngine\.requalify\(true\)/);
  assert.match(source, /attemptEngine\.reset\(state,socialChallenge\?\{\}:\{qualifying:!!resetSnapshot\?\.qualifying\|\|currentBadgeQualification\(\)\}\)/);
});
