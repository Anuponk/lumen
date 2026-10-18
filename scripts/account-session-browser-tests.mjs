// Isolated browser + simulated Auth/RPC. No real accounts or mail requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {connectBrowser,navigateAndWait} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const navigate=(method,params)=>navigateAndWait({send,evaluate},method,params);
async function until(expression){for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+expression+' '+JSON.stringify(await evaluate(`({calls:window.__authCalls,status:document.getElementById('mobileAuthStatus')?.textContent,emailStatus:document.getElementById('accountEmailStatus')?.textContent,diagnostics:localStorage.getItem('lumenCloudDiagnosticsV1')})`)))}
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');
const fixture=`
localStorage.setItem('lumenSound','off');
window.__authCalls=[];
window.__fixtureLedgerWrites=0;window.__fixtureSnapshotWrites=0;
window.__fixtureLedgerAttempts=0;
window.__fixtureCommandReceipts=new Map();
const isolatedRecovery=sessionStorage.getItem('fixtureIsolatedRecovery')==='1';
window.__fixtureProfile={solved:{},historyBackup:{},badges:{},stars:{},noHint:{},performances:{},canonicalQuestState:{},daily:{},challenges:{},shards:3,xp:0,skyScore:0,skyHistoryVersion:4,legacyReceipt:'cloud'};
if(isolatedRecovery){
 sessionStorage.setItem('fixtureIsolatedLoads',String(Number(sessionStorage.getItem('fixtureIsolatedLoads')||0)+1));
 localStorage.setItem('lumenCloudOwnerId','fixture-player');
 localStorage.setItem('lumenProgressV1',JSON.stringify({...window.__fixtureProfile,shards:9,legacyReceipt:'local'}));
}
window.supabase={createClient(){
 let session=JSON.parse(sessionStorage.getItem('fixtureAuthSession')||'null'),callback=()=>{};
 const set=(event,value)=>{session=value;sessionStorage.setItem('fixtureAuthSession',JSON.stringify(value));callback(event,value)};
 window.__emitAuthEvent=event=>set(event,session);
 return {rpc:async(name,args)=>{
  if(!isolatedRecovery)return name==='lumen_restore_profile'?{data:null,error:{message:'simulated restore outage'}}:{data:[],error:null};
  if(name==='lumen_restore_profile')return {data:structuredClone(window.__fixtureProfile),error:null};
  if(['lumen_commit_canonical_command','lumen_get_canonical_command'].includes(name)&&args.p_expected_user_id!=='fixture-player')return {data:null,error:{code:'42501'},status:403};
  if(name==='lumen_canonical_command_version')return {data:1,error:null};
  if(name==='lumen_get_canonical_command')return {data:window.__fixtureCommandReceipts.get(args.p_operation_id)??null,error:null};
  if(name==='lumen_cas_profile'){window.__fixtureSnapshotWrites++;window.__fixtureProfile=structuredClone(args.p_payload);return {data:true,error:null};}
  if(name==='lumen_commit_canonical_victory'||name==='lumen_commit_canonical_command'){
   window.__fixtureLedgerAttempts++;
   if(window.__fixtureLedgerError)return {data:null,error:{code:window.__fixtureLedgerError,message:'simulated rejection'},status:401};
   window.__fixtureLedgerWrites++;
   const fresh=!window.__fixtureProfile.canonicalQuestState[args.p_quest_id]?.solved;
   const prior=window.__fixtureProfile.canonicalQuestState[args.p_quest_id];
   window.__fixtureProfile.canonicalQuestState[args.p_quest_id]={...prior,solved:true,stars:1,badges:{...prior?.badges,...args.p_badges},performance:prior?.performance??args.p_performance};
   if(fresh)window.__fixtureProfile.xp+=15;
   if(name==='lumen_commit_canonical_command')window.__fixtureCommandReceipts.set(args.p_operation_id,{version:1,operationId:args.p_operation_id,questId:args.p_quest_id,badges:args.p_badges,performance:args.p_performance,newlyCompleted:fresh,recordedAt:new Date().toISOString()});
   return {data:{profile:structuredClone(window.__fixtureProfile),newlyCompleted:fresh},error:null};
  }
  return {data:[],error:null};
 },auth:{
 getSession:async()=>({data:{session}}),onAuthStateChange(fn){callback=fn},
 signInWithPassword:async()=>{window.__authCalls.push('password');set('SIGNED_IN',{user:{id:'fixture-player'}});return {data:{session},error:null}},
 verifyOtp:async()=>{window.__authCalls.push('recovery');set('PASSWORD_RECOVERY',{user:{id:'fixture-player'}});return {error:null}},
 updateUser:async(value)=>{window.__authCalls.push('password_update');return {error:null}},
 signOut:async(options)=>{window.__authCalls.push(options.scope);set('SIGNED_OUT',null);return {error:null}}
 }};
}};
`;
const results=[];
async function verifyIsolatedRecovery(){
 const quest=canonicalQuestList().find(q=>q.legacyIndex===null);assert.ok(quest);
 await evaluate(`sessionStorage.setItem('fixtureIsolatedRecovery','1');sessionStorage.setItem('fixtureAuthSession',JSON.stringify({user:{id:'fixture-player'}}));localStorage.removeItem('lumenCloudDiagnosticsV1')`);
 await navigate('Page.reload');
 await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_partial_reconciliation_pending')`);
 const before=await evaluate(`({local:localStorage.getItem('lumenProgressV1'),loads:sessionStorage.getItem('fixtureIsolatedLoads'),snapshots:window.__fixtureSnapshotWrites})`);
 await evaluate(`(async()=>{
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  await createDurableCanonicalVictoryOutbox(localStorage).enqueue('fixture-player',${JSON.stringify(quest.id)},{badges:{autonomy:true},performance:{seconds:20,assisted:false}},{operationId:'isolated-browser-'+Date.now()});
  window.dispatchEvent(new Event('online'));
 })()`,true);
 await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='canonical_outbox_isolated_recovered')`);
 const after=await evaluate(`(async()=>({local:localStorage.getItem('lumenProgressV1'),loads:sessionStorage.getItem('fixtureIsolatedLoads'),snapshots:window.__fixtureSnapshotWrites,commits:window.__fixtureLedgerWrites,serverXp:window.__fixtureProfile.xp,serverReceipt:window.__fixtureProfile.legacyReceipt,status:document.getElementById('mobileAuthStatus').textContent,pending:(await (await import('/src/persistence/durable-canonical-outbox.js')).createDurableCanonicalVictoryOutbox(localStorage).pending('fixture-player')).length}))()`,true);
 assert.equal(after.local,before.local,'Preserve the divergent local save byte for byte');
 assert.equal(after.loads,before.loads,'No full-hydration reload loop');
 assert.equal(after.snapshots,before.snapshots,'No full-profile write during isolated recovery');
 assert.equal(after.commits,1);assert.equal(after.pending,0);assert.equal(after.serverXp,15);assert.equal(after.serverReceipt,'cloud');
 assert.equal(await evaluate('window.__fixtureCommandReceipts.size'),1,'V2 recovery uses the receipt protocol');
 assert.ok(await evaluate("[...window.__fixtureCommandReceipts.keys()][0].startsWith('isolated-browser-')"),'Preserve queued operation identity through the UI adapter');
 assert.ok(after.status.includes('sauvegarde à resynchroniser'),'Do not label a partial recovery fully synced');
 // An expired session pauses the persisted badge replay; a verified token
 // refresh must release only auth holds, without a full-profile replacement.
 await evaluate(`(async()=>{
  window.__fixtureLedgerError='PGRST301';
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  await createDurableCanonicalVictoryOutbox(localStorage).enqueue('fixture-player',${JSON.stringify(quest.id)},{badges:{speed:true},performance:{seconds:15}},{operationId:'auth-browser-'+Date.now()});
  window.dispatchEvent(new Event('online'));
 })()`,true);
 await until(`document.getElementById('mobileAuthStatus').textContent.includes('Session à renouveler')`);
 const attempts=await evaluate('window.__fixtureLedgerAttempts');
 await evaluate(`window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('online'))`);await sleep(200);
 assert.equal(await evaluate('window.__fixtureLedgerAttempts'),attempts,'No automatic RPC loop while auth is paused');
 await evaluate(`window.__fixtureLedgerError=null;window.__emitAuthEvent('TOKEN_REFRESHED')`);
 await until('window.__fixtureLedgerWrites===2');
 await until(`document.getElementById('mobileAuthStatus').textContent.includes('sauvegarde à resynchroniser')`);
 assert.equal(await evaluate('window.__fixtureProfile.xp'),15,'Badge replay cannot award XP again');
 assert.equal(await evaluate(`localStorage.getItem('lumenProgressV1')`),before.local);
 assert.equal(await evaluate('window.__fixtureSnapshotWrites'),before.snapshots);
 assert.equal(await evaluate(`sessionStorage.getItem('fixtureIsolatedLoads')`),before.loads);
 await evaluate(`sessionStorage.removeItem('fixtureIsolatedRecovery');sessionStorage.removeItem('fixtureAuthSession');`);
 return true;
}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 // Keep both the real SDK and project APIs out of the isolated fixture.
 await send('Network.setBlockedURLs',{urls:['*supabase*']});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 for(const viewport of [{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  await navigate('Page.navigate',{url:url.href});
  await evaluate(`sessionStorage.removeItem('fixtureAuthSession');sessionStorage.removeItem('lumenPasswordRecoveryPending');`);
  await navigate('Page.reload');
  await evaluate(`document.getElementById('mobileAuthAction').click()`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),false);
  assert.equal(await evaluate(`!!document.getElementById('accountOtp')`),false);
  await evaluate(`document.getElementById('accountOptinLater').click()`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),true);
  await evaluate(`document.getElementById('mobileAuthAction').click();document.getElementById('accountAuthSwitch').click();document.getElementById('accountEmail').value='fixture@example.test';document.getElementById('accountPassword').value='test-password-only';document.getElementById('accountPasswordSubmit').click()`);
  await until(`document.getElementById('mobileAuthStatus').textContent.includes('sauvegarde à resynchroniser')`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),true);
  assert.equal(await evaluate(`document.getElementById('retryAccountSync').hidden`),false);
  await navigate('Page.reload');
  await until(`document.getElementById('mobileAuthAction').textContent==='Déconnexion'`);
  const recovery=new URL(url);recovery.searchParams.set('lumen_confirm','a'.repeat(64));recovery.searchParams.set('type','recovery');
  await navigate('Page.navigate',{url:recovery.href});await until(`window.__authCalls?.includes('recovery')`);
  await until(`document.getElementById('accountProfileEditor').hidden===false`);
  await until(`document.getElementById('setPasswordValue').getClientRects().length>0`);
  assert.equal(await evaluate(`location.search.includes('lumen_confirm')`),false);
  await navigate('Page.reload');
  assert.equal(await evaluate(`document.getElementById('setPasswordValue').getClientRects().length>0`),true);
  await evaluate(`document.getElementById('setPasswordValue').value='new-test-password';document.getElementById('setPasswordSave').click()`);
  await until(`sessionStorage.getItem('lumenPasswordRecoveryPending')===null`);
  await until(`document.getElementById('mobileAuthAction').textContent==='Déconnexion'`);
  await evaluate(`document.getElementById('mobileAuthAction').click()`);
  await until(`document.getElementById('mobileAuthAction').textContent.includes('Se connecter')`);
  const isolatedCanonicalRecovery=await verifyIsolatedRecovery();
  results.push({viewport,guestDismiss:true,passwordLogin:true,reload:true,recoveryVisible:true,recoveryReload:true,passwordSet:true,restoreFailureVisible:true,isolatedCanonicalRecovery});
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 const report={simulatedAuth:true,liveCloudWrites:false,results,exceptions:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await send('Browser.close').catch(()=>{})}
