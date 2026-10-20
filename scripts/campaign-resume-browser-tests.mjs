import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
const {send,evaluate,errors}=await connectBrowser();
const all=canonicalQuestList(),boundary=all.find(q=>q.id==='planned-real-24-q10'),next=all.find(q=>q.ordinal===boundary.ordinal+1);
const done=all.filter(q=>q.ordinal<=boundary.ordinal),solved=Object.fromEntries(done.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1]));
const profile={solved,historyBackup:solved,badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:Object.fromEntries(done.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{}}])),daily:{dates:{},rewards:{}},challenges:{},xp:1000,shards:3,skyScore:298,skyHistoryVersion:4};
const fixture=`localStorage.setItem('lumenSound','off');if(!sessionStorage.getItem('grandChienFixture')){localStorage.setItem('lumenCloudOwnerId','synthetic-frontier');localStorage.setItem('lumenProgressV1',JSON.stringify(${JSON.stringify(profile)}));sessionStorage.setItem('grandChienFixture',JSON.stringify(${JSON.stringify(profile)}));}
window.__profile=JSON.parse(sessionStorage.getItem('grandChienFixture'));window.__canonicalReceipts=new Map();window.__canonicalGrants=0;
window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:sessionStorage.getItem('grandChienOwner')||'synthetic-frontier'}}}}),onAuthStateChange(){}},rpc:async(name,args)=>{
 if(name==='lumen_restore_profile')return {data:structuredClone(window.__profile)};
 if(name==='lumen_cas_profile'){if(JSON.stringify(args.p_payload.performances||{})!==JSON.stringify(window.__profile.performances||{}))return {data:null,error:{code:'22023',message:'legacy victory command required; preserve pending data and update client'}};window.__profile=structuredClone(args.p_payload);sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));return {data:true}};
 if(name==='lumen_canonical_command_version')return {data:1,error:null};
 if(name==='lumen_get_canonical_command')return {data:window.__canonicalReceipts.get(args.p_operation_id)??null,error:null};
 if(name==='lumen_commit_canonical_command'){
  const prior=window.__canonicalReceipts.get(args.p_operation_id);
  if(!prior){
   const {acknowledgeCanonicalVictory}=await import('/src/persistence/canonical-progress.js');
   const result=acknowledgeCanonicalVictory(window.__profile,args.p_quest_id,{badges:args.p_badges,performance:args.p_performance,stars:1});
   window.__profile=result.profile;if(result.newlyCompleted)window.__canonicalGrants++;
   sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));
   window.__canonicalReceipts.set(args.p_operation_id,{version:1,operationId:args.p_operation_id,questId:args.p_quest_id,badges:args.p_badges,performance:args.p_performance,newlyCompleted:result.newlyCompleted,recordedAt:new Date().toISOString()});
  }
  return {data:{profile:structuredClone(window.__profile),newlyCompleted:!prior},error:null};
 }
 if(name==='lumen_get_progress')return {data:Object.keys(window.__profile.solved).map(k=>({puzzle_id:Number(k)+1}))};
 return {data:[],error:null};
}}}};`;
async function until(expression){for(let i=0;i<120;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out '+expression+' '+JSON.stringify(await evaluate(`({diagnostics:localStorage.getItem('lumenCloudDiagnosticsV1'),status:document.getElementById('mobileAuthStatus')?.textContent,attempt:(()=>{const a=JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null');return a&&{questId:a.questId,state:a.state,mode:a.mode,startedAt:a.startedAt}})(),legacyIndex:lumenDiagnostics.snapshot().levelIndex,owner:localStorage.getItem('lumenCloudOwnerId'),localPerformances:lumenDiagnostics.snapshot().progress.performances})`)))}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase*']});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 await navigateAndWait({send,evaluate},'Page.navigate',{url:process.env.LUMEN_TEST_URL});
 await new Promise(r=>setTimeout(r,700));
 await until(`!!window.lumenDiagnostics&&JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
 await acknowledgeLearningMilestones(evaluate);
 assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),next.reg,'Verified startup resumes Dauphin directly');
 await evaluate(`document.getElementById('openSky').click()`);
 await evaluate(`document.querySelector('#adventureRail [data-pack-id="real-adventure-03"]').click();document.querySelector('#sectorTabs [data-content-id="real-24"]').click()`);
 await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${boundary.id}"]').click()`);
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('successNew').click()`);
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
 await evaluate(`document.getElementById('attemptMask').click()`);
 const beforeWin=await evaluate(`({xp:window.__profile.xp,legacy:JSON.stringify(window.__profile.solved),performances:JSON.stringify(window.__profile.performances),attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).attemptId})`);
 await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();const solved=s.puz.reg.map(row=>row.map(()=>0));s.puz.sol.forEach((col,row)=>solved[row][col]=2);lumenDiagnostics.setBoard(solved);lumenDiagnostics.setBoard(solved);})()`);
 await until(`document.getElementById('successOverlay').classList.contains('show')`);
 const afterWin=await evaluate(`({grants:window.__canonicalGrants,xp:window.__profile.xp,legacy:JSON.stringify(window.__profile.solved),performances:JSON.stringify(window.__profile.performances),saved:!!window.__profile.canonicalQuestState[${JSON.stringify(next.id)}]?.solved,attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).attemptId})`);
 assert.equal(afterWin.saved,true);assert.equal(afterWin.grants,1,'Concurrent render notifications grant once');
 assert.equal(afterWin.legacy,beforeWin.legacy);assert.equal(afterWin.performances,beforeWin.performances);assert.equal(afterWin.attempt,beforeWin.attempt);
 assert(afterWin.xp>beforeWin.xp);
 assert.deepEqual(errors,[]);
 const report={authenticatedMobile:true,grandChienToDauphin:true,canonicalReload:true,attemptIdentityPreserved:true,accountSwitchIsolated:true,canonicalBannerIsolated:true,canonicalStartMetadataArchived:true,canonicalVictoryConfirmed:true,oneGrant:true,quest:next.ordinal,automaticCompletion:false};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await send('Browser.close').catch(()=>{})}
