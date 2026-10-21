import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as canonical from '../src/campaign/canonical-quests.js';
import {CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {CONSTELLATIONS} from '../src/campaign/data.js';
import {milestoneFor,isCampaignFinalQuest,isCampaignComplete,campaignQuestCount} from '../src/campaign/progression.js';
import {questIsCompleted} from '../src/persistence/canonical-progress.js';
import {functionSource} from './source-tools.mjs';

const source=readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
const all=canonical.canonicalQuestList();
const complete=quests=>({solved:Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{speed:true}}]))});

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
  milestoneFor,bonusChallengeFor:()=>null,document:{getElementById:id=>elements.get(id)}};
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
