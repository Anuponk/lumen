import assert from 'node:assert/strict';
import {acknowledgeLearningMilestones} from './cdp-client.mjs';

// Runs inside the existing isolated account browser suite. Auth/RPC are fully
// simulated; real DOM, native modules, localStorage and IndexedDB are exercised.
export async function verifyWalletAndOfflineFlow({send,evaluate,navigate,url}){
 const owner='00000000-0000-0000-0000-000000008188';
 const source=`
 const owner=${JSON.stringify(owner)};
 const saved=JSON.parse(sessionStorage.getItem('walletFixtureServer')||'null');
 const solved=Object.fromEntries(Array.from({length:20},(_,i)=>[i,1]));
 window.__walletServer=saved||{profile:{solved,historyBackup:{...solved},badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:{},
  xp:100,shards:10,skyScore:20,skyHistoryVersion:4,daily:{dates:{},rewards:{}},challenges:{},walletRevision:1},receipts:[],legacy:[],debits:0};
 const persist=()=>sessionStorage.setItem('walletFixtureServer',JSON.stringify(window.__walletServer));
 if(!saved){localStorage.setItem('lumenCloudOwnerId',owner);localStorage.setItem('lumenProgressV1',JSON.stringify(window.__walletServer.profile));localStorage.removeItem('lumenActiveAttemptV1');persist()}
 for(const key of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSound'])localStorage.setItem(key,key==='lumenSound'?'off':'1');
 window.__walletLoseReply=false;window.__walletHideReceipt=false;window.__offlineVictory=false;
 window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),
  getUser:async()=>({data:{user:{id:owner}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc:async(name,args={})=>{
   const server=window.__walletServer,p=server.profile;
   if(name==='lumen_restore_profile')return {data:structuredClone(p)};
   if(name==='lumen_wallet_command_version'||name==='lumen_legacy_command_version')return {data:1};
   if(name==='lumen_get_progress')return {data:Object.keys(p.solved).filter(k=>p.solved[k]).map(k=>({puzzle_id:Number(k)+1}))};
   if(name==='lumen_get_daily')return {data:Object.keys(p.daily.dates||{}).map(play_date=>({play_date}))};
   if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
   if(name==='lumen_cas_profile'){
    if(JSON.stringify(args.p_expected)!==JSON.stringify(p)||args.p_payload.shards!==p.shards||args.p_payload.walletRevision!==p.walletRevision)return {data:false};
    server.profile=structuredClone(args.p_payload);persist();return {data:true};
   }
   if(name==='lumen_get_wallet_command')return {data:window.__walletHideReceipt?null:server.receipts.find(r=>r.operationId===args.p_operation_id)||null};
   if(name==='lumen_commit_wallet_command'){
    if(args.p_expected_user_id!==owner)return {error:{code:'42501'}};
    let r=server.receipts.find(r=>r.operationId===args.p_operation_id);
    if(!r){const cost=args.p_request.kind==='hint'&&args.p_request.sequence>1?2:1;
     if(p.shards<cost)return {error:{code:'P0001'}};
     p.shards-=cost;p.walletRevision++;server.debits++;
     r={version:1,operationId:args.p_operation_id,request:args.p_request,cost,revision:p.walletRevision,balance:p.shards,balanceDelta:-cost};server.receipts.push(r);persist();
    }
    if(window.__walletLoseReply)throw Error('simulated lost wallet response');return {data:r};
   }
   if(name==='lumen_get_legacy_command')return {data:server.legacy.find(r=>r.request.operationId===args.p_operation_id)||null};
   if(name==='lumen_commit_legacy_command'){
    if(window.__offlineVictory)return {error:{code:'08006'},status:503};
    let r=server.legacy.find(r=>r.request.operationId===args.p_operation_id);
    if(!r){const {legacyVictoryRules,applyLegacyVictory}=await import('/src/campaign/legacy-victory.js');
     const q=legacyVictoryRules().find(q=>q.questId===args.p_quest_id);const outcome=applyLegacyVictory(p,q.index,args.p_facts);
     outcome.attempts=p.performances[q.index].attempts;p.legacyVictoryRevision=(p.legacyVictoryRevision||0)+1;p.walletRevision++;
     r={request:{version:1,operationId:args.p_operation_id,questId:args.p_quest_id,facts:args.p_facts},outcome,recordedAt:new Date().toISOString()};server.legacy.push(r);persist();
    }return {data:{profile:structuredClone(p),...r}};
   }
   if(name==='lumen_canonical_command_version')return {error:{code:'PGRST202'},status:404};
   return {data:[]};
  }})};
 `;
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source});
 const until=async(expression)=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}throw Error('Wallet browser timeout: '+expression)};
 const click=async id=>{
  await evaluate(`document.getElementById(${JSON.stringify(id)}).scrollIntoView({block:'center',behavior:'instant'})`);
  await until(`(()=>{const e=document.getElementById(${JSON.stringify(id)}),r=e.getBoundingClientRect();for(let p=e;p;p=p.parentElement){if(p.getAnimations().some(a=>a.playState==='running'&&Number.isFinite(a.effect.getComputedTiming().endTime)))return false}return !e.disabled&&r.width>0&&r.height>0&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e})()`);
  const point=await evaluate(`(()=>{const r=document.getElementById(${JSON.stringify(id)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 };
 try{
  await evaluate(`sessionStorage.removeItem('walletFixtureServer');localStorage.removeItem('lumenActiveAttemptV1')`);
  await navigate('Page.navigate',{url:url.href});
  await until(`window.lumenDiagnostics&&document.getElementById('mobileAuthAction').textContent==='Déconnexion'`);
  await until(`document.getElementById('authUser').textContent==='Progression synchronisée'`);
  await evaluate(`lumenDiagnostics.setupQuest(20);document.getElementById('attemptMask').click()`);
  await acknowledgeLearningMilestones(evaluate);
  await click('hint');assert.equal(await evaluate('__walletServer.debits'),0);
  await evaluate('__walletLoseReply=true');await click('hint');
  await until('__walletServer.debits===1 && lumenDiagnostics.snapshot().progress.shards===9');
  await evaluate('__walletLoseReply=false;__walletHideReceipt=true');await click('hint');
  await until('__walletServer.debits===2');
  await navigate('Page.reload');
  await until(`window.lumenDiagnostics&&lumenDiagnostics.snapshot().progress.shards===7`);
  await until(`document.getElementById('authUser').textContent==='Progression synchronisée'`);
  await evaluate(`document.getElementById('attemptMask').click()`);await click('hint');
  await until(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).helpUses.hint===3`);
  assert.equal(await evaluate('__walletServer.debits'),2,'The interrupted hint reuses its receipt after restart');
  await evaluate('__offlineVictory=true');
  const solve=`(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`;
  await evaluate(solve);
  await until(`document.getElementById('successOverlay').classList.contains('show')&&document.getElementById('successSub').textContent.includes('en attente')`);
  assert.equal(await evaluate(`!!document.getElementById('cloudRewardPending')`),false);
  assert.equal(await evaluate('__walletServer.profile.solved[20]||false'),false,'A pending animation is not a server reward');
  await click('successNew');await until('lumenDiagnostics.snapshot().levelIndex===21');
  await evaluate(`document.getElementById('attemptMask').click()`);await evaluate(solve);
  await until(`document.getElementById('successOverlay').classList.contains('show')&&document.getElementById('successSub').textContent.includes('en attente')`);
  await click('successRetry');
  await until('__walletServer.legacy.length===2');
  await until(`document.getElementById('authUser').textContent==='Progression synchronisée'`);
  assert.equal(await evaluate(`document.getElementById('cloudSyncStatus')?.hidden!==false`),true,'Restart must not recapture an acknowledged victory as pending');
  assert.equal(await evaluate('__walletServer.debits'),2);
  assert.equal(await evaluate('!!__walletServer.profile.solved[20]&&!!__walletServer.profile.solved[21]'),true);
  return {lostSpendResponse:true,restartReceiptRecovery:true,twoOfflineVictories:true,nonBlockingCelebration:true,simulatedRpc:true};
 }catch(error){
  try{error.message+=' '+JSON.stringify(await evaluate(`(()=>{const d=JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]');return {level:window.lumenDiagnostics?.snapshot().levelIndex,shards:window.lumenDiagnostics?.snapshot().progress.shards,debits:window.__walletServer?.debits,legacy:window.__walletServer?.legacy.length,offline:window.__offlineVictory,serverShards:window.__walletServer?.profile.shards,overlay:document.getElementById('successOverlay')?.className,events:(Array.isArray(d)?d:d.entries||[]).slice(-8).map(e=>({event:e.event,stage:e.stage,reason:e.reason}))}})()`))}catch{}
  throw error;
 }finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
}
