import assert from "node:assert/strict";
import fs from "node:fs";

const html=fs.readFileSync("index.html","utf8");
const ui=fs.readFileSync("src/ui/game-screen.js","utf8");
const sw=fs.readFileSync("sw.js","utf8");
const domain=fs.readFileSync("src/campaign/social-challenge.js","utf8");

for(const id of ["challengeIntro","challengeNameModal","challengeShareModal","challengeResultModal","myChallengesModal","openMyChallenges","challengeUnreadBadge","challengeResultReshare"]){
 assert.match(html,new RegExp('id="'+id+'"'),"missing social UI #"+id);
}
assert.match(ui,/if\(socialChallenge\)\{celebrateSocialChallengeSuccess\(\);return\}/,"challenge victory must branch before campaign mutation");
const branch=ui.indexOf("if(socialChallenge){celebrateSocialChallengeSuccess();return}");
const campaignMutation=ui.indexOf("lumenProgress.solved[levelIndex]=1");
assert.ok(branch>=0&&campaignMutation>branch,"challenge isolation branch precedes campaign solve mutation");
assert.match(html,/performance[^<]*cach/i,"source performance must be described as hidden before play");
assert.match(ui,/shareBtn\.hidden=!socialEligibility\.canChallenge/,"replay challenge CTA must be gated");
assert.match(ui,/socialEligibility\.remarkable/,"remarkable first-play mastery must drive CTA");
assert.match(ui,/data\.participant_status==="completed"&&!data\.previously_played/,"only a recipient first play may chain a new challenge");
assert.match(domain,/p_previously_played/,"recipient prior exposure must be recorded");
assert.match(sw,/d\.tag\|\|"lumen-return"/,"push tags must allow per-challenge grouping");
assert.doesNotMatch(html,/challenge=.*duration|duration=.*challenge/,"challenge URL markup must not embed performance");
console.log("social challenge UI contract tests: ok");
