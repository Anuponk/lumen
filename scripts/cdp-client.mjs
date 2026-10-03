export async function connectBrowser(){
 const endpoint=process.env.LUMEN_CDP_URL||'http://127.0.0.1:9222';
 const targets=await(await fetch(endpoint+'/json')).json();
 const ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(resolve=>ws.onopen=resolve);
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=event=>{
  const message=JSON.parse(event.data);
  if(message.id){pending.get(message.id)?.(message);pending.delete(message.id)}
  else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
 };
 function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,message=>message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result));ws.send(JSON.stringify({id:key,method,params}))})}
 async function evaluate(expression,awaitPromise=false){const result=await send('Runtime.evaluate',{expression,awaitPromise,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||JSON.stringify(result.exceptionDetails));return result.result.value}
 return {send,evaluate,errors};
}
