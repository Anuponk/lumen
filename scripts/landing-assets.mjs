// #736: regenerate the presentation-page visuals from the real app (QA mode, synthetic
// progress, no account). Run with a served app and a Chrome CDP endpoint:
//   LUMEN_TEST_URL=http://127.0.0.1:8000/ LUMEN_CDP_URL=http://127.0.0.1:9222 node scripts/landing-assets.mjs
// Writes the board and sky captures in src/landing/. The social previews
// (og.jpg, og-en.jpg) are built from this board capture by promo-og-assets.mjs (#932).
import fs from 'node:fs';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';

const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const {send,evaluate}=await connectBrowser();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(expr,label)=>{for(let i=0;i<150;i++){if(await evaluate(expr).catch(()=>false))return;await sleep(100)}throw Error('Timed out: '+label)};
const hideToast=()=>evaluate("(()=>{const t=document.getElementById('returnToast');if(t)t.hidden=true})()");
const shot=async(file,format,quality)=>{await hideToast();await sleep(150);const {data}=await send('Page.captureScreenshot',{format,quality,captureBeyondViewport:false});fs.writeFileSync(file,Buffer.from(data,'base64'));console.log(file,fs.statSync(file).size,'bytes')};

if(process.argv.includes('--english-og-only')){
 console.error('og-en.jpg is now built by scripts/promo-og-assets.mjs (#932).');
 process.exit(1);
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

// #932: og.jpg / og-en.jpg are composed from board.webp by promo-og-assets.mjs.
console.log('Next: node scripts/promo-og-assets.mjs for the FR/EN social previews.');
await send('Browser.close').catch(()=>{});
process.exit(0);
