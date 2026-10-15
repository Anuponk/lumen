import assert from 'node:assert/strict';
import {reconcileCompatibleCloudProfiles,installCloudProfileLocally} from '../src/persistence/cloud-profile.js';
const base={solved:{1:true},historyBackup:{},badges:{},stars:{},noHint:{},performances:{},canonicalQuestState:{},daily:{},challenges:{},xp:10,shards:3,skyScore:1};
const clone=x=>structuredClone(x);
async function scenario(local,cloud,{failCAS=false}={}){
 const state=new Map([['lumenProgressV1',JSON.stringify(local)]]);
 const storage={getItem:k=>state.get(k)??null,setItem:(k,v)=>state.set(k,String(v))};
 let server=clone(cloud),writes=0;
 const supabase={rpc:async(name,args)=>{
  if(name==='lumen_restore_profile')return {data:clone(server),error:null};
  if(name==='lumen_cas_profile'){
   writes++;
   if(failCAS)return {data:false,error:null};
   assert.deepEqual(args.p_expected,server);
   server=clone(args.p_payload);return {data:true,error:null};
  }
  throw Error(name);
 }};
 const before=storage.getItem('lumenProgressV1');
 const result=await reconcileCompatibleCloudProfiles(supabase,storage,cloud).catch(error=>({status:'error',error}));
 assert.equal(storage.getItem('lumenProgressV1'),before,'Local original must remain unchanged');
 return {result,server,writes,state};
}
for(const [name,local,cloud,expected] of [
 ['identical',base,base,'cloud_dominant'],
 ['higher local currency',{...base,shards:9},base,'reconciled'],
 ['higher remote xp',base,{...base,xp:99},'cloud_dominant'],
 ['disjoint quest achievements',{...base,solved:{1:true,2:true}},base,'reconciled'],
 ['disjoint daily dates',{...base,daily:{dates:{a:true}}},{...base,daily:{dates:{b:true}}},'reconciled'],
 ['claimed reward',{...base,daily:{claimed:true}},{...base,daily:{claimed:false}},'reconciled'],
 ['ambiguous spending',{...base,daily:{shardsSpent:2}},{...base,daily:{shardsSpent:3}},'blocked'],
 ['legacy grants local only',{...base,legacyAdventureAccess:['real-adventure-02']},base,'reconciled'],
 ['legacy grants cloud only',base,{...base,legacyAdventureAccess:['real-adventure-03']},'cloud_dominant'],
 ['legacy grants disjoint',{...base,legacyAdventureAccess:['real-adventure-02']},{...base,legacyAdventureAccess:['real-adventure-03']},'reconciled'],
 ['legacy grants duplicate',{...base,legacyAdventureAccess:['real-adventure-02','real-adventure-02']},{...base,legacyAdventureAccess:['real-adventure-02']},'cloud_dominant'],
 ['legacy grants malformed',{...base,legacyAdventureAccess:'real-adventure-02'},base,'blocked'],
 ['unclassified field',{...base,unknown:1},{...base,unknown:2},'blocked'],
 ['conflicting canonical reward',{...base,canonicalQuestState:{q:{solved:true,xp:2}}},{...base,canonicalQuestState:{q:{solved:true,xp:3}}},'blocked']
 ]){
  const {result,server,writes}=await scenario(local,cloud);
  assert.equal(result.status,expected,name);
  if(expected==='blocked')assert.equal(writes,0,name+' must not overwrite cloud');
  if(expected==='reconciled')assert.ok(server.shards>=Math.max(local.shards,cloud.shards),name);
  if(name==='legacy grants disjoint')assert.deepEqual(new Set(server.legacyAdventureAccess),new Set(['real-adventure-02','real-adventure-03']));
}
const failed=await scenario({...base,xp:20},base,{failCAS:true});
assert.equal(failed.result.status,'error');
assert.deepEqual(failed.server,base,'CAS failure must not overwrite cloud');
const map=new Map([['lumenProgressV1',JSON.stringify({...base,solved:{1:true,2:true}})]]);
const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v))};
assert.throws(()=>installCloudProfileLocally(storage,base),/divergent/);
console.log('Cloud reconciliation matrix: 16 data preservation and fault scenarios passed');
