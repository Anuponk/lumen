import {alignQuestResets} from './quest-reset.js';
import {preserveRecoverySnapshot} from './cloud-profile.js';
import {archiveRecoveryBackups} from './storage-maintenance.js';

// A verified operator reset may supersede old achievements only after the exact
// device original has a durable, read-back recovery copy. Web Storage quota does
// not imply IndexedDB is full; use the same recovery store as other hydration.
export async function installVerifiedQuestResets(storage,remote,{
 userId,sessionValid=()=>true,preserveSnapshot=preserveRecoverySnapshot,makeRoom=archiveRecoveryBackups
}={}){
 const key='lumenProgressV1',raw=storage.getItem(key);
 const contextValid=()=>!!userId&&sessionValid()&&storage.getItem('lumenCloudOwnerId')===userId;
 const unchanged=()=>contextValid()&&storage.getItem(key)===raw;
 if(!contextValid())throw Error('Quest reset session changed');
 if(raw===null)return false;
 const result=alignQuestResets(JSON.parse(raw),remote);if(!result.changed)return false;
 await preserveSnapshot(storage,'lumenQuestResetArchiveV1:'+userId+':',raw);
 if(!unchanged())throw Error('Quest reset cache or session changed');
 const next=JSON.stringify(result.profile);
 try{storage.setItem(key,next)}catch(error){
  if(error?.name!=='QuotaExceededError'&&![22,1014,'LOCAL_STORAGE_QUOTA'].includes(error?.code))throw error;
  if(!unchanged())throw Error('Quest reset cache or session changed');
  const archived=await makeRoom(storage,{sessionValid:unchanged});
  if(!unchanged()||archived.interrupted)throw Error('Quest reset cache or session changed');
  if(!archived.archived||archived.failed)throw error;
  storage.setItem(key,next);
 }
 if(!contextValid()||storage.getItem(key)!==next)throw Error('Quest reset cache unverified');
 return true;
}
