import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
const browser=await connectBrowser(),{send,evaluate}=browser,results=[];
const quests=canonicalQuestList(),url=process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/';
await send('Page.enable');await send('Runtime.enable');
// UI layout fixtures do not test service-worker installation. Its first-install
// controllerchange reload is covered by the separate mandatory PWA suite.
await send('Page.addScriptToEvaluateOnNewDocument',{source:`delete Object.getPrototypeOf(navigator).serviceWorker`});
async function fixture(width,height,{qa=true,solved=12}={}){
 await send('Emulation.setDeviceMetricsOverride',{width,height,mobile:width<900,deviceScaleFactor:1});
 await send('Emulation.setTouchEmulationEnabled',{enabled:width<900,maxTouchPoints:1});
 const prior=quests.slice(0,solved),p={catalogueOrigin:currentCatalogueOrigin,solved:Object.fromEntries(prior.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(prior.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{}}])),badges:{},performances:{},shards:100,speedBadgeIntroSeen:1,fullBadgeIntroSeen:1,autonomySeen:1};
 const hook=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();sessionStorage.clear();localStorage.setItem('${qa?'lumenQaProgressV1':'lumenProgressV1'}',${JSON.stringify(JSON.stringify(p))});localStorage.setItem('lumenSound','off');localStorage.setItem('lumenSkyTourSeen','1');localStorage.setItem('lumenAutoCross','0');localStorage.setItem('lumenGuidedErrors','off');localStorage.setItem('lumenInstallLater',String(Date.now()));localStorage.setItem('lumenPushChoice','later');`});
 await navigateAndWait(browser,'Page.navigate',{url:url+(qa?'?qa=new':'')});
 await new Promise(resolve=>setTimeout(resolve,1500));
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});
 await acknowledgeLearningMilestones(evaluate);
}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name)}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message)}}
try{
 for(const [w,h] of [[320,568],[360,640],[390,844],[667,375],[844,390],[1440,900]])await check(`555 hint last row ${w}x${h}`,async()=>{
  await fixture(w,h,{qa:false,solved:2});
  await evaluate(`lumenDiagnostics.setupQuest(2);document.getElementById('questStart').hidden=true;document.getElementById('attemptMask').click();document.getElementById('hint').click()`);
  const geometry=await evaluate(`(()=>{const b=document.getElementById('board'),c=document.getElementById('hintCard'),r=b.getBoundingClientRect(),s=c.getBoundingClientRect();return {open:!c.hidden,board:{top:r.top,bottom:r.bottom,width:r.width},card:{top:s.top,bottom:s.bottom},last:[...b.querySelectorAll('.cell')].slice(-lumenDiagnostics.snapshot().n).every(el=>{const t=el.getBoundingClientRect();return document.elementFromPoint(t.x+t.width/2,t.y+t.height/2)?.closest('.cell')===el})}})()`);
  if(w===360){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(os.tmpdir(),`lumen-ux-hint-${w}x${h}.png`),Buffer.from(shot.data,'base64'))}
  assert(geometry.open,'Hint must be open');assert(geometry.last,JSON.stringify(geometry));assert(geometry.board.bottom<=h,JSON.stringify(geometry));
  const before=await evaluate('lumenDiagnostics.snapshot().state.at(-1)[0]');
  const pos=await evaluate(`(()=>{const r=document.querySelector('.cell[data-row="'+(lumenDiagnostics.snapshot().n-1)+'"][data-col="0"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  if(w<900){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pos]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...pos,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...pos,button:'left',clickCount:1})}
  assert.notEqual(await evaluate('lumenDiagnostics.snapshot().state.at(-1)[0]'),before,'Last row receives actual input');
 });
 for(const [w,h] of [[360,640],[1440,900]])await check(`552 explicit guest gate ${w}`,async()=>{
  await fixture(w,h,{qa:false,solved:6});
  const gate=await evaluate(`({open:!document.getElementById('accountOptin').hidden,copy:document.getElementById('accountOptinDescription').textContent,login:document.getElementById('accountAuthSwitch').textContent})`);
  assert(gate.open);assert.match(gate.copy,/Créez un compte gratuit pour poursuivre votre aventure et retrouver votre progression\./);assert.equal(gate.login,'Se connecter');
  await evaluate(`document.getElementById('accountAuthSwitch').click()`);
  assert.equal(await evaluate(`document.getElementById('accountPassword').autocomplete`),'current-password');
  await evaluate(`document.getElementById('accountSignupTab').click()`);
  assert.equal(await evaluate(`document.getElementById('accountPassword').autocomplete`),'new-password');
  await evaluate(`document.getElementById('accountOptinLater').click();document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="base-real-sky"]').click();document.querySelector('#sectorTabs [data-content-id="real-01"]').click()`);
  const next=quests[6];
  await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${next.id}"]').click()`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),false,'Trying the locked quest explains the required account again');
 });
 for(const [w,h] of [[360,640],[1440,900]])for(const played of [quests[2],quests.find(q=>q.legacyIndex===null),quests.filter(q=>q.constellationId===quests[0].constellationId).at(-1)])await check(`566 completed quest ${played.id} navigation ${w}`,async()=>{
  await fixture(w,h);
  // Close the first-visit help, then enter through actual map/replay adapters.
  await evaluate(`lumenDiagnostics.setupQuest(2);document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${played.packId}"]').click();document.querySelector('#sectorTabs [data-content-id="${played.constellationId}"]').click();document.querySelector('#puzzleGrid [data-quest-id="${played.id}"]').click();document.getElementById('questStart').hidden=true`);
  await acknowledgeLearningMilestones(evaluate);
  const state=await evaluate(`({visible:!!document.getElementById('completedQuestNext')&&!document.getElementById('completedQuestNext').hidden,attempt:localStorage.getItem('lumenQaActiveAttemptV1'),label:document.getElementById('campaignMapLabel').textContent,progress:JSON.stringify(lumenDiagnostics.snapshot().progress)})`);
  assert(state.visible,'Completed quest needs Quête suivante '+JSON.stringify({attempt:state.attempt,label:state.label}));
  if(played===quests[2]){
   await evaluate(`document.getElementById('completedQuestNext').focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',text:'\r',windowsVirtualKeyCode:13});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  }else{
   const pos=await evaluate(`(()=>{const r=document.getElementById('completedQuestNext').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
   if(w<900){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pos]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}else{await send('Input.dispatchMouseEvent',{type:'mousePressed',...pos,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...pos,button:'left',clickCount:1})}
  }
  const next=quests[quests.findIndex(q=>q.id===played.id)+1];
  assert.match(await evaluate(`document.getElementById('campaignMapLabel').textContent`),new RegExp('^Quête '+next.ordinal+' '));
  assert.equal(await evaluate(`JSON.stringify(lumenDiagnostics.snapshot().progress)`),state.progress,'Navigation awards nothing');
 });
}finally{fs.writeFileSync(process.argv[2]||path.join(os.tmpdir(),'lumen-ux-browser.json'),JSON.stringify({results,errors:browser.errors},null,2));await send('Browser.close').catch(()=>{})}
if(results.some(r=>!r.ok)||browser.errors.length){
 if(browser.errors.length)console.error('Uncaught browser exceptions:',JSON.stringify(browser.errors));
 process.exitCode=1;
}
