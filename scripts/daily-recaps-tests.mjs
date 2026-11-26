import assert from 'node:assert/strict';
import {setupDailyRecaps} from '../src/ui/daily-recaps.js';
import {createDailyClient} from '../src/campaign/daily-challenge.js';
import {renderDailyBoard} from '../src/ui/daily-view.js';
import {createTranslator} from '../src/ui/i18n.js';

let current={owner:'a',client:{},day:'2026-11-30',safe:false},calls=0;
const replies=[];
const recaps=setupDailyRecaps({document:{},context:()=>current,read:()=>{calls++;return new Promise(resolve=>{replies.push(resolve)})}});
await recaps.wake();assert.equal(calls,0,'Active quests never claim a recap');
current.safe=true;
const pending=recaps.wake();await recaps.wake();assert.equal(calls,1,'Concurrent UI refreshes share one attempt');
current={...current,owner:'b'};const other=recaps.wake();assert.equal(calls,2);
replies[1](null);await other;
await recaps.wake();assert.equal(calls,2,'One bounded read per account and day');
current.day='2026-12-01';const next=recaps.wake();replies[2](null);await next;
assert.equal(calls,3,'Foreground discovery on a new day can read again');
const requests=[];
const client=createDailyClient({rpc:async(name,args)=>{requests.push({name,args});return {data:null}}});
await client.weekBoard('2026-11-23');await client.recap();
assert.deepEqual(requests,[{name:'lumen_daily_week_board',args:{p_day:'2026-11-23'}},{name:'lumen_daily_recap',args:{}}]);
const part={participants:4,top:[{nickname:'<Ana>',rank:1,points:70,played:7,score:420,mine:false}],me:{rank:4,points:28,played:7,score:840}};
for(const locale of ['fr','en','es']){
 const html=renderDailyBoard(part,{weekly:true,t:createTranslator({locale}).t});
 assert.match(html,/&lt;Ana&gt;/);assert.match(html,/70/);assert.match(html,/28/);assert.doesNotMatch(html,/<Ana>/);
 const privateHtml=renderDailyBoard({participants:0,top:[],me:{rank:null,points:14,played:7,score:420}},{weekly:true,t:createTranslator({locale}).t});
 assert.match(privateHtml,/14/,'An opted-out player can still see their own points');
}
console.log('Daily recap scheduling and weekly FR/EN/ES presentation passed');
// Complete the old request after owner B. It cannot affect its scope.
replies[0]({kind:'week',day:'2026-11-23',board:{final:true}});await pending;
await recaps.wake();assert.equal(calls,3,'A late old-owner response neither shows nor reopens a read');
