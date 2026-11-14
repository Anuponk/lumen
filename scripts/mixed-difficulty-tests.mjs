import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {canonicalQuestListForRevision} from '../src/campaign/canonical-quests.js';
import {rateLogicalDifficulty} from '../src/game/logical-difficulty.js';
import {logicalDifficultyTier,LOGICAL_DIFFICULTY_THRESHOLDS} from '../src/campaign/logical-difficulty-bands.js';
import {connected,countSolutions,replay,signature} from './generate-diverse-grids.mjs';
import {mixedTierSchedule,MIXED_TARGETS,pacingIntensity} from './mixed-difficulty-policy.mjs';
import {resolveChallengeQuest} from '../src/campaign/canonical-challenges.js';
import onboarding650 from '../content/generated/onboarding-grids-650.json' with {type:'json'};
import {createAttemptEngine} from '../src/game/attempt-engine.js';
import {obsoleteQuestIntent,alignQuestResets} from '../src/persistence/quest-reset.js';
import manifest from '../content/generated/logical-grids-v2.json' with {type:'json'};
import fs from 'node:fs';
import {createDurableCanonicalVictoryOutbox} from '../src/persistence/durable-canonical-outbox.js';
import {replayCanonicalVictoryOutbox} from '../src/persistence/canonical-outbox.js';
const all=canonicalQuestList(),protectedPacks=['base-real-sky','real-adventure-02','real-adventure-03','real-adventure-04'];
// Exact protection is kept: only the four owner-approved #650 boards are
// compared at revision 0; onboarding-grids-650-tests audits their replacement.
const onboardingIds=new Set(onboarding650.quests.map(q=>q.id)),revisionZero=new Map(canonicalQuestListForRevision(0).map(q=>[q.id,q]));
assert.deepEqual([...onboardingIds],['base-q003','base-q004','base-q005','base-q006']);
const protectedQuests=all.filter(q=>protectedPacks.includes(q.packId)).map(q=>onboardingIds.has(q.id)?revisionZero.get(q.id):q);
assert.equal(createHash('sha256').update(JSON.stringify(protectedQuests)).digest('hex'),'e2042bdc8a771e9493ab3caf44c037024ca825aca7d6958ea7646aa7f529544f','Adventures 1–4 retain every published grid, solution, reward, position and difficulty');
for(const pack of ['real-adventure-05','real-adventure-06','real-adventure-07','real-adventure-08']){
 const members=all.filter(q=>q.packId===pack);assert(members.length);
 for(const cid of new Set(members.map(q=>q.constellationId))){
  const group=members.filter(q=>q.constellationId===cid);
  assert(new Set(group.map(q=>q.difficulty.label)).size>=2,'Mixed measured difficulty in '+cid);
 }
}
const finale=all.filter(q=>q.packId==='real-adventure-09');
assert(finale.length&&finale.every(q=>q.difficulty.label==='Maître'&&q.difficulty.version==='lumen-logic-v1'),'Adventure 9 exclusively uses measured Master grids');
const hash=q=>createHash('sha256').update(JSON.stringify({reg:q.reg,sol:q.sol})).digest('hex');
const prior=new Map(canonicalQuestListForRevision(1).map(q=>[q.id,q])),current=new Map(all.map(q=>[q.id,q]));
const targetIds=new Set(manifest.quests.map(q=>q.id)),seen=new Set(all.filter(q=>!targetIds.has(q.id)).map(q=>signature(q.reg))),newCells=[];
const metrics=new Map();let changed=0,retained=0;
for(const entry of manifest.quests){
 const before=prior.get(entry.id),quest=current.get(entry.id);
 for(const field of ['id','ordinal','legacyIndex','packId','constellationId','position','rewards'])assert.deepEqual(quest[field],before[field]);
 assert.equal(entry.previousGridHash,hash(before));assert.equal(entry.gridHash,hash(quest));
 if(hash(quest)===hash(before)){retained++;assert.equal(quest.gridRevision,before.gridRevision)}else{changed++;assert.equal(quest.gridRevision,2)}
 assert(connected(quest.reg));assert.equal(countSolutions(quest),1,quest.id);
 const sig=signature(quest.reg);assert(!seen.has(sig),'Distinct D4 grid '+quest.id);seen.add(sig);
 const logic=rateLogicalDifficulty(quest.reg);const withoutTrace={...logic};delete withoutTrace.trace;
 assert.deepEqual(withoutTrace,entry.logical,'Independent score '+quest.id);
 assert(logic.solved);assert.equal(logic.initialSingles,0);assert(logic.firstPlacementDepth>=3);assert(logic.deductionsBeforeFirst>=2);
 assert.equal(entry.logicalTier,logicalDifficultyTier(logic.score));
 const proof=replay(quest);assert(proof,'Actual hint engine '+quest.id);assert.equal(proof.proofSteps,entry.audit.proofSteps);assert.deepEqual(proof.rules,entry.audit.rules);
 if(quest.packId==='real-adventure-09'){
  assert(logic.score>=manifest.stats.floor);assert(logic.firstPlacementDepth>=5);assert(logic.deductionsBeforeFirst>=3);
  const cells=sig.split(',');assert(newCells.every(other=>cells.reduce((s,v,i)=>s+(v!==other[i]),0)>=6),'Diverse Master grids');newCells.push(cells);
 }
 const earlier=resolveChallengeQuest({stable_quest_id:quest.id,grid_revision:entry.previousGridRevision});
 assert.equal(hash(earlier),hash(before),'Older challenge retains exact board');
 assert.equal(hash(resolveChallengeQuest({stable_quest_id:quest.id,grid_revision:quest.gridRevision})),hash(quest));
 metrics.set(quest.id,logic);
}
assert.equal(changed,manifest.stats.changed);assert.equal(retained,manifest.stats.preserved);
assert.equal(targetIds.size,all.filter(q=>MIXED_TARGETS.some(p=>p.packId===q.packId)).length);
const distribution=[];let previousMean=-Infinity;
for(const policy of MIXED_TARGETS){
 const members=all.filter(q=>q.packId===policy.packId),counts={};
 for(const q of members)counts[q.difficulty.label]=(counts[q.difficulty.label]||0)+1;
 for(const cid of new Set(members.map(q=>q.constellationId))){
  const group=members.filter(q=>q.constellationId===cid),schedule=mixedTierSchedule(group.length,policy.weights);
  assert.deepEqual(group.map(q=>logicalDifficultyTier(q.logical.score)),schedule,'Source-owned measured pacing '+cid);
  const scores=group.map(q=>q.logical.score);assert.equal(scores.at(-1),Math.max(...scores),'Final grid is strongest '+cid);
  assert(scores.some((score,i)=>i&&score<scores[i-1]),'Real measured relief inside '+cid);
 }
 const scores=members.map(q=>q.logical.score).sort((a,b)=>a-b),mean=scores.reduce((s,x)=>s+x,0)/scores.length;
 assert(mean>previousMean,'Ascending mean between Adventures');previousMean=mean;
 distribution.push({packId:policy.packId,count:members.length,levels:counts,min:scores[0],median:scores[Math.floor(scores.length/2)],max:scores.at(-1),mean:Number(mean.toFixed(3))});
}
for(const count of [1,2,3,7,10,13,17])for(const policy of MIXED_TARGETS){
 const schedule=mixedTierSchedule(count,policy.weights);assert.equal(schedule.length,count);assert(schedule.every(t=>Number.isInteger(t)&&policy.weights[t]>0));
 assert.equal(schedule.at(-1),Math.max(...schedule));assert.equal(mixedTierSchedule(count,policy.weights).join(','),schedule.join(','));
}
assert.equal(logicalDifficultyTier(LOGICAL_DIFFICULTY_THRESHOLDS[0]-.001),0);assert.equal(logicalDifficultyTier(LOGICAL_DIFFICULTY_THRESHOLDS[0]),1);
assert.equal(logicalDifficultyTier(LOGICAL_DIFFICULTY_THRESHOLDS[2]),3);assert.throws(()=>logicalDifficultyTier(NaN));
const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},engine=createAttemptEngine({storage});
const revised=all.find(q=>q.gridRevision===2),oldAttempt=engine.create({questId:revised.id,gridRevision:1,questResetRevision:1,board:prior.get(revised.id).reg.map(row=>row.map(()=>0))});
const raw=values.get(engine.storageKey);assert.equal(engine.restore({questId:revised.id,gridRevision:2,questResetRevision:2}),null);assert([...values.values()].includes(raw));
const fresh=engine.create({questId:revised.id,gridRevision:2,questResetRevision:2});assert.match(fresh.attemptId,/^qr2\.gv2\./);
const reset={canonicalQuestState:{[revised.id]:{solved:false,badges:{},runPerformance:{},gridRevision:2,resetRevision:2,resetAt:'2026-11-08T00:00:00Z'}}};
assert(obsoleteQuestIntent({questId:revised.id,operationId:'qr2.cached-old-grid'},reset));
assert(!obsoleteQuestIntent({questId:revised.id,operationId:fresh.attemptId},reset));
assert.equal(alignQuestResets({canonicalQuestState:{[revised.id]:{solved:true,resetRevision:1,resetAt:'2026-11-01T00:00:00Z'}}},reset).profile.canonicalQuestState[revised.id].solved,false);
function outboxFixture(namespace='Canonical'){
 const local=new Map(),indexed=new Map();let clock=0;
 const storage={get length(){return local.size},key:i=>[...local.keys()][i]??null,getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
 const fallback={entries:async prefix=>[...indexed].filter(([key])=>key.startsWith(prefix)),get:async key=>indexed.get(key)??null,put:async(k,v)=>indexed.set(k,v),remove:async(k,raw)=>{assert.equal(indexed.get(k),raw);indexed.delete(k)}};
 return {box:createDurableCanonicalVictoryOutbox(storage,{namespace,fallback,now:()=>new Date(Date.UTC(2026,10,8)+clock++).toISOString()}),indexed};
}
const offline=outboxFixture(),owner='offline-owner';
const oldWin=await offline.box.enqueue(owner,revised.id,{badges:{}},{operationId:'qr1.old-board'});
await offline.box.pause(owner,oldWin,{code:'23514'});
const oldRaw=JSON.stringify(oldWin);
await offline.box.enqueue(owner,revised.id,{badges:{autonomy:true}},{operationId:'gv2.current-board'});
assert.deepEqual((await offline.box.inspect(owner)).retryable.map(e=>e.operationId),['gv2.current-board'],'Unacknowledged old-grid evidence does not block another content version');
const restored=await replayCanonicalVictoryOutbox(offline.box,owner,async(id,reward,options)=>{
 assert.equal(options.operationId,'gv2.current-board');return {profile:{canonicalQuestState:{[id]:{solved:true,gridRevision:2,badges:{autonomy:true}}}}};
});
assert.equal(restored.length,1);assert.deepEqual(await offline.box.pending(owner),[oldWin]);
assert([...offline.indexed.values()].includes(oldRaw),'Previous-grid intention remains byte-for-byte pending, never silently acknowledged');
const reconnect=outboxFixture(),seenOperations=[];
const older=await reconnect.box.enqueue(owner,revised.id,{badges:{}},{operationId:'qr1.not-yet-reviewed'});
await reconnect.box.enqueue(owner,revised.id,{badges:{}},{operationId:'gv2.reconnected-win'});
const recoveredVersions=await replayCanonicalVictoryOutbox(reconnect.box,owner,async(id,reward,options)=>{
 seenOperations.push(options.operationId);
 if(options.operationId===older.operationId)throw Object.assign(Error('Old grid rejected'),{code:'23514'});
 return {profile:{canonicalQuestState:{[id]:{solved:true,gridRevision:2,badges:{}}}}};
});
assert.deepEqual(seenOperations,[older.operationId,'gv2.reconnected-win']);assert.equal(recoveredVersions.length,1);
assert.deepEqual(await reconnect.box.pending(owner),[older],'First rejection preserves older evidence without delaying the new board');
for(const namespace of ['Canonical','Legacy','Wallet']){
 const f=outboxFixture(namespace),first=await f.box.enqueue(owner,revised.id,{badges:{}},{operationId:'gv2.first'});
 await f.box.pause(owner,first,{code:'23514'});await f.box.enqueue(owner,revised.id,{badges:{}},{operationId:'gv2.later'});
 assert.equal((await f.box.inspect(owner)).retryable.length,0,'Same-version and economic ordering remain held');
 if(namespace!=='Canonical'){await f.box.enqueue(owner,revised.id,{badges:{}},{operationId:'gv3.independent-label'});assert.equal((await f.box.inspect(owner)).retryable.length,0,'Economic domains never split by a grid label');}
}
const auth=outboxFixture(),expired=await auth.box.enqueue(owner,revised.id,{badges:{}},{operationId:'old-auth'});
await auth.box.pause(owner,expired,{code:'PGRST301'});await auth.box.enqueue(owner,revised.id,{badges:{}},{operationId:'gv2.new-auth'});
assert.equal((await auth.box.inspect(owner)).retryable.length,0,'Auth holds every version');
const report={schema:2,method:'lumen-logic-v1',protectedHash:'e2042bdc8a771e9493ab3caf44c037024ca825aca7d6958ea7646aa7f529544f',changed,retained,generation:manifest.stats,distribution};
if(process.argv.includes('--write'))fs.writeFileSync('docs/validation/mixed-logical-difficulty.json',JSON.stringify(report,null,2)+'\n');
else assert.deepEqual(JSON.parse(fs.readFileSync('docs/validation/mixed-logical-difficulty.json','utf8')),report);
console.log(JSON.stringify(report));
