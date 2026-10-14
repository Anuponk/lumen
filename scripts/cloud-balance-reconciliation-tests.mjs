import assert from 'node:assert/strict';
import {reconcileCompatibleCloudProfiles} from '../src/persistence/cloud-profile.js';
import fs from 'node:fs';
const cloud={solved:{1:true},badges:{},stars:{},performances:{},historyBackup:{},noHint:{},canonicalQuestState:{},daily:{dates:{a:true}},challenges:{},shards:5,xp:20,skyScore:1};
const local={...cloud,shards:8,xp:25,daily:{dates:{a:true,b:true}}};
const values=new Map([['lumenProgressV1',JSON.stringify(local)]]);
const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v))};
let remote=structuredClone(cloud);
const client={rpc:async(name,args)=>{
 if(name==='lumen_cas_profile'){
  assert.deepEqual(args.p_expected,remote);
  remote=structuredClone(args.p_payload);
  return {data:true,error:null};
 }
 if(name==='lumen_restore_profile')return {data:remote,error:null};
 throw Error(name);
}};
const result=await reconcileCompatibleCloudProfiles(client,storage,cloud);
assert.equal(result.status,'reconciled');
assert.equal(result.profile.shards,8);
assert.equal(result.profile.xp,25);
assert.equal(result.profile.daily.dates.b,true);
assert.ok([...values.keys()].some(k=>k.startsWith('lumenBeforeCloudReconcileLocal_')));
const conflict={...cloud,daily:{dates:{a:false}}};
values.set('lumenProgressV1',JSON.stringify(conflict));
const blocked=await reconcileCompatibleCloudProfiles(client,storage,cloud);
assert.equal(blocked.status,'blocked');
assert.equal(blocked.reason,'mutable_ledger');
const screen=fs.readFileSync(new URL('../src/ui/game-screen.js',import.meta.url),'utf8');
assert.match(screen,/"mutable_balance","mutable_ledger"/);
console.log('Cloud balance reconciliation and conflicting ledger guard passed');
