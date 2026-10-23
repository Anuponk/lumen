import {validateCloudProfile,cloudSafelyCoversLocal,sameCloudProfile,CLOUD_PROFILE_FIELDS} from './cloud-profile.js';

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
