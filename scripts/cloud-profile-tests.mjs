import assert from 'node:assert/strict';
import {backupAndVerifyProfile,loadVerifiedProfile,validateCloudProfile} from '../src/persistence/cloud-profile.js';
const source={solved:{0:1,1:1},historyBackup:{0:1,1:1},badges:{0:{speed:true}},stars:{0:3},shards:7,daily:{dates:{"2026-10-09":1}},performances:{1:{bestTime:44}},xp:13};
let saved=null;
const fake={async rpc(method,args){
  if(method==='lumen_backup_profile'){saved=structuredClone(args.p_payload);return {error:null}}
  if(method==='lumen_restore_profile')return {data:saved,error:null};
  throw Error('Unexpected RPC: '+method)
}};
assert.equal((await backupAndVerifyProfile(fake,source)).solved,2);
assert.deepEqual(await loadVerifiedProfile(fake),source);
assert.throws(()=>validateCloudProfile({solved:{}}),/Badges/);
await assert.rejects(()=>backupAndVerifyProfile({rpc:async()=>({error:{message:'network'}})},source),/refusée/);
await assert.rejects(()=>backupAndVerifyProfile({rpc:async method=>method==='lumen_backup_profile'?{error:null}:{data:{solved:{},badges:{}},error:null}},source),/non vérifiée/);
assert.equal(source.shards,7,'Local original untouched');
console.log('Cloud profile backup validation and read-back tests passed');
