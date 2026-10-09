import test from "node:test";
import assert from "node:assert/strict";
import {extendedSequentialCount,nextAdventureBoundary,extendedQuestLimit} from "../src/campaign/extended-boundary.js";
import {campaignQuestCount,sequentialCount} from "../src/campaign/progression.js";
const legacy=Object.fromEntries(Array.from({length:196},(_,i)=>[i,true]));
test("historical progress stays capped at 196",()=>{
 assert.equal(campaignQuestCount(),196);
 assert.equal(sequentialCount({...legacy,196:true}),196);
 assert.equal(extendedSequentialCount(legacy),196);
});
test("new adventure stays locked without entitlement",()=>{
 assert.equal(extendedQuestLimit(),196);
 const boundary=nextAdventureBoundary(legacy);
 assert.equal(boundary.status,"locked");
 assert.equal(boundary.index,196);
});
test("entitlement enables 100 generated quests",()=>{
 assert.equal(extendedQuestLimit(["real-adventure-04"]),296);
 const boundary=nextAdventureBoundary(legacy,["real-adventure-04"]);
 assert.equal(boundary.status,"ready");
 assert.equal(boundary.quest.index,196);
});
test("new progress does not alter legacy completion",()=>{
 const solved={...legacy,196:true,197:true};
 assert.equal(extendedSequentialCount(solved),198);
 assert.equal(sequentialCount(solved),196);
 assert.equal(nextAdventureBoundary(solved,["real-adventure-04"]).index,198);
});
test("full 296 quest completion is recognized",()=>{
 const all=Object.fromEntries(Array.from({length:296},(_,i)=>[i,true]));
 assert.equal(nextAdventureBoundary(all).status,"complete");
});
