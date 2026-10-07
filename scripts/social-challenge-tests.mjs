import assert from "node:assert/strict";
import {challengeEligibility,challengeSnapshot,compareChallenge,normalizeChallengeName,validChallengeName,challengeParticipantKey} from "../src/campaign/social-challenge.js";

const mastery={autonomy:true,speed:true,mastery:true};
assert.deepEqual(challengeEligibility({priorPerformance:{attempts:0},run:mastery}),{firstPlay:true,remarkable:true,canChallenge:true},"first play + mastery is remarkable");
assert.deepEqual(challengeEligibility({priorPerformance:{attempts:0},run:{autonomy:true,speed:false,mastery:false}}),{firstPlay:true,remarkable:false,canChallenge:true},"ordinary first play can challenge");
assert.equal(challengeEligibility({priorPerformance:{attempts:1},run:mastery}).canChallenge,false,"replay cannot create challenge");
assert.equal(challengeEligibility({priorPerformance:{attempts:9},run:mastery}).remarkable,false,"replay mastery is not remarkable");

const snap=challengeSnapshot({questIndex:11,seconds:87.8,run:mastery,assistanceUsed:false});
assert.equal(snap.questId,12);
assert.equal(snap.mastery,true);
assert.equal(snap.assistanceUsed,false);
const expandedCatalogSnap=challengeSnapshot({questIndex:111,seconds:45,run:mastery,assistanceUsed:false});
assert.equal(expandedCatalogSnap.questId,112,"quest 112 remains challengeable");

assert.equal(compareChallenge({duration_seconds:102,autonomy:true},{status:"completed",duration_seconds:87,autonomy:true}).kind,"won");
assert.equal(compareChallenge({duration_seconds:102,autonomy:true},{status:"completed",duration_seconds:87,autonomy:true}).headline,"Défi remporté !");
assert.equal(compareChallenge({duration_seconds:102,autonomy:true},{status:"completed",duration_seconds:118,autonomy:true}).kind,"lost");
assert.equal(compareChallenge({duration_seconds:102,autonomy:true},{status:"completed",duration_seconds:102,autonomy:true}).kind,"tied");
assert.equal(compareChallenge({duration_seconds:102,autonomy:true},{status:"completed",duration_seconds:68,autonomy:false}).kind,"lost","assisted participant loses to autonomous source even when faster");
assert.match(compareChallenge({duration_seconds:102,autonomy:true},{status:"completed",duration_seconds:68,autonomy:false}).detail,/utilisé une aide/);
assert.equal(compareChallenge({duration_seconds:102,autonomy:false},{status:"completed",duration_seconds:130,autonomy:true}).kind,"won","autonomous participant beats assisted source even when slower");
assert.equal(compareChallenge({duration_seconds:102,autonomy:true},{status:"abandoned"}).kind,"abandoned");

assert.equal(normalizeChallengeName("  Cédric   V.  "),"Cédric V.");
assert.equal(validChallengeName("Léa"),true);
assert.equal(validChallengeName("<script>"),false);
assert.equal(challengeParticipantKey({userId:"123"}),"u:123");
assert.equal(challengeParticipantKey({anonymousId:"abc"}),"a:abc");

console.log("social challenge tests: ok");
