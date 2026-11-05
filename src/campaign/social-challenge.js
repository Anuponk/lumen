import {performanceEligibility} from "./performance.js";

export function normalizeChallengeName(value){
 return String(value||"").trim().replace(/\s+/g," ").slice(0,24);
}

export function validChallengeName(value){
 const name=normalizeChallengeName(value);
 return name.length>=2 && /^[\p{L}\p{N} ._'’-]+$/u.test(name);
}

export function challengeEligibility({priorPerformance,run,firstCompletion}={}){
 const attempts=Math.max(0,Number(priorPerformance?.attempts)||0);
 const firstPlay=firstCompletion!==false&&attempts===0;
 const remarkable=firstPlay&&run?.qualifying!==false&&!!run?.mastery;
 return {firstPlay,remarkable,canChallenge:firstPlay};
}

export function challengeSnapshot({questIndex,quest,seconds,run,assistanceUsed=false}){
 const eligibility=performanceEligibility(quest?quest.ordinal-1:questIndex);
 return {
  questId:quest?(quest.legacyIndex===null?null:quest.legacyIndex+1):Number(questIndex)+1,
  ...(quest?{stableQuestId:quest.id,questOrdinal:quest.ordinal}:{}),
  durationSeconds:Math.max(0,Number(seconds)||0),
  autonomy:!!run?.autonomy,
  speed:!!run?.speed,
  mastery:run?.qualifying!==false&&!!run?.mastery,
  assistanceUsed:!!assistanceUsed,
  eligibility
 };
}

export function compareChallenge(source,participant){
 if(!source||!participant)return null;
 if(participant.status==="abandoned")return {kind:"abandoned",winner:"source",headline:"Défi perdu",detail:"Tu n’as pas terminé cette quête."};
 const delta=Math.round(Number(participant.duration_seconds)-Number(source.duration_seconds));
 const sourceAssisted=source.assistance_used===true||source.autonomy===false;
 const participantAssisted=participant.assistance_used===true||participant.autonomy===false;
 let winner="tie",reason="time";
 if(sourceAssisted!==participantAssisted){
  winner=participantAssisted?"source":"participant";
  reason="assistance";
 }else if(delta<0)winner="participant";
 else if(delta>0)winner="source";
 const kind=winner==="participant"?"won":winner==="source"?"lost":"tied";
 let detail;
 if(reason==="assistance"){
  detail=winner==="participant"?"Tu as gagné en restant autonome, contrairement au défi d’origine.":"Ton adversaire est resté autonome ; tu as utilisé une aide.";
 }else if(winner==="tie")detail="Égalité parfaite : même niveau d’aide et même temps.";
 else if(winner==="participant")detail=Math.abs(delta)+" s plus rapide à niveau d’aide égal.";
 else detail=delta+" s plus lent à niveau d’aide égal.";
 const headline=kind==="won"?"Défi remporté !":kind==="lost"?"Défi perdu":"Égalité !";
 return {kind,winner,reason,deltaSeconds:delta,headline,detail};
}

export function challengeParticipantKey({userId,anonymousId}={}){
 if(userId)return "u:"+userId;
 if(anonymousId)return "a:"+anonymousId;
 return "";
}

export function createChallengeClient(supabase,{getUserId=()=>null,getAnonymousId=()=>null,getDisplayName=()=>""}={}){
 const identity=()=>({p_anonymous_id:getAnonymousId()||null,p_display_name:normalizeChallengeName(getDisplayName())});
 async function rpc(name,args={}){if(!supabase)throw new Error("cloud_unavailable");const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
 async function create(snapshot){
  const stableOnly=snapshot.questId===null&&!!snapshot.stableQuestId;
  const rows=await rpc(stableOnly?'lumen_create_quest_challenge':'lumen_create_social_challenge',{...identity(),
   ...(stableOnly?{p_quest_id:snapshot.stableQuestId}:{p_puzzle_id:snapshot.questId}),p_duration_seconds:Math.round(snapshot.durationSeconds),p_autonomy:!!snapshot.autonomy,p_speed:!!snapshot.speed,p_mastery:!!snapshot.mastery,p_assistance_used:!!snapshot.assistanceUsed,p_first_play:true});
  return Array.isArray(rows)?rows[0]:rows;
 }
 async function get(challengeId){
  const rows=await compatibleRead('lumen_get_quest_challenge','lumen_get_social_challenge',{p_challenge_id:challengeId,...identity()});
  return Array.isArray(rows)?rows[0]:rows;
 }
 async function start(challengeId,previouslyPlayed){
  const rows=await rpc("lumen_start_social_challenge",{p_challenge_id:challengeId,...identity(),p_previously_played:!!previouslyPlayed});
  return Array.isArray(rows)?rows[0]:rows;
 }
 async function finish(challengeId,{status,durationSeconds,autonomy,speed,mastery,assistanceUsed}){
  const rows=await rpc("lumen_finish_social_challenge",{p_challenge_id:challengeId,...identity(),p_status:status,p_duration_seconds:Math.round(durationSeconds||0),p_autonomy:!!autonomy,p_speed:!!speed,p_mastery:!!mastery,p_assistance_used:!!assistanceUsed});
  return Array.isArray(rows)?rows[0]:rows;
 }
 async function sent(){
  return await compatibleRead('lumen_list_quest_challenges','lumen_list_social_challenges',identity())||[];
 }
 async function compatibleRead(primary,legacy,args){
  if(!supabase)throw Error('cloud_unavailable');
  const result=await supabase.rpc(primary,args);
  if(result.error?.code==='PGRST202'&&result.status===404)return rpc(legacy,args);
  if(result.error)throw result.error;
  return result.data;
 }
 async function markRead(challengeId){
  return await rpc("lumen_mark_social_challenge_read",{p_challenge_id:challengeId,...identity()});
 }
 return {create,get,start,finish,sent,markRead};
}
