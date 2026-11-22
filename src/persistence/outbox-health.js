// #962: the visible label is "Version 1.11.1+763 · fac6059"; record_outbox_health only
// accepts "1.11.1+763 fac6059" and stored every production row as "unknown".
export function outboxHealthVersion(label){
 const match=/(\d{1,3}\.\d{1,3}\.\d{1,3}\+\d{1,9})(?:[^0-9a-f]+([0-9a-f]{7,40}))?(?![\w.+])/.exec(String(label??''));
 return match?match[1]+(match[2]?' '+match[2]:''):'unknown';
}
export function createOutboxHealthReporter({storage,send,newId=()=>crypto.randomUUID(),now=()=>new Date().toISOString()}={}){
 const valid=value=>typeof value==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
 let clientId;
 try{clientId=storage.getItem('lumenSyncClientV1');if(!valid(clientId)){clientId=newId();storage.setItem('lumenSyncClientV1',clientId)}}catch{clientId=newId()}
 const sessionId=newId(),startedAt=now();let sequence=0,last=null;
 return {async report({userId,client,platform='other',version='unknown',state='pending',pending=[],failures=0}){
  if(!userId||!client)return;
  const dates=pending.map(e=>Date.parse(e.createdAt)).filter(Number.isFinite);
  const payload={p_expected_user_id:userId,p_client_id:clientId,p_session_id:sessionId,p_started_at:startedAt,
   p_sequence:++sequence,p_platform:platform,p_state:state,p_pending:Math.min(10000,pending.length),
   p_failures:state==='confirmed'?0:Math.min(10000,Math.max(0,Number.isSafeInteger(failures)?failures:0)),
   p_oldest_at:dates.length?new Date(Math.min(...dates)).toISOString():null,
   p_version:outboxHealthVersion(version)};
  const signature=JSON.stringify({...payload,p_sequence:0});if(last===signature)return;
  last=signature;
  try{await send(client,payload)}catch{if(last===signature)last=null}
 }};
}
