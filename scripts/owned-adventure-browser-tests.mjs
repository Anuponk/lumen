// Synthetic server rights: no Stripe/Supabase production request is made.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,navigateAndWait,closeBrowser,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {authenticatedCampaignFixture} from './fixtures/authenticated-campaign-browser.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';
const all=canonicalQuestList(),included=all.filter(q=>q.packId===CONTENT_PACKS[0].id);
const solved=Object.fromEntries(included.filter(q=>q.legacyIndex!==null).map(q=>[q.legacyIndex,1]));
const profile={catalogueOrigin:currentCatalogueOrigin,solved,historyBackup:solved,badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:Object.fromEntries(included.filter(q=>q.legacyIndex===null).map(q=>[q.id,{solved:true,stars:1,badges:{}}])),daily:{dates:{},rewards:{}},challenges:{},xp:1000,shards:3,walletRevision:1,skyScore:100,skyHistoryVersion:4};
const {send,evaluate,errors}=await connectBrowser();
async function until(expression){for(let i=0;i<150;i++){if(await evaluate(expression,true))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out: '+expression+' '+JSON.stringify(await evaluate(`({rail:document.getElementById('adventureRail')?.textContent,map:document.getElementById('mapModal')?.hidden,auth:document.getElementById('mobileAuthStatus')?.textContent})`))+' '+JSON.stringify(errors))}
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*supabase.co*']});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 for(const packId of ['real-adventure-04','real-adventure-06']){
  const first=all.find(q=>q.packId===packId),second=all.find(q=>q.packId===packId&&q.ordinal===first.ordinal+1);
  const script=await send('Page.addScriptToEvaluateOnNewDocument',{source:authenticatedCampaignFixture(profile)+`
   localStorage.setItem('lumenSkyTourSeen','1');localStorage.setItem('lumenIntroPresentedV1','1');
   const factory=window.supabase.createClient;
   window.supabase.createClient=(...args)=>{const c=factory(...args),rpc=c.rpc;return {...c,rpc:async(name,args)=>{
    if(name==='lumen_get_entitlements'){window.__rightsRequested=true;if(!sessionStorage.getItem('rightsReleased'))await new Promise(r=>window.__releaseRights=()=>{sessionStorage.setItem('rightsReleased','1');r()});return {data:[{entitlement:'${packId}',source:'purchase'}],error:null}}return rpc(name,args);
   }}};
  `});
  const url=process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/';
  await navigateAndWait({send,evaluate},'Page.navigate',{url});
  await until('!!window.lumenDiagnostics&&!!window.__rightsRequested');
  await acknowledgeLearningMilestones(evaluate);
  await evaluate("document.getElementById('openSky').click()");
  await until(`!!document.querySelector('#adventureRail [data-pack-id="${packId}"]')`);
  assert.match(await evaluate(`document.querySelector('#adventureRail [data-pack-id="${packId}"]').getAttribute('aria-label')`),/Vérification/,'Loading rights have an explicit accessible label');
  await evaluate('window.__releaseRights()');
  await until(`!document.querySelector('#adventureRail [data-pack-id="${packId}"]').getAttribute('aria-label').includes('Vérification')`);
  await until(`JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')`);
  for(let reload=0;reload<2;reload++){
   if(reload){await navigateAndWait({send,evaluate},'Page.reload');await until('!!window.lumenDiagnostics&&!!window.__rightsRequested');await new Promise(r=>setTimeout(r,700));await acknowledgeLearningMilestones(evaluate);await evaluate("document.getElementById('openSky').click()");}
   await evaluate(`document.querySelector('#adventureRail [data-pack-id="${packId}"]').click();while(!document.querySelector('#sectorTabs [data-content-id="${first.constellationId}"]'))document.getElementById('constellationNext').click();document.querySelector('#sectorTabs [data-content-id="${first.constellationId}"]').click()`);
   assert.equal(await evaluate(`document.querySelector('[data-quest-id="${first.id}"]').disabled`),false,'First owned quest is playable');
   assert.equal(await evaluate(`document.querySelector('[data-quest-id="${second.id}"]').disabled`),true,'Second quest retains its own prerequisite');
   await evaluate(`document.querySelector('[data-quest-id="${first.id}"]').click()`);
   assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),first.reg,'Map starts the purchased quest');
   assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().progress.solved'),solved,'Opening a quest invents no earlier completion');
  }
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier});
  await evaluate('localStorage.clear();sessionStorage.clear()');
 }
 assert.deepEqual(errors,[]);
 const report={ownedAdventures:[4,6],mobile:true,delayedRights:true,reload:true,syntheticServer:true};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
