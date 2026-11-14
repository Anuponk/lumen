// #650 acceptance gate: owner-approved easier boards for legacy quests 3-6.
// Independently recounts every claim of the manifest and checks that saves,
// historical links, attempts and ranking stay compatible with soft revision 1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import manifest from '../content/generated/onboarding-grids-650.json' with {type:'json'};
import {canonicalQuestList,canonicalQuestByOrdinal,canonicalQuestListForRevision,canonicalQuestForLegacy} from '../src/campaign/canonical-quests.js';
import {resolveChallengeQuest} from '../src/campaign/canonical-challenges.js';
import {rateLogicalDifficulty} from '../src/game/logical-difficulty.js';
import {createAttemptEngine} from '../src/game/attempt-engine.js';
import {createRankingClient} from '../src/persistence/ranking.js';
import {canonicalIntentVersionKey} from '../src/persistence/quest-reset.js';
import {CAT} from '../src/campaign/catalogue.js';
import {connected,countSolutions,replay,signature} from './generate-diverse-grids.mjs';

const hash=q=>createHash('sha256').update(JSON.stringify({reg:q.reg,sol:q.sol})).digest('hex');
const ids=['base-q003','base-q004','base-q005','base-q006'];
const revisionZero=new Map(canonicalQuestListForRevision(0).map(q=>[q.id,q]));
const current=canonicalQuestList();

// 1. Exact scope: four legacy Adventure 1 quests, soft revision 0 -> 1.
assert.equal(manifest.schema,'lumen-onboarding-grid-revision-v1');
assert.deepEqual(manifest.quests.map(q=>q.id),ids);
assert.deepEqual(current.filter(q=>q.legacyIndex!==null&&q.gridRevision).map(q=>q.id),ids,'No other legacy board is revised');
for(const [i,q] of manifest.quests.entries()){
 const old=revisionZero.get(q.id),now=canonicalQuestByOrdinal(i+3);
 assert.equal(now.id,q.id,'Order is unchanged');
 assert.equal(q.legacyIndex,i+2);assert.equal(old.legacyIndex,q.legacyIndex);assert.equal(canonicalQuestForLegacy(q.legacyIndex).id,q.id);
 assert.equal(q.previousGridRevision,0);assert.equal(q.gridRevision,1);assert.equal(now.gridRevision,1);
 assert.equal(q.previousGridHash,hash(old),'Previous hash is the published revision-0 board');
 assert.equal(q.gridHash,hash(q));assert.notEqual(q.gridHash,q.previousGridHash);
 assert.deepEqual(now.reg,q.reg);assert.deepEqual(now.sol,q.sol);
 // Identity, rewards and the displayed historical label are untouched.
 for(const key of ['id','ordinal','legacyIndex','packId','constellationId','position','rewards','size','audit','difficulty','family'])assert.deepEqual(now[key],old[key],q.id+' '+key);
}
// Revision 1 is the only changed list for these IDs; other quests are identical.
for(const q of current.filter(q=>!ids.includes(q.id)&&q.legacyIndex!==null))assert.deepEqual(q,revisionZero.get(q.id),'Unchanged legacy quest '+q.id);

// 2. Every new board is valid, unique and explainable by both engines.
const others=new Set([...Object.values(CAT).flat().map(p=>p.reg),...[0,1,2].flatMap(r=>canonicalQuestListForRevision(r).filter(q=>!ids.includes(q.id)||r===0).map(q=>q.reg))].map(signature));
const seen=new Set();
for(const q of manifest.quests){
 assert(connected(q.reg),q.id+' connected territories');assert.equal(countSolutions(q),1,q.id+' unique solution');
 const sig=signature(q.reg);assert(!others.has(sig)&&!seen.has(sig),q.id+' D4 duplicate');seen.add(sig);
 const proof=replay(q);assert(proof,q.id+' explainable by the in-game hint engine');
 assert.deepEqual({solutions:1,proofSteps:proof.proofSteps,rules:proof.rules,hardestRule:proof.hardestRule},q.proof);
 const logic=rateLogicalDifficulty(q.reg);assert(logic.solved);assert.deepEqual(logic.solution,q.sol);
 for(const key of ['score','deductionsBeforeFirst','firstPlacementDepth','dependencyDepth','advancedDeductions'])assert.equal(logic[key],q.logical[key],q.id+' '+key);
 assert.equal(rateLogicalDifficulty(revisionZero.get(q.id).reg).score,q.logical.previousScore);
}

