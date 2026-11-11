import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser(),results=[];
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('lumenQaProgressV1',JSON.stringify({catalogueOrigin:1,badges:{},stars:{},challenges:{},performances:{},solved:Object.fromEntries(Array.from({length:80},(_,i)=>[i,1])),shards:80,autoCrossUnlockSeen:1,fullBadgeIntroSeen:1}));localStorage.setItem('lumenSound','off')`});
 await navigateAndWait({send,evaluate},'Page.navigate',{url:url.href});
 await evaluate(`window.dragTrace=[];for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lumen-guardian-toggle'])document.addEventListener(type,e=>{window.dragTrace.push({type,at:performance.now(),id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target.className,row:lumenDiagnostics.snapshot().state[0]});if(window.dragTrace.length>20)window.dragTrace.shift()},{capture:true})`);
 for(const width of [320,390,1440])for(const auto of [false,true]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:900,mobile:width<600,deviceScaleFactor:1});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
  await evaluate('lumenDiagnostics.setupQuest(70)');await acknowledgeLearningMilestones(evaluate);
  await evaluate(`window.confirm=()=>true;document.getElementById('new').click();for(const id of ['questStart','manualCrossTip','autonomyOverlay'])document.getElementById(id).hidden=true;if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click();document.getElementById('guidedErrors').checked=false;document.getElementById('autoCross').checked=${auto};document.getElementById('board').scrollIntoView({block:'center'});window.dragNodes=[...document.querySelectorAll('#board .cell')];`);
  for(const speed of ['fast','slow','repeated']){
  // Let the previous gesture's intentional synthetic-click suppression end.
  await evaluate('new Promise(resolve=>setTimeout(resolve,20))',true);
  await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(Array.from({length:s.n},()=>Array(s.n).fill(0)));window.dragNodes=[...document.querySelectorAll("#board .cell")];})()');
  // The actual Guardian handler starts its real cascade, then the very next
  // native touch jumps from one end of a row to the other in a single move.
  await evaluate(`(()=>{const s=lumenDiagnostics.snapshot(),cell=document.querySelector('.cell[data-row="0"][data-col="'+s.puz.sol[0]+'"]');cell.click();cell.click()})()`);
  assert(await evaluate("!!document.querySelector('#board .guardian-impact')"),'Real placement animation is active '+JSON.stringify(await evaluate('({snapshot:lumenDiagnostics.snapshot(),reduced:matchMedia("(prefers-reduced-motion: reduce)").matches,mask:document.getElementById("attemptMask").hidden})')));
  const points=await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();return [0,s.n-1].map(c=>{const r=document.querySelector('.cell[data-row="0"][data-col="'+c+'"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
  if(speed==='slow')for(const ratio of [.2,.4,.6,.8]){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:points[0].x+(points[1].x-points[0].x)*ratio,y:points[0].y}]});await new Promise(r=>setTimeout(r,35))}
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[points[1]]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert((await evaluate('lumenDiagnostics.snapshot().state[0]')).every(v=>v===1||v===2),'Every crossed cell must be marked during the cascade '+JSON.stringify({width,auto,speed,points,trace:await evaluate('dragTrace')}));
  assert(await evaluate('[...document.querySelectorAll("#board .cell")].every((el,i)=>el===dragNodes[i])'),'Drag and animation preserve cell nodes');
  assert.equal(await evaluate('lumenDiagnostics.snapshot().state[0].filter(v=>v===2).length'),1,'Guardian remains intact');
  await evaluate("document.getElementById('undo').click()");
  assert((await evaluate('lumenDiagnostics.snapshot().state[0]')).every(v=>v===0||v===2),'One undo restores the entire gesture');
  results.push({width,autoCross:auto,nativeTouch:true,speed,animationActive:true,undo:true});
  }
 }
 assert.deepEqual(errors,[]);if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,physicalDevice:false},null,2));console.log(JSON.stringify(results));
}finally{await send('Browser.close').catch(()=>{})}
