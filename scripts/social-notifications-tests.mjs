import assert from 'node:assert/strict';
import {SOCIAL_NOTIFICATIONS_KEY,ACCEPTED_TTL_MS,emptyNotificationState,readNotificationState,writeNotificationState,
 trackFriendships,deriveSocialEvents,unseenAcceptedCount,markSeen,relativeTime,createSocialNotifications} from '../src/ui/social-notifications.js';
import {createTranslator} from '../src/ui/i18n.js';
const {t}=createTranslator({locale:'fr'});
const en=createTranslator({locale:'en'}).t;

// #898 (Lot 4, PR B): notifications derived from existing reads, no double count.
const NOW=Date.parse('2026-11-21T12:00:00Z');
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),map:m}};

// Storage: per account, tolerant of corruption, bounded.
const st=memory();
assert.deepEqual(readNotificationState(st,'a'),emptyNotificationState());
st.setItem(SOCIAL_NOTIFICATIONS_KEY+':a','{oops');
assert.deepEqual(readNotificationState(st,'a'),emptyNotificationState(),'corrupt storage resets');
st.setItem(SOCIAL_NOTIFICATIONS_KEY+':a',JSON.stringify({version:1,baseline:true,outgoing:['x',3],accepted:[{nickname:'X',at:1},{bad:1}],seen:['id',null]}));
assert.deepEqual(readNotificationState(st,'a'),{version:1,baseline:true,outgoing:['x'],accepted:[{nickname:'X',at:1}],seen:['id']});
assert.deepEqual(readNotificationState(st,'b'),emptyNotificationState(),'another account sees nothing');
assert.deepEqual(readNotificationState(st,null),emptyNotificationState(),'guests have no state');
writeNotificationState(st,null,{x:1});assert.equal(st.map.size,1,'guests never write');

// Acceptance detection: silent baseline, then outgoing → friends.
let s=trackFriendships(emptyNotificationState(),[{nickname:'Old',state:'friends',since:'2026-01-01T00:00:00Z'},{nickname:'Cy',state:'outgoing',since:'2026-11-20T00:00:00Z'}],NOW);
assert.equal(s.baseline,true);assert.deepEqual(s.accepted,[],'first observation never floods old friendships');assert.deepEqual(s.outgoing,['cy']);
s=trackFriendships(s,[{nickname:'Old',state:'friends'},{nickname:'Cy',state:'friends',since:'2026-11-21T11:00:00Z'}],NOW);
assert.deepEqual(s.accepted,[{nickname:'Cy',at:Date.parse('2026-11-21T11:00:00Z')}],'acceptance noticed once');
assert.deepEqual(s.outgoing,[]);
assert.deepEqual(trackFriendships(s,[{nickname:'Cy',state:'friends'}],NOW).accepted.length,1,'no duplicate on refresh');
assert.deepEqual(trackFriendships(s,[],NOW).accepted,[],'a removed friend leaves no ghost');
assert.deepEqual(trackFriendships(s,[{nickname:'Cy',state:'friends'}],NOW+ACCEPTED_TTL_MS+1).accepted,[],'old acceptances expire');
const declined=trackFriendships({...emptyNotificationState(),baseline:true,outgoing:['zoe']},[],NOW);
assert.deepEqual(declined.accepted,[],'a declined request is not an acceptance');

// Derivation, ordering and deduplication.
const events=deriveSocialEvents({t,now:NOW,questLabel:r=>'Quête '+r.puzzle_id,
 friends:[{nickname:'Ana',state:'incoming',since:'2026-11-21T10:00:00Z'},{nickname:'Bo',state:'outgoing'},{nickname:'Old',state:'friends'}],
 received:[{challenge_id:'c1',sender:'Ana',puzzle_id:12,created_at:'2026-11-21T09:00:00Z',status:'pending'},{challenge_id:'c2',sender:'Ana',status:'completed'},{challenge_id:'c1',sender:'Ana',puzzle_id:12,created_at:'2026-11-21T09:00:00Z',status:'pending'}],
 sent:[{challenge_id:'m1',puzzle_id:7,unread_count:1,created_at:'2026-11-20T00:00:00Z',participants:[{display_name:'Bo',status:'completed'}]},{challenge_id:'m2',unread_count:0}],
 accepted:s.accepted});
assert.deepEqual(events.map(e=>e.kind),['friend-accepted','friend-request','challenge-received','challenge-result'],'newest first, one per source item');
assert.equal(events.find(e=>e.kind==='challenge-received').text,'Ana te défie · Quête 12');
assert.equal(events.find(e=>e.kind==='challenge-result').text,'Bo a terminé ton défi · Quête 7');
assert.deepEqual(events.find(e=>e.kind==='challenge-result').target,{type:'my-challenges',id:'m1'});
assert.deepEqual(events.find(e=>e.kind==='challenge-received').target,{type:'challenge',id:'c1'});
assert.equal(events.some(e=>JSON.stringify(e).includes('@')),false,'nicknames only, no email');
assert.equal(deriveSocialEvents({t,sent:[{challenge_id:'m3',unread_count:3,participants:[]}]})[0].text,'3 nouveaux résultats sur ton défi');

// Counting: only unseen acceptances are extra (the rest is #35's counters).
assert.equal(unseenAcceptedCount(events,[]),1);
const seen=markSeen(s,events);
assert.equal(unseenAcceptedCount(events,seen.seen),0);
assert.deepEqual(markSeen({...s,seen:['gone']},events,[]).seen,[],'ids of vanished items are forgotten');
assert.equal(relativeTime(NOW-30000,NOW,t),'à l’instant');
assert.equal(relativeTime(NOW-5*60000,NOW,t),'il y a 5 min');
assert.equal(relativeTime(NOW-3*3600000,NOW,t),'il y a 3 h');
assert.equal(relativeTime(NOW-3*86400000,NOW,t),'il y a 3 j');
assert.equal(deriveSocialEvents({t:en,friends:[{nickname:'Ana',state:'incoming'}]})[0].text,'Ana wants to be your friend','English copy');

// Controller: guest, reconnection, failure keeps the last list, account isolation.
let owner=null,friends=[{nickname:'Cy',state:'outgoing'}],fail=false,calls=0,changes=0;
const store=memory();
const ctl=createSocialNotifications({t,storage:store,getOwner:()=>owner,now:()=>NOW,minInterval:30000,
 fetchFriends:async()=>{calls++;if(fail)throw Error('offline');return friends},fetchInbox:async()=>({received:[],sent:[]}),fetchSent:async()=>[],onChange:()=>changes++});
assert.deepEqual(await ctl.refresh(),[]);assert.equal(ctl.status(),'guest');assert.equal(calls,0,'no read for guests');
owner='u1';await ctl.refresh();assert.equal(calls,1);
await ctl.refresh();assert.equal(calls,1,'throttled');
friends=[{nickname:'Cy',state:'friends',since:'2026-11-21T11:59:00Z'}];
await ctl.refresh({force:true});assert.equal(ctl.extraCount(),1,'acceptance adds one badge unit');
fail=true;await ctl.refresh({force:true});
assert.equal(ctl.status(),'stale');assert.equal(ctl.events().length,1,'offline keeps the last known list');
fail=false;ctl.markAllSeen();assert.equal(ctl.extraCount(),0,'reading clears the extra unit');
await ctl.refresh({force:true});assert.equal(ctl.extraCount(),0,'read state survives a refresh');
owner='u2';assert.equal(ctl.extraCount(),0,'another account never inherits the count');
assert(changes>0);
console.log('social notifications tests passed');
