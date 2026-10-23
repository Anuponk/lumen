// Guest provenance remains local; only an explicit initialization sends it.
export const GUEST_CLAIM_PREFIX='lumenGuestClaimV1:';
async function digest(raw){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(n=>n.toString(16).padStart(2,'0')).join('')}
const validOwner=id=>typeof id==='string'&&id.length>0&&!id.includes(':');
export async function captureGuestClaim(storage,{userId,profile,original,sessionValid=()=>true,locks=globalThis.navigator?.locks}={}){
 if(!validOwner(userId)||typeof original!=='string'||!sessionValid()||storage.getItem('lumenCloudOwnerId')!==null||storage.getItem('lumenProgressV1')!==original)throw Error('Guest claim source changed');
 const seedRaw=JSON.stringify(profile),sourceDigest=await digest(original),seedDigest=await digest(seedRaw);
 const valid=()=>sessionValid()&&storage.getItem('lumenCloudOwnerId')===null&&storage.getItem('lumenProgressV1')===original;
 if(!valid())throw Error('Guest claim session changed');
 // One original on this device is bound to one target, even while an auth
 // failure has left it unowned. Switching accounts cannot mint another claim.
 const key=GUEST_CLAIM_PREFIX+sourceDigest;
 const capture=()=>{
 if(!valid())throw Error('Guest claim source changed');
 let raw=storage.getItem(key),manifest;
 if(raw===null){
  manifest={version:1,userId,claimId:crypto.randomUUID(),policy:'new-profile-net-balance-v1',sourceDigest,seedDigest,sourceRaw:original,seedRaw};
  raw=JSON.stringify(manifest);storage.setItem(key,raw);
 }else manifest=JSON.parse(raw);
 if(!valid()||storage.getItem(key)!==raw||manifest.version!==1||manifest.userId!==userId||manifest.sourceDigest!==sourceDigest||manifest.seedDigest!==seedDigest||manifest.sourceRaw!==original||manifest.seedRaw!==seedRaw||manifest.policy!=='new-profile-net-balance-v1'||!/^[0-9a-f-]{36}$/.test(manifest.claimId))throw Error('Guest claim not preserved');
 return manifest;
 };
 return locks?.request?locks.request('lumen-guest-claim:'+sourceDigest,{mode:'exclusive'},capture):capture();
}

export async function claimGuestProfile(client,manifest,{loadProfile,covers,sessionValid=()=>true}={}){
 // Freeze before any await; an ambiguous result never falls back to another writer.
 const claim=structuredClone(manifest);
 if(!sessionValid())throw Error('Guest claim session changed');
 const args={p_expected_user_id:claim.userId,p_manifest:claim};
 // The independent read decides success even when the mutation reply is lost.
 try{await client.rpc('lumen_claim_guest_profile',args)}catch{}
 if(!sessionValid())throw Error('Guest claim pending');
 const receipt=await client.rpc('lumen_get_guest_claim',{p_expected_user_id:claim.userId,p_claim_id:claim.claimId});
 if(!sessionValid()||receipt.error||receipt.data?.version!==1||receipt.data?.userId!==claim.userId||receipt.data?.claimId!==claim.claimId||receipt.data?.sourceDigest!==claim.sourceDigest||receipt.data?.seedDigest!==claim.seedDigest||receipt.data?.policy!==claim.policy||receipt.data?.status!=='initialized')throw Error('Guest claim receipt unverified');
 const profile=await loadProfile(claim.userId);
 if(!sessionValid()||!profile||!covers?.(JSON.parse(claim.seedRaw),profile))throw Error('Guest claim projection unavailable');
 return {profile,receipt:receipt.data};
}
