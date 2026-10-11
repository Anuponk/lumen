import {CONTENT_PACKS,CONTENT_CONSTELLATIONS} from "./content.js";
import {playableQuest} from "./playable-quests.js";
import {canonicalQuestList} from "./canonical-quests.js";

export function catalogueDifficulty(quest){
 const tier=quest?.audit?.tier;
 if(tier)return tier;
 const steps=quest?.audit?.proofSteps;
 if(!Number.isFinite(steps))return "non évaluée";
 if(steps<15)return "facile";
 if(steps<30)return "moyenne";
 if(steps<50)return "difficile";
 return "experte";
}

export function adminCatalogueTree(){
 return CONTENT_PACKS.map(pack=>({
  id:pack.id,name:pack.displayName,
  questCount:pack.questCount,
  constellations:CONTENT_CONSTELLATIONS.filter(c=>pack.constellationIds.includes(c.id)).map(c=>({
   id:c.id,name:c.label,
   quests:c.questIndices.map(index=>{
    const quest=playableQuest(index);
    return {index,number:index+1,id:quest?.id||null,size:quest?.size||null,difficulty:catalogueDifficulty(quest)};
   })
  }))
 }));
}

// #222 preview tree: full canonical catalogue. This is independent of player
// progress storage and keeps the existing production admin tree untouched.
export function adminCanonicalCatalogueTree(){
 const all=canonicalQuestList(),result=[];
 for(const pack of CONTENT_PACKS){
  const selected=all.filter(q=>q.packId===pack.id),groups=new Map();
  for(const quest of selected){
   if(!groups.has(quest.constellationId))groups.set(quest.constellationId,[]);
   groups.get(quest.constellationId).push(quest);
  }
  result.push({id:pack.id,name:pack.displayName,questCount:selected.length,
   startNumber:selected[0]?.ordinal??null,endNumber:selected.at(-1)?.ordinal??null,
   constellations:[...groups].map(([id,quests])=>({
    id,name:CONTENT_CONSTELLATIONS.find(c=>c.id===id)?.label??id,
    questCount:quests.length,quests:quests.map(q=>({
     number:q.ordinal,id:q.id,legacyIndex:q.legacyIndex,size:q.size,
     difficulty:catalogueDifficulty(q),source:q.legacyIndex===null?"generated":"legacy"
    }))
   }))});
 }
 return result;
}
