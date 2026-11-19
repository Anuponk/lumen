// #695: read-only review of a completed quest (model + ranking review mode).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { questReviewModel, NO_OFFICIAL_TIME } from '../src/ui/quest-review.js';
import { createRankingView } from '../src/ui/ranking.js';
import { createRankingClient } from '../src/persistence/ranking.js';
import {reviewNeighbour,bindReviewNavigation} from '../src/ui/quest-review-navigation.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {resolveCanonicalQuest} from '../src/campaign/playable-navigation.js';

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
  assert.match(source, /retry\.onclick=\(\)=>\{if\(!reviewQuestAvailable\(quest\)\)return;closeQuestReview\(\);if\(quest\.legacyIndex===null\)startCanonicalQuest\(quest\);else if\(completed\)startReplay\(quest\.legacyIndex\);else startCelestialQuest\(quest\)\}/);
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

test('#784: immediate canonical neighbours cross constellations and owned adventures without writes',()=>{
 const quests=canonicalQuestList(),progress={solved:{},canonicalQuestState:{}};
 const complete=q=>{if(q.legacyIndex!==null)progress.solved[q.legacyIndex]=1;else progress.canonicalQuestState[q.id]={solved:true}};
 const boundary=quests.findIndex((q,i)=>i>0&&q.packId!==quests[i-1].packId);
 quests.slice(0,boundary).forEach(complete);
 const prior=quests[boundary-1],next=quests[boundary],before=structuredClone(progress);
 const available=owned=>q=>resolveCanonicalQuest(q.ordinal,owned,progress).status==='ready';
 assert.equal(reviewNeighbour(quests,prior.id,1,available([])),null,'Unowned adventure blocks the immediate neighbour');
 assert.equal(reviewNeighbour(quests,prior.id,1,available([next.packId])),next,'First quest of owned adventure, still unfinished');
 assert.equal(reviewNeighbour(quests,next.id,-1,available([next.packId])),prior);
 assert.equal(reviewNeighbour(quests,next.id,1,available([next.packId])),null,'Purchase never unlocks the second quest prematurely');
 const constellation=quests.findIndex((q,i)=>i>0&&q.constellationId!==quests[i-1].constellationId);
 assert.equal(reviewNeighbour(quests,quests[constellation-1].id,1,available([])),quests[constellation]);
 assert.equal(reviewNeighbour(quests,quests[0].id,-1,available([])),null);
 assert.equal(reviewNeighbour(quests,quests.at(-1).id,1,()=>true),null);
 const later=quests.find(q=>q.packId!==next.packId&&q.ordinal>next.ordinal);
 assert.equal(resolveCanonicalQuest(later.ordinal,[later.packId],{}).status,'ready','Independently purchased entry #783');
 assert.equal(reviewNeighbour(quests,prior.id,1,available([later.packId])),null,'Never jump across a locked adventure');
 assert.deepEqual(progress,before,'Browsing preserves the full progress object');
});

test('#784: unfinished view owns no badge, time or victory',()=>{
 const model=questReviewModel({quest,completed:false,badges:{mastery:true},record:{officialTimes:{1:9}},format});
 assert.equal(model.time,'À jouer');assert.match(model.subtitle,/À jouer/);
 assert(model.slots.every(s=>s.state==='missing'));
});

function reviewGestureFixture() {
 const events={},moves=[],captures=[];
 const host={addEventListener:(name,fn)=>events[name]=fn,setPointerCapture:id=>captures.push(id),contains:()=>true};
 const target={closest:()=>null},button={closest:()=>({})};
 let active=true;
 bindReviewNavigation(host,{active:()=>active,navigate:d=>(moves.push(d),true),viewport:()=>390});
 const pointer=(name,x,y,overrides={})=>events[name]({target,clientX:x,clientY:y,pointerType:'touch',pointerId:1,isPrimary:true,...overrides});
 return {events,host,target,button,moves,captures,pointer,setActive:value=>{active=value}};
}

test('#784: intentional swipe and keyboard preserve edges, native gestures and controls',()=>{
 const {events,moves,captures,pointer,target,button}=reviewGestureFixture();
 const swipe=(from,to,overrides)=>{pointer('pointerdown',...from,overrides);pointer('pointermove',...to,overrides);pointer('pointerup',...to,overrides)};
 swipe([220,100],[100,120]);swipe([100,100],[230,110]);assert.deepEqual(moves,[1,-1]);assert.deepEqual(captures,[1,1]);
 swipe([5,100],[160,100]);swipe([385,100],[200,100]);swipe([220,100],[210,220]);swipe([220,100],[180,105]);swipe([220,100],[100,100],{target:button});swipe([220,100],[100,100],{pointerType:'mouse'});
 assert.deepEqual(moves,[1,-1],'Edges, vertical, short, button and mouse gestures are ignored');
 let prevented=0;const key=(key,target)=>events.keydown({key,target,preventDefault:()=>prevented++});
 key('ArrowRight',target);key('ArrowLeft',target);key('ArrowRight',button);
 assert.deepEqual(moves,[1,-1,1,-1]);assert.equal(prevented,2);
});

