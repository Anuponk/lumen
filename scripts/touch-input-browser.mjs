import assert from 'node:assert/strict';
import {acknowledgeLearningMilestones} from './cdp-client.mjs';

// Synthetic guest only: brief, consecutive taps across the whole board, including
// marked cells, small finger movement and points inside the cell borders.
export async function verifyTouchInput({send,evaluate}){
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await evaluate(`lumenDiagnostics.setupQuest(6)`);await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('questGo').click();document.getElementById('manualCrossTipOk').click();if(!document.getElementById('autonomyOverlay').hidden)document.getElementById('autonomyKeep').click();if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click();document.getElementById('guidedErrors').checked=false;document.getElementById('autoCross').checked=false;document.getElementById('board').scrollIntoView({block:'center'})`);
 const cells=await evaluate(`Array.from(document.querySelectorAll('#board .cell'),el=>{const r=el.getBoundingClientRect();return {row:Number(el.dataset.row),col:Number(el.dataset.col),center:{x:r.x+r.width/2,y:r.y+r.height/2},border:{x:r.x+2,y:r.y+2}}})`);
 let taps=0;
 for(const cell of cells)for(const location of ['center','border'])for(const expected of [1,2,0]){
  const p=cell[location];
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+3,y:p.y+2}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const actual=await evaluate(`lumenDiagnostics.snapshot().state[${cell.row}][${cell.col}]`);
  assert.equal(actual,expected,`Brief ${location} tap must transition exactly once at ${cell.row},${cell.col}`);taps++;
 }
 return {nativeTouch:true,taps,wholeBoard:true,markedAndEmpty:true,consecutive:true,borders:true,smallMovement:true,physicalDevice:false};
}
