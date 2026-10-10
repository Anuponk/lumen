// Separate the legacy sky completion (196 quests) from the new adventure unlock.
// The new adventure is never made available solely because the legacy sky is complete.
import {baseCampaignQuestCount,CONTENT_PACKS,hasPackAccess} from "./content.js";
import {playableQuestCount} from "./playable-quests.js";
import {resolvePlayableQuest} from "./playable-navigation.js";

export function extendedSequentialCount(solved={}){
 let index=0;
 while(index<playableQuestCount()&&!!solved[index])index++;
 return index;
}
export function nextAdventureBoundary(solved={},entitlements=[],progress={},attempt=null){
 const legacyEnd=baseCampaignQuestCount();
 const next=extendedSequentialCount(solved);
 if(next<legacyEnd)return {status:"legacy",index:next};
 if(next>=playableQuestCount())return {status:"complete",index:next};
 const access=resolvePlayableQuest(next,entitlements,progress,attempt);
 return {status:access.status,index:next,packId:access.packId,quest:access.quest};
}
export function extendedQuestLimit(entitlements=[],progress={},attempt=null){
 const ordered=CONTENT_PACKS.flatMap(pack=>(pack.questIndices||[]).map(index=>({index,pack}))).sort((a,b)=>a.index-b.index);
 let limit=0;
 for(const {index,pack} of ordered){
  if(index!==limit||!hasPackAccess(pack,entitlements,progress,attempt))break;
  limit++;
 }
 return Math.min(limit,playableQuestCount());
}
