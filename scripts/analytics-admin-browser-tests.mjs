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
  // #708: one bounded health read (last known state per device, freshness apart).
  if(name==='lumen_admin_player_health')return {data:{players:{'u:admin':{devices:[{state:'pending',pending:2,observed_at:new Date(Date.now()-30000).toISOString()}]},'u:new':{devices:[{state:'critical',observed_at:new Date(Date.now()-30000).toISOString()}]}}}};
  if(name==='lumen_admin_feedback_inbox')return {data:{items:[],counts:{all:0,action:0,new:0,reviewed:0,answered:0,closed:0},next_before:null}};
  if(name==='lumen_admin_engagement')return sessionStorage.getItem('engagementUnavailable')?{error:{message:'Unavailable'}}:{data:{days:args?.p_days??7,traffic:{identifiers:10,human:2,qa:3,automated_test:4,undetermined:1},acquisition:[{channel:'player_share',opened:4,q1_started:2,q1_completed:1}],challenges:{created:13,senders:4,sent_to_friends:5,accepted:5,completed:5,abandoned:0,in_progress:0,guest_participations:0},daily:{flag_enabled:false,players:2,days:1,runs:2,completed:1,abandoned:0,in_progress:1},retention_by_channel:{measurable:false,reason:'no_persistent_campaign_identifier'}}};
  if(name==='lumen_admin_health_snapshot')return {data:{"availability":{"state":"healthy","sampled_at":"2026-11-21T09:25:00Z"},"active":[{"severity":"P0","signature":"purchase","affected":2,"opened_at":"2026-11-21T06:00:00Z"}],"errors":[{"severity":"P0","kind":"purchase_missing_access","observed_at":"2026-11-21T06:00:00Z"},{"severity":"P1","kind":"performance_regression","metric":"load","version":"1.11.1+719","observed_at":"2026-11-21T02:00:00Z"}],"performance":[{"metric":"load","version":"1.11.1+719","reference":"1.11.1+718","platform":"desktop","browser":"chromium","network":"4g","p90":1800,"reference_p90":900,"samples":23,"reference_samples":25,"regression":true,"confidence":"high"}],"signup_count":5,"signups":[{"effective_at":"2026-11-21T08:00:00Z","method":"google"}],"purchase_count":1,"purchases":[{"event_at":"2026-11-21T06:00:00Z","product_id":"fixture-pack","provider":"stripe","amount":10,"currency":"EUR"}],"currencies":[{"amount":"10","currency":"EUR","count":1}],"delivery":{"accepted":1}}};
  if(name==='lumen_admin_version_health')return {data:{days:args?.p_days??7,totals:{hydrations:200,failures:10},versions:[{version:'1.11.1+719',hydrations:40,failures:8,blocked:1,players:5,devices:6,waiting_devices:1},{version:'1.11.1+718',hydrations:150,failures:2,players:20}]}};
  // #1044: synthetic aggregates for Activité & Premium (30 days, today incomplete, coverage from day 14).
  if(name==='lumen_admin_activity'||name==='lumen_admin_conversion'){
   const n=args?.p_days??30,today=new Date(Date.UTC(2026,10,28)),days=[...Array(n)].map((_,i)=>new Date(today.getTime()-(n-1-i)*864e5).toISOString().slice(0,10));
   const w=i=>Math.max(0,Math.round(4+3*Math.sin(i/3)+i/6));
   if(name==='lumen_admin_activity')return {data:{today:days.at(-1),dataStart:days[Math.max(0,n-18)],premiumLaunch:'2026-11-27T14:28:55Z',quotasOn:'2026-11-27T14:28:55Z',internalPlayers:2,priceCents:499,
    settings:{quotas_enabled:true,quota_new_daily:15,quota_replay_daily:5,quota_threshold_constellation:4,premium_enabled:true},
    daily:days.map((day,i)=>({day,players:w(i),finishers:Math.max(0,w(i)-1),started:w(i)*6,startedNew:w(i)*4,startedReplay:w(i)*2,completed:w(i)*5,completedNew:w(i)*3,completedReplay:w(i)*2,seconds:w(i)*5*75,timed:w(i)*5,timedPlayers:w(i),
     freePlayers:w(i),premiumPlayers:i>n-3?1:0,subjectPlayers:i>n-3?3:0,reachNew:i>n-3?1:0,reachReplay:i>n-3?1:0,newLimit:i>n-3?15:null,replayLimit:i>n-3?5:null})),
    behaviour:{playerDays:64,players:17,mean:6.2,median:4,p75:8,p90:15,p95:22,meanNew:4.1,meanReplay:2.1,meanCompleted:5.3,distribution:[{bucket:'0',count:3},{bucket:'1-5',count:30},{bucket:'6-10',count:15},{bucket:'11-15',count:9},{bucket:'16-20',count:4},{bucket:'21-30',count:2},{bucket:'31+',count:1}]},
    time:{completed:320,timed:320,invalid:0},premium:{freePlayers:15,premiumPlayers:3,freePastThreshold:6,subject:{playerDays:6,players:4},
     observed:{playerDays:6,players:4,daysReachNew:2,daysReachReplay:1,daysReachAny:3,playersReachNew:2,playersReachReplay:1},
     beforeAfter:{before:{playerDays:58,players:16,meanStarted:6.4,meanNew:4.3,meanReplay:2.1,meanCompleted:5.4,meanMinutes:7.9},after:{playerDays:6,players:5,meanStarted:5.1,meanNew:3.2,meanReplay:1.9,meanCompleted:4.6,meanMinutes:6.3}}}}};
   return {data:{today:days.at(-1),eventsStart:days.at(-2),windowDays:args?.p_window_days??7,channel:args?.p_channel??'all',
    daily:days.map((day,i)=>({day,opens:i>n-3?4:0,visitors:i>n-3?3:0,ctas:i>n-3?2:0,checkouts:i>n-3?1:0,cancels:0,errors:0,purchases:i===n-2?1:0,blocksNew:i>n-3?2:0,blocksReplay:i>n-3?1:0,shown:i>n-3?3:0,blockedPlayers:i>n-3?2:0})),
    shop:{opens:8,visitors:5,closes:7,closeMedianSeconds:42,ctas:4,ctaPlayers:3,checkouts:2,checkoutPlayers:2,cancels:1,errors:0,purchases:1,stripeSessions:{created:1,complete:0,expired:1,open:0},
     origins:{quota_new:{opens:3,visitors:2},quota_replay:{opens:1,visitors:1},locked_adventure:{opens:4,visitors:3}},prices:[{channel:'play',priceCents:499,currency:'EUR'}]},
    limits:{blocksNew:4,blocksReplay:2,shown:6,shownNew:4,shownReplay:2,blockedPlayers:3,blockedPlayersNew:2,blockedPlayersReplay:1,blockedPlayerDays:4,shownPlayers:3},
    funnelBlocked:{active:15,blocked:3,shop:3,cta:2,checkout:2,purchase:1},funnelShop:{visitors:5,cta:3,checkout:2,purchase:1,purchasesWithoutVisit:0},
    attribution:[{origin:'quota_new',channel:'play',purchases:1}],
    retention:{blocked:{playerDays:4,players:3,j1:75,j7Eligible:0,j7:null,nextQuests:9,nextMinutes:11,prevQuests:30,sameDayQuests:17,conversion7:33.3,ageDays:12,progression:46},
     reference:{playerDays:9,players:5,j1:44.4,j7Eligible:0,j7:null,nextQuests:6,nextMinutes:8,prevQuests:21,sameDayQuests:8,conversion7:0,ageDays:10,progression:38}}}};
  }
  if(name==='lumen_admin_quota_simulation')return {data:{coverage:{userDays:21,players:6},simulation:[5,10,15,20,25,30,50].map((q,i)=>({newQuota:q,replayQuota:5,userDays:21,players:6,pctDaysReachNew:[81,67,43,43,35,29,19][i],pctDaysReachAny:[81,71,62,62,55,52,43][i],pctAttemptsBeyond:[81,71,65,59,54,49,34][i],playersNeverReaching:[0,1,2,2,3,3,4][i]}))}};
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
  assert.deepEqual(state.panels,[['overview'],['players'],['activity'],['acquisition'],['journeys'],['sync'],['support']]);
  // #708 Lot C: Acquisition & engagement, with contracts and honest « Non mesurable ».
  await evaluate("document.querySelector('[data-analytics-section=acquisition]').click();document.getElementById('adminCockpit').scrollTop=0");
  await until("document.getElementById('analyticsEngagement').textContent.includes('Défis entre joueurs')",'engagement section');
  const engagement=await evaluate(`(()=>{const h=document.getElementById('analyticsEngagement'),txt=h.textContent;return {traffic:/Joueurs humains/.test(txt)&&/Tests automatisés/.test(txt),notMeasurable:txt.includes('Non mesurable.')&&txt.includes('échantillon partiel'),rate:/25 %/.test(txt),challenges:/13/.test(txt)&&/Envoyés à des amis/.test(txt),daily:/Masqué au public/.test(txt),retention:txt.includes('Rétention J+1 / J+7 par canal'),contracts:h.querySelectorAll('.analytics-contract').length,overflow:document.documentElement.scrollWidth>innerWidth,read:window.__adminReads.includes('lumen_admin_engagement')}})()`);
  assert.deepEqual(engagement,{traffic:true,notMeasurable:true,rate:true,challenges:true,daily:true,retention:true,contracts:4,overflow:false,read:true},'engagement at '+viewport.width);
  if(process.env.LUMEN_ANALYTICS_CAPTURES&&viewport.width!==320)fs.writeFileSync(process.env.LUMEN_ANALYTICS_CAPTURES+'/analytics-acquisition-'+viewport.width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  // #1044: Activité & Premium, four sections, one grouped read, filters re-read, no overflow.
  await evaluate("document.querySelector('[data-analytics-section=activity]').click();document.getElementById('adminCockpit').scrollTop=0");
  await until("document.getElementById('analyticsActivity').textContent.includes('Conversion après blocage')",'activity section');
  const activity=await evaluate(`(()=>{const h=document.getElementById('analyticsActivity'),txt=h.textContent;return {sections:[...h.querySelectorAll('.act-section h3')].map(e=>e.textContent),
   charts:h.querySelectorAll('.act-chart').length,funnels:h.querySelectorAll('.act-funnel').length,unmeasured:h.querySelectorAll('.act-unmeasured').length>0,incomplete:txt.includes('incomplet'),
   current:txt.includes('15 (en vigueur)'),overflow:document.documentElement.scrollWidth>innerWidth||[...h.querySelectorAll('.act-section')].some(e=>e.scrollWidth>e.clientWidth+1),
   reads:['lumen_admin_activity','lumen_admin_conversion','lumen_admin_quota_simulation'].map(n=>window.__adminReads.filter(r=>r===n).length)}})()`);
  assert.deepEqual(activity.sections,['Activité','Temps de jeu et comportement','Quotas Gratuit / Premium','Conversion et fidélisation']);
  assert.equal(activity.charts>=10&&activity.funnels===2&&activity.unmeasured&&activity.current&&!activity.overflow,true,'activity at '+viewport.width+': '+JSON.stringify(activity));
  assert.deepEqual(activity.reads,[1,1,1],'one grouped read, reused when the section is shown again');
  await evaluate("document.querySelector('[data-analytics-section=players]').click();document.querySelector('[data-analytics-section=activity]').click()");
  assert.deepEqual(await evaluate("['lumen_admin_activity'].map(n=>window.__adminReads.filter(r=>r===n).length)"),[1],'cached until a filter changes');
  await evaluate("(()=>{const s=document.querySelector('[data-activity-filter=days]');s.value='7';s.dispatchEvent(new Event('change',{bubbles:true}))})()");
  await until("window.__adminReads.filter(r=>r==='lumen_admin_activity').length===2",'filter re-read');
  if(process.env.LUMEN_ANALYTICS_CAPTURES&&viewport.width!==320){
   await evaluate("(()=>{const s=document.querySelector('[data-activity-filter=days]');s.value='30';s.dispatchEvent(new Event('change',{bubbles:true}))})()");
   await until("window.__adminReads.filter(r=>r==='lumen_admin_activity').length===3",'back to 30 days');
   for(const [i,label] of ['activite','temps','quotas','conversion'].entries()){
    await evaluate(`document.querySelectorAll('#analyticsActivity .act-section')[${i}].scrollIntoView({block:'start'})`);
    fs.writeFileSync(process.env.LUMEN_ANALYTICS_CAPTURES+'/analytics-1044-'+label+'-'+viewport.width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
   }
  }
  // #708 Lot D: release comparison with exposure, in Synchronisation & incidents.
  await evaluate("document.querySelector('[data-analytics-section=sync]').click()");
  await until("document.getElementById('analyticsVersions').textContent.includes('Comparaison des versions')",'release comparison');
  assert.equal(await evaluate("(()=>{const h=document.getElementById('analyticsVersions'),txt=h.textContent;return txt.includes('5 % sur 200 hydratations')&&!!h.querySelector('.analytics-row-alert')&&txt.includes('à examiner')&&document.documentElement.scrollWidth<=innerWidth})()"),true,'release comparison at '+viewport.width);
  await evaluate("document.querySelector('[data-analytics-section=players]').click()");

  await until("document.getElementById('analyticsHealthCockpit').textContent.includes('Santé du service')",'health snapshot');
  assert.equal(await evaluate(`(()=>{
   const h=document.getElementById('analyticsHealthCockpit'),[version,severity]=h.querySelectorAll('select');
   const initial=h.textContent;
   version.value='1.11.1+718';version.dispatchEvent(new Event('change'));
   const referenceVisible=h.textContent.includes('1800 ms');
   severity.value='P0';severity.dispatchEvent(new Event('change'));
   return initial.includes('Achat sans accès')&&initial.includes('10 EUR')&&initial.includes('5 inscriptions')
     &&initial.includes('Acceptés par Brevo')&&referenceVisible&&!h.textContent.includes('1800 ms')
     &&document.documentElement.scrollWidth<=innerWidth;
  })()`),true,'health controls at '+viewport.width);
  // #947/#948: the probe line states its age (stale fixture date) and rows show the server confidence.
  assert.deepEqual(await evaluate(`(()=>{const h=document.getElementById('analyticsHealthCockpit'),status=h.querySelector('[data-freshness]');
   const v=h.querySelectorAll('select');v[0].value='';v[0].dispatchEvent(new Event('change'));v[1].value='';v[1].dispatchEvent(new Event('change'));
   return {age:/il y a [0-9   ]+ min/.test(status?.textContent||''),freshness:status?.dataset.freshness,confidence:h.textContent.includes('Régression · Confiance élevée'),legacy:h.textContent.includes('Échantillon insuffisant')}})()`),
   {age:true,freshness:'fresh',confidence:true,legacy:false},'freshness and confidence at '+viewport.width);
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
   const players=document.getElementById('adminPlayers'),pending=players.querySelector('[data-health-filter="pending"]').getAttribute('aria-pressed')==='true'&&players.querySelectorAll('tbody tr').length===1;
   players.querySelector('tbody button[aria-controls="adminTimeline"]').click();
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
