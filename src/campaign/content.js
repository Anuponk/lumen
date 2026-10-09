import {CONSTELLATIONS,CONSTELLATION_GRID_COUNTS,CONSTELLATION_QUESTS,CAMPAIGN_SIZE_SCHEDULE} from "./data.js";

export const CONTENT_MODEL_VERSION=1;
export const BASE_SKY_ID="real-sky";
export const BASE_PACK_ID="base-real-sky";
// Product grouping, independent of the number of available constellations.
export const ADVENTURE_SIZE=10;
const adventureNames=["Premières lueurs","Horizons lointains","Au-delà de l’horizon"];
const adventureId=index=>index===0?BASE_PACK_ID:`real-adventure-${String(index+1).padStart(2,"0")}`;
export const BASE_CONSTELLATION_IDS=Object.freeze(CONSTELLATIONS.map((_,index)=>`real-${String(index+1).padStart(2,"0")}`));

export const BASE_CONSTELLATIONS=Object.freeze(CONSTELLATIONS.map((constellation,index)=>{
 const questIndices=Object.freeze([...(CONSTELLATION_QUESTS[index]||[])]),questStart=questIndices[0]??0;
 return Object.freeze({id:BASE_CONSTELLATION_IDS[index],legacyIndex:index,skyId:BASE_SKY_ID,packId:adventureId(Math.floor(index/ADVENTURE_SIZE)),label:constellation.name,questStart,questCount:questIndices.length,questIndices});
}));

export function baseCampaignQuestCount(){
 return Object.keys(CAMPAIGN_SIZE_SCHEDULE).length;
}
export function baseQuestId(index){
 const i=Number(index);
 return Number.isInteger(i)&&i>=0&&i<baseCampaignQuestCount()?`base-q${String(i+1).padStart(3,"0")}`:null;
}

export const CONTENT_SKIES=Object.freeze([
 Object.freeze({id:BASE_SKY_ID,kind:"real",label:"Le vrai ciel",order:0})
]);

const LEGACY_CONTENT_PACKS=Object.freeze(Array.from({length:Math.ceil(BASE_CONSTELLATIONS.length/ADVENTURE_SIZE)},(_,index)=>{
 const entries=BASE_CONSTELLATIONS.slice(index*ADVENTURE_SIZE,(index+1)*ADVENTURE_SIZE);
 const questIndices=Object.freeze(entries.flatMap(c=>c.questIndices||[]).sort((a,b)=>a-b));
 return Object.freeze({id:adventureId(index),skyId:BASE_SKY_ID,kind:index===0?"base":"addon",access:index===0?"included":"locked",order:index,displayName:adventureNames[index]||`Aventure ${index+1}`,shortDescription:index===0?"Tes premières constellations":"Une nouvelle aventure dans le vrai ciel",legacyQuestStart:questIndices[0]??0,questCount:questIndices.length,questIndices,constellationIds:Object.freeze(entries.map(c=>c.id))});
}));

// Generated content extends the map without changing the historical quest schedule.
// A lightweight descriptor keeps this module compatible with VM-based legacy regression tests.
const generatedManifest={pack:{id:"real-adventure-04",skyId:"real-sky",kind:"addon",access:"locked",order:3,displayName:"Horizons inconnus",questCount:100,questIndices:Array.from({length:100},(_,i)=>196+i),constellationIds:["iau-ant","iau-aps","iau-ara","iau-ari","iau-aur","iau-cae","iau-cam","iau-cnc","iau-cvn","iau-cmi"]},constellations:["iau-ant","iau-aps","iau-ara","iau-ari","iau-aur","iau-cae","iau-cam","iau-cnc","iau-cvn","iau-cmi"].map((id,i)=>({id,label:["Antlia","Apus","Ara","Aries","Auriga","Caelum","Camelopardalis","Cancer","Canes Venatici","Canis Minor"][i],packId:"real-adventure-04",skyId:"real-sky",questIndices:Array.from({length:10},(_,j)=>196+i*10+j)}))};
export const GENERATED_CONSTELLATIONS=Object.freeze(generatedManifest.constellations.map((c,index)=>Object.freeze({
 ...c,legacyIndex:BASE_CONSTELLATIONS.length+index,
 questStart:c.questIndices[0],questCount:c.questIndices.length
})));
export const CONTENT_PACKS=Object.freeze([...LEGACY_CONTENT_PACKS,Object.freeze({...generatedManifest.pack})]);
export const CONTENT_CONSTELLATIONS=Object.freeze([...BASE_CONSTELLATIONS,...GENERATED_CONSTELLATIONS]);

export function normalizeEntitlements(rows=[]){
 return new Set((rows instanceof Set?[...rows]:Array.isArray(rows)?rows:[])
  .map(row=>typeof row==="string"?row:(row?.entitlement??row?.pack_id??row?.packId??row?.content_id??row?.contentId??row?.id))
  .filter(Boolean)
  .map(String));
}

export function hasPackAccess(pack,entitlements=[],progress={},attempt=null){
 if(!pack)return false;
 if(pack.access==="included"||pack.kind==="base")return true;
 const questIndices=pack.questIndices||[];
 const started=Object.keys(progress.solved||{}).some(key=>progress.solved[key]&&questIndices.includes(Number(key)));
 const active=attempt?.startedAt&&attempt.mode!=="challenge"&&questIndices.includes(Number(attempt.questId)-1);
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
 return packs.find(pack=>{
  if(Array.isArray(pack.questIndices))return pack.questIndices.includes(i);
  const start=Number(pack.legacyQuestStart),count=Number(pack.questCount);
  return Number.isInteger(start)&&Number.isInteger(count)&&i>=start&&i<start+count;
 })||null;
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
 constellations=CONTENT_CONSTELLATIONS,progress={},attempt=null
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
