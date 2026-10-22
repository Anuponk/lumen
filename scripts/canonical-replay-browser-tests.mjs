import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,acknowledgeLearningMilestones,navigateAndWait} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {verifyVictoryChallenge} from './victory-challenge-browser.mjs';
const {send,evaluate,errors}=await connectBrowser();
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+expression)}
const quests=canonicalQuestList().filter(q=>q.constellationId==='real-01');
const targets=quests.slice(-2),results=[];
const url=new URL(process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/');url.searchParams.set('qa','new');
async function verifyDurableOutbox(){
 const user='isolated-outbox-'+Date.now();
 await evaluate(`(async()=>{
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  const denied={get length(){throw Error('denied')},getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
  const box=createDurableCanonicalVictoryOutbox(denied);
  await box.enqueue(${JSON.stringify(user)},'first',{badges:{autonomy:true}},{operationId:'first-run'});
  await box.enqueue(${JSON.stringify(user)},'second',{badges:{speed:true}},{operationId:'second-run'});
  return true;
 })()`,true);
 // Navigate to a new document: recover only persisted IndexedDB, not JS memory.
 await navigateAndWait({send,evaluate},'Page.reload');
 const result=await evaluate(`(async()=>{
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  const {replayCanonicalVictoryOutbox}=await import('/src/persistence/canonical-outbox.js');
  const denied={get length(){throw Error('denied')},getItem(){throw Error('denied')},setItem(){throw Error('quota')}};
  const box=createDurableCanonicalVictoryOutbox(denied),user=${JSON.stringify(user)};
  const restored=await box.pending(user);
  const commit=async id=>({profile:{canonicalQuestState:{[id]:{solved:true,badges:{autonomy:true,speed:true}}}}});
  const independent=await replayCanonicalVictoryOutbox(box,user,async id=>{if(id==='first')throw Error('refused');return commit(id)});
  const remaining=await box.pending(user);
  await replayCanonicalVictoryOutbox(box,user,commit);
  const complete=(await box.pending(user)).length===0;
  const key='lumenCanonicalVictoryOutboxV1:'+user+':corrupt';localStorage.setItem(key,'{broken');
  const native=createDurableCanonicalVictoryOutbox(localStorage);
  await native.enqueue(user,'valid',{badges:{autonomy:true}},{operationId:'valid-run'});
  const inspected=await native.inspect(user);
  const recovered=await replayCanonicalVictoryOutbox(native,user,commit);
  const corruptPreserved=localStorage.getItem(key)==='{broken';
  localStorage.removeItem(key); // This isolated test fixture only.
  return {restored:restored.length,independent:independent.length,remaining:remaining.map(e=>e.questId),complete,corruptPreserved,reported:inspected.issues.includes('invalid_entry'),recovered:recovered.length};
 })()`,true);
 assert.deepEqual(result,{restored:2,independent:1,remaining:['first'],complete:true,corruptPreserved:true,reported:true,recovered:1});
 results.push({test:'durable IndexedDB recovery after document restart',ok:true});
}
async function verifyLegacyDurability(){
 const owner='browser-legacy-'+Date.now();
 await evaluate(`(async()=>{
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  const {legacyVictoryRules}=await import('/src/campaign/legacy-victory.js');
  const box=createDurableCanonicalVictoryOutbox(localStorage,{namespace:'Legacy'});
  await box.enqueue(${JSON.stringify(owner)},legacyVictoryRules()[0].questId,{facts:{seconds:45,assistanceUsed:false,mistakeCommitted:false,qualifying:true,hintUsed:false,challengeFailed:false,qualifiedDay:'2026-10-18',qualifiedAt:'2026-10-18T10:00:00Z'}},{operationId:'browser-attempt-reset-0'});
 })()`,true);
 await navigateAndWait({send,evaluate},'Page.reload');
 const result=await evaluate(`(async()=>{
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  const {commitLegacyVictoryCommand,replayLegacyVictoryOutbox}=await import('/src/persistence/legacy-command.js');
  const {applyLegacyVictory,legacyVictoryRules}=await import('/src/campaign/legacy-victory.js');
  const legacy=createDurableCanonicalVictoryOutbox(localStorage,{namespace:'Legacy'}),canonical=createDurableCanonicalVictoryOutbox(localStorage);
  let profile={solved:{},badges:{},stars:{},challenges:{},performances:{},noHint:{},xp:0,shards:3,skyScore:0,skyHistoryVersion:4},receipt=null,calls=0;
  const client={rpc:async(name,args)=>{
   if(name==='lumen_commit_legacy_command'){
    if(args.p_expected_user_id!==${JSON.stringify(owner)})throw Error('wrong owner');calls++;
    if(!receipt)receipt={request:{version:1,operationId:args.p_operation_id,questId:args.p_quest_id,facts:args.p_facts},outcome:applyLegacyVictory(profile,0,args.p_facts),recordedAt:new Date().toISOString()};
    throw Error('simulated lost response after commit');
   }
   if(name==='lumen_get_legacy_command')return {data:receipt};
   if(name==='lumen_restore_profile')return {data:structuredClone(profile)};
   throw Error('wrong writer');
  }};
  const pending=await legacy.pending(${JSON.stringify(owner)}),canonicalCount=(await canonical.pending(${JSON.stringify(owner)})).length;
  const confirmed=await replayLegacyVictoryOutbox(legacy,${JSON.stringify(owner)},(id,facts,operationId,opts)=>commitLegacyVictoryCommand(client,id,facts,operationId,opts));
  return {before:pending.length,canonicalCount,after:(await legacy.pending(${JSON.stringify(owner)})).length,confirmed:confirmed.length,calls,xp:profile.xp,attempts:profile.performances[0]?.attempts};
 })()`,true);
 assert.deepEqual(result,{before:1,canonicalCount:0,after:0,confirmed:1,calls:1,xp:15,attempts:1});
 results.push({test:'Legacy IndexedDB intent after document restart, exact receipt after lost response and domain isolation',ok:true});
}
async function openDetail(){
 await evaluate(`lumenDiagnostics.setupQuest(${quests.filter(q=>q.legacyIndex!==null).at(-1).legacyIndex})`);await acknowledgeLearningMilestones(evaluate);
 await evaluate('document.getElementById("openSky").click()');
 await evaluate('document.querySelector(\'#sectorTabs [data-content-id="real-01"]\').click()');
}
async function verifyHistoricalCatalogue(viewport){
 const all=canonicalQuestList(),packId='real-adventure-03';
 const old=all.filter(q=>q.legacyIndex!==null&&q.packId!== 'real-adventure-04');
 const groups=[...new Set(all.filter(q=>q.packId===packId).map(q=>q.constellationId))]
  .map(id=>all.filter(q=>q.constellationId===id)).filter(group=>group.every(q=>q.legacyIndex===null));
 assert.ok(groups.length>0);
 const progress={solved:Object.fromEntries(old.map(q=>[q.legacyIndex,1])),badges:{historical:1},xp:123,shards:7,canonicalQuestState:{}};
 await evaluate(`localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});localStorage.removeItem('lumenQaActiveAttemptV1');localStorage.removeItem('lumenActiveAttemptV1')`);
 await navigateAndWait({send,evaluate},'Page.reload');await acknowledgeLearningMilestones(evaluate);
 const before=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
 await evaluate('document.getElementById("openSky").click()');
 await evaluate(`document.querySelector('#adventureRail [data-pack-id="${packId}"]').click()`);
 for(const group of groups){
  const id=group[0].constellationId;
  let visible=await evaluate(`!!document.querySelector('#sectorTabs [data-content-id="${id}"]')`);
  if(!visible){await evaluate('document.getElementById("constellationNext").click()');visible=await evaluate(`!!document.querySelector('#sectorTabs [data-content-id="${id}"]')`)}
  assert.ok(visible);
  assert.equal(await evaluate(`document.querySelector('#sectorTabs [data-content-id="${id}"]').classList.contains('locked')`),false,'New constellation is acquired through the completed historical adventure');
  await evaluate(`document.querySelector('#sectorTabs [data-content-id="${id}"]').click()`);
  assert.equal(await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${group[0].id}"]').disabled`),false);
  for(const quest of group.slice(1))assert.equal(await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${quest.id}"]').disabled`),true,'Only the first new quest is initially available');
  const decision=await evaluate(`(async()=>{const {canonicalInsertedQuestDecision}=await import('/src/campaign/canonical-quests.js');return canonicalInsertedQuestDecision(${JSON.stringify(group[0])},lumenDiagnostics.snapshot().progress).status})()`,true);
  assert.equal(decision,'ready','The rendered detail and shared runtime policy agree');
  await evaluate('document.getElementById("constellationBack").click()');
 }
 assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),before,'Browsing grants neither completion nor rewards');
 const first=groups.at(-1)[0];
 await evaluate(`document.querySelector('#sectorTabs [data-content-id="${first.constellationId}"]').click();document.querySelector('#puzzleGrid [data-quest-id="${first.id}"]').click()`);
 await acknowledgeLearningMilestones(evaluate);
 assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),first.reg,'The enabled card launches the actual stable-ID puzzle');
 assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),before,'Starting the added quest grants no rewards');
 results.push({test:'historical adventure with entirely new constellations',viewport,constellations:groups.length,localSequence:true,noAutomaticRewards:true});
}
async function verifyPersistedRetryHold(){
 const user='isolated-retry-'+Date.now();
 const before=await evaluate(`(async()=>{
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  const {replayCanonicalVictoryOutbox}=await import('/src/persistence/canonical-outbox.js');
  const denied={get length(){throw Error('denied')}};
  const box=createDurableCanonicalVictoryOutbox(denied),user=${JSON.stringify(user)};let calls=0;
  await box.enqueue(user,'paused',{badges:{autonomy:true}},{operationId:'held-run'});
  await box.enqueue(user,'independent',{badges:{autonomy:true}},{operationId:'other-run'});
  await replayCanonicalVictoryOutbox(box,user,async id=>{calls++;if(id==='paused')throw Object.assign(Error('simulated refusal'),{code:'P0001',status:400});return {profile:{canonicalQuestState:{[id]:{solved:true,badges:{autonomy:true}}}}}});
  return {calls,pending:(await box.pending(user)).length,paused:(await box.inspect(user)).paused.length};
 })()`,true);
 assert.deepEqual(before,{calls:2,pending:1,paused:1});
 await navigateAndWait({send,evaluate},'Page.reload');
 const after=await evaluate(`(async()=>{
  const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');
  const {replayCanonicalVictoryOutbox}=await import('/src/persistence/canonical-outbox.js');
  const box=createDurableCanonicalVictoryOutbox({get length(){throw Error('denied')}}),user=${JSON.stringify(user)};let calls=0;
  const commit=async id=>{calls++;return {profile:{canonicalQuestState:{[id]:{solved:true,badges:{autonomy:true}}}}}};
  const original=JSON.stringify(await box.pending(user));
  await replayCanonicalVictoryOutbox(box,user,commit);
  const heldCalls=calls,state=await box.inspect(user);
  await box.resume(user,{kind:'auth'});const stillHeld=(await box.inspect(user)).paused.length;
  await box.resume(user,{kind:'all'});const evidenceUnchanged=JSON.stringify(await box.pending(user))===original;
  await replayCanonicalVictoryOutbox(box,user,commit);
  return {heldCalls,paused:state.paused.length,retryable:state.retryable.length,stillHeld,evidenceUnchanged,calls,remaining:(await box.pending(user)).length};
 })()`,true);
 assert.deepEqual(after,{heldCalls:0,paused:1,retryable:0,stillHeld:1,evidenceUnchanged:true,calls:1,remaining:0});
 await until('!!window.lumenDiagnostics');
 results.push({test:'persisted refusal pause after document restart, explicit retry and unchanged evidence',ok:true});
}
try{
 await send('Page.enable');await send('Runtime.enable');
 for(const viewport of [{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  const progress={solved:Object.fromEntries(quests.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1])),canonicalQuestState:Object.fromEntries(quests.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{autonomy:true},performance:{seconds:120}}])),xp:123,shards:7,badges:{}};
  const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.clear();localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});for(const key of ['lumenTutorialSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(key,'1');localStorage.setItem('lumenSound','off');`});
  await send('Page.navigate',{url:url.href});await until('!!window.lumenDiagnostics');await sleep(1000);
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
  await verifyDurableOutbox();
  await verifyLegacyDurability();
  await verifyPersistedRetryHold();
  for(const q of targets){
   await openDetail();
   const selector=`#puzzleGrid [data-quest-id="${q.id}"]`;
   assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).disabled`),false);
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
   await acknowledgeLearningMilestones(evaluate);
   await evaluate('document.getElementById("attemptMask").click()');
   await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
   await until('!document.getElementById("skyReveal").hidden');
   assert.equal(await evaluate('document.getElementById("skyRevealFeedback").children.length'),0);
   assert.equal(await evaluate('document.querySelectorAll("#skyRevealCanvas .new-star").length'),0,'Replay adds no star');
   assert.equal(await evaluate('document.getElementById("skyRevealRewards").querySelectorAll(".success-reward").length>0'),true,'Confirmed badges remain visible');
   const saved=await evaluate(`lumenDiagnostics.snapshot().progress.canonicalQuestState[${JSON.stringify(q.id)}]`);
   for(const key of ['autonomy','speed','noError','mastery'])assert.equal(saved.badges[key],true,q.id+' earns '+key);
   const text=await evaluate('document.getElementById("successSub").textContent');
   assert.match(text,/Rapidité/);assert.match(text,/Sans erreur/);assert.match(text,/Maîtrise/);
   assert.doesNotMatch(text,/XP|étoile/,'replay never announces new completion rewards');
   await evaluate('document.getElementById("skyRevealSky").click()');
   await send('Page.reload',{ignoreCache:true});await until('!!window.lumenDiagnostics');await sleep(500);
   const restored=await evaluate('lumenDiagnostics.snapshot().progress');
   assert.deepEqual(restored.canonicalQuestState[q.id],saved,'reload preserves upgraded badges');
   assert.equal(restored.xp,progress.xp);assert.equal(restored.shards,progress.shards);
   await openDetail();
   assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(selector+' .performance-slot.earned')}).length`),4,'Mon ciel shows all four badges');
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
   await acknowledgeLearningMilestones(evaluate);
   await evaluate('document.getElementById("attemptMask").click();(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
   await until('!document.getElementById("skyReveal").hidden');
   assert.equal(await evaluate('document.querySelectorAll("#skyRevealRewards .speed.previously-earned").length'),1,'A previously held Rapidité remains visible on the victory recap');
   assert.match(await evaluate('document.querySelector("#skyRevealRewards .speed").textContent'),/déjà obtenu/);
   assert.equal(await evaluate('document.querySelectorAll("#skyRevealRewards .star").length'),0,'Repeated replay cannot award another star');
   assert.equal((await evaluate('lumenDiagnostics.snapshot().progress')).xp,progress.xp);
   results.push({viewport,questId:q.id,replayBadges:true,reload:true,noDuplicateRewards:true});
  }
  // First completion must reveal its actual constellation and one confirmed star.
  const first=targets[0];
  await evaluate(`(()=>{const progress=JSON.parse(localStorage.getItem('lumenQaProgressV1'));delete progress.canonicalQuestState[${JSON.stringify(first.id)}];localStorage.setItem('lumenQaProgressV1',JSON.stringify(progress))})()`);
  await navigateAndWait({send,evaluate},'Page.reload');await until('!!window.lumenDiagnostics');await sleep(500);
  await openDetail();
  await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${first.id}"]').click()`);
  await acknowledgeLearningMilestones(evaluate);
  await evaluate('document.getElementById("attemptMask").click()');
  await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
  await until('!document.getElementById("skyReveal").hidden');
  assert.equal(await evaluate('document.querySelectorAll("#skyRevealRewards .success-reward.star").length'),1);
  assert.equal(await evaluate('document.querySelectorAll("#skyRevealCanvas .new-star").length>0'),true);
  assert.equal(await evaluate('document.getElementById("skyRevealFeedback").children.length'),0);
  assert.equal(await evaluate('document.getElementById("difficultyBox").hidden'),true);
  assert.equal(await evaluate('document.getElementById("skyRevealNext").getBoundingClientRect().bottom<=innerHeight'),true,'Next quest is reachable');
  assert.equal(await evaluate('document.getElementById("skyRevealShare").hidden'),false,'First canonical victory explains the existing challenge limitation');
  assert.equal(await evaluate('document.getElementById("skyRevealShare").disabled'),true,'Unsupported stable-ID challenges cannot create a wrong legacy link');
  assert.match(await evaluate('document.getElementById("skyRevealChallengeReason").textContent'),/quêtes historiques/);
  if(viewport.mobile){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('docs/validation/issue511-challenge-limit-390.png',Buffer.from(shot.data,'base64'));}
  results.push({viewport,firstCompletionReveal:true,confirmedStar:true,noFeedback:true});
  await verifyHistoricalCatalogue(viewport);
 }
 results.push({victoryChallenges:await verifyVictoryChallenge({send,evaluate},url)});
 assert.deepEqual(errors,[]);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,uncaughtErrors:errors},null,2));
 console.log(JSON.stringify(results));
}finally{await send('Browser.close').catch(()=>{})}
