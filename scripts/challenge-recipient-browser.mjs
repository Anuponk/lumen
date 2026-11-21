import assert from 'node:assert/strict';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';
import {canonicalQuestList} from '../src/campaign/canonical-quests.js';
import {CONTENT_PACKS} from '../src/campaign/content.js';

// #883 (Lot 0, EPIC #881): recipient side of a one-shot challenge through the
// real page. The RPC transport is an in-page model of the server contract
// (lowercase terminal status, hidden source until the attempt ends, immutable
// first result); the SQL itself is proven by fixtures/challenge-rpc-matrix.sql.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(evaluate,expression,label=expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+label)}

const included=CONTENT_PACKS.find(p=>p.access==='included').id;
const quests=canonicalQuestList();
const legacyPremium=quests.find(q=>q.legacyIndex!==null&&q.packId!==included);
const stableZero=quests.find(q=>q.legacyIndex===null&&!q.gridRevision&&q.packId!==included);
const stableRevised=quests.find(q=>q.legacyIndex===null&&q.gridRevision>1&&q.packId!==included);
function identity(quest){return {puzzle_id:quest.legacyIndex===null?null:quest.legacyIndex+1,stable_quest_id:quest.id,grid_revision:quest.legacyIndex===null?quest.gridRevision??0:0}}
const CHALLENGE_ID='00000000-0000-4000-8000-000000000883';

// startedAgoMs: the caller's participation start as the #888 server reports it
// (null = older server without that fact). sourceFirstPlay: #889 provenance.
function serverModel({quest,participant=null,inbox=[],startedAgoMs=null,sourceFirstPlay=true}){
 return `
  window.__challengeCalls=[];
  const challenge=${JSON.stringify({challenge_id:CHALLENGE_ID,sender_display_name:'Source',created_at:'2026-11-20T10:00:00Z',...identity(quest)})};
  const source={source_duration_seconds:61,source_autonomy:true,source_speed:true,source_mastery:true,source_assistance_used:false};
  let participant=${JSON.stringify(participant)};
  const view=()=>({...challenge,participant_status:participant?.status??null,participant_display_name:participant?'Fixture':null,previously_played:false,
   ...(participant&&participant.status!=='started'?source:Object.fromEntries(Object.keys(source).map(k=>[k,null]))),
   participant_duration_seconds:participant?.duration??null,participant_autonomy:participant?.autonomy??null,participant_speed:null,participant_mastery:participant?.mastery??null,participant_assistance_used:participant?.assisted??null,
   source_first_play:${JSON.stringify(sourceFirstPlay)},server_now:new Date().toISOString(),participant_started_at:participant&&${JSON.stringify(startedAgoMs)}!==null?new Date(Date.now()-${JSON.stringify(startedAgoMs)}).toISOString():null});
  window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange(){}},rpc:async(name,args)=>{
   window.__challengeCalls.push({name,args});
   if(name==='lumen_get_quest_challenge_v2')return {data:args.p_challenge_id===challenge.challenge_id?view():null,error:null};
   if(name==='lumen_list_quest_challenges_v2')return {data:${JSON.stringify(inbox)},error:null};
   if(/^lumen_start_/.test(name)){participant=participant||{status:'started'};return {data:[{participation_id:'p-883',status:participant.status}],error:null}}
   if(/^lumen_finish_/.test(name)){if(participant?.status==='started')participant={status:args.p_status,duration:args.p_duration_seconds,autonomy:args.p_autonomy,mastery:args.p_mastery,assisted:args.p_assistance_used};return {data:[{participation_id:'p-883',status:participant.status}],error:null}}
   return {data:[],error:null};
  }})};`;
}

