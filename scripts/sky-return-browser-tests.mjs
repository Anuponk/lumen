import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {CONSTELLATIONS_PER_PAGE} from '../src/ui/sky-navigation.js';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
const all=canonicalQuestList(),solved=Object.fromEntries(all.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1]));
const progress={catalogueOrigin:3,solved,historyBackup:solved,badges:{},stars:{},performances:{},challenges:{},xp:1000,shards:7,canonicalQuestState:Object.fromEntries(all.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{}}])),legacyAdventureAccess:CONTENT_PACKS.map(p=>p.id)};
const {send,evaluate,errors}=await connectBrowser(),results=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<180;i++){if(await evaluate(expression,true))return;await pause(100)}throw Error('Timed out: '+expression)}
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
try{
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const k of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen','lumenIntroPresentedV1'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off');`});
 await navigateAndWait({send,evaluate},'Page.navigate',{url:url.href});await acknowledgeLearningMilestones(evaluate);
 for(const pack of CONTENT_PACKS){
  const entries=CONTENT_CONSTELLATIONS.filter(c=>c.packId===pack.id);if(!entries.length)continue;
  const constellation=entries.at(-1),members=all.filter(q=>q.constellationId===constellation.id),q=members[1]??members[0];
  await evaluate(`document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${pack.id}"]').click()`);
  const page=Math.floor((entries.length-1)/CONSTELLATIONS_PER_PAGE);
  for(let i=0;i<page;i++)await evaluate("document.getElementById('constellationNext').click()");
  await evaluate(`document.querySelector('#sectorTabs [data-content-id="${constellation.id}"]').click();document.querySelector('#puzzleGrid [data-quest-id="${q.id}"]').click()`);await acknowledgeLearningMilestones(evaluate);
  assert.deepEqual((await evaluate('lumenDiagnostics.snapshot()')).puz.reg,q.reg);
  const before=await evaluate('lumenDiagnostics.snapshot().progress'),attempt=await evaluate("JSON.parse(localStorage.getItem('lumenActiveAttemptV1'))");
  for(const browseElsewhere of [false,true]){
   if(browseElsewhere)await evaluate(`document.querySelector('#adventureRail [data-pack-id="${CONTENT_PACKS[0].id}"]').click();document.getElementById('closeMap').click()`);
   await evaluate("document.getElementById('openSky').click()");
   const sky=await evaluate('lumenDiagnostics.skySnapshot()');assert.equal(sky.viewedAdventure,pack.id,'Return to the played adventure '+q.id);assert.equal(sky.page,page);
   assert(await evaluate(`!!document.querySelector('#sectorTabs [data-content-id="${constellation.id}"].active')`),'Return to the played constellation');
  }
  await evaluate("document.getElementById('closeMap').click()");
  const after=await evaluate('lumenDiagnostics.snapshot().progress');for(const key of ['solved','canonicalQuestState','performances','xp','shards'])assert.deepEqual(after[key],before[key],'Browsing preserves '+key);
  assert.equal((await evaluate("JSON.parse(localStorage.getItem('lumenActiveAttemptV1'))")).attemptId,attempt.attemptId);
  await evaluate("if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click();document.getElementById('questStart').hidden=true;(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()");
  await until("!document.getElementById('skyReveal').hidden");
  await evaluate("document.getElementById('skyRevealSky').click()");
  const victorySky=await evaluate('lumenDiagnostics.skySnapshot()');assert.equal(victorySky.viewedAdventure,pack.id,'Victory returns to the played adventure');assert.equal(victorySky.view,'detail');
  assert(await evaluate(`!!document.querySelector('#puzzleGrid [data-quest-id="${q.id}"]')`));
  await evaluate("document.getElementById('closeMap').click()");
  results.push({pack:pack.id,quest:q.id,header:true,browseReturn:true,replayVictory:true,page});
 }
 assert.deepEqual(errors,[]);if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,physicalDevice:false},null,2)+'\n');console.log(JSON.stringify(results));
}finally{await send('Browser.close').catch(()=>{})}
