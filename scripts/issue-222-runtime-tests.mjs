import fs from "node:fs";
import assert from "node:assert/strict";
import {canonicalQuestCount,canonicalQuestByOrdinal,canonicalQuestById,canonicalQuestForLegacy,canonicalQuestList,canonicalNextUnsolved,canonicalDisplayForLegacy,canonicalAdventureSummary} from "../src/campaign/canonical-quests.js";
import {playableQuest} from "../src/campaign/playable-quests.js";
import {adminCanonicalCatalogueTree} from "../src/campaign/admin-catalogue.js";
import {resolveCanonicalQuest,nextCanonicalQuest} from "../src/campaign/playable-navigation.js";
// A PR verification must not rewrite the registry behind the immutable
// catalogue contract. Generation remains an audited, downloadable artifact.
const generationWorkflow=fs.readFileSync(new URL('../.github/workflows/issue-222-generate.yml',import.meta.url),'utf8');
assert.match(generationWorkflow,/permissions:\s+contents: read/);
assert.doesNotMatch(generationWorkflow,/git (?:commit|push)\b/);
assert.match(generationWorkflow,/uses: actions\/upload-artifact@v4/);
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
assert.equal(resolveCanonicalQuest(101,["real-adventure-02"]).status,"prerequisite","Ownership alone cannot skip campaign prerequisites");
assert.equal(resolveCanonicalQuest(100,[],{legacyAdventureAccess:["base-real-sky"]}).status,"prerequisite");
const completedFirst={catalogueOrigin:2,solved:Object.fromEntries(quests.slice(0,100).filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(quests.slice(0,100).filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true}]))};
assert.equal(resolveCanonicalQuest(101,["real-adventure-02"],completedFirst).status,"ready");
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
assert.match(gameScreen,/const canonicalQuest=activeQuest\(\)/);
assert.match(gameScreen,/const canonicalNumber=view\.ordinal,ch=\{name:view\.constellationName\},range=\{count:view\.total\},pos=view\.position/);
assert.match(gameScreen,/const canonicalQuest=activeQuest\(\),view=readQuestView\(canonicalQuest,lumenProgress,canonicalQuestList\(\),CONTENT_CONSTELLATIONS\)/);
assert.match(gameScreen,/for\(const adventure of adminCanonicalCatalogueTree\(\)\)/);
assert.match(gameScreen,/x\.fillText\("Quête "\+\(a\.canonicalNumber\?\?levelIndex\+1\)/);
assert.match(gameScreen,/return \{kicker,main,detail,ch,pos,total:range\.count,solved,run,secs,canonicalNumber,canonicalTotal:canonicalQuestList\(\)\.length\}/);
const admin=adminCanonicalCatalogueTree();
assert.equal(admin.length,4);
assert.deepEqual(admin.map(x=>x.questCount),[100,100,100,100]);
assert.deepEqual(admin.map(x=>x.constellations.length),[10,10,10,10]);
assert.equal(admin.flatMap(p=>p.constellations.flatMap(c=>c.quests)).length,400);
assert.equal(admin.flatMap(p=>p.constellations.flatMap(c=>c.quests)).filter(q=>q.source==="generated").length,104);
assert.deepEqual(admin.map(x=>[x.startNumber,x.endNumber]),[[1,100],[101,200],[201,300],[301,400]]);
assert.match(gameScreen,/button\.disabled=!available/);
assert.match(gameScreen,/button\.dataset\.questId=quest\.id/);
assert.match(gameScreen,/function canonicalPerformanceBadges\(questId\)/);
assert.match(gameScreen,/solved\?canonicalPerformanceBadges\(quest\.id\)/);
assert.match(gameScreen,/\[\["speed","Rapidité"\]/);
assert.match(gameScreen,/const canonicalCards=canonicalQuestList\(\)\.filter\(q=>q\.constellationId===mappedConstellation\.id\)/);
assert.match(gameScreen,/puzzleGrid\.replaceChildren\(\)/);
assert.match(gameScreen,/button\.disabled=!available/);
assert.match(gameScreen,/if\(solved\)\{startReplay\(legacy\);return\}/);
assert.match(gameScreen,/if\(canonicalActiveQuest\)\{await celebrateCanonicalSuccess\(\);return\}/);
assert.match(gameScreen,/canonicalQuestAvailable\(quest\)/);
assert.match(gameScreen,/startCanonicalQuest\(quest\)/);
assert.match(gameScreen,/const ownerClient=lumenSupabase/);
assert.match(gameScreen,/await commitCanonicalVictory\(ownerClient,q\.id,pending\.reward,\{operationId:pending\.operationId,userId:ownerId,sessionValid:sameVictoryContext\}\)/);
assert.match(gameScreen,/const sameVictoryContext=\(\)=>lumenUser\?\.id===victoryOwner&&lumenSupabase===victoryClient/);
assert.match(gameScreen,/if\(!sameVictoryContext\(\)\)return/);
assert.match(gameScreen,/canonicalVictoryOutbox\.enqueue\(ownerId,q\.id,queuedReward,\{operationId\}\)/);
assert.match(gameScreen,/const canonicalFollowing=canonicalPrevious&&canonicalQuestByOrdinal/);
assert.match(gameScreen,/if\(!current\)return;canonicalActiveQuest=null;levelIndex=i/);
assert.match(gameScreen,/confirmedBadges\.autonomy\?15:10/);
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
assert.match(gameScreen,/canonicalCampaignQuestDecision\(canonicalQuestForLegacy\(index\),navigationProgress\(\),/);
assert.match(gameScreen,/const legacy=quest\.legacyIndex,solved=legacy!==null\?!!lumenProgress\.solved/);
assert.match(gameScreen,/function historicalContinuationAllowed\(index\)/);
assert.match(gameScreen,/function activeQuest\(\)\{return canonicalActiveQuest\?\?canonicalQuestForLegacy\(levelIndex\)\}/);
assert.match(gameScreen,/const played=activeQuest\(\),targetConstellationId=played\.constellationId/);
assert.match(gameScreen,/openJourneyMap\(true,\{detail:true,advanceOnClose:true,learningTour,questIndex:targetLegacyIndex,constellationId:targetConstellationId\}\)/);
const skyNavigationSource=fs.readFileSync(new URL("../src/ui/sky-navigation.js",import.meta.url),"utf8");
assert.match(skyNavigationSource,/open\(\{detail:showDetail=false,questIndex=null,constellationId=null\}/);
assert.match(skyNavigationSource,/Number\.isInteger\(questIndex\)\?questIndex:getQuest\(\)/);
assert.match(gameScreen,/quest\.ordinal>first\.ordinal&&questIsAccessible\(index\)/);
assert.match(gameScreen,/canonicalFollowing\?\.legacyIndex===null&&!historicalContinuationAllowed\(levelIndex\+1\)/);
console.log("Canonical 400-quest registry: stable identity, legacy save keys and pagination verified");

// #322: the last (often stable-ID) quest of a constellation must remain
// playable after completion; locked states must explain the prerequisite.
assert.match(gameScreen,/function canonicalQuestAvailable\(quest\)\{return canonicalQuestAccess\(quest\).status==='ready'\}/);
assert.match(gameScreen,/terminée, rejouable/);
assert.match(gameScreen,/termine d’abord les quêtes précédentes/);
const constellationEnds=quests.filter((q,i)=>i===quests.length-1||quests[i+1].constellationId!==q.constellationId);
assert.equal(constellationEnds.length,40);
assert.equal(new Set(constellationEnds.map(q=>q.id)).size,40);
