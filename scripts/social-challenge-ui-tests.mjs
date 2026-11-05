import assert from "node:assert/strict";
import fs from "node:fs";
import vm from 'node:vm';
import {challengeEligibility} from '../src/campaign/social-challenge.js';

const html=fs.readFileSync("index.html","utf8");
const ui=fs.readFileSync("src/ui/game-screen.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
const domain=fs.readFileSync("src/campaign/social-challenge.js","utf8");

for(const id of ["challengeIntro","challengeNameModal","challengeShareModal","challengeResultModal","myChallengesModal","openMyChallenges","challengeUnreadBadge","challengeResultReshare"]){
 assert.match(html,new RegExp('id="'+id+'"'),"missing social UI #"+id);
}
assert.match(ui,/if\(socialChallenge\)\{celebrateSocialChallengeSuccess\(\);return\}/,"challenge victory must branch before campaign mutation");
const branch=ui.indexOf("if(socialChallenge){celebrateSocialChallengeSuccess();return}");
const campaignMutation=ui.indexOf("applyLegacyVictory(lumenProgress,levelIndex,facts)");
assert.ok(branch>=0&&campaignMutation>branch,"challenge isolation branch precedes campaign solve mutation");
assert.match(html,/performance[^<]*cach/i,"source performance must be described as hidden before play");
assert.match(ui,/shareBtn\.hidden=!socialEligibility\.canChallenge/,"replay challenge CTA must be gated");
assert.match(ui,/socialEligibility\.remarkable/,"remarkable first-play mastery must drive CTA");
assert.match(ui,/data\.participant_status==="completed"&&!data\.previously_played/,"only a recipient first play may chain a new challenge");
assert.match(domain,/p_previously_played/,"recipient prior exposure must be recorded");
assert.match(sw,/d\.tag\|\|"lumen-return"/,"push tags must allow per-challenge grouping");
assert.doesNotMatch(html,/challenge=.*duration|duration=.*challenge/,"challenge URL markup must not embed performance");
console.log("social challenge UI contract tests: ok");

// Execute the real renderer: old canonical hiding and stale legacy offers must
// not silently determine the next victory's CTA.
const renderSource=ui.slice(ui.indexOf('function configureVictoryChallenge('),ui.indexOf('let challengeCreationPending='));
for(const scenario of [
 {name:'ordinary first win without badges',firstCompletion:true,run:{},supported:true,visible:true,remarkable:false},
 {name:'first-play mastery',firstCompletion:true,run:{mastery:true},supported:true,visible:true,remarkable:true},
 {name:'replay mastery',firstCompletion:false,priorPerformance:{attempts:1},run:{mastery:true},supported:true,visible:false,remarkable:false},
 {name:'old solved quest without metadata',firstCompletion:false,run:{mastery:true},supported:true,visible:false,remarkable:false},
 {name:'unsupported canonical first win',firstCompletion:true,run:{mastery:true},supported:false,visible:true,remarkable:false},
 {name:'unsupported canonical replay',firstCompletion:false,run:{},supported:false,visible:false,remarkable:false}
]){
 const elements=Object.fromEntries(['successShare','remarkableChallenge','successChallengeReason'].map(id=>[id,{hidden:false,disabled:false,title:'stale',textContent:'stale',classList:{toggle(name,value){this[name]=value}}}]));
 const context={challengeEligibility,lastChallengeOffer:{snapshot:{questId:999}},document:{getElementById:id=>elements[id]}};
 const render=vm.runInNewContext(renderSource+'\nconfigureVictoryChallenge',context);
 const snapshot={questId:39};render({...scenario,snapshot});
 assert.equal(!elements.successShare.hidden,scenario.visible,scenario.name);
 assert.equal(elements.successShare.disabled,!scenario.supported,scenario.name);
 assert.equal(elements.successShare.classList.remarkable,scenario.remarkable,scenario.name);
 if(scenario.visible&&scenario.supported)assert.equal(context.lastChallengeOffer.snapshot,snapshot);
 else assert.equal(context.lastChallengeOffer,null,'No stale or ineligible offer: '+scenario.name);
 if(!scenario.supported)assert.match(elements.successChallengeReason.textContent,/cette version/);
}
console.log('victory challenge decision matrix: 6 real renderer scenarios passed');
