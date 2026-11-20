// #736: regenerate the presentation-page visuals from the real app (QA mode, synthetic
// progress, no account). Run with a served app and a Chrome CDP endpoint:
//   LUMEN_TEST_URL=http://127.0.0.1:8000/ LUMEN_CDP_URL=http://127.0.0.1:9222 node scripts/landing-assets.mjs
// Writes the board and sky captures and both social previews in src/landing/.
// Pass --english-og-only to reuse the existing board capture for og-en.jpg.
import fs from 'node:fs';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';

const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const {send,evaluate}=await connectBrowser();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(expr,label)=>{for(let i=0;i<150;i++){if(await evaluate(expr).catch(()=>false))return;await sleep(100)}throw Error('Timed out: '+label)};
const hideToast=()=>evaluate("(()=>{const t=document.getElementById('returnToast');if(t)t.hidden=true})()");
const shot=async(file,format,quality)=>{await hideToast();await sleep(150);const {data}=await send('Page.captureScreenshot',{format,quality,captureBeyondViewport:false});fs.writeFileSync(file,Buffer.from(data,'base64'));console.log(file,fs.statSync(file).size,'bytes')};

async function captureEnglishPreview() {
 await send('Page.enable');
 await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1200,height:630,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:new URL('/discover.html',url).href});
 await until("location.pathname==='/discover.html'&&document.readyState==='complete'",'English discovery');
 await evaluate(`(()=>{
  const heading=document.querySelector('h1').cloneNode(true);
  const brand=document.querySelector('.brand').cloneNode(true);
  const board=document.querySelector('.shots img').cloneNode(true);
  const summary=document.createElement('p');
  summary.className='lead';
  summary.textContent=document.querySelector('.cta-note').textContent;
  brand.style.fontSize='22px';
  heading.style.cssText='font-size:58px;margin:0 0 20px';
  summary.style.cssText='font-size:22px;margin:0';
  board.loading='eager';
  // Frame only the grid in the existing app capture. The French chrome sits
  // outside the square and the original Guardian positions are preserved.
  board.style.cssText='width:402px;height:402px;object-fit:cover;object-position:center 45%;border-radius:28px;border:1px solid #284561;box-shadow:0 18px 60px rgba(0,0,0,.5)';
  const copy=document.createElement('div');copy.style.flex='1';copy.append(brand,heading,summary);
  const card=document.createElement('div');
  card.style.cssText='display:flex;align-items:center;gap:56px;height:630px;padding:0 72px';
  card.append(copy,board);
  document.body.replaceChildren(card);
 })()`);
 await until("document.querySelector('img')?.complete&&document.querySelector('img').naturalWidth>0",'English social preview image');
 await shot('src/landing/og-en.jpg','jpeg',85);
}

if(process.argv.includes('--english-og-only')){
 await captureEnglishPreview();
 await send('Browser.close').catch(()=>{});
 process.exit(0);
}

// A player well into the first Adventure: 23 quests solved, so the sky shows lit stars.
const done=canonicalQuestList().slice(0,23),all={autonomy:true,speed:true,noError:true,mastery:true};
const progress={solved:{},performances:{},canonicalQuestState:{},badges:{},stars:{},xp:420,shards:6};
for(const q of done){if(q.legacyIndex!==null){progress.solved[q.legacyIndex]=1;progress.performances[q.legacyIndex]={version:3,badges:all}}else progress.canonicalQuestState[q.id]={solved:true,stars:1,badges:all}}
await send('Page.enable');await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
const qa=new URL(url);qa.searchParams.set('qa','new');
await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});localStorage.setItem('lumenTutorialSeen','1');localStorage.setItem('lumenTutorialCompletedV1','1');localStorage.setItem('lumenSound','off');localStorage.setItem('lumenPushChoice','later');localStorage.setItem('lumenInstallLater',String(Date.now()))`});
await navigateAndWait({send,evaluate},'Page.navigate',{url:qa.href});
await until('!!window.lumenDiagnostics&&!!lumenDiagnostics.snapshot().state','app ready');
await acknowledgeLearningMilestones(evaluate);
await evaluate(`(()=>{for(const id of ['questGo','attemptMask'])if(!document.getElementById(id)?.hidden)document.getElementById(id)?.click();for(const id of ['qaBanner'])document.getElementById(id)?.setAttribute('hidden','')})()`);
await sleep(600);
// Place three correct Gardiens so the board reads as a game in progress.
await evaluate(`(()=>{const d=lumenDiagnostics.snapshot();for(const r of [0,2,4]){const c=document.querySelector('#board .cell[data-row="'+r+'"][data-col="'+d.puz.sol[r]+'"]');c?.click();c?.click()}})()`);
await sleep(800);
await shot('src/landing/board.webp','webp',82);
await evaluate("document.getElementById('openSky').click()");await sleep(1200);
await shot('src/landing/sky.webp','webp',82);

// Social preview card: the page's own styles, the board capture and the promise.
await send('Emulation.setDeviceMetricsOverride',{width:1200,height:630,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:new URL('/decouvrir.html',url).href});await until("location.pathname==='/decouvrir.html'&&document.readyState==='complete'",'landing page');
await evaluate(`(()=>{document.body.innerHTML='<div style="display:flex;align-items:center;gap:56px;height:630px;padding:0 72px;box-sizing:border-box"><div style="flex:1"><p class="brand" style="font-size:22px">✦ LUMEN</p><h1 style="font-size:56px;margin:0 0 20px">Rallume les 88 constellations du ciel</h1><p class="lead" style="font-size:24px;margin:0">Un jeu de logique sans publicité.<br>880 quêtes · Gratuit pour commencer</p></div><img src="/src/landing/board.webp?'+Date.now()+'" style="height:560px;border-radius:28px;border:1px solid #284561;box-shadow:0 18px 60px rgba(0,0,0,.5)"></div>'})()`);
await until("document.querySelector('img')?.complete&&document.querySelector('img').naturalWidth>0",'og image');
await sleep(300);
await shot('src/landing/og.jpg','jpeg',85);
await captureEnglishPreview();
await send('Browser.close').catch(()=>{});
process.exit(0);
