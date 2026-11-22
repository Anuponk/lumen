// #962: the visible label is "Version 1.11.1+763 · fac6059"; record_outbox_health only
// accepts "1.11.1+763 fac6059" and stored every production row as "unknown".
export function outboxHealthVersion(label){
 const match=/(\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9})(?:[^0-9a-f]+([0-9a-f]{7,40}))?(?![\w.+])/.exec(String(label??''));
 return match?match[1]+(match[2]?' '+match[2]:''):'unknown';
}
// #962: bounded local storage health (no consent prompt, same tier as this observation).
// Only buckets and a category leave the device: local size rounded up to 256 KB, share
// of the ~10 MB (5 M UTF-16 characters) origin limit rounded to 5 %, and `quota` or
// `storage` for the last local write failure. No key, value, message or stack.
export const LOCAL_STORAGE_LIMIT_BYTES=10*1024*1024;
export function outboxStorageFields(storage){
 if(!storage||typeof storage!=='object')return null;
 const bytes=Number(storage.bytes);
 const known=Number.isFinite(bytes)&&bytes>=0;
 const kb=known?Math.min(1048576,Math.ceil(bytes/1024/256)*256):null;
 const ratio=known?Math.min(100,Math.round(bytes/LOCAL_STORAGE_LIMIT_BYTES*20)*5):null;
 const error=['quota','storage'].includes(storage.error)?storage.error:null;
 return {p_storage_kb:kb,p_storage_ratio:ratio,p_storage_error:error};
}
export function createOutboxHealthReporter({storage,send,newId=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){
 const valid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
 let clientId;
 try{clientId=storage.getItem('lumenSyncClientV1');if(!valid(clientId)){clientId=newId();storage.setItem('lumenSyncClientV1',clientId)}}catch{clientId=newId()}
 const sessionId=newId(),startedAt=now();let sequence=0,last=null;
 return {async report({userId,client,platform='other',version='unknown',state='pending',pending=[],failures=0,device=null}){
  if(!userId||!client)return;
  const dates=pending.map(e=>Date.parse(e.createdAt)).filter(Number.isFinite);
  const payload={p_expected_user_id:userId,p_client_id:clientId,p_session_id:sessionId,p_started_at:startedAt,
   p_sequence:++sequence,p_platform:platform,p_state:state,p_pending:Math.min(10000,pending.length),
   p_failures:state==='confirmed'?0:Math.min(10000,Math.max(0,Number.isSafeInteger(failures)?failures:0)),
   p_oldest_at:dates.length?new Date(Math.min(...dates)).toISOString():null,
   p_version:outboxHealthVersion(version),...(outboxStorageFields(device)||{})};
  const signature=JSON.stringify({...payload,p_sequence:0});if(last===signature)return;
  last=signature;
  try{await send(client,payload)}catch{if(last===signature)last=null}
 }};
}
