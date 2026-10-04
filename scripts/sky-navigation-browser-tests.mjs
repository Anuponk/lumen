import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {CONTENT_PACKS} from '../src/campaign/content.js';
const {send,evaluate,errors}=await connectBrowser(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const url=process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/';
const snapshot=()=>evaluate('lumenDiagnostics.snapshot()');
async function ready(controlled=false){for(let i=0;i<150;i++){if(await evaluate(`!!window.lumenDiagnostics && (!${controlled} || !!navigator.serviceWorker.controller)`))return;await sleep(100)}throw Error('Application did not start: '+JSON.stringify(errors))}
async function click(selector){const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Hidden target '+${JSON.stringify(selector)});return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p})}
async function fit(){const result=await evaluate(`(()=>{const sheet=document.querySelector('#mapModal .map-sheet'),modal=document.getElementById('mapModal'),r=sheet.getBoundingClientRect(),selectors=['#closeMap','#skyPicker','#adventureRail','#sectorTabs','#constellationPages','#openMyChallenges'];return {height:r.height,overflow:Math.max(sheet.scrollHeight-sheet.clientHeight,modal.scrollHeight-modal.clientHeight),targets:selectors.map(s=>{const e=document.querySelector(s),q=e.getBoundingClientRect();return {s,visible:!e.hidden&&!!q.height,inside:q.top>=0&&q.bottom<=innerHeight&&q.left>=0&&q.right<=innerWidth}})}})()`);assert(result.overflow<=2,'Vertical overflow: '+JSON.stringify(result));assert(result.targets.every(t=>!t.visible||t.inside),'Controls outside viewport: '+JSON.stringify(result));return result.height}
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+expression)}
const results=[];
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const viewport of [{width:360,height:640,mobile:true},{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  await send('Emulation.setTouchEmulationEnabled',{enabled:viewport.mobile,maxTouchPoints:1});
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();localStorage.setItem("lumenProgressV1",JSON.stringify({solved:{0:1,1:1},badges:{historical:1}}));localStorage.setItem("lumenSound","off");localStorage.setItem("lumenTutorialSeen","1");localStorage.setItem("lumenWelcomeDayV1",new Date().toLocaleDateString("en-CA"));localStorage.setItem("lumenInstallLater",String(Date.now()));localStorage.setItem("lumenPushChoice","later");'});
  await send('Page.navigate',{url});await ready(true);await sleep(1500);await ready();await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});await acknowledgeLearningMilestones(evaluate);
  await click('#openSky');const original=await snapshot(),height=await fit();
  assert.equal(await evaluate('document.querySelectorAll(".sky-navigation").length'),1);assert.equal(await evaluate('document.querySelectorAll("#sectorTabs").length'),1);assert.equal(await evaluate('document.querySelectorAll("#mapDetail").length'),1);
  assert.equal(await evaluate('document.querySelectorAll("#sectorTabs .constellation-card").length'),6,JSON.stringify(await evaluate('({rect:document.getElementById("openSky").getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight],mapHidden:document.getElementById("mapModal").hidden,sky:lumenDiagnostics.skySnapshot(),overlays:[...document.querySelectorAll("[id$=Overlay]")].filter(e=>!e.hidden).map(e=>e.id),hit:(()=>{const r=document.getElementById("openSky").getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.outerHTML})()})')));
  assert.equal(await evaluate('lumenDiagnostics.skySnapshot().pages'),2);
  await click('#constellationNext');assert.equal(await evaluate('document.querySelectorAll("#sectorTabs .constellation-card").length'),4);await fit();
  await click('#adventureRail .locked');assert.equal(await evaluate('document.getElementById("adventureNotice").hidden'),false);assert.equal(await evaluate('lumenDiagnostics.skySnapshot().viewedAdventure'),CONTENT_PACKS[0].id);await click('#adventureNoticeClose');
  await click('#adventureRail .locked');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});assert.equal(await evaluate('document.getElementById("adventureNotice").hidden'),true);assert.equal(await evaluate('document.getElementById("mapModal").hidden'),false);assert.equal(await evaluate('document.activeElement.dataset.packId'),CONTENT_PACKS[1].id,'Locked notice restores focus without closing Mon ciel');
  await click('#constellationPrevious');await click('#sectorTabs .constellation-card');assert.equal(await evaluate('lumenDiagnostics.skySnapshot().view'),'detail');
  await click('#puzzleGrid .puzzle-card.done');assert((await snapshot()).replayMode);assert.deepEqual((await snapshot()).progress,original.progress);
  await click('#openSky');await click('#closeMap');assert((await snapshot()).replayMode,'Browsing must preserve replay');
  // Real prior progression beyond Adventure 1 remains accessible after reload.
  await evaluate(`localStorage.setItem('lumenProgressV1',JSON.stringify({solved:Object.fromEntries(Array.from({length:100},(_,i)=>[i,1])),badges:{historical:1}}));localStorage.removeItem('lumenActiveAttemptV1')`);
  await send('Page.reload',{ignoreCache:true});await sleep(500);await ready();await acknowledgeLearningMilestones(evaluate);await click('#openSky');
  const restored=await snapshot();assert.equal(restored.levelIndex,100);assert.equal(await evaluate('lumenDiagnostics.skySnapshot().activeAdventure'),CONTENT_PACKS[1].id);
  await click('#adventureRail button');assert.equal(await evaluate('lumenDiagnostics.skySnapshot().viewedAdventure'),CONTENT_PACKS[0].id);assert.equal(await evaluate('lumenDiagnostics.skySnapshot().activeAdventure'),CONTENT_PACKS[1].id);assert.deepEqual(await snapshot(),restored);
  for(const count of [1,6,7,12,103]){
   const model={version:1,skies:[{id:'fixture-sky',label:'Ciel de test',packs:Array.from({length:40},(_,p)=>({id:'fixture-'+p,skyId:'fixture-sky',order:p,displayName:'Aventure '+(p+1),legacyQuestStart:p*count,questCount:count,accessible:p===0||p===1,constellations:Array.from({length:count},(_,i)=>({id:`fixture-${p}-${i}`,packId:'fixture-'+p,label:'Constellation '+(i+1),questStart:p*count+i,questCount:1,legacyIndex:i%24,accessible:p===0||p===1}))}))},{id:'locked-sky',label:'Ciel extraordinaire',packs:[{id:'future',skyId:'locked-sky',displayName:'Future aventure',accessible:false,constellations:[]}]}]};
   // Use a stable fixture current quest inside the first synthetic Adventure.
   model.skies[0].packs[0].legacyQuestStart=0;model.skies[0].packs[0].questCount=1000;
   await evaluate(`lumenDiagnostics.setSkyCatalogue(${JSON.stringify(model)})`);
   while(await evaluate('lumenDiagnostics.skySnapshot().page>0'))await click('#constellationPrevious');
   assert.equal(await evaluate('document.querySelectorAll("#sectorTabs .constellation-card").length'),Math.min(6,count));
   assert.equal(await evaluate('document.getElementById("constellationPages").hidden'),count<=6);
   const largeHeight=await fit();assert(Math.abs(largeHeight-height)<=2,'Catalogue growth changes height');
   if(count===7&&viewport.mobile){const r=await evaluate('(()=>{const r=document.getElementById("sectorTabs").getBoundingClientRect();return {left:r.left,right:r.right,top:r.top}})()');const point={x:r.right-25,y:r.top+35};await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});for(let step=1;step<=8;step++)await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-(r.right-r.left-50)*step/8,y:point.y}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await evaluate('lumenDiagnostics.skySnapshot().page'),1,'Real touch swipe advances one page');assert.equal(await evaluate('lumenDiagnostics.skySnapshot().view'),'overview','Swipe cannot open a constellation');await click('#constellationPrevious')}
   for(let page=1;page<Math.ceil(count/6);page++)await click('#constellationNext');
   assert.equal(await evaluate('document.querySelectorAll("#sectorTabs .constellation-card").length'),count%6||6);
   await evaluate(`document.getElementById('skyPicker').value='locked-sky';document.getElementById('skyPicker').dispatchEvent(new Event('change'))`);
   assert.equal(await evaluate('document.querySelectorAll("#sectorTabs .constellation-card").length'),0);await click('#adventureRail button');await click('#adventureNoticeClose');
   await evaluate(`document.getElementById('skyPicker').value='fixture-sky';document.getElementById('skyPicker').dispatchEvent(new Event('change'))`);
   await click('#adventureRail button:nth-child(2)');assert.equal(await evaluate('lumenDiagnostics.skySnapshot().viewedAdventure'),'fixture-1');
   model.skies[0].packs[1].accessible=false;
   await evaluate(`lumenDiagnostics.setSkyCatalogue(${JSON.stringify(model)},{reset:false})`);assert.equal(await evaluate('lumenDiagnostics.skySnapshot().viewedAdventure'),'fixture-0');
   assert.deepEqual((await snapshot()).progress,restored.progress,'Synthetic browsing cannot mutate real progression');
  }
  await evaluate('lumenDiagnostics.setSkyCatalogue(null)');await fit();
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`docs/validation/issue96-${viewport.width}.png`,Buffer.from(shot.data,'base64'));
  // New player completes the free Adventure and sees a locked next Adventure.
  await evaluate(`localStorage.setItem('lumenProgressV1',JSON.stringify({solved:Object.fromEntries(Array.from({length:${CONTENT_PACKS[0].questCount-1}},(_,i)=>[i,1])),badges:{historical:1}}));localStorage.removeItem('lumenActiveAttemptV1')`);
  await send('Page.reload',{ignoreCache:true});await sleep(500);await ready();await acknowledgeLearningMilestones(evaluate);
  assert.equal((await snapshot()).levelIndex,CONTENT_PACKS[0].questCount-1);
  await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');await until('!document.getElementById("skyReveal").hidden');await click('#skyRevealContinue');
  assert.match(await evaluate('document.getElementById("adventureNoticeTitle").textContent'),/Aventure terminée/);await click('#adventureNext');assert.match(await evaluate('document.getElementById("adventureNoticeCopy").textContent'),/verrouillée/);await click('#adventureNoticeClose');
  const won=await snapshot();assert.equal(won.progress.solved[CONTENT_PACKS[0].questCount],undefined);
  await send('Page.reload',{ignoreCache:true});await sleep(500);await ready();assert.equal((await snapshot()).levelIndex,CONTENT_PACKS[0].questCount-1);assert.deepEqual((await snapshot()).progress,won.progress);
  results.push({viewport,height,pagination:[1,6,7,12,103],adventures:40,multipleSkies:true,accessPreserved:true,browsingIsolated:true,lockedAdventure:true,replay:true,completion:true,noVerticalOverflow:true});
 }
 assert.deepEqual(errors,[]);const report={results,uncaughtErrors:errors};if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await send('Browser.close')}
