import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser(),results=[];
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out: '+expression)}
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const width of [320,390,1440]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<600});
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenOnboardingV1:guest','{"auto":true}');localStorage.setItem('lumenSound','off');`});
  const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  await evaluate('lumenDiagnostics.setupQuest(20)');
  assert.equal(await evaluate('getComputedStyle(document.getElementById("autoCrossWrap")).display'),'none');
  assert.equal(await evaluate('document.getElementById("autoCross").checked'),false);
  await evaluate(`document.getElementById('autoCross').checked=true;document.getElementById('autoCross').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate('document.getElementById("autoCross").checked'),false,'Cached command stays inert');
  // Exercise the production view with bounded server response fixtures.
  await evaluate(`(async()=>{
   const {createRankingView}=await import('./src/ui/ranking.js');
   window.rankFixture={rows:[],participating:true};window.rankImproved=true;
   window.rankView=createRankingView({client:{flush:async()=>[{questId:'test',improved:rankImproved}],board:async()=>rankFixture},getContext:()=>({owner:'synthetic',client:null}),format:s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0')});
   document.getElementById('successOverlay').classList.add('show');
  })()`);
  for(const position of [7,21,38]){
   await evaluate(`(()=>{const pos=${position};const start=pos<=10?1:Math.max(2,Math.min(pos-5,29));const positions=pos<=10?Array.from({length:10},(_,i)=>i+1):[1,...Array.from({length:10},(_,i)=>start+i)];rankFixture.rows=positions.map(p=>({place:p,position:p,nickname:p===pos?'Anupon':'Écho '+p,score:p*15,seconds:p*15-5,penalty:5,mine:p===pos,virtual:p!==pos}));rankView.show({id:'test'});rankView.mount()})()`);
   await until('document.querySelectorAll(".ranking-row").length>0');
   assert.equal(await evaluate('document.querySelectorAll(".ranking-row").length'),position<=10?10:11);
   assert.equal(await evaluate('Number(document.querySelector(".ranking-mine").dataset.position)'),position);
   assert.match(await evaluate('document.querySelector(".ranking-mine").textContent'),/Nouveau record/);
   assert.ok(await evaluate('document.querySelector(".ranking-mine").getAnimations().length>0'),'Confirmed improvement moves the player line');
   assert.match(await evaluate('document.querySelector(".ranking-name small").textContent'),/Virtuel/);
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate('rankView.show({id:"test"});rankView.mount()');await until('document.querySelectorAll(".ranking-row").length>0');
  assert.equal(await evaluate('document.querySelector(".ranking-mine").getAnimations().length'),0,'Reduced motion has immediate final position');
  const geometry=await evaluate('(()=>{const row=document.querySelector(".ranking-mine").getBoundingClientRect(),list=document.querySelector(".ranking-list").getBoundingClientRect(),el=document.querySelector(".ranking-list");return {visible:row.top>=list.top&&row.bottom<=list.bottom,row:{top:row.top,bottom:row.bottom},list:{top:list.top,bottom:list.bottom},scroll:el.scrollTop,height:el.scrollHeight}})()');
  assert.equal(geometry.visible,true,'The settled player remains visible on a small screen: '+JSON.stringify(geometry));
  await evaluate('rankImproved=false;rankView.show({id:"test"});rankView.mount()');await until('document.querySelectorAll(".ranking-row").length>0');
  assert.doesNotMatch(await evaluate('document.querySelector(".ranking-mine").textContent'),/Nouveau record/);
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  if(width===390&&process.argv[2]){const shot=await send('Page.captureScreenshot');fs.writeFileSync(new URL('../docs/validation/ranking-390.png',import.meta.url),Buffer.from(shot.data,'base64'))}
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  results.push({width,manualOnly:true,top10:true,centered:true,boundary:true,virtualLabels:true,newRecord:true,animation:true,reducedMotion:true,noOverflow:true});
 }
 assert.deepEqual(errors,[]);if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results));
}finally{await closeBrowser(send)}
