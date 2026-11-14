import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CONTENT_CONSTELLATIONS,CONTENT_PACKS,contentMapModel} from '../src/campaign/content.js';
import {skyQuestTarget} from '../src/ui/sky-navigation.js';
import {functionSource} from './source-tools.mjs';
const quests=canonicalQuestList(),model=contentMapModel(CONTENT_PACKS.map(p=>p.id));
const target=quests.find(q=>q.packId===CONTENT_PACKS.at(-1).id);
assert.equal(skyQuestTarget(model,0,target.constellationId)?.pack.id,target.packId,'Explicit canonical constellation takes priority over an earlier numeric quest across the entire catalogue');
for(const count of [1,7,13,19]){
 const first={id:'earlier',accessible:true,constellations:[{id:'old',questIndices:[0]}]},later={id:'later',accessible:true,constellations:Array.from({length:count},(_,i)=>({id:'new-'+i,questIndices:[]}))};
 const multiple={skies:[{id:'one',packs:[first]},{id:'two',packs:[later]}]},id=later.constellations.at(-1).id;
 assert.equal(skyQuestTarget(multiple,0,id).sky.id,'two');
 assert.equal(skyQuestTarget(multiple,0,id).entry.id,id);
 later.accessible=false;assert.equal(skyQuestTarget(multiple,0,id).pack.id,'earlier','A requested constellation grants no pack access');
 assert.equal(skyQuestTarget(multiple,0,'unknown').entry.id,'old','Unknown identity retains the accessible numeric fallback');
}
assert.equal(skyQuestTarget({skies:[]},0,target.constellationId),undefined);
const source=fs.readFileSync('src/ui/game-screen.js','utf8');
const nodes=new Map();const element=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,dataset:{},focus(){}});return nodes.get(id)};
for(const played of quests.filter(q=>q.position===1)){
 let opened;
 const context={firstLearningSkyVisit:()=>false,activeQuest:()=>played,levelIndex:0,CONTENT_CONSTELLATIONS,mapConstellation:0,
 chapterForGrid:()=>0,document:{getElementById:element},skyNavigation:{open:options=>{opened=options}},renderMap(){},startBadgeCooldownRefresh(){},clearSkyTourFocus(){},lumenProgress:{solved:{}},requestAnimationFrame(){},renderSkyTourStep(){}};
 vm.createContext(context);vm.runInContext(functionSource(source,'openJourneyMap'),context);context.openJourneyMap();
 assert.equal(opened.constellationId,played.constellationId,'Default map return follows played stable identity '+played.id);
 context.openJourneyMap(false,{questIndex:1});assert.equal(opened.constellationId,null,'Explicit numeric teaching destination overrides the current board');
 context.openJourneyMap(false,{constellationId:target.constellationId,questIndex:0});assert.equal(opened.constellationId,target.constellationId);
}
console.log('PASS canonical sky-return identity and explicit destination priority');
