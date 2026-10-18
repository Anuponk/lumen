import {classifyCanonicalRecoveryError} from './canonical-recovery-errors.js';
// Durable, per-account canonical victory intents. A verified local write comes
// before any network attempt; server CAS remains the authority for rewards.
// Entries never expire or get removed on network failure.
export function createCanonicalVictoryOutbox(storage){
 const prefix="lumenCanonicalVictoryOutboxV1:";
 function key(userId,questId){
  if(!userId||!questId||String(userId).includes(":"))throw Error("Invalid outbox identity");
  return prefix+userId+":"+questId;
 }
 function enqueue(userId,questId,reward){
  const k=key(userId,questId);
  const existing=storage.getItem(k);
  if(existing){
   const saved=JSON.parse(existing);
   if(saved.userId!==userId||saved.questId!==questId)throw Error("Outbox identity mismatch");
   if(!saved.reward||typeof saved.reward!=="object")throw Error("Outbox reward missing");
   if(storage.getItem(k)!==existing)throw Error("Outbox changed while reading");
   return saved; // never change a stored attempt or reward in flight
  }
  const value=JSON.stringify({userId,questId,reward,createdAt:new Date().toISOString()});
  storage.setItem(k,value);
  if(storage.getItem(k)!==value)throw Error("Outbox verification failed");
  return JSON.parse(value);
 }
 function pending(userId){
  if(!userId)return [];
  const prefixForUser=prefix+userId+":";
  const entries=[];
  for(let i=0;i<storage.length;i++){
   const k=storage.key(i);
   if(!k?.startsWith(prefixForUser))continue;
   try{
    const value=JSON.parse(storage.getItem(k));
    if(value?.userId!==userId||!value.questId||k!==key(userId,value.questId)||!value.reward)throw Error("Outbox identity or reward mismatch");
    entries.push(value);
   }catch(error){throw Error("Outbox integrity check failed: "+String(error?.message||"invalid entry"))} // Never silently skip a saved victory
  }
  return entries.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 }
 function acknowledge(userId,questId,expectedReward){
  const k=key(userId,questId);
  const original=storage.getItem(k);
  if(original===null)return true;
  const entry=JSON.parse(original);
  if(entry?.userId!==userId||entry?.questId!==questId)throw Error("Outbox acknowledgement identity mismatch");
  if(expectedReward!==undefined&&JSON.stringify(entry.reward)!==JSON.stringify(expectedReward))throw Error("Outbox reward changed before acknowledgement");
  if(storage.getItem(k)!==original)throw Error("Outbox changed before acknowledgement");
  storage.removeItem(k);
  if(storage.getItem(k)!==null)throw Error("Outbox acknowledgement not removed");
  return true;
 }
 return {enqueue,pending,acknowledge};
}
export async function replayCanonicalVictoryOutbox(outbox,userId,commit,{sessionValid=()=>true,onIssue=()=>{}}={}){
 const confirmed=[];
 const blockedQuests=new Set();
 const report=kind=>{try{onIssue({kind})}catch{}};
 const state=outbox.inspect?await outbox.inspect(userId):{pending:await outbox.pending(userId)};
 if(state.authRequired){report('auth');return confirmed}
 const paused=new Set((state.paused||[]).map(entry=>JSON.stringify([entry.questId,entry.operationId??null])));
 for(const entry of state.pending){
  if(!sessionValid())break;
  if(paused.has(JSON.stringify([entry.questId,entry.operationId??null]))){blockedQuests.add(entry.questId);continue}
  if(blockedQuests.has(entry.questId))continue;
  try{
   const result=await commit(entry.questId,entry.reward,{operationId:entry.operationId,sessionValid});
   if(!sessionValid())break;
   const saved=result?.profile?.canonicalQuestState?.[entry.questId];
   const badges=['autonomy','speed','noError','mastery'];
   if(!saved?.solved||!badges.every(key=>!entry.reward?.badges?.[key]||saved.badges?.[key]===true||saved.badges?.[key]===1)){
    blockedQuests.add(entry.questId);report('unverified');continue;
   }
   confirmed.push(result);
   // A failed local cleanup cannot undo a verified server acknowledgement.
   // Its retained intent is safe to retry through the idempotent ledger.
   try{await outbox.acknowledge(userId,entry.questId,entry.reward,entry.operationId)}catch{report('cleanup')}
  }catch(error){
   if(!sessionValid())break;
   const classification=classifyCanonicalRecoveryError(error);
   blockedQuests.add(entry.questId);report(classification.kind==='retry'?'commit':classification.kind);
   if(classification.kind!=='retry'&&outbox.pause){try{await outbox.pause(userId,entry,error)}catch{report('pause_storage')}}
   if(classification.kind==='auth'||error?.retryScope==='session')break;
   // Preserve this quest's order while allowing independent victories to recover.
  }
 }
 return confirmed;
}
