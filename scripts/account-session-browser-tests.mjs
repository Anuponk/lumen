// Isolated browser + simulated Auth/RPC. No real accounts or mail requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {verifyWalletAndOfflineFlow} from './wallet-flow-browser.mjs';
import {verifyCompletedQuestHold} from './completed-quest-hold-browser.mjs';
import {verifyQuotaRecovery} from './quota-recovery-browser.mjs';
import {verifyIncidentInvestigation} from './incident-investigation-browser.mjs';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
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
window.__diagnosticRows=JSON.parse(sessionStorage.getItem('fixtureDiagnosticRows')||'[]');
window.__fixtureCommandReceipts=new Map();
window.__fixtureLegacyReceipts=new Map();window.__fixtureLegacyWrites=0;window.__fixtureLegacyAttempts=0;
const isolatedRecovery=sessionStorage.getItem('fixtureIsolatedRecovery')==='1';
window.__fixtureProfile={solved:{},historyBackup:{},badges:{},stars:{},noHint:{},performances:{},canonicalQuestState:{},daily:{},challenges:{},shards:3,xp:0,skyScore:0,skyHistoryVersion:4,legacyReceipt:'cloud'};
const savedRetryServer=JSON.parse(sessionStorage.getItem('fixtureRetryServer')||'null');
if(savedRetryServer){
 window.__fixtureProfile=savedRetryServer.profile;
 window.__fixtureLegacyReceipts=new Map(savedRetryServer.legacyReceipts);
 window.__fixtureCommandReceipts=new Map(savedRetryServer.canonicalReceipts);
 window.__fixtureLegacyWrites=savedRetryServer.legacyWrites;
 window.__fixtureLedgerWrites=savedRetryServer.canonicalWrites;
}
window.__persistFixtureServer=()=>{
 if(sessionStorage.getItem('fixtureRetryPersist')==='1')sessionStorage.setItem('fixtureRetryServer',JSON.stringify({
  profile:window.__fixtureProfile,legacyReceipts:[...window.__fixtureLegacyReceipts],canonicalReceipts:[...window.__fixtureCommandReceipts],
  legacyWrites:window.__fixtureLegacyWrites,canonicalWrites:window.__fixtureLedgerWrites
 }));
};
if(isolatedRecovery){
 if(!savedRetryServer)window.__fixtureProfile.legacyVictoryRevision=1;
 sessionStorage.setItem('fixtureIsolatedLoads',String(Number(sessionStorage.getItem('fixtureIsolatedLoads')||0)+1));
 localStorage.setItem('lumenCloudOwnerId','fixture-player');
 // Isolate the historical authority refusal. Unreceipted currency differences
 // have an earlier protected hold and their own wallet regression coverage.
 if(!savedRetryServer)localStorage.setItem('lumenProgressV1',JSON.stringify({...window.__fixtureProfile,solved:{1:1}}));
}
window.supabase={createClient(url,key,options){
 // Model the SDK's default writable-storage probe: a full but readable store
 // otherwise falls back to memory and hides an existing persisted session.
 const memory=new Map(),storage=options?.auth?.storage||(sessionStorage.getItem('fixtureAuthQuota')==='1'?{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}:localStorage);
 let session=JSON.parse(storage.getItem('fixtureAuthSession')||'null'),callback=()=>{};
 const set=(event,value)=>{session=value;storage.setItem('fixtureAuthSession',JSON.stringify(value));callback(event,value)};
 window.__emitAuthEvent=event=>set(event,session);
 return {rpc:async(name,args)=>{
  if(name==='lumen_diagnostic_preference'){
   if(typeof args?.p_enabled==='boolean')sessionStorage.setItem('fixtureDiagnosticConsent',String(args.p_enabled));
   const enabled=sessionStorage.getItem('fixtureDiagnosticConsent')==='true';
   if(!enabled){window.__diagnosticRows=[];sessionStorage.removeItem('fixtureDiagnosticRows')}
   return {data:{enabled,since:new Date().toISOString(),purpose:'534-v1'},error:null};
  }
  if(name==='lumen_record_diagnostics'){
   const allowed=sessionStorage.getItem('fixtureDiagnosticConsent')==='true';
   if(allowed)for(const event of args.p_events)if(!window.__diagnosticRows.some(row=>row.id===event.id))window.__diagnosticRows.push(structuredClone(event));
   sessionStorage.setItem('fixtureDiagnosticRows',JSON.stringify(window.__diagnosticRows));
   return {data:{disabled:!allowed,accepted:allowed?args.p_events.map(e=>e.id):[]},error:null};
  }
  if(name==='lumen_wallet_command_version')return {error:{code:'PGRST202'},status:404};
  if(!isolatedRecovery)return name==='lumen_restore_profile'?{data:null,error:{message:'simulated restore outage'}}:{data:[],error:null};
  if(name==='lumen_restore_profile')return {data:structuredClone(window.__fixtureProfile),error:null};
  if(['lumen_commit_legacy_command','lumen_get_legacy_command'].includes(name)&&args.p_expected_user_id!=='fixture-player')return {data:null,error:{code:'42501'},status:403};
  if(name==='lumen_legacy_command_version')return {data:1,error:null};
  if(name==='lumen_get_legacy_command')return {data:window.__fixtureLegacyReceipts.get(args.p_operation_id)??null,error:null};
  if(name==='lumen_commit_legacy_command'){
   window.__fixtureLegacyAttempts++;
   if(window.__fixtureLegacyError)return {data:null,error:{code:window.__fixtureLegacyError},status:401};
   const request={version:1,operationId:args.p_operation_id,questId:args.p_quest_id,facts:args.p_facts};
   const prior=window.__fixtureLegacyReceipts.get(args.p_operation_id);
   if(prior&&JSON.stringify(prior.request)!==JSON.stringify(request))return {data:null,error:{code:'22023'},status:400};
   if(!prior){
    const {applyLegacyVictory,legacyVictoryRules}=await import('/src/campaign/legacy-victory.js');
    const index=legacyVictoryRules().find(q=>q.questId===args.p_quest_id).index;
    const outcome=applyLegacyVictory(window.__fixtureProfile,index,args.p_facts);
    window.__fixtureProfile.legacyVictoryRevision=(window.__fixtureProfile.legacyVictoryRevision||0)+1;
    window.__fixtureLegacyReceipts.set(args.p_operation_id,{request,outcome,recordedAt:new Date().toISOString()});
    window.__fixtureLegacyWrites++;window.__persistFixtureServer();
   }
   if(window.__fixtureLegacyLost)throw Error('simulated lost response after commit');
   return {data:window.__fixtureLegacyReceipts.get(args.p_operation_id),error:null};
  }
  if(['lumen_commit_canonical_command','lumen_get_canonical_command'].includes(name)&&args.p_expected_user_id!=='fixture-player')return {data:null,error:{code:'42501'},status:403};
  if(name==='lumen_canonical_command_version')return {data:1,error:null};
  if(name==='lumen_get_canonical_command')return {data:window.__fixtureCommandReceipts.get(args.p_operation_id)??null,error:null};
  if(name==='lumen_cas_profile'){window.__fixtureSnapshotWrites++;return {data:null,error:{code:'22023',message:'legacy victory command required; preserve pending data and update client'}};}
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
 getSession:async()=>{
  if(sessionStorage.getItem('fixtureDelaySessionRestore')==='1'){
   window.__sessionRestoreWaiting=true;
   await new Promise(resolve=>{window.__completeSessionRestore=resolve});
  }
  return {data:{session}};
 },onAuthStateChange(fn){callback=fn},
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
 await evaluate(`sessionStorage.setItem('fixtureIsolatedRecovery','1');localStorage.setItem('fixtureAuthSession',JSON.stringify({user:{id:'fixture-player'}}));localStorage.removeItem('lumenCloudDiagnosticsV1')`);
 await navigate('Page.reload');
 await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_partial_reconciliation_pending')`);
 const before=await evaluate(`({local:localStorage.getItem('lumenProgressV1'),loads:sessionStorage.getItem('fixtureIsolatedLoads'),snapshots:window.__fixtureSnapshotWrites})`);
 assert.equal(before.snapshots,1,'The protected CAS is refused once without a fallback write');
 assert.equal(await evaluate(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_reconciliation'&&e.reason==='legacy_command_required')`),true);
 assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')).find(e=>e.event==='hydration_reconciliation'&&e.reason==='legacy_command_required').fields`,true),['solved'],'Mobile diagnostic identifies the protected difference without including progress values');
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
 // Historical commands now share the same isolated recovery boundary. This is
 // a simulated transaction transport; SQL behavior has its own real-PG gate.
 const legacy=canonicalQuestList().find(q=>q.legacyIndex===0);assert.ok(legacy);
 await evaluate(`(async()=>{
  window.__fixtureLegacyLost=true;
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  const facts={seconds:45,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-19',qualifiedAt:'2026-10-19T10:00:00.000Z'};
  await createDurableCanonicalVictoryOutbox(localStorage,{namespace:'Legacy'}).enqueue('fixture-player',${JSON.stringify(legacy.id)},{facts},{operationId:'isolated-legacy-browser-reset-0'});
  window.dispatchEvent(new Event('online'));
 })()`,true);
 await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='legacy_outbox_isolated_recovered')`);
 await until(`document.getElementById('mobileAuthStatus').textContent.includes('sauvegarde à resynchroniser')`);
 assert.equal(await evaluate('window.__fixtureLegacyWrites'),1);
 assert.equal(await evaluate('window.__fixtureLegacyReceipts.size'),1);
 assert.equal(await evaluate('window.__fixtureProfile.performances[0].attempts'),1);
 assert.equal(await evaluate('window.__fixtureProfile.xp'),30);
 assert.equal(await evaluate(`(async()=> (await (await import('/src/persistence/durable-canonical-outbox.js')).createDurableCanonicalVictoryOutbox(localStorage,{namespace:'Legacy'}).pending('fixture-player')).length)()`,true),0);
 await evaluate(`(async()=>{
  window.__fixtureLegacyLost=false;window.__fixtureLegacyError='PGRST301';
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  const facts={seconds:65,assistanceUsed:true,mistakeCommitted:false,qualifying:false,hintUsed:true,challengeFailed:false,qualifiedDay:'2026-10-19',qualifiedAt:'2026-10-19T10:00:00.000Z'};
  await createDurableCanonicalVictoryOutbox(localStorage,{namespace:'Legacy'}).enqueue('fixture-player',${JSON.stringify(legacy.id)},{facts},{operationId:'isolated-legacy-browser-reset-1'});
  window.dispatchEvent(new Event('online'));
 })()`,true);
 await until(`document.getElementById('mobileAuthStatus').textContent.includes('Session à renouveler')`);
 const legacyAttempts=await evaluate('window.__fixtureLegacyAttempts');
 await evaluate(`window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('online'))`);await sleep(200);
 assert.equal(await evaluate('window.__fixtureLegacyAttempts'),legacyAttempts);
 await evaluate(`window.__fixtureLegacyError=null;window.__emitAuthEvent('TOKEN_REFRESHED')`);
 await until('window.__fixtureLegacyWrites===2');
 await until(`document.getElementById('mobileAuthStatus').textContent.includes('sauvegarde à resynchroniser')`);
 assert.equal(await evaluate('window.__fixtureLegacyReceipts.size'),2);
 assert.equal(await evaluate('window.__fixtureProfile.performances[0].attempts'),2);
 assert.equal(await evaluate('window.__fixtureProfile.xp'),30);
 assert.equal(await evaluate(`localStorage.getItem('lumenProgressV1')`),before.local);
 assert.equal(await evaluate('window.__fixtureSnapshotWrites'),before.snapshots);
 assert.equal(await evaluate(`sessionStorage.getItem('fixtureIsolatedLoads')`),before.loads);
 // The end-of-grid button must recover a blocked baseline through the same
 // durable, fresh-hydration path as the account menu.
 // This scenario crosses reloads: its simulated server must keep receipts, just like the real database.
 const writesBeforeRetry=await evaluate(`sessionStorage.setItem('fixtureRetryPersist','1');window.__persistFixtureServer();window.__fixtureLegacyWrites`);
 const receiptsBeforeRetry=await evaluate('window.__fixtureLegacyReceipts.size');
 const retryIndex=await evaluate(`lumenDiagnostics.setupQuest(5);document.getElementById('attemptMask').click();lumenDiagnostics.snapshot().levelIndex`);
 const retryQuest=canonicalQuestList().find(q=>q.legacyIndex===retryIndex);assert(retryQuest);
 // Respect the catalogue/access gate: setupQuest may redirect a locked quest.
 await evaluate(`const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.reg.map((row,r)=>row.map((_,c)=>s.puz.sol[r]===c?2:0)))`);
 await until(`!!document.querySelector('#msg button')`);
 const pendingWin=await evaluate(`(async()=>{const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');return (await createDurableCanonicalVictoryOutbox(localStorage,{namespace:'Legacy'}).pending('fixture-player')).find(e=>e.questId===${JSON.stringify(retryQuest.id)})})()`,true);
 assert(pendingWin,'The solved board is durable before retry');
 const epoch=await evaluate('performance.timeOrigin');
 await evaluate(`document.querySelector('#msg button').click()`);
 await until(`performance.timeOrigin!==${epoch}&&!!window.lumenDiagnostics`);
 await until(`window.__fixtureLegacyReceipts?.has(${JSON.stringify(pendingWin.operationId)})`);
 const restoredWin=await evaluate(`({receipts:[...window.__fixtureLegacyReceipts.values()],writes:window.__fixtureLegacyWrites,performance:window.__fixtureProfile.performances[${retryIndex}]})`);
 assert.equal(restoredWin.writes,writesBeforeRetry+1);assert.equal(restoredWin.receipts.length,receiptsBeforeRetry+1);
 const confirmedWin=restoredWin.receipts.find(receipt=>receipt.request.operationId===pendingWin.operationId);assert(confirmedWin);
 assert.deepEqual(confirmedWin.request.facts,pendingWin.reward.facts);
 assert.equal(confirmedWin.request.operationId,pendingWin.operationId);
 assert.equal(restoredWin.performance.attempts,1,'End-of-grid retry grants and counts the saved run once');
 await evaluate(`sessionStorage.removeItem('fixtureIsolatedRecovery');localStorage.removeItem('fixtureAuthSession');sessionStorage.removeItem('fixtureRetryPersist');sessionStorage.removeItem('fixtureRetryServer');`);
 return true;
}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 // Keep both the real SDK and project APIs out of the isolated fixture.
 await send('Network.setBlockedURLs',{urls:['*supabase*']});
 const {identifier:authFixtureId}=await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 for(const viewport of [{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  await navigate('Page.navigate',{url:url.href});
  await evaluate(`localStorage.setItem('fixtureAuthSession',JSON.stringify({user:{id:'fixture-player'}}));sessionStorage.setItem('fixtureDelaySessionRestore','1');`);
  await navigate('Page.reload');
  await until('window.__sessionRestoreWaiting===true');
  assert.equal(await evaluate(`document.getElementById('mobileAuthAction').disabled`),true,'No second login while the saved session is restoring');
  assert.equal(await evaluate(`document.getElementById('mobileAuthAction').textContent.includes('Se connecter')`),false);
  await evaluate(`document.getElementById('mobileAuthAction').click()`);
  assert.deepEqual(await evaluate('window.__authCalls',true),[],'Restoration requires neither password nor logout');
  await evaluate(`sessionStorage.removeItem('fixtureDelaySessionRestore');window.__completeSessionRestore()`);
  await until(`!document.getElementById('mobileAuthAction').disabled && !document.getElementById('mobileAuthAction').textContent.includes('Se connecter')`);
  assert.deepEqual(await evaluate('window.__authCalls',true),[],'Saved account returns without another login');

  await evaluate(`localStorage.removeItem('fixtureAuthSession');sessionStorage.removeItem('fixtureAuthQuota');sessionStorage.removeItem('lumenPasswordRecoveryPending');`);
  await navigate('Page.reload');
  // Exercise the automatic quest milestone through a real guest victory, too.
  const originalGuest=await evaluate("localStorage.getItem('lumenProgressV1')");
  for(const dismiss of ['accountOptinClose','accountOptinLater']){
   await evaluate(`localStorage.setItem('lumenProgressV1',JSON.stringify({solved:{0:1,1:1,2:1,3:1},badges:{historical:1}}));localStorage.removeItem('lumenActiveAttemptV1');localStorage.removeItem('lumenAccountOfferNextMilestone');localStorage.setItem('lumenTutorialSeen','1');localStorage.setItem('lumenTutorialCompletedV1','1')`);
   await navigate('Page.reload');
   await acknowledgeLearningMilestones(evaluate);
   assert.equal(await evaluate('lumenDiagnostics.snapshot().levelIndex'),4);
   await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
   await until(`!document.getElementById('skyReveal').hidden && !document.getElementById('skyRevealResults').hidden`);
   await evaluate(`document.getElementById('skyRevealNext').click()`);
   await until(`!document.getElementById('accountOptin').hidden`);
   const before=await evaluate(`JSON.stringify(lumenDiagnostics.snapshot().progress.solved)`);
   await evaluate(`document.getElementById('${dismiss}').click()`);
   assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),true);
   await until('lumenDiagnostics.snapshot().levelIndex===5');
   assert.equal(await evaluate(`JSON.stringify(lumenDiagnostics.snapshot().progress.solved)`),before,'Automatic offer dismissal preserves earned victories');
   assert.deepEqual(await evaluate('window.__authCalls'),[],'Continuing as guest must not authenticate');
  }
  await evaluate(`localStorage.setItem('lumenProgressV1',${JSON.stringify(originalGuest)});localStorage.removeItem('lumenActiveAttemptV1');localStorage.removeItem('lumenAccountOfferNextMilestone')`);
  await navigate('Page.reload');
  // #356: both dismissal actions work repeatedly from signup and login,
  // preserving guest achievements and avoiding any Auth call.
  const guestProgress=()=>evaluate(`JSON.stringify((()=>{const p=lumenDiagnostics.snapshot().progress;return {solved:p.solved,canonicalQuestState:p.canonicalQuestState,performances:p.performances,xp:p.xp,shards:p.shards,badges:p.badges}})())`);
  for(const mode of ['signup','login'])for(const dismiss of ['accountOptinClose','accountOptinLater']){
   const before=await guestProgress();
   await evaluate(`document.getElementById('mobileAuthAction').click();${mode==='login'?"document.getElementById('accountAuthSwitch').click();":''}`);
   assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),false);
   await evaluate(`document.getElementById('${dismiss}').click()`);
   assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),true);
   assert.equal(await guestProgress(),before,'Dismissing account UI preserves all guest achievements');
   assert.deepEqual(await evaluate('window.__authCalls'),[]);
   assert.equal(await evaluate(`document.getElementById('mobileAuthAction').textContent.includes('Se connecter')`),true);
  }
  await evaluate(`document.getElementById('mobileAuthAction').click()`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),false);
  assert.equal(await evaluate(`!!document.getElementById('accountOtp')`),false);
  await evaluate(`document.getElementById('accountOptinLater').click()`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),true);
  await evaluate(`document.getElementById('mobileAuthAction').click();document.getElementById('accountAuthSwitch').click();document.getElementById('accountEmail').value='fixture@example.test';document.getElementById('accountPassword').value='test-password-only';document.getElementById('accountPasswordSubmit').click()`);
  await until(`document.getElementById('mobileAuthStatus').textContent.includes('sauvegarde à resynchroniser')`);
  assert.equal(await evaluate(`document.getElementById('accountOptin').hidden`),true);
  assert.equal(await evaluate(`document.getElementById('retryAccountSync').hidden`),false);
  const progressBeforeDiagnostic=await evaluate("localStorage.getItem('lumenProgressV1')");
  if(viewport.mobile)await evaluate("if(document.getElementById('mobileAuthPopover').hidden)document.getElementById('mobileAccount').click()");
  await evaluate("document.getElementById('showAccountSyncDiagnostic').click()");
  assert.equal(await evaluate("document.getElementById('accountSyncDiagnosticPanel').hidden"),false);
  assert.equal(await evaluate("document.getElementById('accountSyncDiagnosticText').readOnly"),true);
  assert.equal(await evaluate("JSON.parse(document.getElementById('accountSyncDiagnosticText').value).app"),'Lumen');
  if(viewport.mobile)assert.equal(await evaluate("document.getElementById('accountSyncDiagnosticText').getClientRects().length>0"),true);
  assert.equal(await evaluate("localStorage.getItem('lumenProgressV1')"),progressBeforeDiagnostic,'Diagnostic viewing preserves the local save');
  await until(`!document.getElementById('diagnosticConsent').disabled`);
  assert.equal(await evaluate(`document.getElementById('diagnosticConsent').checked`),false,'Optional diagnostics start disabled');
  await evaluate(`document.getElementById('diagnosticConsent').click()`);
  await until(`document.getElementById('diagnosticConsentStatus').textContent.includes('Partage activé')`);
  await evaluate(`window.dispatchEvent(new ErrorEvent('error',{message:'forbidden@example.invalid',filename:'https://private/?token=secret',error:{stack:'Bearer secret'}}))`);
  await until(`window.__diagnosticRows.some(e=>e.code==='runtime_exception')`);
  assert.equal(await evaluate(`JSON.stringify(window.__diagnosticRows).includes('secret')||JSON.stringify(window.__diagnosticRows).includes('@')`),false);
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await evaluate(`const resource=document.createElement('script');document.body.append(resource);resource.dispatchEvent(new Event('error',{bubbles:true}));resource.remove()`);
  await until(`JSON.parse(localStorage.getItem('lumenDiagnosticQueueV1')||'{}').events?.some(e=>e.code==='resource_failed')`);
  await navigate('Page.reload');
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await evaluate(`window.dispatchEvent(new Event('online'))`);
  await until(`window.__diagnosticRows.some(e=>e.code==='resource_failed')`);
  if(viewport.mobile)await evaluate(`if(document.getElementById('mobileAuthPopover').hidden)document.getElementById('mobileAccount').click()`);
  await evaluate(`document.getElementById('showAccountSyncDiagnostic').click()`);
  await until(`document.getElementById('diagnosticConsent').checked&&!document.getElementById('diagnosticConsent').disabled`);
  await evaluate(`document.getElementById('diagnosticConsent').click()`);
  await until(`document.getElementById('diagnosticConsentStatus').textContent.includes('effacés')`);
  assert.equal(await evaluate(`window.__diagnosticRows.length`),0);
  assert.equal(await evaluate("localStorage.getItem('lumenProgressV1')"),progressBeforeDiagnostic,'Optional telemetry/offline/restart/withdrawal preserve the live save');
  await until(`!!JSON.parse(document.getElementById('accountSyncDiagnosticText').value).storage?.local?.available`);
  assert.equal(await evaluate(`document.getElementById('accountStorageSummary').textContent.includes('ne permettent pas de connaître')`),true);
  await evaluate(`for(const stamp of [100,200,300])localStorage.setItem('lumenBeforeCloudRestore_'+stamp,'storage-fixture-'+stamp)`);
  if(viewport.mobile){
   const point=await evaluate(`(()=>{const b=document.getElementById('archiveAccountStorage');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
   assert(point.y>0&&point.y<viewport.height,'Storage maintenance stays reachable on mobile');
   await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
   await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else await evaluate(`document.getElementById('archiveAccountStorage').click()`);
  await until(`!document.getElementById('archiveAccountStorage').disabled`);
  assert.equal(await evaluate(`localStorage.getItem('lumenBeforeCloudRestore_100')`),null);
  assert.equal(await evaluate(`localStorage.getItem('lumenBeforeCloudRestore_300')`),'storage-fixture-300');
  assert.equal(await evaluate(`document.getElementById('accountStorageStatus').textContent.includes('exportables')`),true);
  assert.equal(await evaluate(`new Promise((resolve,reject)=>{const r=indexedDB.open('lumenCloudRecoveryV1',1);r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,q=db.transaction('snapshots','readonly').objectStore('snapshots').get('localStorage:lumenBeforeCloudRestore_100');q.onsuccess=()=>{db.close();resolve(q.result)}}})`,true),'storage-fixture-100');
  assert.equal(await evaluate("localStorage.getItem('lumenProgressV1')"),progressBeforeDiagnostic,'Archival never replaces the live profile');
  await until(`JSON.parse(document.getElementById('accountSyncDiagnosticText').value).storage?.indexed?.available`);
  await evaluate(`document.getElementById('accountStorageSummary').scrollIntoView({block:'center'})`);
  const storageScreenshot=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync((process.env.TEMP||'/tmp')+'/lumen-storage-'+viewport.width+'.png',Buffer.from(storageScreenshot.data,'base64'));
  await evaluate(`localStorage.removeItem('lumenBeforeCloudRestore_200');localStorage.removeItem('lumenBeforeCloudRestore_300')`);
  await evaluate("document.getElementById('closeAccountSyncDiagnostic').click()");
  assert.equal(await evaluate("document.getElementById('accountSyncDiagnosticPanel').hidden"),true);
  await navigate('Page.reload');
  await until(`document.getElementById('mobileAuthAction').textContent==='Déconnexion'`);
  await evaluate(`sessionStorage.setItem('fixtureAuthQuota','1')`);
  await navigate('Page.reload');
  assert.equal(await evaluate(`document.getElementById('mobileAuthAction').textContent`),'Déconnexion','A readable persisted session must survive a failed SDK write probe');
  await evaluate(`sessionStorage.removeItem('fixtureAuthQuota')`);
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
  await verifyIncidentInvestigation({send,evaluate,url});
  results.push({viewport,guestDismiss:true,automaticOfferDismiss:true,repeatedSignupLoginDismiss:true,passwordLogin:true,reload:true,readableSessionWithQuota:true,recoveryVisible:true,recoveryReload:true,passwordSet:true,restoreFailureVisible:true,isolatedCanonicalRecovery,isolatedLegacyRecovery:true,optionalDiagnostics:{defaultOff:true,sanitised:true,offlineRestartReconnect:true,withdrawalErases:true,profilePreserved:true}});
 }
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:authFixtureId});
 const walletFlow=await verifyWalletAndOfflineFlow({send,evaluate,navigate,url});
 const completedQuestHold=await verifyCompletedQuestHold({send,evaluate,navigate,url});
 const quotaRecovery=await verifyQuotaRecovery({evaluate,navigate,url});
 assert.equal(errors.length,0,JSON.stringify(errors));
 const report={simulatedAuth:true,liveCloudWrites:false,results,walletFlow,completedQuestHold,quotaRecovery,exceptions:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await send('Browser.close').catch(()=>{})}
