import {createTranslator} from '../src/ui/i18n.js';
import assert from 'node:assert/strict';
import {summarizeWeek,weekMonday,weekNavigation,FIRST_DAILY_WEEK} from '../src/campaign/daily-week.js';
import {renderDailyWeek,formatWeekRange} from '../src/ui/daily-view.js';

// #882 Lot 3 PR C: « Ta semaine dans les étoiles » (own days only).
assert.equal(weekMonday('2026-11-23'),'2026-11-23');
assert.equal(weekMonday('2026-11-29'),'2026-11-23','Sunday belongs to the ISO week started on Monday');
assert.equal(weekMonday('2026-12-02'),'2026-11-30');
assert.equal(weekMonday('2027-03-28'),'2027-03-22','DST change (Paris) does not shift the week');
assert.equal(FIRST_DAILY_WEEK,'2026-11-23');

const run=score=>({status:'completed',score,seconds:score});
const week={monday:'2026-11-30',days:[
 {day:'2026-11-30',state:'completed',final:true,run:run(140),general_rank:2,general_total:40,friends_rank:1,friends_total:3},
 {day:'2026-12-01',state:'missed',final:true},
 {day:'2026-12-02',state:'completed',final:true,run:run(95),general_rank:7,general_total:38,friends_rank:1,friends_total:1},
 {day:'2026-12-03',state:'abandoned',final:true,run:{status:'abandoned'}},
 {day:'2026-12-04',state:'completed',final:false,run:run(120),general_rank:null,general_total:41,friends_rank:2,friends_total:4},
 {day:'2026-12-05',state:'started',final:false,run:{status:'started'}},
 {day:'2026-12-06',state:'future'}]};
const s=summarizeWeek(week);
assert.deepEqual(s.days.map(d=>d.letter),['L','M','M','J','V','S','D']);
assert.equal(s.participations,5,'completed, abandoned and in-progress days count as participations');
assert.equal(s.completed,3);
assert.equal(s.openDays,6);
assert.equal(s.podiums,1,'general rank ≤ 3 only');
assert.equal(s.friendsWins,1,'a first place alone among friends is not a win');
assert.deepEqual(s.bestGeneral,{rank:2,total:40,day:'2026-11-30'});
assert.deepEqual(s.bestFriends,{rank:1,total:3,day:'2026-11-30'});
assert.deepEqual(s.bestTime,{score:95,day:'2026-12-02'});
assert.equal(s.days[4].generalRank,null,'opted-out day keeps no general rank');
assert.equal(s.provisional,true);assert.equal(s.frozen,false);

const past=summarizeWeek({monday:'2026-11-23',days:Array.from({length:7},(_,i)=>({day:'2026-11-'+(23+i),state:i===0?'completed':'missed',final:true,run:i===0?run(80):undefined,general_rank:i===0?1:null,general_total:i===0?3:null}))});
assert.equal(past.frozen,true);assert.equal(past.provisional,false);
const empty=summarizeWeek({monday:'2026-11-30',days:[{day:'2026-11-30',state:'missed',final:false}]});
assert.equal(empty.participations,0);assert.equal(empty.days[6].state,'future','missing days are never invented as played');
assert.equal(summarizeWeek({monday:'2026-11-30',days:[{day:'2026-11-30',state:'weird',run:run(1),general_rank:1}]}).days[0].state,'missed','unknown states are not shown as played');

assert.deepEqual(weekNavigation('2026-11-23','2026-11-25'),{previous:null,next:null,current:true},'no week before the first schedule week');
assert.deepEqual(weekNavigation('2026-11-30','2026-12-09'),{previous:'2026-11-23',next:'2026-12-07',current:false});
assert.deepEqual(weekNavigation('2026-12-07','2026-12-09'),{previous:'2026-11-30',next:null,current:true},'never after the current week');


const fmt=x=>Math.floor(x/60)+':'+String(x%60).padStart(2,'0');
const html=renderDailyWeek(s,{formatDuration:fmt});
assert.equal((html.match(/class="daily-week-day /g)||[]).length,7);
assert.match(html,/daily-week-day completed podium/);
assert.match(html,/daily-week-day completed provisional/);
assert.match(html,/<strong>5\/7<\/strong>/);
assert.match(html,/<strong>2e<\/strong> sur 40/);
assert.match(html,/<strong>1:35<\/strong>/);
assert.match(html,/podium général \(2e\) et 1er parmi tes amis/);
assert.match(html,/Classements provisoires/);
assert.match(renderDailyWeek(past),/Semaine terminée : classements figés/);
assert.match(renderDailyWeek(empty),/Aucun défi du jour joué cette semaine/);
assert.equal(formatWeekRange('2026-11-30','2026-12-06'),'Semaine du 30 novembre au 6 décembre');
console.log('daily week summary: ok');

const english = {t:createTranslator({locale:'en'}).t,locale:'en'};
assert.match(renderDailyWeek(s,{...english,formatDuration:fmt}),/Best overall rank.*<strong>2nd<\/strong> of 40.*Rankings are provisional/s);
assert.match(formatWeekRange('2026-11-30','2026-12-06',english),/Week of November 30 to December 6/);
