import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {catalogueQuestDecision} from '../src/campaign/catalogue-access.js';
import {functionSource} from './source-tools.mjs';
import {QUEST_MILESTONES,questLearningRules} from '../src/campaign/quest-rules.js';
import {createDiagnostics} from '../src/testing/diagnostics.js';

test('explicit numeric diagnostic entry clears a preceding stable quest before initialization',()=>{
 const progress={solved:{0:1}},model={levelIndex:70,canonicalActiveQuest:{id:'previous-stable',legacyIndex:null},lumenProgress:progress};
 let selected;
 const diagnostics=createDiagnostics(model,{init(){selected={index:model.levelIndex,canonical:model.canonicalActiveQuest}},closeTutorial(){}});
 diagnostics.setupQuest(6);
 assert.equal(selected.index,6);assert.equal(selected.canonical,null);
 assert.equal(model.lumenProgress,progress);
});

test('discovery ends after six visible quests for either persistence identity',()=>{
 for(const legacyIndex of [null,20]){
  const quest={id:'target',ordinal:7,legacyIndex,packId:'a',constellationId:'c'};
  assert.equal(catalogueQuestDecision(quest,{},[quest],{signedIn:false}).status,'auth-required');
  assert.equal(catalogueQuestDecision(quest,{},[quest],{signedIn:true,cloudReady:false}).status,'sync-required');
  assert.equal(catalogueQuestDecision(quest,{},[quest],{signedIn:true,cloudReady:true}).status,'ready');
  const early={...quest,ordinal:6};
  assert.equal(catalogueQuestDecision(early,{},[early],{signedIn:false}).status,'ready');
 }
});

test('actual assistance controls and onboarding follow visible milestones at different dormant frontiers',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const ordinal of [1,3,5,6,7,10,11,30])for(const levelIndex of [0,70]){
  const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,style:{},dataset:{},classList:{add(){},remove(){}}});return nodes.get(id)};
  const ctx={QUEST_MILESTONES,questLearningRules,activeQuestOrdinal:()=>ordinal,levelIndex,replayMode:false,socialChallenge:null,
   lumenProgress:{},onboardingPreferences:{auto:()=>true},scriptedLearningActive:()=>ordinal===1,localStorage:{getItem:()=>null},document:{getElementById:node},pauseGameClock(){}};
  vm.createContext(ctx);for(const fn of ['configureLearningMode','maybeShowBadgeMilestone','maybeShowAutonomy','learningSkyDiscoveryRequired'])vm.runInContext(functionSource(source,fn),ctx);
  ctx.configureLearningMode();assert.equal(node('autoCross').disabled,ordinal===1);
  assert.equal(node('guidedErrors').disabled,ordinal<6);assert.equal(node('guidedErrors').checked,ordinal<11);
  ctx.maybeShowBadgeMilestone();assert.equal(node('badgeUnlockOverlay').hidden,true);
  ctx.maybeShowAutonomy();assert.equal(node('autonomyOverlay').hidden,ordinal!==11);
  assert.equal(ctx.learningSkyDiscoveryRequired(),false);
 }
});

test('guest access retains completed quests and real started campaign attempts, never a READY boundary or social attempt',()=>{
 for(const legacyIndex of [null,20]){
  const quest={id:'saved',ordinal:30,legacyIndex,packId:'a',constellationId:'c'};
  const p=legacyIndex===null?{canonicalQuestState:{saved:{solved:true}}}:{solved:{20:1}};
  const before=JSON.stringify(p);
  assert.equal(catalogueQuestDecision(quest,p,[quest],{signedIn:false}).status,'ready');
  for(const mode of ['campaign','replay'])assert.equal(catalogueQuestDecision(quest,{},[quest],{signedIn:false,attempt:{questId:'saved',mode,startedAt:1}}).status,'ready');
  for(const attempt of [{questId:'saved',mode:'campaign'},{questId:'saved',mode:'challenge',startedAt:1}])assert.equal(catalogueQuestDecision(quest,{},[quest],{signedIn:false,attempt}).status,'auth-required');
  assert.equal(JSON.stringify(p),before);
 }
});

