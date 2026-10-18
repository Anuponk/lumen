import assert from 'node:assert/strict';
import {cloudSafelyCoversLocal,reconcileCompatibleCloudProfiles,reconcileDominantLocalProfile,compareAndSwapCloudProfile,installCloudProfileLocally} from '../src/persistence/cloud-profile.js';
import {createLocalPersistence} from '../src/persistence/local.js';
import {exportGuestSave,importGuestSave} from '../src/persistence/guest-transfer.js';
const profile=(origin)=>({solved:{0:1},badges:{earned:1},shards:3,xp:10,skyScore:1,...(origin===undefined?{}:{catalogueOrigin:origin})});
function storage(initial){const values=new Map(initial?[['lumenProgressV1',JSON.stringify(initial)]]:[]);return {get length(){return values.size},key:i=>[...values.keys()][i],getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}}
function server(initial){let current=structuredClone(initial),writes=0;return {get profile(){return current},get writes(){return writes},async rpc(name,args){
 if(name==='lumen_restore_profile')return {data:structuredClone(current)};
 assert.equal(name,'lumen_cas_profile');assert.deepEqual(args.p_expected,current);
 if(current.catalogueOrigin!==undefined)assert.equal(args.p_payload.catalogueOrigin,current.catalogueOrigin,'The server cohort cannot be erased');
 current=structuredClone(args.p_payload);writes++;return {data:true};
}}}
for(const reconcile of [reconcileCompatibleCloudProfiles,reconcileDominantLocalProfile]){
 const remote=profile(2),local=profile();
 local.solved[1]=1;local.historyBackup={0:1,1:1};
 const client=server(remote),store=storage(local);
 const result=await reconcile(client,store,remote);
 assert.equal(result.status,'reconciled');assert.equal(result.profile.catalogueOrigin,2);
 assert.equal(result.profile.solved[1],1);assert.equal(result.profile.xp,10);assert.equal(result.profile.shards,3);
 const contradictory=profile(1),protectedClient=server(remote),contradictoryStorage=storage(contradictory);
 const before=contradictoryStorage.getItem('lumenProgressV1');
 const refused=await reconcile(protectedClient,contradictoryStorage,remote);
 assert.equal(refused.status,'blocked');assert.equal(protectedClient.writes,0);assert.equal(contradictoryStorage.getItem('lumenProgressV1'),before);
}
assert.equal(cloudSafelyCoversLocal(profile(1),profile(2)),false);
assert.equal(cloudSafelyCoversLocal(profile(),profile(2)),true,'An explicit verified server cohort survives an older cache');
assert.equal(cloudSafelyCoversLocal(profile(999),profile(2)),false);
const guest=storage(profile(2)),exported=exportGuestSave(guest),destination=storage();
importGuestSave(destination,exported);
assert.deepEqual(JSON.parse(destination.getItem('lumenProgressV1')),profile(2),'Explicit guest rescue retains the origin unchanged');
const installed=storage();installCloudProfileLocally(installed,profile(2));
assert.equal(createLocalPersistence(installed,()=>null).loadLumenProgress().catalogueOrigin,2);
const future=storage(profile(999));assert.deepEqual(createLocalPersistence(future,()=>null).loadLumenProgress(),{...profile(999),historyBackup:{0:1}},'Unsupported origins retain every fact for an updated client');
const empty={solved:{},badges:{}},emptyClient=server(empty);
await compareAndSwapCloudProfile(emptyClient,{...empty,solved:{0:1}},empty);
assert.equal(emptyClient.profile.catalogueOrigin,2,'An old empty cloud profile is classified before its first victory');
console.log(JSON.stringify({cloudCohort:true,reconciliationModes:2,contradictionsPreserved:true,guestRescue:true,futureOriginPreserved:true}));
