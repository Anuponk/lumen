import {validateCloudProfile,cloudSafelyCoversLocal,sameCloudProfile,CLOUD_PROFILE_FIELDS,loadVerifiedProfile} from './cloud-profile.js';
import {walletReceiptCoversLocal} from './wallet-command.js';

export async function bytesDigest(raw){
 if(typeof raw!=='string')throw Error('Expected original bytes');
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}

// A private, read-only inventory. Hashes prove identity, never a transaction.
// Receipts passed in an export are evidence to review, not trusted RPC results.
export async function inventoryHistoricalProfiles({userId,sources,remoteRaw=null,remoteOwner=null}={}){
 if(typeof userId!=='string'||!userId||!Array.isArray(sources))throw Error('Invalid inventory owner');
 const captured=structuredClone(sources),cloudRaw=remoteRaw;
 let remote=null;
 if(cloudRaw!==null){if(remoteOwner!==userId)throw Error('Wrong remote owner');remote=validateCloudProfile(JSON.parse(cloudRaw))}
 const rows=[];
 for(const source of captured){
  if(typeof source.id!=='string'||!source.id||typeof source.raw!=='string'||!(source.owner===null||typeof source.owner==='string'))throw Error('Invalid source provenance');
  const row={id:source.id,owner:source.owner,origin:source.origin??null,raw:source.raw,digest:await bytesDigest(source.raw),status:'incomplete',reasons:[],unknownFields:[]};
  let local;
  try{local=validateCloudProfile(JSON.parse(source.raw))}catch{row.reasons.push('unreadable_or_unsupported');rows.push(row);continue}
  row.unknownFields=Object.keys(local).filter(key=>!Object.hasOwn(CLOUD_PROFILE_FIELDS,key));
  if(source.owner!==null&&source.owner!==userId){row.status='contradictory';row.reasons.push('foreign_owner')}
  else if(!remote)row.reasons.push('remote_missing');
  else if(sameCloudProfile(local,remote))row.status='identical';
  else if(cloudSafelyCoversLocal(local,remote)){
   // Coverage alone is deliberately not labelled receipt-covered.
   row.status='covered_projection';row.reasons.push('independent_receipt_review_required');
  }else{
   row.status='contradictory';row.reasons.push('projection_does_not_cover_source');
   if(local.shards!==remote.shards)row.reasons.push('wallet_review_required');
   if(row.unknownFields.some(key=>!sameCloudProfile(local[key],remote[key])))row.reasons.push('unknown_fields_differ');
  }
  rows.push(row);
 }
 return {app:'Lumen',format:'historical-inventory-v1',userId,remote:cloudRaw===null?null:{owner:remoteOwner,raw:cloudRaw,digest:await bytesDigest(cloudRaw)},sources:rows,mutations:0};
}

// Optional read-only RPC inventory for exact Wallet receipt coverage. Never
// trusts a receipt copied from an export, acknowledges an outbox or installs.
export async function inventoryHistoricalAccount(client,{userId,sources,operations=[],sessionValid=()=>true}={}){
 if(typeof userId!=='string'||!userId||!Array.isArray(sources)||!Array.isArray(operations))throw Error('Invalid historical inventory owner');
 const captured=structuredClone(sources),identities=structuredClone(operations);
 const guard=()=>{if(!sessionValid())throw Error('Historical inventory session changed')};
 guard();const remote=await loadVerifiedProfile(client,{userId});guard();
 const receipts=[];
 for(const op of identities){
  if(typeof op.operationId!=='string'||!/^[A-Za-z0-9._-]{1,120}$/.test(op.operationId)||!op.request)throw Error('Invalid inventory operation');
  const result=await client.rpc('lumen_get_wallet_command',{p_expected_user_id:userId,p_operation_id:op.operationId});guard();
  if(result.error)throw Error('Historical receipt unavailable');
  const receipt=result.data;
  if(receipt?.version===1&&Number.isSafeInteger(receipt.revision)&&receipt.revision>0&&Number.isSafeInteger(receipt.balance)&&receipt.balance>=0&&receipt.operationId===op.operationId&&sameCloudProfile(receipt.request,op.request))receipts.push(receipt);
 }
 const latest=await loadVerifiedProfile(client,{userId});guard();
 if(!sameCloudProfile(remote,latest))throw Error('Historical projection changed during inventory');
 const report=await inventoryHistoricalProfiles({userId,sources:captured,remoteRaw:remote===null?null:JSON.stringify(remote),remoteOwner:userId});guard();
 if(remote)for(const row of report.sources){
  if(row.owner!==userId)continue;
  let local;try{local=validateCloudProfile(JSON.parse(row.raw))}catch{continue}
  const receipt=receipts.find(item=>walletReceiptCoversLocal(local,remote,item));
  if(receipt){row.status='receipt_covered';row.reasons=[];row.receipt={domain:'Wallet',operationId:receipt.operationId,revision:receipt.revision}}
 }
 return report;
}
