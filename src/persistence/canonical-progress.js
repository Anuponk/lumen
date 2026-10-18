// Durable quest identity adapter for the canonical campaign rollout.
// Historic achievements keep their original numeric keys; new quests use
// a stable-ID dictionary. Never shift legacy indices to visible ordinals.
import {canonicalQuestById,canonicalQuestByOrdinal,canonicalQuestList} from "../campaign/canonical-quests.js";
import {loadVerifiedProfile,compareAndSwapCloudProfile} from "./cloud-profile.js";
import {canonicalRecoveryFailure} from "./canonical-recovery-errors.js";
import {canonicalCommandsSupported,commitCanonicalCommand} from "./canonical-command.js";

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
const BADGE_KEYS=["autonomy","speed","noError","mastery"];
function hasAllEarnedBadges(state,badges){
 return BADGE_KEYS.every(key=>!badges?.[key]||!!state?.badges?.[key]);
}
export function acknowledgeCanonicalVictory(profile,id,{badges={},performance=null,stars=0}={}){
 const quest=canonicalQuestById(id);
 if(!quest)throw Error("Unknown quest "+id);
 if(quest.legacyIndex!==null)throw Error("Historic quests must use the existing reward pipeline");
 const current=copy(profile);
 const state=savedEntries(current);
 if(state[id]?.solved){
  // Replays may improve badges, but must never award XP or stars again.
  if(hasAllEarnedBadges(state[id],badges))return {profile:current,newlyCompleted:false,quest,unchanged:true};
  const merged={...state[id].badges};
  for(const key of BADGE_KEYS)if(badges[key])merged[key]=true;
  current.canonicalQuestState={...state,[id]:{...state[id],badges:merged}};
  return {profile:current,newlyCompleted:false,quest,unchanged:false};
 }
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
  if(result.unchanged)return {...result,alreadySaved:true};
  try{
   await compareAndSwapCloudProfile(supabase,result.profile,current);
   const verified=await loadVerifiedProfile(supabase);
   if(!verified?.canonicalQuestState?.[questId]?.solved||!hasAllEarnedBadges(verified.canonicalQuestState[questId],reward?.badges))throw Error("Canonical victory cloud read-back failed");
   return {...result,profile:verified,alreadySaved:false};
  }catch(error){
   // A timed-out CAS may have committed before its response was lost.
   // Read the authoritative profile before retrying, so a completed quest
   // is acknowledged exactly once and a transient error is not mistaken
   // for an unsaved victory.
   let refreshed=null;
   try{refreshed=await loadVerifiedProfile(supabase)}catch{}
   if(refreshed?.canonicalQuestState?.[questId]?.solved&&hasAllEarnedBadges(refreshed.canonicalQuestState[questId],reward?.badges)){
    return {profile:refreshed,newlyCompleted:false,quest,alreadySaved:true};
   }
   if(attempt===maxAttempts-1)throw error;
   // Only retry against a freshly verified baseline on the next iteration;
   // never replay the previous snapshot or credit the reward blindly.
   if(!refreshed)throw error;
  }
 }
 throw Error("Canonical victory cannot be committed");
}

// Opt-in transport for the transactional server reward ledger. Do not enable
// until the migration, allowlist and authenticated grants are verified.
// Never fall back to legacy snapshot CAS after an ambiguous RPC error:
// the RPC may have committed before its response was lost.
export async function commitCanonicalVictoryViaLedger(supabase,questId,reward,{operationId,userId,sessionValid=()=>true}={}){
 if(!supabase||typeof supabase.rpc!=="function")throw Error("Cloud unavailable");
 const quest=canonicalQuestById(questId);
 if(!quest||quest.legacyIndex!==null)throw canonicalRecoveryFailure({code:'LUMEN_QUEST_UNAVAILABLE'});
 if(!sessionValid())throw Error('Canonical session changed');
 if(operationId!==undefined){
  if(typeof operationId!=='string'||!/^[A-Za-z0-9._-]{1,120}$/.test(operationId)||typeof userId!=='string'||!userId)throw canonicalRecoveryFailure({code:'22023'});
  const supported=await canonicalCommandsSupported(supabase);
  if(!sessionValid())throw Error('Canonical session changed');
  if(supported)return commitCanonicalCommand(supabase,quest,reward,operationId,{userId,sessionValid});
 }
 let response;
 try{response=await supabase.rpc("lumen_commit_canonical_victory",{
  p_quest_id:questId,p_badges:reward?.badges??{},p_performance:reward?.performance??null
 })}catch(error){response={error}}
 const {data,error,status}=response;
 if(error){
  // A timed-out request may already be committed. Re-read and acknowledge
  // only an actual server-side solved flag, without issuing another credit.
  let verified;
  try{verified=await loadVerifiedProfile(supabase)}catch{}
  if(verified?.canonicalQuestState?.[questId]?.solved&&hasAllEarnedBadges(verified.canonicalQuestState[questId],reward?.badges))
   return {profile:verified,newlyCompleted:false,alreadySaved:true,quest};
  throw canonicalRecoveryFailure(error,status);
 }
 const verified=await loadVerifiedProfile(supabase);
 if(!verified?.canonicalQuestState?.[questId]?.solved||!hasAllEarnedBadges(verified.canonicalQuestState[questId],reward?.badges))throw Error("Canonical ledger verification failed");
 if(!data||!data.profile||typeof data.newlyCompleted!=="boolean")
  throw Error("Invalid canonical ledger acknowledgement");
 return {profile:verified,newlyCompleted:data.newlyCompleted,alreadySaved:!data.newlyCompleted,quest};
}
