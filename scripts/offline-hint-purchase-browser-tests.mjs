import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {authenticatedCampaignFixture} from './fixtures/authenticated-campaign-browser.mjs';
import {connectBrowser,navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
const {send,evaluate,errors}=await connectBrowser(),all=canonicalQuestList(),q=all[500],done=all.slice(0,500);
const unreachable=process.env.LUMEN_TEST_UNREACHABLE==='1';
const solved=Object.fromEntries(done.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1]));
const profile={catalogueOrigin:3,solved,historyBackup:solved,badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:Object.fromEntries(done.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{}}])),daily:{dates:{},rewards:{}},challenges:{},xp:1000,shards:80,walletRevision:1,skyScore:298,skyHistoryVersion:4,legacyAdventureAccess:['real-adventure-06']};
const pending=`(async()=>{const {createDurableCanonicalVictoryOutbox}=await import('/src/persistence/durable-canonical-outbox.js');return (await createDurableCanonicalVictoryOutbox(localStorage,{namespace:'Wallet'}).pending('synthetic-frontier')).length})()`;
async function until(expression){for(let i=0;i<160;i++){if(await evaluate(expression,true))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out '+expression+' '+JSON.stringify(await evaluate("({message:document.getElementById('msg')?.textContent,meter:document.getElementById('shardMeter')?.textContent,attempt:JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')?.helpUses,proof:JSON.parse(localStorage.getItem('lumenOfflineVerifiedOwnerV1')||'null')})")))}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase.co*']});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:authenticatedCampaignFixture(profile).replace("if(navigator.onLine===false)throw new TypeError('Synthetic RPC offline');","if(navigator.onLine===false||sessionStorage.getItem('rpcNetworkOffline')==='1')throw new TypeError('Failed to fetch');")});
 await navigateAndWait({send,evaluate},'Page.navigate',{url:process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/'});
 await until("!!window.lumenDiagnostics&&document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')");await acknowledgeLearningMilestones(evaluate);
 await evaluate('navigator.serviceWorker.ready',true);
 await until('!!navigator.serviceWorker.controller');
 await until(`(async()=>{for(const key of await caches.keys()){if(await (await caches.open(key)).match('/content/generated/remaining-adventures.json'))return true}return false})()`);
 assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),q.reg);
 await evaluate("document.getElementById('attemptMask').click();document.getElementById('questStart').hidden=true");
 if(unreachable)await evaluate("sessionStorage.setItem('rpcNetworkOffline','1')");
 else await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await evaluate("dispatchEvent(new Event('offline'));document.getElementById('hint').click()");
 await until("JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).helpUses.hint===1");
 await evaluate("document.getElementById('hint').click()");await until(`(${pending}).then(n=>n===1)`);
 await until("JSON.parse(localStorage.getItem('lumenActiveAttemptV1')).helpUses.hint===2");
 // The meter renders after the reservation commits; wait for it, then assert.
 await until("document.getElementById('shardMeter').textContent.includes('79')");
 assert.match(await evaluate("document.getElementById('shardMeter').textContent"),/79/);
 await evaluate("document.getElementById('hint').click()");await until(`(${pending}).then(n=>n===2)`);
 await until("document.getElementById('shardMeter').textContent.includes('77')");
 assert.match(await evaluate("document.getElementById('shardMeter').textContent"),/77/);
 assert.equal(await evaluate('lumenDiagnostics.snapshot().progress.shards'),80,'Confirmed balance remains separate from reservations');
 await navigateAndWait({send,evaluate},'Page.reload');await until('!!window.lumenDiagnostics');await acknowledgeLearningMilestones(evaluate);
 await until("document.getElementById('shardMeter').textContent.includes('77')");
 assert.equal(await evaluate(pending,true),2);assert.match(await evaluate("document.getElementById('shardMeter').textContent"),/77/);
 await evaluate("if(!document.getElementById('attemptMask').hidden)document.getElementById('attemptMask').click();document.getElementById('hint').click()");
 await until(`(${pending}).then(n=>n===3)`);assert.match(await evaluate("document.getElementById('shardMeter').textContent"),/75/);
 await evaluate("sessionStorage.removeItem('rpcNetworkOffline')");
 await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});await evaluate("dispatchEvent(new Event('online'))");
 // A running attempt keeps its board stable; the next authenticated restoration
 // drains reservations through the normal wallet receipt protocol.
 await navigateAndWait({send,evaluate},'Page.reload');
 await until(`(${pending}).then(n=>n===0)`);await until('!!window.lumenDiagnostics&&lumenDiagnostics.snapshot().progress.shards===75');
 assert.equal(await evaluate("Number(sessionStorage.getItem('walletDebits'))"),3);assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().progress.solved'),solved);
 assert.deepEqual(errors,[]);const result={offline80:true,unreachableWithOnlineFlag:unreachable,paidHints:3,available75:true,restart:true,reconnectDebitOnce:true,oldProgressPreserved:true};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}).catch(()=>{});await send('Browser.close').catch(()=>{})}
