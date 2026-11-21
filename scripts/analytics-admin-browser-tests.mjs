// Real application and browser; Auth/RPC fixtures are synthetic, never live data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {connectBrowser,closeBrowser,navigateAndWait} from './cdp-client.mjs';
import {multiAccountFixture} from './fixtures/multi-account-browser.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
const {send,evaluate,errors}=await connectBrowser();
const base=process.env.LUMEN_TEST_URL||'http://127.0.0.1:8000/';
const profile={solved:{0:1,1:1},historyBackup:{0:1,1:1},badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:{},daily:{dates:{},rewards:{}},challenges:{},xp:30,shards:3,walletRevision:1,skyHistoryVersion:4};
const allQuests=canonicalQuestList(),first=allQuests[0],second=allQuests[1],later=allQuests.find(q=>q.packId!==first.packId);
const questData={friction:[{stable_quest_id:first.id,quest_ordinal:first.ordinal,started:20,completed:4,hints:20,resets:22,abandons:1,verifies:6,median_seconds:48},{stable_quest_id:second.id,quest_ordinal:second.ordinal,started:1,completed:0,hints:1,resets:1},{stable_quest_id:later.id,quest_ordinal:later.ordinal,started:5,completed:8,hints:0,resets:0}],funnel:[{label:'Application lancée',players:23},{label:'Quête 1 commencée',players:20},{label:'Tutoriel terminé',players:0}],current_players:{'u:admin':first.ordinal}};
const source=multiAccountFixture({admin:profile},'admin').replace("if(!uid())return",`window.__adminReads=window.__adminReads||[];
 if(name==='lumen_get_internal_capabilities')return {data:sessionStorage.getItem('adminDenied')?[]:[{capability:'analytics_cockpit'}]};
 if(name.startsWith('lumen_admin_')){
  window.__adminReads.push(name);
  if(name==='lumen_admin_cockpit')return sessionStorage.getItem('productUnavailable')?{error:{message:'Unavailable'}}:{data:{summary:{unique_players:0},collection:{enabled:false},service_activity:{summary:{players:5,quests:13,completions:25,first_completions:6},daily:[{activity_date:'2026-11-14',players:5}],quests:[{stable_quest_id:${JSON.stringify(first.id)},quest_ordinal:${first.ordinal},players:5,completions:25,first_completions:6}],players:[{player_key:'u:admin',completions:25,quests:13,furthest_confirmed_quest:${first.ordinal}}]},daily:[],retention:{j1:0,j3:0,j7:0},funnel:[]}};
  if(name==='lumen_admin_accounts')return {data:[{user_id:'admin',nickname:'Compte de test'},{user_id:'new',nickname:'Compte sans événements'}]};
  if(name==='lumen_admin_quest_metrics')return {data:${JSON.stringify(questData)}};
  if(name==='lumen_admin_sync_health')return sessionStorage.getItem('healthUnavailable')?{error:{message:'Unavailable'}}:{data:{affected_players:2,failures:3,stalled_players:1,blocked:1,by_reason:[{reason:'storage_quota',count:2}],by_version:[{version:'1.11.1+615',count:3}],outbox:{pending_players:1,critical_players:1,alerts:[{state:'pending',pending:2,version:'1.11.1+615',since:new Date(Date.now()-3600000).toISOString()}]},diagnostics:{timeline:[],signatures:[{code:'runtime_exception',stage:'runtime',app_version:'1.11.1+615',platform:'desktop',browser:'chromium',occurrences:5,sessions:2}]}}};
  if(name==='lumen_admin_player_observations')return {data:{players:{'u:admin':{state:'pending',observed_at:new Date(Date.now()-30000).toISOString()},'u:new':{state:'failure',observed_at:new Date(Date.now()-30000).toISOString()}}}};
  if(name==='lumen_admin_engagement')return sessionStorage.getItem('engagementUnavailable')?{error:{message:'Unavailable'}}:{data:{days:args?.p_days??7,traffic:{identifiers:10,human:2,qa:3,automated_test:4,undetermined:1},acquisition:[{channel:'player_share',opened:4,q1_started:2,q1_completed:1}],challenges:{created:13,senders:4,sent_to_friends:5,accepted:5,completed:5,abandoned:0,in_progress:0,guest_participations:0},daily:{flag_enabled:false,players:2,days:1,runs:2,completed:1,abandoned:0,in_progress:1},retention_by_channel:{measurable:false,reason:'no_persistent_campaign_identifier'}}};
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
 for(const viewport of [{width:320,height:640,mobile:true},{width:390,height:844,mobile:true},{width:1440,height:900,mobile:false}]){
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
  assert.deepEqual(state.panels,[['overview'],['players'],['acquisition'],['journeys'],['sync'],['support']]);
  // #708 Lot C: Acquisition & engagement, with contracts and honest « Non mesurable ».
  await evaluate("document.querySelector('[data-analytics-section=acquisition]').click();document.getElementById('adminCockpit').scrollTop=0");
  await until("document.getElementById('analyticsEngagement').textContent.includes('Défis entre joueurs')",'engagement section');
  const engagement=await evaluate(`(()=>{const h=document.getElementById('analyticsEngagement'),txt=h.textContent;return {traffic:/Joueurs humains/.test(txt)&&/Tests automatisés/.test(txt),notMeasurable:txt.includes('Non mesurable.')&&txt.includes('échantillon partiel'),rate:/25 %/.test(txt),challenges:/13/.test(txt)&&/Envoyés à des amis/.test(txt),daily:/Masqué au public/.test(txt),retention:txt.includes('Rétention J+1 / J+7 par canal'),contracts:h.querySelectorAll('.analytics-contract').length,overflow:document.documentElement.scrollWidth>innerWidth,read:window.__adminReads.includes('lumen_admin_engagement')}})()`);
  assert.deepEqual(engagement,{traffic:true,notMeasurable:true,rate:true,challenges:true,daily:true,retention:true,contracts:4,overflow:false,read:true},'engagement at '+viewport.width);
  if(process.env.LUMEN_ANALYTICS_CAPTURES&&viewport.width!==320)fs.writeFileSync(process.env.LUMEN_ANALYTICS_CAPTURES+'/analytics-acquisition-'+viewport.width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate("document.querySelector('[data-analytics-section=players]').click()");
  const analysis=await evaluate(`(()=>{
   const modal=document.getElementById('adminCockpit'),nav=value=>modal.querySelector('[data-analytics-section="'+value+'"]').click();
   nav('overview');const overview=document.getElementById('analyticsOverview');
   const historical=overview.textContent.includes('actuellement désactivée'),noUndefined=!overview.textContent.includes('undefined'),untrackedAccount=overview.textContent.includes('Compte sans événements');
   const received=[...overview.querySelectorAll('.analytics-metric strong')].slice(0,4).map(n=>n.textContent).join(',')==='5,13,25,6'&&document.getElementById('adminRetention').textContent.includes('collecte interrompue');
   [...overview.querySelectorAll('button')].find(b=>b.textContent.includes('Analyser les parcours')).click();
   const journeys=document.getElementById('analyticsJourneys'),pack=journeys.querySelector('[aria-label="Filtrer par aventure"]'),minimum=journeys.querySelector('[aria-label="Minimum de joueurs ayant commencé"]');
   pack.value=${JSON.stringify(first.packId)};pack.dispatchEvent(new Event('change'));minimum.value='5';minimum.dispatchEvent(new Event('change'));
   const filtered=journeys.querySelectorAll('tbody tr').length;
   journeys.querySelector('[aria-label="Examiner la quête ${first.ordinal}"]').click();
   const detail=journeys.querySelector('.analytics-quest-detail').textContent.includes('22 réinitialisation');
   nav('sync');const technical=document.getElementById('analyticsTechnical');
   const causes=technical.textContent.includes('Stockage saturé'),versions=technical.textContent.includes('1.11.1+615'),queue=technical.textContent.includes('2 opération(s)');
   [...technical.querySelectorAll('button')].find(b=>b.textContent==='Voir les joueurs en attente').click();
   const players=document.getElementById('adminPlayers'),pending=players.querySelector('[aria-label="Filtrer l’état observé"]').value==='pending'&&players.querySelectorAll('.admin-player').length===1;
   players.querySelector('.admin-player button').click();
   return {historical,noUndefined,untrackedAccount,received,filtered,detail,causes,versions,queue,pending,drilldown:document.getElementById('adminTimeline').cockpitPlayer==='u:admin',overflow:document.documentElement.scrollWidth>innerWidth};
  })()`);
  assert.deepEqual(analysis,{historical:true,noUndefined:true,untrackedAccount:true,received:true,filtered:1,detail:true,causes:true,versions:true,queue:true,pending:true,drilldown:true,overflow:false});
  if(process.env.LUMEN_DASHBOARD_SCREENSHOTS&&viewport.width===1440){
   fs.mkdirSync(process.env.LUMEN_DASHBOARD_SCREENSHOTS,{recursive:true});
   for(const section of ['overview','journeys','sync']){
    await evaluate(`document.querySelector('[data-analytics-section="${section}"]').click();document.getElementById('adminCockpit').scrollTop=0`);
    const shot=await send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(process.env.LUMEN_DASHBOARD_SCREENSHOTS+'/'+section+'.png',Buffer.from(shot.data,'base64'));
   }
   await evaluate("document.querySelector('[data-analytics-section=players]').click()");
  }
  await evaluate("sessionStorage.setItem('productUnavailable','1');document.getElementById('adminCockpitRefresh').click()");
  await until("document.getElementById('adminCockpitStatus').textContent.includes('Indisponible : activité')",'independent technical source');
  assert.equal(await evaluate("document.getElementById('analyticsTechnical').textContent.includes('Stockage saturé')"),true);
  assert.equal(await evaluate(`document.querySelector('#analyticsJourneys [aria-label="Filtrer par aventure"]').value===${JSON.stringify(first.packId)}&&document.querySelector('#analyticsJourneys [aria-label="Minimum de joueurs ayant commencé"]').value==='5'`),true,'same-owner refresh preserves journey filters');
  await evaluate("sessionStorage.removeItem('productUnavailable');sessionStorage.setItem('healthUnavailable','1');document.getElementById('adminCockpitRefresh').click()");
  await until("document.getElementById('adminCockpitStatus').textContent.includes('santé technique')",'missing health source');
  assert.equal(await evaluate("document.getElementById('analyticsTechnical').textContent.includes('Source technique indisponible')"),true);
  await evaluate("sessionStorage.removeItem('healthUnavailable')");
  await navigateAndWait({send,evaluate},'Page.reload');
  await until("!document.getElementById('adminCockpit').hidden&&document.querySelector('[data-analytics-panel=players]')?.hidden===false",'reload keeps the selected section');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  assert.equal(await evaluate("document.getElementById('adminCockpit').hidden&&location.pathname==='/'"),true);
  assert.equal(await evaluate("document.getElementById('adminCockpitOpen').textContent"),'📊 Ouvrir Analytics','single administration entry');
  assert.equal(await evaluate("!!document.querySelector('[data-analytics-panel=support] #qaAccountTools')&&!document.querySelector('#adminTools #qaAccountTools')"),true,'test tools moved into Analytics › Support');
  assert.equal(await evaluate("['qaAccountSwitch','qaAccountReset','qaPreviewStreakLoss'].every(id=>!!document.querySelector('[data-analytics-panel=support] #'+id))"),true,'every test tool kept with its id');
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
  results.push({viewport,...state,analysis,directEntry:true,reload:true,escape:true,legacyEntry:true,denied:true,guestDenied:true});
 }
 assert.equal(errors.length,0,JSON.stringify(errors));
 const report={results,liveRPC:false,physicalDevice:false,exceptions:errors};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}finally{await closeBrowser(send)}
