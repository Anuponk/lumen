import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {bonusChallengeFor} from '../src/campaign/progression.js';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';

// #1052: during a Clear-mind challenge the hint button stays clickable and explains,
// in the usual feedback line, that hints are unavailable: no penalty, no assistance,
// no attempt start, no grid change, no dialog, same layout. A normal quest keeps its
// hints. Real app with synthetic QA saves (FR, EN, ES).
const COPY={fr:'Les indices ne sont pas disponibles pendant le défi Esprit clair. Tu dois résoudre cette quête sans indice.',
 en:'Hints are not available during the Clear-mind challenge. You must solve this quest without a hint.',
 es:'Las pistas no están disponibles durante el reto Mente clara. Debes resolver esta misión sin pistas.'};
export async function verifyClearMindHint(browser,baseUrl){
 const {send,evaluate}=browser,quests=canonicalQuestList();
 const target=quests.find(q=>q.legacyIndex!==null&&bonusChallengeFor(q.legacyIndex)?.type===2);
 assert.ok(target,'a Clear-mind quest exists in the campaign');
 const url=new URL(baseUrl);url.searchParams.set('qa','new');
 const results={};
 // Restore the language exactly afterwards: later suites assert French copy.
 const savedLocale=await evaluate(`JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('lumen.locale')).map(k=>[k,localStorage.getItem(k)])))`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,mobile:true,deviceScaleFactor:1});
 for(const locale of ['fr','en','es']){
  const prior=quests.filter(q=>q.ordinal<target.ordinal);
  const progress={catalogueOrigin:currentCatalogueOrigin,solved:Object.fromEntries(prior.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),
   canonicalQuestState:Object.fromEntries(prior.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{}}])),performances:{},badges:{},xp:0,shards:7,speedBadgeIntroSeen:1,fullBadgeIntroSeen:1,autonomySeen:1};
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`
   localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});localStorage.setItem('lumen.locale',${JSON.stringify(locale)});
   localStorage.removeItem('lumenActiveAttemptV1');localStorage.removeItem('lumenQaActiveAttemptV1');
   localStorage.setItem('lumenSound','off');localStorage.setItem('lumenSkyTourSeen','1');`});
  await navigateAndWait(browser,'Page.navigate',{url:String(url)});
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  await acknowledgeLearningMilestones(evaluate);
  const read=`(()=>{const hint=document.getElementById('hint'),r=hint.getBoundingClientRect(),b=document.getElementById('board').getBoundingClientRect();return {
   index:lumenDiagnostics.snapshot().levelIndex,disabled:hint.disabled,msg:document.getElementById('msg').textContent,hintCard:!document.getElementById('hintCard').hidden,
   mask:!document.getElementById('attemptMask').hidden,cells:lumenDiagnostics.snapshot().state.flat().join(''),
   dialogs:[...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].filter(e=>!e.hidden&&getComputedStyle(e).display!=='none').map(e=>e.id),
   hintBox:[Math.round(r.top),Math.round(r.height)],boardBox:[Math.round(b.top),Math.round(b.height)]}})()`;
  const before=await evaluate(read);
  assert.equal(before.index,target.legacyIndex,'Clear-mind quest opened: '+JSON.stringify(before));
  assert.equal(before.disabled,false,'the hint button stays clickable');
  await evaluate(`document.getElementById('hint').click()`);
  const after=await evaluate(read);
  assert.equal(after.msg,COPY[locale],locale+' copy in the feedback line');
  assert.equal(after.hintCard,false,'no hint card');assert.deepEqual(after.dialogs,before.dialogs,'no popup');
  assert.equal(after.mask,before.mask,'the attempt does not start: no chronometer, no penalty');
  assert.equal(after.cells,before.cells,'grid unchanged');
  assert.deepEqual(after.hintBox,before.hintBox,'button unchanged');assert.deepEqual(after.boardBox,before.boardBox,'board does not move');
  results[locale]={msg:after.msg};
 }
 // A normal quest: the hint is given as usual (card shown).
 await evaluate(`(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('lumen.locale'))localStorage.removeItem(k);for(const [k,v] of Object.entries(${savedLocale}))localStorage.setItem(k,v)})()`);
 await navigateAndWait(browser,'Page.navigate',{url:String(url)});
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`lumenDiagnostics.setupQuest(2)`);
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('hint').click()`);
 const normal=await evaluate(`({card:!document.getElementById('hintCard').hidden,msg:document.getElementById('msg').textContent})`);
 assert.equal(normal.card,true,'normal quests keep their hints: '+JSON.stringify(normal));
 assert.notEqual(normal.msg,COPY.fr);
 return {quest:target.id,ordinal:target.ordinal,...results,normalHint:true};
}
