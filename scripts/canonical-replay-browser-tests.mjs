import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
const {send,evaluate,errors}=await connectBrowser();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+expression)}
const quests=canonicalQuestList().filter(q=>q.constellationId==='real-01');
const targets=quests.slice(-2),results=[];
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
async function openDetail(){
 await evaluate(`lumenDiagnostics.setupQuest(${quests.filter(q=>q.legacyIndex!==null).at(-1).legacyIndex})`);await acknowledgeLearningMilestones(evaluate);
 await evaluate('document.getElementById("openSky").click()');
 await evaluate('document.querySelector(\'#sectorTabs [data-content-id="real-01"]\').click()');
}
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const viewport of [{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  const progress={solved:Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{autonomy:true},performance:{seconds:120}}])),xp:123,shards:7,badges:{}};
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const key of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(key,'1');localStorage.setItem('lumenSound','off');`});
  await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');await sleep(1000);
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  for(const q of targets){
   await openDetail();
   const selector=`#puzzleGrid [data-quest-id="${q.id}"]`;
   assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).disabled`),false);
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
   await acknowledgeLearningMilestones(evaluate);
   await evaluate('document.getElementById("attemptMask").click()');
   await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
   await until('document.getElementById("successOverlay").classList.contains("show")');
   const saved=await evaluate(`lumenDiagnostics.snapshot().progress.canonicalQuestState[${JSON.stringify(q.id)}]`);
   for(const key of ['autonomy','speed','noError','mastery'])assert.equal(saved.badges[key],true,q.id+' earns '+key);
   const text=await evaluate('document.getElementById("successSub").textContent');
   assert.match(text,/Rapidité/);assert.match(text,/Sans erreur/);assert.match(text,/Maîtrise/);
   assert.doesNotMatch(text,/XP|étoile/,'replay never announces new completion rewards');
   await evaluate('document.getElementById("successSky").click()');
   await send('Page.reload',{ignoreCache:true});await until('!!window.lumenDiagnostics');await sleep(500);
   const restored=await evaluate('lumenDiagnostics.snapshot().progress');
   assert.deepEqual(restored.canonicalQuestState[q.id],saved,'reload preserves upgraded badges');
   assert.equal(restored.xp,progress.xp);assert.equal(restored.shards,progress.shards);
   await openDetail();
   assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(selector+' .performance-slot.earned')}).length`),4,'Mon ciel shows all four badges');
   results.push({viewport,questId:q.id,replayBadges:true,reload:true,noDuplicateRewards:true});
  }
 }
 assert.deepEqual(errors,[]);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,uncaughtErrors:errors},null,2));
 console.log(JSON.stringify(results));
}finally{await send('Browser.close').catch(()=>{})}
