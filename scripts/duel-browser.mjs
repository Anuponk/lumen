import assert from 'node:assert/strict';
import fs from 'node:fs';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';

// #896: readable friend duels through the real page. RPCs are in-page models of
// the #18/#35/#889 contracts (list_quest_challenges_v2, challenge_inbox, get_v2).
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(evaluate,expression,label=expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+label)}
const OWNER='00000000-0000-4000-8000-000000089601';
const id=n=>'00000000-0000-4000-8000-0000000896'+String(n).padStart(2,'0');
const solved=Object.fromEntries(Array.from({length:10},(_,i)=>[i,1]));
const profile={solved,historyBackup:{...solved},badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:{},
 xp:100,shards:10,skyScore:10,skyHistoryVersion:4,walletRevision:1,daily:{dates:{},rewards:{}},challenges:{}};
const part=(name,status,duration_seconds,extra={})=>({name,status,duration_seconds,autonomy:true,speed:false,mastery:false,previously_played:false,completed_at:status==='completed'?'2026-11-21T10:00:00Z':null,...extra});
const row=(n,source,participants,unread=0)=>({challenge_id:id(n),puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,source_first_play:true,created_at:'2026-11-20T10:00:00Z',
 source_duration_seconds:source,source_autonomy:true,source_speed:false,source_mastery:false,participant_count:participants.length,unread_count:unread,participants});
const mine=[
 row(1,84,[part('Loutre','completed',98)],1),        // won
 row(2,98,[part('Loutre','completed',84)]),          // lost
 row(3,90,[part('Loutre','completed',90)]),          // tied
 row(4,84,[part('Loutre','started',null)]),          // pending/playing
 row(5,84,[part('Loutre','abandoned',null)]),        // abandoned
];
const inbox={received:[
  {challenge_id:id(10),sender:'Loutre',puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,source_first_play:true,created_at:'2026-11-21T09:00:00Z',status:'pending'},
  {challenge_id:id(11),sender:'Loutre',puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,source_first_play:true,created_at:'2026-11-21T08:00:00Z',status:'completed'}],
 sent:[{challenge_id:id(1),recipient:'Loutre',puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,created_at:'2026-11-20T10:00:00Z',status:'completed',duration_seconds:98}]};
const got={[id(11)]:{challenge_id:id(11),puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,sender_display_name:'Loutre',source_duration_seconds:70,source_autonomy:true,source_speed:false,source_mastery:false,source_first_play:true,
 participant_display_name:'Moi896',participant_status:'completed',participant_duration_seconds:77,participant_autonomy:true,participant_mastery:false,previously_played:false}};
