// Issue #222 migration planning. This module NEVER changes persisted quest keys.
// It creates a full 400-slot canonical order while leaving ungenerated slots explicit.
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS} from "../src/campaign/content.js";
import {playableQuest,playableQuestCount} from "../src/campaign/playable-quests.js";

const TARGET_QUESTS_PER_ADVENTURE=100;
const TARGET_CONSTELLATIONS_PER_ADVENTURE=10;
const CONTENT_SLOTS_PER_CONSTELLATION=10;

function allocation(existing){
 const counts=existing.map(c=>c.questIndices.length);
 const slots=[...counts];
 let remaining=TARGET_QUESTS_PER_ADVENTURE-slots.reduce((a,b)=>a+b,0);
 if(remaining<0)throw Error("Historical adventure has more than 100 quests");
 // Make the distribution as even as possible. Never discard an existing quest.
 while(remaining>0){
  let best=0;
  for(let i=1;i<slots.length;i++)if(slots[i]<slots[best])best=i;
  slots[best]++;remaining--;
 }
 return slots;
}

export function buildMigrationPlan({packs=CONTENT_PACKS,constellations=CONTENT_CONSTELLATIONS,getQuest=playableQuest,questCount=playableQuestCount()}={}){
 const ordered=[...packs].sort((a,b)=>a.order-b.order);
 const currentIds=new Set(),records=[],adventures=[];
 for(const [adventureIndex,pack] of ordered.entries()){
  const existing=pack.constellationIds.map(id=>{
   const match=constellations.find(c=>c.id===id);
   if(!match)throw Error("Missing constellation "+id);
   return match;
  });
  if(existing.length>TARGET_CONSTELLATIONS_PER_ADVENTURE)throw Error("Too many constellations in "+pack.id);
  const slots=allocation([
   ...existing,
   ...Array.from({length:TARGET_CONSTELLATIONS_PER_ADVENTURE-existing.length},(_,i)=>({
    id:pack.id+"-new-"+String(i+1).padStart(2,"0"),questIndices:[]
   }))
  ]);
  const all=[...existing,...Array.from({length:TARGET_CONSTELLATIONS_PER_ADVENTURE-existing.length},(_,i)=>({
   id:pack.id+"-new-"+String(i+1).padStart(2,"0"),questIndices:[]
  }))];
  const start=records.length;
  for(const [constellationIndex,c] of all.entries()){
   if(c.questIndices.length>slots[constellationIndex])throw Error("Existing quests would be lost");
   for(let position=0;position<slots[constellationIndex];position++){
    const originalIndex=c.questIndices[position]??null;
    const quest=originalIndex===null?null:getQuest(originalIndex);
    if(originalIndex!==null&&(!quest||quest.index!==originalIndex))throw Error("Missing playable quest "+originalIndex);
    const stableId=quest?.id??null;
    if(stableId){
     if(currentIds.has(stableId))throw Error("Duplicate stable quest identity "+stableId);
     currentIds.add(stableId);
    }
    records.push({
     ordinal:records.length+1,
     adventureId:pack.id,
     constellationId:c.id,
     constellationPosition:position+1,
     stableQuestId:stableId,
     legacyIndex:originalIndex,
     requiresGeneration:originalIndex===null
    });
   }
  }
  adventures.push({id:pack.id,firstQuest:start+1,lastQuest:records.length,existing:records.slice(start).filter(q=>!q.requiresGeneration).length,missing:records.slice(start).filter(q=>q.requiresGeneration).length});
 }
 const historical=records.filter(q=>!q.requiresGeneration);
 if(historical.length!==questCount||new Set(historical.map(q=>q.legacyIndex)).size!==questCount)throw Error("Existing quests not preserved one-to-one");
 if(adventures.some(a=>a.lastQuest-a.firstQuest+1!==TARGET_QUESTS_PER_ADVENTURE))throw Error("Adventure has incorrect size");
 return {schemaVersion:1,publicationReady:records.every(q=>!q.requiresGeneration),total:records.length,missing:records.filter(q=>q.requiresGeneration).length,adventures,records};
}

export function migrateLegacySolved(solved,plan){
 // Deliberately do not move values between numeric keys. This is a read-only
 // translation for displays; only stable IDs may be used by future storage writers.
 const byLegacy=new Map(plan.records.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,q]));
 return Object.entries(solved||{}).flatMap(([key,value])=>{
  const record=byLegacy.get(Number(key));
  return record&&value?[{id:record.stableQuestId,ordinal:record.ordinal,legacyIndex:record.legacyIndex}]:[];
 });
}