test('authenticated replay and started access beyond discovery cannot bypass an unverified restore',()=>{
 for(const legacyIndex of [null,20]){
  const quest={id:'saved',ordinal:30,legacyIndex,packId:'a',constellationId:'c'};
  const progress=legacyIndex===null?{canonicalQuestState:{saved:{solved:true}}}:{solved:{20:1}};
  const before=JSON.stringify(progress);
  assert.equal(catalogueQuestDecision(quest,progress,[quest],{signedIn:true,cloudReady:false}).status,'sync-required');
  assert.equal(catalogueQuestDecision(quest,{},[quest],{signedIn:true,cloudReady:false,attempt:{questId:'saved',mode:'replay',startedAt:1}}).status,'sync-required');
  assert.equal(catalogueQuestDecision(quest,progress,[quest],{signedIn:true,cloudReady:true}).status,'ready');
  assert.equal(JSON.stringify(progress),before);
 }
});

test('hint discovery pricing follows the active visible quest, independent of dormant legacy position',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const ordinal of [6,7,10,11,80]){
  const ctx={QUEST_MILESTONES,socialChallenge:null,canonicalActiveQuest:{id:'active',ordinal},levelIndex:0,activeQuestOrdinal:()=>ordinal};
  vm.createContext(ctx);vm.runInContext(functionSource(source,'learningHintsAreFree'),ctx);
  assert.equal(ctx.learningHintsAreFree(),ordinal<=10);
  ctx.levelIndex=70;assert.equal(ctx.learningHintsAreFree(),ordinal<=10);
 }
});
test('a reloaded paid/free hint remains a hint in victory facts after the volatile flag resets',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const count of [0,1,3]){
  const ctx={usedHintThisGame:false,attemptEngine:{snapshot:()=>({helpUses:{hint:count}})}};
  vm.createContext(ctx);vm.runInContext(functionSource(source,'hintUsedInAttempt'),ctx);
  assert.equal(ctx.hintUsedInAttempt(),count>0);
  ctx.usedHintThisGame=true;assert.equal(ctx.hintUsedInAttempt(),true);
 }
});

test('cold startup reads an already started attempt before access can replace its board',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const saved={attemptId:'continued',questId:21,mode:'campaign',state:'RUNNING',startedAt:1};
 const ctx={attemptEngine:{snapshot:()=>null,storageKey:'attempt'},lumenUser:null,localStorage:{getItem:key=>key==='attempt'?JSON.stringify(saved):'owner'}};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'campaignAccessAttempt'),ctx);
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.campaignAccessAttempt())),saved);
 const quest={id:'base-q021',legacyIndex:20,ordinal:28};
 assert.equal(catalogueQuestDecision(quest,{},[quest],{signedIn:false,attempt:ctx.campaignAccessAttempt()}).status,'ready');
 saved.startedAt=null;assert.equal(ctx.campaignAccessAttempt(),null,'READY does not acquire access');
 saved.startedAt=1;ctx.lumenUser={id:'other'};assert.equal(ctx.campaignAccessAttempt(),null,'Another owner cannot reuse the cached attempt');
});

test('launching a replay clears a terminal attempt for either saved quest format',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const state of ['COMPLETED','ABANDONED'])for(const canonical of [false,true]){
  let cleared=0;const ctx={leavePendingVictoryForNavigation:()=>{},questIsAccessible:()=>true,skyTourActive:()=>false,questIsCompleted:()=>true,canonicalQuestAvailable:()=>true,
   lumenProgress:{},badgeCooldownRemaining:()=>0,questPerformanceRecord:()=>({}),lumenUser:null,currentQuestPosition:()=>0,currentQuestLimit:()=>100,
   attemptEngine:{snapshot:()=>({state}),clear:()=>cleared++},document:{getElementById:()=>({})},loadPuzzle(){},refreshJourney(){}};
  vm.createContext(ctx);vm.runInContext(functionSource(source,canonical?'startCanonicalQuest':'launchReplay'),ctx);
  if(canonical)ctx.startCanonicalQuest({id:'q'});else ctx.launchReplay(20);
  assert.equal(cleared,1,state+' '+canonical);
 }
});

