// Real browser checks for #16/#17/#19; use the isolated CDP setup in docs/TESTING.md.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connectBrowser,acknowledgeLearningMilestones} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[],failures=[];
const check=(value,message)=>{if(!value)failures.push(message)};
async function click(selector){
 const point=await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'center'});const r=element.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(70);
}
const snapshot=()=>evaluate(`JSON.stringify({quest:lumenDiagnostics.snapshot().levelIndex,state:lumenDiagnostics.snapshot().state,progress:lumenDiagnostics.snapshot().progress,stage:document.getElementById('board').dataset.learningStage})`);
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("lumenProgressV1",JSON.stringify({solved:Object.fromEntries(Array.from({length:11},(_,i)=>[i,1])),badges:{}}));localStorage.setItem("lumenSound","off");localStorage.setItem("lumenTutorialSeen","1");localStorage.setItem("lumenInstallLater",String(Date.now()));localStorage.setItem("lumenPushChoice","later");'});
 await send('Page.navigate',{url:process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/'});
 for(let i=0;i<100&&!await evaluate('!!window.lumenDiagnostics');i++)await sleep(100);
 assert(await evaluate('!!window.lumenDiagnostics'),'Application did not start');await sleep(1200);
 for(const viewport of [{width:390,height:844,mobile:true},{width:360,height:640,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  for(const quest of [0,1,5,10]){
   const label=`${viewport.width}x${viewport.height} quest ${quest+1}`,start=failures.length;
   await evaluate(`lumenDiagnostics.setupQuest(${quest});document.getElementById('manualCrossTip').hidden=true;document.getElementById('questStart').hidden=true;document.getElementById('rulesModal').hidden=true`);
   await acknowledgeLearningMilestones(evaluate);
   if(await evaluate(`!document.getElementById('autonomyOverlay').hidden`))await click('#autonomyTry');
   const before=await snapshot();
   check(await evaluate(`!document.getElementById('rulesHelp')&&!document.getElementById('boardNext')&&!document.getElementById('clearHint')&&document.getElementById('rulesModal').hidden`),label+' redundant controls removed');
   await click('#tutorialHelp');
   check(await evaluate(`!document.getElementById('rulesModal').hidden&&document.activeElement.id==='closeRulesModal'`),label+' open/focus');
   check(await evaluate(`(()=>{const r=document.querySelector('#rulesModal .shard-rules-card').getBoundingClientRect(),b=document.getElementById('board').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&b.width<=innerWidth&&!!document.getElementById('replayLearning')})()`),label+' help layout');
   if(viewport.mobile){const fit=await evaluate(`(()=>{const b=document.getElementById('board').getBoundingClientRect(),a=document.querySelector('.actions').getBoundingClientRect(),w=document.getElementById('learningBoardWrap')?.getBoundingClientRect();return {ok:document.documentElement.scrollHeight<=innerHeight+1&&b.top>=0&&b.bottom<=innerHeight&&a.bottom<=innerHeight,scrollHeight:document.documentElement.scrollHeight,innerHeight,board:[b.top,b.bottom,b.height],actions:[a.top,a.bottom,a.height],wrap:w?[w.top,w.bottom,w.height]:null,bodyScroll:document.body.scrollHeight}})()`);if(!fit.ok)console.log('ux-fit:',label,JSON.stringify(fit));check(fit.ok,label+' play viewport fits without vertical scroll');}
   await click('#rulesModal p');
   check(await snapshot()===before,label+' modal content changed quest/teaching state');
   await click('#closeRulesModal');
   check(await evaluate(`document.getElementById('rulesModal').hidden&&document.activeElement.id==='tutorialHelp'`),label+' close/focus');
   await click('#tutorialHelp');
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
   check(await evaluate(`document.getElementById('rulesModal').hidden`),label+' Escape');
   await click('#tutorialHelp');
   await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:5,y:5});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:5,y:5});
   check(await evaluate(`document.getElementById('rulesModal').hidden`),label+' backdrop');
   check(await snapshot()===before,label+' modal interactions changed quest/teaching state');
   results.push({viewport,quest:quest+1,failures:failures.slice(start)});
  }
  await evaluate(`(()=>{lumenDiagnostics.setupQuest(5);document.getElementById('manualCrossTip').hidden=true;document.getElementById('questStart').hidden=true;const s=lumenDiagnostics.snapshot();s.state[0][s.puz.sol[0]]=2;lumenDiagnostics.setBoard(s.state)})()`);
  await acknowledgeLearningMilestones(evaluate);
  await click('#hint');
  const hint=await evaluate(`({hidden:document.getElementById('hintCard').hidden,title:document.getElementById('hintTitle').textContent,copy:document.getElementById('hintCopy').textContent,highlighted:document.querySelectorAll('#board .cell.hi').length})`);
  check(!hint.hidden&&hint.title==='Marquage à compléter'&&hint.copy.includes('écarter')&&!hint.copy.includes('Eau manquante')&&hint.highlighted>0,viewport.width+' guided hint: '+JSON.stringify(hint));
  await click('#hintClose');
  check(await evaluate(`document.getElementById('hintCard').hidden&&document.querySelectorAll('#board .cell.hi').length===0`),viewport.width+' hint close clears visuals');
  await evaluate(`(()=>{lumenDiagnostics.setupQuest(2);document.getElementById('questStart').hidden=true;const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
  await acknowledgeLearningMilestones(evaluate);
  await sleep(500);
  const cta=await evaluate(`(()=>{const next=document.getElementById('successNew'),share=document.getElementById('successShare');return {visible:document.getElementById('successOverlay').classList.contains('show'),text:next.textContent.trim(),next:getComputedStyle(next).backgroundImage,share:getComputedStyle(share).backgroundImage}})()`);
  check(cta.visible&&cta.text==='Quête suivante'&&cta.next.includes('linear-gradient')&&cta.share==='none',viewport.width+' primary CTA: '+JSON.stringify(cta));
  await click('#successNew');
  const nextState=await evaluate(`(()=>{const r=document.getElementById('successNew').getBoundingClientRect();return {quest:lumenDiagnostics.snapshot().levelIndex,rect:[r.x,r.y,r.width,r.height],viewport:[innerWidth,innerHeight],hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id}})()`);
  check(nextState.quest===3,viewport.width+' next quest action: '+JSON.stringify(nextState));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
 await evaluate(`lumenDiagnostics.setupQuest(10);document.getElementById('manualCrossTip').hidden=true;document.getElementById('questStart').hidden=true`);
 await acknowledgeLearningMilestones(evaluate);
 check(await evaluate('clock.toString().includes("visualWindowMs=30000")'),'Rapidité countdown opens at 30 seconds');
 check(await evaluate('clock.toString().includes("remainingMs<=10000")'),'Only the final 10 seconds use the stronger state');
 check(await evaluate('getComputedStyle(document.getElementById("speedCountdownFill")).animationName==="none"'),'Rapidité countdown does not blink or pulse');
 check(await evaluate('speedTargetSeconds(10)===90'),'Badge timing threshold is unchanged');

 const beforeLearning=await evaluate(`JSON.stringify(lumenDiagnostics.snapshot().progress)`);
 await click('#tutorialHelp');await click('#replayLearning');await sleep(120);
 const learningContract=await evaluate(`(()=>({stage:document.getElementById('board').dataset.learningStage,noAdvanceControl:!document.getElementById('scriptedLearnNext'),realCells:document.querySelectorAll('#board .cell').length,allowedCells:document.querySelectorAll('#board .cell[aria-disabled="false"]').length}))()`);
 check(learningContract.realCells>0,'learning uses real grid cells');
 check(learningContract.noAdvanceControl,'learning cannot skip real actions through a Next button');
 check(learningContract.stage==='intro'&&learningContract.allowedCells===0,'learning replay begins with SEE/UNDERSTAND before board actions');
 check(await evaluate(`document.querySelectorAll('.learning-territory-number').length===5`),'learning replay numbers its five territories');
 for(let step=0;step<6;step++)await click('#learningCoachNext');
 check(await evaluate(`document.getElementById('board').dataset.learningStage==='place'&&document.querySelectorAll('#board .cell[aria-disabled="false"]').length===1&&document.querySelectorAll('.learning-territory-number').length===0`),'after the intro only the forced central cell becomes interactive');
 check(await evaluate(`lumenDiagnostics.snapshot().levelIndex===0&&!document.getElementById('scriptedLearn').hidden`),'learning replay starts real quest 1 teaching mode');
 check(await evaluate(`JSON.stringify(lumenDiagnostics.snapshot().progress)`)===beforeLearning,'starting learning replay changed progression');
 check(errors.length===0,'Browser exceptions: '+JSON.stringify(errors));
 const report={modalScenarios:results,vocabularyAndCTAViewports:3,failures,uncaughtErrors:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));assert.deepEqual(failures,[],'UX browser regressions');
}finally{await send('Browser.close')}
