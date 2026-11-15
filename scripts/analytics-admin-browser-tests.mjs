// Real application and browser; Auth/RPC fixtures are synthetic, never live data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser,navigateAndWait} from './cdp-client.mjs';
import {multiAccountFixture} from './fixtures/multi-account-browser.mjs';
const {send,evaluate,errors}=await connectBrowser();
const base=process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/';
const profile={solved:{0:1,1:1},historyBackup:{0:1,1:1},badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:{},daily:{dates:{},rewards:{}},challenges:{},xp:30,shards:3,walletRevision:1,skyHistoryVersion:4};
const source=multiAccountFixture({admin:profile},'admin').replace("if(!uid())return",`window.__adminReads=window.__adminReads||[];
 if(name==='lumen_get_internal_capabilities')return {data:sessionStorage.getItem('adminDenied')?[]:[{capability:'analytics_cockpit'}]};
 if(name.startsWith('lumen_admin_')){
  window.__adminReads.push(name);
  if(name==='lumen_admin_cockpit')return {data:{summary:{unique_players:2},daily:[],retention:{},funnel:[]}};
  if(name==='lumen_admin_quest_metrics')return {data:{friction:[],funnel:[],current_players:{}}};
  if(name==='lumen_admin_sync_health')return {data:{diagnostics:{timeline:[],signatures:[]}}};
  if(name==='lumen_admin_player_observations')return {data:{players:{}}};
  if(name==='lumen_admin_recent_players')return {data:[{player_key:'u:admin',player_type:'authenticated',display_name:'Compte de test',sessions:1}]};
  return {data:[]};
 }
 if(!uid())return`);
async function until(expression,label){for(let i=0;i<150;i++){if(await evaluate(expression,true))return;await new Promise(r=>setTimeout(r,100))}throw Error('Timed out: '+label)}
const results=[];
try{
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Network.setBlockedURLs',{urls:['*supabase.co*']});
 await send('Page.addScriptToEvaluateOnNewDocument',{source});
 for(const viewport of [{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
  await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});
  await navigateAndWait({send,evaluate},'Page.navigate',{url:new URL('/admin/analytics?section=players&days=30',base).href});
  await until("!document.getElementById('adminCockpit').hidden&&document.querySelector('#adminPlayers input')",'authorised direct entry');
  const state=await evaluate(`(()=>{
   const modal=document.getElementById('adminCockpit'),search=document.querySelector('#adminPlayers input');
   search.value='Compte';search.dispatchEvent(new Event('input'));
   const panels=[];
   for(const button of modal.querySelectorAll('[data-analytics-section]')){button.click();panels.push([...modal.querySelectorAll('[data-analytics-panel]')].filter(p=>!p.hidden).map(p=>p.dataset.analyticsPanel))}
   modal.querySelector('[data-analytics-section="players"]').click();
   return {title:document.getElementById('adminCockpitTitle').textContent,panels,searchRetained:search.value==='Compte',days:document.getElementById('adminCockpitDays').value,overflow:document.documentElement.scrollWidth>innerWidth,reads:window.__adminReads.length};
  })()`);
  assert.equal(state.title,'Lumen Analytics');assert.equal(state.searchRetained,true);assert.equal(state.days,'30');assert.equal(state.overflow,false);
  assert.deepEqual(state.panels,[['overview'],['players'],['journeys'],['sync'],['support']]);
  await navigateAndWait({send,evaluate},'Page.reload');
  await until("!document.getElementById('adminCockpit').hidden&&document.querySelector('[data-analytics-panel=players]')?.hidden===false",'reload keeps the selected section');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.equal(await evaluate("document.getElementById('adminCockpit').hidden&&location.pathname==='/'"),true);
  await evaluate("document.getElementById('adminCockpitOpen').click()");
  assert.equal(await evaluate("!document.getElementById('adminCockpit').hidden&&location.pathname==='/admin/analytics'"),true,'legacy menu entry opens the same interface');
  await evaluate("sessionStorage.setItem('adminDenied','1')");
  await navigateAndWait({send,evaluate},'Page.reload');
  await until("!document.getElementById('adminAnalyticsAccess').hidden",'denied route');
  assert.equal(await evaluate("document.getElementById('adminCockpit').hidden&&(window.__adminReads||[]).length===0"),true,'non-admin cannot initiate any admin data read');
  await evaluate("sessionStorage.removeItem('adminDenied')");
  await evaluate("window.__server.session=null;window.__saveServer()");
  await navigateAndWait({send,evaluate},'Page.reload');
  await until("!document.getElementById('adminAnalyticsAccess').hidden",'guest route');
  assert.equal(await evaluate("document.getElementById('adminCockpit').hidden&&(window.__adminReads||[]).length===0"),true,'guest cannot initiate an admin data read');
  await evaluate("window.__server.session={user:{id:'admin'}};window.__saveServer()");
  results.push({viewport,...state,directEntry:true,reload:true,escape:true,legacyEntry:true,denied:true,guestDenied:true});
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 const report={results,liveRPC:false,physicalDevice:false,exceptions:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
