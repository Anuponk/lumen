import assert from 'node:assert/strict';
import {formatDailyDate,formatRemaining,formatRank,dailyErrorMessage,renderDailyBoard} from '../src/ui/daily-view.js';
import {createTranslator} from '../src/ui/i18n.js';
import {createDailyClient} from '../src/campaign/daily-challenge.js';

// #882 Lot 3 PR B: daily presentation and client contract.
assert.equal(formatDailyDate('2026-11-23'),'lundi 23 novembre');
assert.equal(formatDailyDate('2027-03-28'),'dimanche 28 mars');
assert.equal(formatRemaining(5*3600000+12*60000+59000),'5 h 12');
assert.equal(formatRemaining(9*60000),'9 min');
assert.equal(formatRemaining(-5),'moins d’une minute');
assert.equal(formatRank(1),'1er');assert.equal(formatRank(3),'3e');
assert.match(dailyErrorMessage(new Error('account_required')),/entraînement non classé/);
assert.match(dailyErrorMessage('anything'),/indisponible/);

const fmt=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
const general={participants:12,top:[{nickname:'Ana',score:95,rank:1},{nickname:'Bo<b>',score:95,rank:1},{nickname:'Cy',score:120,rank:3}],me:{rank:5,score:150}};
const html=renderDailyBoard(general,{formatDuration:fmt});
// #974: shared LUMEN podium (2 – 1 – 3), ties keep their shared rank, names escaped.
assert.match(html,/ranking-step-2[^>]*><span class="lumen-medal"[^>]*><span class="lumen-medal-rank">1<\/span>.*Bo&lt;b&gt;.*ranking-step-1.*>1<\/span>.*Ana.*ranking-step-3.*>3<\/span>.*Cy/s,'ties share a rank, names escaped');
assert.match(html,/lumen-my-position.*Ta position.*lumen-rank">5<.*2:30/s,'my position outside the top 3');
assert.match(html,/12 participants/);
assert.doesNotMatch(renderDailyBoard({...general,me:{rank:2,score:95},top:[{nickname:'Ana',score:95,rank:1},{nickname:'Moi',score:95,rank:1,mine:true}]},{formatDuration:fmt}),/Ta position/,'no duplicate line when I am in the top 3');
assert.match(renderDailyBoard({participants:3,top:[{nickname:'Ana',score:95,rank:1}],me:{rank:null,score:90}},{formatDuration:fmt}),/hors classement général/,'opted-out players are told why');
assert.match(renderDailyBoard({participants:0,top:[],me:null}),/Personne n’est encore classé/);
assert.match(renderDailyBoard({participants:0,top:[],me:null},{scope:'friends'}),/Aucun de tes amis/);
const alone=renderDailyBoard({participants:1,top:[{nickname:'Moi',score:80,rank:1,mine:true}],me:{rank:1,score:80}},{scope:'friends',formatDuration:fmt});
assert.match(alone,/Moi \(toi\).*Aucun de tes amis n’a encore joué.*1 participant parmi toi et tes amis/s,'no invented friend');

const calls=[];const client=createDailyClient({rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true},error:null}}});
// #1003: discovery asks the server (flag or preview capability decides); the
// game screen memoises the answer for the day.
await client.discover();
assert.equal(calls.pop().name,'lumen_daily_today');
await client.today();await client.begin('daily-op');await client.finish({day:'2026-11-23',operationId:'daily-op',status:'completed',seconds:120,hint:1});await client.board('2026-11-23');await client.week();
assert.deepEqual(calls.map(c=>c.name),['lumen_daily_today','lumen_daily_begin','lumen_daily_finish','lumen_daily_board','lumen_daily_week']);
assert.deepEqual(calls[2].args,{p_day:'2026-11-23',p_operation_id:'daily-op',p_status:'completed',p_seconds:120,p_hint:1,p_verify:0,p_guided:0});
assert.deepEqual(calls[4].args,{p_day:null});
await assert.rejects(()=>createDailyClient({rpc:async()=>({data:null,error:{message:'daily_disabled'}})}).today(),/daily_disabled/);
await assert.rejects(()=>createDailyClient(null).today(),/cloud_unavailable/);
console.log('daily view and client: ok');

const english = {t:createTranslator({locale:'en'}).t,locale:'en'};
assert.match(formatDailyDate('2026-11-23',english.locale),/Monday.*November/);
assert.equal(formatRank(11,english.t),'11th');
assert.match(dailyErrorMessage('account_required',english.t),/Sign in/);
assert.match(renderDailyBoard(general,{...english,formatDuration:fmt}),/Bo&lt;b&gt;.*Your position.*>5<.*2:30.*12 participants/s);