test('cold numeric replay restores its quest and mode before strict engine restoration',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 const saved={attemptId:'replay',questId:21,mode:'replay',state:'PAUSED',startedAt:1};
 const ctx={socialChallenge:null,qaActive:false,lumenUser:null,levelIndex:19,replayMode:false,attemptEngine:{storageKey:'attempt'},localStorage:{getItem:key=>key==='attempt'?JSON.stringify(saved):'owner'},canonicalQuestForLegacy:i=>({legacyIndex:i}),questIsAccessible:()=>true,canonicalQuestList:()=>[],canonicalAttemptToResume:()=>null};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'restoreCanonicalCampaignAttempt'),ctx);ctx.restoreCanonicalCampaignAttempt();
 assert.equal(ctx.levelIndex,20);assert.equal(ctx.replayMode,true);
});

test('contextual learning tips follow the visible lesson, never a dormant numeric frontier',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const ordinal of [2,7])for(const levelIndex of [1,70]){
  const viewed=new Set();
  const ctx={onboardingPreferences:{seen:id=>viewed.has(id),markSeen:id=>viewed.add(id)},activeQuestOrdinal:()=>ordinal,learningQuestActive:()=>ordinal<=2,socialChallenge:null,replayMode:false,levelIndex,learningTipSeen:new Set(),updates:0,updateScriptedLearning(){ctx.updates++}};
  vm.createContext(ctx);vm.runInContext(functionSource(source,'showLearningTip'),ctx);ctx.showLearningTip('tools','Fixture','Fixture');
  assert.equal(ctx.updates,ordinal===2?1:0,ordinal+' at '+levelIndex);
  ctx.learningTipSeen.clear();ctx.showLearningTip('tools','Fixture','Fixture');
  assert.equal(ctx.updates,ordinal===2?1:0,'A remembered optional explanation is not repeated');
 }
});

test('acquired guest attempts remain intact but need an account to confirm rewards beyond discovery',async()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
 for(const canonical of [false,true]){
  const progress={solved:{0:1},xp:15,shards:3},before=JSON.stringify(progress);
  let held=0,offered=0,commits=0;
  const ctx={QUEST_MILESTONES,celebrated:false,pendingVictoryView:null,authSessionPending:false,qaActive:false,lumenUser:null,socialChallenge:null,
   canonicalActiveQuest:canonical?{id:'stable'}:null,activeQuestOrdinal:()=>20,lumenProgress:progress,haptic(){},learningReplayActive:()=>false,
   activeGameSeconds:()=>20,attemptEngine:{snapshot:()=>({})},hintUsedInAttempt:()=>false,questFailed:false,localCalendarDay:()=> '2026-10-22',levelIndex:20,
   pauseGameClock(){held++},persistAttemptBoard(){held++},maybeOfferAccount(){offered++},msg:{textContent:''},
   celebrateCanonicalSuccess(){commits++},applyLegacyVictory(){throw Error('Guest post-discovery rewards must await account confirmation')}};
  vm.createContext(ctx);vm.runInContext(functionSource(source,'celebrateSuccess'),ctx);await ctx.celebrateSuccess();
  assert.equal(held,2);assert.equal(offered,1);assert.equal(commits,0);assert.equal(JSON.stringify(progress),before);
  assert.match(ctx.msg.textContent,/compte/);
 }
});

test('preparing an ordinary restored board never resumes its paused clock implicitly',()=>{
 const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');let resumed=0;
 const ctx={activeBonusChallenge:()=>null,questFailed:true,questStarted:false,document:{getElementById:()=>({})},resumeGameClock(){resumed++}};
 vm.createContext(ctx);vm.runInContext(functionSource(source,'prepareQuestStart'),ctx);ctx.prepareQuestStart();
 assert.equal(resumed,0,'The attempt mask owns the explicit resume gesture');assert.equal(ctx.questStarted,true);
});
