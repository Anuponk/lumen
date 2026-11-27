import assert from 'node:assert/strict';
import {buildActivityModel,renderActivityCockpit,barChart,funnelView,pct,ratio,SIMULATED_QUOTAS,ACTIVITY_DEFAULTS} from '../src/ui/analytics-activity.js';

// #1044 Activité & Premium: missing data is never 0, today is incomplete, averages use
// the measured denominator, funnels keep their order and rates, escaping.
assert.deepEqual(SIMULATED_QUOTAS,[5,10,15,20,25,30,50]);
assert.equal(ACTIVITY_DEFAULTS.days,30);assert.equal(ACTIVITY_DEFAULTS.includeInternal,false);
assert.equal(pct(1,0),null);assert.equal(ratio(null,2),null);assert.equal(pct(1,3),33.3);
assert.equal(buildActivityModel(null).available,false);

const day=(d,x={})=>({day:d,players:0,finishers:0,started:0,startedNew:0,startedReplay:0,completed:0,completedNew:0,completedReplay:0,seconds:0,timed:0,timedPlayers:0,...x});
const activity={today:'2026-11-28',dataStart:'2026-11-26',settings:{quotas_enabled:true,quota_new_daily:15,quota_replay_daily:5,quota_threshold_constellation:4},priceCents:499,
 daily:[day('2026-11-25',{players:9}),day('2026-11-26'),day('2026-11-27',{players:3,started:5,startedNew:4,startedReplay:1,completed:3,seconds:3600,timed:3,timedPlayers:3,newLimit:15,replayLimit:5,reachNew:1}),
  day('2026-11-28',{players:1,started:1,startedNew:1})],
 time:{completed:4,timed:3},behaviour:{playerDays:6,players:4,mean:1.3,median:1,p75:2,p90:2,p95:2,meanNew:1,meanReplay:0.3,
  distribution:[{bucket:'0',count:1},{bucket:'1-5',count:5},{bucket:'6-10',count:0},{bucket:'11-15',count:0},{bucket:'16-20',count:0},{bucket:'21-30',count:0},{bucket:'31+',count:0}]},
 premium:{freePlayers:3,premiumPlayers:1,freePastThreshold:2,subject:{playerDays:4,players:2},observed:{daysReachNew:1,daysReachReplay:1,daysReachAny:2,playersReachNew:1,playersReachReplay:1}}};
const conversion={today:'2026-11-28',eventsStart:'2026-11-27',windowDays:7,
 daily:[{day:'2026-11-26',opens:0,purchases:1},{day:'2026-11-27',opens:3,visitors:3,ctas:3,purchases:1,blocksNew:2,blocksReplay:1}],
 shop:{opens:3,visitors:3,ctas:3,ctaPlayers:3,checkouts:2,purchases:2,origins:{quota_new:{opens:1,visitors:1},'<x>':{opens:1,visitors:1}}},
 limits:{blocksNew:2,blocksReplay:1,shownNew:1,shownReplay:1,blockedPlayers:2,blockedPlayerDays:2},
 funnelBlocked:{active:4,blocked:2,shop:2,cta:2,checkout:2,purchase:1},funnelShop:{visitors:3,cta:3,checkout:2,purchase:1,purchasesWithoutVisit:1},
 attribution:[{origin:'quota_replay',channel:'play',purchases:1},{origin:'unattributed',channel:'web',purchases:1}],
 retention:{blocked:{playerDays:2,j1:50,j7Eligible:0,j7:null},reference:{playerDays:3,j1:66.7}}};
const m=buildActivityModel(activity,conversion,{coverage:{userDays:4},simulation:[{newQuota:15,players:2,playersNeverReaching:1,pctDaysReachNew:25}]});
assert.equal(m.days[0].players,null,'before the coverage start: not measured, never 0');
assert.equal(m.days[1].players,0,'inside the coverage: a measured zero');
assert.equal(m.days[2].minutes,60);assert.equal(m.days[2].avgMinutes,20,'3 players at 10/20/30 min = 60 min, 20 min per player');
assert.equal(m.days[2].avgStarted,1.7);assert.equal(m.days[3].partial,true);
assert.equal(m.coverage.rate,75);
assert.equal(m.premium.reachNewRate,25);assert.equal(m.premium.reachAnyRate,50);
assert.equal(m.shopDays[0].opens,null,'shop not measured before its own start');assert.equal(m.shopDays[0].purchases,1,'purchases come from the server registry');
assert.equal(m.shop.opensPerVisitor,1);assert.equal(m.shop.conversion,66.7);
assert.deepEqual(m.funnelBlocked.map(s=>s.value),[4,2,2,2,2,1]);
assert.equal(m.funnelBlocked[1].ofInitial,50);assert.equal(m.funnelBlocked[5].pass,50);assert.equal(m.funnelBlocked[5].drop,50);
assert.equal(m.funnelShop[0].pass,null);

const svg=barChart({id:'x',title:'T<>',rows:m.days,series:[{key:'players',label:'Joueurs',tone:'a'}]});
assert.match(svg,/non mesuré/);assert.match(svg,/incomplet/);assert.doesNotMatch(svg,/T<>/);
assert.match(funnelView('F',m.funnelShop),/passage 100 %/);

const host={innerHTML:'',querySelector:()=>null};
renderActivityCockpit(host,{activity,conversion,simulation:{simulation:[{newQuota:15,players:2,playersNeverReaching:1,pctDaysReachNew:25,pctDaysReachAny:50,pctAttemptsBeyond:10}],coverage:{userDays:4}}});
for(const text of ['Activité','Temps de jeu et comportement','Quotas Gratuit / Premium','Conversion et fidélisation','15 (en vigueur)','Conversion après blocage',
 'Conversion générale de la boutique','Limite de rejeux','Sans visite mesurée','Corrélation, pas causalité','censurée','25/12/2026','invités ne sont pas observables'])
 assert.ok(host.innerHTML.includes(text),text);
assert.ok(!host.innerHTML.includes('<x>'),'escaped');
renderActivityCockpit(host,{activity:null});
assert.match(host.innerHTML,/pas une absence d’activité/);
renderActivityCockpit(host,{activity,conversion:null});
assert.match(host.innerHTML,/Source de conversion indisponible/);
console.log('analytics-activity-tests passed');
