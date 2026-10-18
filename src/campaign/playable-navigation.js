import {canonicalQuestByOrdinal,canonicalNextUnsolved,canonicalCampaignQuestDecision,canonicalQuestById} from "./canonical-quests.js";
import {originQuests} from './catalogue-origin.js';
import {questCompleted} from './catalogue-access.js';
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

// Canonical runtime navigation applies the same access policy as the map/start.
export function resolveCanonicalQuest(ordinal,entitlements=[],progress={},attempt=null){
 const quest=canonicalQuestByOrdinal(Number(ordinal));
 if(!quest)return {status:"missing-quest",ordinal};
 const pack=CONTENT_PACKS.find(p=>p.id===quest.packId);
 if(!pack)return {status:"missing-pack",ordinal};
 if(!hasPackAccess(pack,entitlements,progress,attempt))return {status:"locked",ordinal,packId:pack.id,questId:quest.id};
 const access=canonicalCampaignQuestDecision(quest,progress,{entitlements,attempt});
 if(access.status!=='ready')return {...access,ordinal,packId:pack.id};
 return {status:"ready",ordinal,packId:pack.id,quest};
}
export function nextCanonicalQuest(solvedLegacy={},solvedIds={},entitlements=[],progress={},attempt=null){
 const state={...progress,solved:solvedLegacy,canonicalQuestState:Object.fromEntries(Object.entries(solvedIds).map(([id,value])=>[id,typeof value==='object'?value:{solved:!!value}]))};
 let origin;
 try{origin=originQuests(state)}catch{return {status:'catalogue-incompatible'}}
 const frontier=origin.find(q=>!questCompleted(q,state));
 const quest=(frontier&&canonicalQuestById(frontier.id))??canonicalNextUnsolved(solvedLegacy,solvedIds);
 return quest?resolveCanonicalQuest(quest.ordinal,entitlements,state,attempt):{status:"complete"};
}
