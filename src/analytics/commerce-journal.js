// #1044 shop and limit journal (docs/ANALYTICS_1044.md). Significant actions only:
// a shop visit (one per voluntary display, never per render), its close, the Premium
// call to action, the payment sheet/checkout start, its cancel/error, a blocked
// first gesture and the limit dialog actually shown. No grid gesture, no payment
// data. Batched (≤ 20 per call), idempotent (event id), kept offline in a small
// bounded queue, sent on visit close, on hide and after a short debounce: no polling.
export const COMMERCE_EVENT_TYPES=Object.freeze(['shop_open','shop_close','cta_click','checkout_start','checkout_cancel','checkout_error','limit_block','limit_shown']);
export const SHOP_ORIGINS=Object.freeze(['locked_adventure','quota_new','quota_replay','voluntary','premium_feature','other']);
const QUEUE_LIMIT=60,BATCH=20,KEY='lumenCommerceJournalV1:';

export function priceFromLabel(label){
 const text=String(label??'');const m=text.match(/(\d+)(?:[.,](\d{1,2}))?/);
 const currency=/€/.test(text)?'EUR':/£/.test(text)?'GBP':/\$/.test(text)?'USD':/CHF/.test(text)?'CHF':null;
 if(!m||!currency)return {};
 return {priceCents:Number(m[1])*100+Number((m[2]||'0').padEnd(2,'0')),currency};
}

export function createCommerceJournal({rpc,storage=globalThis.localStorage,now=()=>Date.now(),randomId=()=>globalThis.crypto?.randomUUID?.()||String(Math.random()).slice(2)+String(now()),setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout,debounceMs=2500}={}){
 let owner=null,queue=[],visit=null,timer=null,sending=null;
 const read=o=>{try{const v=JSON.parse(storage?.getItem(KEY+o)||'[]');return Array.isArray(v)?v.slice(-QUEUE_LIMIT):[]}catch{return []}};
 const write=()=>{if(!owner)return;try{if(queue.length)storage?.setItem(KEY+owner,JSON.stringify(queue));else storage?.removeItem(KEY+owner)}catch{}};
 function use(nextOwner){
  if(nextOwner===owner)return;
  visit=null;if(timer){clearTimer(timer);timer=null}
  owner=nextOwner||null;queue=owner?read(owner):[];
 }
 function schedule(){if(timer||!owner)return;timer=setTimer(()=>{timer=null;void flush()},debounceMs)}
 function record(type,fields={}){
  if(!owner||!COMMERCE_EVENT_TYPES.includes(type))return null;
  const event={id:randomId(),type,at:new Date(now()).toISOString()};
  for(const [k,v] of Object.entries(fields))if(v!==undefined&&v!==null&&v!=='')event[k]=v;
  if(event.origin&&!SHOP_ORIGINS.includes(event.origin))event.origin='other';
  queue.push(event);if(queue.length>QUEUE_LIMIT)queue=queue.slice(-QUEUE_LIMIT);
  write();schedule();return event;
 }
 async function flush(){
  if(sending)return sending;
  if(!owner||!queue.length||typeof rpc!=='function')return {sent:0};
  const who=owner,batch=queue.slice(0,BATCH);
  sending=(async()=>{
   let result;try{result=await rpc('lumen_track_commerce',{p_events:batch})}catch(error){result={error}}
   if(owner!==who)return {sent:0};
   // Accepted or refused as invalid: the batch is settled (the server deduplicates).
   if(!result?.error||result.error?.code==='22023'){const ids=new Set(batch.map(e=>e.id));queue=queue.filter(e=>!ids.has(e.id));write()}
   return {sent:result?.error?0:batch.length};
  })().finally(()=>{sending=null;if(owner&&queue.length&&!timer)schedule()});
  return sending;
 }
 // One visit per voluntary display: re-renders of the open offer never call this.
 function openVisit({origin='other',channel,product,priceCents,currency}={}){
  if(!owner)return null;
  if(visit)closeVisit();
  visit={id:randomId(),openedAt:now(),channel};
  record('shop_open',{origin,channel,visit:visit.id,product,priceCents,currency});
  return visit.id;
 }
 function closeVisit(){
  if(!visit)return;
  const v=visit;visit=null;
  record('shop_close',{channel:v.channel,visit:v.id,durationMs:Math.max(0,Math.min(86400000,Math.round(now()-v.openedAt)))});
  void flush();
 }
 const inVisit=(type,fields={})=>record(type,{channel:visit?.channel,visit:visit?.id,...fields});
 return {use,record,flush,openVisit,closeVisit,
  cta:fields=>inVisit('cta_click',fields),
  checkoutStart:fields=>inVisit('checkout_start',fields),
  checkoutCancel:fields=>inVisit('checkout_cancel',fields),
  checkoutError:fields=>inVisit('checkout_error',fields),
  limitBlock:kind=>record('limit_block',{kind}),
  limitShown:kind=>record('limit_shown',{kind}),
  snapshot:()=>({owner,queue:queue.slice(),visit:visit?{...visit}:null})};
}
