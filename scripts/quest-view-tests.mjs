import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import * as canonical from '../src/campaign/canonical-quests.js';
import {CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {CONSTELLATIONS} from '../src/campaign/data.js';
import {chapterForGrid} from '../src/campaign/progression.js';
import {attemptAnalyticsProperties} from '../src/analytics/events.js';
import {readQuestView} from '../src/campaign/quest-view.js';
import {performanceAttempt,badgeCooldownRemaining} from '../src/campaign/performance.js';
import {questPerformanceRecord} from '../src/campaign/quest-rules.js';

const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
test('actual victory/share recap uses active stable performance and membership at any numeric frontier',()=>{
 const quest=canonical.canonicalQuestList().find(q=>q.legacyIndex===null),progress={solved:{0:1},canonicalQuestState:{}};
 const ctx={...canonical,CONTENT_CONSTELLATIONS,readQuestView,performanceAttempt,activeQuest:()=>quest,levelIndex:0,lumenProgress:progress,
  lumenEntitlements:[],activeGameSeconds:()=>20,formatDuration:s=>s+'s',attemptEngine:{snapshot:()=>({qualifying:true})}};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'successAchievement'),ctx);
 const before=JSON.stringify(progress),a=ctx.successAchievement();ctx.levelIndex=70;const b=ctx.successAchievement();
 assert.deepEqual(a,b);assert.equal(a.canonicalNumber,quest.ordinal);assert(a.run.mastery&&a.run.qualifying);
 assert.equal(a.total,canonical.canonicalQuestList().filter(q=>q.constellationId===quest.constellationId).length);
 assert.equal(a.canonicalTotal,canonical.canonicalQuestList().length,'Sharing uses the current campaign, not the numeric namespace total');
 const drawn=[];
 ctx.document={createElement:()=>({getContext:()=>({createLinearGradient:()=>({addColorStop(){}}),fillRect(){},beginPath(){},arc(){},fill(){},strokeRect(){},fillText:text=>drawn.push(text)})})};
 ctx.wrapCanvasText=()=>{};ctx.location={host:'fixture'};ctx.campaignQuestCount=()=>196;
 vm.runInContext(functionSource(source,'shareCardCanvas'),ctx);
 ctx.shareCardCanvas({...a,canonicalNumber:401,canonicalTotal:407});
 assert(drawn.includes('Quête 401 / 407'),'Exported bitmap follows supplied catalogue growth');
 assert.equal(JSON.stringify(progress),before);
});
test('live sky badge refresh follows stable card IDs after insertion, reorder and progress replacement',()=>{
 const quests=canonical.canonicalQuestList(),inserted=quests.find(q=>q.legacyIndex===null);
 const legacy=quests.find(q=>q.constellationId===inserted.constellationId&&q.legacyIndex!==null);
 const cards=[inserted,legacy].map(q=>{const card={dataset:{questId:q.id},innerHTML:'initial',paused:false};card.classList={toggle:(_,on)=>{card.paused=on}};return card});
 cards.push({dataset:{questId:'removed-content'},innerHTML:'untouched'});
 let refresh,stopped=false;
 const ctx={...canonical,CONTENT_CONSTELLATIONS,readQuestView,questPerformanceRecord,badgeCooldownRemaining,lumenProgress:{},
  badgeCooldownRefreshTimer:null,setInterval:fn=>(refresh=fn,1),clearInterval:()=>{stopped=true},
  document:{getElementById:()=>({hidden:false}),querySelectorAll:()=>cards},
  skyNavigation:{selectedConstellation:()=>({canonicalOnly:false})},mapConstellation:0,
  mapConstellationRange:()=>({quests:[legacy.legacyIndex]}),
  performanceBadges:i=>'numeric:'+i,canonicalPerformanceBadges:id=>'stable:'+id};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'startBadgeCooldownRefresh'),ctx);
 ctx.startBadgeCooldownRefresh();
 refresh();assert(cards.every(c=>c.innerHTML==='initial'||c.innerHTML==='untouched'),'Unsolved cards keep their existing availability UI');
 const stamp=new Date(Date.now()+300000).toISOString();
 ctx.lumenProgress={solved:{[legacy.legacyIndex]:1},performances:{[legacy.legacyIndex]:{lastQualifiedAt:stamp}},canonicalQuestState:{[inserted.id]:{solved:true,runPerformance:{lastQualifiedAt:stamp}}}};
 const before=JSON.stringify(ctx.lumenProgress);refresh();
 assert.equal(cards[0].innerHTML,'stable:'+inserted.id,'Inserted card must never borrow the numeric card at its offset');
 assert.equal(cards[1].innerHTML,'numeric:'+legacy.legacyIndex);
 assert(cards[0].paused&&cards[1].paused,'Both saved formats expose the same cooldown state');
 assert.equal(cards[2].innerHTML,'untouched');
 cards.reverse();refresh();assert.equal(cards[1].innerHTML,'numeric:'+legacy.legacyIndex);
 ctx.skyNavigation.selectedConstellation=()=>({canonicalOnly:true});
 cards[2].innerHTML='stale';refresh();assert.equal(cards[2].innerHTML,'stable:'+inserted.id,'Canonical-only views use the same stable lookup');
 assert.equal(JSON.stringify(ctx.lumenProgress),before,'Refresh must not write progress');
 ctx.document.getElementById=()=>({hidden:true});refresh();assert(stopped);
});

