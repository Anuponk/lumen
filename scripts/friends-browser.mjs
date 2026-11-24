import assert from 'node:assert/strict';
import {navigateAndWait,acknowledgeLearningMilestones} from './cdp-client.mjs';

// #35 (EPIC #881 Lot 2): "Amis et défis" through the real page. RPCs are an
// in-page model of the SQL contract proven by fixtures/friends-direct-challenges-35.sql.
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(evaluate,expression,label=expression){for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100)}throw Error('Timed out: '+label)}
const OWNER='00000000-0000-4000-8000-000000035101';

// A player past the first-quest learning focus (which deliberately blocks other UI).
const solved=Object.fromEntries(Array.from({length:10},(_,i)=>[i,1]));
const profile={solved,historyBackup:{...solved},badges:{},stars:{},performances:{},noHint:{},canonicalQuestState:{},
 xp:100,shards:10,skyScore:10,skyHistoryVersion:4,walletRevision:1,daily:{dates:{},rewards:{}},challenges:{}};
function fixture({signedIn}){
 return `
  localStorage.clear();
  localStorage.setItem('lumenProgressV1',${JSON.stringify(JSON.stringify(profile))});
  for(const k of ['lumenTutorialSeen','lumenTutorialCompletedV1','lumenSkyTourSeen','lumenQaTutorialSeen','lumenQaTutorialCompletedV1'])localStorage.setItem(k,'1');
  localStorage.setItem('lumenPushChoice','off');localStorage.setItem('lumenGuestName','Moi35');
  ${signedIn?`localStorage.setItem('lumenCloudOwnerId',${JSON.stringify(OWNER)});`:''}
  window.__friendCalls=[];
  const friends=[{nickname:'Ana35',state:'incoming',since:'2026-11-20T10:00:00Z'}];
  const inbox={received:[{challenge_id:'00000000-0000-4000-8000-000000035201',sender:'Ana35',puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,source_first_play:false,status:'pending'}],sent:[]};
  const mine=[{challenge_id:'00000000-0000-4000-8000-000000035202',puzzle_id:12,stable_quest_id:'base-q012',grid_revision:0,source_first_play:true,created_at:'2026-11-20T10:00:00Z',source_duration_seconds:60,source_autonomy:true,source_mastery:false,participant_count:0,unread_count:0,participants:[]}];
  window.supabase={createClient:()=>({auth:{
   getSession:async()=>(${signedIn}?{data:{session:{user:{id:${JSON.stringify(OWNER)}}}}}:{data:{session:null}}),
   getUser:async()=>(${signedIn}?{data:{user:{id:${JSON.stringify(OWNER)}}}}:{data:{user:null}}),
   onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
   rpc:async(name,args={})=>{
    if(/^lumen_(friend|challenge_inbox|challenge_send)/.test(name))window.__friendCalls.push({name,args});
    if(name==='lumen_ranking_account')return {data:{nicknameRequired:false,withdrawn:false,participating:false}};
    if(name==='lumen_restore_profile')return {data:${JSON.stringify(profile)}};
    if(name==='lumen_get_progress')return {data:Array.from({length:10},(_,i)=>({puzzle_id:i+1}))};
    if(name==='lumen_get_engagement')return {data:[{rewarded_days:{}}]};
    if(name==='lumen_cas_profile')return {data:true};
    if(name==='lumen_friend_list')return {data:friends.map(f=>({...f}))};
    if(name==='lumen_challenge_inbox')return {data:JSON.parse(JSON.stringify(inbox))};
    if(name==='lumen_list_quest_challenges_v2')return {data:mine};
    if(name==='lumen_friend_request'){if(args.p_nickname.toLowerCase()==='nobody35')return {data:null,error:{message:'player_not_found'}};friends.push({nickname:args.p_nickname,state:'outgoing',since:'2026-11-20T11:00:00Z'});return {data:'outgoing'}}
    if(name==='lumen_friend_respond'){const f=friends.find(x=>x.nickname===args.p_nickname);f.state=args.p_accept?'friends':'gone';return {data:args.p_accept?'friends':'declined'}}
    if(name==='lumen_friend_remove')return {data:'removed'};
    // #972: partial, case-insensitive search over public nicknames only.
    if(name==='lumen_friend_find'){const q=args.p_query.toLowerCase(),rows=['Bruno35','Brunette35','Ana35','Zoé35'].filter(n=>n.toLowerCase().includes(q)).map(nickname=>({nickname,state:friends.find(f=>f.nickname===nickname)?.state||'none'}));return {data:{results:rows.slice(args.p_page*8,args.p_page*8+8),page:args.p_page,more:false}}}
    if(name==='lumen_challenge_send_to_friend'){inbox.sent.push({challenge_id:args.p_challenge_id,recipient:args.p_nickname,puzzle_id:12,status:'pending'});return {data:'sent'}}
    if(name==='lumen_canonical_command_version'||name==='lumen_legacy_command_version')return {error:{code:'PGRST202'},status:404};
    return {data:[]};
   }})};`;
}
async function open({send,evaluate},url,signedIn,width){
 await send('Emulation.setDeviceMetricsOverride',{width,height:width<700?844:900,mobile:width<700,deviceScaleFactor:1});
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:fixture({signedIn})});
 const target=new URL(url);target.searchParams.delete('qa');target.searchParams.delete('challenge');
 await navigateAndWait({send,evaluate},'Page.navigate',{url:String(target)});
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier});
 await acknowledgeLearningMilestones(evaluate);
}

