// #829: WebKit (Playwright) smoke tests for the critical iPhone paths. Not part
// of the required quality gate: run by .github/workflows/webkit-smoke.yml
// (manual + nightly) until its duration and stability are measured. WebKit on
// Linux/Windows does not reproduce Safari iOS exactly: a real iPhone remains part
// of the acceptance. Usage: node scripts/webkit-smoke-tests.mjs [report.json]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

let webkit;
try{({webkit}=await import('playwright-core'))}catch{
 console.log('WebKit smoke skipped: playwright-core is not installed (npm i --no-save playwright-core@1.65.1 && npx playwright-core install webkit).');
 process.exit(process.env.LUMEN_WEBKIT_REQUIRED==='1'?1:0);
}
const root=path.resolve('.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,pathname==='/'?'index.html':pathname.replace(/^\/+/,''));
 if(path.relative(root,file).startsWith('..')||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port+'/';
const started=Date.now(),results=[],pageErrors=[];
const browser=await webkit.launch();
const seed=()=>{localStorage.setItem('lumenTutorialSeen','1');localStorage.setItem('lumenTutorialCompletedV1','1');localStorage.setItem('lumenSound','off');localStorage.setItem('lumenIntroPresentedV1','1');
 if(!localStorage.getItem('lumenProgressV1'))localStorage.setItem('lumenProgressV1',JSON.stringify({solved:{0:1,1:1,2:1},historyBackup:{0:1,1:1,2:1},badges:{},stars:{},performances:{},noHint:{},xp:0,skyScore:0}))};
async function openQuest(page){
 await page.goto(base);await page.waitForFunction(()=>!!window.lumenDiagnostics&&document.querySelectorAll('#board .cell').length>0);
 await page.evaluate(()=>{lumenDiagnostics.setupQuest(3);for(const id of ['returnToast','manualCrossTip','autonomyOverlay'])document.getElementById(id)?.setAttribute('hidden','')});
}
try{
 // 1. Quest opening, board and touch interaction on an iPhone portrait viewport.
 {
  const context=await browser.newContext({viewport:{width:390,height:664},hasTouch:true});await context.addInitScript(seed);
  const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(String(e.message).slice(0,200)));
  await openQuest(page);
  const n=await page.evaluate(()=>lumenDiagnostics.snapshot().n);assert.equal(await page.locator('#board .cell').count(),n*n,'Full grid rendered');
  await page.evaluate(()=>{const m=document.getElementById('attemptMask');if(m&&!m.hidden)m.click()});
  await page.locator('#board .cell').first().tap();
  assert.notEqual(await page.evaluate(()=>lumenDiagnostics.snapshot().state[0][0]),0,'A tap changes the cell');
  // 2. Hint: a player-facing message, never an internal solver verdict (#828).
  await page.locator('#hint').click();
  const hintText=await page.evaluate(()=>document.getElementById('msg').textContent+' '+(document.getElementById('hintMessage')?.textContent||''));
  assert.doesNotMatch(hintText,/solveur explicable|catalogue/,'No internal solver message');
  results.push('portrait: quest, touch, hint');
  await context.close();
 }
 // 3. Short landscape (#830): grid and controls fully visible, no overlap.
 for(const [width,height] of [[844,340],[667,320]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:true});await context.addInitScript(seed);
  const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(String(e.message).slice(0,200)));
  await openQuest(page);
  const g=await page.evaluate(()=>{const b=document.getElementById('board').getBoundingClientRect();const buttons=[...document.querySelectorAll('.actions button')].filter(e=>e.offsetParent).map(e=>e.getBoundingClientRect());
   return {vh:innerHeight,vw:innerWidth,sw:document.documentElement.scrollWidth,board:{y:b.y,b:b.bottom,w:b.width},buttons:buttons.map(r=>({y:r.y,b:r.bottom}))}});
  assert(g.board.y>=0&&g.board.b<=g.vh+0.5&&g.board.w>=200,`${width}×${height}: grid visible (${JSON.stringify(g.board)})`);
  assert(g.buttons.length===4&&g.buttons.every(r=>r.y>=0&&r.b<=g.vh+0.5),`${width}×${height}: controls visible`);
  assert.equal(g.sw,g.vw,`${width}×${height}: no horizontal scroll`);
  results.push(`landscape ${width}×${height}: grid ${Math.round(g.board.w)} px`);
  await context.close();
 }
 // 4. Offline after a first visit: the guest board still opens (#847).
 {
  const context=await browser.newContext({viewport:{width:390,height:664}});await context.addInitScript(seed);
  const page=await context.newPage();page.on('pageerror',e=>pageErrors.push(String(e.message).slice(0,200)));
  await openQuest(page);
  const sw=await page.evaluate(async()=>{try{await Promise.race([navigator.serviceWorker?.ready,new Promise(r=>setTimeout(r,8000))]);return !!navigator.serviceWorker?.controller}catch{return false}});
  if(sw){
   await page.waitForTimeout(1500);await context.setOffline(true);await page.reload();
   await page.waitForFunction(()=>document.querySelectorAll('#board .cell').length>0,null,{timeout:15000});
   assert.equal(await page.evaluate(()=>document.getElementById('accountSwitchHold').hidden),true,'No neutral hold for an offline guest');
   results.push('offline guest reload');
  }else results.push('offline guest reload: skipped (no service worker controller in this WebKit build)');
  await context.close();
 }
 assert.deepEqual(pageErrors,[],'No uncaught page error in WebKit');
}finally{await browser.close();server.close()}
const report={engine:'webkit',playwright:'1.65.1',results,durationMs:Date.now()-started,realIphone:false};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
