// #1057: public mini links now open the real daily with honest dates.
import assert from 'node:assert/strict';
export async function verifyMini({send,evaluate},baseUrl){
 for(const legacy of [false,true])for(const locale of ['fr','en','es']){
  const path=legacy?'/mini/2026-12-03.html':'/d/2026-12-03/';
  await send('Page.navigate',{url:new URL(path+'?lang='+locale+'&utm_source=facebook_daily&utm_medium=social&utm_campaign=avent_2026',baseUrl).href});
  for(let i=0;i<150;i++){
   try{if(await evaluate('location.pathname==='+JSON.stringify(path)+'&&document.getElementById("daily-link")?.dataset.state'))break}catch{}
   await new Promise(resolve=>setTimeout(resolve,40));
  }
  for(const [now,state] of [['2026-12-02T22:59:59Z','future'],['2026-12-02T23:00:00Z','today'],['2026-12-03T23:00:00Z','expired']]){
   const result=await evaluate('(async()=>{const {mountDailyLink}=await import("/src/acquisition/daily-link.js");const before=JSON.stringify({...localStorage});const root=document.getElementById("daily-link");const route=mountDailyLink(root,{now:()=>new Date('+JSON.stringify(now)+'),redirect:false});return {state:route.state,href:root.querySelector("[data-play]").getAttribute("href"),locale:document.documentElement.lang,board:document.querySelectorAll(".cell,.mini-cell").length,unchanged:before===JSON.stringify({...localStorage}),scrollX:document.documentElement.scrollWidth>innerWidth}})()',true);
   assert.equal(result.state,state);assert.equal(result.locale,locale);
   assert.equal(result.board,0);assert.equal(result.unchanged,true);assert.equal(result.scrollX,false);
   const target=new URL(result.href,baseUrl);assert.equal(target.searchParams.get('daily'),'1');
   assert.equal(target.searchParams.get('dailyLink'),'1');
   assert.equal(target.searchParams.get('utm_campaign'),'avent_2026');
   assert.equal(target.searchParams.has('day'),false);
  }
 }
 await send('Page.navigate',{url:new URL('/studio/',baseUrl).href});
 const waitFor=async expression=>{
  for(let i=0;i<120;i++){
   try{if(await evaluate(expression))return}catch{}
   await new Promise(r=>setTimeout(r,100));
  }
  assert.fail('Studio did not reach '+expression);
 };
 const preview=`document.getElementById('seasonal-preview').contentWindow`;
 const ready=day=>`${preview}.lumenSeasonalPreview==='${day}'&&typeof ${preview}.lumenStudioView==='function'`;
 await waitFor(ready('2026-12-01'));
 assert.equal(await evaluate(`${preview}.document.querySelector('#board').children.length`),25,'Real game renders the fixture grid');
 assert.equal(await evaluate(`${preview}.localStorage===localStorage||typeof ${preview}.indexedDB!=='undefined'`),false);
 assert.match(await evaluate(`${preview}.document.getElementById('dailyBanner').innerText`),/Jour 1\/24/);
 await evaluate(`${preview}.lumenStudioView('victory')`);
 await waitFor(`!${preview}.document.getElementById('dailyResultModal').hidden`);
 assert.equal(await evaluate(`${preview}.document.getElementById('dailyBoards').hidden`),true,'Demo does not show real ranks');
 assert.equal(await evaluate(`${preview}.document.getElementById('dailyDiscoverySignup').hidden`),false,'Demo conversion is visible');
 await evaluate("document.getElementById('date').value='2026-12-25';document.getElementById('date').dispatchEvent(new Event('change'))");
 await waitFor(ready('2026-12-25'));
 assert.equal(await evaluate(`${preview}.document.body.dataset.seasonal`),'');
 return {realDailyLinks:true,legacy:true,locales:3,dateStates:3,noSeparateGame:true,safeStudio:true};
}
