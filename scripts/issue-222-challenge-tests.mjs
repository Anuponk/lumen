import fs from "node:fs";
import assert from "node:assert/strict";
import {canonicalQuestById,canonicalQuestForLegacy,canonicalQuestList} from "../src/campaign/canonical-quests.js";
import {resolveChallengeQuest,challengeIdentityForQuest,canonicalOrdinalForChallenge} from "../src/campaign/canonical-challenges.js";
const old={puzzle_id:39},resolved=resolveChallengeQuest(old);
assert.equal(resolved.id,"base-q039");
assert.equal(resolved.legacyIndex,38);
assert.equal(canonicalOrdinalForChallenge(old),resolved.ordinal);
assert.deepEqual(challengeIdentityForQuest("base-q039"),{puzzle_id:39,stable_quest_id:"base-q039"});
assert.equal(resolveChallengeQuest({puzzle_id:39,stable_quest_id:"base-q039"}).id,"base-q039");
assert.throws(()=>resolveChallengeQuest({puzzle_id:39,stable_quest_id:"base-q040"}),/mismatch/);
assert.throws(()=>resolveChallengeQuest({puzzle_id:999999}),/Unresolvable/);
assert.throws(()=>resolveChallengeQuest({stable_quest_id:"unknown"}),/Unknown/);
// Unrevised added quest: plain stable identity. (#692 moved quest 7, the first
// added quest, to soft revision 1, covered explicitly below.)
const added=canonicalQuestList().find(x=>x.legacyIndex===null&&!x.gridRevision);
{
 const revised=canonicalQuestById("planned-real-01-q07");
 assert.equal(revised.legacyIndex,null);assert.equal(revised.gridRevision,1);
 assert.deepEqual(challengeIdentityForQuest(revised.id),{stable_quest_id:revised.id,grid_revision:1},"new links pin the revised board");
 assert.deepEqual(resolveChallengeQuest({stable_quest_id:revised.id,grid_revision:1}).reg,revised.reg);
 const historical=resolveChallengeQuest({stable_quest_id:revised.id});
 assert.equal(historical.id,revised.id);assert.notDeepEqual(historical.reg,revised.reg,"older links without a revision keep the original board");
}
assert.deepEqual(challengeIdentityForQuest(added.id),{stable_quest_id:added.id});
assert.equal(resolveChallengeQuest({stable_quest_id:added.id}).id,added.id);
assert.throws(()=>resolveChallengeQuest({puzzle_id:added.ordinal,stable_quest_id:added.id}),/mismatch/);
assert.equal(canonicalQuestForLegacy(38).id,"base-q039");
const liveScreen=fs.readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.match(liveScreen,/levelIndex=legacyIndexForActiveChallenge\(socialChallenge\)/);
assert.match(liveScreen,/function legacyIndexForActiveChallenge\(challenge\)\{const quest=resolveChallengeQuest\(challenge\)/);
assert.doesNotMatch(liveScreen,/levelIndex=Number\(socialChallenge\.puzzle_id\)-1/);
console.log("Historic challenge URLs remain bound to the original grid; new links use stable IDs");