test('#817: capture starts after horizontal intent and cancelled or inactive gestures stay cancelled',()=>{
 const {captures,moves,pointer,setActive}=reviewGestureFixture();
 pointer('pointerdown',240,100);
 pointer('pointermove',236,102);
 assert.deepEqual(captures,[],'An ordinary tap stays on its original element');
 pointer('pointermove',210,105);
 assert.deepEqual(captures,[1],'Horizontal intent captures on the stable review');
 pointer('pointercancel',210,105);
 pointer('pointerup',90,110);
 assert.deepEqual(moves,[]);
 pointer('pointerdown',240,100);
 pointer('pointerdown',235,110,{pointerId:2,isPrimary:false});
 pointer('pointerup',90,110);
 assert.deepEqual(moves,[],'A second touch cancels single-finger navigation');
 pointer('pointerdown',240,100);
 setActive(false);
 pointer('pointerup',90,110);
 assert.deepEqual(moves,[],'A layout leaving the results phase cannot navigate');
});

test('#784: late podium requests cannot overwrite a rapidly browsed target',async()=>{
 const pending=[],connection={},context=()=>({owner:'o',client:connection});
 const client={board:q=>new Promise(resolve=>pending.push({q,resolve})),flush:()=>{throw Error('No write during browsing')}};
 const view=createRankingView({client,getContext:context,format,document:fakeDocument()});
 const q2={...quest,id:'second'},q3={...quest,id:'third'};
 view.show(quest,null,{review:true});view.show(q2,null,{review:true});view.show(q3,null,{review:true});
 assert.equal(view.root.dataset.state,'pending');
 const board=name=>({top:[{position:1,place:1,nickname:name,score:9}],participating:true});
 pending[2].resolve(board('target'));await new Promise(r=>setTimeout(r,0));
 pending[0].resolve(board('stale'));pending[1].resolve(board('stale'));await new Promise(r=>setTimeout(r,0));
 const text=e=>[e.textContent,...(e.children||[]).map(text)].join(' ');
 assert.match(text(view.root),/target/);assert.doesNotMatch(text(view.root),/stale/);
});

test('#784: returning to the same quest still rejects an earlier official-record response',async()=>{
 const source=fs.readFileSync('src/ui/game-screen.js','utf8');
 const fn=source.slice(source.indexOf('async function refreshReviewOfficialTime('),source.indexOf('function closeQuestReview('));
 const pending=[],shown=[],client={rpc:()=>new Promise(resolve=>pending.push(resolve))};
 const context=vm.createContext({lumenUser:{id:'owner'},lumenSupabase:client,qaActive:false,officialTimingSupported:()=>true,recordLabel:data=>data.label,formatDuration:format,setVictoryTime:text=>shown.push(text),questReview:{quest}});
 vm.runInContext(fn,context);
 const old=context.refreshReviewOfficialTime(quest);
 context.questReview={quest:{...quest,id:'other'}};
 context.questReview={quest};
 const current=context.refreshReviewOfficialTime(quest);
 pending[1]({data:{label:'Record : 0:50'}});await current;
 pending[0]({data:{label:'Record : 9:00'}});await old;
 assert.deepEqual(shown,['Record : 0:50']);
});

test('#784: a swipe consumes only its compatibility click, never the next tap',()=>{
 const {events,host,pointer}=reviewGestureFixture();
 pointer('pointerdown',240,100);
 pointer('pointermove',190,100);
 pointer('pointerup',100,100);
 let consumed=0;const click={detail:1,target:host,preventDefault:()=>consumed++,stopImmediatePropagation:()=>consumed++};
 events.click(click);assert.equal(consumed,2,'The swipe cannot activate the backdrop or a CTA');
 pointer('pointerdown',100,100);events.click(click);assert.equal(consumed,2,'The next intentional tap is preserved');
 pointer('pointerdown',240,100);
 pointer('pointermove',220,100);
 pointer('pointerup',215,100);
 events.click(click);assert.equal(consumed,4,'A captured drag under the navigation threshold cannot click the backdrop');
});
