// #830: on a short landscape viewport (iPhone Safari with its bars) the grid and
// its controls must be fully visible, without overlap or page scroll; portrait
// and desktop layouts keep their geometry. Chrome emulation: a real iPhone and
// WebKit remain part of the manual acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';

const {send,evaluate,errors}=await connectBrowser();
const base=process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const geometry=`(()=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,r:r.right,b:r.bottom}};
 const board=box(document.getElementById('board'));
 const buttons=[...document.querySelectorAll('.actions button')].filter(b=>b.offsetParent).map(b=>({id:b.id,...box(b)}));
 const overlap=(a,c)=>a.x<c.r-1&&c.x<a.r-1&&a.y<c.b-1&&c.y<a.b-1;
 return {vw:innerWidth,vh:innerHeight,scrollW:document.documentElement.scrollWidth,scrollH:document.documentElement.scrollHeight,board,buttons,
  overlaps:buttons.flatMap((a,i)=>buttons.slice(i+1).filter(c=>overlap(a,c)).map(c=>a.id+'/'+c.id)),
  buttonOnBoard:buttons.filter(b=>overlap(b,board)).map(b=>b.id)}})()`;
const results=[];
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('lumenTutorialSeen','1');localStorage.setItem('lumenTutorialCompletedV1','1');localStorage.setItem('lumenSound','off');localStorage.setItem('lumenIntroPresentedV1','1');if(!localStorage.getItem('lumenProgressV1'))localStorage.setItem('lumenProgressV1',JSON.stringify({solved:{0:1,1:1,2:1},historyBackup:{0:1,1:1,2:1},badges:{},stars:{},performances:{},noHint:{},xp:0,skyScore:0}))"});
 for(const [width,height,label,landscape] of [[844,340,'iPhone 14 landscape, Safari bars',true],[844,390,'iPhone 14 landscape',true],[667,320,'iPhone SE landscape',true],[932,430,'iPhone Pro Max landscape',true],[390,664,'iPhone 14 portrait',false],[1440,900,'desktop',false]]){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:width<1000});
  await navigateAndWait({send,evaluate},'Page.navigate',{url:base});await sleep(800);
  await evaluate('lumenDiagnostics.setupQuest(3)');await acknowledgeLearningMilestones(evaluate);await sleep(300);
  const g=await evaluate(geometry,true);
  assert.equal(g.scrollW,g.vw,label+': no horizontal page scroll');
  assert.equal(g.scrollH,g.vh,label+': no vertical page scroll');
  assert(g.board.y>=0&&g.board.b<=g.vh+0.5&&g.board.x>=0&&g.board.r<=g.vw+0.5,label+': the whole grid is visible '+JSON.stringify(g.board));
  assert(g.board.w>=(landscape?200:280),label+': the grid is not crushed ('+Math.round(g.board.w)+' px)');
  assert.deepEqual(g.buttons.map(b=>b.id),['new','undo','verify','hint'],label+': Réinitialiser, Annuler, Vérifier and Indice are shown under the grid (#858)');
  for(const b of g.buttons)assert(b.y>=0&&b.b<=g.vh+0.5,label+': '+b.id+' is inside the viewport');
  assert.deepEqual(g.overlaps,[],label+': controls never overlap');
  assert.deepEqual(g.buttonOnBoard,[],label+': controls never cover the grid');
  results.push({label,board:Math.round(g.board.w)});
 }
 assert.deepEqual(errors,[]);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,emulated:true,realIphone:false},null,2));
 console.log(JSON.stringify(results));
}finally{await closeBrowser(send)}
