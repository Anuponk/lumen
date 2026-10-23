import {createIndexedOutboxStore} from './indexed-outbox-store.js';
import {classifyCanonicalRecoveryError} from './canonical-recovery-errors.js';

const PREFIX='lumenCanonicalVictoryOutboxV2:',LEGACY_PREFIX='lumenCanonicalVictoryOutboxV1:',RETRY_PREFIX='lumenCanonicalVictoryRetryV1:';
function browserStore(){let database;try{database=globalThis.indexedDB}catch{}return createIndexedOutboxStore(database)}
// Keep V1 identities/rewards readable by previous clients. Corrupt entries are
// retained in place and reported, never treated as an empty or completed queue.
export function createDurableCanonicalVictoryOutbox(storage,{fallback=browserStore(),onIssue=()=>{},now=()=>new Date().toISOString(),newId=()=>globalThis.crypto.randomUUID(),namespace='Canonical'}={}){
 if(!['Canonical','Legacy','Wallet'].includes(namespace))throw Error('Unknown operation domain');
 const domainPrefix=value=>value.replace('Canonical',namespace);
 const report=kind=>{try{onIssue({kind})}catch{}};
 const volatilePauses=new Map(); // Failed metadata writes hold this session only.
 const prefix=userId=>{
  if(!userId||String(userId).includes(':'))throw Error('Invalid outbox identity');
  return [domainPrefix(PREFIX)+userId+':',domainPrefix(LEGACY_PREFIX)+userId+':',domainPrefix(RETRY_PREFIX)+userId+':'];
 };
 const retryKey=(userId,entry)=>prefix(userId)[2]+(entry.operationId===undefined?'v1-'+encodeURIComponent(entry.questId):'v2-'+entry.operationId);
 function parsePause(raw,userId,entry){
  const state=JSON.parse(raw);
  if(state?.version!==1||state.userId!==userId||state.questId!==entry.questId||state.operationId!==(entry.operationId??null)||typeof state.intentCreatedAt!=='string'||!Number.isFinite(Date.parse(state.intentCreatedAt))||!['auth','review'].includes(state.kind)||state.code!==classifyCanonicalRecoveryError({code:state.code}).code)throw Error('Invalid retry state');
  // A leftover pause for an acknowledged, re-enqueued operation is not current.
  return state.intentCreatedAt===entry.createdAt?state:null;
 }
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
  try{for(const [key,raw] of await fallback.entries(domainPrefix('lumenCanonicalVictory')))if(belongs(key))records.push({key,raw,store:'indexed'});readable++}catch{issues.push('indexed_unavailable')}
  if(!readable){report('storage_unavailable');throw Error('No readable durable outbox store')}
  const groups=new Map(),invalid=new Set(),retryCopies=new Map();
  for(const record of records){
   if(record.key.startsWith(prefix(userId)[2])){retryCopies.set(record.key,[...(retryCopies.get(record.key)||[]),record]);continue}
   try{
    record.entry=parse(record.key,record.raw,userId);
    const prior=groups.get(record.key);
    if(prior&&prior[0].raw!==record.raw){invalid.add(record.key);issues.push('conflicting_copies')}
    groups.set(record.key,[...(prior||[]),record]);
   }catch{invalid.add(record.key);issues.push('invalid_entry')}
  }
  const valid=[...groups.entries()].filter(([key])=>!invalid.has(key)).map(([,copies])=>copies);
  valid.sort((a,b)=>a[0].entry.createdAt.localeCompare(b[0].entry.createdAt)||a[0].key.localeCompare(b[0].key));
  const paused=new Map();
  for(const copies of valid){
   const entry=copies[0].entry,key=retryKey(userId,entry),states=[];
   for(const copy of retryCopies.get(key)||[]){
    try{const state=parsePause(copy.raw,userId,entry);if(state)states.push(state)}
    catch{states.push({kind:'review',code:'UNKNOWN'});issues.push('retry_state_invalid')}
   }
   const memory=volatilePauses.get(key);
   if(memory?.intentCreatedAt===entry.createdAt){states.push(memory);issues.push('retry_state_unpersisted')}
   if(states.length){
    const state=states.find(s=>s.kind==='review')||states[0];
    if(states.some(s=>s.kind!==state.kind))issues.push('retry_state_conflict');
    paused.set(copies[0].key,{questId:entry.questId,operationId:entry.operationId,kind:state.kind,code:state.code});
   }
  }
  for(const kind of new Set(issues))report(kind);
  return {groups:valid,issues:[...new Set(issues)],invalid,complete:readable===2,paused,retryCopies};
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
 // This is not acknowledgement of changed evidence. Preserve the entire later
 // capture with the exact server receipt before retiring the redundant record.
 async function archiveRecreatedCapture(userId,entry,committed,{sessionValid=()=>true}={}){
  const originalReceipt=committed?.receipt,saved=committed?.profile?.canonicalQuestState?.[entry?.questId];
  let receipt=originalReceipt,reward=entry?.reward;
  const keys=(value,allowed)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key));
  if(receipt?.request?.version===2){
   const request=receipt.request,facts=request.facts,later=reward?.facts;
   const factKeys=['seconds','assistanceUsed','mistakeCommitted','qualifying','hintUsed','challengeFailed','qualifiedDay','qualifiedAt'];
   const validFacts=value=>keys(value,factKeys)&&Object.keys(value).length===factKeys.length&&Number.isSafeInteger(value.seconds)&&value.seconds>=0&&
    factKeys.slice(1,6).every(key=>typeof value[key]==='boolean')&&typeof value.qualifiedDay==='string'&&Number.isFinite(Date.parse(value.qualifiedAt));
   if(!keys(reward,['facts','badges','performance','stars'])||!validFacts(facts)||!validFacts(later)||later.seconds<facts.seconds||
    !factKeys.filter(key=>key!=='seconds').every(key=>later[key]===facts[key])||
    !Number.isSafeInteger(receipt.outcome?.attempts)||receipt.outcome.attempts<1||!(saved?.runPerformance?.attempts>=receipt.outcome.attempts)||
    (reward.stars!==undefined&&(!Number.isSafeInteger(reward.stars)||reward.stars<1)))throw Error('Recreated V2 capture proof unconfirmed');
   const performance={seconds:facts.seconds,bestTime:facts.seconds,assisted:facts.assistanceUsed};
   receipt={version:1,operationId:request.operationId,questId:request.questId,newlyCompleted:receipt.outcome.firstCompletion,
    recordedAt:receipt.recordedAt,badges:receipt.outcome.savedPerformance?.badges,performance};
   reward={badges:reward.badges||{},performance:reward.performance||{seconds:later.seconds,bestTime:later.seconds,assisted:later.assistanceUsed},stars:1};
   if(reward.performance.seconds!==later.seconds||reward.performance.assisted!==later.assistanceUsed)throw Error('Recreated V2 performance mismatch');
  }
  const validReward=value=>keys(value,['badges','performance','stars'])&&value.stars===1&&
   keys(value.badges,['autonomy','speed','noError','mastery'])&&Object.values(value.badges).every(v=>typeof v==='boolean')&&
   keys(value.performance,['seconds','bestTime','assisted'])&&typeof value.performance.assisted==='boolean'&&
   Number.isFinite(value.performance.seconds)&&value.performance.seconds>=0&&value.performance.seconds===value.performance.bestTime;
  const accepted={badges:receipt?.badges,performance:receipt?.performance,stars:1};
  if(namespace!=='Canonical'||!keys(entry,['version','operationId','userId','questId','reward','createdAt'])||entry.version!==2||entry.userId!==userId||committed?.userId!==userId||!sessionValid()||!entry?.operationId||receipt?.version!==1||
   receipt.operationId!==entry.operationId||receipt.questId!==entry.questId||typeof receipt.newlyCompleted!=='boolean'||
   !Number.isFinite(Date.parse(receipt.recordedAt))||!saved?.solved||!validReward(reward)||!validReward(accepted)||
   !Object.keys(accepted.badges).every(key=>!accepted.badges[key]||saved.badges?.[key]===true||saved.badges?.[key]===1)||
   !Object.keys(reward.badges).every(key=>!reward.badges[key]||(receipt.badges[key]===true&&(saved.badges?.[key]===true||saved.badges?.[key]===1)))||
   reward.performance.seconds<accepted.performance.seconds||
   (accepted.performance.assisted&&!reward.performance.assisted))throw Error('Recreated capture proof unconfirmed');
  const normalize=value=>value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])])):value;
  const exact=JSON.stringify(normalize(reward))===JSON.stringify(normalize(accepted));
  if(!exact&&Date.parse(entry.createdAt)<Date.parse(receipt.recordedAt))throw Error('Capture predates committed receipt');
  const inspection=await scan(userId),target=inspection.groups.find(copies=>copies[0].entry.operationId===entry.operationId&&copies[0].entry.questId===entry.questId);
  if(!inspection.complete||inspection.issues.length||!target||JSON.stringify(target[0].entry)!==JSON.stringify(entry))throw Error('Recreated capture storage unconfirmed');
  const key='lumenCanonicalRecreatedCaptureArchiveV1:'+userId+':'+entry.operationId+':'+encodeURIComponent(entry.createdAt);
  const raw=JSON.stringify({version:1,userId,entry,receipt:originalReceipt,copies:target.map(copy=>({store:copy.store,raw:copy.raw}))});
  let archived=false;
  try{await fallback.put(key,raw);archived=await fallback.get(key)===raw}catch{}
  if(!archived){
   const prior=storage.getItem(key);if(prior!==null&&prior!==raw)throw Error('Capture archive changed');
   storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Capture archive unconfirmed');
  }
  if(!sessionValid())throw Error('Canonical archive session changed');
  await acknowledge(userId,entry.questId,entry.reward,entry.operationId,{expectedEntry:entry,sessionValid});
  report('recreated_capture_archived');
 }
 async function acknowledge(userId,questId,expectedReward,operationId,{expectedEntry,sessionValid=()=>true}={}){
  const inspection=await scan(userId);
  const target=inspection.groups.find(group=>group[0].entry.questId===questId&&(operationId===undefined?group[0].entry.operationId===undefined:group[0].entry.operationId===operationId));
  if(!target){
   if(inspection.invalid.size)throw Error('Outbox intent requires recovery');
   return;
  }
  const copies=target,key=copies[0].key;
  if(!sessionValid()||(expectedEntry&&JSON.stringify(copies[0].entry)!==JSON.stringify(expectedEntry)))throw Error('Outbox changed before archival cleanup');
  if(expectedReward!==undefined&&copies.some(copy=>JSON.stringify(copy.entry.reward)!==JSON.stringify(expectedReward)))throw Error('Outbox reward changed before acknowledgement');
  await removeCopies(copies,key);
  const stateKey=retryKey(userId,copies[0].entry);
  volatilePauses.delete(stateKey);
  await removeCopies(inspection.retryCopies.get(stateKey)||[],stateKey);
 }
 async function removeCopies(copies,key){
  for(const copy of copies){
   if(copy.store==='indexed')await fallback.remove(key,copy.raw);
   else{
    if(storage.getItem(key)!==copy.raw)throw Error('Outbox changed before acknowledgement');
    storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('Outbox acknowledgement not removed');
   }
  }
 }
 async function pause(userId,entry,error){
  const classification=classifyCanonicalRecoveryError(error);
  if(classification.kind==='retry')return;
  const inspection=await scan(userId);
  const copies=inspection.groups.find(group=>group[0].entry.questId===entry.questId&&group[0].entry.operationId===entry.operationId);
  if(!copies)return;
  if(copies[0].entry.createdAt!==entry.createdAt||JSON.stringify(copies[0].entry.reward)!==JSON.stringify(entry.reward))throw Error('Intent changed before pause');
  if(inspection.paused.has(copies[0].key))return;
  const key=retryKey(userId,entry),state={version:1,userId,questId:entry.questId,operationId:entry.operationId??null,intentCreatedAt:entry.createdAt,kind:classification.kind,code:classification.code},raw=JSON.stringify(state);
  volatilePauses.set(key,state);
  try{
   try{await fallback.put(key,raw);if(await fallback.get(key)!==raw)throw Error('Retry state not verified')}
   catch{
    const existing=storage.getItem(key);
    if(existing!==null&&existing!==raw)throw Error('Retry state changed');
    storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Retry state not verified');
   }
   volatilePauses.delete(key);
  }catch{report('retry_state_unpersisted');throw Error('Retry pause only held in this session')}
 }
 async function resume(userId,{kind='all'}={}){
  if(!['all','auth'].includes(kind))throw Error('Invalid retry resume');
  const inspection=await scan(userId);
  for(const copies of inspection.groups){
   const held=inspection.paused.get(copies[0].key);
   if(!held||(kind!=='all'&&held.kind!==kind))continue;
   const key=retryKey(userId,copies[0].entry);
   // Explicit retry may reset malformed policy metadata, never the intention.
   if(kind!=='all')for(const copy of inspection.retryCopies.get(key)||[])parsePause(copy.raw,userId,copies[0].entry);
   await removeCopies(inspection.retryCopies.get(key)||[],key);volatilePauses.delete(key);
  }
 }
 async function inspect(userId){
  const result=await scan(userId),pending=result.groups.map(copies=>copies[0].entry),paused=[...result.paused.values()];
  const authRequired=paused.some(state=>state.kind==='auth'),blocked=new Set(),retryable=[];
  for(const copies of result.groups){
   const entry=copies[0].entry;
   if(result.paused.has(copies[0].key))blocked.add(entry.questId);
   if(!authRequired&&!blocked.has(entry.questId))retryable.push(entry);
  }
  return {pending,paused,retryable,authRequired,issues:result.issues,complete:result.complete};
 }
 return {domain:namespace,enqueue,acknowledge,archiveRecreatedCapture,pause,resume,pending:async userId=>(await scan(userId)).groups.map(copies=>copies[0].entry),inspect};
}
