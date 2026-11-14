import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser(),all=canonicalQuestList(),tail=all.filter(q=>q.packId==='real-adventure-05'),results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression,true))return;await sleep(100)}throw Error('Timed out: '+expression)}
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
const progress={catalogueOrigin:2,solved:Object.fromEntries(all.slice(0,400).filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(all.slice(0,400).filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{},stars:1}])),performances:{},badges:{},stars:{},challenges:{},xp:1000,shards:7,legacyAdventureAccess:['real-adventure-05']};
async function openPack(){
 await evaluate('document.getElementById("openSky").click()');
 await evaluate('document.querySelector(\'#adventureRail [data-pack-id="real-adventure-05"]\').click()');
 await evaluate('document.querySelector(\'#sectorTabs [data-content-id="iau-cet"]\').click()');
}
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const width of [320,390,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const k of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen','lumenIntroPresentedV1'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off');`});
  await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  await acknowledgeLearningMilestones(evaluate);await openPack();
  assert.equal(await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${tail[0].id}"]').disabled`),false);
  assert.equal(await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${tail[1].id}"]').disabled`),true,'Pack ownership never skips the previous quest');
  await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${tail[0].id}"]').click()`);await acknowledgeLearningMilestones(evaluate);
  assert.deepEqual((await evaluate('lumenDiagnostics.snapshot()')).puz.reg,tail[0].reg,'Card launches the actual appended grid');
  for(const quest of tail.slice(0,2)){
   await evaluate('document.getElementById("attemptMask").click();(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
   await until('!document.getElementById("skyReveal").hidden');
   const after=await evaluate('lumenDiagnostics.snapshot().progress');assert.equal(after.canonicalQuestState[quest.id].solved,true);
   assert.deepEqual(after.solved,progress.solved,'Old numeric progress is unchanged');
   for(const [id,entry] of Object.entries(progress.canonicalQuestState))assert.deepEqual(after.canonicalQuestState[id],entry);
   await evaluate('(()=>{const h=document.getElementById("skyReveal");if(h?.dataset.victoryPhase==="celebration")h.click();document.getElementById("skyRevealNext").click()})()');await acknowledgeLearningMilestones(evaluate);
  }
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await navigateAndWait({send,evaluate},'Page.reload');
  assert.equal((await evaluate('lumenDiagnostics.snapshot().progress')).canonicalQuestState[tail[1].id].solved,true,'Reload retains appended wins');
  await evaluate('navigator.serviceWorker.ready',true);
  await until(`(async()=>{for(const key of await caches.keys()){const cache=await caches.open(key);if(await cache.match(new URL('/content/generated/fifth-adventure-candidates.json',location.href).href))return true}return false})()`);
  results.push({width,actualGrid:true,sequentialWins:2,oldProgressPreserved:true,reload:true,precacheContainsFifthAdventure:true});
 }
 assert.deepEqual(errors,[]);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,uncaughtErrors:errors},null,2));
 console.log(JSON.stringify(results));
}finally{await send('Browser.close').catch(()=>{})}
