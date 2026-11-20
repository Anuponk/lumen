import assert from "node:assert/strict";
import fs from "node:fs";
import vm from 'node:vm';
import {challengeEligibility} from '../src/campaign/social-challenge.js';
import {badgeCooldownLabel} from '../src/campaign/performance.js';

const html=fs.readFileSync("index.html","utf8");
const ui=fs.readFileSync("src/ui/game-screen.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
const domain=fs.readFileSync("src/campaign/social-challenge.js","utf8");

for(const id of ["challengeIntro","challengeNameModal","challengeShareModal","challengeResultModal","myChallengesModal","openMyChallenges","challengeUnreadBadge","challengeResultReshare"]){
 assert.match(html,new RegExp('id="'+id+'"'),"missing social UI #"+id);
}
assert.match(ui,/if\(socialChallenge\)\{celebrateSocialChallengeSuccess\(\);return\}/,"challenge victory must branch before campaign mutation");
const branch=ui.indexOf("if(socialChallenge){celebrateSocialChallengeSuccess();return}");
const campaignMutation=ui.indexOf("applyLegacyVictory(lumenProgress,levelIndex,facts,{grantShards:false})");
assert.ok(branch>=0&&campaignMutation>branch,"challenge isolation branch precedes campaign solve mutation");
assert.match(html,/performance[^<]*cach/i,"source performance must be described as hidden before play");
assert.match(ui,/shareBtn\.hidden=!socialEligibility\.canChallenge/,"replay challenge CTA must be gated");
assert.match(ui,/socialEligibility\.remarkable/,"remarkable first-play mastery must drive CTA");
assert.match(ui,/data\.participant_status==="completed"&&!data\.previously_played/,"only a recipient first play may chain a new challenge");
assert.match(domain,/p_previously_played/,"recipient prior exposure must be recorded");
assert.match(sw,/d\.tag\|\|"lumen-return"/,"push tags must allow per-challenge grouping");
assert.doesNotMatch(html,/challenge=.*duration|duration=.*challenge/,"challenge URL markup must not embed performance");
// #881 Lot 1 onboarding impact: the newcomer summary in the challenge intro restates
// the rules modal (source of truth) and never replaces it; learning replays are
// unavailable while a challenge pins its grid.
const introRules=html.match(/<div id="challengeRules"[\s\S]*?<\/div>/)?.[0]||'',rulesModal=html.match(/<div id="rulesModal"[\s\S]*?id="replayLearning"/)?.[0]||'';
for(const concept of [/par ligne, par colonne et par territoire/,/même en diagonale/])assert.match(introRules,concept,'intro summary: '+concept),assert.match(rulesModal,concept,'rules modal: '+concept);
assert.match(introRules,/id="challengeRulesOpen"/,'the summary links to the full rules');
assert.match(ui,/function startLearningReplay\(\)\{\r?\n if\(socialChallenge\)return;/,'learning replay is refused during a challenge');
console.log("social challenge UI contract tests: ok");

// Execute the real renderer: old canonical hiding and stale legacy offers must
// not silently determine the next victory's CTA.
const renderSource=ui.slice(ui.indexOf('function configureVictoryChallenge('),ui.indexOf('let challengeCreationPending='));
// #889: availability follows the run's qualification only (first win or replay).
for(const scenario of [
 {name:'ordinary qualifying first win without badges',firstCompletion:true,run:{qualifying:true},supported:true,visible:true,remarkable:false,firstPlay:true},
 {name:'qualifying first-play mastery',firstCompletion:true,run:{mastery:true,qualifying:true},supported:true,visible:true,remarkable:true,firstPlay:true},
 {name:'qualifying replay mastery after the cooldown',firstCompletion:false,priorPerformance:{attempts:1},run:{mastery:true,qualifying:true},supported:true,visible:true,remarkable:true,firstPlay:false},
 {name:'qualifying assisted replay with an error',firstCompletion:false,priorPerformance:{attempts:4},run:{autonomy:false,noError:false,mastery:false,qualifying:true},supported:true,visible:true,remarkable:false,firstPlay:false},
 {name:'replay inside the cooldown',firstCompletion:false,priorPerformance:{attempts:1},run:{mastery:true,qualifying:false},cooldownMs:9*60000,supported:true,visible:false,remarkable:false},
 {name:'unsupported canonical qualifying win',firstCompletion:true,run:{mastery:true,qualifying:true},supported:false,visible:true,remarkable:false},
 {name:'unsupported canonical cooldown replay',firstCompletion:false,run:{qualifying:false},supported:false,visible:false,remarkable:false}
]){
 const elements=Object.fromEntries(['successShare','remarkableChallenge','successChallengeReason'].map(id=>[id,{hidden:false,disabled:false,title:'stale',textContent:'stale',classList:{toggle(name,value){this[name]=value}}}]));
 const strong={textContent:'stale'};elements.remarkableChallenge.querySelector=()=>strong;
 const context={challengeEligibility,badgeCooldownLabel,lastChallengeOffer:{snapshot:{questId:999}},document:{getElementById:id=>elements[id]}};
 const render=vm.runInNewContext(renderSource+'\nconfigureVictoryChallenge',context);
 const snapshot={questId:39};render({...scenario,snapshot});
 assert.equal(!elements.successShare.hidden,scenario.visible,scenario.name);
 assert.equal(elements.successShare.disabled,!scenario.supported,scenario.name);
 assert.equal(elements.successShare.classList.remarkable,scenario.remarkable,scenario.name);
 if(scenario.visible&&scenario.supported){
  assert.deepEqual({...context.lastChallengeOffer.snapshot},{questId:39,firstPlay:scenario.firstPlay,qualifying:true},'offer keeps honest provenance: '+scenario.name);
  if(scenario.remarkable)assert.match(strong.textContent,scenario.firstPlay?/PREMIER COUP/:/REJEU QUALIFIANT/,'no first-try claim on a replay: '+scenario.name);
 }
 else assert.equal(context.lastChallengeOffer,null,'No stale or ineligible offer: '+scenario.name);
 if(!scenario.supported)assert.match(elements.successChallengeReason.textContent,/cette version/);
 else if(!scenario.visible){assert.match(elements.successChallengeReason.textContent,/tentative qualifiante/);assert.match(elements.successChallengeReason.textContent,/Réessaie dans 9 min/)}
}
console.log('victory challenge decision matrix: 7 real renderer scenarios passed (#889 qualification rule)');
