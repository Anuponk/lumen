// Adventure 5 canonical-only staging adapter. Does not mutate published catalogue or saves.
import candidates from '../../content/generated/fifth-adventure-candidates.json' with {type:'json'};
import config from '../../content/fifth-adventure-preview.json' with {type:'json'};
import {buildQuestDefinitions} from './quest-definition.js';
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS,contentMapModel} from './content.js';
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
