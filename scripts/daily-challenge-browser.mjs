import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';

// #882 (EPIC #881 Lot 3, PR B): daily challenge journey through the real page.
// The RPC transport is an in-page model of the server contract proven by
// fixtures/daily-challenge-882.sql (one row feeds both rankings).
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(evaluate,expression,label=expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+label)}
const OWNER='00000000-0000-4000-8000-000000088301';
const DAY='2026-11-23';
const quest=canonicalQuestList().find(q=>q.legacyIndex===null&&q.gridRevision===2&&!q.packId.startsWith('base'));
const solved=Object.fromEntries(Array.from({length:10},(_,i)=>[i,1]));
const profile={solved,historyBackup:{...solved},badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:{},
 xp:100,shards:10,skyScore:10,skyHistoryVersion:4,walletRevision:1,daily:{dates:{},rewards:{}},challenges:{}};
const board=(me)=>({day:DAY,final:false,closes_at:'2026-11-23T23:00:00Z',my_run:me,
 general:{participants:12,top:[{nickname:'Ana',score:95,rank:1,mine:false},{nickname:'Bo',score:95,rank:1,mine:false},{nickname:'Cy',score:120,rank:3,mine:false}],me:me?.status==='completed'?{rank:5,score:me.score}:null},
 friends:{participants:1,top:me?.status==='completed'?[{nickname:'Moi',score:me.score,rank:1,mine:true}]:[],me:me?.status==='completed'?{rank:1,score:me.score}:null}});

function fixture({signedIn,enabled=true,done=false,preview=false,run=null,beginResume=false,finishFails=false,beginDay=DAY,locale='fr'}){
 return `
  localStorage.clear();
  localStorage.setItem('lumen.locale',${JSON.stringify(locale)});
  localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(profile))});
  for(const k of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen'])localStorage.setItem(k,'1');
  localStorage.setItem('lumenPushChoice','off');
  ${signedIn?`localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(OWNER)});`:''}
  ${done?`localStorage.setItem('lumenDailyDoneV1',${JSON.stringify(JSON.stringify({day:DAY,owner:OWNER}))});`:''}
  window.__dailyCalls=[];let run=${JSON.stringify(run)};let finishFails=${finishFails};
  const now=()=>new Date().toISOString(),closes=new Date(Date.now()+5*3600000).toISOString();
  const DAY=${JSON.stringify(DAY)};const boardOf=${board.toString()};
  window.__setFinishFails=v=>{finishFails=v};
  window.supabase={createClient:()=>({auth:{
   getSession:async()=>(${signedIn}?{data:{session:{user:{id:${JSON.stringify(OWNER)}}}}}:{data:{session:null}}),
   getUser:async()=>(${signedIn}?{data:{user:{id:${JSON.stringify(OWNER)}}}}:{data:{user:null}}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   rpc:async(name,args={})=>{
    window.__allRpc=(window.__allRpc||[]).concat(name);
    if(/^lumen_daily_/.test(name))window.__dailyCalls.push({name,args});
    if(name==='lumen_get_internal_capabilities')return {data:${preview}?['daily_preview']:[]};
    if(name==='lumen_daily_today')return {data:${enabled}?{enabled:true,day:${JSON.stringify(DAY)},quest_id:${JSON.stringify(quest.id)},grid_revision:${quest.gridRevision},closes_at:closes,server_now:now()}:{enabled:false,day:${JSON.stringify(DAY)},server_now:now()}};
    if(name==='lumen_daily_week'){const mine=run?.status==='completed';
     return {data:{monday:DAY,days:Array.from({length:7},(_,i)=>i===0?(mine?{day:DAY,state:'completed',final:false,run,general_rank:5,general_total:12,friends_rank:1,friends_total:1}:{day:DAY,state:run?.status||'missed',final:false}):{day:'2026-11-'+(23+i),state:'future'})}}}
    if(name==='lumen_daily_board'){const b=boardOf(run);b.closes_at=closes;return {data:b}}
    if(name==='lumen_daily_begin'){if(!run)run={day:${JSON.stringify(beginDay)},status:'started',operation_id:args.p_operation_id,started_at:now()};
     return {data:{...run,server_now:now(),resumed:${beginResume}||run.operation_id!==args.p_operation_id}}}
    if(name==='lumen_daily_finish'){if(finishFails)return {data:null,error:{message:'Failed to fetch'}};
     if(run.status==='started')run={...run,status:args.p_status,seconds:args.p_seconds,score:args.p_seconds+args.p_hint*15+(args.p_verify+args.p_guided)*5};return {data:run}}
    if(name==='lumen_ranking_account')return {data:{nicknameRequired:false,withdrawn:false,participating:true}};
    if(name==='lumen_restore_profile')return {data:${JSON.stringify(profile)}};
    if(name==='lumen_get_progress')return {data:Array.from({length:10},(_,i)=>({puzzle_id:i+1}))};
    if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
    if(name==='lumen_cas_profile')return {data:true};
    if(name==='lumen_canonical_command_version'||name==='lumen_legacy_command_version')return {error:{code:'PGRST202'},status:404};
    return {data:[]};
   }})};`;
}
async function open({send,evaluate},url,options,{width=390,height=844,daily=true,training=false,sky=false}={}){
 await send('Emulation.setDeviceMetricsOverride',{width,height,mobile:width<700,deviceScaleFactor:1});
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture(options)});
 const target=new URL(url);target.searchParams.delete('qa');target.searchParams.delete('challenge');
 if(daily)target.searchParams.set('daily','1');else target.searchParams.delete('daily');
 if(training)target.searchParams.set('training','1');else target.searchParams.delete('training');
 if(sky)target.searchParams.set('sky','1');else target.searchParams.delete('sky');
 await navigateAndWait({send,evaluate},'Page.navigate',{url:String(target)});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
}
const solve=`(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`;
const calls=async(evaluate,name)=>(await evaluate('window.__dailyCalls')).filter(c=>c.name===name);
const clockSeconds=async evaluate=>(await evaluate(`document.getElementById('time').textContent`)).trim().split(':').map(Number).reduce((t,p)=>t*60+p,0);

