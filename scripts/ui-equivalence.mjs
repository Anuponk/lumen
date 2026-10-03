import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connectBrowser} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser();
const base=process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[];
const inspect=`(()=>{
 const board=document.getElementById('board'),style=getComputedStyle(board);
 const rect=element=>{const r=element.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(v=>Math.round(v*100)/100)};
 return {board:rect(board),html:board.innerHTML,columns:style.gridTemplateColumns,rows:style.gridTemplateRows,touchAction:style.touchAction,
  cells:[...board.children].map(cell=>{const s=getComputedStyle(cell);return {rect:rect(cell),background:s.backgroundColor,border:s.borderColor,color:s.color}}),
  controls:['new','hint','verify','autoCross','guidedErrors','scriptedLearnNext','scriptedLearnPrev'].map(id=>{const element=document.getElementById(id);return {id,rect:rect(element),disabled:element.disabled,hidden:element.hidden,text:element.textContent}})};
})()`;
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("lumenProgressV1",JSON.stringify({solved:{},badges:{}}));localStorage.setItem("lumenSound","off");localStorage.setItem("lumenTutorialSeen","1");'});
 for(const viewport of [{width:390,height:844,mobile:true},{width:360,height:640,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  for(const quest of [0,2,11,47]){
   const snapshots=[];
   for(const legacy of [true,false]){
    await send('Page.navigate',{url:legacy?new URL('.refactor-baseline.html',base).href:base});
    await sleep(800);await evaluate('document.fonts.ready',true);
    const setup=legacy?`levelIndex=${quest};init();soundEnabled=false;document.getElementById("autoCross").checked=false;document.getElementById("guidedErrors").checked=false;closeTutorial(false);document.getElementById("skyReveal").hidden=true;hideSuccess();`:`lumenDiagnostics.setupQuest(${quest});`;
    await evaluate(setup);await sleep(150);
    const empty=await evaluate(inspect);
    await evaluate(legacy?'state[0][puz.sol[0]]=2;state[n-1][0]=1;render();':'(()=>{const s=lumenDiagnostics.snapshot();s.state[0][s.puz.sol[0]]=2;s.state[s.n-1][0]=1;lumenDiagnostics.setBoard(s.state)})()');
    await sleep(100);snapshots.push({empty,marked:await evaluate(inspect)});
   }
   assert.deepEqual(snapshots[1],snapshots[0],`UI changed: ${viewport.width}x${viewport.height}, quest ${quest+1}`);
   results.push({viewport,quest:quest+1,emptyAndMarked:'identical'});
  }
 }
 assert.deepEqual(errors,[],'Browser exceptions');
 const report={baseline:'dcd9f3c872e623541be698edc212b64589d3b164',cases:results,uncaughtErrors:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cases:results.length,emptyAndMarked:'identical',mobileAndDesktop:true,uncaughtErrors:errors}));
}finally{await send('Browser.close')}
