import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser,navigateAndWait,acknowledgeLearningMilestones,revealVictoryResults} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser(),results=[];
async function until(expression){for(let i=0;i<120;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,80))}throw Error('Timed out: '+expression)}
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const width of [320,390,1440])for(const prior of [110,150,135]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:prior===135?'reduce':'no-preference'}]});
  const p={solved:Object.fromEntries(Array.from({length:21},(_,i)=>[i,1])),badges:{},stars:{},challenges:{},xp:123,shards:7,performances:{20:{version:3,badges:{},bestTime:prior,officialTimes:{0:prior},lastQualifiedAt:new Date().toISOString(),attempts:1}}};
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(p))});for(const k of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off');`});
  const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  await evaluate('lumenDiagnostics.setupQuest(20)');await acknowledgeLearningMilestones(evaluate);
  await evaluate('document.getElementById("attemptMask").click()');
  // Layout geometry excludes the existing successful-verification pulse transform.
  const geometry="(()=>{const b=document.getElementById('board');return {left:b.offsetLeft,top:b.offsetTop,width:b.offsetWidth,height:b.offsetHeight}})()";
  const rect=await evaluate(geometry);
  await evaluate('document.getElementById("verify").click()');
  await until('!document.getElementById("timePenalty")?.hidden');
  assert.equal(await evaluate('document.getElementById("timePenalty").textContent'),'+5 s');
  assert.equal(await evaluate('document.getElementById("time").textContent'),'0:05');
  const after=await evaluate(geometry);assert.deepEqual(after,rect,'Penalty cannot move the grid layout');
  // Frozen restored attempt: reload/init reads real duration plus cumulative counts.
  await evaluate(`(()=>{const a=JSON.parse(localStorage.getItem('lumenActiveAttemptV1'));a.activeDuration=60000;a.state='PAUSED';a.helpUses={hint:5,verify:0,guided:0};a.assistanceUsed=true;localStorage.setItem('lumenActiveAttemptV1',JSON.stringify(a));lumenDiagnostics.setupQuest(20)})()`);
  assert.equal(await evaluate('document.getElementById("time").textContent'),'2:15');
  await evaluate('lumenDiagnostics.setupQuest(20)');assert.equal(await evaluate('document.getElementById("time").textContent'),'2:15','Repeated restoration does not add penalties');
  await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');await until('!document.getElementById("skyReveal").hidden');
  assert.equal(await evaluate('document.getElementById("skyRevealTime").textContent'),'2:15');
  const record=await evaluate('document.getElementById("skyRevealRecord").textContent');assert.equal(record.includes('Nouveau record !'),prior>135);assert.equal(record.includes('1:00'),false);
  assert.equal(await evaluate(`[...document.querySelectorAll('.personal-record-new')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).length`),prior>135?1:0,'Exactly one visible new-record announcement');
  assert.equal(await evaluate('lumenDiagnostics.snapshot().progress.performances[20].officialTimes[0]'),Math.min(prior,135));
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight'),true);
  if(prior===110){
   // Close before ever opening ranking: confirmed progression must already survive.
   await navigateAndWait({send,evaluate},'Page.reload');assert.equal(await evaluate('lumenDiagnostics.snapshot().progress.performances[20].officialTimes[0]'),110);
  }else{await revealVictoryResults(evaluate);assert.equal(await evaluate('document.getElementById("skyReveal").dataset.victoryPhase'),'ranking')}
  results.push({width,prior,official:135,newRecord:prior>135,immediatePenalty:true,stableGrid:true,noDoublePenalty:true,persistedBeforeRanking:true});
 }
 assert.deepEqual(errors,[]);if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results));
}finally{await closeBrowser(send)}
