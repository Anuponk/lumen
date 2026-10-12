import assert from "node:assert/strict";
import {createCampaign} from "../src/campaign/progression.js";
import {performanceEligibility,speedTargetSeconds,localCalendarDay,performanceAttempt,mergeEarnedBadges,badgeCooldownRemaining,BADGE_COOLDOWN_MS} from "../src/campaign/performance.js";

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

test("campaign save grants unlocked early badges only on a new qualifying replay",()=>{
 const solved=Object.fromEntries(Array.from({length:6},(_,i)=>[i,1]));
 for(const i of [0,1,2,3,4]){
  const progress={solved,performances:{},stars:{},badges:{}};
  let seconds=40,assistanceUsed=false,qualifying=true;
  const campaign=createCampaign(()=>progress,()=>{},()=>({activeGameSeconds:()=>seconds,assistanceUsed,mistakeCommitted:false,qualifying}));
  const before=JSON.stringify(progress.performances);
  const preview=campaign.performanceRun(i);
  assert.equal(JSON.stringify(progress.performances),before,"Preview must not award historical badges");
  assert.equal(preview.mastery,true);
  const first=campaign.savePerformance(i,1);
  assert.equal(first.qualifying,true);
  assert.deepEqual(first.badges,{autonomy:true,speed:true,noError:true,mastery:true});
  assert.equal(progress.performances[i].version,3);
  // A second same-day attempt must not award new badges, even if performance improves.
  progress.performances[i].badges={autonomy:false,speed:false,noError:false,mastery:false};
   qualifying=false;
  const second=campaign.savePerformance(i,1);
  assert.equal(second.qualifying,false);
  assert.deepEqual(second.badges,{autonomy:false,speed:false,noError:false,mastery:false});
 }
});
test("first-time tutorial players remain restricted until the global unlock",()=>{
 const progress={solved:{0:1,1:1},performances:{},stars:{},badges:{}};
 const campaign=createCampaign(()=>progress,()=>{},()=>({activeGameSeconds:()=>30,assistanceUsed:false,mistakeCommitted:false,qualifying:true}));
 assert.deepEqual(campaign.performanceRun(0).eligibility,{autonomy:false,speed:false,noError:false,mastery:false});
 assert.deepEqual(campaign.savePerformance(0,1).badges,{autonomy:false,speed:false,noError:false,mastery:false});
});

test("15 minute badge cooldown boundaries and midnight",()=>{
 const base=Date.parse("2026-10-12T23:59:00Z"),p={lastQualifiedAt:new Date(base).toISOString(),lastQualifiedDay:"2026-10-12"};
 assert.equal(BADGE_COOLDOWN_MS,900000);
 assert.equal(badgeCooldownRemaining(p,base),900000);
 assert.equal(badgeCooldownRemaining(p,base+14*60000+59000),1000);
 assert.equal(badgeCooldownRemaining(p,base+900000),0);
 assert.equal(badgeCooldownRemaining(p,base+960000),0);
 assert.equal(badgeCooldownRemaining({lastQualifiedAt:new Date(base).toISOString()},base+120000),780000);
 assert.equal(badgeCooldownRemaining(null,base),0);
});

console.log(JSON.stringify({performanceBadgeTests:cases.length,cases},null,2));
