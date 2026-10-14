import assert from 'node:assert/strict';
import {mergeAutonomousWins,reconcileCompatibleCloudProfiles,sameCloudProfile,cloudSafelyCoversLocal} from '../src/persistence/cloud-profile.js';
const base={solved:{0:1},historyBackup:{0:1},badges:{},stars:{},performances:{},canonicalQuestState:{},shards:5,xp:7,skyScore:2,daily:{},challenges:{}};
for(const [local,cloud,expected] of [[3,5,5],[8,2,8],[{1:true,2:false},{2:true,3:true},{1:true,2:true,3:true}],[{1:2},{1:4,2:3},{1:4,2:3}]]){
 const result=mergeAutonomousWins(local,cloud);
 assert.equal(result.ok,true);assert.deepEqual(result.value,expected);
}
for(const [local,cloud] of [[['a'],['b']],[{a:'x'},{a:'y'}],[{a:1},{a:false}],[-1,2]])assert.equal(mergeAutonomousWins(local,cloud).ok,false);
assert.equal(cloudSafelyCoversLocal({...base,autonomousWins:8},{...base,autonomousWins:2}),false);
assert.equal(cloudSafelyCoversLocal({...base,autonomousWins:2},{...base,autonomousWins:8}),true);
const local={...structuredClone(base),solved:{0:1,1:1},autonomousWins:{1:true,2:true}};
let remote={...structuredClone(base),solved:{0:1,2:1},autonomousWins:{2:false,3:true}},writes=0;
const map=new Map([['lumenProgressV1',JSON.stringify(local)]]);
const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),get length(){return map.size},key:i=>[...map.keys()][i]};
const api={async rpc(name,args){if(name==='lumen_cas_profile'){if(!sameCloudProfile(remote,args.p_expected))return {data:false,error:null};remote=structuredClone(args.p_payload);writes++;return {data:true,error:null}}if(name==='lumen_restore_profile')return {data:structuredClone(remote),error:null};throw Error(name)}};
const result=await reconcileCompatibleCloudProfiles(api,storage,remote);
assert.equal(result.status,'reconciled');assert.deepEqual(remote.autonomousWins,{1:true,2:true,3:true});assert.equal(writes,1);
assert.equal(map.get('lumenProgressV1'),JSON.stringify(local));
assert([...map.keys()].some(k=>k.startsWith('lumenBeforeCloudReconcileLocal_')));
assert([...map.keys()].some(k=>k.startsWith('lumenBeforeCloudReconcileRemote_')));
const unknown={...local,autonomousWins:{1:'unknown'}};
map.set('lumenProgressV1',JSON.stringify(unknown));
assert.deepEqual((await reconcileCompatibleCloudProfiles(api,storage,remote)).fields,['autonomousWins']);
assert.equal(writes,1);
console.log('Autonomous wins cloud recovery passed');
