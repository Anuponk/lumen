import assert from "node:assert/strict";
import {challengeEligibility,challengeResumePlan,challengeSnapshot,compareChallenge,normalizeChallengeName,validChallengeName,challengeParticipantKey} from "../src/campaign/social-challenge.js";

// #889 (owner decision 20/11/2026): Défier follows the run's qualification only,
// the same flag the attempt engine uses for badges/ranking (15-min cooldown).
const mastery={autonomy:true,speed:true,mastery:true,qualifying:true};
assert.deepEqual(challengeEligibility({priorPerformance:{attempts:0},run:mastery}),{firstPlay:true,qualifying:true,remarkable:true,canChallenge:true},"qualifying first win + mastery is remarkable");
assert.deepEqual(challengeEligibility({priorPerformance:{attempts:0},run:{autonomy:true,speed:false,mastery:false,qualifying:true}}),{firstPlay:true,qualifying:true,remarkable:false,canChallenge:true},"ordinary qualifying first win can challenge");
assert.deepEqual(challengeEligibility({priorPerformance:{attempts:3},run:mastery}),{firstPlay:false,qualifying:true,remarkable:true,canChallenge:true},"qualifying replay after the cooldown can challenge; provenance stays replay");
assert.deepEqual(challengeEligibility({priorPerformance:{},run:mastery,firstCompletion:false}),{firstPlay:false,qualifying:true,remarkable:true,canChallenge:true},"old solved quest without metadata: replay provenance, qualification decides");
assert.deepEqual(challengeEligibility({priorPerformance:{attempts:1},run:{...mastery,qualifying:false}}),{firstPlay:false,qualifying:false,remarkable:false,canChallenge:false},"replay inside the cooldown cannot challenge");
assert.deepEqual(challengeEligibility({priorPerformance:{attempts:0},run:{...mastery,qualifying:false},firstCompletion:true}),{firstPlay:true,qualifying:false,remarkable:false,canChallenge:false},"even a first win needs a qualifying run");
assert.equal(challengeEligibility({priorPerformance:{attempts:2},run:{autonomy:false,speed:false,noError:false,mastery:false,qualifying:true}}).canChallenge,true,"help or an error does not remove a qualifying run's challenge");
assert.equal(challengeEligibility({priorPerformance:{attempts:0},run:{autonomy:true,speed:true,mastery:true}}).canChallenge,false,"an unknown qualification is never assumed");

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

// Snapshot provenance is honest and travels with the reference.
const replaySnap=challengeSnapshot({questIndex:11,seconds:40,run:mastery,firstPlay:false});
assert.equal(replaySnap.firstPlay,false);assert.equal(replaySnap.qualifying,true);
assert.equal(challengeSnapshot({questIndex:11,seconds:40,run:{...mastery,qualifying:false}}).qualifying,false);

// #888 resume plan: a started attempt never restarts from a blank clock.
assert.deepEqual(challengeResumePlan({participantStatus:null}),{kind:'fresh',elapsedMs:0});
assert.deepEqual(challengeResumePlan({participantStatus:'started',localAttempt:true,participantStartedAt:'2026-11-20T10:00:00Z',serverNow:'2026-11-20T10:05:00Z'}),{kind:'local',elapsedMs:0},'same browser restores its own attempt and time');
assert.deepEqual(challengeResumePlan({participantStatus:'started',localAttempt:false,participantStartedAt:'2026-11-20T10:00:00Z',serverNow:'2026-11-20T10:07:30Z'}),{kind:'elapsed',elapsedMs:450000},'another device resumes at the server-measured elapsed time');
assert.deepEqual(challengeResumePlan({participantStatus:'started',localAttempt:false,participantStartedAt:'2026-11-20T10:00:00Z',serverNow:'2026-11-20T09:59:00Z'}),{kind:'elapsed',elapsedMs:0},'clock skew never yields a negative time');
assert.deepEqual(challengeResumePlan({participantStatus:'started',localAttempt:false}),{kind:'blocked',elapsedMs:0},'without server proof the resume is refused');
assert.deepEqual(challengeResumePlan({participantStatus:'started',localAttempt:false,participantStartedAt:'garbage',serverNow:'2026-11-20T09:59:00Z'}),{kind:'blocked',elapsedMs:0});
assert.equal(challengeResumePlan({participantStatus:'completed'}).kind,'closed');

console.log("social challenge tests: ok");
