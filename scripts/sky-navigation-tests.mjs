import {readFileSync} from "node:fs";
import assert from 'node:assert/strict';
import {CONTENT_PACKS,BASE_PACK_ID,BASE_CONSTELLATIONS,contentMapModel,hasPackAccess,preserveStartedAdventureAccess} from '../src/campaign/content.js';
import {skySelection,constellationUnlocked,skyPickerVisible,swipeAdventureTarget,swipeConstellationTarget} from '../src/ui/sky-navigation.js';
assert.equal(skyPickerVisible(contentMapModel()),false);
assert.equal(skyPickerVisible({skies:[{id:'only'}]}),false);
assert.equal(skyPickerVisible({skies:[{id:'a'},{id:'b'}]}),true);
const base=CONTENT_PACKS[0],next=CONTENT_PACKS[1],third=CONTENT_PACKS[2];
assert.equal(base.id,BASE_PACK_ID);assert.equal(base.constellationIds.length,10);
const prefix=count=>({solved:Object.fromEntries(Array.from({length:count},(_,i)=>[i,1])),badges:{historical:1}});
for(const [count,expected] of [[0,false],[next.legacyQuestStart,false],[next.legacyQuestStart+1,true]])assert.equal(hasPackAccess(next,[],prefix(count)),expected);
const old=prefix(next.legacyQuestStart+1),before=structuredClone(old);
assert(preserveStartedAdventureAccess(old));assert(hasPackAccess(next,[],old));assert(!hasPackAccess(third,[],old));
assert.deepEqual(old.solved,before.solved);assert.deepEqual(old.badges,before.badges);assert.equal(preserveStartedAdventureAccess(old),false);
const unstarted={questId:next.legacyQuestStart+1,mode:'campaign',startedAt:null};
const running={...unstarted,startedAt:123,state:'PAUSED'};
assert(!hasPackAccess(next,[],prefix(next.legacyQuestStart),unstarted));
assert(hasPackAccess(next,[],prefix(next.legacyQuestStart),running));
assert(!hasPackAccess(next,[],prefix(next.legacyQuestStart),{...running,mode:'challenge'}));
assert.equal(hasPackAccess(next,[],{solved:{},legacyAdventureAccess:{broken:true}}),false);
assert.equal(preserveStartedAdventureAccess({solved:{},legacyAdventureAccess:{broken:true}}),false);
const remembered=prefix(next.legacyQuestStart);assert(preserveStartedAdventureAccess(remembered,running));assert(hasPackAccess(next,[],remembered,null));
assert(hasPackAccess(third,[third.id]));assert(!hasPackAccess(third,[]));
const owned=contentMapModel([third.id]);assert(owned.skies[0].packs[2].accessible,'Map respects real entitlements');
const restored=contentMapModel([],{progress:old});assert(restored.skies[0].packs[1].accessible);assert(!restored.skies[0].packs[2].accessible);
assert.equal(skySelection(contentMapModel([],{progress:prefix(next.legacyQuestStart)}),{},next.legacyQuestStart).active.id,BASE_PACK_ID,'A locked next Adventure is not the active Adventure');

