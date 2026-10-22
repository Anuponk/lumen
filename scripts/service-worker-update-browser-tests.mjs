// Real service-worker and HTTP-cache upgrade, with a synthetic app and no RPC.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {connectBrowser} from './cdp-client.mjs';
const oldWorker=execFileSync('git',['show','df340a64930254c6697b0f066d35873df0debdcc:sw.js'],{encoding:'utf8'});
const worker=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const {send,evaluate}=await connectBrowser();
let revision=1,upgrade=false,offline=false;const requests=[];
const server=http.createServer((req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname;
 requests.push({path,revision});
 if(path==='/sw.js'){
  res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(upgrade?worker:oldWorker);return;
 }
 if(path==='/src/main.js'||path==='/src/persistence/cloud-profile.js'){
  if(offline){req.socket.destroy();return}
  res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'public,max-age=3600'});
  res.end(path==='/src/main.js'?"import '/src/persistence/cloud-profile.js';":`window.codeRevision=${revision};`);return;
 }
 if(path==='/'){
  if(offline){req.socket.destroy();return}
  res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
  res.end(`<meta name="lumen-build" content="${revision}"><script type="module" src="/src/main.js"></script><script>
   const controlled=!!navigator.serviceWorker.controller;
   navigator.serviceWorker.addEventListener('controllerchange',()=>{if(controlled)location.reload()});
   navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
  </script>`);return;
 }
 res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');
});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){
 for(let i=0;i<100;i++){try{if(await evaluate(expression,true))return}catch{}await sleep(100)}
 throw Error('PWA update timed out: '+expression+'; '+JSON.stringify(await evaluate(`({html:document.querySelector('meta')?.content,module:window.codeRevision})`)));
}
const progress=JSON.stringify({solved:{0:1},shards:7}),attempt='synthetic-active-attempt',intent={operationId:'pending-reset-0',userId:'fixture',questId:'q'};
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.navigate',{url:origin+'/?phase=1'});
 await until('window.codeRevision===1&&!!navigator.serviceWorker.controller');
 await evaluate(`(async()=>{
  localStorage.setItem('lumenProgressV1',${JSON.stringify(progress)});
  localStorage.setItem('lumenActiveAttemptV1',${JSON.stringify(attempt)});
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('lumen-canonical-outbox',1);r.onupgradeneeded=()=>r.result.createObjectStore('intents');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction('intents','readwrite');tx.objectStore('intents').put(${JSON.stringify(intent)},'pending');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
 })()`,true);
 // The old shipped worker can serve a fresh document with stale module imports.
 revision=2;await send('Page.navigate',{url:origin+'/?phase=2'});
 await until(`document.querySelector('meta')?.content==='2'&&!!window.codeRevision`);
 assert.equal(await evaluate('window.codeRevision'),1,'Reproduce the old worker/HTTP-cache mismatch');
 // Upgrade an already controlled tab, rather than merely testing a fresh install.
 upgrade=true;await evaluate('(async()=>{const r=await navigator.serviceWorker.ready;await r.update()})()',true);
 await until('window.codeRevision===2');
 await until(`(async()=>{const c=await caches.open('lumen-assets-v10');return !!(await c.match('/src/persistence/cloud-profile.js'))})()`);
 assert(requests.some(r=>r.path==='/src/persistence/cloud-profile.js'&&r.revision===2));
 // Subsequent releases need no worker-version bump to refresh transitive imports.
 revision=3;await send('Page.reload');await until(`document.querySelector('meta')?.content==='3'&&window.codeRevision===3`);
 await until(`(async()=>{const c=await caches.open('lumen-assets-v10');const r=await c.match('/src/persistence/cloud-profile.js');return r&&(await r.text()).includes('=3')})()`);
 // Warm the public query-free document too, then remove ALL network access to
 // the document/modules. A retained intent must survive this cold navigation.
 await send('Page.navigate',{url:origin+'/'});await until(`document.querySelector('meta')?.content==='3'&&window.codeRevision===3`);
 await until(`(async()=>{const c=await caches.open('lumen-assets-v10');const r=await c.match('/');return r&&(await r.text()).includes('content="3"')})()`);
 const epoch=await evaluate('performance.timeOrigin');
 offline=true;await send('Page.reload');await until(`performance.timeOrigin!==${epoch}&&window.codeRevision===3`);
 const after=await evaluate(`(async()=>{
  const db=await new Promise(resolve=>{const r=indexedDB.open('lumen-canonical-outbox',1);r.onsuccess=()=>resolve(r.result)});
  const intent=await new Promise(resolve=>{const r=db.transaction('intents').objectStore('intents').get('pending');r.onsuccess=()=>resolve(r.result)});db.close();
  return {progress:localStorage.getItem('lumenProgressV1'),attempt:localStorage.getItem('lumenActiveAttemptV1'),intent};
 })()`,true);
 assert.deepEqual(after,{progress,attempt,intent});
 const report={realServiceWorker:true,simulatedApp:true,liveCloudWrites:false,staleImportsReproduced:true,warmUpgrade:true,nextRelease:true,offlineAssets:true,offlineNavigation:true,playerStoragePreserved:true};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}catch(error){console.error(JSON.stringify({requests,controller:await evaluate(`navigator.serviceWorker.controller?.scriptURL`)}));throw error}
finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
process.exit(0);
