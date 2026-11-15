// #736: the presentation page renders without JavaScript errors, its images load, the
// play button is reachable and nothing overflows. Called per viewport by the sky suite.
import assert from 'node:assert/strict';
export async function verifyLanding({send,evaluate},baseUrl){
 const previous=await evaluate('performance.timeOrigin');
 await send('Page.navigate',{url:new URL('/decouvrir.html',baseUrl).href});
 for(let i=0;i<100;i++){
  try{if(await evaluate(`performance.timeOrigin!==${previous}&&location.pathname==='/decouvrir.html'&&document.readyState==='complete'`))break}
  catch(error){if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error}
  await new Promise(r=>setTimeout(r,100));
 }
 const r=await evaluate(`(async()=>{
  for(const img of document.images){img.loading='eager';if(!img.complete)await new Promise(res=>{img.onload=img.onerror=res})}
  const play=document.querySelector('.hero a.play'),b=play.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);
  return {h1:document.querySelector('h1')?.textContent,images:[...document.images].map(i=>i.naturalWidth>0),overflow:document.documentElement.scrollWidth>innerWidth,
   install:(()=>{const v=e=>!!e&&getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().width>0,link=document.querySelector('.install-mobile'),qr=document.querySelector('.install-qr');return {link:v(link),href:link?.getAttribute('href'),qr:v(qr),qrLoaded:qr?.querySelector('img')?.naturalWidth>0}})(),
   play:play.getAttribute('href'),reachable:hit===play||play.contains(hit),scripts:[...document.scripts].filter(s=>s.type!=='application/ld+json').length,
   ld:(()=>{try{return JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@type']}catch{return null}})()}
 })()`,true);
 assert.match(r.h1,/constellations/);assert.equal(r.images.length>=2&&r.images.every(Boolean),true,'Screenshots load');
 assert.equal(r.overflow,false,'No horizontal overflow');assert.equal(r.play,'/');assert.equal(r.reachable,true,'The play button is reachable');
 // #748: a phone gets the install link, a computer the QR code (CSS only).
 assert.equal(r.install.href,'/?install=1');
 const wide=await evaluate('matchMedia("(min-width:900px) and (hover:hover) and (pointer:fine)").matches');
 assert.deepEqual([r.install.link,r.install.qr],wide?[false,true]:[true,false],'Install link on phones, QR code on computers');
 if(wide)assert.equal(r.install.qrLoaded,true,'QR code loads');
 assert.equal(r.scripts,0,'No executable script');assert.equal(r.ld,'VideoGame','Structured data parses');
 return {landing:true};
}
