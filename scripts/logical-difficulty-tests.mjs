import assert from 'node:assert/strict';
import {rateLogicalDifficulty} from '../src/game/logical-difficulty.js';
import {createAttemptEngine} from '../src/game/attempt-engine.js';
import {canonicalAttemptToResume} from '../src/campaign/campaign-resume.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {countSolutions} from './pack-grid-generator.mjs';
import {resolveChallengeQuest} from '../src/campaign/canonical-challenges.js';
import {challengeSnapshot,createChallengeClient} from '../src/campaign/social-challenge.js';
import {createGameEngine} from '../src/game/engine.js';
import {generate,rng} from './generate-diverse-grids.mjs';

// Validate every recorded deduction independently against mathematical solutions,
// including candidates/prerequisites. Rating receives only the territory matrix.
for(const q of canonicalQuestList().filter(q=>q.packId==='real-adventure-05').slice(0,10)){
 const a=rateLogicalDifficulty(q.reg),b=rateLogicalDifficulty(structuredClone(q.reg));assert.deepEqual(a,b);
 assert(a.solved);assert.equal(countSolutions(q.reg).count,1);assert.deepEqual(a.solution,q.sol);
 const facts=a.trace;
 for(const f of facts){
  assert.equal(f.depth,1+Math.max(0,...f.premises.map(id=>{assert(id<f.id);return facts[id].depth})));
  assert(f.remainingCandidates>0);
  for(const [r,c] of f.targets)assert.equal(q.sol[r]===c,f.rule==='single',q.id+' '+f.rule);
 }
 assert.equal(a.forcedBranches,0,'No hidden guessing or contradiction search');
 assert.deepEqual(rateLogicalDifficulty(q.reg,{trace:false}),Object.fromEntries(Object.entries(a).filter(([k])=>k!=='trace')));
}
assert.throws(()=>rateLogicalDifficulty([[0,0],[0,0]]),/Invalid/);
assert.equal(rateLogicalDifficulty([[0,1],[0,1]]).solved,false,'A stalled/contradictory puzzle is rejected');
const ambiguous=Array.from({length:5},(_,r)=>Array(5).fill(r));
assert.equal(countSolutions(ambiguous).count,2);assert.equal(rateLogicalDifficulty(ambiguous).solved,false,'Multiple possibilities never produce a guessed placement');
const teaching=canonicalQuestList().find(q=>q.ordinal===1),intro=rateLogicalDifficulty(teaching.reg);
assert(intro.initialSingles>0);assert.equal(intro.firstPlacementDepth,1,'An actually obvious opening is rated as such');
const random=rng(640);
for(let sample=0;sample<30;sample++){
 const p=generate(5,sample%2?'balanced':'hybrid',random);if(!p)continue;
 // At size 5 there are at most 5! permutations, below the enumerator's cap:
 // test deductions against ALL solutions, including ambiguous puzzles.
 const possible=createGameEngine(()=>({n:5,puz:p,state:Array.from({length:5},()=>Array(5).fill(0))}),()=>false).solutions();
 assert(possible.length>0);
 for(const fact of rateLogicalDifficulty(p.reg).trace)for(const [r,c] of fact.targets)
  assert(possible.every(sol=>(sol[r]===c)===(fact.rule==='single')),'Sound on every possible solution: '+fact.rule);
}

const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const old=createAttemptEngine({storage});old.create({questId:'changed',board:[[2,0],[0,0]]});old.start();old.markAssistance();
const raw=data.get(old.storageKey),fresh=createAttemptEngine({storage});
assert.equal(fresh.restore({questId:'changed',gridRevision:1}),null,'Same-size obsolete board cannot restore');
assert([...data.entries()].some(([key,value])=>key.includes('grid-archive')&&value===raw),'Original board, timer, identity and assistance archived');
fresh.create({questId:'changed',gridRevision:1,board:[[0,0],[0,0]]});fresh.start();fresh.updateBoard([[0,1],[0,0]]);
assert.equal(createAttemptEngine({storage}).restore({questId:'changed',gridRevision:1}).board[0][1],1,'Offline reload restores current revision');
assert.equal(createAttemptEngine({storage}).restore({questId:'changed',gridRevision:0}),null,'Downgrade also fails closed');
const q={id:'changed',legacyIndex:null,gridRevision:1,reg:[[0,1],[0,1]]};
assert.equal(canonicalAttemptToResume(JSON.parse(raw),[q],{ownerId:'owner'}),null,'Cloud hydration cannot select an obsolete run');
const denied={...storage,setItem(){throw Error('quota')}};data.set(old.storageKey,raw);
assert.throws(()=>createAttemptEngine({storage:denied}).restore({questId:'changed',gridRevision:1}),/quota/);assert.equal(data.get(old.storageKey),raw);
const revised=canonicalQuestList().find(q=>q.gridRevision===1);
assert.notDeepEqual(resolveChallengeQuest({stable_quest_id:revised.id}).reg,revised.reg,'Unversioned links keep original puzzle');
assert.deepEqual(resolveChallengeQuest({stable_quest_id:revised.id,grid_revision:1}).reg,revised.reg,'New links resolve exact harder puzzle');
assert.throws(()=>resolveChallengeQuest({stable_quest_id:revised.id,grid_revision:2}),/revision/);
const calls=[],client=createChallengeClient({rpc:async(name,args)=>{calls.push({name,args});return {data:[{challenge_id:'fixture'}]}}});
await client.create(challengeSnapshot({quest:revised,seconds:40,run:{}}));
assert.equal(calls[0].name,'lumen_create_quest_challenge_v2');assert.equal(calls[0].args.p_grid_revision,1);
const oldQuest=resolveChallengeQuest({stable_quest_id:revised.id});
await client.create(challengeSnapshot({quest:oldQuest,seconds:40,run:{}}));assert.equal(calls[1].name,'lumen_create_quest_challenge');
let legacyCalls=0;
const unavailable=createChallengeClient({rpc:async name=>{legacyCalls++;assert.equal(name,'lumen_create_quest_challenge_v2');return {error:{code:'PGRST202'}}}});
await assert.rejects(()=>unavailable.create(challengeSnapshot({quest:revised,seconds:40,run:{}})));assert.equal(legacyCalls,1,'No unsafe fallback to an old-grid challenge');
console.log('PASS deterministic, solution-blind proofs/dependencies and versioned offline/restore/rollback archives');
