import {rankedTime} from '../campaign/ranking.js';
// Separate, per-owner durable staging. Never writes the progression or wallet.
export function createRankingClient({storage,getContext,now=()=>Date.now()}={}){
 const prefix='lumenRankingPendingV1:',flights=new Map(),recent=new Map();
 const context=()=>getContext()||{};
 const key=(owner,operation)=>prefix+owner+':'+operation;
 function save(value){const k=key(value.owner,value.operationId),raw=JSON.stringify(value);storage.setItem(k,raw);if(storage.getItem(k)!==raw)throw Error('Ranking capture unverified');return value}
 function read(k){const raw=storage.getItem(k);return raw?JSON.parse(raw):null}
 function valid(c){const live=context();return c.owner&&live.owner===c.owner&&live.client===c.client&&!live.qa}
 async function rpc(c,name,args){if(!valid(c))throw Error('Ranking account changed');const r=await c.client.rpc(name,args);if(!valid(c))throw Error('Ranking account changed');if(r.error)throw Error('Ranking unavailable');return r.data}
 function entries(owner){const out=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(prefix+owner+':')){const v=read(k);if(v?.owner!==owner||key(owner,v.operationId)!==k)throw Error('Ranking identity mismatch');out.push(v)}}return out.sort((a,b)=>a.createdAt-b.createdAt)}
 async function send(c,entry){
  const id=key(c.owner,entry.operationId);if(flights.has(id)){await flights.get(id);if(!read(id))return {status:'confirmed'};return send(c,entry)}
  const promise=(async()=>{
   const begin=await rpc(c,'lumen_ranking_begin',{p_operation_id:entry.operationId,p_quest_id:entry.questId,p_grid_revision:entry.gridRevision,p_started_at:entry.startedAt});
   if(!entry.result){if(JSON.stringify(read(id))===JSON.stringify(entry))storage.removeItem(id);return begin}
   const result=await rpc(c,'lumen_ranking_finish',{p_operation_id:entry.operationId,p_hint_uses:entry.result.hint,p_verify_uses:entry.result.verify});
   // Terminal receipt only; pending/missing victory receipts stay durable.
   if(result?.status==='confirmed'||result?.status==='ineligible'){
    recent.set(id,result);if(recent.size>32)recent.delete(recent.keys().next().value);
    const current=read(id);if(current&&JSON.stringify(current)===JSON.stringify(entry))storage.removeItem(id);
   }
   return result;
  })().finally(()=>flights.delete(id));flights.set(id,promise);return promise;
 }
 function capture(quest,attempt){
  const c=context();if(!c.owner||!c.client||c.qa||attempt?.rankingVersion!==1||attempt.mode==='challenge'||!attempt.startedAt)return null;
  const operationId=attempt.attemptId+'-reset-'+(attempt.resetCount||0),k=key(c.owner,operationId),existing=read(k);
  if(existing)return existing;
  return save({owner:c.owner,operationId,questId:quest.id,gridRevision:quest.gridRevision??0,startedAt:new Date(attempt.startedAt).toISOString(),createdAt:now()});
 }
 return {
  capture,
  async begin(quest,attempt){const e=capture(quest,attempt);return e?send(context(),e):null},
  stage(quest,attempt){const e=capture(quest,attempt);if(!e)return null;const result={hint:attempt.helpUses?.hint??0,verify:(attempt.helpUses?.verify??0)+(attempt.helpUses?.guided??0)};rankedTime(0,result);return e.result?e:save({...e,result})},
  async flush(){const c=context();if(!valid(c))return [];const out=[];for(const e of entries(c.owner)){if(!valid(c))break;out.push(await send(c,e))}return out},
  async board(quest){const c=context();return rpc(c,'lumen_ranking_board',{p_quest_id:quest.id,p_grid_revision:quest.gridRevision??0})},
  async membership(enabled,nickname){const c=context();const result=await rpc(c,'lumen_ranking_membership',{p_enabled:enabled,p_nickname:nickname||null});if(!enabled)for(const e of entries(c.owner))storage.removeItem(key(c.owner,e.operationId));return result},
  entries
  ,takeResult(operationId){const id=key(context().owner,operationId),r=recent.get(id);recent.delete(id);return r}
 };
}
