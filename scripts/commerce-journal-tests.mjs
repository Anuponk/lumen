import assert from 'node:assert/strict';
import {createCommerceJournal,priceFromLabel,COMMERCE_EVENT_TYPES} from '../src/analytics/commerce-journal.js';

// #1044 shop and limit journal: one visit per voluntary display (never per render),
// batched and idempotent sends, offline queue per account, no polling.
const store=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),map:m}};
let clock=Date.parse('2026-11-28T10:00:00Z'),ids=0;
const timers=[];
const make=({rpc,storage=store()}={})=>({storage,journal:createCommerceJournal({rpc,storage,now:()=>clock,randomId:()=>'evt-'+String(++ids).padStart(6,'0'),
 setTimer:fn=>{timers.push(fn);return timers.length},clearTimer:()=>{}})});

assert.deepEqual(priceFromLabel('4,99 €'),{priceCents:499,currency:'EUR'});
assert.deepEqual(priceFromLabel('€5.00'),{priceCents:500,currency:'EUR'});
assert.deepEqual(priceFromLabel('Prix indisponible'),{},'no invented price');
assert.ok(COMMERCE_EVENT_TYPES.includes('limit_shown'));

{
 const calls=[];
 const {journal,storage}=make({rpc:async(name,args)=>{calls.push({name,args});return {data:{accepted:args.p_events.length}}}});
 assert.equal(journal.openVisit({origin:'quota_new'}),null,'signed-out: nothing recorded');
 journal.use('user-1');
 const v1=journal.openVisit({origin:'quota_new',channel:'play',product:'lumen-premium',priceCents:499,currency:'EUR'});
 // A re-render of the open offer calls nothing: only an explicit second display does.
 clock+=4000;journal.cta({product:'lumen-premium'});
 clock+=1000;journal.closeVisit();journal.closeVisit();
 const v2=journal.openVisit({origin:'locked_adventure',channel:'play'});
 assert.notEqual(v1,v2,'two voluntary displays = two visits');
 const q=journal.snapshot().queue;
 assert.deepEqual(q.map(e=>e.type),['shop_open','cta_click','shop_close','shop_open']);
 assert.equal(q[1].visit,v1);assert.equal(q[1].channel,'play');assert.equal(q[2].durationMs,5000);
 assert.equal(q[0].priceCents,499);assert.equal(q[0].origin,'quota_new');
 assert.ok(storage.getItem('lumenCommerceJournalV1:user-1'),'kept offline until sent');
 // The visit close sends at once (3 events); the next display waits for the next send.
 await journal.flush();await journal.flush();
 assert.equal(calls.length,2);assert.equal(calls[0].name,'lumen_track_commerce');assert.deepEqual(calls.map(c=>c.args.p_events.length),[3,1]);
 assert.equal(journal.snapshot().queue.length,0);assert.equal(storage.getItem('lumenCommerceJournalV1:user-1'),null);
 journal.record('shop_open',{origin:'invented-origin'});
 assert.equal(journal.snapshot().queue.at(-1).origin,'other','unknown origins are normalised');
 assert.equal(journal.record('grid_tap'),null,'only significant events');
}
{
 // Batches of 20; a network error keeps the queue (retry), a 22023 settles it.
 let fail=true;const sizes=[];
 const {journal}=make({rpc:async(_,args)=>{sizes.push(args.p_events.length);return fail?{error:{code:'NETWORK'}}:{data:{}}}});
 journal.use('user-2');
 for(let i=0;i<25;i++)journal.limitBlock('new');
 await journal.flush();
 assert.equal(journal.snapshot().queue.length,25,'kept after a network error');
 fail=false;await journal.flush();
 assert.equal(sizes.at(-1),20);assert.equal(journal.snapshot().queue.length,5);
 await journal.flush();assert.equal(journal.snapshot().queue.length,0);
 const {journal:j2}=make({rpc:async()=>({error:{code:'22023'}})});
 j2.use('user-3');j2.limitShown('replay');await j2.flush();
 assert.equal(j2.snapshot().queue.length,0,'an invalid batch is not retried forever');
}
{
 // Account switch: queues never mix; the previous account's events wait for it.
 const storage=store(),sent=[];
 const {journal}=make({storage,rpc:async(_,args)=>{sent.push(...args.p_events);return {data:{}}}});
 journal.use('a');journal.limitBlock('new');
 journal.use('b');assert.equal(journal.snapshot().queue.length,0);journal.limitBlock('replay');
 journal.use('a');assert.equal(journal.snapshot().queue.length,1);assert.equal(journal.snapshot().queue[0].kind,'new');
 journal.use(null);assert.equal(journal.record('shop_open'),null);
}
{
 // Bounded queue: the oldest events go first when offline for long.
 const {journal}=make({rpc:async()=>({error:{code:'NETWORK'}})});
 journal.use('user-4');for(let i=0;i<70;i++)journal.limitBlock('new');
 assert.equal(journal.snapshot().queue.length,60);
}
console.log('commerce-journal-tests passed');
