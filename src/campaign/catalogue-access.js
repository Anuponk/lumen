// Access is derived from existing completion evidence, never written as a win.
// Catalogue identities and memberships, rather than displayed quest numbers,
// define the historical scope. No currency, reward or entitlement is inferred.
import {QUEST_MILESTONES} from './quest-rules.js';
export function questCompleted(quest,progress={}){
 return quest.legacyIndex!==null?!!progress.solved?.[quest.legacyIndex]:!!progress.canonicalQuestState?.[quest.id]?.solved;
}

export function constellationCatchupAvailable(quest,progress={},quests,origin=quests.filter(q=>q.legacyIndex!==null)){
 if(!quest||quest.legacyIndex!==null)return false;
 const adventure=quests.filter(q=>q.packId===quest.packId);
 const group=adventure.filter(q=>q.constellationId===quest.constellationId);
 if(!group.some(q=>q.id===quest.id))return false;
 const historical=origin.filter(q=>q.packId===quest.packId&&q.constellationId===quest.constellationId);
 const adventureHistory=origin.filter(q=>q.packId===quest.packId);
 // An entirely new constellation has no local legacy evidence. A completed
 // historical adventure supplies that evidence; merely starting it does not.
 // Canonical completions also preserve a constellation already being played.
 const originFrontier=origin.find(q=>!questCompleted(q,progress));
 const acquired=historical.some(q=>questCompleted(q,progress))||
  (originFrontier?.packId===quest.packId&&originFrontier?.constellationId===quest.constellationId)||
  (adventureHistory.length>0&&adventureHistory.every(q=>questCompleted(q,progress)))||
  group.some(q=>questCompleted(q,progress));
 return !!acquired&&group.filter(q=>q.ordinal<quest.ordinal).every(q=>questCompleted(q,progress));
}

// One decision for campaign map cards, lists, sky navigation and starts.
// Pack ownership and verified hydration are independent of historical access.
export function catalogueQuestDecision(quest,progress={},quests=[],context={}){
 if(!quest||!quests.some(q=>q.id===quest.id))return {status:'missing-content'};
 if(context.packAllowed===false)return {status:'pack-locked'};
 if(questCompleted(quest,progress))return {status:'ready',reason:'replay'};
 const attempt=context.attempt;
 if(attempt?.startedAt&&attempt.mode!=='challenge'&&
  (String(attempt.questId)===quest.id||(quest.legacyIndex!==null&&Number(attempt.questId)===quest.legacyIndex+1)))return {status:'ready',reason:'preserved-attempt'};
 if(quest.ordinal>QUEST_MILESTONES.discovery){
  if(context.signedIn===false)return {status:'auth-required'};
  if(context.cloudReady===false)return {status:'sync-required'};
 }
 const first=quests.find(q=>!questCompleted(q,progress));
 if(first?.id===quest.id)return {status:'ready',reason:'sequential'};
 const origin=context.originQuests??quests.filter(q=>q.legacyIndex!==null);
 const frontier=origin.find(q=>!questCompleted(q,progress));
 if(frontier?.id===quest.id)return {status:'ready',reason:'preserved-frontier'};
 const original=origin.find(q=>q.id===quest.id);
 if(original&&origin.some(q=>q.packId===original.packId&&q.ordinal>original.ordinal&&questCompleted(q,progress)))return {status:'ready',reason:'preserved-access'};
 // Preserve an unfinished frontier acquired in ANY intermediate publication,
 // not just the campaign's origin. Each old view is evaluated directly against
 // the same completion evidence; no recursive migration or player write.
 for(const past of context.pastCatalogues??[]){
  const previous=past.find(q=>q.id===quest.id);
  if(previous&&catalogueQuestDecision(previous,progress,past,{...context,pastCatalogues:[]}).status==='ready')return {status:'ready',reason:'preserved-access'};
 }
 if(!original&&constellationCatchupAvailable(quest,progress,quests,origin))return {status:'ready',reason:'historical-access'};
 const preceding=quests.filter(q=>q.packId===quest.packId&&q.constellationId===quest.constellationId&&q.ordinal<quest.ordinal);
 const prerequisite=preceding.find(q=>!questCompleted(q,progress))??first;
 return {status:'prerequisite',questId:prerequisite?.id??null};
}

export function insertedQuestDecision(quest,progress={},quests=[],context={}){
 return quest?.legacyIndex===null?catalogueQuestDecision(quest,progress,quests,context):{status:'missing-content'};
}
