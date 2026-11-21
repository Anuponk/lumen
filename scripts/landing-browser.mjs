// #736: the presentation page renders without JavaScript errors, its images load, the
// play button is reachable and nothing overflows. Called per viewport by the sky suite.
import assert from 'node:assert/strict';
export async function verifyLanding({send,evaluate},baseUrl,language='fr'){
 const page=language==='fr'?'/decouvrir.html':'/discover.html';
 const previous=await evaluate('performance.timeOrigin');
 await send('Page.navigate',{url:new URL(page,baseUrl).href});
 for(let i=0;i<100;i++){
  try{if(await evaluate(`performance.timeOrigin!==${previous}&&location.pathname===${JSON.stringify(page)}&&document.readyState==='complete'`))break}
  catch(error){if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error}
  await new Promise(r=>setTimeout(r,100));
 }
 const r=await evaluate(`(async()=>{
  for(const img of document.images){img.loading='eager';if(!img.complete)await new Promise(res=>{img.onload=img.onerror=res})}
  const play=document.querySelector('.hero a.play'),b=play.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
  const alternate=document.querySelector('.language-switch a');
  alternate.focus();
  return {language:document.documentElement.lang,alternate:alternate.getAttribute('href'),focused:document.activeElement===alternate,
   h1:document.querySelector('h1')?.textContent,images:[...document.images].map(i=>i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,
   install:(()=>{const v=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0,link=document.querySelector('.install-mobile'),qr=document.querySelector('.install-qr');return {link:v(link),href:link?.getAttribute('href'),qr:v(qr),qrLoaded:qr?.querySelector('img')?.naturalWidth>0}})(),
   play:play.getAttribute('href'),reachable:hit===play||play.contains(hit),scripts:[...document.scripts].filter(s=>s.type!=='application/ld+json').length,
   ld:(()=>{try{return JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@type']}catch{return null}})()}
 })()`,true);
 assert.equal(r.language,language);
 assert.equal(r.alternate,language==='fr'?'/discover.html':'/decouvrir.html');
 assert.equal(r.focused,true,'Language switch is keyboard-focusable');
 assert.match(r.h1,/constellations/);assert.equal(r.images.length>=2&&r.images.every(Boolean),true,'Screenshots load');
 assert.equal(r.overflow,false,'No horizontal overflow');assert.equal(r.play,'/');assert.equal(r.reachable,true,'The play button is reachable');
 // #748: a phone gets the install link, a computer the QR code (CSS only).
 assert.equal(r.install.href,'/?install=1');
 const wide=await evaluate('matchMedia("(min-width:900px) and (hover:hover) and (pointer:fine)").matches');
 assert.deepEqual([r.install.link,r.install.qr],wide?[false,true]:[true,false],'Install link on phones, QR code on computers');
 if(wide)assert.equal(r.install.qrLoaded,true,'QR code loads');
 assert.equal(r.scripts,0,'No executable script');assert.equal(r.ld,'VideoGame','Structured data parses');
 return language==='fr'?{landing:true}:{englishLanding:true};
}
// #758: « Comment jouer » renders without script, its four example grids load, the play
// button is reachable and keyboard-focusable, and nothing overflows.
export async function verifyHowToPlay({send,evaluate},baseUrl,language='fr'){
 const page=language==='fr'?'/comment-jouer.html':'/how-to-play.html';
 const previous=await evaluate('performance.timeOrigin');
 await send('Page.navigate',{url:new URL(page,baseUrl).href});
 for(let i=0;i<100;i++){
  try{if(await evaluate(`performance.timeOrigin!==${previous}&&location.pathname===${JSON.stringify(page)}&&document.readyState==='complete'`))break}
  catch(error){if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error}
  await new Promise(r=>setTimeout(r,100));
 }
 const r=await evaluate(`(async()=>{
  for(const img of document.images){img.loading='eager';if(!img.complete)await new Promise(res=>{img.onload=img.onerror=res})}
  const play=document.querySelector('.hero a.play');play.scrollIntoView({block:'center'});const b=play.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
  const focusable=[...document.querySelectorAll('a[href]')];play.focus();const playFocused=document.activeElement===play;
  const alternate=document.querySelector('.language-switch a');
  alternate.focus();
  return {language:document.documentElement.lang,alternate:alternate.getAttribute('href'),alternateFocused:document.activeElement===alternate,h1:document.querySelector('h1')?.textContent,images:[...document.images].map(i=>i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,
   play:play.getAttribute('href'),reachable:hit===play||play.contains(hit),focused:playFocused,links:focusable.length,
   scripts:[...document.scripts].filter(s=>s.type!=='application/ld+json').length,imgWidth:Math.round(document.querySelector('.example img').getBoundingClientRect().width)}
 })()`,true);
 assert.equal(r.language,language);assert.equal(r.alternate,language==='fr'?'/how-to-play.html':'/comment-jouer.html');assert.equal(r.alternateFocused,true);
 assert.equal(r.h1,language==='fr'?'Comment jouer à Lumen':'How to play Lumen');assert.equal(r.images.length,4);assert.equal(r.images.every(Boolean),true,'Example grids load');
 assert.equal(r.overflow,false,'No horizontal overflow');assert.equal(r.play,'/');assert.equal(r.reachable,true,'Play button reachable');
 assert.equal(r.focused,true,'Play button keyboard-focusable');assert(r.imgWidth>=200,'Example grid readable: '+r.imgWidth);
 assert.equal(r.scripts,0,'No executable script');
 return language==='fr'?{howToPlay:true,exampleWidth:r.imgWidth}:{englishHowToPlay:true,englishExampleWidth:r.imgWidth};
}
// #769: « Apprendre les constellations en jouant » renders without script, its image
// loads, the play button is reachable and nothing overflows.
export async function verifyLearnConstellations({send,evaluate},baseUrl,language='fr'){
 const page=language==='fr'?'/apprendre-constellations.html':'/learn-constellations.html';
 const previous=await evaluate('performance.timeOrigin');
 await send('Page.navigate',{url:new URL(page,baseUrl).href});
 for(let i=0;i<100;i++){
  try{if(await evaluate(`performance.timeOrigin!==${previous}&&location.pathname===${JSON.stringify(page)}&&document.readyState==='complete'`))break}
  catch(error){if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error}
  await new Promise(r=>setTimeout(r,100));
 }
 const r=await evaluate(`(async()=>{
  for(const img of document.images){img.loading='eager';if(!img.complete)await new Promise(res=>{img.onload=img.onerror=res})}
  const play=document.querySelector('.hero a.play');play.scrollIntoView({block:'center'});const b=play.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
  const alternate=document.querySelector('.language-switch a');
  alternate.focus();
  return {language:document.documentElement.lang,alternate:alternate.getAttribute('href'),alternateFocused:document.activeElement===alternate,h1:document.querySelector('h1')?.textContent,images:[...document.images].map(i=>i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,
   play:play.getAttribute('href'),reachable:hit===play||play.contains(hit),scripts:document.scripts.length,
   constellations:document.getElementById('first-constellations')?.textContent||''}
 })()`,true);
 assert.equal(r.language,language);assert.equal(r.alternate,language==='fr'?'/learn-constellations.html':'/apprendre-constellations.html');assert.equal(r.alternateFocused,true);
 assert.equal(r.h1,language==='fr'?'Apprendre les constellations en jouant':'Learn the constellations as you play');assert.equal(r.images.length>=1&&r.images.every(Boolean),true,'Sky image loads');
 assert.equal(r.overflow,false,'No horizontal overflow');assert.equal(r.play,'/');assert.equal(r.reachable,true,'Play button reachable');
 assert.equal(r.scripts,0,'No script');assert.match(r.constellations,language==='fr'?/Cassiopée/:/Cassiopeia/);
 return language==='fr'?{learnConstellations:true}:{englishLearnConstellations:true};
}

