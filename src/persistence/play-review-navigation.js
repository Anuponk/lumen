// A positive read is only used by Mon ciel. The caller checks again before
// selecting a board and supplies the current account, client and generation.
export function createPlayReviewNavigation(context){
 let verified=null,revision=0;
 function clear(){verified=null;revision++}
 function matches(scope){
  const current=context();
  return !!current&&scope?.owner===current.owner&&scope.client===current.client&&scope.generation===current.generation;
 }
 async function refresh(){
  clear();
  const scope=context(),request=revision;
  if(!scope)return false;
  try{
   const read=scope.client.rpc('lumen_can_use_play_review',{p_expected_user_id:scope.owner});
   const {data,error}=await (read.abortSignal?.(AbortSignal.timeout(8000))??read);
   if(error||data!==true||request!==revision||!matches(scope))return false;
   verified=scope;
   return true;
  }catch{return false}
 }
 return {clear,refresh,available:()=>matches(verified)};
}

export function playReviewQuestDecision(standard,verified){
 return verified&&standard.status==='prerequisite'?{status:'ready',reason:'play-review'}:standard;
}
const attemptKey=(activeKey,owner,id)=>activeKey+':play-review:'+owner+':'+id;
export function hasPlayReviewAttempt(storage,activeKey,owner,id){
 try{return storage.getItem(attemptKey(activeKey,owner,id))!==null}catch{return false}
}

// Keep the normal attempt envelope so the existing engine restores the same
// board, active time, operation ID and qualification. The capability is never
// stored here. Local erasure removes these keys with the other Lumen attempts.
export function switchPlayReviewAttempt(storage,activeKey,owner,attempt,targetId){
 const keyFor=id=>attemptKey(activeKey,owner,id);
 const targetKey=keyFor(targetId),raw=storage.getItem(targetKey);
 const saved=raw===null?null:JSON.parse(raw);
 if(raw!==null&&(!saved?.attemptId||saved.questId!==targetId||!saved.startedAt||
    !['campaign','replay'].includes(saved.mode)||!['RUNNING','PAUSED'].includes(saved.state)))throw Error('Invalid saved attempt');
 if(attempt?.startedAt&&['campaign','replay'].includes(attempt.mode)&&['RUNNING','PAUSED'].includes(attempt.state)){
  const key=keyFor(attempt.questId),value=JSON.stringify({...attempt,state:'PAUSED'});
  const previous=storage.getItem(key);
  if(previous!==null&&JSON.parse(previous)?.attemptId!==attempt.attemptId)throw Error('Saved attempt conflict');
  storage.setItem(key,value);
  if(storage.getItem(key)!==value)throw Error('Attempt backup verification failed');
 }
 if(saved)storage.setItem(activeKey,raw);
 else storage.removeItem(activeKey);
 return {saved,commit(){if(saved&&storage.getItem(targetKey)===raw)storage.removeItem(targetKey)}};
}
