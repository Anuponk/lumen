import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as canonical from '../src/campaign/canonical-quests.js';
import {CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {CONSTELLATIONS} from '../src/campaign/data.js';
import {createCampaign,milestoneFor,isCampaignFinalQuest,isCampaignComplete,campaignQuestCount} from '../src/campaign/progression.js';
import {questIsCompleted} from '../src/persistence/canonical-progress.js';
import {questPerformanceRecord} from '../src/campaign/quest-rules.js';
import {functionSource} from './source-tools.mjs';

const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const all=canonical.canonicalQuestList();
const complete=quests=>({solved:Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{speed:true}}]))});
test('actual campaign UI awards count canonical quests and bonuses, with grandfathering and N+k growth',()=>{
 let quests=[...all];const progress={...complete(all.filter(q=>q.legacyIndex!==null)),badges:{},stars:Object.fromEntries(all.filter(q=>q.legacyIndex!==null&&q.rewards.bonus).map(q=>[q.rewards.bonus.id,1]))};
 const context={lumenProgress:progress,createCampaign,saveLumenProgress(){},canonicalQuestList:()=>quests,
  attemptEngine:{snapshot:()=>null},activeGameSeconds:()=>0};
 const start=source.indexOf('const {normalizeSequentialProgress'),end=source.indexOf(';',start)+1;
 vm.createContext(context);vm.runInContext(source.slice(start,end)+'\nglobalThis.award=awards;',context);context.award();
 assert.equal(progress.badges.master,undefined,'Numeric completion cannot award the current campaign finale');
 assert.equal(progress.badges.challengeAll,undefined,'Old bonus keys are not all current bonuses');
 Object.assign(progress,complete(all));for(const q of all)if(q.rewards.bonus)progress.stars[q.rewards.bonus.id]=1;
 context.award();assert.equal(progress.badges.master,1);assert.equal(progress.badges.challengeAll,1);
 quests.push({...all.at(-1),id:'future-quest',legacyIndex:null,rewards:{stars:1,bonus:null}});
 context.award();assert.equal(progress.badges.master,1,'An old earned finale is never revoked');
 progress.badges={};context.award();assert.equal(progress.badges.master,undefined,'New qualification covers the expanded catalogue');
 progress.canonicalQuestState['future-quest']={solved:true};context.award();assert.equal(progress.badges.master,1);
});

// Minimal DOM for the actual two quest-card renderers, not a copy of their logic.
function questCardFixture(progress,{signedIn=true,cloudReady=true,entryId}={}){
 const elements=[];
 function element(){
  const e={children:[],dataset:{},attributes:{},className:'',innerHTML:'',textContent:'',
   append(...children){this.children.push(...children)},
   appendChild(child){this.children.push(child);return child},
   replaceChildren(...children){this.children=children},
   setAttribute(key,value){this.attributes[key]=String(value)}};
  e.classList={add(name){e.className+=' '+name}};elements.push(e);return e;
 }
 const grid=element(),section=element(),modal=element(),sky=element();
 modal.querySelector=selector=>selector==='#canonicalJourneyPreview'?section:null;
 const entry=CONTENT_CONSTELLATIONS.find(c=>entryId?c.id===entryId:all.some(q=>q.constellationId===c.id&&q.legacyIndex===null));
 const context={...canonical,lumenProgress:progress,qaActive:false,
  lumenUser:signedIn?{id:'synthetic-owner'}:null,cloudProfileReady:cloudReady,
  adventureAccessEntitlements:()=>[],attemptEngine:{snapshot:()=>null},campaignAccessAttempt:()=>null,
  navigationProgress:()=>progress,document:{createElement:element,createElementNS:element,getElementById:id=>id==='puzzleGrid'?grid:id==='mapModal'?modal:id==='skyCard'?sky:null},
  CONTENT_CONSTELLATIONS,mapConstellation:0,
  skyNavigation:{render(){},selectedConstellation:()=>entry},
  mapConstellationRange:()=>({quests:[]}),maybeShowStreakLoss(){},renderDaily(){},
  performanceBadges:()=>'<span>badge historique</span>',canonicalPerformanceBadges:()=>'<span>badge canonique</span>',
  badgeCooldownRemaining:()=>0,questPerformanceRecord,verifiedAstronomicalFigure:()=>true,questIsCompleted,astronomicalPrimarySvg:()=>''};
 vm.createContext(context);
 const names=['canonicalQuestAccess','canonicalQuestAvailable','canonicalQuestLockReason','questIsAccessible','renderMap','renderCanonicalSky','renderCanonicalJourneyPreview','startCanonicalQuest'];
 vm.runInContext(names.map(name=>functionSource(source,name)).join('\n'),context);
 return {context,grid,section,elements,entry,sky};
}

test('a completed replay hold has a visible explanation on touch screens',()=>{
 const quest=all.find(q=>q.legacyIndex===null),progress=complete([quest]);
 const {context,sky}=questCardFixture(progress,{cloudReady:false});context.renderMap();
 const note=sky.children.find(e=>e.className==='sky-note');
 assert.match(note.textContent,/quêtes terminées conservées/i);
 assert.match(note.textContent,/synchronisation du compte requise/i);
});

