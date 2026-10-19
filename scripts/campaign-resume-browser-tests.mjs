import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
const {send,evaluate,errors}=await connectBrowser();
const all=canonicalQuestList(),boundary=all.find(q=>q.id==='planned-real-24-q10'),next=all.find(q=>q.ordinal===boundary.ordinal+1);
const done=all.filter(q=>q.ordinal<=boundary.ordinal),solved=Object.fromEntries(done.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1]));
const profile={solved,historyBackup:solved,badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:Object.fromEntries(done.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{}}])),daily:{dates:{},rewards:{}},challenges:{},xp:1000,shards:3,skyScore:298,skyHistoryVersion:4};
const fixture=`localStorage.setItem('lumenSound','off');if(!sessionStorage.getItem('grandChienFixture')){localStorage.setItem('lumenCloudOwnerId','synthetic-frontier');localStorage.setItem('lumenProgressV1',JSON.stringify(${JSON.stringify(profile)}));sessionStorage.setItem('grandChienFixture',JSON.stringify(${JSON.stringify(profile)}));}
window.__profile=JSON.parse(sessionStorage.getItem('grandChienFixture'));
window.supabase={createClient(){return {auth:{getSession:async()=>({data:{session:{user:{id:sessionStorage.getItem('grandChienOwner')||'synthetic-frontier'}}}}),onAuthStateChange(){}},rpc:async(name,args)=>{
 if(name==='lumen_restore_profile')return {data:structuredClone(window.__profile)};
 if(name==='lumen_cas_profile'){window.__profile=structuredClone(args.p_payload);sessionStorage.setItem('grandChienFixture',JSON.stringify(window.__profile));return {data:true}};
 if(name==='lumen_get_progress')return {data:Object.keys(window.__profile.solved).map(k=>({puzzle_id:Number(k)+1}))};
 return {data:[],error:null};
}}}};`;
async function until(expression){for(let i=0;i<120;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out '+expression+' '+JSON.stringify(await evaluate(`({diagnostics:localStorage.getItem('lumenCloudDiagnosticsV1'),status:document.getElementById('mobileAuthStatus')?.textContent})`)))}
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
 await navigateAndWait({send,evaluate},'Page.reload');await new Promise(r=>setTimeout(r,700));
 await until('!!window.lumenDiagnostics');
 const restored=await evaluate(`({board:lumenDiagnostics.snapshot().puz.reg,attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1'))})`);
 assert.deepEqual(restored.board,next.reg,'Reload must keep the next canonical constellation instead of returning to Grand Chien');
 assert.equal(restored.attempt.attemptId,attemptBefore.attemptId,'Reload must retain the started attempt identity');
 await evaluate(`sessionStorage.setItem('grandChienOwner','other-synthetic')`);
 await navigateAndWait({send,evaluate},'Page.reload');await new Promise(r=>setTimeout(r,900));
 await until(`!!window.lumenDiagnostics&&localStorage.getItem('lumenCloudOwnerId')==='other-synthetic'`);
 const switched=await evaluate(`({attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')),backups:Object.keys(localStorage).filter(k=>k.startsWith('lumenBeforeAccountSwitchAttempt_')).map(k=>JSON.parse(localStorage.getItem(k)))})`);
 assert.ok(switched.backups.some(a=>a.attemptId===attemptBefore.attemptId),'The old owner retains the exact saved attempt in a verified backup');
 assert.notEqual(switched.attempt.attemptId,attemptBefore.attemptId,'The second account cannot inherit the old run');
 assert.deepEqual(errors,[]);
 const report={authenticatedMobile:true,grandChienToDauphin:true,canonicalReload:true,attemptIdentityPreserved:true,accountSwitchIsolated:true,quest:next.ordinal,automaticCompletion:false};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await send('Browser.close').catch(()=>{})}
