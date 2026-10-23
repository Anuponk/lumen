import assert from 'node:assert/strict';

// A blank same-origin fixture isolates real browser quota/IndexedDB from app
// timers. No Auth, RPC, player save or production storage participates.
export async function verifyQuotaRecovery({evaluate,navigate,url}){
 await navigate('Page.navigate',{url:new URL('/scripts/fixtures/storage-quota.html',url).href});
 const result=await evaluate(`(async()=>{
  const {reconcileCloudAchievementsDurably,reconcileCloudAchievements,achievementRecoveryDiagnostic}=await import('/src/persistence/cloud-profile.js');
  const {archiveRecoveryBackups}=await import('/src/persistence/storage-maintenance.js');
  localStorage.clear();
  const local={solved:{0:true},badges:{},shards:9,xp:10,daily:{dates:[]},fixturePadding:'x'.repeat(6000)};
  const raw=JSON.stringify(local);localStorage.setItem('lumenProgressV1',raw);
  for(const stamp of [9001,9002,9003])localStorage.setItem('lumenBeforeCloudRestore_'+stamp,'retained-original'.repeat(256));
  // Fill this disposable browser origin to its actual Web Storage limit.
  let serial=0;
  for(const size of [131072,8192,1024,128]){
   try{for(let i=0;i<1000;i++)localStorage.setItem('quota-fill-'+serial++,'x'.repeat(size))}catch(error){if(error.name!=='QuotaExceededError')throw error}
  }
  const cloud={...structuredClone(local),solved:Object.fromEntries(Array.from({length:40},(_,i)=>[i,true])),shards:3,xp:20};
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
  const {recoverWalletCache,recoverWalletCacheDurably}=await import('/src/persistence/wallet-command.js');
  const walletLocal={...installed,fixturePadding:installed.fixturePadding.slice(512),walletRevision:1};
  const walletRemote={...walletLocal,shards:8,walletRevision:2};
  const walletRaw=JSON.stringify(walletLocal),walletSaved=JSON.stringify(walletRemote);
  localStorage.setItem('lumenCloudOwnerId','quota-wallet-fixture');
  localStorage.setItem('lumenProgressV1',walletRaw);
  for(const size of [8192,1024,128]){
   try{for(let i=0;i<1000;i++)localStorage.setItem('quota-fill-'+serial++,'x'.repeat(size))}catch(error){if(error.name!=='QuotaExceededError')throw error}
  }
  const receipt={version:1,operationId:'quota-wallet-receipt',request:{kind:'hint'},revision:2,balance:8,balanceDelta:-1};
  let walletBaseline;
  try{recoverWalletCache(localStorage,walletRemote,receipt,{userId:'quota-wallet-fixture'})}catch(error){walletBaseline=error.name}
  const walletRecovered=await recoverWalletCacheDurably(localStorage,walletRemote,receipt,{userId:'quota-wallet-fixture'});
  const walletOriginals=await new Promise((resolve,reject)=>{
   const request=indexedDB.open('lumenCloudRecoveryV1',1);
   request.onerror=()=>reject(request.error);request.onsuccess=()=>{
    const db=request.result,read=db.transaction('snapshots','readonly').objectStore('snapshots').getAll();
    read.onsuccess=()=>{db.close();resolve(read.result)};read.onerror=()=>{db.close();reject(read.error)};
   };
  });
  if(walletBaseline!=='QuotaExceededError'||!walletRecovered||localStorage.getItem('lumenProgressV1')!==walletSaved||!walletOriginals.includes(walletRaw)||!walletOriginals.includes(walletSaved))throw Error('Wallet native quota recovery did not preserve both originals');
  if(await recoverWalletCacheDurably(localStorage,walletRemote,receipt,{userId:'quota-wallet-fixture'}))throw Error('Wallet recovery not idempotent');
  const beforeMaintenance=localStorage.getItem('lumenProgressV1');
  const maintenance=await archiveRecoveryBackups(localStorage);
  if(maintenance.archived!==0||maintenance.failed||localStorage.getItem('lumenBeforeCloudRestore_9001')!==null||localStorage.getItem('lumenProgressV1')!==beforeMaintenance||!walletOriginals.includes('retained-original'.repeat(256)))throw Error('Quota maintenance did not preserve recovery evidence');
  return {baseline,changed:recovered.changed,indexedBackup:recovered.backupKey.startsWith('indexeddb:'),
   originalVerified:archive===raw,solved:installed.solved[1],shards:installed.shards,xp:installed.xp,
   repeated:repeated.changed,paddingPreserved:installed.fixturePadding===local.fixturePadding};
 })()`,true);
 assert.deepEqual(result,{baseline:'storage_quota',changed:true,indexedBackup:true,originalVerified:true,solved:true,shards:9,xp:10,repeated:false,paddingPreserved:true});
 return {actualLocalStorageQuota:true,nativeIndexedDB:true,originalVerified:true,achievementsRecovered:true,unconfirmedBalancesPreserved:true,retryIdempotent:true,verifiedArchivalFreesLocalSpace:true,walletReceiptRecovery:true,walletBothOriginalsVerified:true};
}
