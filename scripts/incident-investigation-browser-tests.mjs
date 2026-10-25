import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser} from './cdp-client.mjs';
import {verifyIncidentInvestigation} from './incident-investigation-browser.mjs';
import {verifyCockpit} from './cockpit-browser.mjs';
const {send,evaluate,errors}=await connectBrowser();
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const results=[];
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*supabase*','*github.com*']});
 for(const viewport of [{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  const result=await verifyIncidentInvestigation({send,evaluate,url});
  assert.equal(await evaluate('typeof window.lumenDiagnostics'), 'undefined','No game startup or recovery in this browser');
  results.push({viewport,...result});
 }
 const cockpit=[];
 for(const viewport of [{width:320,height:640,mobile:true},{width:360,height:780,mobile:true},{width:390,height:844,mobile:true},{width:844,height:390,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  cockpit.push({viewport,...await verifyCockpit({send,evaluate,url})});
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 const report={independentBrowser:true,liveRPC:false,issueSubmitted:false,results,cockpit,exceptions:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await send('Browser.close').catch(()=>{})}
