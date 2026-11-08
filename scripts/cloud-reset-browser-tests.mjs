import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import manifest from '../content/generated/logical-grids-v2.json' with {type:'json'};
import {authenticatedCampaignFixture} from './fixtures/authenticated-campaign-browser.mjs';
import {connectBrowser,navigateAndWait} from './cdp-client.mjs';
const all=canonicalQuestList(),legacy=all.filter(q=>q.legacyIndex!==null),changed=new Set(manifest.quests.filter(q=>q.gridRevision===2).map(q=>q.id));
const cleared=(revision)=>({solved:false,stars:0,badges:{},runPerformance:{},resetRevision:revision,resetAt:'2026-11-08T12:00:00.000Z',rewardedBeforeReset:true,...(revision===2?{gridRevision:2}:{})});
const solved=Object.fromEntries(legacy.map(q=>[q.legacyIndex,1]));
const local={catalogueOrigin:3,solved,historyBackup:solved,badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:Object.fromEntries(all.filter(q=>q.ordinal>400&&q.ordinal<=800).map(q=>[q.id,cleared(1)])),daily:{dates:{},rewards:{}},challenges:{},xp:1000,shards:7,walletRevision:1,legacyVictoryRevision:10,skyScore:298,skyHistoryVersion:4,legacyAdventureAccess:['real-adventure-05','real-adventure-06','real-adventure-07','real-adventure-08','real-adventure-09']};
const cloud=structuredClone(local);cloud.legacyVictoryRevision++;
for(const q of all.filter(q=>q.legacyIndex===null&&q.ordinal<=400)){
 local.canonicalQuestState[q.id]={solved:true,stars:1,badges:{}};
 cloud.canonicalQuestState[q.id]={solved:true,stars:1,badges:{}};
}
for(const id of changed)cloud.canonicalQuestState[id]=cleared(2);
for(const id of [...changed].filter(id=>Object.hasOwn(local.canonicalQuestState,id)).slice(0,3))local.canonicalQuestState[id]={...local.canonicalQuestState[id],solved:true,badges:{mastery:true},runPerformance:{version:3,bestTime:1,badges:{mastery:true}}};
const {send,evaluate,errors}=await connectBrowser();
async function until(expression){for(let i=0;i<180;i++){try{if(await evaluate('window.__hydrationFailure'))throw Error(await evaluate('window.__hydrationFailure'));if(await evaluate(expression,true))return;}catch(e){if(!/Cannot find context|Execution context was destroyed/.test(e.message))throw e}await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+expression+' '+JSON.stringify(await evaluate("({status:document.getElementById('mobileAuthStatus').textContent,events:localStorage.getItem('lumenCloudDiagnosticsV1')})")));}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase.co*']});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 const results=[];
 for(const quota of [false,true]){
 const scenario=quota?'backup-quota':'normal';
 const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(sessionStorage.getItem('resetScenario')!==${JSON.stringify(scenario)}){localStorage.clear();sessionStorage.clear();sessionStorage.setItem('resetScenario',${JSON.stringify(scenario)});}`+authenticatedCampaignFixture(cloud)+`;localStorage.setItem('lumenSkyTourSeen','1');if(!sessionStorage.getItem('resetBrowserStarted')){localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(local))});sessionStorage.setItem('resetBrowserStarted','1');}const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(this===localStorage&&String(key).startsWith('lumenQuestResetArchiveV1:')){set.call(sessionStorage,'beforeResetBytes',value);if(${quota})throw new DOMException('Synthetic local archive quota','QuotaExceededError');}return set.call(this,key,value)};const warn=console.warn;console.warn=(...args)=>{if(String(args[0]).includes('synchronization failed'))window.__hydrationFailure=String(args[1]?.stack||args[1]);warn(...args);};`});
 await navigateAndWait({send,evaluate},'Page.navigate',{url:process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/'});
 await until("document.getElementById('mobileAuthStatus').textContent.includes('Progression synchronis')");
 if(!quota)assert.equal(await evaluate("Object.keys(localStorage).filter(k=>k.startsWith('lumenQuestResetArchiveV1:')).length"),1,'One exact local archive before reset reload');
 const archived=await evaluate(`(async()=>{const before=sessionStorage.getItem('beforeResetBytes');if(!${quota})return Object.keys(localStorage).some(k=>k.startsWith('lumenQuestResetArchiveV1:')&&localStorage.getItem(k)===before);const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('lumenCloudRecoveryV1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});try{return await new Promise((resolve,reject)=>{const r=db.transaction('snapshots','readonly').objectStore('snapshots').getAll();r.onsuccess=()=>resolve(r.result.includes(before));r.onerror=()=>reject(r.error)})}finally{db.close()}})()`,true);
 assert(archived,'Exact obsolete local bytes retained in the verified archive');
 assert.equal(await evaluate("Object.values(JSON.parse(sessionStorage.getItem('beforeResetBytes')).canonicalQuestState).filter(e=>e.resetRevision===1&&e.solved).length"),3,'The archive retains the synthetic old-board wins');
 const q=all.find(q=>q.packId==='real-adventure-05');
 await evaluate(`document.getElementById('openSky').click();document.querySelector('#adventureRail [data-pack-id="${q.packId}"]').click();document.querySelector('#sectorTabs [data-content-id="${q.constellationId}"]').click();`);
 await until(`!!document.querySelector('#puzzleGrid [data-quest-id="${q.id}"]')`);
 await evaluate(`document.querySelector('#puzzleGrid [data-quest-id="${q.id}"]').click()`);
 assert.deepEqual((await evaluate('lumenDiagnostics.snapshot()')).puz.reg,q.reg,'A real account can open the first available grid after reset');
 assert.equal(await evaluate("JSON.parse(localStorage.getItem('lumenProgressV1')).canonicalQuestState['pack-real-adventure-05-q004'].resetRevision"),2);
 assert.equal(await evaluate('window.__canonicalGrants'),0,'Restoring the reset never awards a victory');
 assert.deepEqual(errors,[]);
 results.push({scenario,resetReload:true,hydrationReady:true,gridOpens:true,oldLocalArchived:true,physicalDevice:false});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
 }
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
}finally{await send('Browser.close').catch(()=>{})}
