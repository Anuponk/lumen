import fs from "node:fs";
import assert from "node:assert/strict";
import {canonicalQuestCount,canonicalQuestByOrdinal,canonicalQuestById,canonicalQuestForLegacy,canonicalQuestList,canonicalNextUnsolved,canonicalDisplayForLegacy,canonicalAdventureSummary} from "../src/campaign/canonical-quests.js";
import {playableQuest} from "../src/campaign/playable-quests.js";
import {adminCanonicalCatalogueTree} from "../src/campaign/admin-catalogue.js";
import {resolveCanonicalQuest,nextCanonicalQuest} from "../src/campaign/playable-navigation.js";
const quests=canonicalQuestList();
assert.equal(canonicalQuestCount(),400);
assert.equal(new Set(quests.map(q=>q.id)).size,400);
for(let i=1;i<=400;i++)assert.equal(canonicalQuestByOrdinal(i)?.ordinal,i);
for(const q of quests){
 assert.equal(canonicalQuestById(q.id),q);
 assert.equal(q.sol.length,q.reg.length);
 if(q.legacyIndex!==null){
  assert.equal(canonicalQuestForLegacy(q.legacyIndex),q);
  assert.equal(playableQuest(q.legacyIndex).id,q.id);
 }else assert.equal(q.audit?.solutions,1);
}
assert.equal(quests.filter(q=>q.legacyIndex===null).length,104);
for(let i=0;i<4;i++)assert.equal(quests.slice(i*100,(i+1)*100).filter(q=>q.packId===quests[i*100].packId).length,100);
assert.equal(canonicalNextUnsolved({},{}).ordinal,1);
assert.equal(canonicalNextUnsolved(Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,true])),Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,true]))),null);
assert.equal(canonicalNextUnsolved({"0":true},{}).ordinal,2);
assert.equal(resolveCanonicalQuest(1).status,"ready");
assert.equal(resolveCanonicalQuest(101).status,"locked");
assert.equal(resolveCanonicalQuest(101,["real-adventure-02"]).status,"ready");
assert.equal(resolveCanonicalQuest(100,[],{legacyAdventureAccess:["base-real-sky"]}).status,"ready");
assert.equal(nextCanonicalQuest({},{}).ordinal,1);
const sums=canonicalAdventureSummary({solved:{"0":true,"195":true,"295":true}});
assert.equal(sums.length,4);
assert.deepEqual(sums.map(x=>x.quests),[100,100,100,100]);
assert.deepEqual(sums.map(x=>x.constellations),[10,10,10,10]);
assert.deepEqual(sums.map(x=>x.completed),[1,0,1,1]);
assert.deepEqual(sums.map(x=>[x.firstQuest,x.lastQuest]),[[1,100],[101,200],[201,300],[301,400]]);
assert.equal(canonicalDisplayForLegacy(0).number,1);
assert.equal(canonicalDisplayForLegacy(295).number,400);
assert.equal(canonicalDisplayForLegacy(9999),null);
const gameScreen=fs.readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.match(gameScreen,/const canonicalNumber=canonicalDisplayForLegacy\(levelIndex\)/);
assert.match(gameScreen,/for\(const adventure of adminCanonicalCatalogueTree\(\)\)/);
assert.match(gameScreen,/x\.fillText\("Quête "\+\(a\.canonicalNumber\?\?levelIndex\+1\)/);
assert.match(gameScreen,/return \{kicker,main,detail,ch,pos,total:range\.count,solved,run,secs,canonicalNumber\}/);
const admin=adminCanonicalCatalogueTree();
assert.equal(admin.length,4);
assert.deepEqual(admin.map(x=>x.questCount),[100,100,100,100]);
assert.deepEqual(admin.map(x=>x.constellations.length),[10,10,10,10]);
assert.equal(admin.flatMap(p=>p.constellations.flatMap(c=>c.quests)).length,400);
assert.equal(admin.flatMap(p=>p.constellations.flatMap(c=>c.quests)).filter(q=>q.source==="generated").length,104);
assert.deepEqual(admin.map(x=>[x.startNumber,x.endNumber]),[[1,100],[101,200],[201,300],[301,400]]);
assert.match(gameScreen,/button\.disabled=!available/);
assert.match(gameScreen,/button\.dataset\.questId=quest\.id/);
assert.match(gameScreen,/if\(solved\)\{startReplay\(legacy\);return\}/);
assert.match(gameScreen,/if\(canonicalActiveQuest\)\{await celebrateCanonicalSuccess\(\);return\}/);
assert.match(gameScreen,/canonicalQuestAvailable\(quest\)/);
assert.match(gameScreen,/startCanonicalQuest\(quest\)/);
assert.match(gameScreen,/await commitCanonicalVictory\(lumenSupabase,q\.id,reward\)/);
assert.match(gameScreen,/const canonicalFollowing=canonicalPrevious&&canonicalQuestByOrdinal/);
assert.match(gameScreen,/if\(!current\)return;canonicalActiveQuest=null;levelIndex=i/);
assert.match(gameScreen,/badges\.autonomy\?15:10/);
// A legacy quest cannot jump into a newly inserted quest before being solved.
assert.match(gameScreen,/lumenProgress\.solved\[levelIndex\]&&canonicalFollowing\?\.legacyIndex===null/);
assert.match(gameScreen,/hideSuccess\(\);openJourneyMap\(\);return;/);
assert.match(gameScreen,/canonicalFollowing\.legacyIndex!==levelIndex\+1/);
// Every inserted quest retains the authoritative engine proof and its stable ID.
for(const q of quests.filter(q=>q.legacyIndex===null)){
 assert.equal(q.audit.ok,true);
 assert.equal(q.audit.solutions,1);
 assert(q.reg.length>=6);
}
assert.match(gameScreen,/canonicalNextUnsolved\(lumenProgress\.solved,lumenProgress\.canonicalQuestState\|\|\{\}\)\?\.legacyIndex===index/);
assert.match(gameScreen,/const legacy=quest\.legacyIndex,solved=legacy!==null\?!!lumenProgress\.solved/);
assert.match(gameScreen,/function historicalContinuationAllowed\(index\)/);
assert.match(gameScreen,/previous\.ordinal>first\.ordinal/);
assert.match(gameScreen,/index===extendedSequentialCount\(lumenProgress\.solved\)/);
assert.match(gameScreen,/canonicalFollowing\?\.legacyIndex===null&&!historicalContinuationAllowed\(levelIndex\+1\)/);
console.log("Canonical 400-quest registry: stable identity, legacy save keys and pagination verified");
