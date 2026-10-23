import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {QUEST_MILESTONES} from '../src/campaign/quest-rules.js';
import {questRewardDefinition} from '../src/campaign/quest-rewards.js';
import {acknowledgeLearningMilestones} from './cdp-client.mjs';

// Real DOM, storage, attempts and command capture; only Auth/RPC is synthetic.
export async function verifyDomainReplay({send,evaluate,navigate,url}){
 await send('Page.enable');await send('Runtime.enable');
 const quests=canonicalQuestList(),stable=quests.find(q=>q.legacyIndex===null),
  // Esprit clair forbids hints independently of Wallet readiness. Exercise a
  // replay where normal rules actually permit free and then paid help.
  historical=quests.find(q=>q.packId===stable.packId&&q.legacyIndex!==null&&q.ordinal>QUEST_MILESTONES.freeHintsThrough&&questRewardDefinition(q).bonus?.type!==2);
 const owner='00000000-0000-0000-0000-000000000563';
 const solved=Object.fromEntries(quests.filter(q=>q.packId===stable.packId&&q.legacyIndex!==null).map(q=>[q.legacyIndex,1]));
 const profile={solved,historyBackup:{...solved},badges:{},stars:{},performances:{},noHint:{},xp:100,
  canonicalQuestState:{[stable.id]:{solved:true,stars:1,badges:{speed:true}}},shards:10,walletRevision:1,legacyVictoryRevision:1,
  skyScore:Object.keys(solved).length+1,skyHistoryVersion:4,daily:{dates:{},rewards:{}},challenges:{},futureFixture:{preserve:true}};
 const fixture=`
  const owner=${JSON.stringify(owner)},profile=${JSON.stringify(profile)};
  if(!sessionStorage.getItem('domainFixtureStarted')){
   localStorage.setItem('lumenCloudOwnerId',owner);localStorage.setItem('lumenProgressV1',JSON.stringify(profile));
   localStorage.removeItem('lumenActiveAttemptV1');sessionStorage.setItem('domainFixtureStarted','1');
  }
  for(const key of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen','lumenSound'])localStorage.setItem(key,key==='lumenSound'?'off':'1');
  window.__domainWrites=0;window.__domainProfile={...structuredClone(profile),shards:7};
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:owner}}}}),getUser:async()=>({data:{user:{id:owner}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args={})=>{
   if(name==='lumen_restore_profile')return {data:structuredClone(__domainProfile)};
   if(name==='lumen_get_progress')return {data:Object.keys(profile.solved).map(key=>({puzzle_id:Number(key)+1}))};
   if(name==='lumen_get_daily')return {data:[]};if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
   if(['lumen_wallet_command_version','lumen_legacy_command_version','lumen_canonical_command_version'].includes(name))return {data:1};
   if(['lumen_cas_profile','lumen_commit_wallet_command','lumen_commit_quest_command','lumen_commit_legacy_command','lumen_commit_canonical_command'].includes(name)){__domainWrites++;return {error:{code:'PGRST003'},status:503}};
   return {data:[]};
  }})};
 `;
 const until=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(resolve=>setTimeout(resolve,100))}throw Error('Domain replay timeout: '+expression+' '+await evaluate(`JSON.stringify({status:document.getElementById('mobileAuthStatus')?.textContent,hintDisabled:document.getElementById('hint')?.disabled,questStartHidden:document.getElementById('questStart')?.hidden,attemptMaskHidden:document.getElementById('attemptMask')?.hidden,dialogs:[...document.querySelectorAll('[role="dialog"]')].filter(e=>!e.hidden&&getComputedStyle(e).display!=='none').map(e=>e.id),events:JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').slice(-5)})`))};
 async function touch(selector){
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  await until(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();for(let p=e;p;p=p.parentElement){if(p.getAnimations().some(a=>a.playState==='running'&&Number.isFinite(a.effect.getComputedTiming().endTime)))return false}return !e.disabled&&r.width>0&&r.height>0&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e})()`);
  const point=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 async function start(quest){
  await acknowledgeLearningMilestones(evaluate);
  await evaluate(`if(!document.getElementById('questStart').hidden)document.getElementById('questGo').click()`);
  await touch('#openSky');await until('!document.getElementById("mapModal").hidden');
  await touch('#adventureRail [data-pack-id="'+quest.packId+'"]');await touch('#sectorTabs [data-content-id="'+quest.constellationId+'"]');
  const selector='#puzzleGrid [data-quest-id="'+quest.id+'"]';await until('!!document.querySelector('+JSON.stringify(selector)+')');
  assert.equal(await evaluate('document.querySelector('+JSON.stringify(selector)+').disabled'),false,'A verified acquired replay is enabled');
  await touch(selector);await until('document.getElementById("mapModal").hidden');
  await acknowledgeLearningMilestones(evaluate);
  await evaluate(`if(!document.getElementById('questStart').hidden)document.getElementById('questGo').click();document.getElementById('attemptMask').click()`);
 }
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 try{
  await evaluate(`sessionStorage.removeItem('domainFixtureStarted')`);
  await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase*']});
  await navigate('Page.navigate',{url:url.href});
  await until(`window.lumenDiagnostics&&document.getElementById('mobileAuthStatus').textContent.includes('Éclats à vérifier')`);
  await until('!!navigator.serviceWorker.controller');await navigate('Page.reload');
  await until(`window.lumenDiagnostics&&document.getElementById('mobileAuthStatus').textContent.includes('Éclats à vérifier')`);
  assert.equal(await evaluate('__domainWrites'),0);
  const before=await evaluate('lumenDiagnostics.snapshot().progress');
  const captured=[];
  for(const quest of [stable,historical]){
   await start(quest);
   const identity=await evaluate(`(()=>{const a=JSON.parse(localStorage.getItem('lumenActiveAttemptV1'));return {attemptId:a.attemptId,resetCount:a.resetCount}})()`);
   if(quest===historical){
    await touch('#hint');await until(`JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).helpUses.hint===1`);
    await touch('#hint');await until(`document.getElementById('msg').textContent.includes('Dépense non confirmée')`);
    assert.equal(await evaluate('__domainWrites'),0,'A held paid hint sends no mutation');
   }
   await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
   await until(`document.getElementById('successOverlay').classList.contains('show')&&document.getElementById('successSub').textContent.includes('en attente')`);
   assert.doesNotMatch(await evaluate(`document.getElementById('successRewards').textContent`),/Étoile/);
   assert.equal(await evaluate('lumenDiagnostics.snapshot().progress.shards'),10);
   assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().progress.badges'),before.badges);
   assert.equal(await evaluate('__domainWrites'),0,'Only durable capture occurs before readiness');
   captured.push({domain:quest===stable?'Canonical':'Legacy',questId:quest.id,operationId:identity.attemptId+'-reset-'+(identity.resetCount||0)});
   await evaluate(`document.getElementById('successOverlay').classList.remove('show')`);
  }
  const readIntents=`(async()=>{const {createIndexedOutboxStore}=await import('/src/persistence/indexed-outbox-store.js');return (await createIndexedOutboxStore(indexedDB).entries('lumen')).filter(([key])=>key.includes('VictoryOutboxV2:${owner}:')).map(([,raw])=>JSON.parse(raw))})()`;
  const first=await evaluate(readIntents,true);assert.equal(first.length,2);
  for(const expected of captured)assert(first.some(entry=>entry.operationId===expected.operationId&&entry.questId===expected.questId));
  await evaluate(`localStorage.removeItem('lumenCloudDiagnosticsV1')`);
  await navigate('Page.reload');await until(`window.lumenDiagnostics&&JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_partial_reconciliation_pending')`);
  assert.deepEqual(await evaluate(readIntents,true),first,'Restart retains the exact operation identity and captured run facts');
  assert.equal(await evaluate('lumenDiagnostics.snapshot().progress.shards'),10);
  assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().progress.futureFixture'),{preserve:true});
  return {confirmedStableReplay:true,confirmedLegacyReplay:true,freeHelp:true,paidHelpHeld:true,noOptimisticRewards:true,immutableIntentsAfterRestart:true};
 }finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
}
