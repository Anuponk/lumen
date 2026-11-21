import assert from 'node:assert/strict';
import fs from 'node:fs';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';

// #898 (EPIC #881 Lot 4, PR A): « Espace social » through the real page. The
// panel only routes to existing screens (#18/#35/#779/#882) and sums the two
// #35 counters; RPCs are the same in-page models as friends-browser.mjs.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(evaluate,expression,label=expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+label)}
const OWNER='00000000-0000-4000-8000-000000089801';
const solved=Object.fromEntries(Array.from({length:10},(_,i)=>[i,1]));
const profile={solved,historyBackup:{...solved},badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:{},
 xp:100,shards:10,skyScore:10,skyHistoryVersion:4,walletRevision:1,daily:{dates:{},rewards:{}},challenges:{}};
function fixture({signedIn,daily}){
 return `
  localStorage.clear();
  localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(profile))});
  for(const k of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1'])localStorage.setItem(k,'1');
  localStorage.setItem('lumenPushChoice','off');localStorage.setItem('lumenGuestName','Moi898');
  ${signedIn?`localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(OWNER)});`:''}
  // PR B: this device already knew an outgoing request to Cy898, now accepted.
  ${signedIn?`localStorage.setItem('lumenSocialNotificationsV1:${OWNER}',JSON.stringify({version:1,baseline:true,outgoing:['cy898'],accepted:[],seen:[]}));`:''}
  window.__socialCalls=[];window.__failSocial=false;
  const friends=[{nickname:'Ana898',state:'incoming',since:'2026-11-20T10:00:00Z'},{nickname:'Cy898',state:'friends',since:new Date(Date.now()-3600000).toISOString()}];
  const inbox={received:[{challenge_id:'00000000-0000-4000-8000-000000089802',sender:'Ana898',puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,source_first_play:true,created_at:'2026-11-20T10:00:00Z',status:'pending'}],sent:[]};
  const mine=[{challenge_id:'00000000-0000-4000-8000-000000089803',puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,source_first_play:true,created_at:'2026-11-20T10:00:00Z',source_duration_seconds:60,source_autonomy:true,source_mastery:false,participant_count:1,unread_count:1,participants:[{name:'Bo898',status:'completed',duration_seconds:70}]}];
  const closes=new Date(Date.now()+5*3600000).toISOString();
  window.supabase={createClient:()=>({auth:{
   getSession:async()=>(${signedIn}?{data:{session:{user:{id:${JSON.stringify(OWNER)}}}}}:{data:{session:null}}),
   getUser:async()=>(${signedIn}?{data:{user:{id:${JSON.stringify(OWNER)}}}}:{data:{user:null}}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   rpc:async(name,args={})=>{
    window.__socialCalls.push(name);
    if(name==='lumen_daily_today')return {data:${daily}?{enabled:true,day:'2026-11-23',quest_id:'base-q012',grid_revision:0,closes_at:closes,server_now:new Date().toISOString()}:{enabled:false,day:'2026-11-23',server_now:new Date().toISOString()}};
    if(name==='lumen_ranking_account')return {data:{nicknameRequired:false,withdrawn:false,participating:false}};
    if(name==='lumen_restore_profile')return {data:${JSON.stringify(profile)}};
    if(name==='lumen_get_progress')return {data:Array.from({length:10},(_,i)=>({puzzle_id:i+1}))};
    if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
    if(name==='lumen_cas_profile')return {data:true};
    if(name==='lumen_friend_list')return window.__failSocial?{data:null,error:{message:'Failed to fetch'}}:{data:friends.map(f=>({...f}))};
    if(name==='lumen_challenge_inbox')return {data:JSON.parse(JSON.stringify(inbox))};
    if(name==='lumen_list_quest_challenges_v2')return {data:JSON.parse(JSON.stringify(mine))};
    if(name==='lumen_mark_social_challenge_read'){mine[0].unread_count=0;return {data:true}}
    if(name==='lumen_canonical_command_version'||name==='lumen_legacy_command_version')return {error:{code:'PGRST202'},status:404};
    return {data:[]};
   }})};`;
}
async function open({send,evaluate},url,{signedIn,daily=false,width=390,height=null}){
 await send('Emulation.setDeviceMetricsOverride',{width,height:height||(width<700?844:900),mobile:width<700,deviceScaleFactor:1});
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture({signedIn,daily})});
 const target=new URL(url);for(const k of ['qa','challenge','daily','training'])target.searchParams.delete(k);
 await navigateAndWait({send,evaluate},'Page.navigate',{url:String(target)});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
 await acknowledgeLearningMilestones(evaluate);
}
const key=async(send,k,code,vk,shift=false)=>{const modifiers=shift?8:0,text=k==='Enter'?{text:String.fromCharCode(13),unmodifiedText:String.fromCharCode(13)}:{};await send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code,windowsVirtualKeyCode:vk,modifiers,...text});await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code,windowsVirtualKeyCode:vk,modifiers})};
const visibleItems=`[...document.querySelectorAll('#socialHubMenu .social-hub-item')].filter(b=>!b.hidden).map(b=>b.querySelector('strong').textContent)`;
const capture=async(send,dir,name)=>{if(dir)fs.writeFileSync(dir+'/'+name+'.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))};

export async function verifySocialHub({send,evaluate},url,{captureDir=process.env.LUMEN_SOCIAL_CAPTURES||null}={}){
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase*']});
 const results=[];

 // Guest on a small phone: entry top right, public parts usable, account parts explained.
 await open({send,evaluate},url,{signedIn:false,width:360,height:640});
 // A guest past the free quests first sees the existing account offer; dismiss it.
 await evaluate(`(()=>{const o=document.getElementById('accountOptin');if(o&&!o.hidden)document.getElementById('accountOptinClose')?.click()})()`);
 const entry=await evaluate(`(()=>{const b=document.getElementById('openSocial'),r=b.getBoundingClientRect(),h=document.querySelector('.head').getBoundingClientRect();return {visible:r.width>0&&r.height>0,right:r.right>h.left+h.width*.6,top:r.top<h.bottom,label:b.getAttribute('aria-label'),expanded:b.getAttribute('aria-expanded'),haspopup:b.getAttribute('aria-haspopup')}})()`);
 assert.match(entry.label,/^Espace social(, 1 nouveauté)?$/,'Accessible name (a guest link challenge result counts too, #18)');delete entry.label;
 assert.deepEqual(entry,{visible:true,right:true,top:true,expanded:'false',haspopup:'dialog'},'Social icon top right');
 const board=await evaluate('JSON.stringify(lumenDiagnostics.snapshot().state)');
 await evaluate(`document.getElementById('openSocial').focus()`);
 await key(send,'Enter','Enter',13);
 await until(evaluate,`!document.getElementById('socialHub').hidden`,'keyboard opens the panel');
 assert.equal(await evaluate(`document.getElementById('openSocial').getAttribute('aria-expanded')`),'true');
 assert.equal(await evaluate(`document.getElementById('socialHub').contains(document.activeElement)`),true,'Focus moves into the panel');
 assert.deepEqual(await evaluate(visibleItems),['Mes défis','Classements','Mes amis','Mes cercles','Notifications','Inviter des amis'],'Daily row hidden while the daily challenge is unavailable (#929: Mes cercles after Mes amis)');
 assert.equal(await evaluate(`!document.getElementById('socialGuestNote').hidden&&!document.getElementById('socialSignIn').hidden`),true,'Guests learn what needs an account');
 const fit=await evaluate(`(()=>{const c=document.querySelector('#socialHub .social-card').getBoundingClientRect();return {inside:c.top>=0&&c.bottom<=innerHeight&&c.left>=0&&c.right<=innerWidth,noHScroll:document.documentElement.scrollWidth<=innerWidth}})()`);
 assert.deepEqual(fit,{inside:true,noHScroll:true},'Panel fits a 360×640 screen');
 await capture(send,captureDir,'social-hub-guest-360');
 await evaluate(`document.getElementById('socialNotifications').click()`);
 assert.equal(await evaluate(`!document.getElementById('socialNotificationsGuest').hidden&&document.getElementById('socialNotificationsEmpty').hidden`),true,'Guest notifications explain the account requirement');
 await evaluate(`document.getElementById('socialHubBack').click()`);
 assert.equal(await evaluate(`!document.getElementById('socialHubMenu').hidden`),true,'Back returns to the menu');
 await key(send,'Escape','Escape',27);
 await until(evaluate,`document.getElementById('socialHub').hidden&&document.activeElement.id==='openSocial'`,'Escape closes and restores focus');
 assert.equal(await evaluate(`document.getElementById('openSocial').getAttribute('aria-expanded')`),'false');
 // Guests still reach friends (explanation) and the invitation.
 await evaluate(`document.getElementById('openSocial').click()`);
 await evaluate(`document.getElementById('openFriends').click()`);
 await until(evaluate,`!document.getElementById('friendsModal').hidden&&document.getElementById('socialHub').hidden`,'Mes amis from the panel');
 assert.equal(await evaluate(`!document.getElementById('friendsAccountRequired').hidden`),true);
 await evaluate(`document.getElementById('friendsClose').click()`);
 await evaluate(`Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__shared=data}});document.getElementById('openSocial').click();document.getElementById('inviteLumenFriends').click()`);
 await until(evaluate,`!!window.__shared`,'invitation from the panel');
 assert.equal(await evaluate(`!document.getElementById('socialHub').hidden`),true,'The panel stays behind the share sheet');
 await key(send,'Escape','Escape',27);
 assert.match(await evaluate('window.__shared.url'),/utm_source=player_invite/);
 // #933: the destination follows the language of Lumen (French here).
 assert.equal(await evaluate('window.__shared.url'),'https://lumen.nopuna.fr/decouvrir.html?utm_source=player_invite&utm_medium=referral');
 // A manual switch to English in Lumen: the next invitation is English and opens discover.html.
 await evaluate(`(()=>{const s=document.getElementById('gameLocaleMode');s.value='en';s.dispatchEvent(new Event('change'));window.__shared=null;document.getElementById('openSocial').click();document.getElementById('inviteLumenFriends').click()})()`);
 await until(evaluate,`!!window.__shared`,'English invitation');
 await key(send,'Escape','Escape',27);
 assert.deepEqual(await evaluate('window.__shared'),{title:'Discover Lumen',text:'✨ I found Lumen, a logic puzzle where you relight the constellations. Want to try?',url:'https://lumen.nopuna.fr/discover.html?utm_source=player_invite&utm_medium=referral'},'English invitation → discover.html');
 await evaluate(`(()=>{const s=document.getElementById('gameLocaleMode');s.value='fr';s.dispatchEvent(new Event('change'))})()`);
 // #932: « Partager Lumen » in the header and in Mon Ciel is the same invitation path.
 const invitation=await evaluate(`(async()=>{window.__shared=null;document.getElementById('shareLumen').click();for(let i=0;i<40&&!window.__shared;i++)await new Promise(r=>setTimeout(r,25));const {title,text,url}=window.__shared||{};return {title,text,url}})()`,true);
 assert.deepEqual(invitation,{title:'Découvrir Lumen',text:'✨ J’ai découvert Lumen, un jeu de logique où tu rallumes les constellations. Tu veux essayer ?',url:'https://lumen.nopuna.fr/decouvrir.html?utm_source=player_invite&utm_medium=referral'},'header entry = Inviter des amis');
 const header=await evaluate(`(()=>{const b=document.getElementById('shareLumen'),r=b.getBoundingClientRect(),row=[...document.querySelectorAll('.head-actions > button')].filter(x=>x.getClientRects().length);return {name:b.getAttribute('aria-label'),size:Math.round(r.width)+'x'+Math.round(r.height),sameRow:row.every(x=>Math.abs(x.getBoundingClientRect().top-r.top)<2),overflow:document.documentElement.scrollWidth>innerWidth}})()`);
 assert.deepEqual(header,{name:'Partager Lumen',size:header.size,sameRow:true,overflow:false},'header entry fits without pushing other commands');
 // #932 Lot C: once warmed (hover/focus/touch or idle), the promotional picture of the
 // same language is attached when the channel accepts files; text and link stay.
 const withPicture=await evaluate(`(async()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>files.every(f=>f.type==='image/jpeg')});
  const b=document.getElementById('shareLumen');b.dispatchEvent(new Event('pointerenter'));
  // The picture is fetched in the background: share until it is ready (bounded).
  let s=null;for(let i=0;i<40&&!s?.files;i++){await new Promise(r=>setTimeout(r,250));window.__shared=null;b.click();for(let j=0;j<40&&!window.__shared;j++)await new Promise(r=>setTimeout(r,25));s=window.__shared}return {url:s?.url,text:s?.text,files:s?.files?.map(f=>({name:f.name,type:f.type,size:f.size}))}})()`,true);
 assert.equal(withPicture.url,invitation.url);assert.equal(withPicture.text,invitation.text);
 assert.equal(withPicture.files?.[0]?.name,'lumen.jpg','French promotional picture attached');
 assert(withPicture.files[0].type==='image/jpeg'&&withPicture.files[0].size>20_000&&withPicture.files[0].size<200_000,'real og.jpg bytes: '+withPicture.files[0].size);
 await evaluate(`delete navigator.canShare`);
 await evaluate(`document.getElementById('openSky').click()`);
 await until(evaluate,`!document.getElementById('mapModal').hidden`,'Mon Ciel');
 const fromSky=await evaluate(`(async()=>{window.__shared=null;document.getElementById('mapShareLumen').click();for(let i=0;i<40&&!window.__shared;i++)await new Promise(r=>setTimeout(r,25));return window.__shared?.url})()`,true);
 assert.equal(fromSky,invitation.url,'Mon Ciel entry = same invitation');
 assert.equal(await evaluate(`!document.getElementById('mapModal').hidden`),true,'sharing keeps Mon Ciel open');
 await evaluate(`document.getElementById('closeMap').click()`);
 assert.equal(await evaluate('JSON.stringify(lumenDiagnostics.snapshot().state)'),board,'The panel never touches the active grid');
 assert.equal((await evaluate('window.__socialCalls')).some(n=>/^lumen_friend/.test(n)),false,'No friend RPC for guests');
 results.push({kind:'guest',width:360});

 for(const [width,height] of [[390,844],[1440,900]]){
  await open({send,evaluate},url,{signedIn:true,daily:true,width,height});
  // #35 counters (1 friend request + 1 friend challenge; 1 unread result) + 1 unseen acceptance (PR B).
  await evaluate(`document.getElementById('openSocial').click()`);
  await until(evaluate,`document.getElementById('socialBadge').textContent==='4'&&!document.getElementById('socialBadge').hidden`,'global badge '+width);
  assert.equal(await evaluate(`document.getElementById('friendsBadge').textContent+'/'+document.getElementById('challengeUnreadBadge').textContent`),'2/1','#35 counters unchanged');
  assert.equal(await evaluate(`document.getElementById('openSocial').getAttribute('aria-label')`),'Espace social, 4 nouveautés');
  assert.deepEqual(await evaluate(visibleItems),['Défi du jour','Mes défis','Classements','Mes amis','Mes cercles','Notifications','Inviter des amis'],'Seven sections in the agreed order (#929)');
  assert.match(await evaluate(`document.getElementById('socialDailyState').textContent`),/fin dans/,'Daily state mirrors « Mes quêtes »');
  assert.equal(await evaluate(`document.getElementById('socialGuestNote').hidden`),true);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'No horizontal scroll at '+width);
  await capture(send,captureDir,'social-hub-menu-'+width);
  // Tab stays inside the dialog.
  const focusStart=await evaluate('document.activeElement.id');
  for(let i=0;i<12;i++)await key(send,'Tab','Tab',9);
  assert.equal(await evaluate(`document.getElementById('socialHub').contains(document.activeElement)`),true,'Focus trapped in the panel (from '+focusStart+')');
  // Rankings: campaign and daily kept apart.
  await evaluate(`document.getElementById('socialRankings').click()`);
  assert.equal(await evaluate(`document.getElementById('socialHubTitle').textContent`),'Classements');
  assert.match(await evaluate(`document.getElementById('socialRankingsView').textContent`),/Classements des quêtes.*Défi du jour · Général et Mes amis/s);
  assert.equal(await evaluate(`!document.getElementById('socialDailyRanking').hidden`),true);
  await capture(send,captureDir,'social-hub-rankings-'+width);
  // Notifications (PR B): one row per event, unread marked, read on viewing.
  await evaluate(`document.getElementById('socialHubBack').click();document.getElementById('socialNotifications').click()`);
  await until(evaluate,`document.querySelectorAll('#socialNotificationsList .social-notification').length===4`,'notification feed '+width);
  const feed=await evaluate(`[...document.querySelectorAll('#socialNotificationsList .social-notification')].map(b=>({kind:b.dataset.kind,text:b.querySelector('strong').textContent,fresh:!!b.querySelector('.social-new')}))`);
  assert.deepEqual(feed.map(f=>f.kind).sort(),['challenge-received','challenge-result','friend-accepted','friend-request']);
  assert.deepEqual(feed.map(f=>f.text.replace(/Quête \d+/,'Quête N')).sort(),['Ana898 souhaite devenir ton ami·e','Ana898 te défie · Quête N','Bo898 a terminé ton défi · Quête N','Cy898 a accepté ta demande d’ami'].sort(),'Canonical quest labels (#18)');
  assert.equal(feed.every(f=>f.fresh),true,'Everything new is marked « Nouveau » during this viewing');
  assert.equal(feed.some(f=>/@|0000-4000/.test(f.text)),false,'Nicknames only');
  await until(evaluate,`document.getElementById('socialBadge').textContent==='3'`,'viewing reads the acceptance');
  await capture(send,captureDir,'social-hub-notifications-'+width);
  await evaluate(`document.querySelector('#socialNotificationsList [data-kind="challenge-result"]').click()`);
  await until(evaluate,`!document.getElementById('myChallengesModal').hidden&&document.getElementById('socialHub').hidden`,'result opens Mes défis');
  await until(evaluate,`document.getElementById('challengeUnreadBadge').hidden&&document.getElementById('socialBadge').textContent==='2'`,'read result leaves the global badge consistent');
  await evaluate(`document.getElementById('myChallengesClose').click()`);
  // Read state persists; the read result is gone (no ghost, no duplicate).
  await evaluate(`document.getElementById('openSocial').click();document.getElementById('socialNotifications').click()`);
  await until(evaluate,`document.querySelectorAll('#socialNotificationsList .social-notification').length===3`,'read result removed');
  assert.equal(await evaluate(`document.querySelectorAll('#socialNotificationsList .social-new').length`),0,'Nothing new on the second viewing');
  // Offline: last known list kept with a notice; reconnection refreshes.
  await evaluate(`window.__failSocial=true;document.getElementById('socialHubBack').click();document.getElementById('socialNotifications').click()`);
  await until(evaluate,`!document.getElementById('socialNotificationsError').hidden`,'offline notice');
  assert.match(await evaluate(`document.getElementById('socialNotificationsError').textContent`),/dernières nouveautés connues/);
  assert.equal(await evaluate(`document.querySelectorAll('#socialNotificationsList .social-notification').length`),3,'offline keeps the last list');
  const listCalls=(await evaluate('window.__socialCalls')).filter(n=>n==='lumen_friend_list').length;
  await evaluate(`window.__failSocial=false;window.dispatchEvent(new Event('online'))`);
  await until(evaluate,`document.getElementById('socialNotificationsError').hidden&&window.__socialCalls.filter(n=>n==='lumen_friend_list').length>`+listCalls,'reconnection refresh');
  await key(send,'Escape','Escape',27);
  // Mes amis keeps the #35 screen.
  await evaluate(`document.getElementById('openSocial').click();document.getElementById('openFriends').click()`);
  await until(evaluate,`!document.getElementById('friendsModal').hidden&&!document.getElementById('friendsBody').hidden`,'Mes amis signed in');
  await evaluate(`document.getElementById('friendsClose').click()`);
  // Défi du jour keeps its own entry and route (#882).
  assert.equal(await evaluate(`!!document.getElementById('openDaily')`),true,'Direct daily entry kept in « Mes quêtes »');
  await evaluate(`document.getElementById('openSocial').click();document.getElementById('socialDaily').click()`);
  await until(evaluate,`new URL(location.href).searchParams.get('daily')==='1'`,'daily route');
  results.push({kind:'signed-in',width});
 }
 // A received challenge opens its existing one-shot link (#35/#18).
 await open({send,evaluate},url,{signedIn:true,width:390});
 await evaluate(`document.getElementById('openSocial').click();document.getElementById('socialNotifications').click()`);
 await until(evaluate,`!!document.querySelector('#socialNotificationsList [data-kind="challenge-received"]')`,'received challenge row');
 await evaluate(`document.querySelector('#socialNotificationsList [data-kind="challenge-received"]').click()`);
 await until(evaluate,`new URL(location.href).searchParams.get('challenge')==='00000000-0000-4000-8000-000000089802'`,'challenge link opened');
 // Leave the page settled for the next suite of the canonical replay.
 for(let i=0;i<150;i++){try{if(await evaluate("document.readyState==='complete'&&!!window.lumenDiagnostics"))break}catch{}await sleep(100)}
 results.push({kind:'challenge-link'});
 return results;
}
