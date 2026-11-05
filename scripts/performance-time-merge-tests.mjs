import assert from 'node:assert/strict';
import {reconcileCompatibleCloudProfiles,sameCloudProfile} from '../src/persistence/cloud-profile.js';
async function merge(localRecord,remoteRecord,{conflictingReward=false}={}){
 const base={solved:{0:1},badges:{},stars:{},performances:{},canonicalQuestState:{},shards:5,xp:7,skyScore:2,daily:{},challenges:{}};
 const local={...structuredClone(base),performances:{0:localRecord},...(conflictingReward?{stars:{bonus:2}}:{})};
 let remote={...structuredClone(base),performances:{0:remoteRecord},...(conflictingReward?{stars:{bonus:1}}:{})},writes=0;
 const values=new Map([['lumenProgressV1',JSON.stringify(local)]]),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};
 const api={async rpc(name,args){
  if(name==='lumen_restore_profile')return {data:structuredClone(remote)};
  if(name==='lumen_cas_profile'){assert(sameCloudProfile(remote,args.p_expected));remote=structuredClone(args.p_payload);writes++;return {data:true}}
  throw Error(name);
 }};
 const result=await reconcileCompatibleCloudProfiles(api,storage,remote);
 return {result,remote,writes};
}
for(const [local,remote] of [[80,120],[0,30],[12.5,19.75]]){
 const merged=await merge({bestTime:local,time:local,bestUnassistedTime:remote},{bestTime:remote,time:remote,bestUnassistedTime:local});
 assert.equal(merged.result.status,'reconciled');assert.equal(merged.writes,1);
 assert.deepEqual(merged.remote.performances[0],{bestTime:local,time:local,bestUnassistedTime:local});
 assert.equal(merged.remote.shards,5);assert.equal(merged.remote.xp,7);
}
for(const invalid of [-1,'2',null,Number.NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
 const merged=await merge({time:invalid},{time:10});
 assert.equal(merged.result.reason,'reward_conflict');assert.equal(merged.writes,0,'Invalid elapsed times never authorize a profile write');
}
const blocked=await merge({time:5},{time:10},{conflictingReward:true});
assert.equal(blocked.result.reason,'reward_conflict');assert.equal(blocked.writes,0,'A valid faster time does not resolve a reward conflict');
console.log('PASS real performance reconciliation: independent finite minima including zero/fractions, invalid values refused, reward conflicts preserved');
