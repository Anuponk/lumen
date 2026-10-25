import {validateSupportCapture} from './support-capture.js';
import {DIAGNOSTIC_CODES} from './diagnostic-reporter.js';
// No business storage/outbox writes. One volatile copy, five retries, one hour TTL.
export function createSupportSession({context,capture,onChange=()=>{},storage,now=Date.now,uuid=()=>crypto.randomUUID(),online=()=>navigator.onLine!==false,schedule=setTimeout,cancel=clearTimeout,timeoutMs=8000}){
 let scope=null,dossier=null,pending=null,timer=null,controller=null,generation=0,busy=false,state='disabled',last=null,blocked=false;
 let events=[];
 const revokeKey='lumenSupportRevocationsV1';
 const readRevokes=()=>{try{const value=JSON.parse(storage?.getItem(revokeKey)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([,pending])=>pending===true)):{}}catch{return {}}};
 function revokeLocal(owner,value){try{const r=readRevokes();if(value)r[owner]=true;else delete r[owner];storage?.setItem(revokeKey,JSON.stringify(r))}catch{}}
 const view=()=>({state,dossier,last,pending:!!pending});
 function emit(s){state=s;try{onChange(view())}catch{}}
 function bind(){
  const c=context()||{};
  if(!scope||c.userId!==scope.userId||c.client!==scope.client){generation++;controller?.abort();if(timer)cancel(timer);timer=null;pending=null;dossier=null;last=null;busy=false;blocked=false;events=[];scope=c;emit('disabled')}
  return c.userId&&c.client&&!c.qa?c:null;
 }
 const valid=(c,g)=>generation===g&&context()?.userId===c.userId&&context()?.client===c.client&&!context()?.qa;
 async function rpc(c,args,signal){
  let request=c.client.rpc('lumen_support',args);if(request.abortSignal)request=request.abortSignal(signal);
  let deadline;
  try{const r=await Promise.race([request,new Promise((_,reject)=>{deadline=schedule(()=>reject(Error('SUPPORT_TIMEOUT')),timeoutMs)})]);if(r.error)throw Error('SUPPORT_UNAVAILABLE');return r.data}
  finally{cancel(deadline)}
 }
 function args(c,action,more={}){return {p_expected_user_id:c.userId,p_action:action,...more}}
 function active(){return !blocked&&dossier?.state==='active'&&Date.parse(dossier.expires_at)>now()&&!readRevokes()[scope?.userId]}
 async function refresh(){
  const c=bind();if(!c||busy)return;const g=generation;
  if(blocked||readRevokes()[c.userId])return revoke();
  try{const d=await rpc(c,args(c,'status'));if(!valid(c,g))return;dossier=d;last=Number.isFinite(Date.parse(d?.last_received_at))?Date.parse(d.last_received_at):last;emit(active()?'ready':d?.state==='expired'?'expired':d?.state==='unavailable'?'unavailable':'disabled');if(pending)void flush()}
  catch{if(valid(c,g))emit('unavailable')}
 }
 async function activate(consented){
  const c=bind();if(!c||!consented||busy||readRevokes()[c.userId])return;const g=++generation;busy=true;emit('activating');
  try{const d=await rpc(c,args(c,'activate'));if(!valid(c,g))return;if(d?.state!=='active')throw Error();dossier=d;pending=null;last=null;emit('ready')}
  catch{if(valid(c,g))emit('failed')}
  finally{if(valid(c,g))busy=false}
 }
 async function send(code='manual'){
  const c=bind();if(!c||!active()||busy)return;
  if(pending){void flush();return}
  if(code!=='manual'&&last&&now()-last<900000)return;
  const g=++generation;emit('preparing');busy=true;
  try{const copy=await capture(c,code);const payload=validateSupportCapture({...copy,events:[...events]});if(!valid(c,g)||!active())return;
   pending={id:uuid(),caseId:dossier.id,payload,at:now(),attempts:0};emit('ready');
  }catch{if(valid(c,g))emit('failed')}
  finally{if(valid(c,g))busy=false}
  if(valid(c,g)&&pending)void flush();
 }
 async function flush(){
  if(timer){cancel(timer);timer=null}
  const c=bind();if(!c||busy||!pending)return;
  if(!active()){pending=null;emit('expired');return}
  if(now()-pending.at>3600000){pending=null;emit('failed');return}
  if(!online()){emit('offline');return}
  if(pending.attempts>=5){emit('failed');return}
  const p=pending,g=generation;busy=true;controller=new AbortController();p.attempts++;emit('sending');
  try{
   const receipt=await rpc(c,args(c,'capture',{p_case_id:p.caseId,p_capture_id:p.id,p_payload:p.payload}),controller.signal);
   if(!valid(c,g)||!active())return;
   if(receipt?.capture_id!==p.id||typeof receipt.received_at!=='string')throw Error('SUPPORT_ACK');
   pending=null;last=now();dossier={...dossier,last_received_at:receipt.received_at};emit('confirmed');
  }catch{if(valid(c,g)&&active()){emit(online()?'failed':'offline');if(p.attempts<5&&online())timer=schedule(()=>{timer=null;void flush()},Math.min(60000,2000*2**p.attempts))}}
  finally{if(valid(c,g)){busy=false;controller=null}}
 }
 async function retry(){if(pending){pending.attempts=0;return flush()}return send()}
 async function revoke(){
  const c=bind();if(!c)return;
  generation++;const g=generation;blocked=true;events=[];controller?.abort();if(timer)cancel(timer);timer=null;pending=null;busy=false;revokeLocal(c.userId,true);if(dossier)dossier={...dossier,state:'revoked'};emit('revoking');
  try{const r=await rpc(c,args(c,'revoke'));if(!valid(c,g))return;if(r?.state!=='deleted')throw Error();revokeLocal(c.userId,false);blocked=false;dossier=null;last=null;emit('deleted')}
  catch{if(valid(c,g))emit('revoking')}
 }
 return {refresh,activate,send,retry,revoke,view,changed(){bind()},incident(code){const c=bind(),g=generation;if(c&&active()&&DIAGNOSTIC_CODES.includes(code)){events=[...events.slice(-19),code];if(!['sync_retry','outbox_retried','outbox_acknowledged','resource_failed','guided_error','guided_undo','guided_input_released'].includes(code))schedule(()=>{if(valid(c,g))void send(code)},0)}}};
}
