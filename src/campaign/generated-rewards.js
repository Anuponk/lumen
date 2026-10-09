// Rewards for the generated adventure are intentionally independent of
// the historical sky score and its SKY_TARGET cap.
import {generatedQuestProgress,generatedCampaignProgress} from "./generated-progression.js";

export function generatedQuestReward(index,firstCompletion=true){
 const quest=generatedQuestProgress(index);
 if(!quest||!firstCompletion)return {stars:0,shards:0,kind:null};
 const isFinal=quest.finalQuest;
 const isMidpoint=quest.position===Math.ceil(quest.total/2);
 return {stars:isFinal?3:isMidpoint?2:1,shards:0,kind:isFinal?"constellation":isMidpoint?"milestone":null};
}

export function generatedAdventureRewards(solved={}){
 const progress=generatedCampaignProgress(solved);
 const stars=progress.constellations.reduce((sum,c)=>
  sum+c.questIndices.reduce((subtotal,index)=>subtotal+(solved[index]?generatedQuestReward(index).stars:0),0),0);
 return {stars,completed:progress.completed,complete:progress.complete,constellations:progress.constellations.map(c=>({
  id:c.id,stars:c.questIndices.reduce((sum,index)=>sum+(solved[index]?generatedQuestReward(index).stars:0),0),
  complete:c.complete
 }))};
}