function fixture({locale='fr'}={}){
 return `
  localStorage.clear();
  localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(profile))});
  for(const k of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1'])localStorage.setItem(k,'1');
  localStorage.setItem('lumenPushChoice','off');localStorage.setItem('lumenGuestName','Moi896');
  ${locale!=='fr'?`localStorage.setItem('lumen.locale',${JSON.stringify(locale)});`:''}
  localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(OWNER)});
  window.__duelCalls=[];
  const mine=${JSON.stringify(mine)};
  window.supabase={createClient:()=>({auth:{
   getSession:async()=>({data:{session:{user:{id:${JSON.stringify(OWNER)}}}}}),
   getUser:async()=>({data:{user:{id:${JSON.stringify(OWNER)}}}}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   rpc:async(name,args={})=>{
    window.__duelCalls.push(name);
    if(name==='lumen_ranking_account')return {data:{nicknameRequired:false,withdrawn:false,participating:false}};
    if(name==='lumen_restore_profile')return {data:${JSON.stringify(profile)}};
    if(name==='lumen_get_progress')return {data:Array.from({length:10},(_,i)=>({puzzle_id:i+1}))};
    if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
    if(name==='lumen_cas_profile')return {data:true};
    if(name==='lumen_friend_list')return {data:[{nickname:'Loutre',state:'friends',since:'2026-11-01T00:00:00Z'}]};
    if(name==='lumen_challenge_inbox')return {data:${JSON.stringify(inbox)}};
    if(name==='lumen_list_quest_challenges_v2')return {data:JSON.parse(JSON.stringify(mine))};
    if(name==='lumen_get_quest_challenge_v2')return {data:(${JSON.stringify(got)})[args.p_challenge_id]||null};
    if(name==='lumen_mark_social_challenge_read'){for(const r of mine)if(r.challenge_id===args.p_challenge_id)r.unread_count=0;return {data:1}}
    if(name==='lumen_canonical_command_version'||name==='lumen_legacy_command_version')return {error:{code:'PGRST202'},status:404};
    return {data:[]};
   }})};`;
}
async function open({send,evaluate},url,{width=390,height=844,locale='fr'}={}){
 await send('Emulation.setDeviceMetricsOverride',{width,height,mobile:width<700,deviceScaleFactor:1});
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture({locale})});
 const target=new URL(url);for(const k of ['qa','challenge','daily','training'])target.searchParams.delete(k);
 await navigateAndWait({send,evaluate},'Page.navigate',{url:String(target)});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
 await acknowledgeLearningMilestones(evaluate);
}
const capture=async(send,dir,name)=>{if(dir)fs.writeFileSync(dir+'/'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))};
const key=async(send,k,code,vk)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk});await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk})};
const states=`[...document.querySelectorAll('#myChallengesList .duel-row')].map(r=>r.dataset.duelState)`;
const cardVisible=`(()=>{const m=document.getElementById('challengeResultModal');if(m.hidden)return false;const v=m.querySelector('.duel-verdict').getBoundingClientRect(),t=[...m.querySelectorAll('.duel-time')].map(e=>e.getBoundingClientRect());return v.top>=0&&v.bottom<=innerHeight&&t.every(r=>r.top>=0&&r.bottom<=innerHeight)&&document.documentElement.scrollWidth<=innerWidth})()`;

