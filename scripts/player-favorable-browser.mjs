import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';

// Native application/hydration/DOM/storage, synthetic Auth and RPC only. The
// actual SQL merge/transactions have independent PostgreSQL fixture coverage.
export async function verifyPlayerFavorableRecovery({send,evaluate,navigate,url}){
 await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*supabase*']});
 const quests=canonicalQuestList().filter(q=>q.legacyIndex!==null),[left,right]=quests;
 const owner='favorable-native-fixture';
 const remote={solved:{[right.legacyIndex]:1},badges:{},shards:7,walletRevision:8,legacyVictoryRevision:3,
  xp:20,skyScore:0,skyHistoryVersion:4,daily:{},challenges:{},canonicalQuestState:{},
  performances:{[left.legacyIndex]:{time:50,bestTime:50,version:3,attempts:1,badges:{speed:true,mastery:false}}}};
 const local={...structuredClone(remote),solved:{[left.legacyIndex]:1},shards:99,walletRevision:7,
  badges:{first:1},oldUnknown:{preserve:true},performances:{[left.legacyIndex]:{
   time:37,bestTime:37,version:3,attempts:2,badges:{noError:true,mastery:false},oldRunMetadata:'archive'}}};
 await evaluate(`sessionStorage.removeItem('favorableServer');sessionStorage.removeItem('favorableLoads');localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(owner)});localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(local))});localStorage.removeItem('lumenCloudDiagnosticsV1');localStorage.removeItem('lumenActiveAttemptV1')`);
 const fixture=`
  const owner=${JSON.stringify(owner)};
  window.__favServer=JSON.parse(sessionStorage.getItem('favorableServer')||${JSON.stringify(JSON.stringify(remote))});
  sessionStorage.setItem('favorableLoads',String(Number(sessionStorage.getItem('favorableLoads')||0)+1));
  for(const key of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen','lumenSound'])localStorage.setItem(key,key==='lumenSound'?'off':'1');
  window.__favRecovery=0;window.__favCommands=0;
  const persist=()=>sessionStorage.setItem('favorableServer',JSON.stringify(__favServer));persist();
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),getUser:async()=>({data:{user:{id:owner}}}),onAuthStateChange:cb=>{window.__favAuth=cb;return {data:{subscription:{unsubscribe(){}}}}}},rpc:async(name,args={})=>{
   if(name==='lumen_restore_profile')return {data:structuredClone(__favServer)};
   if(name==='lumen_reconcile_acquisitions'){
    __favRecovery++;
    if(args.p_expected_user_id!==owner)return {error:{code:'42501'}};
    if(JSON.stringify(args.p_expected)!==JSON.stringify(__favServer))return {data:null};
    const l=args.p_local,id=${JSON.stringify(String(left.legacyIndex))};
    __favServer.solved={...__favServer.solved,...l.solved};__favServer.badges={...__favServer.badges,...l.badges};
    __favServer.performances[id]={...l.performances[id],badges:{...__favServer.performances[id].badges,...l.performances[id].badges}};
    delete __favServer.performances[id].oldRunMetadata;persist();
    return {data:{policy:'positive-acquisitions-v1',userId:owner,profile:structuredClone(__favServer)}};
   }
   if(name==='lumen_cas_profile'){
    if(JSON.stringify(args.p_expected)!==JSON.stringify(__favServer))return {data:false};
    __favServer=structuredClone(args.p_payload);persist();return {data:true};
   }
   if(name==='lumen_get_progress')return {data:Object.keys(__favServer.solved).map(k=>({puzzle_id:Number(k)+1}))};
   if(name==='lumen_get_daily')return {data:[]};if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
   if(name==='lumen_wallet_command_version')return {data:1};
   if(name.startsWith('lumen_commit_')){__favCommands++;return {error:{code:'PGRST003'},status:503}};
   return {data:[]};
  }})};
 `;
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 const until=async expression=>{for(let i=0;i<150;i++){
  if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));
 }throw Error('Favorable hydration timeout: '+expression+' '+await evaluate(`localStorage.getItem('lumenCloudDiagnosticsV1')`));};
 try{
  await navigate('Page.navigate',{url:url.href});
  await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='flush_success')`);
  assert.equal(await evaluate(`sessionStorage.getItem('favorableLoads')`),'1','Conflict resolves without document reload');
  assert.equal(await evaluate('__favRecovery'),1);assert.equal(await evaluate('__favCommands'),0,'No new victory or money command');
  const progress=await evaluate('lumenDiagnostics.snapshot().progress');
  assert(progress.solved[left.legacyIndex]&&progress.solved[right.legacyIndex]);
  assert.equal(progress.shards,7);assert.equal(progress.performances[left.legacyIndex].bestTime,37);
  assert.equal(progress.performances[left.legacyIndex].badges.speed,true);
  assert.equal(progress.performances[left.legacyIndex].badges.noError,true);
  assert.equal(progress.performances[left.legacyIndex].badges.mastery,false);
  assert.equal(await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('lumenBeforeCloudReconcileLocal_')).some(k=>JSON.parse(localStorage.getItem(k)).oldUnknown?.preserve)`),true);
  await evaluate(`__favAuth('TOKEN_REFRESHED',{user:{id:${JSON.stringify(owner)}}})`);
  await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready'&&e.details?.profileReady||e.event==='hydration_ready'&&e.profileReady)`);
  assert.equal(await evaluate('__favRecovery'),1,'Token renewal does not repeat a converged recovery');
  await evaluate(`localStorage.setItem('lumenProgressV1',JSON.stringify(__favServer))`);
  await navigate('Page.reload');
  await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
  const restored=await evaluate('lumenDiagnostics.snapshot().progress');
  assert(restored.solved[left.legacyIndex]&&restored.solved[right.legacyIndex]);assert.equal(restored.shards,7);
  assert.equal(await evaluate('__favCommands'),0);
  return {nativeHydration:true,noConflictReload:true,noNewVictory:true,scheduledFlush:true,tokenRefresh:true,reload:true,originalsPreserved:true,confirmedSpending:true,simulatedRpc:true};
 }finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier});}
}
