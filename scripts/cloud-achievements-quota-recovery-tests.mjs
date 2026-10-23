import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as profiles from '../src/persistence/cloud-profile.js';

const recover=profiles.reconcileCloudAchievementsDurably;
const key='lumenProgressV1';
const local={solved:{0:true},badges:{},performances:{},canonicalQuestState:{},shards:9,xp:10,daily:{dates:[]}};
const remote={...structuredClone(local),solved:{0:true,1:true},shards:3,xp:20};
const quota=()=>Object.assign(Error('full'),{name:'QuotaExceededError'});
function fixture({installFull=false,indexedFault,onRead=()=>{}}={}){
 const original=JSON.stringify(local),values=new Map([[key,original],['unrelated','keep']]),archives=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){
  if(k.startsWith('lumenBeforeCloudReconcile_')||installFull)throw quota();
  values.set(k,String(v));
 },key:i=>[...values.keys()][i]??null,get length(){return values.size}};
 const indexedDB={open(){
  const request={};
  queueMicrotask(()=>{
   if(indexedFault==='open'){request.error=quota();request.onerror();return}
   request.result={objectStoreNames:{contains:()=>true},close(){},transaction(_name,mode){
    const tx={objectStore:()=>({put(value,k){queueMicrotask(()=>{
     if(indexedFault==='write'){tx.error=quota();tx.onabort();return}
     archives.set(k,value);tx.oncomplete();
    })},get(k){const read={};queueMicrotask(()=>{
     onRead();read.result=indexedFault==='read'?'wrong':archives.get(k);read.onsuccess();
    });return read}})};return tx;
   }};request.onsuccess();
  });return request;
 }};
 return {storage,values,archives,indexedDB,original};
}
async function usingIndexed(f,run){
 const previous=globalThis.indexedDB;globalThis.indexedDB=f.indexedDB;
 try{return await run()}finally{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous}
}
test('backup-only quota recovers verified achievements without losing local balances or any original',async()=>{
 const f=fixture();
 await usingIndexed(f,async()=>{
  const result=await recover(f.storage,remote);
  assert.equal(result.changed,true);assert.match(result.backupKey,/^indexeddb:/);
  assert.ok([...f.archives.values()].includes(f.original));
  const installed=JSON.parse(f.values.get(key));
  assert.equal(installed.solved[1],true);assert.equal(installed.shards,9);assert.equal(installed.xp,10);
  assert.deepEqual(installed.daily,local.daily);assert.equal(f.values.get('unrelated'),'keep');
  const count=f.archives.size;
  assert.equal((await recover(f.storage,remote)).changed,false);
  assert.equal(f.archives.size,count,'Restart/retry creates no duplicate backup or reward');
 });
});
for(const fault of ['open','write','read'])test(`failed IndexedDB ${fault} preserves local bytes and holds recovery`,async()=>{
 const f=fixture({indexedFault:fault});
 await usingIndexed(f,()=>assert.rejects(()=>recover(f.storage,remote)));
 assert.equal(f.values.get(key),f.original);
});
test('installation quota preserves the original and verified archive',async()=>{
 const f=fixture({installFull:true});
 await usingIndexed(f,()=>assert.rejects(()=>recover(f.storage,remote),e=>profiles.achievementRecoveryDiagnostic(e).reason==='storage_quota'));
 assert.equal(f.values.get(key),f.original);assert.ok([...f.archives.values()].includes(f.original));
});
for(const change of ['session','local','owner'])test(`${change} change during archive verification cancels installation`,async()=>{
 let valid=true;
 const f=fixture({onRead(){if(change==='session')valid=false;else if(change==='owner')f.values.set('lumenCloudOwnerId','new-owner');else f.values.set(key,'newer-local-copy')}});
 await usingIndexed(f,async()=>{
  const result=await recover(f.storage,remote,{sessionValid:()=>valid});
  assert.equal(result.changed,false);assert.equal(result.interrupted,true);
 });
 assert.equal(f.values.get(key),change==='local'?'newer-local-copy':f.original);
});
test('immutable reward conflict is never retried as quota recovery',async()=>{
 const f=fixture();
 const reward={solved:true,stars:1,performance:{seconds:40},badges:{autonomy:true}};
 f.values.set(key,JSON.stringify({...local,canonicalQuestState:{example:reward}}));
 const before=f.values.get(key);
 await usingIndexed(f,()=>assert.rejects(()=>recover(f.storage,{...remote,canonicalQuestState:{example:{...reward,stars:2}}}),e=>e.code==='CANONICAL_REWARD_CONFLICT'));
 assert.equal(f.values.get(key),before);assert.equal(f.archives.size,0);
});
test('without fallback storage, quota remains a fixed storage hold',async()=>{
 const f=fixture();f.indexedDB=undefined;
 await usingIndexed(f,()=>assert.rejects(()=>recover(f.storage,remote),e=>profiles.achievementRecoveryDiagnostic(e).reason==='storage_quota'));
 assert.equal(f.values.get(key),f.original);
});
test('a silently refused backup cannot authorize installation',async()=>{
 const f=fixture();const write=f.storage.setItem;
 f.storage.setItem=(k,v)=>{if(!k.startsWith('lumenBeforeCloudReconcile_'))write(k,v)};
 await usingIndexed(f,()=>assert.rejects(()=>recover(f.storage,remote),e=>profiles.achievementRecoveryDiagnostic(e).reason==='backup_unverified'));
 assert.equal(f.values.get(key),f.original);assert.equal(f.archives.size,0);
});
test('a silently refused install rolls back and leaves the original archived',async()=>{
 const f=fixture();
 // Only the full backup is too large; the browser silently ignores the cache write.
 f.storage.setItem=(k)=>{if(k.startsWith('lumenBeforeCloudReconcile_'))throw quota()};
 await usingIndexed(f,()=>assert.rejects(()=>recover(f.storage,remote),e=>profiles.achievementRecoveryDiagnostic(e).reason==='local_install_unverified'));
 assert.equal(f.values.get(key),f.original);assert.ok([...f.archives.values()].includes(f.original));
});
