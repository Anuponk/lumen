import assert from 'node:assert/strict';
import test from 'node:test';
import {reconcilePlayerAcquisitions} from '../src/persistence/cloud-profile.js';

const owner='00000000-0000-0000-0000-000000000001';
const seed=()=>({solved:{},badges:{},shards:3,xp:0});
function fixture(){
 const local={...seed(),solved:{1:1},historicalNote:{uninterpreted:true},shards:12};
 let remote={...seed(),solved:{2:1},walletRevision:4};
 const map=new Map([['lumenProgressV1',JSON.stringify(local)]]),calls=[];
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v))};
 let effects=0,loseReply=false,staleOnce=false,session=true;
 const api={async rpc(name,args){
  calls.push(name);
  if(name==='lumen_restore_profile')return {data:structuredClone(remote)};
  assert.equal(name,'lumen_reconcile_acquisitions');assert.equal(args.p_expected_user_id,owner);
  assert([...map.keys()].some(k=>k.startsWith('lumenBeforeCloudReconcileLocal_')));
  if(staleOnce){staleOnce=false;remote.badges.other=1;return {data:null};}
  const next={...remote,solved:{...remote.solved,...args.p_local.solved}};
  if(JSON.stringify(next)!==JSON.stringify(remote))effects++;
  remote=next;
  if(loseReply){loseReply=false;throw Error('response lost after commit');}
  return {data:{policy:'positive-acquisitions-v1',userId:owner,profile:structuredClone(remote)}};
 }};
 return {api,storage,map,calls,local,get remote(){return remote},get effects(){return effects},
  set loseReply(v){loseReply=v},set staleOnce(v){staleOnce=v},set session(v){session=v},
  recover:()=>reconcilePlayerAcquisitions(api,storage,remote,{userId:owner,sessionValid:()=>session})};
}
test('recovers acquisitions automatically and keeps confirmed spending plus both originals',async()=>{
 const f=fixture(),r=await f.recover();
 assert.equal(r.status,'reconciled');assert.deepEqual(r.profile.solved,{1:1,2:1});
 assert.equal(r.profile.shards,3);assert.equal(r.profile.walletRevision,4);
 assert.equal(JSON.parse(f.storage.getItem('lumenProgressV1')).shards,3);
 assert([...f.map.values()].includes(JSON.stringify(f.local)));
 assert.equal(f.effects,1);
});
test('lost reply, reconnect/token refresh and second device never re-credit a reward',async()=>{
 const f=fixture();f.loseReply=true;await assert.rejects(f.recover(),/response lost/);
 assert.equal(f.storage.getItem('lumenProgressV1'),JSON.stringify(f.local));
 assert.equal((await f.recover()).status,'reconciled');assert.equal(f.effects,1);
 assert.equal((await f.recover()).status,'reconciled');assert.equal(f.effects,1);
 const device=new Map([['lumenProgressV1',JSON.stringify(seed())]]);
 const r=await reconcilePlayerAcquisitions(f.api,{getItem:k=>device.get(k)??null,setItem:(k,v)=>device.set(k,v)},f.remote,{userId:owner});
 assert.deepEqual(r.profile.solved,{1:1,2:1});assert.equal(f.effects,1);
});
test('one CAS race is retried with a fresh expected-account read, with bounded work',async()=>{
 const f=fixture();f.staleOnce=true;
 assert.equal((await f.recover()).status,'reconciled');assert.equal(f.remote.badges.other,1);
 assert.equal(f.calls.filter(n=>n==='lumen_reconcile_acquisitions').length,2);
});
test('session or local changes never install an obsolete response',async()=>{
 for(const change of ['session','local']){
  const f=fixture(),rpc=f.api.rpc;
  f.api.rpc=async(...args)=>{const r=await rpc(...args);if(args[0]==='lumen_reconcile_acquisitions'){
   if(change==='session')f.session=false;else f.storage.setItem('lumenProgressV1',JSON.stringify({...f.local,badges:{new:1}}));
  }return r;};
  const r=await f.recover();assert.equal(r.interrupted,true);
  assert.equal(JSON.parse(f.storage.getItem('lumenProgressV1')).shards,12);
 }
});
test('missing migration, failed backup, mismatched readback and repeated races preserve the cache',async()=>{
 for(const kind of ['missing','backup','readback','race']){
  const f=fixture(),raw=f.storage.getItem('lumenProgressV1'),rpc=f.api.rpc;
  if(kind==='backup')f.storage.setItem=()=>{throw Error('storage unavailable')};
  else f.api.rpc=async(name,args)=>kind==='missing'?{error:{code:'PGRST202'}}:kind==='race'&&name==='lumen_reconcile_acquisitions'?{data:null}:kind==='readback'&&name==='lumen_restore_profile'?{data:seed()}:rpc(name,args);
  if(kind==='missing'||kind==='race')assert.equal((await f.recover()).status,'blocked');
  else await assert.rejects(f.recover());
  assert.equal(f.storage.getItem('lumenProgressV1'),raw);
  assert(f.calls.length<=3);
 }
});
test('same-millisecond retries cannot overwrite a different original snapshot',async()=>{
 const f=fixture(),now=Date.now;Date.now=()=>123456;
 try{
  await f.recover();
  const original=f.local,changed={...f.local,badges:{later:1}};
  f.storage.setItem('lumenProgressV1',JSON.stringify(changed));await f.recover();
  const backups=[...f.map].filter(([key])=>key.startsWith('lumenBeforeCloudReconcileLocal_')).map(([,value])=>value);
  assert(backups.includes(JSON.stringify(original)));assert(backups.includes(JSON.stringify(changed)));
 }finally{Date.now=now;}
});
