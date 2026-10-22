import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';

// Real app/control state with synthetic QA saves; never a player's profile.
export async function verifyQuestPolicy(browser,baseUrl){
 const {send,evaluate}=browser,quests=canonicalQuestList(),results=[];
 const url=new URL(baseUrl);url.searchParams.set('qa','new');
 for(const width of [390,1440]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,mobile:width<700,deviceScaleFactor:1});
 for(const ordinal of [3,5,6,7,10,11]){
  const target=quests.find(q=>q.ordinal===ordinal),prior=quests.filter(q=>q.ordinal<ordinal);
  const progress={catalogueOrigin:currentCatalogueOrigin,solved:Object.fromEntries(prior.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),
   canonicalQuestState:Object.fromEntries(prior.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{}}])),performances:{},badges:{},xp:0,shards:7,
   speedBadgeIntroSeen:ordinal>3?1:0,fullBadgeIntroSeen:ordinal>6?1:0,autonomySeen:0};
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`
   localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});
   localStorage.removeItem('lumenActiveAttemptV1');localStorage.removeItem('lumenQaActiveAttemptV1');
   localStorage.setItem('lumenSound','off');localStorage.setItem('lumenSkyTourSeen','1');localStorage.removeItem('lumenGuidedErrors');
  `});
  await navigateAndWait(browser,'Page.navigate',{url:String(url)});
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  if(target.legacyIndex===null){
   await acknowledgeLearningMilestones(evaluate);
   await evaluate(`document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="base-real-sky"]').click();document.querySelector('#sectorTabs [data-content-id="real-01"]').click();document.querySelector('#puzzleGrid [data-quest-id="${target.id}"]').click()`);
  }
  const state=await evaluate(`(()=>{const auto=document.getElementById('autoCross'),guided=document.getElementById('guidedErrors'),badge=document.getElementById('badgeUnlockOverlay');return {
   label:document.getElementById('campaignMapLabel').textContent,autoDisabled:auto.disabled,autoChecked:auto.checked,guidedDisabled:guided.disabled,guidedChecked:guided.checked,
   badge:!badge.hidden?badge.dataset.kind:null,autonomy:!document.getElementById('autonomyOverlay').hidden,hint:document.getElementById('hint').textContent}})()`);
  assert(state.label.startsWith('Quête '+ordinal+' -'),JSON.stringify(state));
  assert.equal(state.autoDisabled,ordinal<6,'Real auto-marking availability at quest '+ordinal);
  assert.equal(state.autoChecked,false);assert.equal(state.guidedDisabled,ordinal<6);assert.equal(state.guidedChecked,ordinal<11);
  assert.equal(state.badge,ordinal===3?'speed':ordinal===6?'full':null);
  assert.equal(state.autonomy,ordinal===11);
  assert.equal(state.hint.includes('OFFERT'),ordinal<=10);
  await acknowledgeLearningMilestones(evaluate);
  await evaluate(`if(!document.getElementById('autonomyOverlay').hidden)document.getElementById('autonomyTry').click()`);
  const toggles=await evaluate(`(()=>{
   const guided=document.getElementById('guidedErrors'),auto=document.getElementById('autoCross');
   const previous=guided.checked;guided.click();
   const afterGuided=JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null');
   const result={guidedChanged:guided.checked!==previous,guidedAssisted:!!afterGuided?.assistanceUsed};
   auto.click();result.autoChecked=auto.checked;return result;
  })()`);
  assert.equal(toggles.guidedChanged,ordinal>=6,'The real guided toggle follows visible quest availability');
  assert.equal(toggles.guidedAssisted,false,'Choosing guided control alone is not assistance');
  assert.equal(toggles.autoChecked,ordinal>=6,'The real auto toggle must not reject a canonical quest because of a dormant index');
  results.push({width,ordinal,stableQuestId:target.id,...state});
 }
 }
 return results;
}
