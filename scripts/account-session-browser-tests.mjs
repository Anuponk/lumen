// Isolated browser + simulated Auth/RPC. No real accounts or mail requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+expression+' '+JSON.stringify(await evaluate(`({calls:window.__authCalls,status:document.getElementById('mobileAuthStatus')?.textContent,emailStatus:document.getElementById('accountEmailStatus')?.textContent,diagnostics:localStorage.getItem('lumenCloudDiagnosticsV1')})`)))}
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const fixture=`
localStorage.setItem('lumenSound','off');
window.__authCalls=[];
window.supabase={createClient(){
 let session=JSON.parse(sessionStorage.getItem('fixtureAuthSession')||'null'),callback=()=>{};
 const set=(event,value)=>{session=value;sessionStorage.setItem('fixtureAuthSession',JSON.stringify(value));callback(event,value)};
 return {rpc:async(name)=>name==='lumen_restore_profile'?{data:null,error:{message:'simulated restore outage'}}:{data:[],error:null},auth:{
 getSession:async()=>({data:{session}}),onAuthStateChange(fn){callback=fn},
 signInWithPassword:async()=>{window.__authCalls.push('password');set('SIGNED_IN',{user:{id:'fixture-player'}});return {data:{session},error:null}},
 verifyOtp:async()=>{window.__authCalls.push('recovery');set('PASSWORD_RECOVERY',{user:{id:'fixture-player'}});return {error:null}},
 updateUser:async(value)=>{window.__authCalls.push('password_update');return {error:null}},
 signOut:async(options)=>{window.__authCalls.push(options.scope);set('SIGNED_OUT',null);return {error:null}}
 }};
}};
`;
const results=[];
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 // Keep both the real SDK and project APIs out of the isolated fixture.
 await send('Network.setBlockedURLs',{urls:['*supabase*']});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 for(const viewport of [{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');
  await evaluate(`sessionStorage.removeItem('fixtureAuthSession');sessionStorage.removeItem('lumenPasswordRecoveryPending');`);
  await send('Page.reload');await until('!!window.lumenDiagnostics');
  await evaluate(`document.getElementById('mobileAuthAction').click()`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),false);
  assert.equal(await evaluate(`!!document.getElementById('accountOtp')`),false);
  await evaluate(`document.getElementById('accountOptinLater').click()`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),true);
  await evaluate(`document.getElementById('mobileAuthAction').click();document.getElementById('accountAuthSwitch').click();document.getElementById('accountEmail').value='fixture@example.test';document.getElementById('accountPassword').value='test-password-only';document.getElementById('accountPasswordSubmit').click()`);
  await until(`document.getElementById('mobileAuthStatus').textContent.includes('sauvegarde à resynchroniser')`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),true);
  assert.equal(await evaluate(`document.getElementById('retryAccountSync').hidden`),false);
  await send('Page.reload');await until('!!window.lumenDiagnostics');
  await until(`document.getElementById('mobileAuthAction').textContent==='Déconnexion'`);
  const recovery=new URL(url);recovery.searchParams.set('lumen_confirm','a'.repeat(64));recovery.searchParams.set('type','recovery');
  await send('Page.navigate',{url:recovery.href});await until(`window.__authCalls?.includes('recovery')`);
  await until(`document.getElementById('accountProfileEditor').hidden===false`);
  await until(`document.getElementById('setPasswordValue').getClientRects().length>0`);
  assert.equal(await evaluate(`location.search.includes('lumen_confirm')`),false);
  await send('Page.reload');await until('!!window.lumenDiagnostics');
  assert.equal(await evaluate(`document.getElementById('setPasswordValue').getClientRects().length>0`),true);
  await evaluate(`document.getElementById('setPasswordValue').value='new-test-password';document.getElementById('setPasswordSave').click()`);
  await until(`sessionStorage.getItem('lumenPasswordRecoveryPending')===null`);
  await until(`document.getElementById('mobileAuthAction').textContent==='Déconnexion'`);
  await evaluate(`document.getElementById('mobileAuthAction').click()`);
  await until(`document.getElementById('mobileAuthAction').textContent.includes('Se connecter')`);
  results.push({viewport,guestDismiss:true,passwordLogin:true,reload:true,recoveryVisible:true,recoveryReload:true,passwordSet:true,restoreFailureVisible:true});
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 const report={simulatedAuth:true,liveCloudWrites:false,results,exceptions:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await send('Browser.close').catch(()=>{})}
