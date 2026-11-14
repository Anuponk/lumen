import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {rateLogicalDifficulty} from '../src/game/logical-difficulty.js';
import {CONSTELLATIONS_PER_PAGE} from '../src/ui/sky-navigation.js';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser(),all=canonicalQuestList(),results=[];
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression){for(let i=0;i<180;i++){if(await evaluate(expression,true))return;await pause(100)}throw Error('Timed out: '+expression)}
const packs=['real-adventure-06','real-adventure-07','real-adventure-08','real-adventure-09'];
const badges={autonomy:true,speed:true,noError:true,mastery:true};
function progressFor(q,mastery){
 const members=all.filter(x=>x.ordinal<q.ordinal||mastery&&x.id===q.id),p={catalogueOrigin:3,solved:{},canonicalQuestState:{},performances:{},badges:{},stars:{},challenges:{},xp:1000,shards:7,legacyAdventureAccess:packs};
 for(const x of members)if(x.legacyIndex===null)p.canonicalQuestState[x.id]={solved:true,badges:mastery?{...badges}:{},stars:1};else{p.solved[x.legacyIndex]=1;if(mastery)p.performances[x.legacyIndex]={version:3,badges:{...badges}}}
 if(mastery)delete p.canonicalQuestState[q.id].badges.mastery;
 return p;
}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 for(const width of [320,390,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:844,deviceScaleFactor:1,mobile:width<600});
  for(const ordinal of [500,501,600,700,800,880,'mastery']){
   const mastery=ordinal==='mastery',q=mastery?all.at(-1):all[ordinal-1],progress=progressFor(q,mastery);
   const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const k of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen','lumenIntroPresentedV1'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off');`});
   await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
   await acknowledgeLearningMilestones(evaluate);
   await evaluate("document.getElementById('openSky').click()");
   await until(`!!document.querySelector('#adventureRail [data-pack-id="${q.packId}"]')`);
   await evaluate(`document.querySelector('#adventureRail [data-pack-id="${q.packId}"]').click()`);
   const entries=CONTENT_CONSTELLATIONS.filter(c=>c.packId===q.packId),page=Math.floor(entries.findIndex(c=>c.id===q.constellationId)/CONSTELLATIONS_PER_PAGE);
   for(let i=0;i<page;i++)await evaluate("document.getElementById('constellationNext').click()");
   await until(`!!document.querySelector('#sectorTabs [data-content-id="${q.constellationId}"]')`);
   await evaluate(`document.querySelector('#sectorTabs [data-content-id="${q.constellationId}"]').click()`);
   if(q.packId===packs.at(-1))assert.equal(await evaluate("document.querySelectorAll('#sectorTabs [data-content-id]').length"),entries.slice(page*CONSTELLATIONS_PER_PAGE,(page+1)*CONSTELLATIONS_PER_PAGE).length,'Final adventure paginates eight constellations');
   assert.equal(await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${q.id}"]').disabled`),false);
   await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${q.id}"]').click()`);await acknowledgeLearningMilestones(evaluate);
   assert.deepEqual((await evaluate('lumenDiagnostics.snapshot()')).puz.reg,q.reg);
   await evaluate("if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click();document.getElementById('questStart').hidden=true");
   // Finale sizing runs through ResizeObserver + requestAnimationFrame.
   await until("(()=>{const r=document.getElementById('board').getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1})()");
   const geometry=await evaluate("({rect:document.getElementById('board').getBoundingClientRect().toJSON(),width:innerWidth,height:innerHeight,scrollY})");
   assert(geometry.rect.top>=-1&&geometry.rect.bottom<=geometry.height+1&&geometry.rect.left>=-1&&geometry.rect.right<=geometry.width+1,'The actual board fits the viewport, including 10×10 at 320×568: '+JSON.stringify({ordinal,...geometry}));
   if(width===390&&ordinal===501){
    await evaluate('navigator.serviceWorker.ready',true);
    await until(`(async()=>{for(const key of await caches.keys()){if(await (await caches.open(key)).match('/content/generated/remaining-adventures.json'))return true}return false})()`);
    await until('!!navigator.serviceWorker.controller');
    await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
    await navigateAndWait({send,evaluate},'Page.reload');await until('!!window.lumenDiagnostics');await acknowledgeLearningMilestones(evaluate);
    // QA deliberately disables account/attempt auto-restoration. Re-enter the
    // real card offline; authenticated restoration is covered separately.
    await evaluate("document.getElementById('openSky').click()");
    await evaluate(`document.querySelector('#adventureRail [data-pack-id="${q.packId}"]').click()`);
    await evaluate(`document.querySelector('#sectorTabs [data-content-id="${q.constellationId}"]').click()`);
    await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${q.id}"]').click()`);await acknowledgeLearningMilestones(evaluate);
    assert.deepEqual((await evaluate('lumenDiagnostics.snapshot()')).puz.reg,q.reg,'New adventure card and actual grid are available offline');
   }
   const logicalTouchReplay=width===390&&[500,600,700,800].includes(ordinal);
   if(logicalTouchReplay){
    await evaluate("if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click();document.getElementById('questStart').hidden=true");
    const proof=rateLogicalDifficulty(q.reg);assert(proof.solved);
    // Play an independently derived proof through actual touch handlers. No
    // diagnostics setBoard and no solution lookup for these four samples.
    for(const fact of proof.trace.filter(f=>f.rule==='single'))for(const [r,c] of fact.targets){
     const point=await evaluate(`(()=>{const r=document.querySelector('.cell[data-row="${r}"][data-col="${c}"]').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
     for(let tap=0;tap<2;tap++){
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await pause(50);
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await pause(80);
     }
     assert.equal(await evaluate(`lumenDiagnostics.snapshot().state[${r}][${c}]`),2,'Real tap cycle places proven guardian');
    }
   }else await evaluate(`if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click();document.getElementById('questStart').hidden=true;(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
   await until('!document.getElementById("skyReveal").hidden');
   const after=await evaluate('lumenDiagnostics.snapshot().progress');assert.equal(after.canonicalQuestState[q.id].solved,true);assert.deepEqual(after.solved,progress.solved);
   const expected=mastery?'campaign-mastery':ordinal===880?'campaign':ordinal===501?null:'adventure';
   if(expected){
    await until(`document.getElementById('skyReveal').dataset.celestial===${JSON.stringify(expected)}`);
    if(ordinal===880||mastery)assert.match(await evaluate("document.getElementById('celestialSummary').textContent"),/88 constellations.*880\/880/);
    await evaluate("document.getElementById('skyRevealTitle').click()");
   }
   assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
   if([500,600,700,800].includes(ordinal)){
    await evaluate("(()=>{const h=document.getElementById('skyReveal');if(h?.dataset.victoryPhase==='celebration')h.click();document.getElementById('skyRevealNext').click()})()");await acknowledgeLearningMilestones(evaluate);
    assert.deepEqual((await evaluate('lumenDiagnostics.snapshot()')).puz.reg,all[ordinal].reg,'Boundary launches next adventure');
   }else await evaluate("(()=>{const h=document.getElementById('skyReveal');if(h?.dataset.victoryPhase==='celebration')h.click();document.getElementById('skyRevealNext').click()})()");
   if(width===390&&ordinal===501){
    await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
    await navigateAndWait({send,evaluate},'Page.reload');assert.equal((await evaluate('lumenDiagnostics.snapshot().progress')).canonicalQuestState[q.id].solved,true,'Offline victory survives reconnect and restart');
   }
   results.push({width,ordinal,actualGrid:true,oldProgressPreserved:true,celebration:expected,logicalTouchReplay,offline:width===390&&ordinal===501});
   console.log('PASS IAU browser '+width+' '+ordinal);
  }
 }
 assert.deepEqual(errors,[]);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,uncaughtErrors:errors},null,2)+'\n');
 console.log(JSON.stringify(results));
}finally{await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}).catch(()=>{});await send('Browser.close').catch(()=>{})}
