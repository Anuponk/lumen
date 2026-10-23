import assert from 'node:assert/strict';
import {test} from 'node:test';
import {applyApprovedDeviceRecovery,recoveryProfileDigest} from '../src/persistence/approved-device-recovery.js';
import {restoreRicherCloudProfile} from '../src/persistence/cloud-profile.js';
const local={solved:{0:1},badges:{first:1},stars:{},performances:{},shards:4,xp:1,skyScore:0};
const remote={...local,shards:3,walletRevision:2,legacyVictoryRevision:1};
async function fixture(){
 const map=new Map([['lumenProgressV1',JSON.stringify(local)],['lumenCloudOwnerId','owner'],['unrelated-pending','retained']]);
 const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};
 let current=remote,reads=0;
 const client={rpc:async(name,args)=>{assert.equal(name,'lumen_restore_profile');assert.equal(args.p_expected_user_id,'owner');reads++;return {data:structuredClone(current)}}};
 const plan={app:'Lumen',format:'approved-device-recovery-v1',choice:'verified-cloud-wallet',userId:'owner',localDigest:await recoveryProfileDigest(local),cloudDigest:await recoveryProfileDigest(remote),expiresAt:'2099-01-01T00:00:00Z'};
 const options={storage,client,userId:'owner',preserveSnapshot:async(s,k,v)=>{s.setItem(k,v);assert.equal(s.getItem(k),v)}};
 return {map,plan,options,setCloud:v=>current=v,reads:()=>reads};
}
test('reviewed currency choice restores exact server profile with backups and pending work retained',async()=>{
 const f=await fixture();assert.throws(()=>restoreRicherCloudProfile(f.options.storage,remote),/divergent/);
 assert.deepEqual(await applyApprovedDeviceRecovery(f.plan,f.options),{changed:true});
 assert.deepEqual(JSON.parse(f.map.get('lumenProgressV1')),remote);
 assert.equal(f.map.get('unrelated-pending'),'retained');assert.equal(f.reads(),2);
 assert.equal(f.map.get('lumenBeforeApprovedRecoveryLocal_'),JSON.stringify(local));
 assert.equal(f.map.get('lumenBeforeApprovedRecoveryRemote_'),JSON.stringify(remote));
});
test('missing, expired or modified review and a different owner never install',async()=>{
 for(const change of [p=>({...p,format:'unknown'}),p=>({...p,userId:'other'}),p=>({...p,expiresAt:'2000-01-01'}),p=>({...p,localDigest:'a'.repeat(64)}),p=>({...p,cloudDigest:'a'.repeat(64)})]){
  const f=await fixture();await assert.rejects(applyApprovedDeviceRecovery(change(f.plan),f.options));assert.equal(f.map.get('lumenProgressV1'),JSON.stringify(local));
 }
});
test('matching review cannot remove any local acquisition',async()=>{
 const f=await fixture(),missing={...remote,solved:{}};f.setCloud(missing);f.plan.cloudDigest=await recoveryProfileDigest(missing);
 await assert.rejects(applyApprovedDeviceRecovery(f.plan,f.options));assert.equal(f.map.get('lumenProgressV1'),JSON.stringify(local));
});
test('account switch, changed local bytes and failed archival hold installation',async()=>{
 for(const action of ['owner','local','quota']){
  const f=await fixture();f.options.preserveSnapshot=async()=>{
   if(action==='owner')f.map.set('lumenCloudOwnerId','other');
   if(action==='local')f.map.set('lumenProgressV1',JSON.stringify({...local,xp:2}));
   if(action==='quota')throw Error('Quota');
  };
  await assert.rejects(applyApprovedDeviceRecovery(f.plan,f.options));
  assert.notEqual(f.map.get('lumenProgressV1'),JSON.stringify(remote));assert.equal(f.map.get('unrelated-pending'),'retained');
 }
});
test('cloud changes after archival and session cancellation retain local snapshot',async()=>{
 for(const action of ['cloud','session']){
  const f=await fixture();let valid=true;f.options.sessionValid=()=>valid;
  f.options.preserveSnapshot=async()=>{if(action==='cloud')f.setCloud({...remote,walletRevision:3,shards:2});else valid=false};
  await assert.rejects(applyApprovedDeviceRecovery(f.plan,f.options));assert.equal(f.map.get('lumenProgressV1'),JSON.stringify(local));
 }
});