export async function verifyDailyChallenge({send,evaluate},url,{captureDir=process.env.LUMEN_DAILY_CAPTURES||null}={}){
 assert(quest,'premium revised quest for the daily grid');
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase*']});
 const results=[];

 // #1003: public discovery reads lumen_daily_today at most once per session and
 // day (boot, Mon ciel and Social reuse the memo). Closed: nothing is shown.
 for(const signedIn of [false,true]){
  await open({send,evaluate},url,{signedIn,enabled:false},{daily:false});
  await acknowledgeLearningMilestones(evaluate);
  await evaluate("document.getElementById('openSky').click()");
  await sleep(400);
  await evaluate("document.getElementById('closeMap')?.click()");await evaluate("document.getElementById('openSky').click()");await sleep(300);
  assert((await calls(evaluate,'lumen_daily_today')).length<=(signedIn?2:1),'one discovery read per session and day (re-read once after sign-in while closed)');
  assert.equal(await evaluate("document.getElementById('openDaily').hidden"),true);
  assert.equal(await evaluate("document.getElementById('dailyChip').hidden"),true,'no header chip while closed');
 }
 // Open to everyone: the header chip is visible on the main screen without
 // opening Mon ciel or Social, keeps the header on one row and leaves the grid
 // untouched; one read serves the chip, Mon ciel and Social.
 for(const [width,height] of [[320,640],[360,740],[390,844],[1280,800]]){
  for(const signedIn of [false,true]){
   await open({send,evaluate},url,{signedIn,enabled:true},{daily:false,width,height});
   await acknowledgeLearningMilestones(evaluate);
   await until(evaluate,"!document.getElementById('dailyChip').hidden",'header daily chip');
   const layout=await evaluate(`(()=>{const chip=document.getElementById('dailyChip').getBoundingClientRect(),head=document.querySelector('.head').getBoundingClientRect(),acts=document.querySelector('.head-actions').getBoundingClientRect(),brand=document.querySelector('.head h1').getBoundingClientRect();
    return {chipH:chip.height,chipW:chip.width,oneRow:Math.abs(chip.top+chip.height/2-(acts.top+acts.height/2))<6,noOverlap:chip.left>=brand.right-1&&chip.right<=acts.left+1,headH:head.height,scrollX:document.documentElement.scrollWidth>innerWidth}})()`);
   assert(layout.chipH>=44&&layout.chipW>=44,'44 px touch target '+JSON.stringify(layout));
   assert(layout.oneRow&&layout.noOverlap&&!layout.scrollX,'chip stays in the header row '+width+' '+JSON.stringify(layout));
   assert.equal(await evaluate("document.getElementById('dailyChip').dataset.state"),'open');
   // #1013: monochrome header-icon charter, no permanent yellow; a cyan dot marks « to play ».
   assert.deepEqual(await evaluate(`(()=>{const c=getComputedStyle(document.getElementById('dailyChip')),h=getComputedStyle(document.getElementById('openSocial'));return {color:c.color===h.color,border:c.borderTopColor===h.borderTopColor,background:c.backgroundColor===h.backgroundColor,emoji:/🏆/.test(document.getElementById('dailyChip').textContent),svg:!!document.querySelector('#dailyChip svg.daily-icon')}})()`),{color:true,border:true,background:true,emoji:false,svg:true},'daily chip uses the header-icon palette');
   await evaluate("document.getElementById('openSky').click()");await sleep(300);
   assert.equal(await evaluate("document.getElementById('openDaily').hidden"),false,'Mon ciel keeps its entry');
   assert.equal((await calls(evaluate,'lumen_daily_today')).length,1,'chip and Mon ciel share one read');
   if(captureDir&&signedIn){await evaluate("document.getElementById('closeMap')?.click()");await sleep(6000);const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(captureDir,`daily-chip-${width}.png`),Buffer.from(shot.data,'base64'))}
  }
 }
 // A finished player is not invited again: the chip shows ✓ and still opens
 // the daily screen (result and ranking), which owns the one-attempt rule.
 await open({send,evaluate},url,{signedIn:true,enabled:true,done:true},{daily:false});
 await until(evaluate,"!document.getElementById('dailyChip').hidden",'done chip');
 assert.equal(await evaluate("document.getElementById('dailyChip').dataset.state"),'done');
 assert.match(await evaluate("document.getElementById('dailyChip').getAttribute('aria-label')"),/déjà joué/);
 // #898: Mon ciel and Social show the same « already played » state (Social mirrors Mon ciel).
 await evaluate("document.getElementById('openSky').click()");
 await until(evaluate,"/déjà joué/.test(document.getElementById('dailyEntryState').textContent)",'Mon ciel done state');
 await evaluate("document.getElementById('closeMap')?.click()");await evaluate("document.getElementById('openSocial').click()");
 await until(evaluate,"/déjà joué/.test(document.getElementById('socialDailyState')?.textContent||'')",'Social done state');
 await evaluate("document.querySelector('#socialHub [data-social-close], #socialHubClose')?.click()");
 await evaluate("document.getElementById('dailyChip').click()");
 await until(evaluate,`new URL(location.href).searchParams.get('daily')==='1'&&!!window.lumenDiagnostics`,'chip opens the daily');
 results.push({kind:'header-chip'});

 // Disabled: no entry in « Mes quêtes », ?daily=1 falls back to the campaign.
 await open({send,evaluate},url,{signedIn:false,enabled:false});
 await sleep(400);
 assert.equal(await evaluate(`document.body.classList.contains('daily-mode')`),false,'disabled mode never skins the campaign');
 await evaluate(`document.getElementById('openSky').click()`);await sleep(300);
 assert.equal(await evaluate(`document.getElementById('openDaily').hidden`),true,'no entry while disabled');
 results.push({kind:'disabled'});

 // Entry from « Mes quêtes » (Mon ciel).
 await open({send,evaluate},url,{signedIn:true,preview:true},{daily:false});
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('openSky').click()`);
 await until(evaluate,`!document.getElementById('openDaily').hidden`,'daily entry');
 assert.match(await evaluate(`document.getElementById('dailyEntryState').textContent`),/23 novembre · fin dans/);
 const campaignCell=await evaluate(`(()=>{const c=document.querySelector('#board .cell');const s=getComputedStyle(c);return {bg:s.backgroundColor,color:s.color,border:s.borderTopColor}})()`);
 await evaluate(`document.getElementById('openDaily').click()`);
 await until(evaluate,`new URL(location.href).searchParams.get('daily')==='1'&&!!window.lumenDiagnostics`,'daily link');
 results.push({kind:'entry'});

 // Guest: intro explains ranking needs an account; training only, no server write.
 await open({send,evaluate},url,{signedIn:false});
 await until(evaluate,`!document.getElementById('dailyIntro').hidden`,'guest intro');
 assert.equal(await evaluate(`document.body.classList.contains('daily-mode')`),true,'distinct daily skin');
 assert.match(await evaluate(`document.getElementById('dailyIntroDate').textContent`),/lundi 23 novembre/);
 assert.match(await evaluate(`document.getElementById('dailyIntro').textContent`),/1 tentative officielle/);
 assert.match(await evaluate(`document.getElementById('dailyIntroStatus').textContent`),/Connecte-toi pour être classé/);
 assert.equal(await evaluate(`document.getElementById('dailyStart').hidden`),true,'no official attempt without an account');
 await evaluate(`document.getElementById('dailyTraining').click()`);
 await until(evaluate,`document.getElementById('dailyIntro').hidden`,'guest training');
 await acknowledgeLearningMilestones(evaluate);
 assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),quest.reg,'free premium grid at its pinned revision');
 assert.match(await evaluate(`document.getElementById('dailyBannerMeta').textContent`),/Entraînement non classé/);
 const saved=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
 await evaluate(`document.getElementById('attemptMask')?.click()`);await evaluate(solve);
 await until(evaluate,`!document.getElementById('dailyResultModal').hidden`,'training result');
 assert.match(await evaluate(`document.getElementById('dailyResultTitle').textContent`),/Entraînement terminé/);
 assert.equal((await calls(evaluate,'lumen_daily_begin')).length+(await calls(evaluate,'lumen_daily_finish')).length,0,'training never writes a ranked result');
 assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),saved,'no campaign progress, reward or Adventure access');
 results.push({kind:'guest-training'});

 // Signed in: one official attempt, themed grid, both rankings from one result.
 for(const [width,height,locale='fr'] of [[360,640],[390,844],[1440,900],[360,640,'en']]){
  if(captureDir&&width!==360){
   await open({send,evaluate},url,{signedIn:true},{width,height,daily:false});
   await until(evaluate,`!!document.querySelector('#board .cell')`,'campaign board');await acknowledgeLearningMilestones(evaluate);await evaluate(`document.getElementById('attemptMask')?.click()`);await sleep(600);
   fs.writeFileSync(captureDir+'/daily-compare-campaign-'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await open({send,evaluate},url,{signedIn:true,locale},{width,height});
  await until(evaluate,`!document.getElementById('dailyIntro').hidden`,'official intro');
  assert.equal(await evaluate(`document.getElementById('dailyStart').textContent`),locale==='en'?'Start the challenge':'Relever le défi');
  if(locale==='en')assert.match(await evaluate(`document.getElementById('dailyIntroDate').textContent`),/Monday.*November/);
  assert.equal(await evaluate(`document.getElementById('dailyTraining').hidden`),true,'no training before the official attempt');
  await evaluate(`document.getElementById('dailyStart').click()`);
  await until(evaluate,`document.getElementById('dailyIntro').hidden`,'official start');
  await acknowledgeLearningMilestones(evaluate);
  assert.equal((await calls(evaluate,'lumen_daily_begin')).length,1,'one begin');
  assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),quest.reg,'same pinned grid for everyone');
  assert.match(await evaluate(`document.getElementById('dailyBannerMeta').textContent`),locale==='en'?/1 official attempt · ends in/:/1 tentative officielle · fin dans/);
  assert.equal(await evaluate(`(()=>{const b=document.getElementById('dailyBanner'),r=b.getBoundingClientRect();return r.height>0&&r.top>=0&&b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))})()`),true,'daily banner visible above the grid at '+width);
  if(locale==='en'){
   const before=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().state)');
   await evaluate("document.getElementById('tutorialHelp').click()");
   await until(evaluate,"!document.getElementById('rulesModal').hidden");
   for(const [mode,copy] of [['fr',/1 tentative officielle/],['en',/1 official attempt/]]){
    await evaluate("(()=>{const select=document.getElementById('gameLocaleMode');select.value="+JSON.stringify(mode)+";select.dispatchEvent(new Event('change',{bubbles:true}));})()");
    assert.match(await evaluate("document.getElementById('dailyBannerMeta').textContent"),copy);
   }
   await evaluate("document.getElementById('closeRulesModal').click()");
   assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().state)'),before);
   assert.equal((await calls(evaluate,'lumen_daily_begin')).length,1,'language change keeps the same official run');
  }
  const dailyCell=await evaluate(`(()=>{const c=document.querySelector('#board .cell');const s=getComputedStyle(c);return {bg:s.backgroundColor,color:s.color,border:s.borderTopColor}})()`);
  assert.deepEqual(dailyCell,campaignCell,'grid cells keep their campaign look and meaning');
  assert.match(await evaluate(`getComputedStyle(document.getElementById('board')).boxShadow`),/242, 201, 107/,'gold daily frame');
  assert.equal(await evaluate(`getComputedStyle(document.getElementById('masteryLive')).display`),'none','no badge promise in the daily mode');
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'no horizontal scroll at '+width);
  await evaluate(`document.getElementById('attemptMask')?.click()`);await sleep(300);
  if(captureDir&&width!==360)fs.writeFileSync(captureDir+'/daily-compare-daily-'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(solve);
  await until(evaluate,`!document.getElementById('dailyResultModal').hidden`,'official result');
  const finish=await calls(evaluate,'lumen_daily_finish');
  assert.equal(finish.length,1);assert.equal(finish[0].args.p_status,'completed');assert.equal(finish[0].args.p_day,DAY);
  assert.deepEqual(['p_hint','p_verify','p_guided'].map(k=>typeof finish[0].args[k]),['number','number','number'],'aid counts sent for official penalties');
  assert.match(await evaluate(`document.getElementById('dailyBoardPanel').textContent`),locale==='en'?/1stAna.*1stBo.*3rdCy.*Your rank: 5th.*12 participants/s:/1erAna.*1erBo.*3eCy.*Ta position : 5e.*12 participants/s,'general top 3 with ties + my position');
  await evaluate(`document.getElementById('dailyTabFriends').click()`);
  assert.equal(await evaluate(`document.getElementById('dailyTabFriends').getAttribute('aria-selected')`),'true');
  assert.match(await evaluate(`document.getElementById('dailyBoardPanel').textContent`),locale==='en'?/Moi \(you\).*None of your friends has played today/s:/Moi \(toi\).*Aucun de tes amis n’a encore joué/s,'explicit empty friends state');
  const layout=await evaluate(`(()=>{const c=document.getElementById('dailyContinue').getBoundingClientRect(),card=document.querySelector('#dailyResultModal .social-card');return {inside:c.top>=0&&c.bottom<=innerHeight,primary:document.getElementById('dailyContinue').classList.contains('primary'),cardScroll:card.scrollHeight-card.clientHeight}})()`);
  assert.equal(layout.inside&&layout.primary,true,'« Mon ciel » is the visible primary action at '+width+'x'+height);
  assert.equal(await evaluate(`document.getElementById('dailyContinue').textContent`),locale==='en'?'My Sky':'Mon ciel');
  assert.equal(await evaluate(`!!document.querySelector('#dailyShare,#dailyWeekShare')`),false,'#1013: no Défi du jour share action');
  if(captureDir&&width!==360)fs.writeFileSync(captureDir+'/daily-compare-result-'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  // « Ta semaine dans les étoiles » from the result (own days only).
  assert.equal(await evaluate(`document.getElementById('dailyWeekFromResult').hidden`),false,'week entry after the official result');
  await evaluate(`document.getElementById('dailyWeekFromResult').click()`);
  await until(evaluate,`!document.getElementById('dailyWeekModal').hidden&&document.querySelectorAll('#dailyWeekBody .daily-week-day').length===7`,'week summary');
  assert.equal(await evaluate(`document.querySelector('#dailyWeekBody .daily-week-day').className`),'daily-week-day completed provisional','today played, ranking still provisional');
  assert.match(await evaluate(`document.getElementById('dailyWeekBody').textContent`),locale==='en'?/Challenges played1\/7.*Best overall rank5th of 12.*Rankings are provisional/s:/Participations1\/7.*Meilleur rang général5e sur 12.*Classements provisoires/s);
  assert.doesNotMatch(await evaluate(`document.getElementById('dailyWeekBody').textContent`),/Ana|Cy/,'no other player in the weekly summary');
  assert.equal(await evaluate(`document.getElementById('dailyWeekPrev').disabled&&document.getElementById('dailyWeekNext').disabled`),true,'first week: no past, no future');
  assert.equal((await calls(evaluate,'lumen_daily_week'))[0].args.p_day,DAY);
  const weekLayout=await evaluate(`(()=>{const c=document.getElementById('dailyWeekClose').getBoundingClientRect();return c.top>=0&&c.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth})()`);
  assert.equal(weekLayout,true,'week summary fits at '+width+'x'+height);
  if(captureDir&&width!==360)fs.writeFileSync(captureDir+'/daily-week-'+width+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  if(locale==='en'){
   assert.equal(await evaluate(`document.getElementById('dailyWeekPrev').getAttribute('aria-label')`),'Previous week');
  }
  await evaluate(`document.getElementById('dailyWeekClose').click()`);
  assert.equal(await evaluate(`document.getElementById('dailyWeekModal').hidden`),true);
  assert.equal((await evaluate('window.__allRpc')).includes('lumen_track_event'),false,'daily measurement never enables disabled collection');
  results.push({kind:'official',width,height,locale,cardScroll:layout.cardScroll});
 }

 // Resume on another device: the clock restarts from the server elapsed time.
 await open({send,evaluate},url,{signedIn:true,run:{status:'started',operation_id:'daily-elsewhere',started_at:new Date(Date.now()-300000).toISOString()},beginResume:true});
 await until(evaluate,`!document.getElementById('dailyIntro').hidden`,'resume intro');
 assert.equal(await evaluate(`document.getElementById('dailyStart').textContent`),'Reprendre ma tentative');
 await evaluate(`document.getElementById('dailyStart').click()`);
 await until(evaluate,`document.getElementById('dailyIntro').hidden`,'resume start');
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('attemptMask')?.click()`);await sleep(300);
 assert((await clockSeconds(evaluate))>=295,'no blank clock on another device');
 await evaluate(solve);
 await until(evaluate,`!document.getElementById('dailyResultModal').hidden`,'resume result');
 assert.equal((await calls(evaluate,'lumen_daily_finish'))[0].args.p_operation_id,'daily-elsewhere','finish the same official attempt');
 results.push({kind:'resume'});

 // Intro left open across midnight Paris: the server begins the NEW day. The
 // client must never play yesterday's grid against that attempt; it reloads.
 await open({send,evaluate},url,{signedIn:true,beginDay:'2026-11-24'});
 await until(evaluate,`!document.getElementById('dailyIntro').hidden`,'midnight intro');
 await evaluate(`window.__beforeMidnight=1;document.getElementById('dailyStart').click()`);
 await until(evaluate,`window.__beforeMidnight===undefined&&!!window.lumenDiagnostics`,'reload on the server day');
 assert.equal(new URL(await evaluate('location.href')).searchParams.get('daily'),'1','reopens the daily mode');
 results.push({kind:'midnight-begin'});

 // Already played: frozen result, then explicit unranked training.
 await open({send,evaluate},url,{signedIn:true,run:{status:'completed',operation_id:'done',score:150,seconds:150}});
 await until(evaluate,`!document.getElementById('dailyResultModal').hidden`,'frozen result');
 assert.equal(await evaluate(`document.getElementById('dailyIntro').hidden`),true,'no second official attempt');
 assert.match(await evaluate(`document.getElementById('dailyResultTime').textContent`),/2:30/);
 // #1013: « Mon ciel » leaves the daily and really lands on Mon ciel, once.
 await evaluate(`window.__beforeSky=1;document.getElementById('dailyContinue').click()`);
 await until(evaluate,`window.__beforeSky===undefined&&!!window.lumenDiagnostics`,'« Mon ciel » leaves the daily');
 assert.equal(new URL(await evaluate('location.href')).searchParams.get('daily'),null,'« Mon ciel » leaves the daily mode');
 await open({send,evaluate},url,{signedIn:true,enabled:true,done:true},{daily:false,sky:true});
 await until(evaluate,`!document.getElementById('mapModal').hidden`,'Mon ciel is open');
 assert.equal(new URL(await evaluate('location.href')).searchParams.has('sky'),false,'the one-shot sky hint is consumed');
 await open({send,evaluate},url,{signedIn:true,run:{status:'completed',operation_id:'done',score:150,seconds:150}});
 await until(evaluate,`!document.getElementById('dailyResultModal').hidden`,'frozen result again');
 await evaluate(`document.getElementById('dailyTrainAgain').click()`);
 await until(evaluate,`new URL(location.href).searchParams.get('training')==='1'&&!!window.lumenDiagnostics`,'training link');
 // The click reloads the page; reopen that exact URL with the same server model.
 await open({send,evaluate},url,{signedIn:true,run:{status:'completed',operation_id:'done',score:150,seconds:150}},{training:true});
 await until(evaluate,`/Entraînement non classé/.test(document.getElementById('dailyBannerMeta').textContent)`,'training banner');
 assert.equal(await evaluate(`document.getElementById('dailyIntro').hidden&&document.getElementById('dailyResultModal').hidden`),true);
 assert.equal((await calls(evaluate,'lumen_daily_begin')).length,0,'training never begins an official attempt');
 results.push({kind:'training-after-official'});

 // Intermittent connection: the result is kept and sent later, never lost or doubled.
 await open({send,evaluate},url,{signedIn:true,finishFails:true});
 await until(evaluate,`!document.getElementById('dailyIntro').hidden`,'offline intro');
 await evaluate(`document.getElementById('dailyStart').click()`);
 await until(evaluate,`document.getElementById('dailyIntro').hidden`,'offline start');
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('attemptMask')?.click()`);await evaluate(solve);
 await until(evaluate,`!document.getElementById('dailyResultModal').hidden`,'pending result');
 assert.match(await evaluate(`document.getElementById('dailyResultNote').textContent`),/envoi en attente/);
 assert(await evaluate(`!!localStorage.getItem('lumenDailyPendingV1')`),'pending result kept on the device');
 await evaluate(`window.__setFinishFails(false);document.getElementById('dailyRetrySubmit').click()`);
 await until(evaluate,`!localStorage.getItem('lumenDailyPendingV1')`,'pending sent');
 await until(evaluate,`/Ta position/.test(document.getElementById('dailyBoardPanel').textContent)`,'board after retry');
 results.push({kind:'offline-retry'});
 return results;
}
