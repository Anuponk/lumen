import {loadVerifiedProfile,sameCloudProfile,validateCloudProfile} from './cloud-profile.js';
import {canonicalRecoveryFailure} from './canonical-recovery-errors.js';
import {questPerformanceRecord} from '../campaign/quest-rules.js';
import {verifyOfficialProjection} from '../campaign/official-time.js';

function matches(receipt,questId,operationId,facts){
 return receipt?.request?.version===2&&receipt.request.questId===questId&&receipt.request.operationId===operationId
  &&sameCloudProfile(receipt.request.facts,facts)&&typeof receipt.outcome?.firstCompletion==='boolean'
  &&Number.isSafeInteger(receipt.outcome?.attempts)&&receipt.outcome.attempts>0
  &&Number.isFinite(Date.parse(receipt.recordedAt))&&receipt.outcome.savedPerformance?.badges;
}
// #697: one read-only round trip returns the exact receipt and, only when it
// exists, the current verified profile (same account guard as the two reads).
// Only an explicitly missing endpoint selects the two separate reads; a
// malformed response is an integrity failure, never an absent receipt.
const combinedReads=new WeakMap();
async function readQuestReceipt(client,operationId,userId){
 const args={p_operation_id:operationId,p_expected_user_id:userId};
 if(combinedReads.get(client)!==false){
  const read=await client.rpc('lumen_get_quest_command_verified',args);
  if(read?.error?.code==='PGRST202'&&read.status===404)combinedReads.set(client,false);
  else{
   if(read?.error)return {error:read.error,status:read.status};
   const value=read?.data;
   if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||!Object.hasOwn(value,'receipt')||!Object.hasOwn(value,'profile')
    ||(value.receipt===null&&value.profile!==null))throw Error('Quest receipt integrity failure');
   combinedReads.set(client,true);
   return {data:value.receipt,profile:value.profile===null?null:validateCloudProfile(value.profile),combined:true};
  }
 }
 const read=await client.rpc('lumen_get_quest_command',args);
 return {data:read?.data,error:read?.error,status:read?.status};
}
async function verifiedProfileFor(client,read,userId){
 return read.combined?read.profile:loadVerifiedProfile(client,{userId});
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
 try{read=await readQuestReceipt(client,operationId,userId)}
 catch(error){throw canonicalRecoveryFailure(failure||error,status)}
 guard();
 if(read.error)throw canonicalRecoveryFailure(failure||read.error,status||read.status);
 const receipt=read.data;
 if(!receipt)throw failure?canonicalRecoveryFailure(failure,status):Error('Quest receipt unconfirmed');
 if(!matches(receipt,quest.id,operationId,reward.facts))throw Error('Quest receipt integrity failure');
 const profile=await verifiedProfileFor(client,read,userId);guard();
 const state=profile?.canonicalQuestState?.[quest.id],performance=questPerformanceRecord(quest,profile);
 const badges=receipt.outcome.savedPerformance.badges;
 if(!state?.solved||!['speed','autonomy','noError','mastery'].every(key=>!badges[key]||state.badges?.[key]===true||state.badges?.[key]===1)
  ||!(performance.attempts>=receipt.outcome.attempts))throw Error('Quest projection unconfirmed');
 verifyOfficialProjection(performance,reward.facts);
 return {profile,quest,receipt,newlyCompleted:receipt.outcome.firstCompletion,outcome:receipt.outcome,alreadySaved:!!failure};
}
export async function loadCommittedQuestAttempt(client,quest,operationId,options={}){
 return (await inspectCommittedQuestAttempt(client,quest,operationId,options)).attempt;
}
// absent=true only when the V2 endpoint answered that no receipt row exists.
// V1 and V2 receipts share one table, so no V1 receipt can exist either.
export async function inspectCommittedQuestAttempt(client,quest,operationId,{userId,sessionValid=()=>true}={}){
 const guard=()=>{if(!sessionValid())throw Error('Quest command session changed')};
 guard();const read=await readQuestReceipt(client,operationId,userId);guard();
 if(read.error?.code==='PGRST202'&&read.status===404)return {attempt:null,absent:false};
 if(read.error)throw canonicalRecoveryFailure(read.error,read.status);
 if(read.data===null)return {attempt:null,absent:true};
 const receipt=read.data;
 if(receipt.request?.version===1)return {attempt:null,absent:false}; // V1 is recovered by its original adapter.
 if(!matches(receipt,quest.id,operationId,receipt.request.facts))throw Error('Quest receipt integrity failure');
 const profile=await verifiedProfileFor(client,read,userId);guard();
 const saved=profile?.canonicalQuestState?.[quest.id];
 if(!saved?.solved||!['speed','autonomy','noError','mastery'].every(key=>!receipt.outcome.savedPerformance.badges[key]||!!saved.badges?.[key])
  ||!(questPerformanceRecord(quest,profile).attempts>=receipt.outcome.attempts))throw Error('Quest projection unconfirmed');
 const badges=receipt.outcome.savedPerformance.badges,facts=receipt.request.facts;
 verifyOfficialProjection(questPerformanceRecord(quest,profile),facts);
 return {attempt:{userId,profile,quest,receipt,outcome:receipt.outcome,newlyCompleted:false,alreadySaved:true,
  reward:{badges,performance:{bestTime:facts.seconds,seconds:facts.seconds,assisted:facts.assistanceUsed},stars:receipt.outcome.stars,facts}},absent:false};
}
