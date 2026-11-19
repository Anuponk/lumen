import {REPLAY_FROM_REVIEW} from './cdp-client.mjs';
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
async function fixture(width,height,{qa=true,solved=12,prior=quests.slice(0,solved)}={}){
 await send('Emulation.setDeviceMetricsOverride',{width,height,mobile:width<900,deviceScaleFactor:1});
 await send('Emulation.setTouchEmulationEnabled',{enabled:width<900,maxTouchPoints:1});
 const p={catalogueOrigin:currentCatalogueOrigin,solved:Object.fromEntries(prior.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(prior.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{}}])),badges:{},performances:{},shards:100,speedBadgeIntroSeen:1,fullBadgeIntroSeen:1,autonomySeen:1};
 const hook=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();sessionStorage.clear();localStorage.setItem('${qa?'lumenQaProgressV1':'lumenProgressV1'}',${JSON.stringify(JSON.stringify(p))});localStorage.setItem('lumenSound','off');localStorage.setItem('lumenSkyTourSeen','1');localStorage.setItem('lumenAutoCross','0');localStorage.setItem('lumenGuidedErrors','off');localStorage.setItem('lumenInstallLater',String(Date.now()));localStorage.setItem('lumenPushChoice','later');`});
 await navigateAndWait(browser,'Page.navigate',{url:url+(qa?'?qa=new':'')});
 await new Promise(resolve=>setTimeout(resolve,1500));
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:hook.identifier});
 await acknowledgeLearningMilestones(evaluate);
}
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS',name)}catch(e){results.push({name,ok:false,error:e.message});console.log('FAIL',name,e.message)}}
const layout=`JSON.stringify({board:document.getElementById('board').getBoundingClientRect(),actions:document.querySelector('.actions').getBoundingClientRect(),scrollY,scrollHeight:document.querySelector('.app').scrollHeight})`;
const settleLayout=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))',true);
async function assertHelpPlacement(cardId,buttonId,safeBottom=0){
 const placement=await evaluate(`(()=>{
  const card=document.getElementById(${JSON.stringify(cardId)}).getBoundingClientRect(),board=document.getElementById('board').getBoundingClientRect();
  const button=document.getElementById(${JSON.stringify(buttonId)}),close=button.getBoundingClientRect();
  const actions=document.querySelector('.actions').getBoundingClientRect(),viewportBottom=(visualViewport?.offsetTop??0)+(visualViewport?.height??innerHeight);
  return {boardBottom:board.bottom,cardTop:card.top,cardBottom:card.bottom,viewportBottom,closeHeight:close.height,
   closeHit:button.contains(document.elementFromPoint((close.left+close.right)/2,(close.top+close.bottom)/2)),
   closeBottom:close.bottom,overlapsCommands:card.top<actions.bottom&&card.bottom>actions.top&&card.left<actions.right&&card.right>actions.left};
 })()`);
 assert(placement.cardTop>=placement.boardBottom-0.1,'Assistance must start below every cell: '+JSON.stringify(placement));
 assert(placement.cardBottom<=placement.viewportBottom-safeBottom+0.1,'Assistance fits inside the safe viewport: '+JSON.stringify(placement));
 assert(placement.closeBottom<=placement.cardBottom+0.1&&placement.closeHeight>=44&&placement.closeHit,'Dismiss control is visible and operable: '+JSON.stringify(placement));
 assert(placement.overlapsCommands,'Assistance can use the space occupied by commands: '+JSON.stringify(placement));
}
async function tap(selector){
 const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:(r.left+r.right)/2,y:(r.top+r.bottom)/2}})()`);
 await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
 await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await new Promise(resolve=>setTimeout(resolve,60));
}
try{
 await check('805 touch erases red marks only and the next tap removes a Guardian',async()=>{
  await fixture(390,844);
  await evaluate(`lumenDiagnostics.setupQuest(20);document.getElementById('questStart').hidden=true;document.getElementById('attemptMask').click();const s=lumenDiagnostics.snapshot();s.state[0].splice(0,4,1,2,0,1);lumenDiagnostics.setBoard(s.state);`);
  const point=c=>evaluate(`(()=>{const r=document.querySelector('#board [data-row="0"][data-col="${c}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  async function sweep(){
   await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[await point(0)]});
   await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[await point(3)]});
   await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  await sweep();
  assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().state[0].slice(0,4)'),[0,2,0,0]);
  // Let Chrome finish the synthesized swipe before beginning a new gesture.
  await new Promise(resolve=>setTimeout(resolve,250));
  await tap('#board [data-row="0"][data-col="1"]');
  const guardian=await evaluate(`new Promise(resolve=>{
   const deadline=performance.now()+1000;
   function checkTap(){
    const mark=lumenDiagnostics.snapshot().state[0][1];
    if(mark===0||performance.now()>=deadline)resolve(mark);
    else requestAnimationFrame(checkTap);
   }
   checkTap();
  })`,true);
  assert.equal(guardian,0,'Chrome delivers the synthesized click after the touch ends');
  await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();s.state[0].splice(0,4,1,2,0,1);lumenDiagnostics.setBoard(s.state)})()`);
  await sweep();
  await evaluate("document.getElementById('undo').click()");
  assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().state[0].slice(0,4)'),[1,2,0,1],'One Undo restores the whole swipe');
 });
 const finalChariot=quests.find(q=>q.id==='planned-real-01-q10');
 assert.equal(finalChariot.size,8,'The reported Grande Ourse finale is the 8×8 layout');
 const chariotPrior=quests.filter(q=>q.constellationId===finalChariot.constellationId&&q.ordinal<finalChariot.ordinal);
 for(const [width,height] of [[320,568],[360,640],[390,844]])await check('821 board stays anchored through 20 swipes at '+width+'px',async()=>{
  await fixture(width,height,{prior:chariotPrior});
  await evaluate(`(()=>{
   document.getElementById('openSky').click();
   document.querySelector('#adventureRail [data-pack-id="base-real-sky"]').click();
   for(let page=0;!document.querySelector('#sectorTabs [data-content-id="real-01"]')&&page<12;page++)document.getElementById('constellationPrevious').click();
   document.querySelector('#sectorTabs [data-content-id="real-01"]').click();
   document.querySelector('#puzzleGrid [data-quest-id="planned-real-01-q10"]').click();
   for(const id of ['questGo','attemptMask','manualCrossTipOk','autonomyKeep']){
    const button=document.getElementById(id);if(button.getClientRects().length)button.click();
   }
   document.getElementById('guidedErrors').checked=true;
   const state=Array.from({length:8},()=>Array(8).fill(1));state[3][4]=2;lumenDiagnostics.setBoard(state);
  })()`);
  assert.equal(await evaluate('lumenDiagnostics.snapshot().n'),8);
  await settleLayout();
  const geometry=`(()=>{
   const rect=selector=>{const {x,y,width,height}=document.querySelector(selector).getBoundingClientRect();return {x,y,width,height}};
   return {board:rect('#board'),actions:rect('.actions'),timer:rect('#time'),sky:rect('#openSky'),
    scroll:[scrollX,scrollY,visualViewport.offsetLeft,visualViewport.offsetTop,visualViewport.scale],
    overflow:document.documentElement.scrollWidth>innerWidth};
  })()`;
  const before=await evaluate(geometry);
  assert(!before.overflow&&before.board.x>=0&&before.board.x+before.board.width<=width+1,'No horizontal clipping before swiping');
  for(let index=0;index<20;index++){
   const row=index%4,reverse=index%2===1,endRow=index%3===0?row:row+3;
   const cells=[[row,reverse?7:0],[endRow,reverse?0:7]];
   const [start,end]=await evaluate(`${JSON.stringify(cells)}.map(([row,col])=>{
    const r=document.querySelector('#board [data-row="'+row+'"][data-col="'+col+'"]').getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2};
   })`);
   assert.equal(await evaluate(`document.elementFromPoint(${start.x},${start.y})?.closest('.cell')?.closest('#board')?.id`),'board','Gesture starts on a visible cell');
   assert(end.y>=0&&end.y<height,'Gesture ends within the portrait viewport');
   const touch=(type,...points)=>send('Input.dispatchTouchEvent',{
    type,touchPoints:points.map(point=>({...point,id:index+1})),timestamp:Date.now()/1000,
   });
   await touch('touchStart',start);
   for(const ratio of [.35,1]){
    await touch('touchMove',{x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio});
    assert.deepEqual(await evaluate(geometry),before,'The viewport and controls stay anchored while the finger is down');
   }
   await touch('touchEnd');
   assert.deepEqual(await evaluate(geometry),before,'The viewport and controls stay anchored after release');
  }
  assert.equal(await evaluate('lumenDiagnostics.snapshot().state[3][4]'),2,'Swiping never removes the Guardian');
 });

 for(const [w,h] of [[320,568],[360,740],[375,667],[390,844],[667,375],[844,390],[1440,900]])await check(`791 hint below board ${w}x${h}`,async()=>{
  await fixture(w,h,{qa:false,solved:2});
  await evaluate(`lumenDiagnostics.setupQuest(2);document.getElementById('questStart').hidden=true;document.getElementById('attemptMask').click()`);
  await settleLayout();
  const before=await evaluate(layout);
  await evaluate(`document.getElementById('hint').click()`);
  assert.equal(await evaluate(layout),before,'Assistance does not resize the board, move the controls, or add page scroll');
  await assertHelpPlacement('hintCard','hintClose');
  assert.equal(await evaluate("document.getElementById('timePenalty').textContent"),'+15 s');
  if(w===360){const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(os.tmpdir(),`lumen-ux-hint-${w}x${h}.png`),Buffer.from(shot.data,'base64'))}
  const state=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().state)');
  assert(await evaluate("document.querySelector('#hintCard').contains(document.activeElement)"),'Keyboard focus reaches dismissal');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.equal(await evaluate("document.getElementById('hintCard').hidden"),true,'Escape closes the hint');
  assert.equal(await evaluate(layout),before,'Closing assistance preserves the original layout');
  assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().state)'),state,'Closing assistance leaves the board intact');
  assert(await evaluate(`(()=>{const button=document.getElementById('verify'),r=button.getBoundingClientRect();return button.contains(document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2))})()`),'Commands become reachable again');
 });
 const guidedQuest=quests.find(quest=>quest.size===8&&quest.legacyIndex!==null&&quest.ordinal>12);
 const protocol=await(await fetch((process.env.LUMEN_CDP_URL||'http://127.0.0.1:9222')+'/json/protocol')).json();
 const safeAreaSupported=protocol.domains.find(domain=>domain.domain==='Emulation')?.commands.some(command=>command.name==='setSafeAreaInsetsOverride');
 const guidedViewports=[[390,844,0],[360,740,0],[375,667,0]];
 if(safeAreaSupported)guidedViewports.push([375,667,24]);
 for(const [w,h,inset] of guidedViewports)await check(`791 guided 8x8 below board ${w}x${h}, bottom inset ${inset}`,async()=>{
  if(inset)await send('Emulation.setSafeAreaInsetsOverride',{insets:{bottom:inset}});
  try{
   await fixture(w,h,{solved:guidedQuest.ordinal-1});
   await evaluate(`lumenDiagnostics.setupQuest(${guidedQuest.legacyIndex});document.getElementById('questStart').hidden=true;document.getElementById('guidedErrors').checked=true;document.getElementById('attemptMask').click()`);
   assert.equal(await evaluate('lumenDiagnostics.snapshot().n'),8);
   const correct=await evaluate('lumenDiagnostics.snapshot().puz.sol[0]'),wrong=(correct+1)%8;
   for(let i=0;i<2;i++)await tap(`#board [data-row="0"][data-col="${wrong}"]`);
   const before=await evaluate(layout);
   await tap('#board [data-row="1"][data-col="0"]');
   assert.equal(await evaluate("document.getElementById('guidedCard').hidden"),false);
   assert.match(await evaluate("document.getElementById('guidedTitle').textContent"),/mène à une impasse/);
   assert.equal(await evaluate(layout),before,'Guided assistance leaves every board dimension unchanged');
   await assertHelpPlacement('guidedCard','guidedAck',inset);
   if(w===375){
    const scroll=await evaluate(`(()=>{const copy=document.querySelector('#guidedCard .assist-copy'),paragraph=copy.querySelector('p');paragraph.textContent=(paragraph.textContent+' ').repeat(12);copy.scrollTop=copy.scrollHeight;return {offset:copy.scrollTop,scrollY}})()`);
    assert(scroll.offset>0,'Long help text scrolls in the panel');
    assert.equal(scroll.scrollY,0,'Scrolling long help text leaves the page fixed');
    await assertHelpPlacement('guidedCard','guidedAck',inset);
   }
   assert.equal(await evaluate("document.getElementById('timePenalty').textContent"),'+5 s');
   await tap('#guidedAck');
   assert.equal(await evaluate("document.getElementById('guidedCard').hidden"),true);
   assert.equal(await evaluate(layout),before);
   await tap('#undo');
   assert.equal(await evaluate(`lumenDiagnostics.snapshot().state[0][${wrong}]`),1,'The undo command works after guided dismissal');
   if(w===390){
    await evaluate(`(()=>{const {state}=lumenDiagnostics.snapshot();state[0][${correct}]=1;lumenDiagnostics.setBoard(state)})()`);
    await tap('#verify');
    await assertHelpPlacement('verifyCard','verifyFix');
    assert.equal(await evaluate("document.getElementById('timePenalty').textContent"),'+5 s');
    await tap('#verifyFix');
    assert.equal(await evaluate(`lumenDiagnostics.snapshot().state[0][${correct}]`),0);
    assert.equal(await evaluate(layout),before);
   }
  }finally{if(inset)await send('Emulation.setSafeAreaInsetsOverride',{insets:{}})}
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
  await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${next.id}"]').click();${REPLAY_FROM_REVIEW}`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),false,'Trying the locked quest explains the required account again');
 });
 for(const [w,h] of [[360,640],[1440,900]])for(const played of [quests[2],quests.find(q=>q.legacyIndex===null),quests.filter(q=>q.constellationId===quests[0].constellationId).at(-1)])await check(`566 completed quest ${played.id} navigation ${w}`,async()=>{
  await fixture(w,h);
  // Close the first-visit help, then enter through actual map/replay adapters.
  await evaluate(`lumenDiagnostics.setupQuest(2);document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${played.packId}"]').click();document.querySelector('#sectorTabs [data-content-id="${played.constellationId}"]').click();document.querySelector('#puzzleGrid [data-quest-id="${played.id}"]').click();${REPLAY_FROM_REVIEW};document.getElementById('questStart').hidden=true`);
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
