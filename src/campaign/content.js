import {CONSTELLATIONS,CONSTELLATION_GRID_COUNTS} from "./data.js";

export const CONTENT_MODEL_VERSION=1;
export const BASE_SKY_ID="real-sky";
export const BASE_PACK_ID="base-real-sky";
// Product grouping, independent of the number of available constellations.
export const ADVENTURE_SIZE=10;
const adventureNames=["Premières lueurs","Horizons lointains","Au-delà de l’horizon"];
const adventureId=index=>index===0?BASE_PACK_ID:`real-adventure-${String(index+1).padStart(2,"0")}`;
export const BASE_CONSTELLATION_IDS=Object.freeze(CONSTELLATIONS.map((_,index)=>`real-${String(index+1).padStart(2,"0")}`));

export const BASE_CONSTELLATIONS=Object.freeze(CONSTELLATIONS.map((constellation,index)=>{
 let questStart=0;for(let i=0;i<index;i++)questStart+=CONSTELLATION_GRID_COUNTS[i];
 return Object.freeze({id:BASE_CONSTELLATION_IDS[index],legacyIndex:index,skyId:BASE_SKY_ID,packId:adventureId(Math.floor(index/ADVENTURE_SIZE)),label:constellation.name,questStart,questCount:CONSTELLATION_GRID_COUNTS[index]});
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

export const CONTENT_PACKS=Object.freeze(Array.from({length:Math.ceil(BASE_CONSTELLATIONS.length/ADVENTURE_SIZE)},(_,index)=>{
 const entries=BASE_CONSTELLATIONS.slice(index*ADVENTURE_SIZE,(index+1)*ADVENTURE_SIZE);
 return Object.freeze({id:adventureId(index),skyId:BASE_SKY_ID,kind:index===0?"base":"addon",access:index===0?"included":"locked",order:index,displayName:adventureNames[index]||`Aventure ${index+1}`,shortDescription:index===0?"Tes premières constellations":"Une nouvelle aventure dans le vrai ciel",legacyQuestStart:entries[0].questStart,questCount:entries.reduce((sum,c)=>sum+c.questCount,0),constellationIds:Object.freeze(entries.map(c=>c.id))});
}));

export function normalizeEntitlements(rows=[]){
 return new Set((rows instanceof Set?[...rows]:Array.isArray(rows)?rows:[])
  .map(row=>typeof row==="string"?row:(row?.entitlement??row?.pack_id??row?.packId??row?.content_id??row?.contentId??row?.id))
  .filter(Boolean)
  .map(String));
}

export function hasPackAccess(pack,entitlements=[],progress={},attempt=null){
 if(!pack)return false;
 if(pack.access==="included"||pack.kind==="base")return true;
 const start=pack.legacyQuestStart,end=start+pack.questCount;
 const started=Number.isInteger(start)&&Object.keys(progress.solved||{}).some(key=>progress.solved[key]&&Number(key)>=start&&Number(key)<end);
 const active=attempt?.startedAt&&attempt.mode!=="challenge"&&Number(attempt.questId)-1>=start&&Number(attempt.questId)-1<end;
 return normalizeEntitlements(entitlements).has(pack.id)||!!started||!!active||(Array.isArray(progress.legacyAdventureAccess)&&progress.legacyAdventureAccess.includes(pack.id));
}

export function preserveStartedAdventureAccess(progress,attempt=null,packs=CONTENT_PACKS){
 const prior=Array.isArray(progress.legacyAdventureAccess)?progress.legacyAdventureAccess:[],next=new Set(prior);
 for(const pack of packs)if(pack.access!=="included"&&hasPackAccess(pack,[],progress,attempt))next.add(pack.id);
 if(next.size===prior.length)return false;
 progress.legacyAdventureAccess=[...next];return true;
}

export function packForLegacyQuest(index,packs=CONTENT_PACKS){
 const i=Number(index);if(!Number.isInteger(i)||i<0)return null;
 return packs.find(pack=>Number.isInteger(pack.legacyQuestStart)&&i>=pack.legacyQuestStart&&i<pack.legacyQuestStart+pack.questCount)||null;
}

export function contentAccessForLegacyQuest(index,entitlements=[],packs=CONTENT_PACKS,progress={},attempt=null){
 const pack=packForLegacyQuest(index,packs);
 return {pack,accessible:hasPackAccess(pack,entitlements,progress,attempt)};
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
 constellations=BASE_CONSTELLATIONS,progress={},attempt=null
}={}){
 const entitlementSet=normalizeEntitlements(entitlements);
 return {
  version:CONTENT_MODEL_VERSION,
  skies:skies.map(sky=>{
   const skyPacks=packs.filter(pack=>pack.skyId===sky.id).sort((a,b)=>(a.order||0)-(b.order||0));
   const packViews=skyPacks.map(pack=>{
    const accessible=hasPackAccess(pack,entitlementSet,progress,attempt);
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
