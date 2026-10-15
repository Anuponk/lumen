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
 function acknowledge(userId,questId){
  const k=key(userId,questId);
  const original=storage.getItem(k);
  if(original===null)return;
  const entry=JSON.parse(original);
  if(entry?.userId!==userId||entry?.questId!==questId)throw Error("Outbox acknowledgement identity mismatch");
  if(storage.getItem(k)!==original)throw Error("Outbox changed before acknowledgement");
  storage.removeItem(k);
  if(storage.getItem(k)!==null)throw Error("Outbox acknowledgement not removed");
 }
 return {enqueue,pending,acknowledge};
}
export async function replayCanonicalVictoryOutbox(outbox,userId,commit,{sessionValid=()=>true}={}){
 const confirmed=[];
 for(const entry of outbox.pending(userId)){
  if(!sessionValid())break;
  try{
   const result=await commit(entry.questId,entry.reward);
   if(!sessionValid())break;
   if(!result?.profile?.canonicalQuestState?.[entry.questId]?.solved)break;
   outbox.acknowledge(userId,entry.questId);
   confirmed.push(result);
  }catch{break} // keep unacknowledged entries intact for next reconnect
 }
 return confirmed;
}
