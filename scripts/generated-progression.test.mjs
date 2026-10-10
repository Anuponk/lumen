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

test("appending variable-size constellations preserves existing quest indices",()=>{
 const constellations=[
  {id:"a",label:"A",questCount:2,questIndices:[196,197]},
  {id:"b",label:"B",questCount:3,questIndices:[198,199,200]},
  {id:"c",label:"C",questCount:1,questIndices:[201]}
 ];
 const saved={196:1,197:1,198:1};
 assert.equal(nextGeneratedQuest(saved,constellations),199);
 const before=generatedCampaignProgress(saved,constellations);
 assert.equal(before.total,6);
 assert.equal(before.completed,3);
 assert.equal(generatedQuestProgress(200,saved,constellations).finalQuest,true);
 const expanded=[...constellations,{id:"d",label:"D",questCount:4,questIndices:[202,203,204,205]}];
 const after=generatedCampaignProgress(saved,expanded);
 assert.equal(after.total,10);
 assert.equal(after.completed,3);
 assert.equal(after.start,196);
 assert.equal(after.end,205);
 assert.equal(nextGeneratedQuest(saved,expanded),199);
 const complete=Object.fromEntries(Array.from({length:10},(_,i)=>[196+i,1]));
 assert.equal(nextGeneratedQuest(complete,expanded),null);
 assert.equal(generatedCampaignProgress(complete,expanded).complete,true);
});
