import {canonicalQuestByOrdinal,canonicalNextUnsolved} from "./canonical-quests.js";
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

// Opt-in canonical navigation for the migration rollout. The original numeric
// navigation remains unchanged until player cloud saves are migrated safely.
export function resolveCanonicalQuest(ordinal,entitlements=[],progress={},attempt=null){
 const quest=canonicalQuestByOrdinal(Number(ordinal));
 if(!quest)return {status:"missing-quest",ordinal};
 const pack=CONTENT_PACKS.find(p=>p.id===quest.packId);
 if(!pack)return {status:"missing-pack",ordinal};
 if(!hasPackAccess(pack,entitlements,progress,attempt))return {status:"locked",ordinal,packId:pack.id,questId:quest.id};
 return {status:"ready",ordinal,packId:pack.id,quest};
}
export function nextCanonicalQuest(solvedLegacy={},solvedIds={},entitlements=[],progress={},attempt=null){
 const quest=canonicalNextUnsolved(solvedLegacy,solvedIds);
 return quest?resolveCanonicalQuest(quest.ordinal,entitlements,progress,attempt):{status:"complete"};
}
