// Adapter for existing social challenge links and canonical future challenges.
// Historic links with numeric puzzle_id ALWAYS resolve against the original
// immutable legacy index (not the new visible quest ordinal).
import {canonicalQuestById,canonicalQuestForLegacy,canonicalQuestByOrdinal} from "./canonical-quests.js";

export function resolveChallengeQuest(challenge){
 if(!challenge||typeof challenge!=="object")throw Error("Invalid challenge");
 const stable=challenge.stable_quest_id??challenge.stableQuestId;
 const legacy=challenge.puzzle_id??challenge.questId;
 if(stable!=null){
  const quest=canonicalQuestById(String(stable));
  if(!quest)throw Error("Unknown stable challenge quest ID: "+stable);
  if(legacy!=null){
   const index=Number(legacy)-1;
   if(!Number.isSafeInteger(index)||quest.legacyIndex!==index)throw Error("Challenge stable ID / legacy ID mismatch");
  }
  return quest;
 }
 if(legacy==null)throw Error("Challenge has no quest identity");
 const index=Number(legacy)-1;
 if(!Number.isSafeInteger(index)||index<0)throw Error("Invalid challenge legacy number");
 const quest=canonicalQuestForLegacy(index);
 if(!quest)throw Error("Unresolvable historical challenge quest: "+legacy);
 return quest;
}
export function challengeIdentityForQuest(stableQuestId){
 const quest=canonicalQuestById(stableQuestId);
 if(!quest)throw Error("Unknown quest ID "+stableQuestId);
 return quest.legacyIndex!==null?
  {puzzle_id:quest.legacyIndex+1,stable_quest_id:quest.id}:
  {stable_quest_id:quest.id};
}
export function canonicalOrdinalForChallenge(challenge){
 return resolveChallengeQuest(challenge).ordinal;
}
