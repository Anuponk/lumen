import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CONTENT_PACKS,CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {CONSTELLATIONS_PER_PAGE} from '../src/ui/sky-navigation.js';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser(),all=canonicalQuestList(),results=[];
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
async function until(expr){for(let i=0;i<160;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,80))}throw Error('Timed out '+expr)}
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const width of [320,390,1440])for(const pack of [CONTENT_PACKS[0],CONTENT_PACKS.at(-1)]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:900,mobile:width<600,deviceScaleFactor:1});
  const reduced=width===390;await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
  const q=all.filter(q=>q.packId===pack.id).at(-1),p={catalogueOrigin:3,badges:{},stars:{},challenges:{},solved:{},performances:{},canonicalQuestState:{},shards:7,xp:123,legacyAdventureAccess:CONTENT_PACKS.map(p=>p.id),autoCrossUnlockSeen:1,fullBadgeIntroSeen:1};
  for(const x of all){const badges=x.packId===pack.id?{autonomy:true,speed:true,noError:true,mastery:true}:{};if(x.legacyIndex===null)p.canonicalQuestState[x.id]={solved:true,badges,stars:1};else{p.solved[x.legacyIndex]=1;p.performances[x.legacyIndex]={version:3,badges}}}
  delete (q.legacyIndex===null?p.canonicalQuestState[q.id]:p.performances[q.legacyIndex]).badges.mastery;
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(p))});for(const k of ['lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenTutorialSeen','lumenSkyTourSeen'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off')`});
  await navigateAndWait({send,evaluate},'Page.navigate',{url:url.href});await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});await acknowledgeLearningMilestones(evaluate);
  await evaluate(`document.getElementById('openSky').click();if(!document.querySelector('#adventureRail [data-pack-id="${pack.id}"]'))throw Error(JSON.stringify({rail:document.getElementById('adventureRail').innerHTML,sky:lumenDiagnostics.skySnapshot()}));document.querySelector('#adventureRail [data-pack-id="${pack.id}"]').click()`);
  assert.equal(await evaluate(`document.querySelector('#adventureRail [data-pack-id="${pack.id}"]').classList.contains('mastered')`),false,'Completed quests alone are not mastery');
  const entries=CONTENT_CONSTELLATIONS.filter(c=>c.packId===pack.id),page=Math.floor(entries.findIndex(c=>c.id===q.constellationId)/CONSTELLATIONS_PER_PAGE);
  for(let i=0;i<page;i++)await evaluate("document.getElementById('constellationNext').click()");
  await evaluate(`document.querySelector('#sectorTabs [data-content-id="${q.constellationId}"]').click();document.querySelector('#puzzleGrid [data-quest-id="${q.id}"]').click()`);await acknowledgeLearningMilestones(evaluate);
  await evaluate(`if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click();document.getElementById('questStart').hidden=true;(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
  await until("document.getElementById('skyReveal').dataset.celestial==='adventure-mastery'");
  assert.equal(await evaluate("document.querySelectorAll('.celestial-figure').length"),entries.length);
  assert.match(await evaluate("document.getElementById('skyRevealTitle').textContent"),/aventure pleinement maîtrisée/);
  assert.equal(await evaluate("document.getElementById('skyReveal').classList.contains('celestial-still')"),reduced);
  assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
  await evaluate("document.getElementById('skyRevealTitle').click()");
  if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`docs/validation/adventure-mastery-${pack.id}.png`,Buffer.from(shot.data,'base64'))}
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert(await evaluate('!!document.activeElement.closest("#skyReveal")'));
  const saved=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
  await evaluate("document.getElementById('skyRevealSky').click()");
  assert.equal(await evaluate(`document.querySelector('#adventureRail [data-pack-id="${pack.id}"]').classList.contains('mastered')`),true);
  assert.match(await evaluate(`document.querySelector('#adventureRail [data-pack-id="${pack.id}"]').getAttribute('aria-label')`),/Maîtrisée/);
  const appearance=await evaluate(`(()=>{const mastered=document.querySelector('#adventureRail [data-pack-id="${pack.id}"]'),ordinary=document.querySelector('#adventureRail .adventure-chip:not(.mastered)');return {label:mastered.textContent,background:getComputedStyle(mastered).backgroundImage,ordinaryBackground:getComputedStyle(ordinary).backgroundImage,ordinaryId:ordinary.dataset.packId}})()`);
  assert.match(appearance.label,/Maîtrisée/,'Mastery must be visible in the rail, beyond color or a tooltip');
  assert.notEqual(appearance.background,appearance.ordinaryBackground,'Mastered adventures have a distinct filled background');
  await evaluate(`document.querySelector('#adventureRail [data-pack-id="${appearance.ordinaryId}"]').click()`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#adventureRail [data-pack-id="${pack.id}"]')).backgroundImage`),appearance.background,'The mastered fill remains when another adventure is selected');
  assert.equal(await evaluate(`document.querySelector('#adventureRail [data-pack-id="${pack.id}"]').getAttribute('aria-pressed')`),'false');
  if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`docs/validation/mastered-rail-${pack.id}.png`,Buffer.from(shot.data,'base64'))}
  await navigateAndWait({send,evaluate},'Page.reload');await acknowledgeLearningMilestones(evaluate);
  assert.equal(await evaluate("document.getElementById('skyReveal').hidden"),true,'Refresh cannot replay mastery');
  await evaluate("document.getElementById('openSky').click()");
  assert.equal(await evaluate(`document.querySelector('#adventureRail [data-pack-id="${pack.id}"]').classList.contains('mastered')`),true,'Mastery marker survives reload');
  assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),saved,'Navigation and reload grant no rewards');
  results.push({width,pack:pack.id,constellations:entries.length,replayBadge:true,masteryScene:true,staticMarker:true,reducedMotion:reduced});
 }
 assert.deepEqual(errors,[]);if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,physicalDevice:false},null,2));console.log(JSON.stringify(results));
}finally{await send('Browser.close').catch(()=>{})}
