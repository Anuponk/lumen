import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
import {learningStep} from '../src/game/learning.js';
import {nextCanonicalQuest} from '../src/campaign/playable-navigation.js';
import {readQuestView} from '../src/campaign/quest-view.js';
import {CONTENT_CONSTELLATIONS} from '../src/campaign/content.js';
import {baseCampaignQuestCount,preserveStartedAdventureAccess} from '../src/campaign/content.js';
import {SKY_TARGET} from '../src/campaign/data.js';

// Native application/hydration/DOM/storage, synthetic Auth and RPC only. The
// actual SQL merge/transactions have independent PostgreSQL fixture coverage.
export async function verifyPlayerFavorableRecovery({send,evaluate,navigate,url,loseReply=false,guestStarted=false,historicalFrontier=false}){
 await send('Page.enable');await send('Runtime.enable');
 await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*supabase*']});
 // The preceding claim/quota suite deliberately uses a second origin. Prepare
 // this fixture on the application's origin, without booting an unmocked app.
 await navigate('Page.navigate',{url:new URL('/scripts/fixtures/storage-quota.html',url).href});
 const quests=canonicalQuestList().filter(q=>q.legacyIndex!==null),[left,right]=quests;
 const owner='favorable-native-fixture';
 await evaluate(`sessionStorage.removeItem('favorableGuestStart')`);
 const remote={solved:{[right.legacyIndex]:1},badges:{},stars:{},shards:7,walletRevision:8,legacyVictoryRevision:3,
  xp:20,skyScore:0,skyHistoryVersion:4,daily:{},challenges:{},canonicalQuestState:{},
  performances:{[left.legacyIndex]:{time:50,bestTime:50,version:3,attempts:1,badges:{speed:true,mastery:false}}}};
 const local={...structuredClone(remote),solved:{[left.legacyIndex]:1},shards:99,walletRevision:7,
  badges:{first:1},oldUnknown:{preserve:true},performances:{[left.legacyIndex]:{
   time:37,bestTime:37,version:3,attempts:2,badges:{noError:true,mastery:false},oldRunMetadata:'archive'}}};
 const ownedRun={attemptId:'owned-started-run',questId:right.legacyIndex+1,mode:'campaign',state:'PAUSED',startedAt:123,activeDuration:1000,board:right.reg.map(row=>row.map(()=>0)),qualifying:true};
 // Lost-response recovery deliberately requires an idle run: the production
 // retry scheduler conserves active/paused attempts instead of hydrating over
 // them. Other variants exercise preservation of a genuinely started run.
 const initialAttempt=loseReply?null:JSON.stringify(ownedRun);
 await evaluate(`sessionStorage.removeItem('favorableServer');sessionStorage.removeItem('favorableLoads');localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(owner)});localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(local))});localStorage.removeItem('lumenCloudDiagnosticsV1');${initialAttempt===null?"localStorage.removeItem('lumenActiveAttemptV1')":"localStorage.setItem('lumenActiveAttemptV1',"+JSON.stringify(initialAttempt)+")"}`);
 const fixture=`
  const owner=${JSON.stringify(owner)};
  window.__favServer=JSON.parse(sessionStorage.getItem('favorableServer')||${JSON.stringify(JSON.stringify(remote))});
  window.__favGuestStart=sessionStorage.getItem('favorableGuestStart')==='1';
  sessionStorage.setItem('favorableLoads',String(Number(sessionStorage.getItem('favorableLoads')||0)+1));
  for(const key of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen','lumenIntroPresentedV1','lumenSound'])localStorage.setItem(key,key==='lumenSound'?'off':'1');
  window.__favRecovery=0;window.__favCommands=0;window.__favRightsReads=0;window.__favLoseReply=${JSON.stringify(loseReply)};
  const persist=()=>sessionStorage.setItem('favorableServer',JSON.stringify(__favServer));persist();
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:__favGuestStart?null:{user:{id:owner}}}}),getUser:async()=>({data:{user:{id:owner}}}),onAuthStateChange:cb=>{window.__favAuth=cb;return {data:{subscription:{unsubscribe(){}}}}}},rpc:async(name,args={})=>{
   if(name==='lumen_restore_profile'){window.__favAttemptBeforeHydration=localStorage.getItem('lumenActiveAttemptV1');return {data:structuredClone(__favServer)};}
   if(name==='lumen_reconcile_acquisitions'){
    __favRecovery++;
    if(args.p_expected_user_id!==owner)return {error:{code:'42501'}};
    if(JSON.stringify(args.p_expected)!==JSON.stringify(__favServer))return {data:null};
    const l=args.p_local,id=${JSON.stringify(String(left.legacyIndex))};
    __favServer.solved={...__favServer.solved,...l.solved};__favServer.badges={...__favServer.badges,...l.badges};
    if(l.performances?.[id]){
     __favServer.performances[id]={...l.performances[id],badges:{...__favServer.performances[id].badges,...l.performances[id].badges}};
     delete __favServer.performances[id].oldRunMetadata;
    }persist();
    if(__favLoseReply){__favLoseReply=false;throw TypeError('simulated response loss after recovery commit');}
    return {data:{policy:'positive-acquisitions-v1',userId:owner,profile:structuredClone(__favServer)}};
   }
   if(name==='lumen_cas_profile'){
    if(JSON.stringify(args.p_expected)!==JSON.stringify(__favServer))return {data:false};
    __favServer=structuredClone(args.p_payload);persist();return {data:true};
   }
   if(name==='lumen_get_progress')return {data:Object.keys(__favServer.solved).map(k=>({puzzle_id:Number(k)+1}))};
   if(name==='lumen_get_daily')return {data:[]};if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
   if(name==='lumen_wallet_command_version')return {data:1};
   if(name==='lumen_get_internal_capabilities'){__favRightsReads++;return {data:[]};}
   if(name.startsWith('lumen_commit_')){__favCommands++;return {error:{code:'PGRST003'},status:503}};
   return {data:[]};
  }})};
 `;
 const compiled=await send('Runtime.compileScript',{expression:fixture,sourceURL:'player-favorable-fixture',persistScript:false});
 assert.equal(compiled.exceptionDetails,undefined,JSON.stringify(compiled.exceptionDetails));
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 const until=async expression=>{for(let i=0;i<150;i++){
  if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100));
 }throw Error('Favorable hydration timeout: '+expression+' '+await evaluate(`localStorage.getItem('lumenCloudDiagnosticsV1')`));};
 try{
  await navigate('Page.navigate',{url:url.href});
  await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='flush_success')`);
  assert.equal(await evaluate(`sessionStorage.getItem('favorableLoads')`),'1','Conflict resolves without document reload');
  const expectedRecoveries=loseReply?2:1;
  assert.equal(await evaluate('__favRecovery'),expectedRecoveries);assert.equal(await evaluate('__favCommands'),0,'No new victory or money command');
  const progress=await evaluate('lumenDiagnostics.snapshot().progress');
  assert(progress.solved[left.legacyIndex]&&progress.solved[right.legacyIndex]);
  assert.equal(progress.shards,7);assert.equal(progress.performances[left.legacyIndex].bestTime,37);
  assert.equal(progress.performances[left.legacyIndex].badges.speed,true);
  assert.equal(progress.performances[left.legacyIndex].badges.noError,true);
  assert.equal(progress.performances[left.legacyIndex].badges.mastery,false);
  assert.equal(await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('lumenBeforeCloudReconcileLocal_')).some(k=>JSON.parse(localStorage.getItem(k)).oldUnknown?.preserve)`),true);
  const rightsReads=await evaluate('__favRightsReads');
  const ownedBoard=await evaluate(`({id:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).attemptId,state:lumenDiagnostics.snapshot().state,label:document.getElementById('campaignMapLabel').textContent})`);
  await evaluate(`localStorage.removeItem('lumenCloudDiagnosticsV1');__favAuth('TOKEN_REFRESHED',{user:{id:${JSON.stringify(owner)}}})`);
  await until(`__favRightsReads>${rightsReads}`);
  assert.equal(await evaluate(`document.getElementById('mobileAuthStatus').textContent.includes('synchronisée')`),true);
  assert.equal(await evaluate('__favRecovery'),expectedRecoveries,'Token renewal does not repeat a converged recovery');
  assert.deepEqual(await evaluate(`({id:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).attemptId,state:lumenDiagnostics.snapshot().state,label:document.getElementById('campaignMapLabel').textContent})`),ownedBoard,'Same-owner hydration preserves the selected board and run');
  // A second device starts without the old cache. Model that independent cache
  // against the same persisted synthetic server, then let normal restore run.
  const serverBefore=await evaluate('JSON.stringify(__favServer)');
  await evaluate(`localStorage.clear();localStorage.setItem('lumenProgressV1',JSON.stringify({solved:{},badges:{},xp:0,shards:3,catalogueOrigin:${JSON.stringify(currentCatalogueOrigin)}}))`);
  if(guestStarted)await evaluate(`sessionStorage.setItem('favorableGuestStart','1')`);
  await navigate('Page.reload');
  let guestRaw,guestAttempt;
  if(guestStarted){
   await until(`typeof __favAuth==='function'&&!!window.lumenDiagnostics&&document.querySelectorAll('#board .cell').length>0`);
   for(let step=0;step<12&&await evaluate(`document.getElementById('board').dataset.learningStage==='intro'`);step++){
    await evaluate(`document.getElementById('learningCoachNext').click()`);
   }
   const snapshot=await evaluate('lumenDiagnostics.snapshot()'),[row,col]=learningStep(snapshot.puz,snapshot.state).cells[0];
   const target=await evaluate(`(()=>{const cell=document.querySelector('#board .cell[data-row="${row}"][data-col="${col}"]');cell.scrollIntoView({block:'center'});const r=cell.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
   await send('Input.dispatchMouseEvent',{type:'mousePressed',...target,button:'left',clickCount:1});
   await send('Input.dispatchMouseEvent',{type:'mouseReleased',...target,button:'left',clickCount:1});
   await until(`Object.keys(JSON.parse(localStorage.getItem('lumenProgressV1')).performances||{}).length===1`);
   guestRaw=await evaluate(`localStorage.getItem('lumenProgressV1')`);guestAttempt=await evaluate(`localStorage.getItem('lumenActiveAttemptV1')`);
   const start=Object.values(JSON.parse(guestRaw).performances)[0];
   assert.deepEqual(Object.keys(start).sort(),['lastQualifiedAt','lastQualifiedDay','questIndex']);
   assert(guestAttempt,'The real first gesture persisted an active guest attempt');
   await evaluate(`sessionStorage.removeItem('favorableGuestStart');__favGuestStart=false;__favAuth('SIGNED_IN',{user:{id:${JSON.stringify(owner)}}})`);
  }
  await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
  const restored=await evaluate('lumenDiagnostics.snapshot().progress');
  assert(restored.solved[left.legacyIndex]&&restored.solved[right.legacyIndex]);assert.equal(restored.shards,7);
  assert.equal(await evaluate(`localStorage.getItem('lumenCloudOwnerId')`),owner);
  assert.equal(await evaluate('JSON.stringify(__favServer)'),serverBefore,'A virgin browser restores without changing the cloud or minting its starter reserve');
  assert.equal(await evaluate('__favCommands'),0);
  const frontier=nextCanonicalQuest(restored.solved,restored.canonicalQuestState,[],restored);
  assert.equal(frontier.status,'ready');
  const selected=await evaluate(`({attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')),snapshot:lumenDiagnostics.snapshot(),label:document.getElementById('campaignMapLabel').textContent})`);
  assert.equal(selected.attempt.questId,frontier.quest.legacyIndex===null?frontier.quest.id:frontier.quest.legacyIndex+1,'Verified account restoration must select its frontier without opening Mon ciel');
  assert.deepEqual(selected.snapshot.puz.reg,frontier.quest.reg,'Displayed label and board must describe the same restored quest');
  assert(selected.label.includes(readQuestView(frontier.quest,restored,canonicalQuestList(),CONTENT_CONSTELLATIONS).label));
  if(guestStarted){
   const originals=await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('lumenGuestBeforeAccount_')||k.startsWith('lumenBeforeAccountSwitchAttempt_')).map(k=>localStorage.getItem(k))`);
   assert(originals.includes(guestRaw));assert(originals.includes(guestAttempt));
  }
  await evaluate(`localStorage.removeItem('lumenCloudDiagnosticsV1')`);await navigate('Page.reload');
  await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId`),selected.attempt.questId,'The restored frontier survives reload without opening the map');
  assert.equal(await evaluate('JSON.stringify(__favServer)'),serverBefore);
  if(historicalFrontier){
   // An owned cache may already contain a READY inserted catch-up board. A
   // later numeric adventure is still the preserved historical frontier.
   const all=canonicalQuestList(),extension=quests.filter(q=>q.legacyIndex>=baseCampaignQuestCount());
   const groups=[...new Set(extension.map(q=>q.constellationId))];
   const laterGroup=extension.filter(q=>q.constellationId===groups[1]),target=laterGroup[Math.floor(laterGroup.length/2)];
   const earlierGroup=all.find(q=>q.ordinal<target.ordinal&&q.legacyIndex===null&&!all.some(other=>other.constellationId===q.constellationId&&other.legacyIndex!==null));
   const dormant=all.find(q=>q.constellationId===earlierGroup.constellationId&&q.ordinal>earlierGroup.ordinal);
   const solved=Object.fromEntries(quests.filter(q=>q.ordinal<target.ordinal).map(q=>[q.legacyIndex,1]));
   const historical={...restored,solved,historyBackup:solved,skyScore:SKY_TARGET,badges:{...restored.badges,explorer:1,beacon:1},
    canonicalQuestState:Object.fromEntries(all.filter(q=>q.legacyIndex===null&&q.ordinal<=earlierGroup.ordinal).map(q=>[q.id,{solved:true,stars:1,badges:{}}]))};
   delete historical.catalogueOrigin;
   preserveStartedAdventureAccess(historical);
   assert.equal(nextCanonicalQuest(historical.solved,historical.canonicalQuestState,[],historical).quest.id,target.id);
   const idle={attemptId:'owned-idle-catchup',questId:dormant.id,mode:'campaign',state:'READY',startedAt:null,board:dormant.reg.map(row=>row.map(()=>0)),activeDuration:0,qualifying:true};
   await evaluate(`sessionStorage.setItem('favorableServer',${JSON.stringify(JSON.stringify(historical))});localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(historical))});localStorage.setItem('lumenActiveAttemptV1',${JSON.stringify(JSON.stringify(idle))});localStorage.removeItem('lumenCloudDiagnosticsV1')`);
   await navigate('Page.reload');
   await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
   assert.equal(await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId`),target.legacyIndex+1,'Cold same-owner restore must resume the historical frontier, not an earlier idle catch-up board');
   assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),target.reg);
   assert((await evaluate(`document.getElementById('campaignMapLabel').textContent`)).includes(readQuestView(target,historical,all,CONTENT_CONSTELLATIONS).label));
   const beforeHydration=await evaluate('__favAttemptBeforeHydration');
   assert.equal(JSON.parse(beforeHydration).attemptId,idle.attemptId);assert.deepEqual(JSON.parse(beforeHydration).board,idle.board);
   assert.equal(await evaluate(`Object.keys(localStorage).filter(k=>k.startsWith('lumenBeforeAccountSwitchAttempt_')).some(k=>localStorage.getItem(k)===__favAttemptBeforeHydration)`),true,'The actual displaced idle board bytes, including restored engine metadata, are preserved exactly');
   assert.equal(await evaluate('JSON.stringify(__favServer)'),JSON.stringify(historical),'Historical frontier selection cannot rewrite acquired history or balances');
   assert.equal(await evaluate('__favCommands'),0);
   for(const patch of [{state:'PAUSED',startedAt:123,activeDuration:7000},{mode:'replay'}]){
    const kept={...idle,...patch};
    await evaluate(`localStorage.setItem('lumenActiveAttemptV1',${JSON.stringify(JSON.stringify(kept))});localStorage.removeItem('lumenCloudDiagnosticsV1')`);
    await navigate('Page.reload');
    await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
    const active=await evaluate(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1'))`);
    assert.equal(active.attemptId,kept.attemptId);assert.equal(active.questId,kept.questId);assert.equal(active.mode,kept.mode);
    assert.equal(active.startedAt,kept.startedAt);assert.equal(active.activeDuration,kept.activeDuration);assert.deepEqual(active.board,kept.board);
    assert.equal(await evaluate('JSON.stringify(__favServer)'),JSON.stringify(historical),'An active historical catch-up run or replay remains untouched');
   }
  }
  return {nativeHydration:true,noConflictReload:true,noNewVictory:true,scheduledFlush:true,automaticLostReplyRetry:loseReply,tokenRefresh:true,reload:true,freshDeviceCache:true,guestStartedBeforeLogin:guestStarted,historicalFrontier,automaticQuestSelection:true,selectionSurvivesReload:true,originalsPreserved:true,confirmedSpending:true,simulatedRpc:true};
 }finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier});}
}
