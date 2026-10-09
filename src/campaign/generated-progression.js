// Independent progression model for the fourth adventure.
// This does not change the legacy sky's star target or existing saves.
import {CONTENT_CONSTELLATIONS} from "./content.js";
import {playableQuestCount} from "./playable-quests.js";

const generated=Object.freeze(CONTENT_CONSTELLATIONS.filter(c=>c.packId==="real-adventure-04"));
const lookup=new Map(generated.flatMap(c=>c.questIndices.map((index,position)=>[index,{constellation:c,position}])));

export function generatedCampaignProgress(solved={}){
 const constellations=generated.map(c=>{
  const completed=c.questIndices.filter(index=>!!solved[index]).length;
  return {id:c.id,label:c.label,completed,total:c.questCount,complete:completed===c.questCount,questIndices:[...c.questIndices]};
 });
 const completed=constellations.reduce((sum,c)=>sum+c.completed,0);
 return {start:196,end:playableQuestCount()-1,total:100,completed,complete:completed===100,constellations};
}
export function generatedQuestProgress(index,solved={}){
 const entry=lookup.get(Number(index));
 if(!entry)return null;
 const {constellation:c,position}=entry;
 const completed=c.questIndices.filter(i=>!!solved[i]).length;
 return {index:Number(index),constellationId:c.id,constellationLabel:c.label,position:position+1,total:c.questCount,completed,complete:completed===c.questCount,finalQuest:position===c.questCount-1};
}
export function nextGeneratedQuest(solved={}){
 for(let i=196;i<playableQuestCount();i++)if(!solved[i])return i;
 return null;
}
