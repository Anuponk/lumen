import assert from 'node:assert/strict';

// A blank same-origin fixture isolates real browser quota/IndexedDB from app
// timers. No Auth, RPC, player save or production storage participates.
export async function verifyQuotaRecovery({evaluate,navigate,url}){
 await navigate('Page.navigate',{url:new URL('/scripts/fixtures/storage-quota.html',url).href});
 const result=await evaluate(`(async()=>{
  const {reconcileCloudAchievementsDurably,reconcileCloudAchievements,achievementRecoveryDiagnostic}=await import('/src/persistence/cloud-profile.js');
  localStorage.clear();
  const local={solved:{0:true},badges:{},shards:9,xp:10,daily:{dates:[]},fixturePadding:'x'.repeat(6000)};
  const raw=JSON.stringify(local);localStorage.setItem('lumenProgressV1',raw);
  // Fill this disposable browser origin to its actual Web Storage limit.
  let serial=0;
  for(const size of [131072,8192,1024,128]){
   try{for(let i=0;i<1000;i++)localStorage.setItem('quota-fill-'+serial++,'x'.repeat(size))}catch(error){if(error.name!=='QuotaExceededError')throw error}
  }
  const cloud={...structuredClone(local),solved:{0:true,1:true},shards:3,xp:20};
  let baseline;
  try{reconcileCloudAchievements(localStorage,cloud)}catch(error){baseline=achievementRecoveryDiagnostic(error).reason}
  const recovered=await reconcileCloudAchievementsDurably(localStorage,cloud);
  const installed=JSON.parse(localStorage.getItem('lumenProgressV1'));
  const archive=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('lumenCloudRecoveryV1',1);
   request.onerror=()=>reject(request.error);request.onsuccess=()=>{
    const db=request.result,read=db.transaction('snapshots','readonly').objectStore('snapshots').get(recovered.backupKey.slice('indexeddb:'.length));
    read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=()=>{db.close();reject(read.error)};
   };
  });
  const repeated=await reconcileCloudAchievementsDurably(localStorage,cloud);
  return {baseline,changed:recovered.changed,indexedBackup:recovered.backupKey.startsWith('indexeddb:'),
   originalVerified:archive===raw,solved:installed.solved[1],shards:installed.shards,xp:installed.xp,
   repeated:repeated.changed,paddingPreserved:installed.fixturePadding===local.fixturePadding};
 })()`,true);
 assert.deepEqual(result,{baseline:'storage_quota',changed:true,indexedBackup:true,originalVerified:true,solved:true,shards:9,xp:10,repeated:false,paddingPreserved:true});
 return {actualLocalStorageQuota:true,nativeIndexedDB:true,originalVerified:true,achievementsRecovered:true,unconfirmedBalancesPreserved:true,retryIdempotent:true};
}
