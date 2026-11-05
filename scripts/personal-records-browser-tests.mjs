import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser(),results=[];
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
async function until(expression){for(let n=0;n<100;n++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out: '+expression)}
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const width of [320,390,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const p={solved:Object.fromEntries(Array.from({length:21},(_,i)=>[i,1])),badges:{},stars:{},challenges:{},xp:123,shards:7,
   performances:{20:{version:3,badges:{},bestTime:90,bestUnassistedTime:120,lastQualifiedAt:new Date().toISOString(),attempts:1},21:{bestTime:999}}};
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(p))});for(const k of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off');`});
  await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  await evaluate('lumenDiagnostics.setupQuest(20)');await acknowledgeLearningMilestones(evaluate);
  assert.match(await evaluate('document.getElementById("personalRecord").textContent'),/Record : 1:30.*Sans aide : 2:00/);
  assert.equal(await evaluate('document.getElementById("personalRecord").hidden'),false);
  await evaluate('document.getElementById("attemptMask").click();(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
  await until('!document.getElementById("skyReveal").hidden');
  assert.match(await evaluate('document.getElementById("skyRevealRecord").textContent'),/Nouveau record/);
  assert.equal(await evaluate('document.getElementById("skyRevealRecord").hidden'),false);
  assert.equal(await evaluate('getComputedStyle(document.getElementById("skyRevealRecord")).animationName'),'none');
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  const record=await evaluate('lumenDiagnostics.snapshot().progress.performances[20]');
  assert.ok(record.bestTime<90);assert.equal(record.bestUnassistedTime,record.bestTime);
  assert.equal(await evaluate('lumenDiagnostics.snapshot().progress.xp'),123);
  assert.deepEqual(record.badges,{speed:false,autonomy:false,noError:false,mastery:false});
  await navigateAndWait({send,evaluate},'Page.reload');
  assert.equal((await evaluate('lumenDiagnostics.snapshot().progress.performances[20]')).bestUnassistedTime,record.bestUnassistedTime);
  await evaluate('lumenDiagnostics.setupQuest(21)');await acknowledgeLearningMilestones(evaluate);
  assert.equal(await evaluate('document.getElementById("personalRecord").hidden'),true,'An unplayed quest has no claimed record');
  results.push({width,recordsBeforePlay:true,nonQualifyingRecord:true,rewardsUnchanged:true,reload:true,reducedMotion:true,noHorizontalOverflow:true});
 }
 assert.deepEqual(errors,[]);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,uncaughtErrors:errors},null,2));
 console.log(JSON.stringify(results));
}finally{await send('Browser.close').catch(()=>{})}
