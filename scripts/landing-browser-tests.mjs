// #736/#744/#758: the presentation and « Comment jouer » pages in a real browser at three viewports. Runs in the full
// quality gate and alone in the landing-only CI scope.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {connectBrowser,closeBrowser,navigateAndWait} from './cdp-client.mjs';
import {verifyLanding,verifyHowToPlay,verifyLearnConstellations,verifyConstellationDirectory} from './landing-browser.mjs';

const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const {send,evaluate,errors}=await connectBrowser();
async function waitForDiscovery(page){
 for(let i=0;i<100;i++){
  try{if(await evaluate(`document.readyState==="complete"&&location.pathname===${JSON.stringify(page)}`))return}
  catch(error){if(!/Cannot find context|Execution context was destroyed|Inspected target navigated/.test(error.message))throw error}
  await new Promise(resolve=>setTimeout(resolve,60));
 }
 throw Error('Discovery page did not load: '+page);
}
try{
 await send('Page.enable');await send('Runtime.enable');
 const results=[];
 for(const viewport of [{width:360,height:640,mobile:true},{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  results.push({viewport,...await verifyLanding({send,evaluate},url),...await verifyLanding({send,evaluate},url,'en'),...await verifyHowToPlay({send,evaluate},url),...await verifyHowToPlay({send,evaluate},url,'en'),...await verifyLearnConstellations({send,evaluate},url),...await verifyLearnConstellations({send,evaluate},url,'en'),...await verifyConstellationDirectory({send,evaluate},url,{slowMobile:viewport.width===360})});
  const viewportResult=results.at(-1);
  const screenshotDir=process.env.LUMEN_FACT_SCREENSHOTS;
  if(screenshotDir&&viewport.width!==360){
   fs.mkdirSync(screenshotDir,{recursive:true});
   const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   const filename=viewport.mobile?'ci-constellations-public-mobile.png':'ci-constellations-public-desktop.png';
   fs.writeFileSync(path.join(screenshotDir,filename),Buffer.from(data,'base64'));
  }
  Object.assign(viewportResult,await verifyConstellationDirectory({send,evaluate},url,{locale:'en'}));
 }
 await send('Page.navigate',{url:new URL('/decouvrir.html',url).href});
 await waitForDiscovery('/decouvrir.html');
 await evaluate('document.querySelector(".language-switch a").click()');
 await waitForDiscovery('/discover.html');
 assert.equal(await evaluate('document.documentElement.lang'),'en');
 await evaluate('document.querySelector(".language-switch a").click()');
 await waitForDiscovery('/decouvrir.html');
 assert.equal(await evaluate('document.documentElement.lang'),'fr');
 const channels={};
 for(const page of ['/decouvrir.html','/discover.html']){
  const landing=new URL(page+'?utm_source=player_share&utm_medium=referral',url);
  await send('Page.navigate',{url:landing.href});
  await waitForDiscovery(page);
  await navigateAndWait({send,evaluate},'Runtime.evaluate',{expression:'document.querySelector("a.play").click()'});
  channels[page]=await evaluate(`(async()=>{const {readDiscoveryCampaign}=await import('/src/analytics/acquisition.js');return readDiscoveryCampaign(location,document.referrer)})()`,true);
  assert.equal(channels[page],'player_share','Same-origin CTA preserves the allowlisted campaign from '+page);
 }
 assert.deepEqual(errors,[]);
 const report={results,channel:channels['/decouvrir.html'],channels,uncaughtErrors:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
