// #908 · Real browser: Abandonner on a canonical quest (the window that only a
// victory used to set), persisted across reload, then expired.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser,acknowledgeLearningMilestones,REPLAY_FROM_REVIEW} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
const {send,evaluate,errors}=await connectBrowser(),results=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(expression,label=expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(80)}throw Error('Timed out: '+label)}
const quests=canonicalQuestList().filter(q=>q.constellationId==='real-01');
const target=quests.find(q=>q.legacyIndex===null),lastLegacy=quests.filter(q=>q.legacyIndex!==null).at(-1);
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
const selector=`#puzzleGrid [data-quest-id="${target.id}"]`;
const visible=id=>`(()=>{const e=document.getElementById(${JSON.stringify(id)});return !!e&&!e.hidden&&e.getClientRects().length>0})()`;
const attempt=()=>evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')`);
const startOf=()=>evaluate(`(JSON.parse(localStorage.getItem('lumenQualifyingStartsV1')||'{}').qa||{})[${JSON.stringify(target.id)}]||null`);
async function openSkyDetail(){
 await evaluate(`lumenDiagnostics.setupQuest(${lastLegacy.legacyIndex})`);await acknowledgeLearningMilestones(evaluate);
 await evaluate('document.getElementById("openSky").click()');
 await evaluate('document.querySelector(\'#sectorTabs [data-content-id="real-01"]\').click()');
}
async function openTarget(){
 await openSkyDetail();
 await evaluate(`document.querySelector(${JSON.stringify(selector)}).click();${REPLAY_FROM_REVIEW}`);
 await acknowledgeLearningMilestones(evaluate);
}
const status=()=>evaluate(`document.querySelector('#campaignMapLabel .badge-qualification-status')?.textContent||''`);
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const viewport of [{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  const progress={solved:Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),
   canonicalQuestState:Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{},performance:{seconds:120}}])),xp:123,shards:7,badges:{}};
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const key of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(key,'1');localStorage.setItem('lumenSound','off');`});
  await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');await sleep(800);
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});

  // 1. Before the first move: leaving consumes nothing.
  await openTarget();
  assert.equal(await evaluate(visible('replayCooldownModal')),false,'a never-played window opens directly');
  assert.equal((await attempt())?.state??'READY','READY');
  assert.equal(await evaluate(visible('attemptAbandon')),false,'Abandonner only exists after the first move');
  await evaluate('document.getElementById("openSky").click()');
  assert.equal(await startOf(),null,'leaving before the first move consumes no qualification');
  await evaluate('document.getElementById("closeMap").click()');

  // 2. First move: qualifying run, window recorded from its start.
  await evaluate('document.getElementById("attemptMask").click()');
  const live=await attempt();
  assert.equal(live.state,'RUNNING');assert.equal(live.qualifying,true);assert.equal(live.mode,'replay');
  assert.match(await status(),/Tentative qualifiante/);
  assert.equal(await startOf(),new Date(live.startedAt).toISOString(),'the window starts with the run');
  assert.equal(await evaluate(visible('attemptAbandon')),true,'Abandonner is offered after the first move');
  assert.equal(await evaluate("document.getElementById('attemptAbandon').textContent"),'Quitter','#1008: the top action reads Quitter; its dialog names the consequences');

  // 3. Cancel: the attempt is untouched.
  await evaluate('document.getElementById("attemptAbandon").click()');
  assert.equal(await evaluate(visible('abandonConfirm')),true);
  const dialog=await evaluate(`({title:document.getElementById('abandonConfirmTitle').textContent,copy:document.getElementById('abandonConfirmCopy').textContent,yes:document.getElementById('abandonConfirmYes').textContent,no:document.getElementById('abandonContinue').textContent,focus:document.activeElement?.id,overflow:document.documentElement.scrollWidth>innerWidth})`);
  assert.equal(dialog.title,'Abandonner cette tentative ?');assert.match(dialog.copy,/Mon Ciel/);assert.match(dialog.copy,/1[45] min/);
  assert.equal(dialog.yes,'Abandonner et revenir au ciel');assert.equal(dialog.no,'Continuer la partie');
  assert.equal(dialog.focus,'abandonContinue','the safe choice has focus');assert.equal(dialog.overflow,false);
  if(viewport.mobile)fs.writeFileSync(new URL('../docs/validation/abandon-confirm-390.png',import.meta.url),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate('document.getElementById("abandonContinue").click()');
  assert.equal(await evaluate(visible('abandonConfirm')),false);
  // #925: the dialog paused the run; closing it resumes the same run once.
  await until(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).state==='RUNNING'`);
  const kept=await attempt();
  assert.equal(kept.attemptId,live.attemptId);assert.equal(kept.state,'RUNNING');assert.equal(kept.qualifying,true);
  assert.deepEqual(kept.board,live.board,'cancelling keeps the board');
  await evaluate('document.getElementById("attemptAbandon").click()');
  await evaluate(`document.getElementById('abandonConfirm').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  assert.equal(await evaluate(visible('abandonConfirm')),false,'Escape cancels');await until(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).state==='RUNNING'`,'Escape resumes the run');

  // 4. Confirm: closed, no resumable run, Mon Ciel on its constellation.
  await evaluate('document.getElementById("attemptAbandon").click()');
  await evaluate('document.getElementById("abandonConfirmYes").click()');
  await until(visible('mapModal'),'Mon Ciel opens');
  const after=await attempt();
  assert.notEqual(after?.attemptId,live.attemptId,'the abandoned run cannot be resumed');
  assert.notEqual(after?.state,'RUNNING');
  assert.equal(await evaluate(`lumenDiagnostics.skySnapshot().constellationId??document.querySelector('#sectorTabs [aria-selected="true"], #sectorTabs .active')?.dataset.contentId`),'real-01','Mon Ciel focuses the quest constellation');
  assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).classList.contains('badge-on-cooldown')`),true,'the card shows the running window');
  assert.equal(await startOf(),new Date(live.startedAt).toISOString(),'the abandon does not reset the window');

  // 5. Replay within the window (T+seconds ≈ T+1 min): explicit warning, non-qualifying, no badge.
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click();${REPLAY_FROM_REVIEW}`);await acknowledgeLearningMilestones(evaluate);
  assert.equal(await evaluate(visible('replayCooldownModal')),true,'the replay warns before starting');
  await evaluate('document.getElementById("replayCooldownPlay").click()');
  await evaluate('document.getElementById("attemptMask").click()');
  const replay=await attempt();
  assert.equal(replay.qualifying,false,'T+1 min: non-qualifying');
  assert.match(await status(),/Hors qualification badges — Réessaie dans 1[45] min/);
  await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
  await until(visible('skyReveal'),'replay victory');
  const badges=await evaluate(`lumenDiagnostics.snapshot().progress.canonicalQuestState[${JSON.stringify(target.id)}].badges||{}`);
  assert.equal(Object.values(badges).some(Boolean),false,'no badge on a run inside the window: '+JSON.stringify(badges));
  await evaluate('document.getElementById("skyRevealSky").click()');

  // 6. Reload: the window survives the document.
  await send('Page.reload',{ignoreCache:true});await until('!!window.lumenDiagnostics');await sleep(600);
  await openTarget();
  assert.equal(await evaluate(visible('replayCooldownModal')),true,'reload cannot bypass the window');
  await evaluate('document.getElementById("replayCooldownCancel").click()');

  // 7. T+16 min: a new qualifying run is possible.
  await evaluate(`(()=>{const all=JSON.parse(localStorage.getItem('lumenQualifyingStartsV1'));all.qa[${JSON.stringify(target.id)}]=new Date(Date.now()-16*60000).toISOString();localStorage.setItem('lumenQualifyingStartsV1',JSON.stringify(all))})()`);
  await send('Page.reload',{ignoreCache:true});await until('!!window.lumenDiagnostics');await sleep(600);
  await openTarget();
  assert.equal(await evaluate(visible('replayCooldownModal')),false,'after 15 minutes the replay opens directly');
  await evaluate('document.getElementById("attemptMask").click()');
  assert.equal((await attempt()).qualifying,true,'T+15 min: qualifying again');
  assert.match(await status(),/Tentative qualifiante/);
  assert.deepEqual(errors,[]);
  results.push({viewport:viewport.width,beforeFirstMove:true,cancel:true,escape:true,abandon:true,mySky:true,replayWithinWindow:'non-qualifying',noBadge:true,reload:true,expiry:true});
 }
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,errors},null,2));
 console.log(JSON.stringify(results));
}finally{await closeBrowser(send)}
