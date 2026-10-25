import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {connectBrowser,navigateAndWait} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser();
const url=process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/';
const output=process.argv[2],results=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const visible=()=>evaluate('!!document.querySelector(".first-welcome:not([hidden])")');
const state=()=>evaluate(`JSON.stringify({board:lumenDiagnostics.snapshot().state,progress:lumenDiagnostics.snapshot().progress,attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1'))})`);
async function fresh(extra=''){
 const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenSound','off');${extra}`});
 await navigateAndWait({send,evaluate},'Page.navigate',{url});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
 for(let i=0;i<100;i++){if(await evaluate('!!document.querySelector(".first-welcome")&&document.querySelectorAll("#board .cell").length>0'))return;await sleep(50)}
 throw Error('Introduction did not mount');
}
async function capture(name){if(output){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(path.dirname(output),name+'.png'),Buffer.from(shot.data,'base64'))}}
const audioProbe=`window.__introAudio=[];window.AudioContext=class extends window.AudioContext{constructor(...args){super(...args);window.__introAudio.push(this)}};`;
async function click(selector){const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})}
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:true});
 await fresh();assert.equal(await visible(),true);
 const firstDocument=await evaluate('performance.timeOrigin');
 await evaluate('navigator.serviceWorker.ready.then(()=>new Promise(resolve=>setTimeout(resolve,200)))',true);
 assert.equal(await evaluate('performance.timeOrigin'),firstDocument,'First real worker installation must not reload the welcome');
 assert.equal(await evaluate('document.activeElement.classList.contains("intro-play")'),true);
 assert.equal(await evaluate('document.querySelector("main.app").inert'),true);
 assert.equal(await evaluate('localStorage.getItem("lumenIntroPresentedV1")'),'1');
 await capture('intro-welcome-360');
 const before=await state();
 await evaluate('document.querySelector(".intro-play").click()');
 assert.equal(await visible(),false);assert.equal(await state(),before,'Direct entry preserves actual board/profile/attempt bytes');
 assert.equal(await evaluate('document.getElementById("board").dataset.learningStage'),'intro','SEE/UNDERSTAND remains');
 assert.equal(await evaluate('document.activeElement.id'),'learningCoachNext');
 results.push('fresh welcome → direct real learning board; unchanged gameplay');
 await navigateAndWait({send,evaluate},'Page.reload');assert.equal(await visible(),false);results.push('reload does not repeat');

 await fresh(audioProbe+"localStorage.setItem('lumenSound','on');");const narrativeBefore=await state();
 assert.equal(await evaluate('window.__introAudio.length'),0,'No audio before explicit story action');
 await evaluate('window.__introBoard=document.getElementById("board")');await click('.intro-story');
 await sleep(100);
 assert.equal(await evaluate('window.__introAudio.at(-1).state'),'running','Native Web Audio starts after a real click');
 assert.equal(await evaluate('document.querySelector(".intro-skip").hidden'),false);
 const started=Date.now();
 for(const [index,time] of [[0,0],[1,5200],[2,10200],[3,16200],[4,23200]]){
  await sleep(Math.max(0,time-(Date.now()-started)));
  assert.equal(await evaluate('Number(document.querySelector(".first-welcome").dataset.scene)'),index);
  await capture('intro-scene-'+index);
 }
 await sleep(Math.max(0,30500-(Date.now()-started)));
 assert.equal(await visible(),false);assert.equal(await state(),narrativeBefore,'Full narrative creates no reward or attempt mutation');
 assert.equal(await evaluate('window.__introAudio.at(-1).state'),'closed','Natural story completion stops music');
 assert.equal(await evaluate('document.getElementById("board")===window.__introBoard'),true,'Same real board node after passage');results.push('all five scenes and automatic passage on real 30-second clock');

 await fresh(audioProbe);await click('.intro-story');
 assert.equal(await evaluate('window.__introAudio.length'),0,'Existing global mute is respected');
 await click('.intro-music');await sleep(100);
 assert.equal(await evaluate('window.__introAudio.at(-1).state'),'running');
 assert.equal(await evaluate('document.querySelector(".intro-music").getAttribute("aria-pressed")'),'true');
 await evaluate('document.querySelector(".intro-transcript").open=true');await sleep(100);
 assert.equal(await evaluate('window.__introAudio.at(-1).state'),'closed','Transcript pauses music');
 await evaluate('document.querySelector(".intro-transcript").open=false');await sleep(100);
 assert.equal(await evaluate('window.__introAudio.at(-1).state'),'running');
 await evaluate(`window.__introHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__introHidden});document.dispatchEvent(new Event('visibilitychange'))`);await sleep(100);
 assert.equal(await evaluate('window.__introAudio.at(-1).state'),'closed','Hidden tab pauses music');
 await evaluate(`window.__introHidden=false;document.dispatchEvent(new Event('visibilitychange'));delete document.hidden`);await sleep(100);
 assert.equal(await evaluate('window.__introAudio.at(-1).state'),'running');
 await click('.intro-music');await sleep(100);
 assert.equal(await evaluate('window.__introAudio.at(-1).state'),'closed','Mute stops immediately');
 assert.equal(await evaluate('localStorage.getItem("lumenSound")'),'off','Local music choice does not change game sound preference');
 await click('.intro-music');await click('.intro-skip');await sleep(100);
 assert.equal(await evaluate('window.__introAudio.at(-1).state'),'closed','Skip stops music');
 results.push('native audio activation, existing mute, local toggle, transcript/background pause, resume and skip cleanup');

 const rendered=await evaluate(`(async()=>{const {createIntroMusic}=await import('./src/ui/intro-music.js');const audio=new OfflineAudioContext(1,30*22050,22050);audio.resume=()=>Promise.resolve();const music=createIntroMusic({window:{localStorage:{getItem:()=> 'on'},AudioContext:function(){return audio}}});music.start();const buffer=await audio.startRendering();const data=buffer.getChannelData(0);let peak=0,energy=0;for(const value of data){peak=Math.max(peak,Math.abs(value));energy+=value*value}return {peak,rms:Math.sqrt(energy/data.length),end:Math.abs(data.at(-1))}})()`,true);
 assert.ok(rendered.peak>.005&&rendered.peak<.2,JSON.stringify(rendered));assert.ok(rendered.rms>.001);assert.ok(rendered.end<.001,'Score fades to silence');
 results.push('native offline rendering: audible signal, conservative peak and final fade');

 await fresh();await evaluate('document.querySelector(".intro-story").click()');
 const skipBefore=await state();await evaluate('document.querySelector(".intro-skip").click();document.querySelector(".intro-skip").click()');
 assert.equal(await state(),skipBefore);assert.equal(await visible(),false);results.push('immediate repeated skip preserves state');

 // Start a genuine ordinary attempt; replay must return without resetting it.
 await evaluate('lumenDiagnostics.setupQuest(0);document.getElementById("learningSkip").click();document.querySelector("#board .cell").click()');
 await evaluate('document.getElementById("tutorialHelp").click();document.getElementById("replayIntroduction").click()');
 assert.equal(await visible(),true);const replayBefore=await state();
 await sleep(200);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
 assert.equal(await visible(),false);assert.equal(await state(),replayBefore,'Replay preserves paused attempt, cells and profile');
 assert.equal(await evaluate('document.activeElement.id'),'tutorialHelp');results.push('Aide replay, pause, Escape and focus return');

 for(const [width,height] of [[320,568],[360,640],[640,360],[1440,900]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  await fresh();await sleep(60);
  const geometry=await evaluate(`(()=>{const root=document.querySelector('.first-welcome');return [...root.querySelectorAll('.intro-welcome h2,.intro-welcome p,.intro-actions button')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom}})})()`);
  assert.ok(geometry.every(r=>r.left>=0&&r.right<=width+1&&r.top>=0&&r.bottom<=height+1),JSON.stringify({width,height,geometry}));
  if(width===1440)await capture('intro-welcome-1440');
 }
 results.push('320/360 mobile, landscape and desktop geometry');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await evaluate('document.querySelector(".intro-story").click()');
 assert.equal(await evaluate('getComputedStyle(document.querySelector(".intro-art .astronomical-reference-stars")).animationName'),'none');
 await capture('intro-reduced-motion');
 // Transcript is a non-timed accessible alternative and pauses the story.
 await evaluate('document.querySelector(".intro-transcript").open=true');await sleep(60);
 assert.equal(await evaluate('document.querySelectorAll(".intro-transcript p").length'),5);
 await evaluate('document.querySelector(".intro-skip").click()');
 await send('Emulation.setEmulatedMedia',{features:[]});results.push('reduced motion and full readable transcript');

 await fresh();
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
 assert.equal(await evaluate('document.activeElement.classList.contains("intro-story")'),true);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab'});
 assert.equal(await evaluate('document.activeElement.classList.contains("intro-play")'),true,'Tab stays within welcome');
 await evaluate(`document.querySelector('.intro-story').click();window.__introHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__introHidden});document.dispatchEvent(new Event('visibilitychange'))`);
 await sleep(5200);
 assert.equal(await evaluate('Number(document.querySelector(".first-welcome").dataset.scene)'),0,'Hidden-tab simulation does not advance the story');
 await evaluate(`window.__introHidden=false;document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;document.querySelector('.intro-skip').click()`);
 results.push('native Tab containment and simulated hidden-tab pause');

 await fresh();await evaluate(`document.querySelector('.intro-story').click();const p=lumenDiagnostics.snapshot().progress;p.solved[0]=1;p.solved[1]=1;lumenDiagnostics.setupQuest(2)`);
 await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',true);
 assert.equal(await visible(),false,'A changed quest cancels obsolete presentation');
 assert.equal(await evaluate('document.querySelector("main.app").inert'),false);
 results.push('changed context releases gameplay without delayed navigation');

 await fresh();await evaluate(`document.querySelector('.intro-story').click();window.__introNow=performance.now.bind(performance);performance.now=()=>{throw Error('synthetic animation clock failure')}`);
 await sleep(100);
 await evaluate('performance.now=window.__introNow');
 assert.equal(await visible(),false,'Animation failure immediately releases the game');
 assert.equal(await evaluate('document.querySelector("main.app").inert'),false);
 results.push('animation failure fallback');

 await fresh("localStorage.setItem('lumenCloudOwnerId','synthetic-owner')");assert.equal(await visible(),false);results.push('known owner skips welcome');
 await fresh("localStorage.setItem('lumenProgressV1',JSON.stringify({solved:{0:1},badges:{}}))");assert.equal(await visible(),false);results.push('existing guest progress skips welcome');
 // Disconnect after resources load; the narrative has no transport dependency.
 await fresh();await send('Network.enable');await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await evaluate('document.querySelector(".intro-story").click();document.querySelector(".intro-skip").click()');assert.equal(await visible(),false);
 await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});results.push('warm offline story and direct exit');
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log(JSON.stringify({ok:true,results},null,2));if(output)fs.writeFileSync(output,JSON.stringify({ok:true,results},null,2)+'\n');
}catch(error){if(output)fs.writeFileSync(output,JSON.stringify({ok:false,results,error:error.stack,errors},null,2));console.error(error);process.exitCode=1}
finally{process.exit(process.exitCode||0)}
