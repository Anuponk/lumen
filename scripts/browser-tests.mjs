// Requires a local static server and an isolated Chrome debugging profile.
import fs from 'node:fs';
import {connectBrowser,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {verifyFinaleResponsive} from './finale-responsive-browser.mjs';
import {verifyBoardFeedback} from './board-feedback-browser.mjs';
import {verifyQuestPolicy} from './quest-policy-browser.mjs';
const {send,evaluate,errors}=await connectBrowser();
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
 if(fixture.identifier)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier}).catch(error=>{if(!String(error).includes('Script not found'))throw error});
 await sleep(1500);
 console.log('browser-test: embedded-regressions:start');
 const suites=await evaluate('lumenDiagnostics.runAllHintTests()',true);
 console.log('browser-test: embedded-regressions:done');
 assert(suites.every(s=>s.total>=66&&!s.failures.length),'Embedded regressions: '+JSON.stringify(suites));
 await acknowledgeLearningMilestones(evaluate);
 console.log('browser-test: setup-quest');
 await evaluate('lumenDiagnostics.setupQuest(2)');
 await acknowledgeLearningMilestones(evaluate);
 console.log('browser-test: setup-quest:done');
 // #315: detect clipped game controls and accidental document/game scrolling.
 const responsiveViewports=[
  [320,568,true],[375,667,true],[390,844,true],[412,732,true],
  [768,1024,false],[1366,768,false],[1366,600,false]
 ];
 const responsiveResults=[],responsiveFailures=[];
 for(const [width,height,mobile] of responsiveViewports){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await sleep(120);
  const geometry=await evaluate(`(()=>{
   const selectors=['#new','#undo','#verify','#hint','#board','#autoCrossWrap'];
   const visible=node=>{const style=getComputedStyle(node);return style.display!=='none'&&style.visibility!=='hidden'&&!node.closest('[hidden]')};
   const elements=selectors.map(selector=>{
    const node=document.querySelector(selector);if(!node||!visible(node))return null;
    const r=node.getBoundingClientRect(),font=parseFloat(getComputedStyle(node).fontSize);
    return {selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,font};
   }).filter(Boolean);
   const root=document.documentElement,app=document.querySelector('.app'),core=document.querySelector('.game-core');
   const overflows=[['document',root],['app',app],['game-core',core]].filter(([,el])=>el).map(([name,el])=>({name,x:el.scrollWidth-el.clientWidth,y:el.scrollHeight-el.clientHeight}));
   const cell=document.querySelector('#board .cell'),r=cell?.getBoundingClientRect();
   return {viewport:[innerWidth,innerHeight],elements,overflows,cell:r?{w:r.width,h:r.height}:null};
  })()`,true);
  if(geometry.elements.length<5)responsiveFailures.push('Missing controls '+width+'x'+height+': '+JSON.stringify(geometry));
  for(const el of geometry.elements){
   if(!(el.left>=-2&&el.top>=-2&&el.right<=width+2&&el.bottom<=height+2))
    responsiveFailures.push('Clipped '+width+'x'+height+': '+JSON.stringify(el));
   if(['#undo','#verify','#hint'].includes(el.selector)&&el.font<12)
    responsiveFailures.push('Unreadable '+width+'x'+height+': '+JSON.stringify(el));
  }
  if(!geometry.overflows.every(o=>o.x<=2&&o.y<=2))
   responsiveFailures.push('Overflow '+width+'x'+height+': '+JSON.stringify({overflows:geometry.overflows,elements:geometry.elements}));
  if(!geometry.cell||Math.abs(geometry.cell.w-geometry.cell.h)>2)
   responsiveFailures.push('Non-square grid '+width+'x'+height+': '+JSON.stringify(geometry.cell));
  responsiveResults.push(geometry);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await sleep(150);
 assert(responsiveFailures.length===0,'#315 viewport matrix failed:\n'+responsiveFailures.join('\n'));
 const snapshot=()=>evaluate('lumenDiagnostics.snapshot()');
 const point=async(r,c)=>evaluate(`(()=>{const rect=document.querySelector('.cell[data-row="${r}"][data-col="${c}"]').getBoundingClientRect();return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}})()`);
 const tap=async p=>{await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(50)};
 console.log('browser-test: snapshot:start');
 const initial=await snapshot();console.log('browser-test: snapshot:done');const column=initial.puz.sol[0];console.log('browser-test: point:start');const p=await point(0,column);console.log('browser-test: point:done');
 for(const expected of [1,2,0]){console.log('browser-test: tap:start',expected);await tap(p);console.log('browser-test: tap:done',expected);const snap=await snapshot();console.log('browser-test: tap:snapshot',expected);const actual=snap.state[0][column];if(actual!==expected){const target=await evaluate(`document.elementFromPoint(${p.x},${p.y})?.outerHTML`);throw Error('Tap cycle regression: expected '+expected+', got '+actual+'; target '+target)}}
 assert(await evaluate('document.getElementById("guidedCard").hidden'),'The correct placement cycle must not trigger a guided conflict');
 console.log('browser-test: guardian-setup:start');await tap(p);await tap(p);console.log('browser-test: guardian-setup:done');
 console.log('browser-test: observer:start');await evaluate('window.lumenBoardRebuilt=false;window.lumenBoardObserver=new MutationObserver(records=>{if(records.some(record=>record.target===document.getElementById("board")&&record.type==="childList"))window.lumenBoardRebuilt=true});lumenBoardObserver.observe(document.getElementById("board"),{childList:true})');console.log('browser-test: observer:done');
 console.log('browser-test: scroll:start');const scroll=await evaluate('scrollY');console.log('browser-test: scroll:done');
 console.log('browser-test: drag-points:start');const dragPoints=[];for(const c of [0,1,2,3,4])dragPoints.push(await point(1,c));console.log('browser-test: drag-points:done');
 console.log('browser-test: drag:start');await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[dragPoints[0]]});
 for(let c=1;c<dragPoints.length;c++){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[dragPoints[c]]});await sleep(30)}
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});console.log('browser-test: drag:done');
 await sleep(100);console.log('browser-test: drag-snapshot:start');const dragged=await snapshot();console.log('browser-test: drag-snapshot:done');
 assert(dragged.state[1].filter(v=>v===1).length>=4&&dragged.state[0][column]===2,'Drag regression');
 console.log('browser-test: drag-scroll-check:start');assert(await evaluate('scrollY')===scroll,'Board scrolled during drag');console.log('browser-test: drag-scroll-check:done');
 console.log('browser-test: drag-rebuild-check:start');assert(await evaluate('!window.lumenBoardRebuilt'),'Drag rebuilt the board');console.log('browser-test: drag-rebuild-check:done');
 console.log('browser-test: observer-disconnect:start');await evaluate('lumenBoardObserver.disconnect()');console.log('browser-test: observer-disconnect:done');
 console.log('browser-test: reset-click:start');await send('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});await evaluate('window.confirm=()=>true;document.getElementById("new").click()');console.log('browser-test: reset-click:done');
 console.log('browser-test: reset-snapshot:start');const resetSnapshot=await snapshot();console.log('browser-test: reset-snapshot:done');assert(resetSnapshot.levelIndex===2&&resetSnapshot.state.flat().every(v=>v===0),'Reset changed quest');
 const progressBefore=await evaluate('localStorage.getItem("lumenProgressV1")');
 await send('Page.reload',{ignoreCache:true});await sleep(1500);
 assert(await evaluate('localStorage.getItem("lumenProgressV1")')===progressBefore,'Progress lost on reload');
 // Chrome's ignoreCache reload bypasses the controller; test normal navigation too.
 await send('Page.reload',{ignoreCache:false});await sleep(1500);
 console.log('browser-test: pwa:start');
 const pwa=await evaluate(`(async()=>{
  const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Service worker not ready')),5000))]);
  const manifestURL=document.querySelector('link[rel="manifest"]').href;
  const manifest=await(await fetch(manifestURL)).json();
  const resources=[manifestURL,registration.active.scriptURL,...manifest.icons.map(icon=>new URL(icon.src,location.href).href),...performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>name.startsWith(location.origin+'/src/'))];
  const assets=await Promise.all([...new Set(resources)].map(async url=>{const response=await fetch(url);if(!response.ok)throw Error('PWA asset failed: '+url);return new URL(url).pathname}));
  return {registered:!!registration.active,controlled:!!navigator.serviceWorker.controller,display:manifest.display,startURL:manifest.start_url,assets};
 })()`,true);
 console.log('browser-test: pwa:done');
 assert(pwa.registered&&pwa.controlled&&pwa.display==='standalone'&&pwa.startURL==='/'&&pwa.assets.includes('/src/main.js'),'PWA regression: '+JSON.stringify(pwa));
 const finaleResponsive=await verifyFinaleResponsive({send,evaluate},url);
 const boardFeedback=await verifyBoardFeedback({send,evaluate});
 const questPolicy=await verifyQuestPolicy({send,evaluate},url);
 assert(errors.length===0,'Uncaught browser errors: '+JSON.stringify(errors));
 const report={suites,mobile:{tapCycle:[1,2,0],drag:true,guardianPreserved:true,noScroll:true,reset:true},guestReload:true,pwa,finaleResponsive,boardFeedback,questPolicy,uncaughtErrors:errors};
 if(output)fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{await send('Browser.close')}