async function open({send,evaluate},url,model,{width=390,challenge=true,newcomer=false,keepAttempt=false}={}){
 await send('Emulation.setDeviceMetricsOverride',{width,height:900,mobile:width<700,deviceScaleFactor:1});
 // A guest who has only played the first free quests and owns no Adventure.
 // newcomer: a first visit through the link, before any tutorial (#881 Lot 1).
 const progress=newcomer?{solved:{},performances:{},xp:0,shards:0,badges:{}}:{solved:Object.fromEntries(Array.from({length:10},(_,i)=>[i,1])),performances:{},xp:40,shards:2,badges:{}};
 const fixture=await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.setItem('lumenQaProgressV1',${JSON.stringify(JSON.stringify(progress))});
  ${keepAttempt?'':"localStorage.removeItem('lumenQaActiveAttemptV1');localStorage.removeItem('lumenActiveAttemptV1');localStorage.removeItem('lumenQualifyingStartsV1');"}
  localStorage.setItem('lumenGuestName','Fixture');localStorage.setItem('lumenPushChoice','off');
  for(const k of ['lumenQaTutorialSeen','lumenQaTutorialCompletedV1','lumenSkyTourSeen'])${newcomer?'localStorage.removeItem(k)':"localStorage.setItem(k,'1')"};
  ${model}`});
 const target=new URL(url);if(challenge)target.searchParams.set('challenge',CHALLENGE_ID);else target.searchParams.delete('challenge');
 await navigateAndWait({send,evaluate},'Page.navigate',{url:String(target)});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:fixture.identifier});
 return progress;
}

export async function verifyChallengeRecipient({send,evaluate},url){
 assert(legacyPremium&&stableZero&&stableRevised,'fixture quests for the three challenge kinds');
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase*']});
 const results=[];
 for(const [kind,quest,width] of [['legacy-premium',legacyPremium,390],['stable-zero',stableZero,1440],['stable-revised',stableRevised,390]]){
  await open({send,evaluate},url,serverModel({quest}),{width});
  await until(evaluate,`!document.getElementById('challengeIntro').hidden`,kind+' intro');
  const intro=await evaluate(`document.getElementById('challengeIntroCopy').textContent`);
  assert.match(intro,new RegExp('quête '+quest.ordinal+'\\b'),kind+': intro names the visible quest number');
  assert.doesNotMatch(intro,/61|1:01|Maîtrise/,kind+': source performance stays hidden before the attempt');
  await evaluate(`document.getElementById('challengeStart').click()`);
  await until(evaluate,`document.getElementById('challengeIntro').hidden`,kind+' start');
  await acknowledgeLearningMilestones(evaluate);
  const revision=identity(quest).grid_revision;
  const saved=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)');
  const started=(await evaluate('window.__challengeCalls')).filter(c=>/^lumen_start_/.test(c.name));
  assert.equal(started.length,1,kind+': one start');
  assert.equal(started[0].name,revision?'lumen_start_quest_challenge_v2':'lumen_start_social_challenge',kind+': start route follows the stored grid revision');
  if(revision)assert.equal(started[0].args.p_grid_revision,revision);
  // Same grid as the sender, even though this guest owns no Adventure.
  const board=await evaluate('lumenDiagnostics.snapshot().puz.reg');
  const levelIndex=await evaluate('lumenDiagnostics.snapshot().levelIndex');
  assert.deepEqual(board,quest.reg,kind+': recipient plays exactly the challenged grid (levelIndex '+levelIndex+', expected '+quest.legacyIndex+')');
  await evaluate(`document.getElementById('attemptMask')?.click()`);
  await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
  await until(evaluate,`!document.getElementById('challengeResultModal').hidden`,kind+' result');
  const finished=(await evaluate('window.__challengeCalls')).filter(c=>/^lumen_finish_/.test(c.name));
  assert.equal(finished.length,1,kind+': one finish');
  assert.equal(finished[0].name,revision?'lumen_finish_quest_challenge_v2':'lumen_finish_social_challenge',kind+': finish route follows the stored grid revision');
  assert.equal(finished[0].args.p_status,'completed');
  assert.match(await evaluate(`document.getElementById('challengeResultBody').textContent`),/Source/,kind+': source revealed after the attempt');
  // Baseline taken after init(): only the challenge victory itself is compared.
  const after=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().progress)'),changed=Object.keys({...JSON.parse(saved),...JSON.parse(after)}).filter(k=>JSON.stringify(JSON.parse(saved)[k])!==JSON.stringify(JSON.parse(after)[k]));
  assert.deepEqual(changed,[],kind+': no campaign progress, reward or Adventure access from a challenge');
  assert.equal(await evaluate(`document.getElementById('skyReveal').hidden`),true,kind+': no campaign victory scene');
  results.push({kind,width,quest:quest.id,ordinal:quest.ordinal,gridRevision:revision,sameGrid:true});
 }

 // Reopening a finished link shows the result; it never offers a second attempt.
 await open({send,evaluate},url,serverModel({quest:legacyPremium,participant:{status:'completed',duration:44,autonomy:true,mastery:false,assisted:false}}));
 await until(evaluate,`!document.getElementById('challengeResultModal').hidden`,'terminal result');
 assert.equal(await evaluate(`document.getElementById('challengeIntro').hidden`),true,'No intro for a finished challenge');
 assert.equal((await evaluate('window.__challengeCalls')).filter(c=>/^lumen_start_/.test(c.name)).length,0,'No second start');
 results.push({kind:'terminal-reopen',secondAttempt:false});

 // A player who never saw the tutorial learns the rules before starting; reading
 // them consumes no attempt (#881 Lot 1, acquisition through Défier).
 await open({send,evaluate},url,serverModel({quest:legacyPremium}),{newcomer:true});
 await until(evaluate,`!document.getElementById('challengeIntro').hidden`,'newcomer intro');
 assert.equal(await evaluate(`document.getElementById('challengeRules').hidden`),false,'Newcomer sees the rules summary');
 assert.match(await evaluate(`document.getElementById('challengeRules').textContent`),/ligne.*colonne.*territoire/s);
 assert.equal(await evaluate(`(()=>{const b=document.getElementById('challengeStart').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight})()`),true,'"Relever le défi" stays visible without scrolling');
 await evaluate(`document.getElementById('challengeRulesOpen').click()`);
 const rulesOnTop=await evaluate(`(()=>{const m=document.getElementById('rulesModal');if(m.hidden)return false;const c=document.getElementById('closeRulesModal').getBoundingClientRect();return m.contains(document.elementFromPoint(c.left+c.width/2,c.top+c.height/2))})()`);
 assert.equal(rulesOnTop,true,'Rules open above the challenge intro');
 assert.equal(await evaluate(`['replayLearning','replayIntroduction'].every(id=>{const e=document.getElementById(id);return !e||e.hidden})`),true,'No learning replay offered inside a challenge');
 await evaluate(`document.getElementById('closeRulesModal').click()`);
 assert.equal(await evaluate(`!document.getElementById('challengeIntro').hidden`),true,'Closing the rules returns to the challenge intro');
 assert.equal((await evaluate('window.__challengeCalls')).filter(c=>/^lumen_start_/.test(c.name)).length,0,'Reading the rules does not start the one-shot attempt');
 results.push({kind:'newcomer-rules',attemptConsumed:false});

 // A returning player is not slowed down by the summary. During the attempt the
 // help stays available, but learning replays can never swap the challenged grid.
 await open({send,evaluate},url,serverModel({quest:legacyPremium}));
 await until(evaluate,`!document.getElementById('challengeIntro').hidden`,'returning intro');
 assert.equal(await evaluate(`document.getElementById('challengeRules').hidden`),true,'Returning player: no rules summary');
 await evaluate(`document.getElementById('challengeStart').click()`);
 await until(evaluate,`document.getElementById('challengeIntro').hidden`,'returning start');
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('tutorialHelp').click()`);
 assert.equal(await evaluate(`['replayLearning','replayIntroduction'].every(id=>{const e=document.getElementById(id);return !e||e.hidden})`),true,'Help hides learning replays during a challenge');
 // Even a forced activation of the hidden control keeps the challenged grid.
 await evaluate(`document.getElementById('replayLearning')?.click()`);
 await sleep(400);
 assert.deepEqual(await evaluate('lumenDiagnostics.snapshot().puz.reg'),legacyPremium.reg,'Learning replay cannot replace the challenged grid');
 await evaluate(`document.getElementById('closeRulesModal').click()`);
 results.push({kind:'learning-replay-blocked',sameGrid:true});

 // #889: a reference from a qualifying replay is announced before the attempt.
 await open({send,evaluate},url,serverModel({quest:legacyPremium,sourceFirstPlay:false}));
 await until(evaluate,`!document.getElementById('challengeIntro').hidden`,'replay provenance intro');
 assert.match(await evaluate(`document.getElementById('challengeIntroCopy').textContent`),/rejeu qualifiant/,'Replay provenance is honest');
 results.push({kind:'replay-provenance'});

 // #888: started on another device (no local attempt): the clock resumes at the
 // server-measured elapsed time, never from zero; the same participation is reused.
 const clockSeconds=async()=>{const parts=(await evaluate(`document.getElementById('time').textContent`)).trim().split(':').map(Number);return parts.reduce((t,p)=>t*60+p,0)};
 await open({send,evaluate},url,serverModel({quest:legacyPremium,participant:{status:'started'},startedAgoMs:450_000}));
 await until(evaluate,`!document.getElementById('challengeIntro').hidden`,'cross-device intro');
 assert.equal(await evaluate(`document.getElementById('challengeStart').textContent`),'Reprendre le défi');
 assert.match(await evaluate(`document.getElementById('challengeIntroCopy').textContent`),/autre appareil.*7:30/s,'The resume explains the counted time');
 await evaluate(`document.getElementById('challengeStart').click()`);
 await until(evaluate,`document.getElementById('challengeIntro').hidden`,'cross-device resume');
 await acknowledgeLearningMilestones(evaluate);
 assert((await clockSeconds())>=450,'Resumed clock is never blank: '+(await clockSeconds()));
 await evaluate(`document.getElementById('attemptMask')?.click()`);
 await evaluate(`(()=>{const s=lumenDiagnostics.snapshot();lumenDiagnostics.setBoard(s.puz.sol.map(c=>Array.from({length:s.n},(_,i)=>i===c?2:0)))})()`);
 await until(evaluate,`!document.getElementById('challengeResultModal').hidden`,'cross-device result');
 const resumedFinish=(await evaluate('window.__challengeCalls')).filter(c=>/^lumen_finish_/.test(c.name));
 assert.equal(resumedFinish.length,1);assert(resumedFinish[0].args.p_duration_seconds>=450,'Finished time includes the elapsed time: '+resumedFinish[0].args.p_duration_seconds);
 results.push({kind:'resume-other-device',seconds:resumedFinish[0].args.p_duration_seconds});

 // #888 without server proof (older server): the resume is refused, not restarted.
 await open({send,evaluate},url,serverModel({quest:legacyPremium,participant:{status:'started'},startedAgoMs:null}));
 await until(evaluate,`!document.getElementById('challengeIntro').hidden`,'blocked intro');
 assert.equal(await evaluate(`document.getElementById('challengeStart').hidden`),true,'No blank clock without proof');
 assert.match(await evaluate(`document.getElementById('challengeIntroCopy').textContent`),/Termine-le là-bas/);
 results.push({kind:'resume-blocked'});

 // #888 same browser: the local attempt and its own time win over the server
 // elapsed time (here one hour, which would be visible if wrongly used).
 await open({send,evaluate},url,serverModel({quest:legacyPremium}));
 await until(evaluate,`!document.getElementById('challengeIntro').hidden`,'same-browser first intro');
 await evaluate(`document.getElementById('challengeStart').click()`);
 await until(evaluate,`document.getElementById('challengeIntro').hidden`,'same-browser start');
 await acknowledgeLearningMilestones(evaluate);
 await evaluate(`document.getElementById('attemptMask')?.click()`);
 await sleep(2_500);
 const before=await clockSeconds();
 await open({send,evaluate},url,serverModel({quest:legacyPremium,participant:{status:'started'},startedAgoMs:3_600_000}),{keepAttempt:true});
 await until(evaluate,`!document.getElementById('challengeIntro').hidden`,'same-browser resume intro');
 assert.equal(await evaluate(`document.getElementById('challengeStart').textContent`),'Reprendre le défi');
 assert.doesNotMatch(await evaluate(`document.getElementById('challengeIntroCopy').textContent`),/autre appareil/);
 await evaluate(`document.getElementById('challengeStart').click()`);
 await until(evaluate,`document.getElementById('challengeIntro').hidden`,'same-browser resume');
 const after=await clockSeconds();
 assert(after>=before&&after<600,'Same browser keeps its own clock: '+before+' -> '+after);
 results.push({kind:'resume-same-browser',before,after});

 // "Mes défis" shows the visible quest number for all kinds, never "null" or a legacy index.
 const inbox=[legacyPremium,stableZero,stableRevised].map((quest,i)=>({challenge_id:'00000000-0000-4000-8000-00000000088'+i,created_at:'2026-11-20T10:00:00Z',
  ...identity(quest),source_duration_seconds:60,source_autonomy:true,source_speed:false,source_mastery:false,participant_count:1,unread_count:0,
  participants:[{name:'Ami',status:'completed',duration_seconds:50,autonomy:true,speed:false,mastery:false,previously_played:false}]}));
 await open({send,evaluate},url,serverModel({quest:legacyPremium,inbox}),{width:1440,challenge:false});
 await evaluate(`document.getElementById('openMyChallenges').click()`);
 await until(evaluate,`document.querySelectorAll('#myChallengesList .challenge-list-item').length===3`,'Mes défis rows');
 const labels=await evaluate(`[...document.querySelectorAll('#myChallengesList .challenge-compact-quest')].map(x=>x.textContent)`);
 assert.deepEqual(labels,[legacyPremium,stableZero,stableRevised].map(q=>'Quête '+q.ordinal),'Mes défis uses canonical visible numbers');
 results.push({kind:'my-challenges',labels});
 return results;
}