export async function verifyDuels({send,evaluate},url,{captureDir=process.env.LUMEN_DUEL_CAPTURES||null}={}){
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase*']});
 const results=[];
 for(const [width,height] of [[360,640],[1440,900]]){
  await open({send,evaluate},url,{width,height});
  // « Mes défis » from the Espace social: verdicts readable in the list.
  await evaluate(`document.getElementById('openSocial').click();document.getElementById('openMyChallenges').click()`);
  await until(evaluate,`document.querySelectorAll('#myChallengesList .duel-row').length===5`,'duel rows '+width);
  assert.deepEqual(await evaluate(states),['won','lost','tied','playing','abandoned-them'],'one honest state per duel');
  const text=await evaluate(`document.getElementById('myChallengesList').textContent`);
  assert.match(text,/Défi contre Loutre.*Mon temps1:24.*Loutre1:38.*Tu as gagné !.*14 secondes d’avance/s);
  assert.match(text,/Loutre a gagné.*14 secondes de retard/s);
  assert.match(text,/Égalité.*Même temps/s);
  assert.match(text,/Loutre relève le défi/);
  assert.match(text,/Loutre a abandonné/);
  assert.doesNotMatch(text,/par lien/,'no technical label');
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'no horizontal scroll at '+width);
  await capture(send,captureDir,'duel-list-'+width);
  assert.equal(await evaluate(`document.querySelectorAll('#myChallengesList [data-duel-open]').length`),4,'detail for finished duels only');
  // Detail card: verdict and both times visible at once; one highlighted winner.
  for(const [index,state] of [[0,'won'],[1,'lost'],[2,'tied']]){
   await evaluate(`(()=>{const b=document.querySelectorAll('#myChallengesList [data-duel-open]')[${index}];b.focus();b.click()})()`);
   await until(evaluate,cardVisible,'card '+state+' '+width);
   assert.equal(await evaluate(`document.querySelector('#challengeResultBody .duel-card').dataset.duelState`),state);
   assert.equal(await evaluate(`document.querySelectorAll('#challengeResultBody .duel-winner').length`),state==='tied'?0:1);
   assert.equal(await evaluate(`document.getElementById('challengeResultHome').hidden&&!document.getElementById('challengeResultClose').hidden&&!document.getElementById('challengeResultCopy').hidden`),true,'in-app actions: close and copy');
   assert.equal(await evaluate(`document.getElementById('challengeResultTitle').textContent`),'Résultat du défi');
   await capture(send,captureDir,'duel-card-'+state+'-'+width);
   await key(send,'Escape','Escape',27);
   await until(evaluate,`document.getElementById('challengeResultModal').hidden&&!document.getElementById('myChallengesModal').hidden`,'Escape closes the card');
   assert.equal(await evaluate(`document.activeElement?.dataset?.duelOpen!==undefined`),true,'focus back on « Voir le duel »');
  }
  // Copy the link (sharing, distinct from viewing).
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async v=>{window.__copied=v}}});document.querySelector('#myChallengesList [data-copy-link]').click()`);
  await until(evaluate,`!!window.__copied`,'copy link');
  assert.match(await evaluate('window.__copied'),/[?&]challenge=00000000-0000-4000-8000-000000089601/);
  await evaluate(`document.getElementById('myChallengesClose').click()`);
  // « Amis et défis »: received (take / view) and sent (joined to Mes défis).
  await evaluate(`document.getElementById('openSocial').click();document.getElementById('openFriends').click()`);
  await until(evaluate,`!!document.querySelector('#friendChallengesReceived .duel-row[data-duel-state="lost"]')`,'received finished duel');
  const received=await evaluate(`document.getElementById('friendChallengesReceived').textContent`);
  assert.match(received,/À toi de jouer.*Relever le défi/s);
  assert.match(received,/Loutre a gagné.*7 secondes de retard.*Voir le duel/s,'recipient view is symmetric');
  assert.match(await evaluate(`document.getElementById('friendChallengesSent').textContent`),/Défi contre Loutre.*Tu as gagné !.*Voir le duel.*Copier le lien/s);
  assert.equal(await evaluate(`document.getElementById('friendsOpenMyChallenges').textContent`),'⚔ Voir tous mes défis');
  await capture(send,captureDir,'duel-friends-'+width);
  await evaluate(`document.querySelector('#friendChallengesReceived [data-challenge-action="result"]').click()`);
  await until(evaluate,cardVisible,'received duel card');
  assert.equal(await evaluate(`document.getElementById('challengeResultCopy').hidden`),true,'no copy action for a received challenge');
  assert.equal(await evaluate('new URL(location.href).searchParams.get("challenge")'),null,'viewing stays in the app');
  await evaluate(`document.getElementById('challengeResultClose').click();document.getElementById('friendsClose').click()`);
  // Pending friend challenge waits honestly (sent list).
  results.push({kind:'duels',width});
 }
 // Notification « résultat disponible » opens the duel directly.
 await open({send,evaluate},url,{width:390,height:844});
 await evaluate(`document.getElementById('openSocial').click();document.getElementById('socialNotifications').click()`);
 await until(evaluate,`!!document.querySelector('#socialNotificationsList [data-kind="challenge-result"]')`,'result notification');
 assert.match(await evaluate(`document.querySelector('#socialNotificationsList [data-kind="challenge-result"]').textContent`),/Loutre a terminé ton défi/,'participant name from the #18 contract');
 await evaluate(`document.querySelector('#socialNotificationsList [data-kind="challenge-result"]').click()`);
 await until(evaluate,cardVisible+`&&document.querySelector('#challengeResultBody .duel-card').dataset.duelState==='won'`,'notification opens the duel');
 results.push({kind:'notification'});
 // English.
 await open({send,evaluate},url,{width:390,height:844,locale:'en'});
 await evaluate(`document.getElementById('openSocial').click();document.getElementById('openMyChallenges').click()`);
 await until(evaluate,`document.querySelectorAll('#myChallengesList .duel-row').length===5`,'english rows');
 assert.match(await evaluate(`document.getElementById('myChallengesList').textContent`),/Challenge against Loutre.*My time.*You won!.*14 seconds ahead.*Loutre won.*Tie/s);
 results.push({kind:'english'});
 return results;
}
