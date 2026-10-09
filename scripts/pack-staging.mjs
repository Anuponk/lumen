// Staging a new adventure without modifying the published catalogue.
// The manifest is suitable for review and a future atomic apply step.
export const DIFFICULTY_TIERS=["beginner","easy","intermediate","hard","expert"];
export function buildDifficultyReport(quests,target=null){
 const distribution=Object.fromEntries(DIFFICULTY_TIERS.map(t=>[t,0]));
 for(const q of quests){const tier=q.audit?.tier;if(!(tier in distribution))throw Error("Unknown difficulty tier: "+tier);distribution[tier]++}
 const total=quests.length;
 const proportions=Object.fromEntries(DIFFICULTY_TIERS.map(t=>[t,total?Number((distribution[t]/total).toFixed(3)):0]));
 let matches=true;
 if(target){
  for(const [tier,share] of Object.entries(target)){
   if(!DIFFICULTY_TIERS.includes(tier)||typeof share!=="number"||share<0||share>1)throw Error("Invalid difficulty target: "+tier);
   if(Math.abs(proportions[tier]-share)>0.15)matches=false;
  }
 }
 const scores=quests.map(q=>q.audit.score);
 const jumps=scores.slice(1).map((score,i)=>({from:i,to:i+1,delta:score-scores[i]})).filter(j=>j.delta>20);
 return {distribution,proportions,averageScore:total?Number((scores.reduce((a,b)=>a+b,0)/total).toFixed(2)):null,largeDifficultyJumps:jumps,targetMatches:matches};
}
export function stageAdventure({config,plan,generated}){
 if(!generated?.length||generated.length!==plan.proposed.questCount)throw Error("Incomplete generated adventure");
 const first=plan.proposed.questNumbers.first;
 const questIndices=generated.map((_,i)=>first-1+i);
 const constellations=config.constellations.map((c,i)=>({
  id:c.id,label:c.name,packId:config.id,skyId:config.skyId,
  questIndices:questIndices.slice(i*config.questsPerConstellation,(i+1)*config.questsPerConstellation)
 }));
 const pack={id:config.id,skyId:config.skyId,kind:"addon",access:config.access,order:config.order,displayName:config.displayName,
  questCount:generated.length,questIndices,constellationIds:constellations.map(c=>c.id)};
 return {schemaVersion:1,mode:"staging-only",pack,constellations,
  quests:generated.map((p,i)=>({id:`pack-${config.id}-q${String(i+1).padStart(3,"0")}`,legacyIndex:questIndices[i],size:p.size,reg:p.reg,sol:p.sol,audit:p.audit})),
  safety:{publishedQuestIdsPreserved:true,existingCatalogueUntouched:true,requiresExplicitApply:true}};
}
