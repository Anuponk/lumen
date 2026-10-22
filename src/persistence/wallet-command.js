import {loadVerifiedProfile,sameCloudProfile} from './cloud-profile.js';
import {canonicalRecoveryFailure} from './canonical-recovery-errors.js';

export function walletSpendIdentity(kind,attempt,sequence){
 if(!['hint','verify'].includes(kind)||!attempt?.attemptId||!Number.isSafeInteger(sequence)||sequence<1)
  throw Error('Invalid spend context');
 const request={kind,attemptId:attempt.attemptId,resetCount:attempt.resetCount||0,sequence};
 return {operationId:`${request.attemptId}-reset-${request.resetCount}-${kind}-${sequence}`,request};
}
export async function walletCommandsSupported(client){
 let response;try{response=await client.rpc('lumen_wallet_command_version')}catch(error){throw canonicalRecoveryFailure(error)}
 if(response.error?.code==='PGRST202'&&response.status===404)return false;
 if(response.error)throw canonicalRecoveryFailure(response.error,response.status);
 if(response.data!==1)throw Error('Wallet command version unverified');
 return true;
}
export async function commitWalletCommand(client,userId,operationId,request,{sessionValid=()=>true}={}){
 const guard=()=>{if(!sessionValid())throw Error('Wallet command session changed')};
 guard();let failure,status;
 try{({error:failure,status}=await client.rpc('lumen_commit_wallet_command',{
  p_operation_id:operationId,p_expected_user_id:userId,p_request:request
 }))}catch(error){failure=error}
 guard();
 let read;try{read=await client.rpc('lumen_get_wallet_command',{p_operation_id:operationId,p_expected_user_id:userId})}catch(error){throw canonicalRecoveryFailure(failure||error,status)}
 guard();
 if(read.error)throw canonicalRecoveryFailure(failure||read.error,status||read.status);
 const receipt=read.data;
 if(!receipt)throw failure?canonicalRecoveryFailure(failure,status):Error('Wallet receipt unconfirmed');
 if(receipt.version!==1||receipt.operationId!==operationId||!sameCloudProfile(receipt.request,request)
  ||!Number.isSafeInteger(receipt.revision)||receipt.revision<1||!Number.isSafeInteger(receipt.balance)||receipt.balance<0)
  throw Error('Wallet receipt integrity failure');
 const profile=await loadVerifiedProfile(client,{userId});guard();
 if(!Number.isSafeInteger(profile.walletRevision)||profile.walletRevision<receipt.revision
  ||!Number.isSafeInteger(profile.shards)||profile.shards<0
  ||(profile.walletRevision===receipt.revision&&profile.shards!==receipt.balance))throw Error('Wallet projection unconfirmed');
 return {profile,receipt};
}

// Retain immutable request before any mutation. Lost replies and crash/restart
// replay the same identity; acknowledgement always follows independent proof.
export async function submitWalletCommand(outbox,client,userId,operationId,request,options={}){
 if(outbox.domain!=='Wallet')throw Error('Wallet outbox domain required');
 const entry=await outbox.enqueue(userId,'wallet',{request},{operationId});
 if(options.sessionValid&&!options.sessionValid())throw Error('Wallet command session changed');
 const result=await commitWalletCommand(client,userId,entry.operationId,entry.reward.request,options);
 if(options.beforeAcknowledge)await options.beforeAcknowledge(result);
 await outbox.acknowledge(userId,'wallet',entry.reward,entry.operationId,{sessionValid:options.sessionValid});
 return result;
}

export function walletReceiptCoversLocal(local,remote,receipt){
 if(!receipt||receipt.version!==1||receipt.revision!==remote.walletRevision||receipt.balance!==remote.shards
  ||!Number.isSafeInteger(receipt.balanceDelta)||!Number.isSafeInteger(local.shards)
  ||(local.walletRevision??0)!==receipt.revision-1||local.shards+receipt.balanceDelta!==remote.shards)return false;
 const daily=['daily','establish'].includes(receipt.request?.kind);
 const covers=(left,right)=>sameCloudProfile(left,right)||(left&&right&&typeof left==='object'&&typeof right==='object'
  &&!Array.isArray(left)&&!Array.isArray(right)&&Object.entries(left).every(([key,value])=>Object.hasOwn(right,key)&&covers(value,right[key])));
 if(daily&&!covers(local.daily??{},remote.daily??{}))return false;
 const omit=p=>Object.fromEntries(Object.entries(p).filter(([k])=>!['shards','walletRevision',...(daily?['daily']:[])].includes(k)));
 return sameCloudProfile(omit(local),omit(remote));
}

export function recoverWalletCache(storage,remote,receipt,{userId,sessionValid=()=>true}={}){
 const raw=storage.getItem('lumenProgressV1');
 if(!raw||!sessionValid()||storage.getItem('lumenCloudOwnerId')!==userId)return false;
 let local;try{local=JSON.parse(raw)}catch{return false}
 if(!walletReceiptCoversLocal(local,remote,receipt))return false;
 const copies=[['Local',raw],['Remote',JSON.stringify(remote)]];
 for(const [side,value] of copies){
  const key=`lumenBeforeWalletRecovery${side}_${receipt.operationId}`;
  const old=storage.getItem(key);
  if(old!==null&&old!==value)throw Error('Wallet recovery archive conflict');
  storage.setItem(key,value);if(storage.getItem(key)!==value)throw Error('Wallet recovery archive unverified');
 }
 if(!sessionValid()||storage.getItem('lumenCloudOwnerId')!==userId||storage.getItem('lumenProgressV1')!==raw)return false;
 const saved=JSON.stringify(remote);storage.setItem('lumenProgressV1',saved);
 if(storage.getItem('lumenProgressV1')!==saved)throw Error('Wallet recovery cache unverified');
 return true;
}
