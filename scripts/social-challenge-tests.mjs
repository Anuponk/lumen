import assert from "node:assert/strict";
import {challengeEligibility,challengeResumePlan,challengeSnapshot,compareChallenge,normalizeChallengeName,validChallengeName,challengeParticipantKey,createChallengeClient} from "../src/campaign/social-challenge.js";

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

// #887: a numbered quest pins the board revision the attempt actually played.
{
 const numbered=challengeSnapshot({questIndex:2,gridRevision:1,seconds:61,run:mastery});
 assert.equal(numbered.questId,3);assert.equal(numbered.gridRevision,1,"played revision kept on the numbered path");
 assert.equal(challengeSnapshot({questIndex:2,seconds:61,run:mastery}).gridRevision,undefined,"no revision declared when none was played");
 const calls=[];
 const fake={rpc:async(name,args)=>{calls.push({name,args});return name==="lumen_create_qualifying_challenge"&&calls.length===1?{data:[{challenge_id:"c"}],error:null}:{data:null,error:{code:"PGRST202"},status:404}}};
 const client=createChallengeClient(fake,{getUserId:()=>"u",getDisplayName:()=>"Loutre"});
 await client.create({...numbered,displayName:"Loutre"});
 assert.equal(calls[0].args.p_puzzle_id,3);assert.equal(calls[0].args.p_quest_id,null);assert.equal(calls[0].args.p_grid_revision,1,"numbered writer receives the played revision");
 // An old server without the versioned writer can only store revision 0: refuse rather than mislabel.
 const old=createChallengeClient({rpc:async()=>({data:null,error:{code:"PGRST202"},status:404})},{getDisplayName:()=>"Loutre"});
 await assert.rejects(old.create(numbered),/challenge_grid_update_required/);
}

console.log("social challenge tests: ok");
