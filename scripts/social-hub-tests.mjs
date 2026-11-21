import assert from 'node:assert/strict';
import fs from 'node:fs';
import {badgeCount,socialBadgeText} from '../src/ui/social-hub.js';

// #898 (Lot 4, PR A): the global badge only adds what the existing #35
// counters display; the markup keeps the ids their validated code binds.
const el=(text,hidden=false)=>({textContent:text,hidden});
assert.equal(badgeCount(null),0);
assert.equal(badgeCount(el('3')),3);
assert.equal(badgeCount(el('3',true)),0,'hidden counter adds nothing');
assert.equal(badgeCount(el('')),0);
assert.equal(badgeCount(el('abc')),0);
assert.equal(badgeCount(el('-2')),0);
assert.equal(socialBadgeText(0),'');
assert.equal(socialBadgeText(4),'4');
assert.equal(socialBadgeText(120),'99+');
assert.equal(socialBadgeText(-1),'');

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const count=id=>(html.match(new RegExp('id="'+id+'"','g'))||[]).length;
for(const id of ['openSocial','socialHub','socialBadge','openFriends','openMyChallenges','inviteLumenFriends','friendsBadge','challengeUnreadBadge','openDaily','openDailyWeek'])
 assert.equal(count(id),1,id+' exists exactly once');
const hub=html.slice(html.indexOf('id="socialHub"'),html.indexOf('id="myChallengesModal"'));
for(const id of ['openFriends','openMyChallenges','inviteLumenFriends','friendsBadge','challengeUnreadBadge'])
 assert(hub.includes('id="'+id+'"'),id+' lives in the social panel (no duplicate entry)');
assert(!hub.includes('id="openDaily"'),'the direct daily entry stays in « Mes quêtes »');
const head=html.slice(html.indexOf('class="head-actions"'),html.indexOf('id="mobileAccount"'));
assert(head.includes('id="openSocial"'),'social icon in the top-right actions');
assert.match(html,/id="openSocial"[^>]*aria-label="Espace social"[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"[^>]*aria-controls="socialHub"/);
const order=['socialDaily','openMyChallenges','socialRankings','openFriends','socialNotifications','inviteLumenFriends'].map(id=>hub.indexOf('id="'+id+'"'));
assert.deepEqual([...order].sort((a,b)=>a-b),order,'sections in the agreed order');
console.log('social hub tests passed');
