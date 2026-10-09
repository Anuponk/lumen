import {CONTENT_PACKS,CONTENT_CONSTELLATIONS} from "./content.js";
import {playableQuest} from "./playable-quests.js";

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
