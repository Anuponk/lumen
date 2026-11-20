// #736/#744/#758: the presentation and « Comment jouer » pages in a real browser at three viewports. Runs in the full
// quality gate and alone in the landing-only CI scope.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {connectBrowser,closeBrowser} from './cdp-client.mjs';
import {verifyLanding,verifyHowToPlay,verifyLearnConstellations,verifyConstellationDirectory} from './landing-browser.mjs';

const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const {send,evaluate,errors}=await connectBrowser();
try{
 await send('Page.enable');await send('Runtime.enable');
 const results=[];
 for(const viewport of [{width:360,height:640,mobile:true},{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  results.push({viewport,...await verifyLanding({send,evaluate},url),...await verifyHowToPlay({send,evaluate},url),...await verifyLearnConstellations({send,evaluate},url),...await verifyConstellationDirectory({send,evaluate},url,{slowMobile:viewport.width===360})});
  const screenshotDir=process.env.LUMEN_FACT_SCREENSHOTS;
  if(screenshotDir&&viewport.width!==360){
   fs.mkdirSync(screenshotDir,{recursive:true});
   const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
   const filename=viewport.mobile?'ci-constellations-public-mobile.png':'ci-constellations-public-desktop.png';
   fs.writeFileSync(path.join(screenshotDir,filename),Buffer.from(data,'base64'));
  }
 }
 assert.deepEqual(errors,[]);
 const report={results,uncaughtErrors:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
