import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,navigateAndWait,closeBrowser,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {multiAccountFixture} from './fixtures/multi-account-browser.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {currentCatalogueOrigin} from '../src/campaign/catalogue-origin.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';

const quests=canonicalQuestList(),owned=[CONTENT_PACKS[1].id,CONTENT_PACKS.at(-1).id];
const lateLegacy=quests.findLast(q=>q.packId===owned[0]&&q.legacyIndex!==null);
const lateCanonical=quests.findLast(q=>q.packId===owned[1]&&q.legacyIndex===null);
const profile={catalogueOrigin:currentCatalogueOrigin,solved:{},historyBackup:{},badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:{},daily:{dates:{},rewards:{}},challenges:{},xp:0,shards:3,walletRevision:1,skyScore:0,skyHistoryVersion:4};
const {send,evaluate,errors}=await connectBrowser();
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(expression){
 for(let i=0;i<140;i++){if(await evaluate(expression,true))return;await wait(100)}
 const detail=await evaluate(`({
  reads:window.__reviewReads,online:navigator.onLine,
  map:document.getElementById('mapModal')?.hidden,owner:localStorage.getItem('lumenCloudOwnerId'),
  status:document.getElementById('playReviewStatus')?.textContent,
  auth:document.getElementById('authUser')?.textContent
 })`);
 throw Error('Timed out: '+expression+' '+JSON.stringify({detail,errors}));
}
const card=q=>'#puzzleGrid [data-quest-id="'+q.id+'"]';
const click=selector=>evaluate('document.querySelector('+JSON.stringify(selector)+').click()');
const visibleStatus="!document.getElementById('playReviewStatus').hidden";
const mapOpen="!document.getElementById('mapModal').hidden";
const currentQuest=q=>`document.getElementById('campaignMapLabel').textContent.startsWith(${JSON.stringify('Quête '+q.ordinal+' - ')})`;
const activeAttempt="JSON.parse(localStorage.getItem('lumenActiveAttemptV1')||'null')";
async function selectConstellation(q){
 const pack='#adventureRail [data-pack-id="'+q.packId+'"]';
 const constellation='#sectorTabs [data-content-id="'+q.constellationId+'"]';
 await click(pack);
 await evaluate(`(()=>{
  for(let i=0;i<8&&!document.querySelector(${JSON.stringify(constellation)});i++)
   document.getElementById('constellationNext').click();
  document.querySelector(${JSON.stringify(constellation)}).click();
 })()`);
}
async function selectQuest(q){
 await selectConstellation(q);
 await click(card(q));
 await until(currentQuest(q));
 assert.equal(await evaluate(mapOpen),false);
}

