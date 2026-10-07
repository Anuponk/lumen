// Test fixtures enter quests directly. Acknowledge teaching milestones through
// their real buttons before exercising the board or opening another modal.
export async function acknowledgeLearningMilestones(evaluate){
 return evaluate(`(()=>{
  const acknowledged=[];
  for(const [overlayId,buttonId] of [["badgeUnlockOverlay","badgeUnlockOk"],["autoCrossUnlockOverlay","autoCrossUnlockOk"]]){
   const overlay=document.getElementById(overlayId);
   if(overlay&&!overlay.hidden){document.getElementById(buttonId).click();if(!overlay.hidden)throw Error("Milestone did not close: "+overlayId);acknowledged.push(overlayId)}
  }
  return acknowledged;
 })()`);
}

export async function connectBrowser(){
 const endpoint=process.env.LUMEN_CDP_URL||'http://127.0.0.1:9222';
 let page=null;
 for(let attempt=0;attempt<40&&!page;attempt++){
  try{
   const targets=await(await fetch(endpoint+'/json')).json();
   page=targets.find(t=>t.type==='page'&&t.webSocketDebuggerUrl)||null;
  }catch(_){}
  if(!page)await new Promise(resolve=>setTimeout(resolve,250));
 }
 if(!page)throw Error("No CDP page target available after 10s at "+endpoint);
 const ws=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise(resolve=>ws.onopen=resolve);
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=event=>{
  const message=JSON.parse(event.data);
  if(message.id){pending.get(message.id)?.(message);pending.delete(message.id)}
  else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
  else if(message.method==='Runtime.consoleAPICalled'){const values=(message.params.args||[]).map(a=>a.value??a.description);if(values.some(v=>String(v).startsWith('lumen-init:')))console.log(...values)}
 };
 function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;const timeout=setTimeout(()=>{pending.delete(key);reject(Error("CDP timeout after 15s: "+method))},15000);pending.set(key,message=>{clearTimeout(timeout);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result)});ws.send(JSON.stringify({id:key,method,params}))})}
 async function evaluate(expression,awaitPromise=false){const result=await send('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||JSON.stringify(result.exceptionDetails));return result.result.value}
 return {send,evaluate,errors};
}