for(const count of [1,6,7,12,103]){
 const entries=Array.from({length:count},(_,i)=>({id:'c'+i,questStart:i,questCount:1}));
 const model={skies:[{id:'sky',packs:[{id:'a',legacyQuestStart:0,questCount:count,accessible:true,constellations:entries}]}]};
 const initial=skySelection(model,{},0);assert.equal(initial.pages,Math.ceil(count/6));assert.equal(initial.entries.length,Math.min(count,6));
 const final=skySelection(model,{skyId:'sky',packId:'a',page:999},0);assert.equal(final.page,initial.pages-1);assert.equal(final.entries.length,count%6||6);
 const seen=[];for(let page=0;page<initial.pages;page++)seen.push(...skySelection(model,{page},0).entries.map(c=>c.id));assert.deepEqual(seen,entries.map(c=>c.id));
}
const model={skies:[{id:'s1',packs:[{id:'old',accessible:true,legacyQuestStart:0,questCount:10,constellations:[{id:'c1'}]},{id:'current',accessible:true,legacyQuestStart:10,questCount:10,constellations:[{id:'c2'}]}]},{id:'s2',packs:[{id:'other',accessible:true,legacyQuestStart:20,questCount:10,constellations:[{id:'c3'}]}]}]};
assert.equal(skySelection(model,{},12).adventure.id,'current');
assert.equal(skySelection(model,{packId:'old'},12).active.id,'current');assert.equal(skySelection(model,{packId:'old'},12).adventure.id,'old');
assert.equal(skySelection(model,{skyId:'s2'},12).adventure.id,'other');
model.skies[0].packs[0].accessible=false;assert.equal(skySelection(model,{packId:'old'},12).adventure.id,'current');
assert.equal(skySelection(model,{skyId:'removed',packId:'removed',page:-3},12).page,0);
model.skies[1].packs[0].accessible=false;assert.equal(skySelection(model,{skyId:'s2'},12).adventure,null);
assert.equal(new Set(BASE_CONSTELLATIONS.map(c=>c.id)).size,BASE_CONSTELLATIONS.length);

const gemini=BASE_CONSTELLATIONS.find(c=>c.label==="Gémeaux"),taurus=BASE_CONSTELLATIONS.find(c=>c.label==="Taureau");
assert(gemini&&taurus&&gemini.packId===taurus.packId,"Gémeaux and Taureau must share the first Adventure");
const solvedThroughGemini=Object.fromEntries(Array.from({length:gemini.questStart+gemini.questCount},(_,i)=>[i,1]));
const firstPackModel=contentMapModel([],{progress:{solved:solvedThroughGemini}}).skies[0].packs[0];
const taurusView=firstPackModel.constellations.find(c=>c.id===taurus.id);
const solved=id=>!!solvedThroughGemini[id];
assert.equal(constellationUnlocked(taurusView,firstPackModel,solved,()=>gemini.questStart+gemini.questCount-1),true,"Gémeaux complete unlocks Taureau immediately even before current quest advances");
const missingLast={...solvedThroughGemini,[gemini.questStart+gemini.questCount-1]:0};
assert.equal(constellationUnlocked(taurusView,firstPackModel,id=>!!missingLast[id],()=>gemini.questStart+gemini.questCount-1),false,"Taureau stays locked before Gémeaux is complete");
for(let i=1;i<firstPackModel.constellations.length;i++){
 const previous=firstPackModel.constellations[i-1],entry=firstPackModel.constellations[i];
 const done=Object.fromEntries(Array.from({length:previous.questCount},(_,j)=>[previous.questStart+j,1]));
 assert.equal(constellationUnlocked(entry,firstPackModel,id=>!!done[id],()=>previous.questStart+previous.questCount-1),true,`${previous.label} completion unlocks ${entry.label}`);
}


const swipeSky={id:"real-sky",packs:[
 {id:"first",accessible:true,constellations:Array.from({length:10},(_,i)=>({id:"f"+i}))},
 {id:"second",accessible:true,constellations:Array.from({length:10},(_,i)=>({id:"s"+i}))},
 {id:"locked",accessible:false,constellations:Array.from({length:10},(_,i)=>({id:"l"+i}))}
]};
const swipeCurrent={sky:swipeSky,adventure:swipeSky.packs[0],page:1,pages:2};
assert.deepEqual(swipeAdventureTarget({...swipeCurrent,page:0},1),{pack:swipeSky.packs[0],page:1,changedAdventure:false});
assert.deepEqual(swipeAdventureTarget(swipeCurrent,1),{pack:swipeSky.packs[1],page:0,changedAdventure:true,locked:false});
assert.equal(swipeAdventureTarget({...swipeCurrent,page:0},-1),null,"First adventure has no wrap backwards");
assert.deepEqual(swipeAdventureTarget({...swipeCurrent,adventure:swipeSky.packs[1],page:0},-1),{pack:swipeSky.packs[0],page:1,changedAdventure:true,locked:false});
assert.deepEqual(swipeAdventureTarget({...swipeCurrent,adventure:swipeSky.packs[1],page:1},1),{pack:swipeSky.packs[2],page:0,changedAdventure:true,locked:true});
assert.equal(swipeAdventureTarget({...swipeCurrent,adventure:swipeSky.packs[2],page:1},1),null,"Last adventure has no wrap forwards");
assert.equal(swipeAdventureTarget(swipeCurrent,0),null);


