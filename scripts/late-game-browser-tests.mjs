import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser} from './cdp-client.mjs';
import {campaignQuestCount,skyStarsForGrid} from '../src/campaign/progression.js';
import {CAT} from '../src/campaign/catalogue.js';
import {CAMPAIGN_SIZE_SCHEDULE,CAMPAIGN6_ORDER,SKY_TARGET} from '../src/campaign/data.js';

const {send,evaluate,errors}=await connectBrowser();
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const snapshot=()=>evaluate('lumenDiagnostics.snapshot()');
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+expression+'; '+JSON.stringify({snapshot:await snapshot(),errors}))}
async function click(id){const p=await evaluate(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});}
const results=[];
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const viewport of [{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.clear();localStorage.setItem("lumenQaProgressV1",JSON.stringify({solved:Object.fromEntries(Array.from({length:99},(_,i)=>[i,1])),badges:{historical:1},shards:7,xp:123,skyScore:147,skyHistoryVersion:4}));localStorage.setItem("lumenSound","off");localStorage.setItem("lumenTutorialSeen","1");localStorage.setItem("lumenQaTutorialSeen","1");localStorage.setItem("lumenQaTutorialCompletedV1","1");localStorage.setItem("lumenInstallLater",String(Date.now()));localStorage.setItem("lumenPushChoice","later");'});
  await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics && !!navigator.serviceWorker.controller');await sleep(1500);await until('!!window.lumenDiagnostics');
  assert.equal(await evaluate('new URL(location.href).searchParams.get("qa")'),"new","Late-game regression runs in QA mode");
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  assert.equal((await snapshot()).levelIndex,99);
  await evaluate('document.getElementById("successNew").click()');
  assert.equal((await snapshot()).levelIndex,99,'Unsolved quest 100 cannot be skipped');
  await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
  await until('!document.getElementById("skyReveal").hidden');
  await click('skyRevealContinue');
  await until('document.getElementById("successOverlay").classList.contains("show")');
  const won=await snapshot();assert.equal(won.progress.solved[99],1);
  await evaluate('document.getElementById("successNew").click()');
  let current=await snapshot();
  assert.equal(current.levelIndex,100,'Quest 100 celebration continues to quest 101: '+JSON.stringify(await evaluate('({qa:new URL(location.href).searchParams.get("qa"),offerHidden:document.getElementById("accountOptin").hidden,successVisible:document.getElementById("successOverlay").classList.contains("show"),mapHidden:document.getElementById("mapModal").hidden,active:document.activeElement?.id})')));
  const [size,slot]=CAMPAIGN_SIZE_SCHEDULE[100];
  assert.deepEqual(current.puz,CAT[size][size==='6'?CAMPAIGN6_ORDER[slot]:slot]);
  assert.equal(current.celebrated,false);assert(current.state.flat().every(v=>v===0));
  assert.equal(current.progress.solved[100],undefined);assert.deepEqual(current.progress,won.progress,'Navigation cannot change rewards or history');
  assert.equal(current.progress.badges.historical,1);
  await send('Page.reload',{ignoreCache:true});await sleep(500);await until('!!window.lumenDiagnostics');
  assert.equal((await snapshot()).levelIndex,100,'Reload after quest 100 resumes quest 101');
  await evaluate('document.getElementById("attemptMask").click()');
  const target=await evaluate('(()=>{const s=lumenDiagnostics.snapshot();return {row:0,col:s.puz.sol[0]}})()');
  const point=await evaluate(`(()=>{const r=document.querySelector('.cell[data-row="${target.row}"][data-col="${target.col}"]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  assert.equal((await snapshot()).state[0][target.col],1);
  const attempt=await evaluate('JSON.parse(localStorage.getItem("lumenActiveAttemptV1")).attemptId');
  await send('Page.reload',{ignoreCache:true});await sleep(500);await until('!!window.lumenDiagnostics');
  current=await snapshot();assert.equal(current.levelIndex,100);assert.equal(current.state[0][target.col],1);
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("lumenActiveAttemptV1")).attemptId'),attempt);
  await evaluate('document.getElementById("attemptMask").click();document.getElementById("openSky").click();document.getElementById("closeMap").click()');
  assert.equal((await snapshot()).levelIndex,100,'Closing the map preserves the unsolved quest');
  await evaluate(`lumenDiagnostics.setupQuest(${campaignQuestCount()-1})`);
  assert((await snapshot()).levelIndex<campaignQuestCount()-1,'An unstarted locked Adventure cannot be loaded');
  await evaluate(`localStorage.setItem("lumenQaProgressV1",JSON.stringify({solved:Object.fromEntries(Array.from({length:${campaignQuestCount()-1}},(_,i)=>[i,1])),badges:{historical:1},skyScore:150,skyHistoryVersion:4}));localStorage.removeItem("lumenActiveAttemptV1")`);
  await send('Page.reload',{ignoreCache:true});await sleep(500);await until('!!window.lumenDiagnostics');
  current=await snapshot();assert.equal(current.levelIndex,campaignQuestCount()-1);
  assert.equal(current.progress.skyScore,SKY_TARGET-skyStarsForGrid(campaignQuestCount()-1),'Restore recovers extension stars from an old capped save');
  await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
  await until('!document.getElementById("skyReveal").hidden');await click('skyRevealContinue');
  await until('!document.getElementById("endgameOverlay").hidden');
  current=await snapshot();assert.equal(current.levelIndex,campaignQuestCount()-1);assert.equal(current.progress.skyScore,SKY_TARGET);
  assert.equal(current.progress.badges.historical,1);assert.equal(current.progress.badges.master,1);
  assert.match(await evaluate('document.getElementById("endgameSummary").textContent'),new RegExp(String(campaignQuestCount())));
  results.push({viewport,transition100to101:true,normalCelebration:true,noSkip:true,rewardsPreserved:true,reload:true,sameAttempt:true,mapReturn:true,lastQuest:true,cappedSaveRecovery:true,finalVictory:true,completeSky:true});
 }
 assert.deepEqual(errors,[]);
 const report={results,uncaughtErrors:errors};if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await send('Browser.close')}
