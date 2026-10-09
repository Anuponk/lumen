import {playableQuest,playableQuestCount} from './playable-quests.js';
import {CONTENT_PACKS,hasPackAccess,packForLegacyQuest} from './content.js';

export function resolvePlayableQuest(index,entitlements=[],progress={},attempt=null){
 const pack=packForLegacyQuest(index,CONTENT_PACKS);
 if(!pack)return {status:'missing-pack',index};
 if(!hasPackAccess(pack,entitlements,progress,attempt))return {status:'locked',index,packId:pack.id};
 const quest=playableQuest(index);
 return quest?{status:'ready',index,packId:pack.id,quest}:{status:'missing-quest',index,packId:pack.id};
}
export function nextPlayableQuest(solved={},entitlements=[],progress={},attempt=null){
 for(let i=0;i<playableQuestCount();i++)if(!solved?.[i])return resolvePlayableQuest(i,entitlements,progress,attempt);
 return {status:'complete',index:playableQuestCount()};
}
