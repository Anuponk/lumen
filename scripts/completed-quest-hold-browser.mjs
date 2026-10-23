import assert from 'node:assert/strict';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {acknowledgeLearningMilestones} from './cdp-client.mjs';

// Native app/DOM and real browser storage; Auth/RPC and all player facts synthetic.
export async function verifyCompletedQuestHold({send,evaluate,navigate,url}){
 await send('Page.enable');await send('Runtime.enable');
 const quests=canonicalQuestList(),quest=quests.find(q=>q.legacyIndex===null);
 const owner='00000000-0000-0000-0000-000000000537';
 const solved=Object.fromEntries(quests.filter(q=>q.legacyIndex!==null&&q.ordinal<quest.ordinal).map(q=>[q.legacyIndex,1]));
 const profile={solved,historyBackup:{...solved},badges:{},stars:{},performances:{},noHint:{},
  canonicalQuestState:{[quest.id]:{solved:true,stars:1,badges:{speed:true}}},
  xp:100,shards:10,skyScore:Object.keys(solved).length+1,skyHistoryVersion:4,walletRevision:1,
  daily:{dates:{},rewards:{}},challenges:{}};
 const fixture=`
 const owner=${JSON.stringify(owner)},profile=${JSON.stringify(profile)};
 localStorage.setItem('lumenCloudOwnerId',owner);localStorage.setItem('lumenProgressV1',JSON.stringify(profile));
 localStorage.removeItem('lumenActiveAttemptV1');
 for(const key of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen','lumenSound'])localStorage.setItem(key,key==='lumenSound'?'off':'1');
 window.__questProfile=structuredClone(profile);window.__questHold=true;window.__questWaiting=false;window.__questWrites=0;
 window.supabase={createClient:()=>({auth:{
  getSession:async()=>({data:{session:{user:{id:owner}}}}),getUser:async()=>({data:{user:{id:owner}}}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc:async(name,args={})=>{
   if(name==='lumen_restore_profile'){
    if(window.__questHold){window.__questWaiting=true;await new Promise(resolve=>window.__releaseQuestRead=resolve)}
    return {data:structuredClone(window.__questProfile)};
   }
   if(name==='lumen_get_progress')return {data:Object.keys(profile.solved).map(key=>({puzzle_id:Number(key)+1}))};
   if(name==='lumen_get_daily')return {data:[]};
   if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
   if(name==='lumen_cas_profile'){window.__questWrites++;window.__questProfile=structuredClone(args.p_payload);return {data:true}};
   if(name==='lumen_canonical_command_version'||name==='lumen_legacy_command_version')return {error:{code:'PGRST202'},status:404};
   return {data:[]};
  }})};
 `;
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture});
 const until=async expression=>{
  for(let i=0;i<150;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100))}
  throw Error('Quest hold browser timeout: '+expression);
 };
 async function touch(selector){
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);
  await until(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();for(let p=e;p;p=p.parentElement){if(p.getAnimations().some(a=>a.playState==='running'&&Number.isFinite(a.effect.getComputedTiming().endTime)))return false}return r.width>0&&r.height>0&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e})()`);
  const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();if(!r.width||!r.height)throw Error('Invisible quest test target');return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await new Promise(r=>setTimeout(r,50));
 }
 const cardSelector='#puzzleGrid [data-quest-id="'+quest.id+'"]';
 async function openDetail(){
  await acknowledgeLearningMilestones(evaluate);
  await touch('#openSky');await until('!document.getElementById("mapModal").hidden');
  await touch('#adventureRail [data-pack-id="'+quest.packId+'"]');
  await touch('#sectorTabs [data-content-id="'+quest.constellationId+'"]');
  await until('!!document.querySelector('+JSON.stringify(cardSelector)+')');
 }
 try{
  await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase*']});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true});
  await navigate('Page.navigate',{url:url.href});
  // A first PWA installation reloads its uncontrolled document. Exercise the
  // controlled document, as the existing sky/browser runners do.
  await until('!!navigator.serviceWorker.controller');await navigate('Page.reload');
  await until('window.__questWaiting');
  await openDetail();
  const before=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
  const held=await evaluate(`(()=>{const c=document.querySelector(${JSON.stringify(cardSelector)}),n=document.querySelector('#skyCard .sky-note');return {done:c.classList.contains('done'),locked:c.classList.contains('locked'),disabled:c.disabled,label:c.getAttribute('aria-label'),title:c.title,note:n.textContent,badges:c.innerHTML}})()`);
  assert(held.done&&!held.locked&&held.disabled);assert.match(held.label,/terminée.*synchronisation/i);
  assert.match(held.title,/terminée.*synchronisation/i);assert.match(held.note,/quêtes terminées conservées.*synchronisation/i);
  const attemptBefore=await evaluate("localStorage.getItem('lumenActiveAttemptV1')");
  await touch(cardSelector);
  assert.equal(await evaluate("localStorage.getItem('lumenActiveAttemptV1')"),attemptBefore,'Disabled replay cannot start an attempt');
  assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),before,'Browsing/touch cannot grant rewards');
  assert.equal(await evaluate('__questWrites'),0,'Pending hydration has not written a snapshot');
  await evaluate('__questHold=false;__releaseQuestRead()');
  await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
  await evaluate(`document.getElementById('closeMap').click()`);await openDetail();
  await until(`!document.querySelector(${JSON.stringify(cardSelector)}).disabled`);
  const ready=await evaluate(`(()=>{const c=document.querySelector(${JSON.stringify(cardSelector)});return {label:c.getAttribute('aria-label'),badges:c.innerHTML,solved:lumenDiagnostics.snapshot().progress.canonicalQuestState[${JSON.stringify(quest.id)}]}})()`);
  assert.match(ready.label,/terminée, rejouable/i);assert.equal(ready.badges,held.badges);
  assert.deepEqual(ready.solved,profile.canonicalQuestState[quest.id]);
  assert.doesNotMatch(await evaluate(`document.querySelector('#skyCard .sky-note').textContent`),/synchronisation/i);
  await touch(cardSelector);await until('document.getElementById("mapModal").hidden');
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).questId"),quest.id);
  return {mobileTouch:true,completedHeld:true,visibleReason:true,disabledReplay:true,verifiedHydrationReleasesReplay:true,rewardsPreserved:true};
 }finally{await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
}
