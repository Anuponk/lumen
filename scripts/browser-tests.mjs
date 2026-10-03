// Requires a local static server and an isolated Chrome debugging profile.
import fs from 'node:fs';
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
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function assert(value,message){if(!value)throw Error(message)}
const url=process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/';
const output=process.argv[2];
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("lumenProgressV1",JSON.stringify({solved:{0:1,1:1},badges:{}}));localStorage.setItem("lumenSound","off");localStorage.setItem("lumenInstallLater",String(Date.now()));localStorage.setItem("lumenPushChoice","later");'});
 await send('Page.navigate',{url});
 for(let attempt=0;attempt<100;attempt++){if(await evaluate('!!window.lumenDiagnostics'))break;await sleep(100)}
 assert(await evaluate('!!window.lumenDiagnostics'),'Application did not start: '+JSON.stringify(errors));
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
 await sleep(1500);
 const suites=await evaluate('lumenDiagnostics.runAllHintTests()',true);
 assert(suites.every(s=>s.total>=66&&!s.failures.length),'Embedded regressions: '+JSON.stringify(suites));
 await evaluate('lumenDiagnostics.setupQuest(2)');
 const snapshot=()=>evaluate('lumenDiagnostics.snapshot()');
 const point=async(r,c)=>evaluate(`(()=>{const rect=document.querySelector('.cell[data-row="${r}"][data-col="${c}"]').getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}})()`);
 const tap=async p=>{await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(50)};
 const initial=await snapshot(),column=initial.puz.sol[0],p=await point(0,column);
 for(const expected of [1,2,0]){await tap(p);const actual=(await snapshot()).state[0][column];assert(actual===expected,'Tap cycle regression: expected '+expected+', got '+actual+'; target '+await evaluate(`document.elementFromPoint(${p.x},${p.y})?.outerHTML`))}
 await tap(p);await tap(p);
 await evaluate('window.lumenBoardRebuilt=false;window.lumenBoardObserver=new MutationObserver(records=>{if(records.some(record=>record.target===document.getElementById("board")&&record.type==="childList"))window.lumenBoardRebuilt=true});lumenBoardObserver.observe(document.getElementById("board"),{childList:true})');
 const scroll=await evaluate('scrollY');
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await point(1,0)]});
 for(const c of [1,2,3,4]){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[await point(1,c)]});await sleep(30)}
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await sleep(100);const dragged=await snapshot();
 assert(dragged.state[1].filter(v=>v===1).length>=4&&dragged.state[0][column]===2,'Drag regression');
 assert(await evaluate('scrollY')===scroll,'Board scrolled during drag');
 assert(await evaluate('!window.lumenBoardRebuilt'),'Drag rebuilt the board');
 await evaluate('lumenBoardObserver.disconnect()');
 await evaluate('document.getElementById("new").click()');
 assert((await snapshot()).levelIndex===2&&(await snapshot()).state.flat().every(v=>v===0),'Reset changed quest');
 const progressBefore=await evaluate('localStorage.getItem("lumenProgressV1")');
 await send('Page.reload',{ignoreCache:true});await sleep(1500);
 assert(await evaluate('localStorage.getItem("lumenProgressV1")')===progressBefore,'Progress lost on reload');
 assert(errors.length===0,'Uncaught browser errors: '+JSON.stringify(errors));
 const report={suites,mobile:{tapCycle:[1,2,0],drag:true,guardianPreserved:true,noScroll:true,reset:true},guestReload:true,uncaughtErrors:errors};
 if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{await send('Browser.close')}
