import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';

// Exercise the real Bouvier finale and its visible banner, not a teaching grid.
export async function verifyFinaleResponsive({send,evaluate},baseUrl){
 const quests=canonicalQuestList(),target=quests.filter(q=>q.constellationId==='real-17').at(-1);
 const prior=quests.filter(q=>q.ordinal<target.ordinal);
 const profile={solved:Object.fromEntries(prior.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(prior.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{}}])),performances:{},badges:{},xp:123,shards:7};
 const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(profile))});localStorage.removeItem('lumenActiveAttemptV1');localStorage.removeItem('lumenQaActiveAttemptV1');for(const k of ['lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off');`});
 const url=new URL(baseUrl);url.searchParams.set('qa','new');
 await navigateAndWait({send,evaluate},'Page.navigate',{url:url.href});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${target.packId}"]').click();while(!document.querySelector('#sectorTabs [data-content-id="${target.constellationId}"]'))document.getElementById('constellationNext').click();document.querySelector('#sectorTabs [data-content-id="${target.constellationId}"]').click();document.querySelector('#puzzleGrid [data-quest-id="${target.id}"]').click();document.getElementById('questGo').click();document.getElementById('attemptMask').click()`);
 assert.match(await evaluate(`document.getElementById('challengeTitle').textContent`),/Défi final/);
 assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),target.reg);
 const protocol=await(await fetch((process.env.LUMEN_CDP_URL||'http://127.0.0.1:9222')+'/json/protocol')).json();
 const safeAreaSupported=protocol.domains.find(d=>d.domain==='Emulation')?.commands.some(c=>c.name==='setSafeAreaInsetsOverride');
 const results=[];
 for(const [width,height,mobile] of [[320,568,true],[375,667,true],[390,844,true],[412,732,true],[768,1024,false],[1366,768,false],[1366,600,false]]){
  for(const inset of mobile&&safeAreaSupported?[0,18]:[0]){
   await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
   if(safeAreaSupported)await send('Emulation.setSafeAreaInsetsOverride',{insets:{top:inset,bottom:inset,left:0,right:0}});
   await new Promise(resolve=>setTimeout(resolve,140));
   const geometry=await evaluate(`(()=>{const selectors=['#new','#undo','#verify','#hint','#board','#autoCrossWrap','#challengeBanner'];const elements=selectors.map(selector=>{const e=document.querySelector(selector),r=e?.getBoundingClientRect(),s=e&&getComputedStyle(e);return {selector,visible:!!r?.width&&!!r?.height&&!e.closest('[hidden]'),left:r?.left,right:r?.right,top:r?.top,bottom:r?.bottom,width:r?.width,height:r?.height,font:parseFloat(s?.fontSize)}});return {elements,overflow:[document.documentElement,document.querySelector('.app'),document.querySelector('.game-core')].map(e=>({x:e.scrollWidth-e.clientWidth,y:e.scrollHeight-e.clientHeight})),cell:(()=>{const r=document.querySelector('#board .cell').getBoundingClientRect();return {width:r.width,height:r.height}})()}})()`);
   const label=`Bouvier finale ${width}x${height}, safe inset ${inset}`;
   assert(geometry.elements.every(e=>e.visible&&e.left>=-1&&e.right<=width+1&&e.top>=inset-1&&e.bottom<=height-inset+1),label+' clipped control: '+JSON.stringify(geometry));
   assert(geometry.overflow.every(o=>o.x<=1&&o.y<=1),label+' scroll: '+JSON.stringify(geometry));
   assert(Math.abs(geometry.cell.width-geometry.cell.height)<=1,label+' square cells');
   for(const e of geometry.elements.filter(e=>['#undo','#verify','#hint'].includes(e.selector))){assert(e.font>=12,label+' readable actions');assert(e.height>=36,label+' touch targets');}
   results.push({width,height,inset,ok:true});
  }
 }
 if(safeAreaSupported)await send('Emulation.setSafeAreaInsetsOverride',{insets:{}});
 return {questId:target.id,questNumber:target.ordinal,safeAreaSupported,qa:true,results};
}
