// Issue #222 migration planning. This module NEVER changes persisted quest keys.
// It creates a full 400-slot canonical order while leaving ungenerated slots explicit.
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS} from "../src/campaign/content.js";
import {playableQuest,playableQuestCount} from "../src/campaign/playable-quests.js";

const TARGET_QUESTS_PER_ADVENTURE=100;
const TARGET_CONSTELLATIONS_PER_ADVENTURE=10;
const CONTENT_SLOTS_PER_CONSTELLATION=10;

function allocation(existing){
 if(existing.some(c=>c.questIndices.length>10))throw Error("Constellation exceeds ten historical quests");
 return existing.map(()=>10);
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
  if(pack.id==="real-adventure-02"){
   const from=existing.find(c=>c.id==="real-12"),to=existing.find(c=>c.id==="real-13");
   if(from?.questIndices.length===11&&to?.questIndices.length===8){
    const moved=from.questIndices.at(-1);
    const copy=existing.map(c=>({...c,questIndices:[...c.questIndices]}));
    copy.find(c=>c.id==="real-12").questIndices.pop();
    copy.find(c=>c.id==="real-13").questIndices.push(moved);
    existing.splice(0,existing.length,...copy);
   }
  }
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
    const proposedQuestId=stableId??(c.id==="real-13"&&position===9?"planned-real-13-q09":c.id==="real-20"&&position===9?"planned-real-13-q10":`planned-${c.id}-q${String(position+1).padStart(2,"0")}`);
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
     proposedQuestId,
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
 if(new Set(records.map(q=>q.proposedQuestId)).size!==records.length)throw Error("Duplicate planned quest identity");
 return {schemaVersion:1,publicationReady:records.every(q=>!q.requiresGeneration),total:records.length,missing:records.filter(q=>q.requiresGeneration).length,adventures,records};
}

export function migrateLegacySolved(solved,plan){
 // Deliberately do not move values between numeric keys. This is a read-only
 // translation for displays; only stable IDs may be used by future storage writers.
 const byLegacy=new Map(plan.records.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,q]));
 return Object.entries(solved||{}).flatMap(([key,value])=>{
  const record=byLegacy.get(Number(key));
  if(!value)return [];
  if(!record)throw Error("Unmapped persisted quest key: "+key);
  return [{id:record.stableQuestId,ordinal:record.ordinal,legacyIndex:record.legacyIndex}];
 });
}

// Consumers may display the planned ordinals only after every placeholder is
// replaced by a verified, uniquely solved puzzle and the cloud migration passes.
export function assertPublicationReady(plan){
 if(!plan||plan.publicationReady!==true||plan.records.some(q=>q.requiresGeneration||!q.stableQuestId))throw Error("Catalogue publication blocked: unaudited quest slots remain");
 if(new Set(plan.records.map(q=>q.stableQuestId)).size!==plan.records.length)throw Error("Catalogue publication blocked: duplicate stable IDs");
 return true;
}

// A deterministic migration ledger for review, challenge-link translation and rollback.
// Do not mutate the original player profile; persistent migration is a separate operation.
export function migrationLedger(plan){
 const current=plan.records.filter(q=>q.legacyIndex!==null);
 return Object.freeze({schemaVersion:plan.schemaVersion,publicationReady:plan.publicationReady,
  oldToNew:current.map(q=>({legacyIndex:q.legacyIndex,stableQuestId:q.stableQuestId,newOrdinal:q.ordinal})).sort((a,b)=>a.legacyIndex-b.legacyIndex),
  pending:plan.records.filter(q=>q.requiresGeneration).map(q=>({plannedQuestId:q.proposedQuestId,ordinal:q.ordinal,constellationId:q.constellationId,adventureId:q.adventureId}))});
}
