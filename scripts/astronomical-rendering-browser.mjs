import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CONTENT_CONSTELLATIONS,CONTENT_PACKS} from '../src/campaign/content.js';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {verifiedAstronomicalFigure} from '../src/ui/astronomical-catalogue.js';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';

// Actual Mon ciel UI, synthetic completed QA profile, no authenticated account.
export async function verifyAstronomicalRendering({send,evaluate},baseUrl){
 // Keep this source/render audit entirely local, including QA analytics.
 await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*supabase.co/*']});
 const quests=canonicalQuestList();
 const progress={solved:Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,badges:{}}])),xp:123,shards:7,badges:{}};
 const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});localStorage.removeItem('lumenQaActiveAttemptV1');localStorage.removeItem('lumenActiveAttemptV1');for(const k of ['lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off');`});
 await navigateAndWait({send,evaluate},'Page.navigate',{url:String(baseUrl)});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
 for(let i=0;i<100;i++){if(await evaluate(`!!document.getElementById('adventureRail') && typeof document.getElementById('openSky').onclick==='function'`))break;await new Promise(resolve=>setTimeout(resolve,100));}
 await acknowledgeLearningMilestones(evaluate);
 const before=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
 await evaluate(`document.getElementById('openSky').click()`);
 async function inspect(selector,entry){
  const figure=verifiedAstronomicalFigure(entry),count=quests.filter(q=>q.constellationId===entry.id).length;
  const geometry=await evaluate(`(()=>{const svg=document.querySelector(${JSON.stringify(selector)});if(!svg)return null;const box=svg.getBoundingClientRect(),matrix=svg.getScreenCTM(),clip=svg.closest('.constellation-card,.sky-card')||svg;const clips=[clip,svg,svg.closest('.map-sheet')].filter(Boolean).map(e=>e.getBoundingClientRect());const bounds={left:Math.max(0,...clips.map(r=>r.left)),right:Math.min(innerWidth,...clips.map(r=>r.right)),top:Math.max(0,...clips.map(r=>r.top)),bottom:Math.min(innerHeight,...clips.map(r=>r.bottom))};return {card:svg.closest('.constellation-card')?{bounds:svg.closest('.constellation-card').getBoundingClientRect().toJSON(),textRanges:[...svg.closest('.constellation-card').querySelectorAll('strong,small')].map(e=>{const r=document.createRange();r.selectNodeContents(e);return {label:e.textContent,...r.getBoundingClientRect().toJSON()}}),text:svg.closest('.constellation-card').innerText,rows:getComputedStyle(svg.closest('.constellation-card')).gridTemplateRows,children:[...svg.closest('.constellation-card').children].map(e=>({tag:e.tagName,text:e.textContent,height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize,width:e.getBoundingClientRect().width,lineHeight:getComputedStyle(e).lineHeight,justify:getComputedStyle(e).justifySelf,align:getComputedStyle(e).alignSelf,weight:getComputedStyle(e).fontWeight}))}:null,visible:!!box.width&&!!box.height&&!svg.closest('[hidden]'),box:box.toJSON(),bounds,parents:[...document.querySelectorAll('#mapDetail,#skyCard,#puzzleGrid')].map(e=>({id:e.id,box:e.getBoundingClientRect().toJSON(),scroll:e.scrollHeight-e.clientHeight,css:{flex:getComputedStyle(e).flex,minHeight:getComputedStyle(e).minHeight}})),size:[box.width,box.height],scale:[Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)],points:[...svg.querySelectorAll('.sky-star')].map(e=>[Number(e.getAttribute('cx')),Number(e.getAttribute('cy'))]),lines:[...svg.querySelectorAll('.sky-line')].map(e=>['x1','y1','x2','y2'].map(a=>Number(e.getAttribute(a)))),clipped:[...svg.querySelectorAll('.sky-star,.quest-secondary-star')].some(e=>{const r=e.getBoundingClientRect();return r.left<bounds.left-1||r.right>bounds.right+1||r.top<bounds.top-1||r.bottom>bounds.bottom+1||r.top<-1||r.bottom>innerHeight+1}),crowns:svg.querySelectorAll('.quest-reward-orbit').length,rewards:svg.querySelectorAll('.quest-secondary-star').length,earned:svg.querySelectorAll('.quest-secondary-star.on').length}})()`);
  assert(geometry?.visible,entry.id+' visible SVG '+selector);
  assert(Math.min(...geometry.size)>=24,entry.id+' drawing has usable space: '+JSON.stringify(geometry));
  if(geometry.card){
   const {bounds,textRanges}=geometry.card;
   for(const r of textRanges)assert(r.left>=bounds.left+1&&r.right<=bounds.right-1&&r.top>=bounds.top+1&&r.bottom<=bounds.bottom-1,entry.id+' complete label: '+JSON.stringify(geometry.card));
   for(let i=0;i<textRanges.length;i++)for(let j=i+1;j<textRanges.length;j++){const a=textRanges[i],b=textRanges[j];assert(Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<=1||Math.min(a.right,b.right)-Math.max(a.left,b.left)<=1,entry.id+' non-overlapping labels: '+JSON.stringify(geometry.card));}
  }
  assert.deepEqual(geometry.points,figure.pts,entry.id+' every source star in original order');
  assert.deepEqual(geometry.lines,figure.edges.map(([a,b])=>[...figure.pts[a],...figure.pts[b]]),entry.id+' every source segment');
  assert(Math.abs(geometry.scale[0]-geometry.scale[1])<.00001,entry.id+' uniform scaling');
  assert.equal(geometry.clipped,false,entry.id+' all real stars and decorative rewards inside visible bounds: '+JSON.stringify(geometry));
  assert.equal(geometry.crowns,0,entry.id+' no rejected crown');
  assert.equal(geometry.rewards,Math.max(0,count-figure.count),entry.id+' secondary lights only for the shortfall');
  assert.equal(geometry.earned,Math.max(0,count-figure.count),entry.id+' historical completed rewards visible');
  return geometry.size;
 }
 const results=[];
 for(const [width,height,mobile] of [[320,568,true],[390,844,true],[1440,900,false]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await new Promise(resolve=>setTimeout(resolve,150));
  const checked=[];
  for(const pack of CONTENT_PACKS){
   await evaluate(`(()=>{const target=document.querySelector('#adventureRail [data-pack-id="${pack.id}"]');if(!target)throw Error(JSON.stringify({missing:'${pack.id}',rail:[...document.querySelectorAll('#adventureRail button')].map(e=>e.dataset.packId),sky:lumenDiagnostics.skySnapshot(),hidden:document.getElementById('mapModal').hidden}));target.click()})()`);
   for(const entry of CONTENT_CONSTELLATIONS.filter(c=>c.packId===pack.id)){
    await evaluate(`while(!document.querySelector('#sectorTabs [data-content-id="${entry.id}"]')){const next=document.getElementById('constellationNext');if(next.disabled)throw Error('Missing catalogue card');next.click()}`);
    const selector=`#sectorTabs [data-content-id="${entry.id}"] svg`;
    const overview=await inspect(selector,entry);
    if(entry.id==='iau-ant'&&width===390){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('docs/validation/issue508-horizons-390.png',Buffer.from(shot.data,'base64'));}
    await evaluate(`document.querySelector('#sectorTabs [data-content-id="${entry.id}"]').click()`);
    const detail=await inspect('#skyCard svg',entry);
    if(entry.id==='iau-ant'&&width===390){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('docs/validation/issue508-antlia-390.png',Buffer.from(shot.data,'base64'));}
    await evaluate(`document.getElementById('constellationBack').click()`);
    checked.push({id:entry.id,iau:verifiedAstronomicalFigure(entry).iau,overview,detail});
   }
  }
  assert.equal(checked.length,CONTENT_CONSTELLATIONS.length);
  results.push({width,height,checked});
 }
 assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),before,'Astronomy browsing cannot change achievements or balances');
 return {qa:true,providerNetworkBlocked:true,liveCloudWrites:false,sourcePointsPreserved:true,sourceSegmentsPreserved:true,uniformScale:true,rewardsPreserved:true,noCrowns:true,secondaryOnlyForShortfall:true,results};
}
