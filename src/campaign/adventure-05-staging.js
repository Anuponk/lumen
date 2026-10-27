// Adventure 5 canonical-only staging adapter. Does not mutate published catalogue or saves.
import candidates from '../../content/generated/fifth-adventure-candidates.json' with {type:'json'};
import config from '../../content/fifth-adventure-preview.json' with {type:'json'};
import {buildQuestDefinitions} from './quest-definition.js';
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS,contentMapModel} from './content.js';
import {publishedCatalogueQuests} from './catalogue-origin.js';
import {normalizeEntitlements} from './content.js';
export const ADVENTURE_05_STAGING_PACK=Object.freeze({
 id:config.id,skyId:config.skyId,kind:'addon',access:config.access,order:config.order,
 displayName:config.displayName,shortDescription:'Dix nouvelles constellations du ciel réel',
 questCount:candidates.quests.length,questIndices:Object.freeze([]),
 constellationIds:Object.freeze(config.constellations.map(c=>c.id)),canonicalOnly:true
});
export const ADVENTURE_05_STAGING_CONSTELLATIONS=Object.freeze(config.constellations.map((c,index)=>Object.freeze({
 id:c.id,label:c.name,iau:c.iau,skyId:config.skyId,packId:config.id,
 legacyIndex:null,questStart:null,questCount:config.questsPerConstellation,
 questIndices:Object.freeze([]),canonicalOnly:true,displayOrder:index
})));
export const ADVENTURE_05_STAGING_QUESTS=Object.freeze(buildQuestDefinitions(
 candidates.quests.map((q,index)=>({
 id:q.id,ordinal:index+1,legacyIndex:null,packId:config.id,constellationId:q.constellationId
 })),[ADVENTURE_05_STAGING_PACK],ADVENTURE_05_STAGING_CONSTELLATIONS
));
export const ADVENTURE_05_STAGING_GRIDS=Object.freeze(new Map(candidates.quests.map(q=>[
 q.id,Object.freeze({reg:q.reg,sol:q.sol,audit:q.audit})
])));

// Explicit preview only: production content registries remain untouched until publication.
export function adventure05PreviewMap(entitlements=[],progress={}){
 const packs=[...CONTENT_PACKS,ADVENTURE_05_STAGING_PACK];
 const constellations=[...CONTENT_CONSTELLATIONS,...ADVENTURE_05_STAGING_CONSTELLATIONS];
 return contentMapModel(entitlements,{packs,constellations,progress});
}

// Read-only canonical quest lookup for the eventual gameplay bridge.
// No legacy numeric index, reward write or cloud mutation is performed here.
export function adventure05QuestForPlay(id,entitlements=[]){
 const access=normalizeEntitlements(entitlements);
 if(!access.has(ADVENTURE_05_STAGING_PACK.id))return null;
 const definition=ADVENTURE_05_STAGING_QUESTS.find(quest=>quest.id===String(id));
 if(!definition)return null;
 const grid=ADVENTURE_05_STAGING_GRIDS.get(definition.id);
 if(!grid)return null;
 // Clone arrays: game interaction must never mutate the imported content.
 return {...definition,reg:grid.reg.map(row=>[...row]),sol:[...grid.sol],audit:grid.audit?structuredClone(grid.audit):null};
}

// Preview published ordering without changing historical catalogue origins.
// Staging ordinals are local; runtime ordinals must follow the published tail.
export function adventure05CanonicalPreview(){
 const existing=publishedCatalogueQuests();
 const records=[...existing,...ADVENTURE_05_STAGING_QUESTS.map((quest,index)=>({
  id:quest.id,ordinal:existing.length+index+1,legacyIndex:null,
  packId:quest.packId,constellationId:quest.constellationId
 }))];
 return buildQuestDefinitions(records,
  [...CONTENT_PACKS,ADVENTURE_05_STAGING_PACK],
  [...CONTENT_CONSTELLATIONS,...ADVENTURE_05_STAGING_CONSTELLATIONS]);
}

// Preview navigation is independent of legacy indices and rewards.
// Replays are allowed; new quests advance only after the prior quest in this pack.
export function adventure05PreviewQuestDecision(id,entitlements=[],progress={},cloudReady=true){
 const quest=ADVENTURE_05_STAGING_QUESTS.find(q=>q.id===String(id));
 if(!quest)return {status:'missing-content'};
 if(!normalizeEntitlements(entitlements).has(ADVENTURE_05_STAGING_PACK.id))return {status:'pack-locked'};
 if(!cloudReady)return {status:'sync-required'};
 const state=progress?.canonicalQuestState??{};
 if(state[quest.id]?.solved)return {status:'ready',reason:'replay',quest};
 const index=ADVENTURE_05_STAGING_QUESTS.findIndex(q=>q.id===quest.id);
 const previous=index>0?ADVENTURE_05_STAGING_QUESTS[index-1]:null;
 if(previous&&!state[previous.id]?.solved)return {status:'prerequisite',questId:previous.id};
 return {status:'ready',reason:'sequential',quest};
}
