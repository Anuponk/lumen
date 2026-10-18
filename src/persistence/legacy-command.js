import {loadVerifiedProfile,sameCloudProfile} from './cloud-profile.js';
import {canonicalRecoveryFailure} from './canonical-recovery-errors.js';
import {canonicalQuestList} from '../campaign/canonical-quests.js';
const supported=new WeakMap();
export async function legacyCommandsSupported(client){
 if(supported.has(client))return true;
 let response;try{response=await client.rpc('lumen_legacy_command_version')}catch(error){throw canonicalRecoveryFailure(error)}
 if(response.error?.code==='PGRST202'&&response.status===404)return false;
 if(response.error)throw canonicalRecoveryFailure(response.error,response.status);
 if(response.data!==1)throw Error('Legacy command capability unverified');
 supported.set(client,true);return true;
}
export async function commitLegacyVictoryCommand(client,questId,facts,operationId,{userId,sessionValid=()=>true}={}){
 const quest=canonicalQuestList().find(q=>q.id===questId&&q.legacyIndex!==null);
 if(!quest||!userId||typeof operationId!=='string'||!/^[A-Za-z0-9._-]{1,120}$/.test(operationId))throw canonicalRecoveryFailure({code:'22023'});
 const scope=()=>{if(!sessionValid())throw Error('Legacy command session changed')};
 scope();let failure,status;
 try{({error:failure,status}=await client.rpc('lumen_commit_legacy_command',{p_expected_user_id:userId,p_operation_id:operationId,p_quest_id:questId,p_facts:facts}))}catch(error){failure=error}
 scope();let receipt;
 try{
  const read=await client.rpc('lumen_get_legacy_command',{p_expected_user_id:userId,p_operation_id:operationId});
  if(read.error)throw canonicalRecoveryFailure(read.error,read.status);
  receipt=read.data;
 }catch(error){throw failure?canonicalRecoveryFailure(failure,status):error}
 scope();
 if(!receipt)throw failure?canonicalRecoveryFailure(failure,status):Error('Legacy command receipt unconfirmed');
 if(!sameCloudProfile(receipt.request,{version:1,operationId,questId,facts})||typeof receipt.outcome?.firstCompletion!=='boolean'||!Number.isFinite(Date.parse(receipt.recordedAt)))throw canonicalRecoveryFailure({code:'22023'});
 const profile=await loadVerifiedProfile(client);scope();
 const saved=profile?.performances?.[quest.legacyIndex],badges=receipt.outcome.savedPerformance?.badges;
 if(!profile?.solved?.[quest.legacyIndex]||!saved||!badges||!['speed','autonomy','noError','mastery'].every(k=>!badges[k]||!!saved.badges?.[k])||!Number.isSafeInteger(receipt.outcome.attempts)||!Number.isSafeInteger(saved.attempts)||saved.attempts<receipt.outcome.attempts)throw Error('Legacy command projection unconfirmed');
 return {profile,receipt,quest};
}
// Recovery keeps immutable evidence and pauses refusals independently. Legacy
// scalar rewards require a clean verified baseline before UI installation.
export async function replayLegacyVictoryOutbox(outbox,userId,commit,{sessionValid=()=>true,onIssue=()=>{}}={}){
 const confirmed=[],blocked=new Set(),state=await outbox.inspect(userId);
 if(state.authRequired)return confirmed;
 const paused=new Set(state.paused.map(e=>e.operationId));
 for(const entry of state.pending){
  if(!sessionValid())break;
  if(paused.has(entry.operationId)||blocked.has(entry.questId)){blocked.add(entry.questId);continue}
  try{
   const saved=await commit(entry.questId,entry.reward.facts,entry.operationId,{userId,sessionValid});
   if(!sessionValid())break;
   await outbox.acknowledge(userId,entry.questId,entry.reward,entry.operationId);confirmed.push(saved);
  }catch(error){
   if(!sessionValid())break;
   blocked.add(entry.questId);try{await outbox.pause(userId,entry,error)}catch{onIssue({kind:'retry_state_unpersisted'})}
   onIssue({kind:'pending'});
  }
 }
 return confirmed;
}
