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
export function extendedQuestLimit(entitlements=[],progress={},attempt=null,packs=CONTENT_PACKS){
 // This is a numeric runtime bound, not a progression or ownership decision.
 // A locked earlier Adventure must not clamp a later owned quest back to it.
 const indices=packs.filter(pack=>hasPackAccess(pack,entitlements,progress,attempt)).flatMap(pack=>pack.questIndices||[]);
 const limit=indices.length?Math.max(...indices)+1:0;
 return Math.min(limit,playableQuestCount());
}
