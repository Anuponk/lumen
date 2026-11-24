import assert from 'node:assert/strict';
import {renderFriendSearchRows,friendSearchReady,friendSearchQuery,FRIEND_SEARCH_PAGES,createFriendsClient,friendErrorMessage,challengeStatusLabel,validNickname,normalizeNickname,renderFriendRows,renderReceivedChallenges,renderSentChallenges,friendsOnly} from '../src/campaign/social-friends.js';

// #35 (EPIC #881 Lot 2): friends and direct challenges client contract.
const calls=[];
const client=createFriendsClient({rpc:async(name,args)=>{calls.push({name,args});
 if(name==='lumen_friend_list')return {data:[{nickname:'Alice35',state:'friends'}],error:null};
 if(name==='lumen_challenge_inbox')return {data:{received:[{challenge_id:'c1'}]},error:null};
 if(name==='lumen_friend_request'&&args.p_nickname==='Spam')return {data:null,error:{message:'rate_limited'}};
 return {data:'ok',error:null}}});
await client.search('  Bruno   35 ');await client.request('Bruno35');await client.respond('Bruno35',1);await client.remove('Bruno35');
assert.deepEqual(await client.list(),[{nickname:'Alice35',state:'friends'}]);
await client.sendChallenge('c1','Alice35');
assert.deepEqual(await client.inbox(),{received:[{challenge_id:'c1'}],sent:[]});
assert.deepEqual(calls.map(c=>c.name),['lumen_friend_search','lumen_friend_request','lumen_friend_respond','lumen_friend_remove','lumen_friend_list','lumen_challenge_send_to_friend','lumen_challenge_inbox']);
assert.equal(calls[0].args.p_nickname,'Bruno 35','nicknames are trimmed, never extended');
assert.equal(calls[2].args.p_accept,true);
assert.deepEqual(Object.keys(calls[5].args).sort(),['p_challenge_id','p_nickname'],'only the challenge and a nickname are sent');
await assert.rejects(()=>client.request('Spam'),/rate_limited/);
await assert.rejects(()=>createFriendsClient(null).list(),/account_required/,'no client: accounts only');

assert.match(friendErrorMessage(new Error('request_cooldown')),/pas être renvoyée/);
assert.match(friendErrorMessage('account_required'),/défis par lien restent ouverts/,'guests are never blocked from link challenges');
assert.match(friendErrorMessage('anything'),/Réessaie plus tard/);
assert.equal(challengeStatusLabel('started'),'Commencé');assert.equal(challengeStatusLabel(null),'En attente');
assert.equal(challengeStatusLabel('COMPLETED'),'Terminé');assert.equal(challengeStatusLabel('abandoned'),'Abandonné');
assert.equal(validNickname('Lé'),false);assert.equal(validNickname('Léa 35'),true);assert.equal(validNickname('<b>x'),false);
assert.equal(normalizeNickname('a'.repeat(40)).length,20);

const friends=renderFriendRows([{nickname:'Ana<img src=x>',state:'incoming'},{nickname:'Bo',state:'friends'},{nickname:'Cy',state:'outgoing'}]);
assert.doesNotMatch(friends,/<img/,'escaped');
assert.match(friends,/data-friend-action="accept">Accepter.*data-friend-action="decline">Refuser/s);
assert.match(friends,/Bo<\/span><span class="friend-state">Ami<\/span><span class="friend-actions"><button type="button" data-friend-action="remove">Retirer/);
assert.match(friends,/Cy<\/span><span class="friend-state">Demande envoyée<\/span><span class="friend-actions"><button type="button" data-friend-action="remove">Annuler/);
assert.match(renderFriendRows([]),/pseudonyme exact/);
assert.deepEqual(friendsOnly([{state:'friends'},{state:'incoming'}]),[{state:'friends'}]);

const label=row=>'Quête '+row.n;
const received=renderReceivedChallenges([{challenge_id:'c1',sender:'Ana',n:12,status:'pending',source_first_play:false},{challenge_id:'c2',sender:null,n:3,status:'completed'},{challenge_id:'c3',sender:'Bo',n:4,status:'started'}],label);
assert.match(received,/Ana<\/span><span class="friend-state">Quête 12 · rejeu qualifiant · En attente.*>Jouer</s);
assert.match(received,/Joueur<\/span><span class="friend-state">Quête 3 · Terminé.*>Voir le résultat</s);
assert.match(received,/Quête 4 · Commencé.*>Reprendre</s);
assert.doesNotMatch(received,/duration|source_duration/,'the reference stays hidden in the inbox');
const sent=renderSentChallenges([{recipient:'Ana',n:12,status:'completed',duration_seconds:64},{recipient:'Bo',n:5,status:'pending',duration_seconds:null}],label,s=>'1:'+String(s-60).padStart(2,'0'));
assert.match(sent,/Ana<\/span><span class="friend-state">Quête 12 · Terminé · 1:04/);
assert.match(sent,/Bo<\/span><span class="friend-state">Quête 5 · En attente<\/span>/);
console.log('social friends client and renderers: ok');

// #972: partial search client, input threshold and compact rows.
{
 const sent=[];
 const finder=createFriendsClient({rpc:async(name,args)=>{sent.push({name,args});return {data:{results:[{nickname:'Bérénice'}],page:1,more:true},error:null}}});
 assert.deepEqual(await finder.find('  bé   ré ',1),{results:[{nickname:'Bérénice'}],page:1,more:true});
 assert.deepEqual(sent,[{name:'lumen_friend_find',args:{p_query:'bé ré',p_page:1}}],'one RPC with the trimmed query and page only');
 const empty=createFriendsClient({rpc:async()=>({data:null,error:null})});
 assert.deepEqual(await empty.find('abc'),{results:[],page:0,more:false},'a null answer is an empty page');
 assert.equal(friendSearchReady('ab'),false);assert.equal(friendSearchReady(' a-b '),false,'separators do not count');
 assert.equal(friendSearchReady('Bé1'),true,'accented letters count');assert.equal(friendSearchQuery('  A   b '),'A b');
 assert.equal(FRIEND_SEARCH_PAGES,3);
 const tr=key=>'['+key+']';
 const html=renderFriendSearchRows([{nickname:'A<b>',state:'none'},{nickname:'Bo',state:'incoming'},{nickname:'Cy',state:'outgoing'},{nickname:'Di',state:'friends'}],tr);
 assert.match(html,/A&lt;b&gt;.*data-friend-action="add">\[friends\.add\]/s,'escaped nickname with Ajouter');
 assert.match(html,/data-nickname="Bo".*data-friend-action="accept"/s,'incoming request can be accepted');
 assert.match(html,/data-nickname="Cy".*\[friends\.state\.outgoing\]/s);assert.match(html,/data-nickname="Di".*\[friends\.state\.friends\]/s);
 assert.equal((html.match(/data-friend-action/g)||[]).length,2,'no action for pending or existing friends');
 assert.match(renderFriendSearchRows([],tr),/\[friends\.noResult\]/);
 for(const code of ['query_too_short','query_too_long','search_rate_limited'])assert.equal(friendErrorMessage(Error(code),tr),'[friends.error.'+code+']');
 console.log('friend search (#972): ok');
}
