import assert from 'node:assert/strict';
export async function verifyHistoricalClaim({evaluate,navigate,url}){
 await navigate('Page.navigate',{url:new URL('/scripts/fixtures/storage-quota.html',url).href});
 const result=await evaluate(`(async()=>{
  const {captureGuestClaim,claimGuestProfile}=await import('/src/persistence/guest-claim.js');
  const {cloudSafelyCoversLocal}=await import('/src/persistence/cloud-profile.js');
  const {inventoryHistoricalProfiles}=await import('/src/persistence/historical-inventory.js');
  // A fresh disposable origin. Existing app evidence remains preserved.
  const previous=localStorage.getItem('lumenProgressV1'),owner=localStorage.getItem('lumenCloudOwnerId');
  const guest={solved:{0:1},badges:{},shards:2,xp:10,unknown:{original:'étoile'}},raw=JSON.stringify(guest);
  localStorage.removeItem('lumenCloudOwnerId');localStorage.setItem('lumenProgressV1',raw);
  try{
   const manifest=await captureGuestClaim(localStorage,{userId:'native-guest',profile:guest,original:raw});
   const restarted=await captureGuestClaim(localStorage,{userId:'native-guest',profile:guest,original:raw});
   if(JSON.stringify(manifest)!==JSON.stringify(restarted))throw Error('Claim changed across a new adapter');
   let effects=0,lost=true,readLost=true,receipt=null;
   const client={rpc:async(name,args)=>{
    if(name==='lumen_claim_guest_profile'){
     if(!receipt){effects++;receipt={version:1,userId:manifest.userId,claimId:manifest.claimId,sourceDigest:manifest.sourceDigest,seedDigest:manifest.seedDigest,policy:manifest.policy,status:'initialized'}}
     if(lost){lost=false;throw Error('Synthetic lost response')}return {data:receipt};
    }
    if(readLost){readLost=false;throw Error('Synthetic receipt read unavailable')}return {data:receipt};
   }};
   let failed=false;const options={loadProfile:async()=>structuredClone(guest),covers:cloudSafelyCoversLocal};
   try{await claimGuestProfile(client,manifest,options)}catch{failed=true}
   if(!failed)throw Error('Lost response was presented as confirmed');
   const confirmed=await claimGuestProfile(client,restarted,options);
   if(effects!==1||JSON.stringify(confirmed.profile)!==raw||localStorage.getItem('lumenProgressV1')!==raw)throw Error('Claim duplicated or changed original');
   const inventory=await inventoryHistoricalProfiles({userId:'native-guest',sources:[{id:'original',owner:null,raw}],remoteRaw:raw,remoteOwner:'native-guest'});
   if(inventory.mutations!==0||inventory.sources[0].status!=='identical'||inventory.sources[0].raw!==raw)throw Error('Inventory changed original');
   return {nativeStorage:true,immutableManifest:true,lostResponse:true,independentReceipt:true,unknownFields:true,readOnlyInventory:true,simulatedRpc:true};
  }finally{
   if(previous===null)localStorage.removeItem('lumenProgressV1');else localStorage.setItem('lumenProgressV1',previous);
   if(owner===null)localStorage.removeItem('lumenCloudOwnerId');else localStorage.setItem('lumenCloudOwnerId',owner);
  }
 })()`,true);
 assert.equal(result.nativeStorage,true);assert.equal(result.lostResponse,true);return result;
}
