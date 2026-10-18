// Bounded exponential retry, shared by online/resume and background recovery.
// No player data is stored here; durable intents remain in the outbox.
export function createCloudRetryScheduler({run,ready=()=>true,setTimer=setTimeout,clearTimer=clearTimeout,random=Math.random,baseMs=2000,maxMs=60000,onError=()=>{}}){
 let timer=null,inFlight=null,generation=0,failures=0;
 function cancel(){generation++;if(timer!==null)clearTimer(timer);timer=null;inFlight=null;failures=0}
 function schedule(){
  if(timer!==null||inFlight||!ready())return;
  const cap=Math.min(maxMs,baseMs*2**Math.min(failures++,16));
  const delay=Math.min(maxMs,Math.round(cap*(0.5+Math.max(0,Math.min(1,random()))*0.5)));
  timer=setTimer(()=>{timer=null;void wake()},delay);
 }
 function wake(){
  if(!ready())return Promise.resolve(false);
  if(inFlight)return inFlight;
  if(timer!==null){clearTimer(timer);timer=null}
  const current=generation;
  const pending=Promise.resolve().then(run).catch(()=>{try{onError()}catch{}return true});
  inFlight=pending;
  return pending.finally(()=>{
   if(current!==generation||inFlight!==pending)return;
   inFlight=null;
  }).then(retry=>{
   if(current!==generation)return false;
   if(retry)schedule();else failures=0;
   return retry;
  });
 }
 return {wake,schedule,cancel};
}
