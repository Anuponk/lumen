// #522 residual audit (20/11/2026): parity matrix between a historical quest
// (legacyIndex), a recent canonical quest and an artificial quest appended in a
// fixture. Pure projections only: no server receipt, no player data.
// Business rules must match; storage keys are a documented compatibility adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {applyQuestVictory} from '../src/campaign/quest-victory.js';
import {questRewardDefinition} from '../src/campaign/quest-rewards.js';
import {questLearningRules,QUEST_MILESTONES} from '../src/campaign/quest-rules.js';
import {catalogueQuestDecision,questCompleted} from '../src/campaign/catalogue-access.js';

const all=canonicalQuestList();
const historical=all.find(q=>q.legacyIndex!==null&&q.ordinal>QUEST_MILESTONES.discovery&&!q.rewards.bonus);
const recent=all.filter(q=>q.legacyIndex===null&&!q.rewards.bonus).at(-1);
// A future quest needs only data: same shape as the recent quest, new identity.
const artificial=Object.freeze({...recent,id:'fixture-future-q001',ordinal:all.length+1,position:recent.position+1,
 rewards:Object.freeze({...recent.rewards})});
const withArtificial=[...all,artificial];
const blank=()=>({solved:{},performances:{},stars:{},challenges:{},xp:0,shards:0,canonicalQuestState:{},noHint:{}});
const facts=(over={})=>({seconds:40,hintUsed:false,assistanceUsed:false,mistakeCommitted:false,challengeFailed:false,qualifying:true,
 qualifiedDay:'2026-11-20',qualifiedAt:'2026-11-20T10:00:00.000Z',...over});
// Rule-level view of a victory, independent of the storage representation.
function businessOutcome(quest,over){
 const progress=blank(),result=applyQuestVictory(progress,quest,facts(over));
 return {firstCompletion:result.firstCompletion,stars:result.stars,xp:progress.xp,shards:progress.shards,
  badges:result.savedPerformance.badges,dailyQualified:result.dailyQualified,completed:questCompleted(quest,progress)};
}

test('fixtures cover three quest origins',()=>{
 assert.ok(historical&&recent&&artificial);
 assert.notEqual(historical.legacyIndex,null);assert.equal(recent.legacyIndex,null);assert.equal(artificial.legacyIndex,null);
 assert.equal(withArtificial.filter(q=>q.id===artificial.id).length,1);
});

test('rewards come from quest data for every published quest, whatever its origin',()=>{
 for(const quest of all){
  const progress=blank(),result=applyQuestVictory(progress,quest,facts({seconds:1}));
  assert.equal(result.stars,quest.rewards.stars,quest.id+' stars');
  const bonus=quest.rewards.bonus;
  assert.deepEqual(Object.keys(progress.stars),bonus?[bonus.id]:[],quest.id+' bonus');
  assert.equal(progress.xp,15+(bonus?25:0),quest.id+' xp');
  assert.equal(questRewardDefinition(quest),quest.rewards,quest.id+' definition');
 }
});

test('same facts give the same badges, XP, stars rule and completion for historical, recent and artificial quests',()=>{
 for(const over of [{},{hintUsed:true,assistanceUsed:true},{mistakeCommitted:true},{seconds:200},{qualifying:false}]){
  const label=JSON.stringify(over);
  const [h,r,a]=[historical,recent,artificial].map(q=>businessOutcome(q,over));
  for(const outcome of [h,r,a]){assert.equal(outcome.firstCompletion,true,label);assert.equal(outcome.completed,true,label)}
  assert.deepEqual(h.badges,r.badges,label+' badges historical/recent');
  assert.deepEqual(a.badges,r.badges,label+' badges artificial/recent');
  assert.equal(h.xp,r.xp,label+' xp');assert.equal(a.xp,r.xp,label+' xp');
  assert.equal(h.shards,r.shards,label);assert.equal(h.dailyQualified,r.dailyQualified,label);
  assert.equal(a.stars,artificial.rewards.stars,label);assert.equal(h.stars,historical.rewards.stars,label);
 }
});

test('replay never grants a second first-completion reward, for any origin',()=>{
 for(const quest of [historical,recent,artificial]){
  const progress=blank();applyQuestVictory(progress,quest,facts());
  const xp=progress.xp,shards=progress.shards;
  const again=applyQuestVictory(progress,quest,facts({seconds:20}));
  assert.equal(again.firstCompletion,false,quest.id);assert.equal(again.stars,0,quest.id);
  assert.equal(progress.xp,xp,quest.id);assert.equal(progress.shards,shards,quest.id);
 }
});

test('learning rules depend on the visible ordinal only',()=>{
 assert.deepEqual(questLearningRules(artificial.ordinal),questLearningRules(recent.ordinal));
 assert.deepEqual(questLearningRules(historical.ordinal),questLearningRules(Math.max(historical.ordinal,QUEST_MILESTONES.discovery+1)));
});

test('an appended quest is reached by the same access rules without engine changes',()=>{
 const context={signedIn:true,cloudReady:true,packAllowed:true};
 const progress=blank();
 // Complete every quest of the pack except the last published one.
 for(const quest of all.filter(q=>q.packId===recent.packId&&q.id!==recent.id))applyQuestVictory(progress,quest,facts());
 assert.equal(catalogueQuestDecision(recent,progress,withArtificial,context).status,'ready');
 assert.equal(catalogueQuestDecision(artificial,progress,withArtificial,context).status,'prerequisite','follows its predecessor');
 applyQuestVictory(progress,recent,facts());
 const next=catalogueQuestDecision(artificial,progress,withArtificial,context);
 assert.deepEqual(next,{status:'ready',reason:'sequential'});
 applyQuestVictory(progress,artificial,facts());
 assert.deepEqual(catalogueQuestDecision(artificial,progress,withArtificial,context),{status:'ready',reason:'replay'});
 // Account rules are ordinal-based, not origin-based.
 assert.equal(catalogueQuestDecision(artificial,blank(),withArtificial,{...context,signedIn:false}).status,'auth-required');
});

// Documented compatibility adapter (#522 category 1): historical completions
// keep their legacy keys so old saves, receipts and server rows stay readable.
test('storage keys differ only through the documented compatibility adapter',()=>{
 const h=blank();applyQuestVictory(h,historical,facts());
 assert.equal(h.solved[historical.legacyIndex],1);assert.equal(h.noHint[historical.legacyIndex],1);
 assert.deepEqual(h.canonicalQuestState,{},'historical quests never write the canonical zone');
 for(const quest of [recent,artificial]){
  const c=blank();applyQuestVictory(c,quest,facts());
  assert.deepEqual(c.solved,{});assert.deepEqual(c.noHint,{});
  assert.equal(c.canonicalQuestState[quest.id].solved,true);
 }
});
