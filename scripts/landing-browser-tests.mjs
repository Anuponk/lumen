// #736/#744: the presentation page in a real browser at three viewports. Runs in the full
// quality gate and alone in the landing-only CI scope.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connectBrowser,closeBrowser} from './cdp-client.mjs';
import {verifyLanding} from './landing-browser.mjs';

const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const {send,evaluate,errors}=await connectBrowser();
try{
 await send('Page.enable');await send('Runtime.enable');
 const results=[];
 for(const viewport of [{width:360,height:640,mobile:true},{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  results.push({viewport,...await verifyLanding({send,evaluate},url)});
 }
 assert.deepEqual(errors,[]);
 const report={results,uncaughtErrors:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
