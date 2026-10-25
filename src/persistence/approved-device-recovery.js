import {cloudSafelyCoversLocal,loadVerifiedProfile,preserveRecoverySnapshot,sameCloudProfile} from './cloud-profile.js';

const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
export async function recoveryProfileDigest(profile){
 const bytes=new TextEncoder().encode(JSON.stringify(sorted(profile)));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

// A reviewed file is an explicit device-side choice, never server authority.
// It grants no rewards and cannot upload a profile. Both exact snapshots and
// the authenticated owner must match; all unrelated pending stores stay intact.
export async function applyApprovedDeviceRecovery(plan,{storage,client,userId,sessionValid=()=>true,now=Date.now(),preserveSnapshot=preserveRecoverySnapshot}){
 const fail=()=>{throw Error('Récupération suspendue : le compte ou la sauvegarde a changé.')};
 if(!plan||plan.app!=='Lumen'||plan.format!=='approved-device-recovery-v1'||plan.choice!=='verified-cloud-wallet'||
  typeof userId!=='string'||!userId||plan.userId!==userId||
  !/^[a-f0-9]{64}$/.test(plan.localDigest)||!/^[a-f0-9]{64}$/.test(plan.cloudDigest)||
  !Number.isFinite(Date.parse(plan.expiresAt))||Date.parse(plan.expiresAt)<=now)fail();
 const raw=storage.getItem('lumenProgressV1');
 const valid=()=>sessionValid()&&storage.getItem('lumenCloudOwnerId')===userId&&storage.getItem('lumenProgressV1')===raw;
 if(!raw||!valid())fail();
 let local;try{local=JSON.parse(raw)}catch{fail()}
 const localDigest=await recoveryProfileDigest(local);if(!valid()||localDigest!==plan.localDigest)fail();
 const remote=await loadVerifiedProfile(client,{userId});if(!valid()||!remote)fail();
 const remoteDigest=await recoveryProfileDigest(remote);if(!valid()||remoteDigest!==plan.cloudDigest)fail();
 if(!Number.isSafeInteger(remote.walletRevision)||remote.walletRevision<1||!Number.isSafeInteger(remote.shards)||remote.shards<0||
  !cloudSafelyCoversLocal({...local,shards:remote.shards,walletRevision:remote.walletRevision,legacyVictoryRevision:remote.legacyVictoryRevision},remote))fail();
 for(const [side,value] of [['Local',raw],['Remote',JSON.stringify(remote)]]){
  await preserveSnapshot(storage,'lumenBeforeCloudApprovedRecovery'+side+'_',value);
  if(!valid())fail();
 }
 const latest=await loadVerifiedProfile(client,{userId});
 if(!valid()||!sameCloudProfile(latest,remote))fail();
 const saved=JSON.stringify(remote);
 try{
  storage.setItem('lumenProgressV1',saved);
  if(storage.getItem('lumenProgressV1')!==saved)throw Error('Installation non vérifiée');
 }catch(error){
  // Originals are already verified in the exportable recovery store.
  if(storage.getItem('lumenProgressV1')===saved)storage.setItem('lumenProgressV1',raw);
  throw error;
 }
 return {changed:true};
}
