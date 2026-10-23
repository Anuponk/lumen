// Optional #534 details. No game/save path awaits transport; forbidden data is
// never read from Error objects. #398's operational projections stay separate.
export const DIAGNOSTIC_CODES=['sync_write_failed','sync_conflict','sync_retry','hydration_failed','hydration_blocked','outbox_read_failed','outbox_retry_failed','outbox_capture_failed','outbox_retried','outbox_acknowledged','runtime_exception','unhandled_rejection','resource_failed','guided_error','guided_undo','guided_input_blocked','guided_input_released'];
const stages=['sync_write','reconciliation','cloud_initialize','daily_read','wallet_receipt_readback','achievement_backup','achievement_install','achievement_rollback','legacy_mirror','outbox_capture','outbox_read','outbox_retry','guided','runtime','unknown'];
const kinds=['quota','storage','network','auth','conflict','unknown'];
const platforms=['android-pwa','android-web','desktop','other'],browsers=['chromium','firefox','safari','other'],states=['ready','blocked','unknown'];
const key='lumenDiagnosticQueueV1',uuidPattern=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const versionPattern=/\b\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}\b/;
const fields=['id','session','trace','seq','at','code','stage','kind','platform','browser','version','before','after','retry'];
const pick=(list,value,fallback)=>list.includes(value)?value:fallback;
function restorable(e,now){
 return e&&Object.keys(e).length===fields.length&&Object.keys(e).every(k=>fields.includes(k))&&
  [e.id,e.session,e.trace].every(v=>typeof v==='string'&&uuidPattern.test(v))&&DIAGNOSTIC_CODES.includes(e.code)&&
  stages.includes(e.stage)&&kinds.includes(e.kind)&&platforms.includes(e.platform)&&browsers.includes(e.browser)&&
  states.includes(e.before)&&states.includes(e.after)&&Number.isInteger(e.seq)&&e.seq>0&&e.seq<=10000&&
  Number.isInteger(e.retry)&&e.retry>=0&&e.retry<=5&&typeof e.version==='string'&&
  (e.version==='unknown'||/^\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9}$/.test(e.version))&&
  Number.isFinite(Date.parse(e.at))&&Date.parse(e.at)>now-86400000&&Date.parse(e.at)<=now+300000;
}
export function mapCloudDiagnostic(event,details={}){
 const code={flush_failed:'sync_write_failed',flush_conflict:'sync_conflict',flush_retry_online:'sync_retry',hydration_failed:'hydration_failed',
  canonical_outbox_retry_started:'outbox_retried',canonical_outbox_reconnect_replayed:'outbox_acknowledged',
  cloud_achievements_recovery_blocked:'hydration_blocked',canonical_outbox_read_failed:'outbox_read_failed',
  canonical_outbox_reconnect_failed:'outbox_retry_failed',canonical_outbox_recovery_pending:'outbox_retry_failed',
  outbox_preservation_failed:'outbox_capture_failed'}[event];
 if(!code&&!(event==='hydration_reconciliation'&&details.result==='blocked'))return null;
 const reason=pick(kinds,details.kind,pick(kinds,details.reason,'unknown'));
 const kind=/quota/.test(String(details.reason||''))?'quota':/storage|backup|install/.test(String(details.reason||''))?'storage':/conflict|balance|ledger/.test(String(details.reason||''))?'conflict':reason;
 return {code:code||'hydration_blocked',stage:pick(stages,details.stage,event.startsWith('flush_')?'sync_write':event.includes('outbox')?'outbox_retry':'reconciliation'),kind};
}
export function createDiagnosticReporter({storage,context,send,uuid=()=>crypto.randomUUID(),now=Date.now,
 schedule=setTimeout,cancel=clearTimeout,online=()=>globalThis.navigator?.onLine!==false,timeoutMs=5000}={}){
 let owner=null,client=null,session=null,queue=[],sequence=0,attempts=0,nextAt=0,timer=null,busy=false,muted=false;
 const seen=new Map();
 const current=()=>{try{return context()||{}}catch{return {}}};
 function persist(){try{
  if(!queue.length){storage?.removeItem(key);return}
  while(queue.length>30)queue.shift();
  let raw=JSON.stringify({owner,session,events:queue,attempts,nextAt});
  while(raw.length>16384&&queue.length){queue.shift();raw=JSON.stringify({owner,session,events:queue,attempts,nextAt})}
  storage?.setItem(key,raw);
 }catch{/* Quota/denial cannot suppress best-effort in-memory delivery. */}}
 function bind(){
  const ctx=current();
  if(!ctx.userId||!ctx.client||ctx.enabled!==true){
   if(timer!==null)cancel(timer);timer=null;queue=[];owner=null;client=null;seen.clear();return null;
  }
  if(ctx.userId!==owner||ctx.client!==client){
   if(timer!==null)cancel(timer);timer=null;queue=[];attempts=0;nextAt=0;seen.clear();muted=false;
   owner=ctx.userId;client=ctx.client;session=uuid();sequence=0;
   try{
    const raw=storage?.getItem(key);
    const saved=raw&&raw.length<=16384?JSON.parse(raw):null;
    if(saved?.owner===owner&&Array.isArray(saved.events)){
     queue=saved.events.filter(e=>restorable(e,now())).slice(-30);
     if(uuidPattern.test(saved.session))session=saved.session;
     sequence=Math.max(0,...queue.map(e=>e.seq));attempts=Math.min(4,Math.max(0,Number(saved.attempts)||0));
     nextAt=Math.min(now()+60000,Math.max(0,Number(saved.nextAt)||0));
    }
   }catch{}
   persist();
  }
  return ctx;
 }
 function arm(delay=1000){
  if(timer!==null||muted||!queue.length)return;
  timer=schedule(()=>{timer=null;void flush()},delay);
 }
 function capture(code,details={}){
  try{
   const ctx=bind();if(!ctx||muted||!DIAGNOSTIC_CODES.includes(code))return;
   const stage=pick(stages,details.stage,'unknown'),kind=pick(kinds,details.kind,'unknown');
   const before=pick(states,details.before,'unknown'),after=pick(states,details.after,'unknown');
   const signature=JSON.stringify([code,stage,kind,before,after]);
   if(!code.startsWith('guided_')&&!['sync_retry','outbox_retried','outbox_acknowledged'].includes(code)&&(seen.get(signature)||0)>now()-300000)return;
   seen.set(signature,now());while(seen.size>50)seen.delete(seen.keys().next().value);
   if(sequence>=10000){session=uuid();sequence=0}
   const id=uuid();
   const entry={id,session,trace:uuidPattern.test(details.trace)?details.trace:session,seq:++sequence,at:new Date(now()).toISOString(),
    code,stage,kind,platform:pick(platforms,ctx.platform,'other'),browser:pick(browsers,ctx.browser,'other'),
    version:String(ctx.version||'unknown').match(versionPattern)?.[0]||'unknown',before,after,
    retry:Number.isInteger(details.retry)?Math.min(5,Math.max(0,details.retry)):0};
   if(!restorable(entry,now()))return;
   queue.push(entry);persist();arm();
  }catch{/* Diagnostics must never escape into the gameplay caller. */}
 }
 async function flush(){
  let deadline,capturedOwner,capturedClient,acquired=false;
  try{
   if(timer!==null)cancel(timer);timer=null;
   const ctx=bind();if(!ctx||busy||muted)return;
   queue=queue.filter(e=>restorable(e,now()));persist();
   if(!queue.length)return;
   if(!online())return;
   if(now()<nextAt){arm(nextAt-now());return}
   const batch=queue.slice(0,10);capturedOwner=owner;capturedClient=client;
   busy=true;acquired=true;
   const controller=new AbortController();
   const result=await Promise.race([
    Promise.resolve().then(()=>send(ctx,{p_expected_user_id:capturedOwner,p_events:batch},controller.signal)),
    new Promise((_,reject)=>{deadline=schedule(()=>{controller.abort();reject(Error('Diagnostic timeout'))},timeoutMs)})
   ]);
   const latest=current();if(latest.userId!==capturedOwner||latest.client!==capturedClient||latest.enabled!==true)return;
   if(result?.disabled){queue=[];muted=true}
   else if(result?.limited)throw Error('Diagnostic budget');
   else{
    const accepted=new Set(Array.isArray(result?.accepted)?result.accepted:[]);
    const delivered=new Set(batch.filter(e=>accepted.has(e.id)).map(e=>e.id));
    if(!delivered.size)throw Error('Diagnostic unacknowledged');
    queue=queue.filter(e=>!delivered.has(e.id));
   }
   attempts=0;nextAt=0;persist();
  }catch{
   const latest=current();if(!capturedOwner||latest.userId!==capturedOwner||latest.client!==capturedClient)return;
   attempts++;
   if(attempts>=5){queue=queue.slice(10);attempts=0}
   nextAt=now()+Math.min(60000,1000*2**Math.max(1,attempts));persist();
  }finally{
   if(acquired){if(deadline!==undefined)cancel(deadline);busy=false;if(online())arm(Math.max(1000,nextAt-now()))}
  }
 }
 return {capture,flush,pending:()=>queue.length,refresh(){try{bind();arm()}catch{}},
  clear(){if(timer!==null)cancel(timer);timer=null;queue=[];muted=false;attempts=0;nextAt=0;seen.clear();persist()}};
}
export function installDiagnosticListeners(target,reporter){
 const error=event=>{try{reporter.capture(event.target!==target&&['SCRIPT','LINK','IMG'].includes(event.target?.tagName)?'resource_failed':'runtime_exception',{stage:'runtime'})}catch{}};
 const rejection=()=>{try{reporter.capture('unhandled_rejection',{stage:'runtime'})}catch{}};
 target.addEventListener('error',error,true);target.addEventListener('unhandledrejection',rejection);
 const reconnect=()=>{try{reporter.refresh()}catch{}};target.addEventListener('online',reconnect);
 return ()=>{target.removeEventListener('error',error,true);target.removeEventListener('unhandledrejection',rejection);target.removeEventListener('online',reconnect)};
}
