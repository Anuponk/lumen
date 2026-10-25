import {loadVerifiedProfile,sameCloudProfile} from './cloud-profile.js';
import {canonicalRecoveryFailure} from './canonical-recovery-errors.js';
import {questPerformanceRecord} from '../campaign/quest-rules.js';

function matches(receipt,questId,operationId,facts){
 return receipt?.request?.version===2&&receipt.request.questId===questId&&receipt.request.operationId===operationId
  &&sameCloudProfile(receipt.request.facts,facts)&&typeof receipt.outcome?.firstCompletion==='boolean'
  &&Number.isSafeInteger(receipt.outcome?.attempts)&&receipt.outcome.attempts>0
  &&Number.isFinite(Date.parse(receipt.recordedAt))&&receipt.outcome.savedPerformance?.badges;
}
export async function commitQuestCommand(client,quest,reward,operationId,{userId,sessionValid=()=>true}={}){
 const guard=()=>{if(!sessionValid())throw Error('Quest command session changed')};
 if(!userId||!operationId||!reward?.facts)throw Error('Missing immutable quest facts');
 guard();let failure,status;
 try{({error:failure,status}=await client.rpc('lumen_commit_quest_command',{
  p_operation_id:operationId,p_expected_user_id:userId,p_quest_id:quest.id,p_facts:reward.facts
 }))}catch(error){failure=error}
 guard();
 let read;
 try{read=await client.rpc('lumen_get_quest_command',{p_operation_id:operationId,p_expected_user_id:userId})}
 catch(error){throw canonicalRecoveryFailure(failure||error,status)}
 guard();
 if(read.error)throw canonicalRecoveryFailure(failure||read.error,status||read.status);
 const receipt=read.data;
 if(!receipt)throw failure?canonicalRecoveryFailure(failure,status):Error('Quest receipt unconfirmed');
 if(!matches(receipt,quest.id,operationId,reward.facts))throw Error('Quest receipt integrity failure');
 const profile=await loadVerifiedProfile(client,{userId});guard();
 const state=profile?.canonicalQuestState?.[quest.id],performance=questPerformanceRecord(quest,profile);
 const badges=receipt.outcome.savedPerformance.badges;
 if(!state?.solved||!['speed','autonomy','noError','mastery'].every(key=>!badges[key]||state.badges?.[key]===true||state.badges?.[key]===1)
  ||!(performance.attempts>=receipt.outcome.attempts))throw Error('Quest projection unconfirmed');
 return {profile,quest,receipt,newlyCompleted:receipt.outcome.firstCompletion,outcome:receipt.outcome,alreadySaved:!!failure};
}
export async function loadCommittedQuestAttempt(client,quest,operationId,{userId,sessionValid=()=>true}={}){
 const guard=()=>{if(!sessionValid())throw Error('Quest command session changed')};
 guard();const read=await client.rpc('lumen_get_quest_command',{p_operation_id:operationId,p_expected_user_id:userId});guard();
 if(read.error?.code==='PGRST202'&&read.status===404)return null;
 if(read.error)throw canonicalRecoveryFailure(read.error,read.status);
 if(read.data===null)return null;
 const receipt=read.data;
 if(receipt.request?.version===1)return null; // V1 is recovered by its original adapter.
 if(!matches(receipt,quest.id,operationId,receipt.request.facts))throw Error('Quest receipt integrity failure');
 const profile=await loadVerifiedProfile(client,{userId});guard();
 const saved=profile?.canonicalQuestState?.[quest.id];
 if(!saved?.solved||!['speed','autonomy','noError','mastery'].every(key=>!receipt.outcome.savedPerformance.badges[key]||!!saved.badges?.[key])
  ||!(questPerformanceRecord(quest,profile).attempts>=receipt.outcome.attempts))throw Error('Quest projection unconfirmed');
 const badges=receipt.outcome.savedPerformance.badges,facts=receipt.request.facts;
 return {userId,profile,quest,receipt,outcome:receipt.outcome,newlyCompleted:false,alreadySaved:true,
  reward:{badges,performance:{bestTime:facts.seconds,seconds:facts.seconds,assisted:facts.assistanceUsed},stars:receipt.outcome.stars,facts}};
}