// 3. Difficulty profile (#650 acceptance): gentle, monotone rise from quest 2.
const scores=[2,3,4,5,6].map(o=>rateLogicalDifficulty(canonicalQuestByOrdinal(o).reg,{trace:false}).score);
for(let i=1;i<scores.length;i++)assert(scores[i]>scores[i-1],'Monotone onboarding '+scores.join(' < '));
assert(scores[1]<=45,'Quest 3 stays very easy');assert(scores.at(-1)<75,'Quest 6 stays below the former peak');
for(const q of manifest.quests){
 assert(q.logical.score<q.logical.previousScore,q.id+' is easier than before');
 assert(q.logical.deductionsBeforeFirst<=3,q.id+' first guardian is reached quickly');
}
const q3=rateLogicalDifficulty(manifest.quests[0].reg);
assert.equal(q3.trace.find(f=>f.rule!=='guardian'&&f.rule!=='single')?.rule,'locked','Quest 3 opens with a simple locked deduction');

// 4. Historical links: numeric legacy links follow the live board, versioned
// stable links keep the published revision-0 board.
assert.deepEqual(resolveChallengeQuest({puzzle_id:3}).reg,manifest.quests[0].reg);
assert.deepEqual(resolveChallengeQuest({stable_quest_id:'base-q003',grid_revision:0}).reg,revisionZero.get('base-q003').reg);
assert.deepEqual(resolveChallengeQuest({stable_quest_id:'base-q003',grid_revision:1}).reg,manifest.quests[0].reg);

// 5. Saves: revision 1 never adds a gv marker, so victories, outbox replay and
// acquisition reconciliation keep their revision-0 identity.
function memory(){const m=new Map();return {m,get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
const fresh=createAttemptEngine({storage:memory()});fresh.create({questId:3,mode:'campaign',gridRevision:1});
assert.doesNotMatch(fresh.snapshot().attemptId,/gv/);
assert.equal(canonicalIntentVersionKey({questId:'base-q003',operationId:fresh.snapshot().attemptId}),JSON.stringify(['base-q003','0']));

// 6. An in-progress attempt on the old board is archived, never replayed on the new one.
const store=memory(),oldBoard=[[1,0,0,0,0,0],[0,2,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0],[0,0,0,0,0,0]];
const before=createAttemptEngine({storage:store});before.create({questId:3,mode:'campaign',board:oldBoard});
const raw=store.getItem('lumenActiveAttemptV1');assert(raw);
assert.equal(createAttemptEngine({storage:store}).restore({questId:3,mode:'campaign',gridRevision:1,questResetRevision:0}),null,'Old board is not restored on the new grid');
assert([...store.m.entries()].some(([k,v])=>k.includes(':grid-archive:')&&v===raw),'Exact old attempt is archived');

// 7. Ranking: a run captured on the replaced board is archived and cannot
// block later entries; current-revision runs are still sent.
const rstore=memory(),calls=[];
const client={async rpc(name,args){calls.push({name,args});return {data:name==='lumen_ranking_finish'?{status:'confirmed'}:{eligible:true}}}};
const ctx={owner:'owner-650',client};
const ranking=createRankingClient({storage:rstore,getContext:()=>ctx,currentGridRevision:id=>{const q=canonicalQuestList().find(x=>x.id===id);return q?q.gridRevision??0:null}});
const attempt=(id)=>({rankingVersion:1,attemptId:id,resetCount:0,mode:'campaign',startedAt:1,helpUses:{}});
ranking.stage({id:'base-q003',gridRevision:0},attempt('stale'));
ranking.stage({id:'base-q004',gridRevision:1},attempt('live'));
const results=await ranking.flush();
assert(results.some(r=>r?.status==='obsolete'),'Stale run reported obsolete');
assert(!calls.some(c=>c.args.p_operation_id==='stale-reset-0'),'Stale run is never sent');
assert(calls.some(c=>c.name==='lumen_ranking_begin'&&c.args.p_operation_id==='live-reset-0'&&c.args.p_grid_revision===1),'Current run is sent with revision 1');
assert.equal(ranking.entries(ctx.owner).length,0);
assert([...rstore.m.keys()].some(k=>k==='lumenRankingObsoleteV1:owner-650:stale-reset-0'),'Stale run archived, not deleted');
// Without the resolver (older wiring) behaviour is unchanged.
const plain=createRankingClient({storage:memory(),getContext:()=>ctx});plain.stage({id:'base-q003',gridRevision:0},attempt('x'));
assert.notEqual((await plain.flush())[0]?.status,'obsolete');

// 8. The server data migration targets exactly these quests and legacy indexes.
const sql=fs.readFileSync('supabase/migrations/20261114090000_onboarding_grid_revision_650.sql','utf8');
const expected=JSON.parse(/expected jsonb:='([^']+)'/.exec(sql)[1]);
assert.deepEqual(expected,Object.fromEntries(manifest.quests.map(q=>[q.id,q.legacyIndex])));
assert.match(sql,/grid_revision not in \(0,1\)/);assert.doesNotMatch(sql,/delete|truncate|drop /i);

console.log('onboarding grids #650: 4 boards, scores',scores.join(' < '));
