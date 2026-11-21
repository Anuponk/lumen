import {performanceEligibility} from "./performance.js";

export function normalizeChallengeName(value){
 return String(value||"").trim().replace(/\s+/g," ").slice(0,24);
}

export function validChallengeName(value){
 const name=normalizeChallengeName(value);
 return name.length>=2 && /^[\p{L}\p{N} ._'’-]+$/u.test(name);
}

// #889 (owner decision 20/11/2026): a challenge may be created from any
// qualifying run, first win or replay. Qualification is the attempt engine's
// own flag (badges/ranking, 15-minute cooldown), echoed by the confirmed
// victory receipt; there is no second social rule. firstPlay only records the
// reference's provenance so comparisons stay honest.
export function challengeEligibility({priorPerformance,run,firstCompletion}={}){
 const attempts=Math.max(0,Number(priorPerformance?.attempts)||0);
 const firstPlay=firstCompletion!==false&&attempts===0;
 const qualifying=run?.qualifying===true;
 return {firstPlay,qualifying,remarkable:qualifying&&!!run?.mastery,canChallenge:qualifying};
}

// #888: a participation already started on the server never restarts from a
// blank clock. The same browser restores its own attempt; another device or
// browser resumes at the elapsed time measured by the server clock; without
// that proof the resume is refused.
export function challengeResumePlan({participantStatus,participantStartedAt,serverNow,localAttempt=false}={}){
 if(challengeAttemptClosed(participantStatus))return {kind:'closed',elapsedMs:0};
 if(String(participantStatus||'').toLowerCase()!=='started')return {kind:'fresh',elapsedMs:0};
 if(localAttempt)return {kind:'local',elapsedMs:0};
 const started=Date.parse(participantStartedAt||''),now=Date.parse(serverNow||'');
 if(!Number.isFinite(started)||!Number.isFinite(now))return {kind:'blocked',elapsedMs:0};
 return {kind:'elapsed',elapsedMs:Math.max(0,now-started)};
}

// #887: gridRevision is the board actually played (the attempt's), never inferred.
export function challengeSnapshot({questIndex,quest,seconds,run,assistanceUsed=false,firstPlay=true,gridRevision}){
 const revision=gridRevision??quest?.gridRevision??0;
 const eligibility=performanceEligibility(quest?quest.ordinal-1:questIndex);
 return {
  questId:quest?(quest.legacyIndex===null?null:quest.legacyIndex+1):Number(questIndex)+1,
  ...(quest?{stableQuestId:quest.id,questOrdinal:quest.ordinal}:{}),
  ...(revision?{gridRevision:revision}:{}),
  durationSeconds:Math.max(0,Number(seconds)||0),
  autonomy:!!run?.autonomy,
  speed:!!run?.speed,
  mastery:run?.qualifying!==false&&!!run?.mastery,
  assistanceUsed:!!assistanceUsed,
  firstPlay:firstPlay!==false,
  qualifying:run?.qualifying===true,
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

// Server contract: participations store lowercase 'started'|'completed'|'abandoned'.
// A terminal participation is shown as a result and never offered a new attempt.
export function challengeAttemptClosed(status){
 return ["completed","abandoned"].includes(String(status||"").toLowerCase());
}

export function challengeParticipantKey({userId,anonymousId}={}){
 if(userId)return "u:"+userId;
 if(anonymousId)return "a:"+anonymousId;
 return "";
}

export function createChallengeClient(supabase,{getUserId=()=>null,getAnonymousId=()=>null,getDisplayName=()=>""}={}){
 const identity=()=>({p_anonymous_id:getAnonymousId()||null,p_display_name:normalizeChallengeName(getDisplayName())});
 async function rpc(name,args={}){if(!supabase)throw new Error("cloud_unavailable");const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data}
  // #889: one versioned writer for every kind, declaring provenance honestly.
 // Older servers only know first-play writers: a first win falls back to them,
 // a replay is refused rather than mislabelled as a first play.
 async function create(snapshot){
  if(!supabase)throw new Error("cloud_unavailable");
  const stableOnly=snapshot.questId===null&&!!snapshot.stableQuestId;
  const result=await supabase.rpc('lumen_create_qualifying_challenge',{...identity(),
   p_puzzle_id:stableOnly?null:snapshot.questId,p_quest_id:stableOnly?snapshot.stableQuestId:null,p_grid_revision:snapshot.gridRevision||0,
   p_duration_seconds:Math.round(snapshot.durationSeconds),p_autonomy:!!snapshot.autonomy,p_speed:!!snapshot.speed,p_mastery:!!snapshot.mastery,
   p_assistance_used:!!snapshot.assistanceUsed,p_first_play:snapshot.firstPlay!==false,p_qualifying:snapshot.qualifying===true});
  if(!(result?.error?.code==='PGRST202'&&result.status===404)){if(result?.error)throw result.error;const rows=result?.data;return Array.isArray(rows)?rows[0]:rows}
  if(snapshot.firstPlay===false)throw new Error('challenge_replay_unavailable');
  return createFirstPlay(snapshot);
 }
 async function createFirstPlay(snapshot){
  const stableOnly=snapshot.questId===null&&!!snapshot.stableQuestId;
  // #887: the historical writer only knows revision 0; never mislabel a revised board.
  if(!stableOnly&&snapshot.gridRevision>0)throw new Error('challenge_grid_update_required');
  const versioned=stableOnly&&snapshot.gridRevision>0;
  const rows=await rpc(versioned?'lumen_create_quest_challenge_v2':stableOnly?'lumen_create_quest_challenge':'lumen_create_social_challenge',{...identity(),
   ...(versioned?{p_grid_revision:snapshot.gridRevision}:{}),
   ...(stableOnly?{p_quest_id:snapshot.stableQuestId}:{p_puzzle_id:snapshot.questId}),p_duration_seconds:Math.round(snapshot.durationSeconds),p_autonomy:!!snapshot.autonomy,p_speed:!!snapshot.speed,p_mastery:!!snapshot.mastery,p_assistance_used:!!snapshot.assistanceUsed,p_first_play:true});
  return Array.isArray(rows)?rows[0]:rows;
 }
 async function get(challengeId){
  const rows=await compatibleRead('lumen_get_quest_challenge_v2','lumen_get_quest_challenge',{p_challenge_id:challengeId,...identity()},'lumen_get_social_challenge');
  return Array.isArray(rows)?rows[0]:rows;
 }
 async function start(challengeId,previouslyPlayed,gridRevision=0){
  const rows=await rpc(gridRevision?'lumen_start_quest_challenge_v2':"lumen_start_social_challenge",{p_challenge_id:challengeId,...identity(),p_previously_played:!!previouslyPlayed,...(gridRevision?{p_grid_revision:gridRevision}:{})});
  return Array.isArray(rows)?rows[0]:rows;
 }
 async function finish(challengeId,{status,durationSeconds,autonomy,speed,mastery,assistanceUsed,gridRevision=0}){
  const rows=await rpc(gridRevision?'lumen_finish_quest_challenge_v2':"lumen_finish_social_challenge",{p_challenge_id:challengeId,...identity(),p_status:status,p_duration_seconds:Math.round(durationSeconds||0),p_autonomy:!!autonomy,p_speed:!!speed,p_mastery:!!mastery,p_assistance_used:!!assistanceUsed,...(gridRevision?{p_grid_revision:gridRevision}:{})});
  return Array.isArray(rows)?rows[0]:rows;
 }
 async function sent(){
  return await compatibleRead('lumen_list_quest_challenges_v2','lumen_list_quest_challenges',identity(),'lumen_list_social_challenges')||[];
 }
 async function compatibleRead(primary,legacy,args,oldest=null){
  if(!supabase)throw Error('cloud_unavailable');
  const result=await supabase.rpc(primary,args);
  if(result.error?.code==='PGRST202'&&result.status===404)return oldest?compatibleRead(legacy,oldest,args):rpc(legacy,args);
  if(result.error)throw result.error;
  return result.data;
 }
 async function markRead(challengeId){
  return await rpc("lumen_mark_social_challenge_read",{p_challenge_id:challengeId,...identity()});
 }
 return {create,get,start,finish,sent,markRead};
}
