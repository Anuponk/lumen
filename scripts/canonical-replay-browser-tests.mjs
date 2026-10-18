import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,acknowledgeLearningMilestones,navigateAndWait} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
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
async function openDetail(){
 await evaluate(`lumenDiagnostics.setupQuest(${quests.filter(q=>q.legacyIndex!==null).at(-1).legacyIndex})`);await acknowledgeLearningMilestones(evaluate);
 await evaluate('document.getElementById("openSky").click()');
 await evaluate('document.querySelector(\'#sectorTabs [data-content-id="real-01"]\').click()');
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
  await verifyPersistedRetryHold();
  for(const q of targets){
   await openDetail();
   const selector=`#puzzleGrid [data-quest-id="${q.id}"]`;
   assert.equal(await evaluate(`document.querySelector(${JSON.stringify(selector)}).disabled`),false);
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
   await acknowledgeLearningMilestones(evaluate);
   await evaluate('document.getElementById("attemptMask").click()');
   await evaluate('(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()');
   await until('document.getElementById("successOverlay").classList.contains("show")');
   const saved=await evaluate(`lumenDiagnostics.snapshot().progress.canonicalQuestState[${JSON.stringify(q.id)}]`);
   for(const key of ['autonomy','speed','noError','mastery'])assert.equal(saved.badges[key],true,q.id+' earns '+key);
   const text=await evaluate('document.getElementById("successSub").textContent');
   assert.match(text,/Rapidité/);assert.match(text,/Sans erreur/);assert.match(text,/Maîtrise/);
   assert.doesNotMatch(text,/XP|étoile/,'replay never announces new completion rewards');
   await evaluate('document.getElementById("successSky").click()');
   await send('Page.reload',{ignoreCache:true});await until('!!window.lumenDiagnostics');await sleep(500);
   const restored=await evaluate('lumenDiagnostics.snapshot().progress');
   assert.deepEqual(restored.canonicalQuestState[q.id],saved,'reload preserves upgraded badges');
   assert.equal(restored.xp,progress.xp);assert.equal(restored.shards,progress.shards);
   await openDetail();
   assert.equal(await evaluate(`document.querySelectorAll(${JSON.stringify(selector+' .performance-slot.earned')}).length`),4,'Mon ciel shows all four badges');
   results.push({viewport,questId:q.id,replayBadges:true,reload:true,noDuplicateRewards:true});
  }
 }
 assert.deepEqual(errors,[]);
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify({results,uncaughtErrors:errors},null,2));
 console.log(JSON.stringify(results));
}finally{await send('Browser.close').catch(()=>{})}
