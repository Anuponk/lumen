// Target contract approved for #522. Pure projection is not a server receipt.
import test from 'node:test';
import assert from 'node:assert/strict';
import {acknowledgeCanonicalVictory} from '../src/persistence/canonical-progress.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {applyQuestVictory} from '../src/campaign/quest-victory.js';
import {questBadgeQualification} from '../src/campaign/quest-rules.js';
import {questRewardDefinition} from '../src/campaign/quest-rewards.js';
import {cloudSafelyCoversLocal,reconcileCloudAchievementsDurably} from '../src/persistence/cloud-profile.js';
const quest=canonicalQuestList().find(q=>q.legacyIndex===null);
const facts={seconds:45,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-22',qualifiedAt:'2026-10-22T10:00:00.000Z'};

test('verified V2 replay summaries restore through the existing achievement path without changing balances or first completion',async()=>{
 const local={solved:{},badges:{},xp:0,shards:3,legacyVictoryRevision:1,walletRevision:1,canonicalQuestState:{}};
 applyQuestVictory(local,quest,{...facts,seconds:80});
 const remote=structuredClone(local);applyQuestVictory(remote,quest,{...facts,seconds:20,qualifiedAt:'2026-10-22T10:15:00.000Z'});
 assert.equal(cloudSafelyCoversLocal(local,remote),true);
 const raw=JSON.stringify(local),values=new Map([['lumenProgressV1',raw],['lumenCloudOwnerId','fixture-owner']]);
 const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 assert.equal((await reconcileCloudAchievementsDurably(storage,remote)).changed,true);
 const saved=JSON.parse(values.get('lumenProgressV1'));
 assert.deepEqual(saved.canonicalQuestState,remote.canonicalQuestState);
 assert.equal(saved.shards,local.shards);assert.equal(saved.xp,local.xp);
 assert.deepEqual(saved.canonicalQuestState[quest.id].performance,local.canonicalQuestState[quest.id].performance);
 assert.ok([...values.values()].includes(raw));
});
test('V2 coverage keeps unknown badge facts immutable',()=>{
 const local={solved:{},badges:{},xp:0,shards:3,legacyVictoryRevision:1,walletRevision:1,canonicalQuestState:{}};
 applyQuestVictory(local,quest,facts);
 local.canonicalQuestState[quest.id].badges.futureFact=false;
 local.canonicalQuestState[quest.id].runPerformance.badges.futureFact=false;
 const remote=structuredClone(local);
 remote.canonicalQuestState[quest.id].badges.futureFact=true;
 remote.canonicalQuestState[quest.id].runPerformance.badges.futureFact=true;
 assert.equal(cloudSafelyCoversLocal(local,remote),false,'Unknown evidence cannot be treated like one of the four badge flags');
});
test('first win without a hint earns the same XP even when another assistance was used',()=>{
 const p={xp:42,shards:7,canonicalQuestState:{}};
 applyQuestVictory(p,quest,{...facts,assistanceUsed:true});
 assert.equal(p.xp,57,'Numeric victories distinguish no hint from autonomy');
});
test('third autonomous first win earns one shard for either quest representation',()=>{
 for(const q of [quest,canonicalQuestList().find(q=>q.legacyIndex===70)]){
  const p={xp:42,shards:7,autonomousWins:2,canonicalQuestState:{},solved:{},performances:{},badges:{},stars:{},challenges:{},skyHistoryVersion:4,skyScore:0};
  const out=applyQuestVictory(p,q,facts);
  assert.equal(p.autonomousWins,3);assert.equal(p.shards,8);assert.equal(p.xp,57);assert(out.dailyQualified);
 }
});
test('past canonical victories keep acquired rewards and unknown metadata without retroactive credits',()=>{
 const original={solved:true,stars:1,badges:{mastery:true},performance:{seconds:80},future:{keep:true}};
 const profile={xp:42,shards:7,autonomousWins:2,canonicalQuestState:{[quest.id]:original}};
 const result=acknowledgeCanonicalVictory(profile,quest.id,{badges:{speed:true},performance:{seconds:20},stars:1});
 assert.equal(result.profile.xp,42);assert.equal(result.profile.shards,7);assert.equal(result.profile.autonomousWins,2);
 assert.deepEqual(result.profile.canonicalQuestState[quest.id].future,{keep:true});
 assert.deepEqual(result.profile.canonicalQuestState[quest.id].performance,original.performance);
 assert.equal(result.profile.canonicalQuestState[quest.id].badges.mastery,true);
 const replay=structuredClone(profile);applyQuestVictory(replay,quest,facts);
 assert.equal(replay.xp,42);assert.equal(replay.shards,7);assert.equal(replay.autonomousWins,2);
 assert.deepEqual(replay.canonicalQuestState[quest.id].performance,original.performance);
 assert.deepEqual(replay.canonicalQuestState[quest.id].future,original.future);
 assert(replay.canonicalQuestState[quest.id].badges.mastery);
});
test('replay cooldown and same-run mastery use canonical performance without rewriting first completion',()=>{
 const p={xp:0,shards:3,canonicalQuestState:{}};applyQuestVictory(p,quest,{...facts,seconds:80});
 assert.equal(questBadgeQualification(quest,p,quest.ordinal,Date.parse(facts.qualifiedAt)+899999),false);
 assert.equal(questBadgeQualification(quest,p,quest.ordinal,Date.parse(facts.qualifiedAt)+900000),true);
 const previous=structuredClone(p.canonicalQuestState[quest.id].performance);
 const out=applyQuestVictory(p,quest,{...facts,seconds:20,assistanceUsed:true});
 assert(out.savedPerformance.badges.autonomy&&out.savedPerformance.badges.speed);
 assert.equal(out.savedPerformance.badges.mastery,false,'Earned flags from separate attempts cannot manufacture Mastery');
 assert.equal(p.canonicalQuestState[quest.id].runPerformance.attempts,2);
 assert.deepEqual(p.canonicalQuestState[quest.id].performance,previous);
});
test('future variable-sized groups use explicit intermediate/final rewards and preserve old first-win stars on replay',()=>{
 for(const total of [3,7,11])for(let position=1;position<=total;position++){
  const q={id:'future-'+position,legacyIndex:null,ordinal:30+position,position};
  const rewards=questRewardDefinition(q,{total});assert.equal(rewards.stars,position===total?3:position===Math.ceil(total/2)?2:1);
  const p={xp:42,shards:7,canonicalQuestState:{[q.id]:{solved:true,stars:1,performance:{seconds:80},badges:{}}}};
  const out=applyQuestVictory(p,{...q,rewards},facts);assert.equal(out.stars,0);assert.equal(p.canonicalQuestState[q.id].stars,1);
  assert.equal(out.questPassed,!!rewards.bonus,'A separately unclaimed bonus still requires this successful play');
  assert.equal(p.xp,42+(rewards.bonus?25:0),'Replay never re-credits first-win XP');
 }
});
