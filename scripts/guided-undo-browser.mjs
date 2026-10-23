import assert from 'node:assert/strict';
import {acknowledgeLearningMilestones} from './cdp-client.mjs';
export async function verifyGuidedUndo({send,evaluate}){
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const point=selector=>evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
 async function tap(selector){const p=await point(selector);const hit=await evaluate(`(()=>{const hit=document.elementFromPoint(${p.x},${p.y});return {expected:!!hit?.closest(${JSON.stringify(selector)}),id:hit?.id,cls:hit?.className}})()`);assert(hit.expected,'Touch target covered: '+selector+' '+JSON.stringify(hit));await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(60)}
 const cell=(r,c)=>`.cell[data-row="${r}"][data-col="${c}"]`;
 const results=[];
 for(const index of [6,10]){
  await evaluate(`lumenDiagnostics.setupQuest(${index})`);await acknowledgeLearningMilestones(evaluate);
  await evaluate(`document.getElementById('questGo').click();document.getElementById('manualCrossTipOk').click();if(!document.getElementById('autonomyOverlay').hidden)document.getElementById('autonomyKeep').click();if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click()`);
  await evaluate(`document.getElementById('guidedErrors').checked=true;document.getElementById('autoCross').checked=false`);
  const first=await evaluate('lumenDiagnostics.snapshot().puz.sol[0]'),wrong=(first+1)%5;
  await tap(cell(0,first));await tap(cell(0,first));
  await tap(cell(0,wrong));await tap(cell(0,wrong));
  // A different logical move commits the deferred guided intervention.
  await tap(cell(1,0));
  assert.equal(await evaluate(`document.getElementById('guidedCard').hidden`),false,'Actual touch produces the guided conflict');
  const before=await evaluate('lumenDiagnostics.snapshot().state');
  assert.equal(before[0][wrong],2);
  await tap('#undo');
  assert.equal(await evaluate(`document.getElementById('guidedCard').hidden`),true);
  assert.equal(await evaluate(`document.getElementById('board').getAttribute('aria-disabled')`),null);
  assert.equal(await evaluate(`lumenDiagnostics.snapshot().state[0][${first}]`),2,'Undo preserves the earlier valid Guardian');
  assert.equal(await evaluate(`lumenDiagnostics.snapshot().state[0][${wrong}]`),1,'One Undo reverses just the incorrect placement');
  await tap(cell(1,0));
  assert.equal(await evaluate('lumenDiagnostics.snapshot().state[1][0]'),1,'The next touch works immediately');
  await tap('#undo');await tap(cell(1,1));
  assert.equal(await evaluate('lumenDiagnostics.snapshot().state[1][1]'),1,'Repeated Undo remains playable');
  results.push({questIndex:index,conflict:true,singleUndo:true,nextTouch:true});
 }
 return results;
}
