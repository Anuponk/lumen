import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cloudSafelyCoversLocal,reconcileCompatibleCloudProfiles} from '../src/persistence/cloud-profile.js';
const base={solved:{},badges:{},stars:{},performances:{},canonicalQuestState:{},daily:{dates:{},rewards:{}},shards:10,xp:0,skyScore:0};
test('an unreceipted balance difference is preserved for review, never max merged',async()=>{
 for(const [localBalance,remoteBalance] of [[10,6],[6,10]]){
  const local={...base,shards:localBalance},remote={...base,shards:remoteBalance},values=new Map([['lumenProgressV1',JSON.stringify(local)]]);
  let writes=0,server=remote;const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const client={rpc:async(name,args)=>{if(name==='lumen_cas_profile'){writes++;server=args.p_payload;return {data:true}}return {data:server}}};
  assert.equal(cloudSafelyCoversLocal(local,remote),false);
  const result=await reconcileCompatibleCloudProfiles(client,storage,remote);
  assert.equal(result.status,'blocked');assert.equal(result.reason,'mutable_balance');assert.equal(writes,0);
  assert.equal(storage.getItem('lumenProgressV1'),JSON.stringify(local));
  assert.equal([...values.keys()].filter(k=>k.startsWith('lumenBeforeCloudReconcile')).length,2);
 }
});
test('a newer server wallet cursor preserves a legitimate spend across stale cache',()=>{
 const local={...base,walletRevision:1},remote={...base,shards:6,walletRevision:2};
 assert.equal(cloudSafelyCoversLocal(local,remote),true);
 assert.equal(cloudSafelyCoversLocal(remote,local),false);
 assert.equal(cloudSafelyCoversLocal({...local,walletRevision:2},remote),false,'Same revision with another balance is not a receipt');
 assert.equal(cloudSafelyCoversLocal({...local,walletRevision:'2'},remote),false);
});
