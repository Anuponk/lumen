import {createIndexedOutboxStore} from './indexed-outbox-store.js';

const PREFIX='lumenCanonicalVictoryOutboxV2:',LEGACY_PREFIX='lumenCanonicalVictoryOutboxV1:';
function browserStore(){let database;try{database=globalThis.indexedDB}catch{}return createIndexedOutboxStore(database)}
// Keep V1 identities/rewards readable by previous clients. Corrupt entries are
// retained in place and reported, never treated as an empty or completed queue.
export function createDurableCanonicalVictoryOutbox(storage,{fallback=browserStore(),onIssue=()=>{},now=()=>new Date().toISOString(),newId=()=>globalThis.crypto.randomUUID()}={}){
 const report=kind=>{try{onIssue({kind})}catch{}};
 const prefix=userId=>{
  if(!userId||String(userId).includes(':'))throw Error('Invalid outbox identity');
  return [PREFIX+userId+':',LEGACY_PREFIX+userId+':'];
 };
 function parse(key,raw,userId){
  const entry=JSON.parse(raw);
  const [current,legacy]=prefix(userId);
  const identity=key.startsWith(current)?entry?.version===2&&typeof entry.operationId==='string'&&/^[A-Za-z0-9._-]{1,120}$/.test(entry.operationId)&&key===current+entry.operationId:key===legacy+entry?.questId;
  if(entry?.userId!==userId||typeof entry.questId!=='string'||!entry.questId||!identity||!entry.reward||typeof entry.reward!=='object'||Array.isArray(entry.reward)||typeof entry.createdAt!=='string'||!Number.isFinite(Date.parse(entry.createdAt)))throw Error('Invalid outbox record');
  return entry;
 }
 async function scan(userId){
  const starts=prefix(userId),belongs=key=>typeof key==='string'&&starts.some(start=>key.startsWith(start)),records=[],issues=[];let readable=0;
  try{
   const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(belongs);
   for(const key of keys){const raw=storage.getItem(key);if(raw!==null)records.push({key,raw,store:'local'})}
   readable++;
  }catch{issues.push('local_unavailable')}
  try{for(const [key,raw] of await fallback.entries('lumenCanonicalVictoryOutbox'))if(belongs(key))records.push({key,raw,store:'indexed'});readable++}catch{issues.push('indexed_unavailable')}
  if(!readable){report('storage_unavailable');throw Error('No readable durable outbox store')}
  const groups=new Map(),invalid=new Set();
  for(const record of records){
   try{
    record.entry=parse(record.key,record.raw,userId);
    const prior=groups.get(record.key);
    if(prior&&prior[0].raw!==record.raw){invalid.add(record.key);issues.push('conflicting_copies')}
    groups.set(record.key,[...(prior||[]),record]);
   }catch{invalid.add(record.key);issues.push('invalid_entry')}
  }
  for(const kind of new Set(issues))report(kind);
  const valid=[...groups.entries()].filter(([key])=>!invalid.has(key)).map(([,copies])=>copies);
  valid.sort((a,b)=>a[0].entry.createdAt.localeCompare(b[0].entry.createdAt)||a[0].key.localeCompare(b[0].key));
  return {groups:valid,issues:[...new Set(issues)],invalid,complete:readable===2};
 }
 async function enqueue(userId,questId,reward,{operationId=newId()}={}){
  if(!questId||!reward||typeof reward!=='object'||Array.isArray(reward))throw Error('Invalid outbox reward');
  if(typeof operationId!=='string'||!/^[A-Za-z0-9._-]{1,120}$/.test(operationId))throw Error('Invalid operation identity');
  const key=prefix(userId)[0]+operationId,inspection=await scan(userId);
  if(inspection.invalid.has(key))throw Error('Outbox intent requires recovery');
  const existing=inspection.groups.find(copies=>copies[0].key===key);
  if(existing){
   if(existing[0].entry.questId!==questId||JSON.stringify(existing[0].entry.reward)!==JSON.stringify(reward))throw Error('Operation identity reused with different evidence');
   return existing[0].entry;
  }
  const entry={version:2,operationId,userId,questId,reward:structuredClone(reward),createdAt:now()},raw=JSON.stringify(entry);
  // Prefer an atomic IndexedDB transaction; localStorage is the compatibility
  // fallback when IndexedDB is denied or unavailable. Neither is memory-only.
  try{
   await fallback.put(key,raw);
   if(await fallback.get(key)!==raw)throw Error('Outbox fallback verification failed');
   report('indexed_checkpoint');return entry;
  }catch(error){if(error?.code==='OUTBOX_CONFLICT')throw error;report('indexed_write_failed')}
  try{
   const current=storage.getItem(key);
   if(current!==null){if(current!==raw)throw Error('Outbox intent changed');return parse(key,current,userId)}
   storage.setItem(key,raw);
   if(storage.getItem(key)!==raw)throw Error('Outbox verification failed');
   return entry;
  }catch{report('local_write_failed');throw Error('Victory could not be durably recorded')}
 }
 async function acknowledge(userId,questId,expectedReward,operationId){
  const inspection=await scan(userId);
  const target=inspection.groups.find(group=>group[0].entry.questId===questId&&(operationId===undefined?group[0].entry.operationId===undefined:group[0].entry.operationId===operationId));
  if(!target){
   if(inspection.invalid.size)throw Error('Outbox intent requires recovery');
   return;
  }
  const copies=target,key=copies[0].key;
  if(expectedReward!==undefined&&copies.some(copy=>JSON.stringify(copy.entry.reward)!==JSON.stringify(expectedReward)))throw Error('Outbox reward changed before acknowledgement');
  for(const copy of copies){
   if(copy.store==='indexed')await fallback.remove(key,copy.raw);
   else{
    if(storage.getItem(key)!==copy.raw)throw Error('Outbox changed before acknowledgement');
    storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('Outbox acknowledgement not removed');
   }
  }
 }
 return {enqueue,acknowledge,pending:async userId=>(await scan(userId)).groups.map(copies=>copies[0].entry),inspect:async userId=>{const result=await scan(userId);return {pending:result.groups.map(copies=>copies[0].entry),issues:result.issues,complete:result.complete}}};
}