test('inserted quest telemetry belongs to its stable identity, independently of the dormant numeric frontier',()=>{
 const quest=canonical.canonicalQuestList().find(q=>q.legacyIndex===null);
 const progress={solved:{0:1},performances:{0:{attempts:3},70:{attempts:9}},canonicalQuestState:{[quest.id]:{solved:true,badges:{speed:true}}}};
 const before=JSON.stringify(progress),payloads=[];
 const ctx={...canonical,CONTENT_CONSTELLATIONS,CONSTELLATIONS,chapterForGrid,attemptAnalyticsProperties,readQuestView,
  canonicalActiveQuest:quest,levelIndex:0,n:quest.size,lumenProgress:progress,
  attemptEngine:{snapshot:()=>({attemptId:'one-run',resetCount:0})},solvedCount:()=>1,
  guidedErrorsEnabled:()=>false,document:{getElementById:()=>({checked:false})},
  trackLumenEvent:(name,id,props)=>payloads.push({name,id,props})};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'currentAttemptAnalytics')+'\n'+functionSource(source,'trackAttemptEvent'),ctx);
 const first=ctx.currentAttemptAnalytics();
 assert.equal(first.stable_quest_id,quest.id);assert.equal(first.quest_ordinal,quest.ordinal);
 assert.equal(first.quest_index,null,'An inserted quest must not claim the dormant historical key');
 assert.equal(first.quest_attempt_number,null,'An absent canonical attempt counter must not borrow another quest count');
 ctx.levelIndex=70;assert.deepEqual(ctx.currentAttemptAnalytics(),first);
 ctx.trackAttemptEvent('hint_used');assert.equal(payloads[0].id,null,'Historical RPC number must not identify an unrelated quest');
 for(const event of ['result_shared','challenge_completed','challenge_share_completed']){
  ctx.trackAttemptEvent(event);assert.equal(payloads.at(-1).id,null);assert.equal(payloads.at(-1).props.stable_quest_id,quest.id);
 }
 ctx.lastTrackedPuzzle=null;vm.runInContext(functionSource(source,'trackCurrentPuzzleStart'),ctx);
 ctx.trackCurrentPuzzleStart();ctx.levelIndex=0;ctx.trackCurrentPuzzleStart();
 assert.equal(payloads.filter(p=>p.name==='puzzle_start').length,1,'A dormant numeric change is not a different quest');
 ctx.canonicalActiveQuest=canonical.canonicalQuestList().find(q=>q.legacyIndex===null&&q.id!==quest.id);ctx.trackCurrentPuzzleStart();
 assert.equal(payloads.filter(p=>p.name==='puzzle_start').length,2,'A different stable quest starts even at the same numeric frontier');
 assert.equal(JSON.stringify(progress),before,'Telemetry cannot mutate saves or badges');
});

test('one read view preserves both save formats and derives growing constellation totals',()=>{
 const quests=canonical.canonicalQuestList();
 for(const quest of [quests[0],quests.find(q=>q.legacyIndex===null),quests.at(-1)]){
  const p=quest.legacyIndex!==null?{solved:{[quest.legacyIndex]:1},performances:{[quest.legacyIndex]:{version:3,attempts:2,badges:{mastery:true}}}}:{canonicalQuestState:{[quest.id]:{solved:true,badges:{mastery:true}}}};
  const before=JSON.stringify(p),view=readQuestView(quest,p,quests,CONTENT_CONSTELLATIONS);
  assert(view.solved&&view.badges.mastery);assert.equal(view.id,quest.id);
  assert.equal(view.attemptNumber,quest.legacyIndex!==null?3:null);
  for(const k of [1,4]){
   const added=Array.from({length:k},(_,i)=>({...quest,id:'synthetic-'+i,ordinal:quests.length+i+1,legacyIndex:null}));
   assert.equal(readQuestView(quest,p,[...quests,...added],CONTENT_CONSTELLATIONS).total,view.total+k);
  }
  assert.equal(JSON.stringify(p),before);
 }
 const first=quests[0];assert.deepEqual(readQuestView(first,{performances:{0:{version:1,badges:{mastery:true}}}},quests,CONTENT_CONSTELLATIONS).badges,{},'Incompatible old flags cannot manufacture an earned badge');
});
