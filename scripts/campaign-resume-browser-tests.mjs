import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
const {send,evaluate,errors}=await connectBrowser();
const all=canonicalQuestList(),boundary=all.find(q=>q.id==='planned-real-24-q10'),next=all.find(q=>q.ordinal===boundary.ordinal+1);
const done=all.filter(q=>q.ordinal<=boundary.ordinal),solved=Object.fromEntries(done.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1]));
const profile={solved,historyBackup:solved,badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:Object.fromEntries(done.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{}}])),daily:{dates:{},rewards:{}},challenges:{},xp:1000,shards:3,walletRevision:1,skyScore:298,skyHistoryVersion:4};
const fixture=`localStorage.setItem('lumenTutorialSeen','1');localStorage.setItem('lumenTutorialCompletedV1','1');localStorage.setItem('lumenSound','off');if(!sessionStorage.getItem('grandChienFixture')){localStorage.setItem('lumenCloudOwnerId','synthetic-frontier');localStorage.setItem('lumenProgressV1',JSON.stringify(${JSON.stringify(profile)}));sessionStorage.setItem('grandChienFixture',JSON.stringify(${JSON.stringify(profile)}));}
if(sessionStorage.getItem('solvedBoardOnLoad')){const a=JSON.parse(localStorage.getItem('lumenActiveAttemptV1'));a.board=JSON.parse(sessionStorage.getItem('solvedBoardOnLoad'));localStorage.setItem('lumenActiveAttemptV1',JSON.stringify(a));sessionStorage.removeItem('solvedBoardOnLoad');}
window.__profile=JSON.parse(sessionStorage.getItem('grandChienFixture'));window.__canonicalReceipts=new Map(JSON.parse(sessionStorage.getItem('canonicalReceipts')||'[]'));window.__canonicalGrants=Number(sessionStorage.getItem('canonicalGrants')||0);
if(sessionStorage.getItem('recreatedCaptureOnLoad')){const fixture=JSON.parse(sessionStorage.getItem('recreatedCaptureOnLoad'));localStorage.setItem('lumenActiveAttemptV1',JSON.stringify(fixture.attempt));localStorage.setItem('lumenCanonicalVictoryOutboxV2:'+fixture.entry.userId+':'+fixture.entry.operationId,JSON.stringify(fixture.entry));if(fixture.paused)localStorage.setItem('lumenCanonicalVictoryRetryV1:'+fixture.entry.userId+':v2-'+fixture.entry.operationId,JSON.stringify({version:1,userId:fixture.entry.userId,questId:fixture.entry.questId,operationId:fixture.entry.operationId,intentCreatedAt:fixture.entry.createdAt,kind:'review',code:'22023'}));sessionStorage.removeItem('recreatedCaptureOnLoad');}
window.supabase={createClient(){return {auth:{getSession:async()=>{if(navigator.onLine===false)throw Error('Synthetic expired session refresh unavailable');await new Promise(resolve=>setTimeout(resolve,300));return {data:{session:{user:{id:sessionStorage.getItem('grandChienOwner')||'synthetic-frontier'}}}}},onAuthStateChange(){}},rpc:async(name,args)=>{
 if(navigator.onLine===false)throw new TypeError('Synthetic RPC offline');
 if(name==='lumen_restore_profile')return {data:structuredClone(window.__profile)};
 if(name==='lumen_cas_profile'){const stable=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):Array.isArray(value)?value.map(stable):value;if(JSON.stringify(stable(args.p_expected))!==JSON.stringify(stable(window.__profile)))return {data:false,error:null};if(JSON.stringify(args.p_payload.performances||{})!==JSON.stringify(window.__profile.performances||{}))return {data:null,error:{code:'22023',message:'legacy victory command required; preserve pending data and update client'}};window.__profile=structuredClone(args.p_payload);sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));return {data:true}};
 if(name==='lumen_wallet_command_version')return {data:1};
 if(name==='lumen_get_wallet_command')return {data:JSON.parse(sessionStorage.getItem('walletReceipts')||'{}')[args.p_operation_id]??null};
 if(name==='lumen_commit_wallet_command'){
  const receipts=JSON.parse(sessionStorage.getItem('walletReceipts')||'{}');let receipt=receipts[args.p_operation_id];
  if(!receipt){
   const cost=args.p_request.kind==='hint'&&args.p_request.sequence>1?2:1;
   if(window.__profile.shards<cost)return {error:{code:'P0001',message:'insufficient wallet balance'}};
   window.__profile.shards-=cost;window.__profile.walletRevision++;
   receipt={version:1,operationId:args.p_operation_id,request:args.p_request,revision:window.__profile.walletRevision,balance:window.__profile.shards,balanceDelta:-cost};
   receipts[args.p_operation_id]=receipt;sessionStorage.setItem('walletReceipts',JSON.stringify(receipts));sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));sessionStorage.setItem('walletDebits',String(Number(sessionStorage.getItem('walletDebits')||0)+1));
  }
  return {data:receipt};
 }
 if(name==='lumen_canonical_command_version')return {data:1,error:null};
 if(name==='lumen_get_quest_command'){
  const receipt=window.__canonicalReceipts.get(args.p_operation_id);
  return {data:receipt?.request?receipt:receipt?{request:receipt,outcome:{newlyCompleted:receipt.newlyCompleted},recordedAt:receipt.recordedAt}:null,error:null};
 }
 if(name==='lumen_commit_quest_command'){
  const prior=window.__canonicalReceipts.get(args.p_operation_id);
  if(prior&&!prior.request)return {data:null,error:{code:'22023'},status:400};
  if(prior&&JSON.stringify(prior.request.facts)!==JSON.stringify(args.p_facts))return {data:null,error:{code:'22023'},status:400};
  if(!prior){
   const {applyQuestVictory}=await import('/src/campaign/quest-victory.js');
   const {canonicalQuestById}=await import('/src/campaign/canonical-quests.js');
   const outcome=applyQuestVictory(window.__profile,canonicalQuestById(args.p_quest_id),args.p_facts);
   if(outcome.firstCompletion)window.__canonicalGrants++;
   window.__canonicalReceipts.set(args.p_operation_id,{request:{version:2,operationId:args.p_operation_id,questId:args.p_quest_id,facts:args.p_facts},outcome,recordedAt:new Date().toISOString()});
   sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));
  }
  sessionStorage.setItem('canonicalReceipts',JSON.stringify([...window.__canonicalReceipts]));sessionStorage.setItem('canonicalGrants',String(window.__canonicalGrants));
  return {data:{profile:structuredClone(window.__profile)},error:null};
 }
 if(name==='lumen_get_canonical_command')return {data:window.__canonicalReceipts.get(args.p_operation_id)??null,error:null};
 if(name==='lumen_commit_canonical_command'){
  const prior=window.__canonicalReceipts.get(args.p_operation_id);
  if(prior&&(prior.questId!==args.p_quest_id||JSON.stringify(prior.badges)!==JSON.stringify(args.p_badges)||JSON.stringify(prior.performance)!==JSON.stringify(args.p_performance)))return {data:null,error:{code:'22023',message:'operation evidence changed'},status:400};
  if(!prior){
   const {acknowledgeCanonicalVictory}=await import('/src/persistence/canonical-progress.js');
   const result=acknowledgeCanonicalVictory(window.__profile,args.p_quest_id,{badges:args.p_badges,performance:args.p_performance,stars:1});
   window.__profile=result.profile;if(result.newlyCompleted)window.__canonicalGrants++;
   sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));
   window.__canonicalReceipts.set(args.p_operation_id,{version:1,operationId:args.p_operation_id,questId:args.p_quest_id,badges:args.p_badges,performance:args.p_performance,newlyCompleted:result.newlyCompleted,recordedAt:new Date().toISOString()});
  }
  sessionStorage.setItem('canonicalReceipts',JSON.stringify([...window.__canonicalReceipts]));sessionStorage.setItem('canonicalGrants',String(window.__canonicalGrants));
  return {data:{profile:structuredClone(window.__profile),newlyCompleted:!prior},error:null};
 }
 if(name==='lumen_get_progress')return {data:Object.keys(window.__profile.solved).map(k=>({puzzle_id:Number(k)+1}))};
 return {data:[],error:null};
}}}};Object.defineProperty(window,'supabase',{value:window.supabase,writable:false,configurable:true});`;
async function until(expression){for(let i=0;i<120;i++){if(await evaluate(expression,true))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out '+expression+' '+JSON.stringify(await evaluate(`({message:document.getElementById('msg')?.textContent,guardians:lumenDiagnostics.snapshot().state.flat().filter(v=>v===2).length,diagnostics:localStorage.getItem('lumenCloudDiagnosticsV1'),status:document.getElementById('mobileAuthStatus')?.textContent,attempt:(()=>{const a=JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null');return a&&{questId:a.questId,state:a.state,mode:a.mode,startedAt:a.startedAt}})(),legacyIndex:lumenDiagnostics.snapshot().levelIndex,owner:localStorage.getItem('lumenCloudOwnerId'),localPerformances:lumenDiagnostics.snapshot().progress.performances})`)))}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase.co*']});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 await navigateAndWait({send,evaluate},'Page.navigate',{url:process.env.LUMEN_TEST_URL});
 await new Promise(r=>setTimeout(r,700));
 await until(`!!window.lumenDiagnostics&&JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
 await acknowledgeLearningMilestones(evaluate);
 await until(`document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')`);
 await evaluate(`document.getElementById('mobileAccount').click();document.getElementById('showAccountSyncDiagnostic').click()`);
 assert.equal(await evaluate(`document.getElementById('accountSyncDiagnosticSummary').textContent===document.getElementById('mobileAuthStatus').textContent&&document.getElementById('accountSyncDiagnosticSummary').getClientRects().length>0`),true,'Diagnostic displays the current verdict above the historical journal');
 await evaluate(`document.getElementById('closeAccountSyncDiagnostic').click();document.getElementById('mobileAccount').click()`);
 assert.equal(await evaluate(`(async()=>{const client=window.supabase.createClient();const expected=structuredClone(window.__profile);expected.xp++;return (await client.rpc('lumen_cas_profile',{p_expected:expected,p_payload:structuredClone(window.__profile)})).data;})()`,true),false,'Fixture CAS must reject a stale baseline exactly as PostgreSQL does');
 assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),next.reg,'Verified startup resumes Dauphin directly');
 await evaluate(`document.getElementById('openSky').click()`);
 const browsingBefore=await evaluate(`({snapshot:lumenDiagnostics.snapshot(),attempt:localStorage.getItem('lumenActiveAttemptV1')})`);
 await evaluate(`document.querySelector('#adventureRail [data-pack-id="${next.packId}"]').click();while(!document.querySelector('#sectorTabs [data-content-id="${next.constellationId}"]'))document.getElementById('constellationNext').click();document.querySelector('#sectorTabs [data-content-id="${next.constellationId}"]').click()`);
 await evaluate(`document.getElementById('constellationBack').click()`);
 assert.match(await evaluate(`document.querySelector('#sectorTabs [data-content-id="${next.constellationId}"]').getAttribute('aria-label')`),new RegExp('0/'+all.filter(q=>q.constellationId===next.constellationId).length+' étoiles'),'An unstarted canonical constellation has actual nonzero total');
 await evaluate(`document.querySelector('#sectorTabs [data-content-id="${next.constellationId}"]').click()`);
 const detailVisibility=()=>evaluate(`Object.fromEntries(['puzzleGrid','performanceLegend','skyCard'].map(id=>[id,document.getElementById(id).getClientRects().length>0]))`);
 assert.deepEqual(await detailVisibility(),{puzzleGrid:true,performanceLegend:true,skyCard:true},'Dauphin uses the standard quest grid, badge legend and constellation card');
 assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#puzzleGrid [data-quest-id]'),b=>b.dataset.questId)`),all.filter(q=>q.constellationId===next.constellationId).map(q=>q.id),'Dauphin shows exactly its catalogue quests');
 await evaluate('lumenDiagnostics.refreshSky()');
 assert.deepEqual(await detailVisibility(),{puzzleGrid:true,performanceLegend:true,skyCard:true},'Refresh retains the standard detail');
 assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#puzzleGrid [data-quest-id]'),b=>b.dataset.questId)`),all.filter(q=>q.constellationId===next.constellationId).map(q=>q.id),'Refresh cannot substitute Grand Chien quests');
 const dauphinLayouts=[];
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:viewport.width<700});
  const layout=await evaluate(`(()=>{const grid=document.getElementById('puzzleGrid'),cards=[...grid.querySelectorAll('.puzzle-card')];return {display:getComputedStyle(grid).display,cards:cards.map(b=>{const r=b.getBoundingClientRect();return {aspect:getComputedStyle(b).aspectRatio,width:r.width,height:r.height,inside:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight}}),stars:document.querySelector('#skyCard .sky-name').textContent,diagram:document.querySelectorAll('#skyCard .sky-star').length,diagramHeight:document.querySelector('#skyCard .sky-svg').getBoundingClientRect().height,locked:cards.slice(1).every(b=>b.disabled&&!!b.querySelector('.puzzle-lock-only')),current:!!cards[0].querySelector('.puzzle-new-icon'),panels:['performanceLegend','skyCard','openMyChallenges'].map(id=>{const r=document.getElementById(id).getBoundingClientRect(),sheet=document.querySelector('#mapModal .map-sheet').getBoundingClientRect();return {id,height:r.height,inside:r.top>=sheet.top&&r.bottom<=sheet.bottom&&r.bottom<=innerHeight}})}})()`);
  assert.equal(layout.display,'grid');assert(layout.cards.every(c=>c.inside),'Quest cards retain the standard layout inside the viewport: '+JSON.stringify(layout));
  dauphinLayouts.push({viewport,layout});
  assert(layout.panels.every(p=>p.inside&&p.height>20),'Standard detail panels fit inside the sheet: '+JSON.stringify(layout.panels));
  assert.equal(layout.stars,'Dauphin');assert(layout.diagram>0);assert(layout.diagramHeight>=80,'The constellation drawing stays legible');assert(layout.locked);assert(layout.current);
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(tmpdir(),'lumen-dauphin-detail-'+viewport.width+'.png'),Buffer.from(shot.data,'base64'));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 assert.deepEqual(await evaluate(`({snapshot:lumenDiagnostics.snapshot(),attempt:localStorage.getItem('lumenActiveAttemptV1')})`),browsingBefore,'Browsing Dauphin must preserve the live board, progression and attempt');
 await evaluate(`document.getElementById('constellationBack').click()`);
 assert.equal(await evaluate(`document.getElementById('mapDetail').getClientRects().length`),0,'Overview hides both quest detail panels');

 await evaluate(`document.querySelector('#adventureRail [data-pack-id="real-adventure-03"]').click();document.querySelector('#sectorTabs [data-content-id="real-24"]').click()`);
 assert.deepEqual(await detailVisibility(),{puzzleGrid:true,performanceLegend:true,skyCard:true},'Returning to Grand Chien restores only its legacy detail');
 for(const {viewport,layout} of dauphinLayouts){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:viewport.width<700});
  const reference=await evaluate(`(()=>{const r=document.querySelector('#puzzleGrid .puzzle-card').getBoundingClientRect();return {width:r.width,height:r.height,aspect:getComputedStyle(document.querySelector('#puzzleGrid .puzzle-card')).aspectRatio}})()`);
  assert.equal(reference.aspect,layout.cards[0].aspect);
  assert(Math.abs(reference.width-layout.cards[0].width)<2&&Math.abs(reference.height-layout.cards[0].height)<2,'Dauphin card dimensions match Grand Chien: '+JSON.stringify({viewport,reference,card:layout.cards[0]}));
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});

 await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${boundary.id}"]').click()`);
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`(document.getElementById('skyReveal').hidden?document.getElementById('successNew'):document.getElementById('skyRevealNext')).click()`);
 const actual=await evaluate(`({board:lumenDiagnostics.snapshot().puz.reg,status:document.getElementById('mobileAuthStatus').textContent,completed:!!lumenDiagnostics.snapshot().progress.canonicalQuestState[${JSON.stringify(next.id)}]?.solved})`);
 assert.deepEqual(actual.board,next.reg,'Actual authenticated next action must load Dauphin quest 241');assert.equal(actual.completed,false);
 await evaluate(`document.getElementById('attemptMask').click()`);
 const attemptBefore=await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1'))`);
 assert.equal(await evaluate(`document.getElementById('challengeBanner').hidden`),true,'Dauphin cannot display the old Grand Chien finale');
 assert.deepEqual(await evaluate(`lumenDiagnostics.snapshot().progress.performances`,true),{},'Canonical start writes no numeric performance');
 const dormantIndex=await evaluate('lumenDiagnostics.snapshot().levelIndex');
 // Simulate the previous producer at the actual dormant legacy index.
 await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem('lumenProgressV1'));p.performances[${dormantIndex}]={questIndex:${dormantIndex},lastQualifiedAt:'2026-10-20T08:45:02.000Z',lastQualifiedDay:'2026-10-20'};localStorage.setItem('lumenProgressV1',JSON.stringify(p));})()`);

 await navigateAndWait({send,evaluate},'Page.reload');await new Promise(r=>setTimeout(r,700));
 await until('!!window.lumenDiagnostics');
 const restored=await evaluate(`({board:lumenDiagnostics.snapshot().puz.reg,attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1'))})`);
 assert.deepEqual(restored.board,next.reg,'Reload must keep the next canonical constellation instead of returning to Grand Chien');
 assert.equal(restored.attempt.attemptId,attemptBefore.attemptId,'Reload must retain the started attempt identity');
 await until(`(()=>{const d=JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1'));const i=d.findLastIndex(e=>e.event==='canonical_start_metadata_archived');return i>=0&&d.slice(i+1).some(e=>e.event==='hydration_ready')})()`);
 assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('lumenProgressV1')).performances`,true),{});
 assert.equal(await evaluate(`Object.keys(localStorage).some(k=>k.startsWith('lumenBeforeCanonicalStartMetadataLocal_')&&JSON.parse(localStorage.getItem(k)).performances?.[${dormantIndex}]?.questIndex===${dormantIndex})`),true,'Keep original polluted bytes in a verified backup');

 await evaluate(`sessionStorage.setItem('grandChienOwner','other-synthetic')`);
 await navigateAndWait({send,evaluate},'Page.reload');await new Promise(r=>setTimeout(r,900));
 await until(`!!window.lumenDiagnostics&&localStorage.getItem('lumenCloudOwnerId')==='other-synthetic'`);
 const switched=await evaluate(`({attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')),backups:Object.keys(localStorage).filter(k=>k.startsWith('lumenBeforeAccountSwitchAttempt_')).map(k=>JSON.parse(localStorage.getItem(k)))})`);
 assert.ok(switched.backups.some(a=>a.attemptId===attemptBefore.attemptId),'The old owner retains the exact saved attempt in a verified backup');
 assert.notEqual(switched.attempt.attemptId,attemptBefore.attemptId,'The second account cannot inherit the old run');

 await until(`document.getElementById('mobileAuthAction').textContent==='D'+String.fromCharCode(233)+'connexion'&&document.getElementById('retryAccountSync').hidden===true`);
 // Signed-in controls appear before verified hydration; canonical access waits for it.
 await until(`document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')`);
 // Account switching must isolate the old attempt; explicitly enter the target
 // canonical quest through the new owner's sky before testing victory/resume.
 await evaluate(`document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${next.packId}"]').click();while(!document.querySelector('#sectorTabs [data-content-id="${next.constellationId}"]')){const nextPage=document.getElementById('constellationNext');if(nextPage.disabled)throw Error('Canonical fixture constellation not found');nextPage.click()}document.querySelector('#sectorTabs [data-content-id="${next.constellationId}"]').click();document.querySelector('#puzzleGrid [data-quest-id="${next.id}"]').click()`);
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('attemptMask').click()`);
 const beforeWin=await evaluate(`({xp:window.__profile.xp,legacy:JSON.stringify(window.__profile.solved),performances:JSON.stringify(window.__profile.performances),attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).attemptId,questId:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId})`);
 assert.equal(beforeWin.questId,next.id,'The second account must enter the canonical fixture before solving');
 // Persist a solved running board without rendering a victory, then cold-reload.
 // Auth is deliberately slower than board restoration (the reported phone sequence).
 await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();const solved=s.puz.reg.map(row=>row.map(()=>0));s.puz.sol.forEach((col,row)=>solved[row][col]=2);sessionStorage.setItem('solvedBoardOnLoad',JSON.stringify(solved));})()`);
 await navigateAndWait({send,evaluate},'Page.reload');
 await until(`!document.getElementById('skyReveal').hidden`);
 const afterWin=await evaluate(`({grants:window.__canonicalGrants,xp:window.__profile.xp,legacy:JSON.stringify(window.__profile.solved),performances:JSON.stringify(window.__profile.performances),saved:!!window.__profile.canonicalQuestState[${JSON.stringify(next.id)}]?.solved,attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).attemptId})`);
 assert.equal(await evaluate(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='canonical_victory_failed'&&e.stage==='context')`),false,'Startup session restoration is not a storage failure');
 assert.equal(afterWin.saved,true,JSON.stringify({beforeWin,afterWin}));assert.equal(afterWin.grants,1,'Concurrent render notifications grant once');
 assert.equal(afterWin.legacy,beforeWin.legacy);assert.equal(afterWin.performances,beforeWin.performances);assert.equal(afterWin.attempt,beforeWin.attempt);
 assert(afterWin.xp>beforeWin.xp);
 assert.equal(await evaluate(`document.getElementById('skyRevealResults').hidden`),false,'Confirmed canonical rewards must be visible during celebration');
 assert.equal(await evaluate(`document.querySelectorAll('#skyRevealRewards .success-reward').length>1`),true,'First canonical success celebrates its confirmed badges as well as its star');
 // Reproduce the old client's later capture under the same already committed ID.
 const regenerated=await evaluate(`(()=>{const attempt=JSON.parse(localStorage.getItem('lumenActiveAttemptV1'));attempt.state='RUNNING';attempt.activeDuration+=60000;const [receipt]=window.__canonicalReceipts.values();const request=receipt.request||receipt;const reward=request.version===2?{facts:{...request.facts,seconds:request.facts.seconds+60}}:{badges:receipt.badges,performance:{...receipt.performance,seconds:receipt.performance.seconds+60,bestTime:receipt.performance.bestTime+60},stars:1};const entry={version:2,userId:localStorage.getItem('lumenCloudOwnerId'),operationId:request.operationId,questId:request.questId,reward,createdAt:new Date().toISOString()};sessionStorage.setItem('recreatedCaptureOnLoad',JSON.stringify({attempt,entry}));return entry;})()`);
 await navigateAndWait({send,evaluate},'Page.reload');
 await until(`!document.getElementById('skyReveal').hidden`);
 assert.equal(await evaluate('window.__canonicalGrants'),1,'Restoring the original receipt never grants twice');
 assert.equal(await evaluate('window.__profile.xp'),afterWin.xp);
 const archive=await evaluate(`(async()=>{const {createIndexedOutboxStore}=await import('/src/persistence/indexed-outbox-store.js');const rows=await createIndexedOutboxStore(indexedDB).entries('lumenCanonicalRecreatedCaptureArchiveV1:');return rows.map(([,raw])=>JSON.parse(raw));})()`,true);
 assert(archive.some(record=>JSON.stringify(record.entry)===JSON.stringify(regenerated)),'Keep exact later capture bytes with the accepted receipt');
 assert.equal(await evaluate(`Object.keys(localStorage).some(key=>key.startsWith('lumenCanonicalVictoryOutboxV2:'))`),false);
 assert.equal(await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).attemptId`),beforeWin.attempt);
 assert.equal(await evaluate(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')).some(e=>e.event==='canonical_attempt_receipt_recovered')`),true);
 // Leave the old committed quest behind while its recognized duplicate is paused.
 const following=all.find(q=>q.ordinal===next.ordinal+1);
 await evaluate(`(document.getElementById('skyReveal').hidden?document.getElementById('successNew'):document.getElementById('skyRevealNext')).click()`);
 await until(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId===${JSON.stringify(following.id)}`);
 await evaluate(`document.getElementById('attemptMask').click();const d=lumenDiagnostics.snapshot();const cell=document.querySelectorAll('#board .cell')[d.puz.sol[0]];cell.click();cell.click()`);
 const active=await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1'))`);
 assert.equal(active.questId,following.id);assert.equal(active.board[0].filter(v=>v===2).length,1);
 const oldCapture={...regenerated,createdAt:new Date().toISOString()};
 await evaluate(`sessionStorage.setItem('recreatedCaptureOnLoad',JSON.stringify({attempt:${JSON.stringify(active)},entry:${JSON.stringify(oldCapture)},paused:true}))`);
 await navigateAndWait({send,evaluate},'Page.reload');
 await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')).some(e=>e.event==='canonical_queued_receipt_recovered')&&document.getElementById('retryAccountSync').hidden`);
 const resumed=await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1'))`);
 assert.equal(resumed.attemptId,active.attemptId);assert.equal(resumed.questId,following.id);assert.deepEqual(resumed.board,active.board);
 assert.equal(await evaluate('window.__canonicalGrants'),1);assert.equal(await evaluate('window.__profile.xp'),afterWin.xp);
 assert.equal(await evaluate(`!!window.__profile.canonicalQuestState[${JSON.stringify(following.id)}]?.solved`),false);
 // Earned canonical badges use the same four-slot cards; periodic legacy
 // cooldown refresh must never replace them with a dormant numeric quest.
 await evaluate(`document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${next.packId}"]').click();document.querySelector('#sectorTabs [data-content-id="${next.constellationId}"]').click()`);
 const expectedBadges=await evaluate(`Object.values(window.__profile.canonicalQuestState[${JSON.stringify(next.id)}].badges).filter(Boolean).length`);
 const earnedCount=()=>evaluate(`document.querySelectorAll('#puzzleGrid [data-quest-id="${next.id}"] .performance-slot.earned').length`);
 assert.equal(await earnedCount(),expectedBadges);assert(expectedBadges>0);
 assert.equal(await evaluate(`document.querySelectorAll('#puzzleGrid [data-quest-id="${next.id}"] .performance-slot').length`),4);
 assert.equal(await evaluate(`document.querySelector('#skyCard .sky-head').textContent.includes('1 / 10')`),true);
 await new Promise(resolve=>setTimeout(resolve,16000));
 assert.equal(await earnedCount(),expectedBadges,'Cooldown refresh preserves canonical badges');
 assert.equal(await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).attemptId`),active.attemptId);
 const earnedShot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(tmpdir(),'lumen-dauphin-detail-earned.png'),Buffer.from(earnedShot.data,'base64'));
 // Actual app and worker, native Cache API/IndexedDB and network disconnection.
 // Auth and server receipts remain synthetic: this is not physical Android QA.
 await evaluate(`document.getElementById('closeMap').click()`);
 await until(`(async()=>{const r=await navigator.serviceWorker.ready;return !!navigator.serviceWorker.controller&&!!(await caches.match('/__lumen_offline_ready_v14__'))})()`);
 assert.equal(await evaluate(`!!localStorage.getItem('lumenOfflineVerifiedOwnerV1')`),true);
 assert.equal(await evaluate(`(async()=>!!(await caches.match(location.href)))()`,true),true,'Public document is prepared before disconnection');
 await send('Network.setBypassServiceWorker',{bypass:false});
 await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 try{await navigateAndWait({send,evaluate},'Page.reload',{ignoreCache:false})}catch(error){throw Error(error.message+' '+JSON.stringify({errors,page:await evaluate(`({url:location.href,title:document.title,text:document.body?.innerText.slice(0,250)})`)}))}
 await until(`navigator.onLine===false&&!!document.querySelector('#board .cell')`);
 const offlineWins=[];
 for(let i=0;i<3;i++){
  if(i===2){await navigateAndWait({send,evaluate},'Page.reload');await until(`!document.getElementById('authLogout').hidden`)}
  await acknowledgeLearningMilestones(evaluate);
  if(i===0){
   await until(`!document.getElementById('authLogout').hidden`);
   await evaluate(`document.getElementById('verify').click();document.getElementById('verify').click()`);
   await until(`(async()=>{const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');return (await createDurableCanonicalVictoryOutbox(localStorage,{namespace:'Wallet'}).pending('other-synthetic')).length===1})()`);
   assert.equal(await evaluate(`lumenDiagnostics.snapshot().progress.shards`),3,'Offline aid reserves funds without changing the confirmed profile');
  }
  await evaluate(`(()=>{document.getElementById('attemptMask').click();const d=lumenDiagnostics.snapshot();const solved=d.puz.reg.map(row=>row.map(()=>0));d.puz.sol.forEach((col,row)=>solved[row][col]=2);lumenDiagnostics.setBoard(solved)})()`);
  await until(`document.getElementById('successOverlay').classList.contains('show')&&document.getElementById('successSub').textContent.includes('attente de confirmation')`);
  const id=await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId`);offlineWins.push(id);
  assert.equal(await evaluate(`!!window.__profile.canonicalQuestState[${JSON.stringify(id)}]?.solved`),false,'Offline win cannot manufacture a cloud acknowledgement');
  await evaluate(`document.getElementById('successNew').click()`);
  await until(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId!==${JSON.stringify(id)}`);
 }
 const offlineNext=await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId`);
 await navigateAndWait({send,evaluate},'Page.reload');
 await until(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId===${JSON.stringify(offlineNext)}`);
 assert.equal(await evaluate(`window.__canonicalGrants`),1,'No grants while disconnected');
 await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await until(`${JSON.stringify(offlineWins)}.every(id=>window.__profile.canonicalQuestState[id]?.solved)`);
 assert.equal(await evaluate(`window.__canonicalGrants`),4,'Reconnection grants each durable offline win once');
 await navigateAndWait({send,evaluate},'Page.reload');
 await until(`document.getElementById('retryAccountSync').hidden`);
 assert.equal(await evaluate(`window.__canonicalGrants`),4,'Reload does not replay rewards');
 assert.equal(await evaluate(`Number(sessionStorage.getItem('walletDebits'))`),1,'The offline paid aid is debited exactly once after reconnect');
 // Completed/partial canonical-only constellations use actual quest membership,
 // even when a historical numeric slot/drawing is absent. Read-only browsing
 // and refresh must preserve the running attempt and all reward balances.
 const completeGroup=all.filter(q=>q.constellationId===next.constellationId);
 const partialGroup=all.filter(q=>q.packId===next.packId&&q.constellationId!==next.constellationId&&q.legacyIndex===null).filter(q=>q.constellationId===all.find(q=>q.ordinal>completeGroup.at(-1).ordinal)?.constellationId);
 await evaluate(`(()=>{const p=JSON.parse(sessionStorage.getItem('grandChienFixture'));for(const q of ${JSON.stringify(completeGroup)})p.canonicalQuestState[q.id]={solved:true,stars:1,badges:{speed:true}};for(const q of ${JSON.stringify(partialGroup.slice(0,2))})p.canonicalQuestState[q.id]={solved:true,stars:1,badges:{speed:true}};sessionStorage.setItem('grandChienFixture',JSON.stringify(p));localStorage.setItem('lumenProgressV1',JSON.stringify(p))})()`);
 await navigateAndWait({send,evaluate},'Page.reload');
 await until(`document.getElementById('retryAccountSync').hidden`);
 const preserved=await evaluate(`JSON.stringify({progress:lumenDiagnostics.snapshot().progress,attempt:localStorage.getItem('lumenActiveAttemptV1')})`);
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:viewport.width<700});
  await evaluate(`document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${next.packId}"]').click();while(!document.querySelector('#sectorTabs [data-content-id="${next.constellationId}"]'))document.getElementById('constellationNext').click()`);
  const card=await evaluate(`(()=>{const c=document.querySelector('#sectorTabs [data-content-id="${next.constellationId}"]');return {label:c.getAttribute('aria-label'),complete:c.classList.contains('completed'),stars:c.querySelectorAll('.sky-star').length,lit:c.querySelectorAll('.sky-star.on').length,lines:c.querySelectorAll('.sky-line').length,litLines:c.querySelectorAll('.sky-line.on').length}})()`);
  assert.match(card.label,new RegExp(completeGroup.length+'/'+completeGroup.length+' étoiles.*Terminée'));
  assert.equal(card.complete,true);assert(card.stars>0);assert.equal(card.lit,card.stars);assert.equal(card.litLines,card.lines);
  const partial=await evaluate(`document.querySelector('#sectorTabs [data-content-id="${partialGroup[0].constellationId}"]').getAttribute('aria-label')`);
  assert.match(partial,new RegExp('2/'+partialGroup.length+' étoiles'));assert.doesNotMatch(partial,/Terminée/);
  await evaluate(`lumenDiagnostics.refreshSky();document.getElementById('closeMap').click()`);
 }
 assert.equal(await evaluate(`JSON.stringify({progress:lumenDiagnostics.snapshot().progress,attempt:localStorage.getItem('lumenActiveAttemptV1')})`),preserved,'Rendering cannot rewrite rewards or attempt data');
 assert.deepEqual(errors,[]);
 const report={authenticatedMobile:true,grandChienToDauphin:true,canonicalReload:true,attemptIdentityPreserved:true,accountSwitchIsolated:true,canonicalBannerIsolated:true,canonicalStartMetadataArchived:true,canonicalVictoryConfirmed:true,oneGrant:true,quest:next.ordinal,solvedBoardResumedAfterAuth:true,committedReceiptResumed:true,recreatedCaptureArchived:true,oldQuestRecoveryPreservesActiveBoard:true,canonicalRewardCelebration:true,offlineWins:3,offlineReload:true,offlinePaidAid:true,offlineWalletDebitOnce:true};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await send('Browser.close').catch(()=>{})}
