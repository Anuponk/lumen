import test from "node:test";
import assert from "node:assert/strict";
import {extendedSequentialCount,nextAdventureBoundary,extendedQuestLimit} from "../src/campaign/extended-boundary.js";
import {campaignQuestCount,sequentialCount} from "../src/campaign/progression.js";
import {CONTENT_PACKS,baseCampaignQuestCount} from "../src/campaign/content.js";
import {STAGED_ADVENTURE} from "../src/campaign/staged-adventure.js";
import {playableQuestCount} from "../src/campaign/playable-quests.js";
const legacyEnd=baseCampaignQuestCount();
const generated=CONTENT_PACKS.find(p=>p.id===STAGED_ADVENTURE.pack.id);
const included=CONTENT_PACKS.find(p=>p.access==="included");
const legacy=Object.fromEntries(Array.from({length:legacyEnd},(_,i)=>[i,true]));
test("historical progress stays capped at 196",()=>{
 assert.equal(campaignQuestCount(),196);
 assert.equal(sequentialCount({...legacy,196:true}),196);
 assert.equal(extendedSequentialCount(legacy),196);
});
test("new adventure stays locked without entitlement",()=>{
 assert.equal(extendedQuestLimit(),included.questIndices.at(-1)+1,'fresh players only access the included Adventure');
 assert.equal(extendedQuestLimit([],{solved:legacy}),legacyEnd,'restored history retains started Adventures only');
 const boundary=nextAdventureBoundary(legacy);
 assert.equal(boundary.status,"locked");
 assert.equal(boundary.index,legacyEnd);
 assert.equal(boundary.packId,generated.id);
});
test("generated entitlement respects earlier locked packs and restored history",()=>{
 assert.equal(extendedQuestLimit([generated.id]),included.questIndices.at(-1)+1,'ownership cannot bypass a locked gap');
 assert.equal(extendedQuestLimit([generated.id],{solved:legacy}),playableQuestCount());
 assert.equal(extendedQuestLimit(CONTENT_PACKS.map(p=>p.id)),playableQuestCount());
 const boundary=nextAdventureBoundary(legacy,[generated.id]);
 assert.equal(boundary.status,"ready");
 assert.equal(boundary.quest.index,legacyEnd);
 assert.equal(boundary.quest.id,STAGED_ADVENTURE.quests[0].id);
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

test("pack boundaries derive from metadata for variable contiguous lengths",()=>{
 const packs=[
  {id:"base",access:"included",questIndices:[0,1,2]},
  {id:"custom-a",access:"locked",questIndices:[3,4]},
  {id:"custom-b",access:"locked",questIndices:[5,6,7,8]}
 ];
 assert.equal(extendedQuestLimit([],{},null,packs),3);
 assert.equal(extendedQuestLimit(["custom-a"],{},null,packs),5);
 assert.equal(extendedQuestLimit(["custom-a","custom-b"],{},null,packs),9);
 assert.equal(extendedQuestLimit([], {solved:{3:1}},null,packs),5);
 assert.equal(extendedQuestLimit(["custom-b"],{},null,packs),3);
});
