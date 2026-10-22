import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CONTENT_CONSTELLATIONS,CONTENT_PACKS} from '../src/campaign/content.js';
import {verifiedAstronomicalFigure} from '../src/ui/astronomical-catalogue.js';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';

export async function verifySkyIssueRegressions({send,evaluate},url){
 const quests=canonicalQuestList(),results=[];
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase.co/*']});
 async function load(progress){
  await evaluate(`localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});localStorage.removeItem('lumenQaActiveAttemptV1');localStorage.removeItem('lumenActiveAttemptV1');for(const k of ['lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1')`);
  await navigateAndWait({send,evaluate},'Page.navigate',{url:String(url)});
  await acknowledgeLearningMilestones(evaluate);
  await evaluate(`document.getElementById('openSky').click()`);
 }
 const completed=()=>({solved:Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{}}])),xp:123,shards:7,badges:{}});
 async function railGeometry(){return evaluate(`(()=>{const rail=document.getElementById('adventureRail'),bounds=rail.getBoundingClientRect(),button=rail.querySelector('.selected'),r=button.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(button);const text=range.getBoundingClientRect();return {bounds:bounds.toJSON(),button:r.toJSON(),text:text.toJSON(),focused:document.activeElement.dataset.packId,selected:button.dataset.packId,pageOverflow:document.documentElement.scrollWidth-innerWidth,scroll:rail.scrollLeft}})()`)}
 for(const width of [320,360,390,430,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:900,deviceScaleFactor:1,mobile:width<700});
  await send('Emulation.setTouchEmulationEnabled',{enabled:width<700,maxTouchPoints:1});
  await load(completed());
  const reopenDestination=await evaluate('lumenDiagnostics.skySnapshot().viewedAdventure');
  const before=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
  for(const index of [0,Math.floor(CONTENT_PACKS.length/2),CONTENT_PACKS.length-1,0]){
   const id=CONTENT_PACKS[index].id;
   // Reproduce selection of a partly visible chip, as with a real mobile tap.
   await evaluate(`(()=>{const rail=document.getElementById('adventureRail'),b=rail.querySelector('[data-pack-id="${id}"]');b.scrollIntoView({block:'nearest',inline:'nearest'});if(rail.scrollWidth>rail.clientWidth&&${index}>0)rail.scrollLeft-=b.offsetWidth/2;b.focus({preventScroll:true});b.click()})()`);
   const geometry=await railGeometry();
   assert.equal(geometry.selected,id);
   assert(geometry.button.left>=geometry.bounds.left-1&&geometry.button.right<=geometry.bounds.right+1,'Selected adventure must be fully visible: '+JSON.stringify({width,...geometry}));
   assert(geometry.text.left>=geometry.bounds.left&&geometry.text.right<=geometry.bounds.right,'Complete adventure label: '+JSON.stringify(geometry));
   assert.equal(geometry.focused,id,'Selecting an adventure preserves keyboard focus');
   assert(geometry.pageOverflow<=1,'No horizontal page overflow');
   results.push({width,id,geometry});
  }
  if(width<700){
   const start=await evaluate(`(()=>{const e=document.getElementById('adventureRail'),r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,scroll:e.scrollLeft,selection:JSON.stringify(lumenDiagnostics.skySnapshot())}})()`);
   await evaluate(`window.__railTouches=[];for(const type of ['touchstart','touchmove','touchend','scroll'])document.getElementById('adventureRail').addEventListener(type,e=>window.__railTouches.push({type:e.type,x:e.touches?.[0]?.clientX,scroll:e.currentTarget.scrollLeft}),{passive:true})`);
   await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x+65,y:start.y}]});
   for(let distance=10;distance<=130;distance+=20){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+65-distance,y:start.y}]});await new Promise(r=>setTimeout(r,25));}
   await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await new Promise(r=>setTimeout(r,200));
   const touch=await evaluate(`(()=>{const e=document.getElementById('adventureRail');return {scroll:e.scrollLeft,width:e.clientWidth,total:e.scrollWidth,hit:document.elementFromPoint(${start.x},${start.y})?.outerHTML,active:document.activeElement.outerHTML}})()`);
   assert(touch.scroll>start.scroll,'Touch scroll stays in the adventure rail: '+JSON.stringify({width,start,touch,events:await evaluate('window.__railTouches')}));
   assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.skySnapshot())'),start.selection,'Rail swipe does not paginate the sky');
  }
  await evaluate(`document.querySelector('#adventureRail button').focus()`);
  for(const key of ['End','Home','ArrowRight','ArrowLeft']){
   await send('Input.dispatchKeyEvent',{type:'keyDown',key});await send('Input.dispatchKeyEvent',{type:'keyUp',key});
   const focused=await evaluate(`(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),rail=document.getElementById('adventureRail').getBoundingClientRect();return {id:e.dataset.packId,inside:r.left>=rail.left-1&&r.right<=rail.right+1}})()`);
   const expected=key==='End'?CONTENT_PACKS.at(-1).id:key==='ArrowRight'?CONTENT_PACKS[1].id:CONTENT_PACKS[0].id;
   assert.equal(focused.id,expected,'Rail '+key+' focuses expected adventure');assert(focused.inside,'Keyboard focus is visible');
  }
  assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),before,'Rail browsing never mutates progress');
  await evaluate(`(()=>{const rail=document.getElementById('adventureRail');rail.style.direction='rtl';rail.querySelector('button').focus()})()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft'});
  assert.equal(await evaluate('document.activeElement.dataset.packId'),CONTENT_PACKS[1].id,'RTL keyboard direction follows the visual rail');
  await evaluate(`(()=>{const rail=document.getElementById('adventureRail');rail.style.direction='';const b=rail.querySelector('button');b.textContent='Une aventure au titre particulièrement long pour vérifier la navigation';b.focus()})()`);
  const long=await railGeometry();assert(long.text.left>=long.bounds.left&&long.text.right<=long.bounds.right,'A future long title wraps completely inside the rail');
  await evaluate(`document.getElementById('closeMap').click();document.getElementById('openSky').click()`);
  assert.equal(await evaluate('lumenDiagnostics.skySnapshot().viewedAdventure'),reopenDestination,'Reopening retains the existing active-quest destination');
  if(width===390){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('docs/validation/issue514-tabs-390.png',Buffer.from(shot.data,'base64'));}
 }
 // Partial Antlia was the reported defect. Also cover empty/complete and
 // authentic small/large source figures; never fabricate astronomical points.
 const entries=['Ant','Del','Ori'].map(iau=>CONTENT_CONSTELLATIONS.find(c=>verifiedAstronomicalFigure(c)?.iau===iau));
 for(const width of [320,390,1440])for(const entry of entries){
  const group=quests.filter(q=>q.constellationId===entry.id),figure=verifiedAstronomicalFigure(entry);
  for(const earned of [...new Set([0,Math.min(7,group.length-1),group.length])]){
   const progress=completed();for(const q of group.slice(earned)){if(q.legacyIndex!==null)delete progress.solved[q.legacyIndex];else delete progress.canonicalQuestState[q.id]}
   await send('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:900,deviceScaleFactor:1,mobile:width<700});await load(progress);
   const before=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
   await evaluate(`document.querySelector('#adventureRail [data-pack-id="${entry.packId}"]').click();for(let page=0;!document.querySelector('#sectorTabs [data-content-id="${entry.id}"]');page++){if(page>20||document.getElementById('constellationNext').disabled)throw Error('Missing card ${entry.id}: '+JSON.stringify(lumenDiagnostics.skySnapshot()));document.getElementById('constellationNext').click()}document.querySelector('#sectorTabs [data-content-id="${entry.id}"]').click()`);
   const drawing=await evaluate(`(()=>{const svg=document.querySelector('#skyCard svg'),r=svg?.getBoundingClientRect();return {size:r&&[r.width,r.height],points:svg?.querySelectorAll('.sky-star').length,lines:svg?.querySelectorAll('.sky-line').length,lit:svg?.querySelectorAll('.sky-star.on').length,secondary:svg?.querySelectorAll('.quest-secondary-star.on').length,visible:!!svg&&!svg.closest('[hidden]')&&getComputedStyle(svg).opacity!=='0'}})()`);
   assert(drawing.visible&&Math.min(...drawing.size)>=24,'Actual drawing visible '+entry.id+' '+width);
   assert.equal(drawing.points,figure.count);assert.equal(drawing.lines,figure.edges.length);
   assert.equal(drawing.lit,figure.count>=group.length?Math.floor(earned*figure.count/group.length):Math.min(earned,figure.count));
   assert.equal(drawing.secondary,Math.max(0,earned-figure.count));
   assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),before,'Drawing does not alter rewards');
   results.push({width,id:entry.id,earned,total:group.length,drawing});
   if(width===390&&entry.id==='iau-ant'&&earned===7){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('docs/validation/issue513-antlia-partial-390.png',Buffer.from(shot.data,'base64'));}
  }
 }
 return {providerNetworkBlocked:true,realPlayerData:false,results};
}
