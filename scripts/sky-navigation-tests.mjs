import assert from 'node:assert/strict';
import {CONTENT_PACKS,BASE_PACK_ID,BASE_CONSTELLATIONS,contentMapModel,hasPackAccess,preserveStartedAdventureAccess} from '../src/campaign/content.js';
import {skySelection} from '../src/ui/sky-navigation.js';
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
console.log(JSON.stringify({skyNavigation:true,accessPreservation:true,noUnlockMechanic:true,pages:[1,6,7,12,103],multipleSkies:true,accessRefresh:true}));