test('completed canonical cards retain completion in their accessible name during a sync hold',()=>{
 const entry=CONTENT_CONSTELLATIONS.find(c=>all.some(q=>q.constellationId===c.id&&q.legacyIndex===null));
 const members=all.filter(q=>q.constellationId===entry.id),progress=complete(members),before=JSON.stringify(progress);
 const {context,grid}=questCardFixture(progress,{cloudReady:false});
 context.renderMap();
 for(const quest of members){
  const card=grid.children.find(e=>e.dataset.questId===quest.id);
  assert.match(card.className,/\bdone\b/);
  assert.doesNotMatch(card.className,/\blocked\b/);
  assert.match(card.title,/terminée/i,quest.id+' must not lose its completed label');
  assert.match(card.attributes['aria-label'],/terminée/i);
  if(quest.legacyIndex===null){
   assert.equal(card.disabled,true,'Sync hold still blocks replay');
   assert.match(card.title,/synchronisation/i);
   assert.match(card.attributes['aria-label'],/synchronisation/i);
   assert.equal(card.onclick,undefined);
   assert.equal(context.startCanonicalQuest(quest),false,'Direct start retains the cloud guard');
  }else assert.equal(card.disabled,false,'Historical local replay is unchanged');
 }
 assert.equal(JSON.stringify(progress),before,'Browsing cannot grant or rewrite anything');
});

test('same-account reconnect, reload and restored copies preserve history while enforcing action guards',()=>{
 const quest=all.find(q=>q.legacyIndex===null);
 for(const [options,status,reason] of [
  [{cloudReady:false},'sync-required',/synchronisation/i],
  [{signedIn:false},'ready',/rejouable/i],
  [{},'ready',/rejouable/i],
  [{future:true},'catalogue-incompatible',/mets lumen à jour/i]
 ]){
  const original=complete([quest]);if(options.future)original.catalogueOrigin=999999;
  for(let device=0;device<3;device++){
   const progress=JSON.parse(JSON.stringify(original)),before=JSON.stringify(progress);
   const {context,grid,elements}=questCardFixture(progress,options);
   context.renderMap();context.renderCanonicalJourneyPreview();
   assert.equal(context.canonicalQuestAccess(quest).status,status);
   for(const card of [grid.children.find(e=>e.dataset.questId===quest.id),elements.filter(e=>e.dataset.questId===quest.id).at(-1)]){
    assert.match(card.className,/\bdone\b/);assert.doesNotMatch(card.className,/\blocked\b/);
    assert.match(card.title,/terminée/i);assert.match(card.title,reason);
    assert.match(card.attributes['aria-label'],/terminée/i);
    assert.equal(card.disabled,status!=='ready');
    assert.equal(typeof card.onclick,status==='ready'?'function':'undefined');
   }
   if(status!=='ready')assert.equal(context.startCanonicalQuest(quest),false);
   assert.equal(JSON.stringify(progress),before);
  }
 }
});

test('unfinished quests retain prerequisite, ownership and sync locks without acquiring evidence',()=>{
 const inserted=all.find(q=>q.legacyIndex===null);
 const paid=all.find(q=>q.legacyIndex===null&&canonical.canonicalCampaignQuestDecision(q,{}).status==='pack-locked');
 for(const [quest,options,status] of [[inserted,{},'prerequisite'],[inserted,{cloudReady:false},'sync-required'],[paid,{entryId:paid.constellationId},'pack-locked']]){
  const progress={},before=JSON.stringify(progress),{context,grid}=questCardFixture(progress,options);
  context.renderMap();const card=grid.children.find(e=>e.dataset.questId===quest.id);
  assert.equal(context.canonicalQuestAccess(quest).status,status);
  assert.match(card.className,/\blocked\b/);assert.doesNotMatch(card.className,/\bdone\b/);
  assert.equal(card.disabled,true);assert.equal(card.onclick,undefined);
  assert.equal(context.startCanonicalQuest(quest),false);assert.equal(JSON.stringify(progress),before);
 }
});

test('catalogue history distinguishes a completed sync-held quest from a missing prerequisite',()=>{
 const quest=all.find(q=>q.legacyIndex===null),progress=complete([quest]),before=JSON.stringify(progress);
 const {context,elements}=questCardFixture(progress,{cloudReady:false});
 context.renderCanonicalJourneyPreview();
 const card=elements.find(e=>e.dataset.questId===quest.id);
 assert.match(card.className,/\bdone\b/);
 assert.doesNotMatch(card.className,/\blocked\b/,'A preserved completion is not a progression lock');
 assert.equal(card.disabled,true,'Consultation does not authorize replay');
 assert.match(card.textContent,/terminée/i);
 assert.match(card.title,/terminée/i);
 assert.match(card.title,/synchronisation/i);
 assert.equal(card.onclick,undefined);
 assert.equal(JSON.stringify(progress),before);
});

