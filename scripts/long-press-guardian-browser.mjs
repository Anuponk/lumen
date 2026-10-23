import assert from 'node:assert/strict';
import {acknowledgeLearningMilestones} from './cdp-client.mjs';
// Native touch in the existing isolated game browser. No real account is used.
export async function verifyLongPressGuardian({send,evaluate}){
 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await evaluate(`lumenDiagnostics.setupQuest(2);window.confirm=()=>true;document.getElementById('new').click()`);
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('autoCross').checked=false;document.getElementById('autoCross').dispatchEvent(new Event('change'));document.getElementById('attemptMask').click()`);
 const col=await evaluate('lumenDiagnostics.snapshot().puz.sol[0]');
 const point=await evaluate(`(()=>{const el=document.querySelector('.cell[data-row="0"][data-col="${col}"]');el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 const value=()=>evaluate(`lumenDiagnostics.snapshot().state[0][${col}]`);
 const start=()=>send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 const end=async()=>{await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(80)};
 const hold=async(expected)=>{await start();await sleep(650);assert.equal(await value(),expected,'Long action occurs once while held');await sleep(200);assert.equal(await value(),expected,'Holding cannot repeat');await end();assert.equal(await value(),expected,'Release cannot also short-tap')};
 assert.equal(await value(),0);await hold(2);
 await evaluate(`document.getElementById('undo').click()`);assert.equal(await value(),0,'One Undo reverses exactly one long action');
 await start();await end();assert.equal(await value(),1,'A short tap still marks');
 await hold(2);await hold(0);
 await start();await sleep(150);await send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await sleep(500);assert.equal(await value(),0,'Cancelled hold cannot place');
 await start();await sleep(150);await evaluate(`document.getElementById('attemptPause').click()`);await sleep(500);assert.equal(await value(),0,'Pause during a hold blocks mutation');await end();
 assert((await evaluate(`document.getElementById('attemptPause').textContent`)).includes('Reprendre'),'The old release cannot resume through the pause mask');
 await evaluate(`document.getElementById('attemptPause').click()`);await hold(2);await hold(0);
 await start();await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x+12,y:point.y}]});await sleep(650);assert.notEqual(await value(),2,'A drag cannot turn into a Guardian hold');await end();
 return {nativeTouch:true,emptyAndMarked:true,removeToNeutral:true,singleAction:true,releaseSuppressed:true,shortTapPreserved:true,undo:true,cancel:true,pause:true,dragCancels:true,physicalAndroidIOS:false};
}
