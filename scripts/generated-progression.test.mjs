import test from "node:test";
import assert from "node:assert/strict";
import {generatedCampaignProgress,generatedQuestProgress,nextGeneratedQuest} from "../src/campaign/generated-progression.js";

test("fresh generated adventure is empty",()=>{
 const p=generatedCampaignProgress({});
 assert.equal(p.total,100);
 assert.equal(p.completed,0);
 assert.equal(p.constellations.length,10);
 assert.ok(p.constellations.every(c=>c.total===10));
 assert.equal(nextGeneratedQuest({}),196);
});
test("completing first constellation advances to second",()=>{
 const solved=Object.fromEntries(Array.from({length:10},(_,i)=>[196+i,1]));
 const p=generatedCampaignProgress(solved);
 assert.equal(p.completed,10);
 assert.equal(p.constellations[0].complete,true);
 assert.equal(p.constellations[1].complete,false);
 assert.equal(nextGeneratedQuest(solved),206);
 assert.equal(generatedQuestProgress(205,solved).finalQuest,true);
});
test("all 100 generated quests complete without touching historical state",()=>{
 const solved=Object.fromEntries(Array.from({length:100},(_,i)=>[196+i,1]));
 const p=generatedCampaignProgress(solved);
 assert.equal(p.completed,100);
 assert.equal(p.complete,true);
 assert.equal(nextGeneratedQuest(solved),null);
 assert.equal(generatedQuestProgress(195,solved),null);
});
