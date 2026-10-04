import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { connectBrowser, acknowledgeLearningMilestones } from './cdp-client.mjs';
import { learningStep, dragLearningStep } from '../src/game/learning.js';
const { send, evaluate, errors } = await connectBrowser();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const results = [];
const output = process.argv[2];
const url = process.env.LUMEN_TEST_URL || 'http://127.0.0.1:8000/';
const snapshot = () => evaluate('lumenDiagnostics.snapshot()');
async function ready(){
  for(let i=0;i<100;i++){
    if(await evaluate('!!window.lumenDiagnostics&&!!lumenDiagnostics.snapshot().state&&document.querySelectorAll("#board .cell").length===25'))return;
    await sleep(100);
  }
  throw Error('Learning app did not initialize: '+JSON.stringify(errors));
}
const point = (r,c) => evaluate(`(()=>{const x=document.querySelector('.cell[data-row="${r}"][data-col="${c}"]').getBoundingClientRect();return {x:x.left+x.width/2,y:x.top+x.height/2}})()`);
async function input(p,mobile){
  if(mobile){await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});await sleep(50);await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  else {await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}
  await sleep(40);
}
async function drag(cells,mobile){
  const points=[];for(const cell of cells)points.push(await point(...cell));
  if(mobile){
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
    for(const p of points.slice(1)){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});await sleep(30);}
    await sleep(200);
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...points[0]});
    for(const p of points.slice(1))await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,...p});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...points.at(-1)});
  }
  await sleep(50);
}
async function geometry(){
  return evaluate(`(()=>{const rect=id=>{const r=(id==='actions'?document.querySelector('.actions'):document.getElementById(id)).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {board:rect('board'),coach:rect('scriptedLearn'),actions:rect('actions'),height:innerHeight,scroll:scrollY,hidden:document.getElementById('scriptedLearn').hidden}})()`);
}
try {
  await send('Page.enable');await send('Runtime.enable');
  for (const viewport of [{width:360,height:640,mobile:true},{width:390,height:844,mobile:true},{width:768,height:1024,mobile:true},{width:1440,height:900,mobile:false}]) {
    await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
    await send('Emulation.setTouchEmulationEnabled',{enabled:viewport.mobile,maxTouchPoints:1});
    const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();localStorage.setItem("lumenSound","off");localStorage.setItem("lumenTutorialSeen","1");localStorage.setItem("lumenPushChoice","later");localStorage.setItem("lumenInstallLater",String(Date.now()));'});
    await send('Page.navigate',{url});
    await sleep(1500);await ready();
    await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier}).catch(error=>{if(!String(error).includes('Script not found'))throw error});
    await sleep(100);
    let board=await snapshot();
    assert.equal(board.levelIndex,0);
    assert.equal(await evaluate('document.getElementById("attemptMask").hidden'),true,'First quest starts directly on the real cell');
    const untouched=JSON.stringify(board.state);
    assert.equal(await evaluate('document.querySelectorAll(".learning-territory-number").length'),5,'SEE numbers the five territories');
    await input(await point(0,0),viewport.mobile);
    assert.equal(JSON.stringify((await snapshot()).state),untouched,'SEE/UNDERSTAND blocks board actions');
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("lumenActiveAttemptV1")).state'),'READY','Ignored intro taps cannot start the attempt');
    const introTitles=[];
    for(let intro=0;intro<6;intro++){
      introTitles.push(await evaluate('document.getElementById("scriptedLearnTitle").textContent'));
      assert.equal(JSON.stringify((await snapshot()).state),untouched,'Intro navigation never changes the board');
      await evaluate('document.getElementById("learningCoachNext").click()');
      await sleep(40);
    }
    assert.deepEqual(introTitles,['Observe le plateau','Ton objectif','Un par territoire','Un par ligne et par colonne','Ils gardent leurs distances','Comment jouer'],'SEE -> UNDERSTAND -> ACT intro remains complete and navigable');
    assert.equal(await evaluate('document.querySelectorAll(".learning-territory-number").length'),0,'Teaching numbers disappear before ACT');
    await input(await point(2,2),viewport.mobile);
    assert.equal((await snapshot()).state[2][2],1,'ACT begins only after the intro');
    await send('Page.reload',{ignoreCache:true});await sleep(100);await ready();
    assert.equal((await snapshot()).state[2][2],1,'Half of the real cell cycle survives reload');
    await evaluate('document.getElementById("attemptMask").click()');
    const attemptId=await evaluate('JSON.parse(localStorage.getItem("lumenActiveAttemptV1")).attemptId');
    await evaluate('window.confirm=()=>true;document.getElementById("new").click()');
    assert.equal((await snapshot()).state.flat().every(value=>value===0),true,'Reset restores the first lesson step');
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("lumenActiveAttemptV1")).attemptId'),attemptId,'Reset preserves the same attempt');
    assert.equal(await evaluate('document.querySelectorAll(".learning-territory-number").length'),5,'Reset restores the SEE introduction');
    for(let intro=0;intro<6;intro++){await evaluate('document.getElementById("learningCoachNext").click()');await sleep(40);}
    await input(await point(2,2),viewport.mobile);
    const stages=[];
    for(let action=0;action<80;action++){
      board=await snapshot();if(board.celebrated)break;
      const step=learningStep(board.puz,board.state);stages.push(step.phase);
      const forbidden=[];for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(!step.cells.some(([y,x])=>r===y&&c===x))forbidden.push([r,c]);
      if(forbidden.length){const before=JSON.stringify(board.state);await input(await point(...forbidden[0]),viewport.mobile);assert.equal(JSON.stringify((await snapshot()).state),before,'Every guided step ignores out-of-zone taps');}
      const layout=await geometry();
      assert(!layout.hidden,'Guidance remains available through quest 1');
      assert(layout.coach.top>=0&&layout.coach.bottom<=layout.height+1,'Coach fits viewport');
      assert(layout.coach.bottom<=layout.board.top||layout.coach.top>=layout.board.bottom||layout.coach.right<=layout.board.left||layout.coach.left>=layout.board.right,'Coach cannot cover the board: '+JSON.stringify(layout));
      assert(layout.coach.bottom<=layout.actions.top||layout.coach.top>=layout.actions.bottom||layout.coach.right<=layout.actions.left||layout.coach.left>=layout.actions.right,'Normal controls remain visible: '+JSON.stringify(layout));
      if(step.phase==='drag'){
        const beforeScroll=layout.scroll,points=[];for(const cell of step.cells)points.push(await point(...cell));
        await evaluate('window.learningRebuild=false;window.learningObserver=new MutationObserver(r=>{if(r.some(x=>x.target.id==="board"))window.learningRebuild=true});learningObserver.observe(document.getElementById("board"),{childList:true})');
        if(viewport.mobile){
          await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
          for(const p of points.slice(1)){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});await sleep(30);}
          await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        }else{
          await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...points[0]});
          for(const p of points.slice(1))await send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,...p});
          await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...points.at(-1)});
        }
        await sleep(50);
        const after=await snapshot();for(const [r,c] of step.cells)assert.equal(after.state[r][c],1,'Real drag marks only expected cells');
        assert.equal(await evaluate('learningRebuild'),false);await evaluate('learningObserver.disconnect()');
        assert.equal((await geometry()).scroll,beforeScroll);
      }else{
        if(step.phase==='place'&&step.number===2&&output){const shot=await send('Page.captureScreenshot');fs.writeFileSync(path.join(path.dirname(output),`learning-${viewport.width}.png`),Buffer.from(shot.data,'base64'));}
        await input(await point(...step.cells[0]),viewport.mobile);
      }
    }
    assert.equal((await snapshot()).celebrated,true,'Normal victory ends the guided quest');
    assert.equal((await snapshot()).progress.solved[0],1);
    await evaluate('document.getElementById("successNew").click()');await sleep(150);
    assert.equal((await snapshot()).levelIndex,1);
    assert.equal(await evaluate('document.getElementById("attemptMask").hidden'),true);
    const quest2Before=JSON.stringify((await snapshot()).state);
    await input(await point(2,4),viewport.mobile);
    assert.equal(JSON.stringify((await snapshot()).state),quest2Before,'Quest 2 begins with a guided singleton');
    await input(await point(0,0),viewport.mobile);await input(await point(0,0),viewport.mobile);
    assert.equal(dragLearningStep((await snapshot()).puz,(await snapshot()).state).phase,'drag');
    await input(await point(0,1),viewport.mobile);
    assert.equal((await snapshot()).state[0][1],0,'A tap cannot skip practicing the real drag gesture');
    assert.equal(await evaluate('document.getElementById("verify").disabled'),true);
    await drag([[0,1],[0,2]],viewport.mobile);
    assert.deepEqual((await snapshot()).state[0],[2,1,1,0,0]);
    await send('Page.reload',{ignoreCache:true});await sleep(100);await ready();
    assert.deepEqual((await snapshot()).state[0],[2,1,1,0,0],'Partial gesture survives reload');
    await evaluate('document.getElementById("attemptMask").click()');
    await sleep(60);
    const q2Layout=await geometry();
    assert(q2Layout.coach.top>=0&&q2Layout.coach.bottom<=q2Layout.height+1,'Quest 2 coach fits the viewport');
    assert(q2Layout.coach.top>=q2Layout.actions.bottom||q2Layout.coach.right<=q2Layout.actions.left||q2Layout.coach.left>=q2Layout.actions.right,'Quest 2 coach leaves controls visible: '+JSON.stringify(q2Layout));
    // Resume on an existing cross and move outside the lesson after finishing it.
    await drag([[0,2],[0,3],[0,4],[1,4],[0,0]],viewport.mobile);
    board=await snapshot();
    assert.deepEqual(board.state[0],[2,1,1,1,1]);
    assert.equal(board.state[1][4],0,'Completing the gesture cannot release its action gate mid-drag');
    assert.equal(dragLearningStep(board.puz,board.state).phase,'complete');
    assert.equal(await evaluate('document.getElementById("verify").disabled'),false);
    await sleep(1200);
    await input(await point(2,4),viewport.mobile);await input(await point(2,4),viewport.mobile);
    assert.equal((await snapshot()).state[2][4],2,'Quest 2 free placement: '+JSON.stringify({viewport,board:await snapshot(),layout:await geometry()}));
    assert.equal(await evaluate('document.getElementById("verify").disabled'),false);
    await evaluate('document.getElementById("learningCoachDismiss").click();document.getElementById("verify").click()');
    assert.match(await evaluate('document.getElementById("scriptedLearnCopy").textContent'),/première vérification/);
    await evaluate('document.getElementById("learningCoachDismiss").click()');
    board=await snapshot();
    for(let r=0;r<5;r++)if(board.state[r][board.puz.sol[r]]!==2){await input(await point(r,board.puz.sol[r]),viewport.mobile);await input(await point(r,board.puz.sol[r]),viewport.mobile);}
    assert.equal((await snapshot()).celebrated,true,'Quest 2 has normal victory');
    assert.match(await evaluate('document.getElementById("successNew").textContent'),/Découvrir Mon ciel/);
    await evaluate('document.getElementById("successOverlay").click()');
    assert.equal(await evaluate('document.getElementById("mapModal").hidden'),true,'Quest 2 backdrop cannot skip the explicit sky discovery');
    await evaluate('document.getElementById("successNew").click()');await sleep(100);
    assert.equal(await evaluate('document.getElementById("mapModal").hidden'),false);
    assert.equal(await evaluate('document.getElementById("skyTour").hidden'),false);
    for(const target of ['sectorTabs','puzzleGrid','performanceLegend','skyCard']){
      assert.equal((await snapshot()).levelIndex,1,'The tour cannot advance before its last step');
      assert.equal(await evaluate(`document.getElementById("${target}").classList.contains("sky-tour-focus")`),true,'The tour explains each real sky zone');
      await evaluate('document.getElementById("skyTourNext").click()');
    }
    assert.equal((await snapshot()).levelIndex,2,'Sky tour leads to quest 3');
    assert.equal(await evaluate('document.getElementById("badgeUnlockOverlay").hidden'),false,'Quest 3 teaches its newly eligible speed badge');
    assert.match(await evaluate('document.getElementById("badgeUnlockCopy").textContent'),/Rapidité/);
    await acknowledgeLearningMilestones(evaluate);
    assert.equal(await evaluate('document.getElementById("scriptedLearn").hidden'),true);
    await evaluate('document.getElementById("openSky").click();document.querySelector("#puzzleGrid .puzzle-card.done").click()');
    assert.equal((await snapshot()).replayMode,true);
    assert.equal(await evaluate('document.getElementById("scriptedLearn").hidden'),true,'Ordinary replay has no imposed lesson');

    assert.equal(await evaluate('document.getElementById("learningSkip").hidden'),true,'First-time learning never exposes skip');
    const returnQuest=(await snapshot()).levelIndex;
    await evaluate('localStorage.setItem("lumenTutorialCompletedV1","1");document.getElementById("replayLearning").click()');
    await sleep(80);
    const beforeSkip=await evaluate('JSON.stringify((()=>{const p=lumenDiagnostics.snapshot().progress;return {solved:p.solved,badges:p.badges,shards:p.shards}})())');
    assert.equal(await evaluate('document.getElementById("learningSkip").hidden'),false,'Completed learner may skip a voluntary learning replay');
    await evaluate('document.getElementById("learningSkip").click()');
    await sleep(80);
    const afterSkip=await snapshot();
    assert.equal(afterSkip.levelIndex,returnQuest,'Skip returns to the original quest');
    assert.equal(await evaluate('document.getElementById("scriptedLearn").hidden'),true,'Skip exits the learning UI');
    assert.equal(await evaluate('JSON.stringify((()=>{const p=lumenDiagnostics.snapshot().progress;return {solved:p.solved,badges:p.badges,shards:p.shards}})())'),beforeSkip,'Skip must not award progress, badges or shards');
    results.push({viewport,stages,realDrag:true,reload:true,reset:true,guidedQuest2Drag:true,partialQuest2Reload:true,freeQuest2:true,skyTour:true,freeReplay:true,firstTimerNoSkip:true,completedReplaySkip:true});

  }
  assert.deepEqual(errors,[]);
  const report={results,uncaughtErrors:errors};if(output)fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await send('Browser.close')}
