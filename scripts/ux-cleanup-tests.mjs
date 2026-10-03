// Real browser checks for #16/#17/#19; use the isolated CDP setup in docs/TESTING.md.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connectBrowser} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const results=[],failures=[];
const check=(value,message)=>{if(!value)failures.push(message)};
async function click(selector){
 const point=await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'center'});const r=element.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});await sleep(70);
}
const snapshot=()=>evaluate(`JSON.stringify({quest:lumenDiagnostics.snapshot().levelIndex,state:lumenDiagnostics.snapshot().state,progress:lumenDiagnostics.snapshot().progress,stage:document.getElementById('board').dataset.learningStage})`);
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.addScriptToEvaluateOnNewDocument',{source:'localStorage.setItem("lumenProgressV1",JSON.stringify({solved:Object.fromEntries(Array.from({length:11},(_,i)=>[i,1])),badges:{}}));localStorage.setItem("lumenSound","off");localStorage.setItem("lumenTutorialSeen","1");localStorage.setItem("lumenInstallLater",String(Date.now()));localStorage.setItem("lumenPushChoice","later");'});
 await send('Page.navigate',{url:process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/'});
 for(let i=0;i<100&&!await evaluate('!!window.lumenDiagnostics');i++)await sleep(100);
 assert(await evaluate('!!window.lumenDiagnostics'),'Application did not start');await sleep(1200);
 for(const viewport of [{width:390,height:844,mobile:true},{width:360,height:640,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  for(const quest of [0,1,5,10]){
   const label=`${viewport.width}x${viewport.height} quest ${quest+1}`,start=failures.length;
   await evaluate(`lumenDiagnostics.setupQuest(${quest});document.getElementById('manualCrossTip').hidden=true;document.getElementById('questStart').hidden=true;document.getElementById('rulesModal').hidden=true`);
   if(await evaluate(`!document.getElementById('autonomyOverlay').hidden`))await click('#autonomyTry');
   const before=await snapshot();
   check(await evaluate(`document.querySelector('.rules').children.length===1&&document.querySelector('.rules').textContent.trim()==='? Revoir les règles'&&document.getElementById('rulesModal').hidden`),label+' permanent rules');
   await click('#rulesHelp');
   check(await evaluate(`!document.getElementById('rulesModal').hidden&&document.activeElement.id==='closeRulesModal'`),label+' open/focus');
   check(await evaluate(`(()=>{const r=document.querySelector('#rulesModal .shard-rules-card').getBoundingClientRect(),b=document.getElementById('board').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&b.width<=innerWidth})()`),label+' layout');
   await click('#rulesModal p');
   check(await snapshot()===before,label+' modal content changed quest/teaching state');
   await click('#closeRulesModal');
   check(await evaluate(`document.getElementById('rulesModal').hidden&&document.activeElement.id==='rulesHelp'`),label+' close/focus');
   await click('#rulesHelp');
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
   check(await evaluate(`document.getElementById('rulesModal').hidden`),label+' Escape');
   await click('#rulesHelp');
   await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:5,y:5});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:5,y:5});
   check(await evaluate(`document.getElementById('rulesModal').hidden`),label+' backdrop');
   check(await snapshot()===before,label+' modal interactions changed quest/teaching state');
   results.push({viewport,quest:quest+1,failures:failures.slice(start)});
  }
  await evaluate(`(()=>{lumenDiagnostics.setupQuest(5);document.getElementById('manualCrossTip').hidden=true;document.getElementById('questStart').hidden=true;const s=lumenDiagnostics.snapshot();s.state[0][s.puz.sol[0]]=2;lumenDiagnostics.setBoard(s.state)})()`);
  await click('#hint');
  const message=await evaluate(`document.getElementById('msg').textContent`);
  check(message.startsWith('Marquage manquant :')&&message.includes('écarter')&&!message.includes('Eau manquante'),viewport.width+' hint vocabulary: '+message);
  await evaluate(`(()=>{lumenDiagnostics.setupQuest(2);document.getElementById('questStart').hidden=true;const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
  await sleep(500);
  const cta=await evaluate(`(()=>{const next=document.getElementById('successNew'),share=document.getElementById('successShare');return {visible:document.getElementById('successOverlay').classList.contains('show'),text:next.textContent.trim(),next:getComputedStyle(next).backgroundImage,share:getComputedStyle(share).backgroundImage}})()`);
  check(cta.visible&&cta.text==='Quête suivante'&&cta.next.includes('linear-gradient')&&cta.share==='none',viewport.width+' primary CTA: '+JSON.stringify(cta));
  await click('#successNew');
  const nextState=await evaluate(`(()=>{const r=document.getElementById('successNew').getBoundingClientRect();return {quest:lumenDiagnostics.snapshot().levelIndex,rect:[r.x,r.y,r.width,r.height],viewport:[innerWidth,innerHeight],hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.id}})()`);
  check(nextState.quest===3,viewport.width+' next quest action: '+JSON.stringify(nextState));
 }
 check(errors.length===0,'Browser exceptions: '+JSON.stringify(errors));
 const report={modalScenarios:results,vocabularyAndCTAViewports:3,failures,uncaughtErrors:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));assert.deepEqual(failures,[],'UX browser regressions');
}finally{await send('Browser.close')}