test('actual sky adapter counts completed canonical-only quests instead of absent legacy shape slots',()=>{
 const entry=CONTENT_CONSTELLATIONS.find(c=>c.canonicalOnly);
 const quests=all.filter(q=>q.constellationId===entry.id),progress=complete(quests);
 const context={...canonical,document:{},CONSTELLATIONS,lumenProgress:progress,
  questIsCompleted,astronomicalDisplayShape:shape=>shape,constellationLitAt:()=>0,
  createSkyNavigation:options=>options};
 vm.createContext(context);
 const start=source.indexOf('const skyNavigation=createSkyNavigation('),end=source.indexOf('const SKY_TOUR_STEPS',start);
 vm.runInContext(source.slice(start,end)+'\nglobalThis.options=skyNavigation;',context);
 assert.equal(context.options.getLit(entry),quests.length);
 assert.equal(context.options.getShape(entry).count,quests.length);
 assert.equal(context.options.getBadgeCounts(entry).speed,quests.length);
 assert.equal(JSON.stringify(progress),JSON.stringify(complete(quests)),'Rendering must not migrate or grant progress');
});

test('victory recap retains a previously earned Rapidité alongside newly acquired badges',()=>{
 const element={innerHTML:'',classList:{toggle(){}}};
 const context={document:{getElementById:()=>element},performanceIcon:key=>key};vm.createContext(context);
 vm.runInContext(functionSource(source,'renderSuccessRewards'),context);
 context.renderSuccessRewards(0,{run:{autonomy:true,speed:false},badges:{autonomy:true,speed:true},qualifying:true},{speed:true});
 assert.match(element.innerHTML,/Rapidité/);
 assert.match(element.innerHTML,/déjà obtenu/,'Prior badge must not be announced as newly acquired');
 assert.match(element.innerHTML,/Autonomie/);
 assert.doesNotMatch(element.innerHTML,/étoile/,'Replay cannot announce a new star');
});

test('Grand Chien 8/10 cannot advertise a final constellation quest',()=>{
 const group=all.filter(q=>q.constellationId==='real-24'),quest=group.at(-3);
 assert.notEqual(quest.legacyIndex,null,'Reported historical grid must remain covered');
 const elements=new Map(['challengeBanner','challengeTitle','challengeCopy'].map(id=>[id,{}]));
 const context={...canonical,canonicalActiveQuest:null,levelIndex:quest.legacyIndex,lumenProgress:{stars:{}},
  milestoneFor,activeBonusChallenge:()=>null,bonusChallengeFor:()=>null,document:{getElementById:id=>elements.get(id)}};
 vm.createContext(context);vm.runInContext(functionSource(source,'renderXP'),context);context.renderXP();
 assert.doesNotMatch(elements.get('challengeTitle').textContent||'',/Défi final/);
 context.canonicalActiveQuest=group.at(-1);context.renderXP();
 assert.match(elements.get('challengeTitle').textContent,/Défi final/,'The real last inserted quest receives the finale banner');
 assert.doesNotMatch(elements.get('challengeCopy').textContent,/complétée|\+2/,'A finale position alone cannot promise completion or invent a reward');
});

test('completing all numeric quests cannot finish an expanded canonical campaign',()=>{
 const progress=complete(all.filter(q=>q.legacyIndex!==null));
 const assignment=source.match(/endgamePending=firstCompletion&&[^;]+;/)[0];
 const context={...canonical,firstCompletion:true,levelIndex:campaignQuestCount()-1,
  isCampaignFinalQuest,isCampaignComplete,lumenProgress:progress};
 vm.createContext(context);vm.runInContext(assignment,context);
 assert.equal(context.endgamePending,false);
});

test('scope completion, counts and finale follow nonempty catalogue membership after growth and renumbering',()=>{
 const quests=[{id:'old',legacyIndex:0,packId:'p',constellationId:'c',ordinal:12},
  {id:'added',legacyIndex:null,packId:'p',constellationId:'c',ordinal:98},
  {id:'other',legacyIndex:null,packId:'p2',constellationId:'c2',ordinal:250}];
 const progress=complete([quests[0],quests[2]]),before=JSON.stringify(progress);
 assert.deepEqual(canonical.canonicalScopeProgress(progress,{constellationId:'c'},quests),{total:2,completed:1,complete:false,badges:{autonomy:0,speed:0,noError:0,mastery:0},mastered:false});
 assert.equal(canonical.canonicalScopeProgress(progress,{constellationId:'absent'},quests).complete,false);
 assert.equal(canonical.canonicalCampaignComplete(progress,[]),false);
 assert.equal(canonical.canonicalCampaignComplete(progress,quests),false);
 assert.notEqual(canonical.canonicalQuestMilestone(quests[0],quests)?.kind,'boss');
 assert.equal(canonical.canonicalQuestMilestone(quests[1],quests).kind,'boss');
 assert.equal(canonical.canonicalCampaignComplete(complete(quests),quests),true);
 assert.equal(JSON.stringify(progress),before);
});
