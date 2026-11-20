import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalCampaignQuestDecision,canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {applyLegacyVictory} from '../src/campaign/legacy-victory.js';
import {createPlayReviewNavigation,playReviewQuestDecision,switchPlayReviewAttempt} from '../src/persistence/play-review-navigation.js';

const quests=canonicalQuestList();

test('review opens first, middle and last quests of every owned Adventure without changing progress',()=>{
 const progress={solved:{},canonicalQuestState:{},performances:{},badges:{},stars:{},challenges:{},skyHistoryVersion:4};
 const before=structuredClone(progress);
 const packIds=[...new Set(quests.map(quest=>quest.packId))];
 const context={entitlements:packIds,signedIn:true,cloudReady:true};
 for(const id of packIds){
  const pack=quests.filter(quest=>quest.packId===id);
  for(const quest of [pack[0],pack[Math.floor(pack.length/2)],pack.at(-1)]){
   const normal=canonicalCampaignQuestDecision(quest,progress,context);
   assert.equal(playReviewQuestDecision(normal,false),normal);
   assert.equal(playReviewQuestDecision(normal,true).status,'ready',quest.id);
  }
 }
 assert.deepEqual(progress,before);
 const legacy=quests.findLast(q=>q.legacyIndex!==null&&canonicalCampaignQuestDecision(q,progress,context).status==='prerequisite');
 applyLegacyVictory(progress,legacy.legacyIndex,{seconds:60,qualifying:true,assistanceUsed:false,mistakeCommitted:false,qualifiedDay:'2026-11-20'});
 assert.deepEqual(Object.keys(progress.solved),[String(legacy.legacyIndex)]);
 assert.deepEqual(Object.keys(progress.performances),[String(legacy.legacyIndex)]);
 assert.equal(canonicalCampaignQuestDecision(legacy,progress,context).reason,'replay');
});

test('review only overrides a prerequisite and preserves existing replay and attempt decisions',()=>{
 for(const status of ['ready','auth-required','sync-required','pack-locked','entitlements-loading','entitlements-unavailable','missing-content','catalogue-incompatible']){
  const normal={status};
  assert.equal(playReviewQuestDecision(normal,true),normal);
 }
});

test('denies offline, failed and stale reads, even after switching away and back',async()=>{
 let owner='reviewer',generation=1,online=true,reply=true,reads=0,resolve;
 const client={async rpc(name,args){
  reads++;
  assert.equal(name,'lumen_can_use_play_review');
  assert.equal(args.p_expected_user_id,owner);
  return typeof reply==='function'?reply():{data:reply};
 }};
 const review=createPlayReviewNavigation(()=>online?{owner,client,generation}:null);
 assert.equal(review.available(),false);
 assert.equal(await review.refresh(),true);
 online=false;review.clear();
 assert.equal(review.available(),false);
 assert.equal(await review.refresh(),false);
 assert.equal(reads,1);
 online=true;
 reply=()=>new Promise(done=>{resolve=done});
 const stale=review.refresh();
 owner='player';generation++;
 assert.equal(review.available(),false);
 reply=false;
 assert.equal(await review.refresh(),false);
 owner='reviewer';generation++;
 resolve({data:true});
 assert.equal(await stale,false);
 assert.equal(review.available(),false);
 reply={allowed:true};
 assert.equal(await review.refresh(),false);
 reply=()=>{throw Error('offline')};
 assert.equal(await review.refresh(),false);
 reply=true;
 assert.equal(await review.refresh(),true);
 reply=false;
 assert.equal(await review.refresh(),false,'revocation applies on the next selection');
});

test('a newer read supersedes an earlier positive response for the same session',async()=>{
 let finish;
 const client={rpc:()=>new Promise(resolve=>{finish=resolve})};
 const review=createPlayReviewNavigation(()=>({owner:'reviewer',client,generation:1}));
 const first=review.refresh(),finishFirst=finish;
 const second=review.refresh();
 finish({data:false});
 assert.equal(await second,false);
 finishFirst({data:true});
 assert.equal(await first,false);
 assert.equal(review.available(),false);
});

test('review selection preserves and resumes the same attempt only for its owner',()=>{
 const entries=new Map();
 const storage={getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};
 const attempt={questId:12,attemptId:'run',mode:'campaign',state:'PAUSED',startedAt:1,board:[[2]],activeDuration:4200,helpUses:{hint:1}};
 storage.setItem('active',JSON.stringify(attempt));
 assert.equal(switchPlayReviewAttempt(storage,'active','reviewer',attempt,'other').saved,null);
 assert.equal(storage.getItem('active'),null);
 assert.equal(switchPlayReviewAttempt(storage,'active','different',null,12).saved,null);
 const restore=switchPlayReviewAttempt(storage,'active','reviewer',null,12);
 assert.deepEqual(restore.saved,attempt);
 assert.deepEqual(JSON.parse(storage.getItem('active')),attempt);
 restore.commit();
 assert.equal(entries.size,1);
});