const detailSky={id:'sky',packs:[
 {id:'one',accessible:true,constellations:[{id:'a',accessible:true},{id:'b',accessible:true}]},
 {id:'two',accessible:true,constellations:[{id:'c',accessible:true},{id:'d',accessible:true}]},
 {id:'locked',accessible:false,constellations:[{id:'e',accessible:false}]}
]};
const detailState={sky:detailSky,adventure:detailSky.packs[0]};
assert.equal(swipeConstellationTarget(detailState,detailSky.packs[0].constellations[0],-1),null);
assert.equal(swipeConstellationTarget(detailState,detailSky.packs[0].constellations[0],1).entry.id,'b');
assert.equal(swipeConstellationTarget(detailState,detailSky.packs[0].constellations[1],1).entry.id,'c');
assert.equal(swipeConstellationTarget({...detailState,adventure:detailSky.packs[1]},detailSky.packs[1].constellations[0],-1).entry.id,'b');
assert.equal(swipeConstellationTarget({...detailState,adventure:detailSky.packs[1]},detailSky.packs[1].constellations[1],1).locked,true);
assert.equal(swipeConstellationTarget({...detailState,adventure:detailSky.packs[2]},detailSky.packs[2].constellations[0],1),null);

console.log(JSON.stringify({skyNavigation:true,accessPreservation:true,constellationUnlock:true,pages:[1,6,7,12,103],multipleSkies:true,accessRefresh:true}));

const gameUi=readFileSync(new URL("../src/ui/game-screen.js",import.meta.url),"utf8");
assert.match(gameUi,/const lockReason=!qaActive/, "Unavailable canonical quests must show a real lock reason");
assert.match(gameUi,/aria-hidden="true">🔒/, "Unavailable canonical quests must show a visible lock");
const skyUi=readFileSync(new URL("../src/ui/sky-navigation.js",import.meta.url),"utf8");
assert.doesNotMatch(skyUi,/<select id="skyPicker"/,"Obsolete sky selector must not be rendered");
assert.match(skyUi,/detail\.addEventListener\(\x27pointerdown\x27/,"Detail view must handle touch-pointer swipes");
assert.doesNotMatch(skyUi,/if\(e\.target\.closest\(\x27button,input,select,a/,"Swipe on quest buttons must not be discarded");
assert.match(skyUi,/if\(e\.target\.closest\(\x27input,select,textarea/,"Text-entry controls should stay excluded from swipe");
const deployScript=readFileSync(new URL("./o2switch-cron-publish.sh",import.meta.url),"utf8");
assert.match(deployScript,/\("push","workflow_dispatch","schedule"\)/,"Publisher must recognize scheduled green CI");

// Admin access must not erase the current adventure or produce an empty sky.
const adminEntitlements=CONTENT_PACKS.map(pack=>pack.id);
const adminModel=contentMapModel(adminEntitlements,{progress:{solved:{},badges:{}}});
assert.equal(adminModel.skies.length,1);
assert.equal(adminModel.skies[0].packs.length,CONTENT_PACKS.length);
assert(adminModel.skies[0].packs.every(pack=>pack.accessible));
for(const pack of adminModel.skies[0].packs){
 const chosen=skySelection(adminModel,{skyId:pack.skyId,packId:pack.id},pack.legacyQuestStart);
 assert.equal(chosen.adventure.id,pack.id);
 assert(chosen.entries.length>0,'Admin adventure must show constellations');
}
const normalModel=contentMapModel([],{progress:{solved:{},badges:{}}});
assert.equal(skySelection(normalModel,{},0).adventure.id,BASE_PACK_ID);
assert(skySelection(normalModel,{},0).entries.length>0);
assert.equal(skySelection({skies:[]},{},0).adventure,null);
