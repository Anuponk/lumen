import {CONSTELLATIONS,CONSTELLATION_GRID_COUNTS} from "./data.js";

export const CONTENT_MODEL_VERSION=1;
export const BASE_SKY_ID="real-sky";
export const BASE_PACK_ID="base-real-sky";
export const BASE_CONSTELLATION_IDS=Object.freeze(CONSTELLATIONS.map((_,index)=>`real-${String(index+1).padStart(2,"0")}`));

export const BASE_CONSTELLATIONS=Object.freeze(CONSTELLATIONS.map((constellation,index)=>{
 let questStart=0;for(let i=0;i<index;i++)questStart+=CONSTELLATION_GRID_COUNTS[i];
 return Object.freeze({id:BASE_CONSTELLATION_IDS[index],legacyIndex:index,skyId:BASE_SKY_ID,packId:BASE_PACK_ID,label:constellation.name,questStart,questCount:CONSTELLATION_GRID_COUNTS[index]});
}));

export function baseCampaignQuestCount(){
 return CONSTELLATION_GRID_COUNTS.reduce((sum,count)=>sum+count,0);
}
export function baseQuestId(index){
 const i=Number(index);
 return Number.isInteger(i)&&i>=0&&i<baseCampaignQuestCount()?`base-q${String(i+1).padStart(3,"0")}`:null;
}

export const CONTENT_SKIES=Object.freeze([
 Object.freeze({id:BASE_SKY_ID,kind:"real",label:"Le vrai ciel",order:0})
]);

export const CONTENT_PACKS=Object.freeze([
 Object.freeze({
  id:BASE_PACK_ID,
  skyId:BASE_SKY_ID,
  kind:"base",
  access:"included",
  order:0,
  legacyQuestStart:0,
  questCount:baseCampaignQuestCount(),
  constellationIds:BASE_CONSTELLATION_IDS
 })
]);

export function normalizeEntitlements(rows=[]){
 return new Set((Array.isArray(rows)?rows:[])
  .map(row=>typeof row==="string"?row:(row?.entitlement??row?.pack_id??row?.packId??row?.content_id??row?.contentId??row?.id))
  .filter(Boolean)
  .map(String));
}

export function hasPackAccess(pack,entitlements=[]){
 if(!pack)return false;
 if(pack.access==="included"||pack.kind==="base")return true;
 return normalizeEntitlements(entitlements).has(pack.id);
}

export function packForLegacyQuest(index,packs=CONTENT_PACKS){
 const i=Number(index);if(!Number.isInteger(i)||i<0)return null;
 return packs.find(pack=>Number.isInteger(pack.legacyQuestStart)&&i>=pack.legacyQuestStart&&i<pack.legacyQuestStart+pack.questCount)||null;
}

export function contentAccessForLegacyQuest(index,entitlements=[],packs=CONTENT_PACKS){
 const pack=packForLegacyQuest(index,packs);
 return {pack,accessible:hasPackAccess(pack,entitlements)};
}

export function contentRegistrySnapshot({skies=CONTENT_SKIES,packs=CONTENT_PACKS}={}){
 return {
  version:CONTENT_MODEL_VERSION,
  skies:skies.map(x=>({...x})),
  packs:packs.map(x=>({...x,constellationIds:[...(x.constellationIds||[])]}))
 };
}


export function contentMapModel(entitlements=[],{
 skies=CONTENT_SKIES,
 packs=CONTENT_PACKS,
 constellations=BASE_CONSTELLATIONS
}={}){
 const entitlementSet=normalizeEntitlements(entitlements);
 return {
  version:CONTENT_MODEL_VERSION,
  skies:skies.map(sky=>{
   const skyPacks=packs.filter(pack=>pack.skyId===sky.id).sort((a,b)=>(a.order||0)-(b.order||0));
   const packViews=skyPacks.map(pack=>{
    const accessible=hasPackAccess(pack,entitlementSet);
    return {
     ...pack,
     accessible,
     constellations:constellations.filter(c=>c.packId===pack.id).sort((a,b)=>(a.legacyIndex??999999)-(b.legacyIndex??999999)).map(c=>({...c,accessible}))
    };
   });
   return {...sky,packs:packViews,constellations:packViews.flatMap(pack=>pack.constellations)};
  })
 };
}
