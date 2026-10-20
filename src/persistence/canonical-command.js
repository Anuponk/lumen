import {loadVerifiedProfile} from './cloud-profile.js';
import {canonicalRecoveryFailure} from './canonical-recovery-errors.js';
const support=new WeakMap();
export async function canonicalCommandsSupported(client){
 if(support.has(client))return support.get(client);
 let response;
 try{response=await client.rpc('lumen_canonical_command_version')}catch(error){throw canonicalRecoveryFailure(error)}
 const {data,error,status}=response;
 // An explicitly missing read-only capability endpoint proves no command ran.
 // Never downgrade after a command, an auth error, timeout or unknown response.
 if(error?.code==='PGRST202'&&status===404)return false;
 if(error)throw canonicalRecoveryFailure(error,status);
 if(data!==1)throw Error('Canonical command version unverified');
 support.set(client,true);return true;
}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
 return value;
}
function receiptMatches(receipt,id,questId,reward){
 return receipt?.version===1&&receipt.operationId===id&&receipt.questId===questId&&typeof receipt.newlyCompleted==='boolean'
  &&typeof receipt.recordedAt==='string'&&Number.isFinite(Date.parse(receipt.recordedAt))
  &&JSON.stringify(stable(receipt.badges))===JSON.stringify(stable(reward?.badges??{}))
  &&JSON.stringify(stable(receipt.performance))===JSON.stringify(stable(reward?.performance??null));
}
export async function commitCanonicalCommand(client,quest,reward,operationId,{userId,sessionValid=()=>true}={}){
 if(typeof operationId!=='string'||!/^[A-Za-z0-9._-]{1,120}$/.test(operationId))throw canonicalRecoveryFailure({code:'22023'});
 let error,status;
 if(!sessionValid())throw Error('Canonical command session changed');
 try{({error,status}=await client.rpc('lumen_commit_canonical_command',{
  p_operation_id:operationId,p_expected_user_id:userId,p_quest_id:quest.id,p_badges:reward?.badges??{},p_performance:reward?.performance??null
 }))}catch(failure){error=failure}
 if(!sessionValid())throw Error('Canonical command session changed');
 // Independent receipt lookup even when the write returned success or threw.
 let receipt;
 try{
  const read=await client.rpc('lumen_get_canonical_command',{p_operation_id:operationId,p_expected_user_id:userId});
  if(read.error)throw canonicalRecoveryFailure(read.error,read.status);
  receipt=read.data;
 }catch(failure){throw error?canonicalRecoveryFailure(error,status):canonicalRecoveryFailure(failure)}
 if(!sessionValid())throw Error('Canonical command session changed');
 if(!receipt)throw error?canonicalRecoveryFailure(error,status):Error('Canonical command receipt unconfirmed');
 if(!receiptMatches(receipt,operationId,quest.id,reward))throw canonicalRecoveryFailure({code:'22023'});
 let profile;
 try{profile=await loadVerifiedProfile(client)}catch(failure){throw canonicalRecoveryFailure(failure)}
 const saved=profile?.canonicalQuestState?.[quest.id];
 if(!sessionValid())throw Error('Canonical command session changed');
 if(!saved?.solved||!['autonomy','speed','noError','mastery'].every(key=>!reward?.badges?.[key]||saved.badges?.[key]===true||saved.badges?.[key]===1))throw Error('Canonical command projection unconfirmed');
 return {profile,quest,receipt,newlyCompleted:receipt.newlyCompleted,alreadySaved:!!error};
}


// A restored solved board may outlive its already acknowledged local intention.
// Recover that immutable server result before generating any replacement evidence.
export async function loadCommittedCanonicalAttempt(client,quest,operationId,{userId,sessionValid=()=>true}={}){
 if(!userId||typeof operationId!=='string'||!/^[A-Za-z0-9._-]{1,120}$/.test(operationId)||!quest?.id)throw canonicalRecoveryFailure({code:'22023'});
 if(!sessionValid())throw Error('Canonical command session changed');
 if(!(await canonicalCommandsSupported(client)))return null;
 if(!sessionValid())throw Error('Canonical command session changed');
 const {data:receipt,error,status}=await client.rpc('lumen_get_canonical_command',{p_operation_id:operationId,p_expected_user_id:userId});
 if(error)throw canonicalRecoveryFailure(error,status);
 if(!sessionValid())throw Error('Canonical command session changed');
 if(receipt===null)return null;
 if(!receipt?.badges||typeof receipt.badges!=='object'||Array.isArray(receipt.badges)||
  !receiptMatches(receipt,operationId,quest.id,{badges:receipt.badges,performance:receipt.performance}))throw canonicalRecoveryFailure({code:'22023'});
 const profile=await loadVerifiedProfile(client),saved=profile?.canonicalQuestState?.[quest.id];
 if(!sessionValid())throw Error('Canonical command session changed');
 if(!saved?.solved||!['autonomy','speed','noError','mastery'].every(key=>!receipt.badges[key]||saved.badges?.[key]===true||saved.badges?.[key]===1))throw Error('Canonical command projection unconfirmed');
 return {userId,profile,quest,receipt,newlyCompleted:false,alreadySaved:true,reward:{badges:receipt.badges,performance:receipt.performance,stars:1}};
}
