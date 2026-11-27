import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SEASONAL_EVENTS,activeEvent,civilDay,eventForDay,dailyPresentation,seasonalCopy,validDay} from '../src/campaign/seasonal-events.js';
import {dailyDestination} from '../src/acquisition/daily-link.js';
import {composition} from '../src/acquisition/daily-creative.js';
import {dailyPages} from './daily-pages.mjs';
import {buildPlan} from './marketing/social-posts.mjs';
import {canonicalQuestAtGridRevision} from '../src/campaign/canonical-quests.js';

assert.deepEqual(['2026-11-30','2026-12-01','2026-12-24','2026-12-25','2027-01-01'].map(d=>eventForDay(d)?.id??null),[null,'advent-2026','advent-2026',null,null]);
assert.equal(activeEvent(new Date('2026-11-30T22:59:59Z')),null);
assert.equal(activeEvent(new Date('2026-11-30T23:00:00Z')).id,'advent-2026');
assert.equal(activeEvent(new Date('2026-12-24T22:59:59Z')).id,'advent-2026');
assert.equal(activeEvent(new Date('2026-12-24T23:00:00Z')),null);
assert.equal(activeEvent(new Date('2026-12-01T12:00:00Z'),[{...SEASONAL_EVENTS[0],enabled:false}]),null);
assert.equal(civilDay(new Date('2027-06-30T22:00:00Z')),'2027-07-01');
for(const d of ['2026-02-30','2026-13-01','2026-12-32','bad',null])assert.equal(validDay(d),false);
for(const [locale,title] of Object.entries({fr:'Défi de l’Avent',en:'Advent Challenge',es:'Reto de Adviento'})){
 const p=dailyPresentation('2026-12-24',locale);assert.equal(p.title,title);assert.match(p.dayLabel,/24\/24/);
 assert.equal(seasonalCopy('Daily Challenge complete!','daily.complete','2026-12-24',locale),title);
 assert.equal(seasonalCopy('Défi du jour','daily.title','2026-12-24',locale),title);
 assert.equal(seasonalCopy('Défi du jour','daily.title','2026-12-25',locale),'Défi du jour');
 assert.equal(seasonalCopy('Défi du jour','daily.weekEmpty','2026-12-24',locale),'Défi du jour');
}
const original=JSON.stringify(SEASONAL_EVENTS);
const plan=buildPlan(),schedule=JSON.parse(fs.readFileSync('content/generated/daily-schedule.json','utf8'));
assert.equal(plan.posts.filter(p=>p.day.startsWith('2026-12')).length,31);
assert.equal(plan.posts.filter(p=>p.day.startsWith('2027-01')).length,31);
const pages=dailyPages();
for(const post of plan.posts){
 assert.equal(post.kind,'official');
 const p=dailyPresentation(post.day);const u=new URL(post.link);
 assert.equal(u.searchParams.get('utm_campaign'),p.campaign);
 assert.ok(post.message.includes(p.title));assert.ok(post.message.includes(p.hashtags));
 const html=pages.get('d/'+post.day+'/index.html');assert.ok(html.includes(p.title));
 assert.ok(html.includes('official-'+post.day+'.jpg'));
 assert.doesNotMatch(html,/"(reg|sol|given|questId)"/,'No future grid or solution in landing pages');
 const entry=schedule.days.find(e=>e.day===post.day),quest=canonicalQuestAtGridRevision(entry.questId,entry.gridRevision);
 const before=JSON.stringify(quest),spec=composition(post,{schedule});
 assert.doesNotMatch(spec.board,/<text/,'No Guardian or solution in initial official visual');
 assert.equal((spec.board.match(/<rect /g)||[]).length,quest.size**2+1,'Full official grid');
 assert.equal(JSON.stringify(quest),before,'No gameplay mutation');
 for(const [today,state] of [[post.day,'today'],['2026-11-30','future'],['2027-02-01','expired']]){
  const route=dailyDestination(post.day,{today,search:u.search+' illegitimate&training=1&day=2026-12-24&token=secret'});
  assert.equal(route.state,state);const target=new URL(route.href,'https://lumen.nopuna.fr');
  assert.equal(target.searchParams.get('daily'),'1');assert.equal(target.searchParams.has('day'),false);
  assert.equal(target.searchParams.has('training'),false);assert.equal(target.searchParams.has('token'),false);
 }
}
assert.equal(dailyDestination('2026-02-30').state,'invalid');
assert.equal(JSON.stringify(SEASONAL_EVENTS),original);
const studio=fs.readFileSync('src/acquisition/seasonal-studio.js','utf8');
assert.doesNotMatch(studio,/fetch\(|localStorage\.setItem|sessionStorage|import.*analytics|\.rpc\(/);
console.log('seasonal-events: bounds/DST, 3 languages, disabled, 62 real-daily links/OG/full initial visuals, safe preview OK');
