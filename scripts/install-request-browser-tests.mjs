// #748: a new visitor arriving from the presentation page with ?install=1, in a real browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser,navigateAndWait} from './cdp-client.mjs';

const {send,evaluate,errors}=await connectBrowser();
const base=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async(expr,label,tries=120)=>{let last;for(let i=0;i<tries;i++){try{if(await evaluate(expr))return}catch(e){last=e}await sleep(100)}throw Error('Timed out: '+label+(last?' ('+last.message+')':''))};
const shown='!document.getElementById("installOptin").hidden';
async function click(selector){
 const p=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...p});
}
const results=[];
try{
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenSound','off')`});
 const url=new URL(base);url.searchParams.set('install','1');
 await navigateAndWait({send,evaluate},'Page.navigate',{url:url.href});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
 await until('document.querySelectorAll("#board .cell").length>0','game ready');
 assert.equal(await evaluate('new URL(location.href).searchParams.has("install")'),false,'The request is removed from the address bar');
 // A brand-new visitor first sees the welcome: the install sheet waits, never hidden under it.
 const welcome=await evaluate('!!document.querySelector(".first-welcome:not([hidden])")');
 assert.equal(welcome,true,'A new visitor from the page still gets the first-visit welcome');
 {
  await sleep(1800);assert.equal(await evaluate(shown),false,'No install sheet under the first-visit welcome');
  await evaluate('document.querySelector(".intro-play").click()');
  results.push('waits for the first-visit welcome');
 }
 await until(shown,'install sheet after the welcome',80);
 // Native prompt when the browser offers one, otherwise the manual steps; never a dead button.
 const sheet=await evaluate('({button:document.getElementById("installEnable").textContent,copy:document.getElementById("installOptinCopy").textContent})');
 if(sheet.button==='Installer LUMEN')assert.match(sheet.copy,/écran d’accueil/);
 else{assert.equal(sheet.button,'J’ai compris');assert.match(sheet.copy,/menu ⋮/)}
 results.push('sheet: '+sheet.button);
 // During the scripted tutorial, a real tap still closes the sheet (#722 lesson).
 const learning=await evaluate('document.getElementById("board").dataset.learningStage||""');
 await click('#installLater');
 await until('document.getElementById("installOptin").hidden','sheet closes on a real tap',30);
 results.push('real tap closes the sheet'+(learning?' during learning stage '+learning:''));
 // A reload never asks again.
 await navigateAndWait({send,evaluate},'Page.reload');
 await until('document.querySelectorAll("#board .cell").length>0','reloaded');await sleep(2000);
 assert.equal(await evaluate(shown),false,'No repeat after reload');
 results.push('no repeat after reload');
 // Without the request, a new visitor is not offered installation (quest-12 rule unchanged).
 await evaluate('localStorage.clear()');await navigateAndWait({send,evaluate},'Page.navigate',{url:base.href});
 await until('document.querySelectorAll("#board .cell").length>0','plain visit');await sleep(2000);
 assert.equal(await evaluate(shown),false,'Plain visit unchanged');
 results.push('plain visit unchanged');
 const iphone=await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  Object.defineProperty(navigator,'userAgent',{get:()=> 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'});
  Object.defineProperty(navigator,'standalone',{get:()=> localStorage.getItem('fixtureInstalled')==='1'});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();event.stopImmediatePropagation()},true);
  delete Object.getPrototypeOf(navigator).serviceWorker;
 `});
 await navigateAndWait({send,evaluate},'Page.navigate',{url:url.href});
 await evaluate("document.querySelector('.first-welcome:not([hidden]) .intro-play')?.click()");
 await until(shown,'iPhone opens the manual Safari steps');
 assert.match(await evaluate("document.getElementById('installOptinCopy').textContent"),/Ouvrir dans Safari.*Partager.*Sur l’écran d’accueil.*Ajouter/);
 await click('#installEnable');
 assert.equal(await evaluate(shown),false,'Acknowledging the Safari directions closes the sheet');
 await evaluate("localStorage.setItem('fixtureInstalled','1')");
 await navigateAndWait({send,evaluate},'Page.navigate',{url:url.href});
 await sleep(1800);
 assert.equal(await evaluate(shown),false,'Installed iPhone shell suppresses an explicit install request');
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:iphone.identifier});
 results.push('iPhone Safari instructions and installed state');
 assert.deepEqual(errors,[]);
 const report={results,uncaughtErrors:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