export async function verifyFriends({send,evaluate},url){
 await send('Network.enable');await send('Network.setBlockedURLs',{urls:['*supabase*']});
 const results=[];
 // Guest: friendly explanation, nothing sent, link challenges untouched.
 await open({send,evaluate},url,false,390);
 await evaluate(`document.getElementById('openFriends').click()`);
 await until(evaluate,`!document.getElementById('friendsModal').hidden`,'guest hub');
 assert.equal(await evaluate(`!document.getElementById('friendsAccountRequired').hidden&&document.getElementById('friendsBody').hidden`),true,'Guests see why friends need an account');
 assert.match(await evaluate(`document.getElementById('friendsAccountRequired').textContent`),/défis par lien restent ouverts/);
 assert.equal((await evaluate('window.__friendCalls')).length,0,'No friend request for guests');
 results.push({kind:'guest',calls:0});

 for(const width of [390,1440]){
  await open({send,evaluate},url,true,width);
  await until(evaluate,`!!document.getElementById('openFriends')`,'hub entry');
  await evaluate(`document.getElementById('openFriends').click()`);
  await until(evaluate,`!document.getElementById('friendsModal').hidden&&!document.getElementById('friendsBody').hidden&&document.querySelectorAll('#friendsList .friend-row').length===1`,'signed-in hub '+width);
  assert.match(await evaluate(`document.getElementById('friendChallengesReceived').textContent`),/Défi contre Ana35.*Quête \d+.*À toi de jouer.*La référence de Ana35 vient d’un rejeu qualifiant.*Relever le défi/s,'Received challenge with provenance and status');
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'No horizontal scroll at '+width);
  // #972: partial search. Below 3 letters/digits nothing is sent.
  const finds=async()=>(await evaluate('window.__friendCalls')).filter(c=>c.name==='lumen_friend_find').length;
  await evaluate(`document.getElementById('friendNicknameInput').value='b r';document.getElementById('friendAddButton').click()`);
  await until(evaluate,`/au moins 3/.test(document.getElementById('friendStatus').textContent)`,'short query message');
  assert.equal(await finds(),0,'no request below 3 characters');
  await evaluate(`document.getElementById('friendNicknameInput').value='  BRU ';document.getElementById('friendAddButton').click()`);
  await until(evaluate,`document.querySelectorAll('#friendSearchResults .friend-search-row').length===2`,'partial, case-insensitive results');
  assert.equal(await evaluate(`[...document.querySelectorAll('#friendSearchResults .friend-name')].map(e=>e.textContent).join(',')`),'Bruno35,Brunette35');
  assert.equal((await evaluate('window.__friendCalls')).find(c=>c.name==='lumen_friend_find').args.p_query,'BRU','trimmed query, page 0');
  await evaluate(`document.getElementById('friendAddButton').click()`);await sleep(200);
  assert.equal(await finds(),1,'the same query is not sent twice');
  assert.equal(await evaluate(`document.getElementById('friendSearchMore').hidden`),true,'no « Voir plus » without more results');
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'results fit at '+width);
  await evaluate(`document.querySelector('#friendSearchResults [data-nickname="Bruno35"] [data-friend-action="add"]').click()`);
  await until(evaluate,`document.querySelectorAll('#friendsList .friend-row').length===2`,'outgoing request listed');
  await until(evaluate,`/Demande envoyée/.test(document.querySelector('#friendSearchResults [data-nickname="Bruno35"]').textContent)`,'result row reflects the request');
  await evaluate(`document.getElementById('friendNicknameInput').value='zzz';document.getElementById('friendAddButton').click()`);
  await until(evaluate,`/Aucun joueur trouvé/.test(document.getElementById('friendSearchResults').textContent)`,'empty result state');
  assert.match(await evaluate(`document.getElementById('friendsList').textContent`),/Bruno35Demande envoyéeAnnuler/);
  // Accept the incoming request.
  await evaluate(`document.querySelector('#friendsList [data-nickname="Ana35"] [data-friend-action="accept"]').click()`);
  await until(evaluate,`/Ana35AmiRetirer/.test(document.getElementById('friendsList').textContent)`,'accepted friend');
  const calls=await evaluate('window.__friendCalls');
  assert(calls.some(c=>c.name==='lumen_friend_respond'&&c.args.p_nickname==='Ana35'&&c.args.p_accept===true),'Accept sends the nickname only');
  assert(!JSON.stringify(calls).includes('@'),'No email anywhere in friend calls');
  // Send one of my existing challenges to a friend from "Mes défis".
  await evaluate(`document.getElementById('friendsOpenMyChallenges').click()`);
  await until(evaluate,`!!document.querySelector('#myChallengesList [data-send-friend]')`,'send-to-friend action');
  await evaluate(`document.querySelector('#myChallengesList [data-send-friend]').click()`);
  await until(evaluate,`!!document.querySelector('#friendPickerList [data-pick-friend="Ana35"]')`,'friend picker');
  assert.equal(await evaluate(`document.querySelectorAll('#friendPickerList [data-pick-friend]').length`),1,'Only accepted friends can be picked');
  await evaluate(`document.querySelector('#friendPickerList [data-pick-friend="Ana35"]').click()`);
  await until(evaluate,`/Défi envoyé à Ana35/.test(document.getElementById('friendPickerStatus').textContent)`,'sent status');
  const sent=(await evaluate('window.__friendCalls')).find(c=>c.name==='lumen_challenge_send_to_friend');
  assert.deepEqual(sent.args,{p_challenge_id:'00000000-0000-4000-8000-000000035202',p_nickname:'Ana35'});
  await evaluate(`document.getElementById('friendPickerClose').click();document.getElementById('myChallengesModal').hidden=true`);
  // Playing a received challenge opens its existing one-shot link.
  await evaluate(`document.getElementById('openFriends').click()`);
  await until(evaluate,`!!document.querySelector('#friendChallengesReceived [data-challenge-action]')`,'received again');
  await evaluate(`document.querySelector('#friendChallengesReceived [data-challenge-action]').click()`);
  await until(evaluate,`new URL(location.href).searchParams.get('challenge')==='00000000-0000-4000-8000-000000035201'`,'challenge link opened');
  results.push({kind:'signed-in',width,actions:['search','request','accept','send','play']});
 }
 return results;
}
