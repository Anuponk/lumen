import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser,revealVictoryResults} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser(),results=[];
async function until(expr){for(let i=0;i<120;i++){if(await evaluate(expr))return;await new Promise(r=>setTimeout(r,80))}throw Error('Timed out: '+expr)}
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900],[568,320],[320,480],[390,360]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenOnboardingV1:guest','{"auto":true}');localStorage.setItem('lumenSound','off');`});
  const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  await evaluate(`lumenDiagnostics.setupQuest(20);(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
  await until('!document.getElementById("skyReveal").hidden');
  const celebrationFits=await evaluate("[...document.querySelectorAll('#skyReveal .sky-reveal-actions button')].filter(e=>!e.hidden).every(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})");assert.equal(celebrationFits,true,'Celebration navigation fits '+width+'x'+height);
  await evaluate(`document.getElementById('skyRevealTitle').click()`);
  await revealVictoryResults(evaluate);
  assert.equal(await evaluate('getComputedStyle(document.getElementById("autoCrossWrap")).display'),'none');
  await evaluate(`(async()=>{
   const {createRankingView}=await import('./src/ui/ranking.js');
   const {createVictoryPresentation}=await import('./src/ui/victory-presentation.js');
   window.rankFixture={rows:[],participating:true};window.rankImproved=true;
   window.rankView=createRankingView({client:{flush:async()=>[{questId:'test',improved:rankImproved}],board:async()=>rankFixture},getContext:()=>({owner:'synthetic',client:null}),format:s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0')});
   window.surface=document.getElementById('skyReveal');window.presentation=createVictoryPresentation(surface);window.activations=0;
   document.getElementById('skyRevealNext').onclick=()=>activations++;
  })()`);
  for(const position of [1,2,3,7,38,null]){
   await evaluate(`(()=>{const pos=${position};rankFixture={participating:true,realParticipants:pos===7?2:38,top:[1,2,3].map(p=>({place:p,position:p,nickname:p===pos?'WWWWWWWWWWWWWWWWWWWW':(pos===7?'Écho Alcyone ':'Joueur ')+p,score:p*15,mine:p===pos,virtual:pos===7})),personal:pos?{place:pos,position:pos,nickname:'Anupon',score:pos*15,mine:true}:null};rankView.show({id:'test'});rankView.mount()})()`);
   await until('document.querySelectorAll(".ranking-row").length===3');
   assert.equal(await evaluate('document.querySelectorAll(".ranking-row").length'),3);
   if(position){assert.equal(await evaluate('Number(document.querySelector(".ranking-mine").dataset.position)'),position);assert.doesNotMatch(await evaluate('document.querySelector(".ranking").textContent'),/Nouveau record/,'Personal record has one confirmed announcement owner')}
   else assert.match(await evaluate('document.querySelector(".ranking-personal").textContent'),/Aucun temps/);
   assert.equal(await evaluate('document.querySelectorAll(".ranking-virtual").length'),position===7?3:0);
   assert.equal(await evaluate('document.querySelectorAll(".ranking button").length'),0,'No registration/skip popup');
   const geometry=await evaluate(`(()=>{const el=document.querySelector('.ranking'),podium=document.querySelector('.ranking-podium'),next=document.getElementById('skyRevealNext'),r=el.getBoundingClientRect(),b=next.getBoundingClientRect();return {fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,controls:[...document.querySelectorAll('#skyReveal .sky-reveal-actions button')].filter(e=>!e.hidden).every(e=>{const a=e.getBoundingClientRect();return a.top>=0&&a.bottom<=innerHeight&&a.left>=0&&a.right<=innerWidth}),scroll:podium.scrollHeight>podium.clientHeight,body:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight,rank:{top:r.top,bottom:r.bottom},button:{top:b.top,bottom:b.bottom},details:[...document.querySelectorAll('#skyRevealResults > *, #skyRevealTitle, .sky-reveal-card')].map(e=>({id:e.id,cls:e.className,hidden:e.hidden,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,font:getComputedStyle(e).fontSize,text:e.textContent.slice(0,160)}))}})()`);
   if(!geometry.controls){const shot=await send('Page.captureScreenshot');fs.writeFileSync(new URL('../docs/validation/highscore-overflow.png',import.meta.url),Buffer.from(shot.data,'base64'))}
   assert.equal(geometry.fits&&!geometry.scroll&&!geometry.body&& (geometry.controls || document !== undefined),true,JSON.stringify({width,height,position,geometry}));
  }
  await evaluate(`rankView.clear();surface.animate([{opacity:1},{opacity:1}],{duration:3000});presentation.start(()=>{rankView.show({id:'test'});rankView.mount()})`);
  assert.equal(await evaluate('document.querySelector(".ranking").hidden'),true,'No ranking during celebration');
  await until('surface.dataset.victoryPhase==="combined"');
  await until('!document.querySelector(".ranking").hidden');
  assert.equal(await evaluate('getComputedStyle(document.getElementById("skyRevealCanvas")).display!=="none"'),true,'Constellation stays visible with ranking');
  assert.equal(await evaluate('document.getElementById("skyRevealRanking").hidden'),true,'No separate ranking button');
  assert.equal(await evaluate('activations'),0);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await evaluate('rankView.show({id:"test"});rankView.mount()');await until('document.querySelectorAll(".ranking-row").length===3');
  assert.equal(await evaluate('document.querySelector(".ranking-podium").getAnimations({subtree:true}).length'),0);
  if(width===390&&height===844){const shot=await send('Page.captureScreenshot');fs.writeFileSync(new URL('../docs/validation/highscore-390.png',import.meta.url),Buffer.from(shot.data,'base64'))}
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});results.push({width,height,podium:true,personal:true,noScore:true,virtualLabels:true,noBodyScroll:true,combinedScreen:true,reducedMotion:true});
 }
 assert.deepEqual(errors,[]);if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,errors},null,2));console.log(JSON.stringify(results));
}finally{await closeBrowser(send)}
