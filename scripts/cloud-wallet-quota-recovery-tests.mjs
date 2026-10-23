import assert from 'node:assert/strict';
import test from 'node:test';
import * as wallet from '../src/persistence/wallet-command.js';

const owner='wallet-quota-fixture',key='lumenProgressV1';
const local={solved:{0:true},badges:{},shards:10,walletRevision:1};
const remote={...local,shards:9,walletRevision:2};
const receipt={version:1,operationId:'fixture-spend',request:{kind:'hint'},revision:2,balance:9,balanceDelta:-1};
const quota=()=>Object.assign(Error('fixture full'),{name:'QuotaExceededError'});
function fixture({fault,onRead=()=>{}}={}){
 const original=JSON.stringify(local),values=new Map([[key,original],['lumenCloudOwnerId',owner]]),archives=new Map();
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){
  if(k.startsWith('lumenBeforeWalletRecovery')||(k===key&&fault==='install'))throw quota();
  values.set(k,String(v));
 },key:i=>[...values.keys()][i]??null,get length(){return values.size}};
 const indexedDB={open(){const request={};queueMicrotask(()=>{
  if(fault==='open'){request.error=quota();request.onerror();return}
  request.result={objectStoreNames:{contains:()=>true},close(){},transaction(){
   const tx={objectStore:()=>({put(value,k){queueMicrotask(()=>{
    if(fault==='write'){tx.error=quota();tx.onabort();return}
    archives.set(k,value);tx.oncomplete();
   })},get(k){const read={};queueMicrotask(()=>{onRead();read.result=fault==='read'?'invalid':archives.get(k);read.onsuccess()});return read}})};return tx;
  }};request.onsuccess();
 });return request}};
 return {storage,values,archives,indexedDB,original};
}
async function usingIndexed(f,run){
 const previous=globalThis.indexedDB;globalThis.indexedDB=f.indexedDB;
 try{return await run()}finally{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous}
}
const recover=async(f,options={})=>(wallet.recoverWalletCacheDurably||wallet.recoverWalletCache)(f.storage,remote,receipt,{userId:owner,...options});

test('wallet backup-only quota uses verified durable originals before installing the exact receipted projection',async()=>{
 const f=fixture();
 assert.throws(()=>wallet.recoverWalletCache(f.storage,remote,receipt,{userId:owner}),{name:'QuotaExceededError'});
 await usingIndexed(f,async()=>{
  assert.equal(await recover(f),true);
  assert.equal(f.values.get(key),JSON.stringify(remote));
  assert.deepEqual(new Set(f.archives.values()),new Set([f.original,JSON.stringify(remote)]));
  const count=f.archives.size;
  assert.equal(await recover(f),false,'already recovered cache is not a new debit/recovery');
  assert.equal(f.archives.size,count);
 });
});
for(const fault of ['open','write','read','install'])test(`wallet ${fault} refusal preserves the original cache`,async()=>{
 const f=fixture({fault});
 await usingIndexed(f,()=>assert.rejects(()=>recover(f)));
 assert.equal(f.values.get(key),f.original);
});
for(const change of ['session','owner','local'])test(`wallet ${change} change during archive verification prevents installation`,async()=>{
 let valid=true;
 const f=fixture({onRead(){if(change==='session')valid=false;else f.values.set(change==='owner'?'lumenCloudOwnerId':key,'replacement')}});
 await usingIndexed(f,async()=>assert.equal(await recover(f,{sessionValid:()=>valid}),false));
 assert.equal(f.values.get(key),change==='local'?'replacement':f.original);
});
test('wallet fallback does not accept unrelated acquisitions, unknown fields or an unproven balance',async()=>{
 for(const extra of [{solved:{0:true,1:true}},{unknownFact:true},{shards:12}]){
  const f=fixture();f.values.set(key,JSON.stringify({...local,...extra}));const before=f.values.get(key);
  await usingIndexed(f,async()=>assert.equal(await recover(f),false));
  assert.equal(f.values.get(key),before);assert.equal(f.archives.size,0);
 }
});
test('wallet quota with no durable fallback never installs the remote cache',async()=>{
 const f=fixture();f.indexedDB=undefined;
 await usingIndexed(f,()=>assert.rejects(()=>recover(f)));
 assert.equal(f.values.get(key),f.original);
});
test('a second-original archive failure keeps local cache and the first verified original',async()=>{
 const f=fixture();let opens=0;const open=f.indexedDB.open;
 f.indexedDB.open=()=>{if(++opens===2)throw quota();return open()};
 await usingIndexed(f,()=>assert.rejects(()=>recover(f)));
 assert.equal(f.values.get(key),f.original);assert.ok([...f.archives.values()].includes(f.original));
});
test('existing conflicting wallet archive is never overwritten or bypassed',async()=>{
 const f=fixture();f.values.set('lumenBeforeWalletRecoveryLocal_'+receipt.operationId,'different-original');
 await usingIndexed(f,()=>assert.rejects(()=>recover(f),/archive conflict/));
 assert.equal(f.values.get(key),f.original);assert.equal(f.archives.size,0);
});
test('silently refused backup and cache installation never return success',async()=>{
 for(const phase of ['backup','install']){
  const f=fixture(),write=f.storage.setItem;
  f.storage.setItem=(k,v)=>{if(phase==='backup'&&k.startsWith('lumenBeforeWalletRecovery'))return;if(phase==='install'&&k===key)return;write(k,v)};
  await usingIndexed(f,()=>assert.rejects(()=>recover(f)));
  assert.equal(f.values.get(key),f.original);
 }
});
