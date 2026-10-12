import assert from "node:assert/strict";
import {performanceEligibility,speedTargetSeconds,localCalendarDay,performanceAttempt,mergeEarnedBadges,performanceCooldownRemainingMs,performanceCooldownMessage,PERFORMANCE_QUALIFICATION_COOLDOWN_MS} from "../src/campaign/performance.js";

const cases=[];
function test(name,fn){fn();cases.push(name)}

test("quests 1-2 lock every performance badge",()=>{
 for(const i of [0,1])assert.deepEqual(performanceEligibility(i),{autonomy:false,speed:false,noError:false,mastery:false});
});
test("quests 3-5 expose speed only",()=>{
 for(const i of [2,3,4])assert.deepEqual(performanceEligibility(i),{autonomy:false,speed:true,noError:false,mastery:false});
});
test("quest 6+ exposes all four badges",()=>{
 assert.deepEqual(performanceEligibility(5),{autonomy:true,speed:true,noError:true,mastery:true});
 assert.deepEqual(performanceEligibility(99),{autonomy:true,speed:true,noError:true,mastery:true});
});
test("speed target is 60 seconds across the whole campaign",()=>{
 assert.deepEqual([0,20,40,60,80,143].map(speedTargetSeconds),[60,60,60,60,60,60]);
 assert.equal(performanceAttempt({questIndex:7,seconds:59}).speed,true);
 assert.equal(performanceAttempt({questIndex:7,seconds:60}).speed,false);
});
test("assistance prevents autonomy, Sans erreur and mastery but not speed",()=>{
 const run=performanceAttempt({questIndex:5,seconds:30,assistanceUsed:true});
 assert.equal(run.autonomy,false);assert.equal(run.speed,true);assert.equal(run.noError,false);assert.equal(run.mastery,false);
});
test("confirmed mistake prevents Sans erreur and mastery but not autonomy or speed",()=>{
 const run=performanceAttempt({questIndex:5,seconds:30,mistakeCommitted:true});
 assert.equal(run.autonomy,true);assert.equal(run.speed,true);assert.equal(run.noError,false);assert.equal(run.mastery,false);
});
test("mastery requires autonomy, speed and Sans erreur in the same run",()=>{
 assert.equal(performanceAttempt({questIndex:5,seconds:30}).mastery,true);
 assert.equal(performanceAttempt({questIndex:5,seconds:999}).mastery,false);
 assert.equal(performanceAttempt({questIndex:5,seconds:30,mistakeCommitted:true}).mastery,false);
});
test("earned badges merge without manufacturing mastery across attempts",()=>{
 const prior={autonomy:true,speed:false,noError:false,mastery:false};
 const merged=mergeEarnedBadges(prior,{autonomy:false,speed:true,noError:true,mastery:false},{autonomy:true,speed:true,noError:true,mastery:true});
 assert.deepEqual(merged,{autonomy:true,speed:true,noError:true,mastery:false});
});
test("legacy mastery remains grandfathered",()=>{
 const prior={autonomy:true,speed:true,mastery:true};
 const merged=mergeEarnedBadges(prior,{autonomy:false,speed:false,noError:false,mastery:false},{autonomy:true,speed:true,noError:true,mastery:true});
 assert.equal(merged.mastery,true);assert.equal(merged.noError,false);
});
test("calendar qualification key changes at local midnight",()=>{
 assert.equal(localCalendarDay(new Date(2026,9,3,23,59)),"2026-10-03");
 assert.equal(localCalendarDay(new Date(2026,9,4,0,1)),"2026-10-04");
});


test("early quests unlock badge families from global progression for NEW attempts",()=>{
 for(const i of [0,1,2,3,4]){
  const run=performanceAttempt({questIndex:i,unlockedQuestCount:6,seconds:40});
  assert.deepEqual(run.eligibility,{autonomy:true,speed:true,noError:true,mastery:true});
  assert.equal(run.mastery,true);
  assert.equal(performanceAttempt({questIndex:i,unlockedQuestCount:6,seconds:60}).speed,false);
 }
 assert.equal(performanceAttempt({questIndex:0,unlockedQuestCount:2,seconds:30}).speed,false);
 assert.equal(performanceAttempt({questIndex:0,unlockedQuestCount:3,seconds:30}).speed,true);
 assert.equal(performanceAttempt({questIndex:0,unlockedQuestCount:5,seconds:30}).mastery,false);
});

test("15-minute eligibility boundaries and explanatory messages",()=>{
 const t=Date.parse("2026-10-12T22:00:00.000Z"),p={lastQualifiedAt:new Date(t).toISOString()};
 assert.equal(PERFORMANCE_QUALIFICATION_COOLDOWN_MS,900000);
 assert.equal(performanceCooldownRemainingMs(p,t),900000);
 assert.equal(performanceCooldownRemainingMs(p,t+60000),840000);
 assert.equal(performanceCooldownRemainingMs(p,t+899000),1000);
 assert.equal(performanceCooldownRemainingMs(p,t+900000),0);
 assert.equal(performanceCooldownRemainingMs(p,t+3600000),0);
 assert.equal(performanceCooldownMessage(900000),"Tu pourras retenter de gagner des badges dans 15 minutes.");
 assert.equal(performanceCooldownMessage(8*60000),"Réessaie dans 8 min");
 assert.equal(performanceCooldownMessage(0),"");
});
test("per-quest independence, midnight and old save compatibility",()=>{
 const t=Date.parse("2026-10-12T23:59:00.000Z");
 const quest1={lastQualifiedAt:new Date(t).toISOString()};
 const quest2={lastQualifiedAt:new Date(t-900000).toISOString()};
 assert.equal(performanceCooldownRemainingMs(quest1,t+2*60000),780000);
 assert.equal(performanceCooldownRemainingMs(quest2,t+2*60000),0);
 const day=localCalendarDay(new Date(t));
 assert.equal(performanceCooldownRemainingMs({lastQualifiedDay:day},t),900000);
 assert.equal(performanceCooldownRemainingMs({},t),0);
 assert.equal(performanceCooldownRemainingMs({lastQualifiedAt:new Date(t).toISOString()},t-1000),900000);
});

console.log(JSON.stringify({performanceBadgeTests:cases.length,cases},null,2));
