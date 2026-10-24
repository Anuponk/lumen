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
function verifyLegacyProjection(profile,receipt,quest){
 const saved=profile?.performances?.[quest.legacyIndex],badges=receipt.outcome.savedPerformance?.badges;
 if(!profile?.solved?.[quest.legacyIndex]||!saved||!badges||!['speed','autonomy','noError','mastery'].every(k=>!badges[k]||!!saved.badges?.[k])||!Number.isSafeInteger(receipt.outcome.attempts)||!Number.isSafeInteger(saved.attempts)||saved.attempts<receipt.outcome.attempts)throw Error('Legacy command projection unconfirmed');
}
export async function loadCommittedLegacyAttempt(client,questId,operationId,{userId,sessionValid=()=>true}={}){
 const quest=canonicalQuestList().find(q=>q.id===questId&&q.legacyIndex!==null);
 if(!quest||!userId||typeof operationId!=='string'||!/^[A-Za-z0-9._-]{1,120}$/.test(operationId))throw canonicalRecoveryFailure({code:'22023'});
 const scope=()=>{if(!sessionValid())throw Error('Legacy command session changed')};
 scope();const read=await client.rpc('lumen_get_legacy_command',{p_expected_user_id:userId,p_operation_id:operationId});scope();
 if(read.error)throw canonicalRecoveryFailure(read.error,read.status);
 const receipt=read.data;if(receipt===null)return null;
 if(!receipt?.request?.facts||!sameCloudProfile(receipt.request,{version:1,operationId,questId,facts:receipt.request.facts})||typeof receipt.outcome?.firstCompletion!=='boolean'||!Number.isFinite(Date.parse(receipt.recordedAt)))throw canonicalRecoveryFailure({code:'22023'});
 const profile=await loadVerifiedProfile(client,{userId});scope();
 verifyLegacyProjection(profile,receipt,quest);
 return {profile,receipt,quest,userId};
}
// A later copy of an already committed run is evidence to archive, not a new
// command or permission to rewrite its receipt. Every fact except elapsed time
// must match, and the later capture may not improve the committed performance.
export function assertRecreatedLegacyCapture(userId,entry,committed){
 const fail=()=>{throw Error('Recreated legacy capture proof unconfirmed')};
 const exactKeys=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
 const receipt=committed?.receipt,request=receipt?.request;
 const quest=canonicalQuestList().find(q=>q.id===entry?.questId&&q.legacyIndex!==null);
 const fields=['seconds','assistanceUsed','mistakeCommitted','qualifying','hintUsed','challengeFailed','qualifiedDay','qualifiedAt'];
 const validFacts=v=>exactKeys(v,fields)&&Number.isSafeInteger(v.seconds)&&v.seconds>=0&&fields.slice(1,6).every(k=>typeof v[k]==='boolean')&&typeof v.qualifiedDay==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.qualifiedDay)&&typeof v.qualifiedAt==='string'&&Number.isFinite(Date.parse(v.qualifiedAt));
 const later=entry?.reward?.facts,earlier=request?.facts;
 if(!quest||!exactKeys(entry,['version','operationId','userId','questId','reward','createdAt'])||entry.version!==2||entry.userId!==userId||committed?.userId!==userId||
  !exactKeys(entry.reward,['facts'])||!exactKeys(request,['version','operationId','questId','facts'])||request.version!==1||request.operationId!==entry.operationId||request.questId!==quest.id||
  !validFacts(later)||!validFacts(earlier)||later.seconds<earlier.seconds||!fields.filter(k=>k!=='seconds').every(k=>later[k]===earlier[k])||
  typeof receipt.outcome?.firstCompletion!=='boolean'||!Number.isSafeInteger(receipt.outcome.attempts)||receipt.outcome.attempts<1||!Number.isFinite(Date.parse(receipt.recordedAt))||!Number.isFinite(Date.parse(entry.createdAt))||
  (later.seconds!==earlier.seconds&&Date.parse(entry.createdAt)<Date.parse(receipt.recordedAt)))fail();
 verifyLegacyProjection(committed.profile,receipt,quest);
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
 const profile=await loadVerifiedProfile(client,{userId});scope();
 verifyLegacyProjection(profile,receipt,quest);
 return {profile,receipt,quest};
}
// Recovery keeps immutable evidence and pauses refusals independently. Legacy
// scalar rewards require a clean verified baseline before UI installation.
export async function replayLegacyVictoryOutbox(outbox,userId,commit,{sessionValid=()=>true,onIssue=()=>{},recoverCommitted}={}){
 const confirmed=[],blocked=new Set(),state=await outbox.inspect(userId);
 if(state.authRequired)return confirmed;
 const paused=new Map(state.paused.map(e=>[e.operationId,e]));
 for(const entry of state.pending){
  if(!sessionValid())break;
  const hold=paused.get(entry.operationId);
  if((hold&&!(recoverCommitted&&hold.kind==='review'&&hold.code==='22023'))||blocked.has(entry.questId)){blocked.add(entry.questId);continue}
  try{
   const recovered=recoverCommitted?await recoverCommitted(entry):null;
   if(!sessionValid())break;
   if(hold&&!recovered){blocked.add(entry.questId);continue}
   const saved=recovered||await commit(entry.questId,entry.reward.facts,entry.operationId,{userId,sessionValid});
   if(!sessionValid())break;
   if(!recovered)await outbox.acknowledge(userId,entry.questId,entry.reward,entry.operationId);confirmed.push(saved);
  }catch(error){
   if(!sessionValid())break;
   blocked.add(entry.questId);try{await outbox.pause(userId,entry,error)}catch{onIssue({kind:'retry_state_unpersisted'})}
   onIssue({kind:'pending'});
  }
 }
 return confirmed;
}