try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*supabase.co*']});
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await send('Page.addScriptToEvaluateOnNewDocument',{source:multiAccountFixture({reviewer:profile,ordinary:profile},'reviewer')+`
  localStorage.setItem('lumenIntroPresentedV1','1');
  const factory=window.supabase.createClient;
  window.supabase.createClient=(...params)=>{
   const client=factory(...params),rpc=client.rpc;
   return {...client,auth:{...client.auth,onAuthStateChange(callback){
    client.auth.onAuthStateChange(callback);
    window.__switchReviewAccount=id=>{
     const session={user:{id}};window.__server.session=session;window.__saveServer();
     callback('SIGNED_IN',session);
    };
   }},rpc:async(name,args)=>{
    if(name==='lumen_get_profile')return {data:[{nickname:'Fixture'}]};
    if(name==='lumen_get_entitlements')return {data:${JSON.stringify(owned.map(entitlement=>({entitlement,source:'admin'})))}};
    if(name==='lumen_can_use_play_review'){
     window.__reviewReads=(window.__reviewReads||0)+1;
     const granted=window.__server.session.user.id==='reviewer'&&args.p_expected_user_id==='reviewer'&&!window.__reviewRevoked;
     if(window.__holdReview)await new Promise(resolve=>window.__releaseReview=resolve);
     return {data:granted};
    }
    return rpc(name,args);
   }};
  };
 `});
 await navigateAndWait({send,evaluate},'Page.navigate',{url:process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/'});
 await until("document.getElementById('authUser').textContent==='Fixture'&&JSON.parse(localStorage.getItem('lumenCloudDiagnosticsV1')||'[]').some(e=>e.event==='hydration_ready')");
 await acknowledgeLearningMilestones(evaluate);
 await click('#openSky');await until(visibleStatus);
 const stored=await evaluate('structuredClone(window.__server.accounts.reviewer.profile)');
 await selectQuest(lateLegacy);
 assert.equal(await evaluate("localStorage.getItem('lumenActiveAttemptV1')"),null,'Idle direct selection is ephemeral');
 assert.deepEqual(await evaluate('window.__server.accounts.reviewer.profile'),stored);
 await evaluate("document.getElementById('questGo').click();document.getElementById('attemptMask').click()");
 const before=await evaluate(activeAttempt);
 assert.equal(before.state,'RUNNING');
 await click('#openSky');await until(visibleStatus);
 assert.equal(await evaluate("document.getElementById('mapDetail').hidden"),false,'Review returns to the quest selection');
 await selectQuest(lateCanonical);
 await click('#openSky');await until(visibleStatus);
 await selectQuest(lateLegacy);
 const resumed=await evaluate(activeAttempt);
 assert.equal(resumed.attemptId,before.attemptId);
 assert.equal(resumed.state,'PAUSED');
 assert.equal(resumed.qualifying,before.qualifying);
 assert.deepEqual(resumed.board,before.board);

 await click('#openSky');await until(visibleStatus);
 await selectConstellation(lateCanonical);
 await evaluate("window.__holdReview=true");
 await click(card(lateCanonical));await until('!!window.__releaseReview');
 await evaluate("window.__switchReviewAccount('ordinary');window.__holdReview=false;window.__releaseReview()");
 await until("localStorage.getItem('lumenCloudOwnerId')==='ordinary'");
 assert.equal(await evaluate(currentQuest(lateCanonical)),false,'A delayed grant cannot open the other account board');
 await click('#openSky');await until(mapOpen);
 await selectConstellation(quests.find(q=>q.packId===owned[0]));
 assert.equal(await evaluate(visibleStatus),false);
 const second=quests.filter(q=>q.packId===owned[0])[1];
 assert.equal(await evaluate('document.querySelector('+JSON.stringify(card(second))+').disabled'),true);
 assert.deepEqual(await evaluate('window.__server.accounts.ordinary.profile.solved'),{});
 await evaluate("window.__switchReviewAccount('reviewer')");
 await until("localStorage.getItem('lumenCloudOwnerId')==='reviewer'");
 await click('#openSky');await until(visibleStatus);
 await selectConstellation(lateCanonical);
 await evaluate("Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));");
 await until('!('+visibleStatus+')');
 assert.equal(await evaluate('document.querySelector('+JSON.stringify(card(lateCanonical))+').disabled'),true);
 await evaluate("delete navigator.onLine;window.dispatchEvent(new Event('online'));");
 await until(visibleStatus);
 await selectQuest(lateCanonical);
 await evaluate(`document.getElementById('attemptMask').click();const s=lumenDiagnostics.snapshot();
  lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))`);
 await until(`!!window.__server.accounts.reviewer.profile.canonicalQuestState[${JSON.stringify(lateCanonical.id)}]?.solved`);
 assert.deepEqual(await evaluate('Object.keys(window.__server.accounts.reviewer.profile.canonicalQuestState)'),[lateCanonical.id]);
 assert.deepEqual(await evaluate('window.__server.accounts.reviewer.profile.solved'),{});

 await click('#openSky');await until(visibleStatus);
 const next=quests.filter(q=>q.constellationId===lateCanonical.constellationId).find(q=>q.id!==lateCanonical.id);
 await selectConstellation(next);
 await evaluate('window.__reviewRevoked=true');
 await click(card(next));await until("document.getElementById('playReviewStatus').textContent.includes('indisponible')");
 assert.equal(await evaluate(mapOpen),true);
 assert.equal(await evaluate(currentQuest(lateCanonical)),true);
 assert.equal(await evaluate(`document.querySelector('#adventureRail [data-pack-id="${owned[1]}"]').classList.contains('locked')`),false);
 assert.deepEqual(errors,[]);
 const report={mobileViewport:390,syntheticServer:true,legacy:true,canonicalVictory:true,resume:true,accountSwitch:true,offline:true,revocation:true};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
