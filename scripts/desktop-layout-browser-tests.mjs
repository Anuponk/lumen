// #749: computers and tablets use the phone layout in a centered column.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';

// Static contract: one layout. Desktop-only blocks are gone; phone width conditions apply
// everywhere except landscape phones; only the #749 column block targets wide screens.
const css=fs.readFileSync('src/ui/styles.css','utf8').replace(/\r\n/g,'\n');
const preludes=[...css.matchAll(/@media\s*([^{]+)\{/g)].map(m=>m[1].replace(/\s+/g,''));
assert.deepEqual(preludes.filter(p=>/min-width:(701|1100|1101)px/.test(p)),['(min-width:701px)'],'Only the #749 column block targets wide screens');
assert.deepEqual(preludes.filter(p=>/max-width:(700|900|1100)px/.test(p)&&!p.includes('orientation:landscape')),[],'Phone rules apply at every width');
assert.match(css,/#749: computers and tablets use the phone layout in a centered column/);

const {send,evaluate,errors}=await connectBrowser();
const base=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(expr,label)=>{let last;for(let i=0;i<150;i++){try{if(await evaluate(expr))return}catch(e){last=e}await sleep(100)}throw Error('Timed out: '+label+(last?' ('+last.message+')':''))};
// A player in the first Adventure, past the tutorial, on the regular play screen.
const progress={solved:{},performances:{},canonicalQuestState:{},badges:{},stars:{},xp:120,shards:3};
for(const q of canonicalQuestList().slice(0,14)){if(q.legacyIndex!==null)progress.solved[q.legacyIndex]=1;else progress.canonicalQuestState[q.id]={solved:true,stars:1}}
const results=[];
try{
 await send('Page.enable');await send('Runtime.enable');
 const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(!sessionStorage.getItem('fixtureDone')){localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const k of ['lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenTutorialSeen','lumenTutorialCompletedV1'])localStorage.setItem(k,'1');localStorage.setItem('lumenSound','off');localStorage.setItem('lumenPushChoice','later');localStorage.setItem('lumenInstallLater',String(Date.now()));localStorage.setItem('lumenWelcomeDayV1',new Date().toLocaleDateString('en-CA'));sessionStorage.setItem('fixtureDone','1')}`});
 const qa=new URL(base);qa.searchParams.set('qa','new');
 let phoneBoard=0;
 for(const [width,height] of [[390,844],[1024,768],[1440,900],[1920,1080]]){
  const mobile=width<=700;
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await navigateAndWait({send,evaluate},'Page.navigate',{url:qa.href});
  await until('document.querySelectorAll("#board .cell").length>0','board '+width);
  await acknowledgeLearningMilestones(evaluate).catch(()=>{});
  await evaluate(`(()=>{for(const id of ['questGo','attemptMask'])if(!document.getElementById(id)?.hidden)document.getElementById(id)?.click();const t=document.getElementById('returnToast');if(t)t.hidden=true})()`);
  await sleep(500);
  const m=await evaluate(`(()=>{const r=s=>document.querySelector(s)?.getBoundingClientRect(),app=r('.app'),board=r('#board'),actions=r('.actions'),journey=document.querySelector('.journey'),account=document.querySelector('.mobile-account');
   return {app:{left:app.left,right:innerWidth-app.right,width:app.width},board:{width:board.width,left:board.left,right:board.right},actionsBottom:actions.bottom,
    journeyPosition:getComputedStyle(journey).position,journeyInside:r('.journey').left>=app.left-1&&r('.journey').right<=app.right+1,
    account:!!account&&getComputedStyle(account).display!=='none',overflowX:document.documentElement.scrollWidth>innerWidth,height:innerHeight}})()`);
  assert.equal(m.overflowX,false,'No horizontal overflow at '+width);
  assert.equal(m.account,true,'Phone header (account button) at '+width);
  assert.notEqual(m.journeyPosition,'fixed','No side panel at '+width);assert.equal(m.journeyInside,true,'Quest banner inside the column at '+width);
  assert(m.board.left>=m.app.left-1&&m.board.right<=m.app.left+m.app.width+1,'Board inside the column at '+width);
  if(mobile)phoneBoard=m.board.width;
  else{
   assert(m.app.width<=520,'Column width at '+width+': '+m.app.width);
   assert(Math.abs(m.app.left-m.app.right)<=2,'Column centered at '+width);
   // Short screens keep the existing compaction so the actions stay visible.
   if(height>=900)assert(m.board.width>phoneBoard,'Board larger than on a phone at '+width+': '+m.board.width+' vs '+phoneBoard);
   else assert(m.board.width>=300,'Board stays playable at '+width+'×'+height);
   assert(m.actionsBottom<=m.height,'Actions visible without scrolling at '+width+'×'+height);
  }
  // Mon ciel stays in the same column.
  await evaluate("document.getElementById('openSky').click()");await until('!document.getElementById("mapModal").hidden','sky '+width);await sleep(400);
  const sheet=await evaluate(`(()=>{const r=document.querySelector('#mapModal .map-sheet').getBoundingClientRect();return {width:r.width,left:r.left,right:innerWidth-r.right}})()`);
  if(!mobile){assert(sheet.width<=520,'Mon ciel width at '+width);assert(Math.abs(sheet.left-sheet.right)<=2,'Mon ciel centered at '+width)}
  results.push({width,height,column:Math.round(m.app.width),board:Math.round(m.board.width),sky:Math.round(sheet.width)});
 }
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
 assert.deepEqual(errors,[]);
 const report={results,uncaughtErrors:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
