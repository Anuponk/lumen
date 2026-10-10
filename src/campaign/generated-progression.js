// Independent progression model for the fourth adventure.
// This does not change the legacy sky's star target or existing saves.
import {GENERATED_CONSTELLATIONS} from "./content.js";

const generated=GENERATED_CONSTELLATIONS;
const lookup=new Map(generated.flatMap(c=>c.questIndices.map((index,position)=>[index,{constellation:c,position}])));

export function generatedCampaignProgress(solved={}){
 const constellations=generated.map(c=>{
  const completed=c.questIndices.filter(index=>!!solved[index]).length;
  return {id:c.id,label:c.label,completed,total:c.questCount,complete:completed===c.questCount,questIndices:[...c.questIndices]};
 });
 const completed=constellations.reduce((sum,c)=>sum+c.completed,0);
 const indices=generated.flatMap(c=>c.questIndices);
 return {start:indices.length?Math.min(...indices):null,end:indices.length?Math.max(...indices):null,total:indices.length,completed,complete:completed===indices.length,constellations};
}
export function generatedQuestProgress(index,solved={}){
 const entry=lookup.get(Number(index));
 if(!entry)return null;
 const {constellation:c,position}=entry;
 const completed=c.questIndices.filter(i=>!!solved[i]).length;
 return {index:Number(index),constellationId:c.id,constellationLabel:c.label,position:position+1,total:c.questCount,completed,complete:completed===c.questCount,finalQuest:position===c.questCount-1};
}
export function nextGeneratedQuest(solved={}){
 for(const i of generated.flatMap(c=>c.questIndices).sort((a,b)=>a-b))if(!solved[i])return i;
 return null;
}
