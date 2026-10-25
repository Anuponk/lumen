import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {functionSource} from './source-tools.mjs';
import {QUEST_MILESTONES,questLearningRules} from '../src/campaign/quest-rules.js';
import {createOnboardingPreferences} from '../src/ui/onboarding-preferences.js';

const source=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
test('fresh ordinary victories let the player continue without a required sky tour',()=>{
 for(const ordinal of [1,2,3,4,5]){
  let advanced=0,sky=0;
  const ctx={QUEST_MILESTONES,activeQuestOrdinal:()=>ordinal,replayMode:false,socialChallenge:null,
   syncPresentation:{celebration(){}},pendingVictoryView:null,learningReplayActive:()=>false,
   advanceToNextPuzzle(){advanced++},hideSuccess(){},openJourneyMap(){sky++}};
  vm.createContext(ctx);
  for(const fn of ['learningSkyDiscoveryRequired','handleSuccessAdvance'])vm.runInContext(functionSource(source,fn),ctx);
  ctx.handleSuccessAdvance();assert.equal(advanced,1,`quest ${ordinal} advances directly`);assert.equal(sky,0);
 }
});
test('voluntary auto preference survives recreation and isolates guest and accounts, including denied storage',()=>{
 for(const denied of [false,true]){
  const values=new Map();let owner=null;
  const storage={getItem:k=>values.get(k)||null,setItem(k,v){if(denied)throw Error('quota');values.set(k,v)}};
  const create=()=>createOnboardingPreferences({storage,getOwner:()=>owner});
  const p=create();assert.equal(p.auto(),true);p.setAuto(false);p.markSeen('drag');
  owner='a';assert.equal(p.auto(),true);assert.equal(p.seen('drag'),false);p.setAuto(false);
  owner='b';assert.equal(p.auto(),true);p.markSeen('hold');
  owner='a';assert.equal(p.auto(),false);assert.equal(p.seen('hold'),false);
  owner=null;assert.equal(p.auto(),false);assert.equal(p.seen('drag'),true);
  if(!denied){assert.equal(create().auto(),false);owner='a';assert.equal(create().auto(),false)}
 }
});
test('quest-six lesson never toggles the real control; unchecked is satisfied, checked requires actual action',()=>{
 for(const checked of [true,false]){
  let saved=0;const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{checked,hidden:true,classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){}});return nodes.get(id)};
  const progress={};
  const ctx={QUEST_MILESTONES,activeQuestOrdinal:()=>6,socialChallenge:null,replayMode:false,learningReplayActive:()=>false,lumenProgress:progress,
   document:{getElementById:node},saveLumenProgress(){saved++},configureLearningMode(){},applyQuestRestrictions(){},updateScriptedLearning(){},learningTip:null};
  vm.createContext(ctx);for(const fn of ['autoMarkingLessonRequired','finishAutoMarkingLesson','maybeShowContextualLesson'])vm.runInContext(functionSource(source,fn),ctx);
  ctx.maybeShowContextualLesson();assert.equal(node('autoCross').checked,checked);
  assert.equal(saved,checked?0:1);assert.equal(!!progress.autoCrossUnlockSeen,!checked);
  if(checked){node('autoCross').checked=false;ctx.finishAutoMarkingLesson();assert.equal(progress.autoCrossUnlockSeen,1)}
  assert.equal(ctx.autoMarkingLessonRequired(),false);
 }
});
test('quest 2 is free play; the sixth teaching quest and six-quest guest boundary remain distinct',()=>{
 assert.equal(questLearningRules(1).scripted,true);
 for(const ordinal of [2,3,4,5])assert.equal(questLearningRules(ordinal).scripted,false);
 assert.equal(QUEST_MILESTONES.fullBadges,6);assert.equal(QUEST_MILESTONES.discovery,6);
});
test('verified account restoration applies its own auto choice without restarting the selected run',()=>{
 const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{checked:true,classList:{add(){},remove(){}}});return nodes.get(id)};
 const attempt={attemptId:'preserved',board:[[1,0],[0,0]]},before=JSON.stringify(attempt);
 const ctx={QUEST_MILESTONES,questLearningRules,activeQuestOrdinal:()=>3,replayMode:false,scriptedLearningActive:()=>false,
  onboardingPreferences:{auto:()=>ctx.lumenUser?.id==='b'},onboardingPreferenceOwner:null,socialChallenge:null,learningReplayActive:()=>false,
  verifiedOwner:'a',localStorage:{getItem:key=>key==='lumenCloudOwnerId'?ctx.verifiedOwner:null},sessionStorage:{getItem:()=>null},document:{getElementById:node},
  activeBonusChallenge:()=>null,lumenProgress:{stars:{}},lumenUser:{id:'a'},cloudProfileReady:false,state:null,puz:null,
  syncPresentationOwner:null,pendingNavigationEntries:[],syncPresentation:{reset(){}},pendingVictoryView:null,
  accountOfferSignInPending:false,lumenNickname:'',cloudProfileDirty:false,cloudProfileFailure:null,canonicalOutboxNotice:null,
  syncMobileAuthUI(){},updateAdminTools(){},accountRequired:()=>false,render(){},maybeShowContextualLesson(){},
  init(){throw Error('Preference restore must not restart the board')},saveLumenProgress(){throw Error('Preference restore must not save rewards')}
 };
 vm.createContext(ctx);for(const fn of ['configureLearningMode','applyQuestRestrictions','updateAuthUI'])vm.runInContext(functionSource(source,fn),ctx);
 if(source.includes('function refreshOnboardingPreferenceOwner('))vm.runInContext(functionSource(source,'refreshOnboardingPreferenceOwner'),ctx);
 ctx.updateAuthUI();assert.equal(node('autoCross').checked,true,'Pending account cannot apply an unverified profile');
 ctx.cloudProfileReady=true;ctx.updateAuthUI();assert.equal(node('autoCross').checked,true,'Auth cannot render a board still loading');
 ctx.state=attempt.board;ctx.puz={reg:[[0,0],[1,1]]};ctx.updateAuthUI();assert.equal(node('autoCross').checked,false,'The restored account replaces the startup guest choice');
 node('autoCross').checked=true;ctx.updateAuthUI();assert.equal(node('autoCross').checked,true,'Same-owner refresh preserves the current choice');
 ctx.lumenUser={id:'b'};ctx.updateAuthUI();assert.equal(ctx.onboardingPreferenceOwner,'a','Readiness from another owner is insufficient');
 ctx.verifiedOwner='b';ctx.updateAuthUI();assert.equal(node('autoCross').checked,true);
 ctx.lumenUser={id:'a'};ctx.updateAuthUI();assert.equal(node('autoCross').checked,true,'The previous profile cannot restore another account choice');
 ctx.verifiedOwner='a';ctx.updateAuthUI();assert.equal(node('autoCross').checked,false,'Switching back restores account A');
 ctx.socialChallenge={id:'challenge'};ctx.lumenUser={id:'b'};ctx.updateAuthUI();assert.equal(node('autoCross').checked,false,'Auth cannot change an isolated challenge playstyle');
 assert.equal(JSON.stringify(attempt),before);
});
test('temporary manual lesson and challenge restrictions never overwrite the voluntary preference',()=>{
 for(const preference of [false,true]){
  let ordinal=1,writes=0;
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{classList:{add(){},remove(){}}});return nodes.get(id)};
  const ctx={QUEST_MILESTONES,questLearningRules,activeQuestOrdinal:()=>ordinal,replayMode:false,lumenUser:null,
   scriptedLearningActive:()=>ordinal===1,onboardingPreferences:{auto:()=>preference,setAuto(){writes++}},
   localStorage:{getItem:()=>null},document:{getElementById:node},activeBonusChallenge:()=>({id:'challenge',noAuto:true}),lumenProgress:{stars:{}}};
  vm.createContext(ctx);for(const fn of ['configureLearningMode','applyQuestRestrictions'])vm.runInContext(functionSource(source,fn),ctx);
  ctx.configureLearningMode();assert.equal(node('autoCross').checked,false);
  ordinal=2;ctx.configureLearningMode();assert.equal(node('autoCross').checked,preference);
  ctx.applyQuestRestrictions();assert.equal(node('autoCross').checked,false);
  ctx.configureLearningMode();assert.equal(node('autoCross').checked,preference);assert.equal(writes,0);
 }
});
