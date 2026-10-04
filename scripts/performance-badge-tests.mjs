import assert from "node:assert/strict";
import {performanceEligibility,speedTargetSeconds,localCalendarDay,performanceAttempt,mergeEarnedBadges} from "../src/campaign/performance.js";

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
test("speed targets rise by campaign difficulty band",()=>{
 assert.deepEqual([0,20,40,60,80].map(speedTargetSeconds),[90,120,150,180,210]);
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

console.log(JSON.stringify({performanceBadgeTests:cases.length,cases},null,2));
