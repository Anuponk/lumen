// Durable quest identity adapter for the canonical campaign rollout.
// Historic achievements keep their original numeric keys; new quests use
// a stable-ID dictionary. Never shift legacy indices to visible ordinals.
import {canonicalQuestById,canonicalQuestByOrdinal,canonicalQuestList} from "../campaign/canonical-quests.js";
import {loadVerifiedProfile,compareAndSwapCloudProfile} from "./cloud-profile.js";

export const CANONICAL_PROGRESS_VERSION=1;
function copy(profile){
 if(!profile||typeof profile!=="object"||Array.isArray(profile))throw Error("Invalid profile");
 return structuredClone(profile);
}
function savedEntries(profile){
 const rows=profile.canonicalQuestState??{};
 if(!rows||typeof rows!=="object"||Array.isArray(rows))throw Error("Invalid stable quest state");
 for(const id of Object.keys(rows)){
  const quest=canonicalQuestById(id);
  if(!quest)throw Error("Unknown stable quest state: "+id);
  if(quest.legacyIndex!==null)throw Error("Historic quest written into new stable store: "+id);
 }
 return rows;
}
export function questIsCompleted(profile,questId){
 const q=canonicalQuestById(questId);
 if(!q)throw Error("Unknown quest "+questId);
 if(q.legacyIndex!==null)return !!profile?.solved?.[q.legacyIndex];
 return !!savedEntries(profile)?.[q.id]?.solved;
}
export function canonicalCompletionCount(profile){
 savedEntries(profile??{});
 return canonicalQuestList().filter(q=>questIsCompleted(profile??{},q.id)).length;
}
export function firstIncompleteCanonicalQuest(profile){
 savedEntries(profile??{});
 return canonicalQuestList().find(q=>!questIsCompleted(profile??{},q.id))??null;
}
export function acknowledgeCanonicalVictory(profile,id,{badges={},performance=null,stars=0}={}){
 const quest=canonicalQuestById(id);
 if(!quest)throw Error("Unknown quest "+id);
 if(quest.legacyIndex!==null)throw Error("Historic quests must use the existing reward pipeline");
 const current=copy(profile);
 const state=savedEntries(current);
 if(state[id]?.solved)return {profile:current,newlyCompleted:false,quest};
 if(!badges||typeof badges!=="object"||Array.isArray(badges))throw Error("Invalid badges");
 if(!Number.isSafeInteger(stars)||stars<0)throw Error("Invalid stars");
 if(performance!==null&&(typeof performance!=="object"||Array.isArray(performance)))throw Error("Invalid performance");
 current.canonicalQuestState={...state,[id]:{solved:true,badges:structuredClone(badges),performance:performance===null?null:structuredClone(performance),stars}};
 current.xp=(Number(current.xp)||0)+10+(badges.autonomy?5:0);
 return {profile:current,newlyCompleted:true,quest};
}
export function canonicalQuestForDisplay(ordinal){
 const q=canonicalQuestByOrdinal(ordinal);
 return q?{questId:q.id,ordinal:q.ordinal,legacyIndex:q.legacyIndex,packId:q.packId}:null;
}

// Atomic, cross-device acknowledgement. Rewards are written only in the full
// cloud snapshot and only after comparing it to the last read version.
// A conflicting device may race; retry by re-reading once, never re-award.
export async function commitCanonicalVictory(supabase,questId,reward,{maxAttempts=3}={}){
 if(!supabase||typeof supabase.rpc!=="function")throw Error("Cloud unavailable: canonical victory not committed");
 const quest=canonicalQuestById(questId);
 if(!quest||quest.legacyIndex!==null)throw Error("Canonical cloud commit requires a new quest ID");
 for(let attempt=0;attempt<maxAttempts;attempt++){
  const current=await loadVerifiedProfile(supabase);
  if(!current)throw Error("No verified cloud baseline");
  const result=acknowledgeCanonicalVictory(current,questId,reward);
  if(!result.newlyCompleted)return {...result,alreadySaved:true};
  try{
   await compareAndSwapCloudProfile(supabase,result.profile,current);
   const verified=await loadVerifiedProfile(supabase);
   if(!verified?.canonicalQuestState?.[questId]?.solved)throw Error("Canonical victory cloud read-back failed");
   return {...result,profile:verified,alreadySaved:false};
  }catch(error){
   if(!/Conflit de version cloud/.test(error.message)||attempt===maxAttempts-1)throw error;
  }
 }
 throw Error("Canonical victory cannot be committed");
}
