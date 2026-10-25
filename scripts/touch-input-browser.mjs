import assert from 'node:assert/strict';
import {acknowledgeLearningMilestones} from './cdp-client.mjs';

// Synthetic guest only: brief, consecutive taps across the whole board, including
// marked cells, small finger movement and points inside the cell borders.
export async function verifyTouchInput({send,evaluate}){
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await evaluate(`lumenDiagnostics.setupQuest(6)`);await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('questGo').click();document.getElementById('manualCrossTipOk').click();if(!document.getElementById('autonomyOverlay').hidden)document.getElementById('autonomyKeep').click();if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click();document.getElementById('guidedErrors').checked=false;document.getElementById('autoCross').checked=false;document.getElementById('board').scrollIntoView({block:'center'})`);
 const countdownWidths=[];
 for(const [width,height] of [[320,568],[360,640],[390,844],[768,1024],[1440,900]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,mobile:width<701,deviceScaleFactor:1});
  const geometry=await evaluate(`(()=>{const countdown=document.getElementById('speedCountdown'),saved=countdown.hidden,board=document.getElementById('board'),rect=()=>{const r=board.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};try{countdown.hidden=true;const hidden=rect();countdown.hidden=false;const shown=rect();return {hidden,shown}}finally{countdown.hidden=saved}})()`);
  assert.deepEqual(geometry.shown,geometry.hidden,'The speed countdown must not move the board under an in-flight touch at '+width+'px');
  countdownWidths.push(width);
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
 await evaluate(`document.getElementById('board').scrollIntoView({block:'center'})`);
 const cells=await evaluate(`Array.from(document.querySelectorAll('#board .cell'),el=>{const r=el.getBoundingClientRect();return {row:Number(el.dataset.row),col:Number(el.dataset.col),center:{x:r.x+r.width/2,y:r.y+r.height/2},border:{x:r.x+2,y:r.y+2}}})`);
 await evaluate(`window.touchInputAbort?.abort();window.touchInputAbort=new AbortController();window.touchInputTrace=[];for(const type of ['pointerdown','pointerup','pointercancel','click','lumen-guardian-toggle'])document.addEventListener(type,e=>{const cell=e.target.closest?.('.cell'),hit=document.elementFromPoint(e.clientX,e.clientY)?.closest('.cell');window.touchInputTrace.push({type,at:performance.now(),row:cell?.dataset.row,col:cell?.dataset.col,hit:hit&&[hit.dataset.row,hit.dataset.col],tag:e.target.tagName,cls:e.target.className,id:e.pointerId,x:e.clientX,y:e.clientY,width:e.width,height:e.height,boardTop:document.getElementById('board').getBoundingClientRect().top,scroll:scrollY,viewport:visualViewport&&{scale:visualViewport.scale,top:visualViewport.offsetTop}});if(window.touchInputTrace.length>12)window.touchInputTrace.shift()},{capture:true,signal:window.touchInputAbort.signal})`);
 let taps=0,layoutChanges=0;
 for(const cell of cells)for(const location of ['center','border'])for(const expected of [1,2,0]){
  const target=await evaluate(`(()=>{const el=document.querySelector('.cell[data-row="${cell.row}"][data-col="${cell.col}"]'),r=el.getBoundingClientRect(),p=${JSON.stringify(location)}==='center'?{x:r.x+r.width/2,y:r.y+r.height/2}:{x:r.x+2,y:r.y+2},hit=document.elementFromPoint(p.x,p.y)?.closest('.cell');return {p,hit:hit?{row:Number(hit.dataset.row),col:Number(hit.dataset.col)}:null,rect:r.toJSON(),scroll:scrollY}})()`);
  assert.deepEqual(target.hit,{row:cell.row,col:cell.col},`Visible ${location} target before touch: ${JSON.stringify(target)}`);
  const p=target.p;
  if(Math.hypot(p.x-cell[location].x,p.y-cell[location].y)>1)layoutChanges++;
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+3,y:p.y+2}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const actual=await evaluate(`lumenDiagnostics.snapshot().state[${cell.row}][${cell.col}]`);
  assert.equal(actual,expected,`Brief ${location} tap must transition exactly once at ${cell.row},${cell.col}`+(actual===expected?'':' '+JSON.stringify({target,...await evaluate(`({trace:window.touchInputTrace,state:lumenDiagnostics.snapshot().state})`)})));taps++;
 }
 await evaluate(`window.touchInputAbort?.abort()`);
 return {nativeTouch:true,taps,wholeBoard:true,markedAndEmpty:true,consecutive:true,borders:true,smallMovement:true,layoutChanges,countdownBoardStable:true,countdownWidths,physicalDevice:false};
}