// #855: verify the exact route, responsive layout and local search.
export async function verifyConstellationDirectory({send,evaluate},baseUrl,{slowMobile}={}){
 if(slowMobile){
  await send('Network.enable');
  await send('Network.setCacheDisabled',{cacheDisabled:true});
  await send('Network.emulateNetworkConditions',{
   offline:false,latency:400,downloadThroughput:64*1024,uploadThroughput:32*1024,connectionType:'cellular3g'
  });
 }
 try{
  const previous=await evaluate('performance.timeOrigin');
  await send('Page.navigate',{url:new URL('/constellations',baseUrl).href});
  let ready=false;
  for(let attempt=0;attempt<150;attempt++){
   try{
    ready=await evaluate('performance.timeOrigin!=='+previous+'&&document.readyState==="complete"&&document.getElementById("constellation-search")?.hidden===false');
    if(ready)break;
   }catch(error){
    if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error;
   }
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(ready,true,'Public directory opens at /constellations');
  const report=await evaluate('('+readConstellationDirectory.toString()+')()');
  assert.equal(report.title,'Les 88 constellations du ciel');
  assert.equal(report.count,88);
  assert.equal(report.initialStatus,'88 constellations');
  assert.equal(report.overflow,false,'Directory has no horizontal overflow');
  assert.equal(report.playPath,'/','The CTA leads to the game');
  assert.equal(report.playReachable,true,'The play link is reachable');
  assert.equal(report.focused,true,'Search is keyboard-focusable');
  assert.deepEqual(report.accentSearch,['Cassiopée']);
  assert.deepEqual(report.spaceSearch,['Grande Ourse']);
  assert.equal(report.noMatches,0);
  assert.equal(report.emptyStatus,'Aucune constellation trouvée');
  assert.equal(report.resetCount,88);
  return {constellationDirectory:true,slowMobile:!!slowMobile,loadMs:report.loadMs};
 }finally{
  if(slowMobile){
   await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
   await send('Network.setCacheDisabled',{cacheDisabled:false});
  }
 }
}

function readConstellationDirectory(){
 const cards=[...document.querySelectorAll('.constellation-entry')];
 const title=document.querySelector('h1').textContent;
 const input=document.getElementById('constellation-name');
 const status=document.getElementById('constellation-results');
 const play=document.querySelector('a.play');
 const playBox=play.getBoundingClientRect();
 const hit=document.elementFromPoint(playBox.x+playBox.width/2,playBox.y+playBox.height/2);
 const playReachable=hit===play||play.contains(hit);
 const initialStatus=status.textContent;
 const visibleCards=()=>cards.filter(card=>!card.hidden&&getComputedStyle(card).display!=='none');
 const search=(value)=>{
  input.value=value;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  return visibleCards().map(card=>card.querySelector('h3').textContent);
 };
 input.focus();
 const focused=document.activeElement===input;
 const accentSearch=search('CASSIOPEE');
 const spaceSearch=search('  grande ourse ');
 const noMatches=search('sanscorrespondance').length;
 const emptyStatus=status.textContent;
 const resetCount=search('').length;
 input.blur();
 window.scrollTo(0,0);
 return {
  title,count:cards.length,initialStatus,overflow:document.documentElement.scrollWidth>innerWidth,
  playPath:new URL(play.href).pathname,playReachable,focused,accentSearch,spaceSearch,noMatches,emptyStatus,resetCount,
  loadMs:Math.round(performance.getEntriesByType('navigation')[0].domComplete)
 };
}
