import assert from 'node:assert/strict';
import {initializeCloudProfile,loadVerifiedProfile,compareAndSwapCloudProfile,installCloudProfileLocally} from '../src/persistence/cloud-profile.js';

// Isolated deterministic RPC simulation. No production account or database is touched.
const clone = value => structuredClone(value);
const profile = {
  solved:{0:1,1:1},historyBackup:{0:1,1:1},
  badges:{1:{speed:true}},performances:{1:{bestTime:42,badges:{speed:true}}},
  stars:{1:3},shards:5,xp:12,
  daily:{dates:{'2026-10-11':1},rewards:{}},
  skills:{hint:true},entitlements:{'adventure-2':true}
};
let remote=null;
let writes=0;
let offline=false;
const client={async rpc(method,args={}){
  if(offline)return {data:null,error:{message:'network unavailable'}};
  if(method==='lumen_initialize_profile'){
    remote ??= clone(args.p_payload);
    return {data:clone(remote),error:null};
  }
  if(method==='lumen_restore_profile')return {data:clone(remote),error:null};
  if(method==='lumen_cas_profile'){
    if(JSON.stringify(remote)!==JSON.stringify(args.p_expected))return {data:false,error:null};
    remote=clone(args.p_payload);writes++;return {data:true,error:null};
  }
  throw Error('Unexpected RPC '+method);
}};
const storage=()=>{
  const values=new Map();
  return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
};
const original=await initializeCloudProfile(client,profile);
assert.deepEqual(original,profile,'First sign-in persists the entire player snapshot');
const deviceB=storage();
assert.equal(installCloudProfileLocally(deviceB,await loadVerifiedProfile(client)),true);
assert.deepEqual(JSON.parse(deviceB.getItem('lumenProgressV1')),profile,'Second device restores every saved field');
const updated=clone(profile);
updated.solved[2]=1;updated.historyBackup[2]=1;
updated.badges[2]={mastery:true};
updated.performances[2]={bestTime:38,badges:{mastery:true}};
updated.stars[2]=2;updated.shards=3;updated.xp=20;
const committed=await compareAndSwapCloudProfile(client,updated,original);
assert.deepEqual(committed,updated,'Acknowledged update preserves complete snapshot');
assert.equal(writes,1);
await assert.rejects(
  ()=>compareAndSwapCloudProfile(client,{...profile,shards:99},original),
  /conflit|modifi|stale|simultan|refus|sauvegarde/i,
  'Stale device must not overwrite newer rewards or a valid shard spend'
);
assert.equal(writes,1,'Rejected concurrent write must not mutate server');
assert.deepEqual(await loadVerifiedProfile(client),updated);
const reinstalled=storage();
installCloudProfileLocally(reinstalled,await loadVerifiedProfile(client));
assert.deepEqual(JSON.parse(reinstalled.getItem('lumenProgressV1')),updated,'Reinstall restores all acknowledged data');
const staleCache=storage();
staleCache.setItem('lumenProgressV1',JSON.stringify(profile));
installCloudProfileLocally(staleCache,await loadVerifiedProfile(client));
assert.deepEqual(JSON.parse(staleCache.getItem('lumenProgressV1')),updated,'Old local cache cannot roll back cloud');
offline=true;
await assert.rejects(()=>compareAndSwapCloudProfile(client,{...updated,xp:21},updated));
offline=false;
assert.deepEqual(await loadVerifiedProfile(client),updated,'Failed network write is not falsely committed');
await compareAndSwapCloudProfile(client,{...updated,xp:21},updated);
assert.equal(writes,2,'Retry after network recovery commits once');
assert.equal((await loadVerifiedProfile(client)).xp,21);
console.log('Cloud regression matrix: device restore, reinstall, stale cache, CAS conflict, spend, offline retry passed');
