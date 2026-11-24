import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyPushDispatcher} from '../supabase/functions/_shared/lumen-daily-push-dispatch.js';

const time=Date.parse('2026-11-25T17:00:00Z');
const token='fixture'.repeat(6);
const valid={challengeDay:'2026-11-25',expiresAt:'2026-11-25T17:08:00Z',locale:'es',vapidPublicKey:'test-key',
 subscription:{endpoint:'https://fcm.googleapis.com/fixture'}};
const req=(query='',authorization='Bearer '+token,method='POST')=>new Request('https://edge.example/dispatch'+query,{method,headers:{Authorization:authorization}});
function setup({deliveries={a:valid},provider=async()=>201,configured=true,onlyFirst=true}={}){
 const called=[],settled=[],sent=[],used=new Set();
 const dispatch=dailyPushDispatcher({
  secret:token,configured,publicKey:'test-key',now:()=>time,
  reserve:async limit=>{called.push(['reserve',limit]);return Object.keys(deliveries)},
  start:async id=>{
   called.push(['start',id]);
   if(onlyFirst&&used.has(id))return null;
   used.add(id);
   return deliveries[id];
  },
  settle:async (id,outcome)=>settled.push([id,outcome]),
  cleanup:async()=>called.push(['cleanup']),
  send:async (...args)=>{sent.push(args);return provider(...args)},
 });
 return {dispatch,called,sent,settled};
}

test('requires a configured authenticated worker and only supports the bounded routes',async()=>{
 const f=setup();
 assert.equal((await f.dispatch(req('','Bearer wrong'))).status,401);
 assert.equal((await f.dispatch(req('','Bearer '+token,'GET'))).status,405);
 assert.equal((await f.dispatch(req('?action=cleanup&unexpected=1'))).status,400);
 assert.equal((await setup({configured:false}).dispatch(req())).status,503);
 assert.deepEqual(f.called,[]);
 assert.deepEqual(await (await f.dispatch(req('?action=cleanup'))).json(),{status:'cleaned'});
 assert.deepEqual(f.called,[['cleanup']]);
});

test('deduplicates authorization and sends a localized expiring payload with no player data',async()=>{
 const f=setup();
 const [first,second]=await Promise.all([f.dispatch(req()),f.dispatch(req())]);
 assert.equal(first.status,200);assert.equal(second.status,200);
 assert.equal(f.sent.length,1);
 const [subscription,payload,ttl]=f.sent[0];
 assert.equal(subscription.endpoint,valid.subscription.endpoint);
 assert.equal(payload.type,'daily-challenge');
 assert.equal(payload.day,'2026-11-25');
 assert.equal(payload.title,'Desafío del día');
 assert.equal(payload.expiresAt,time+480_000);
 assert.equal(ttl,480);
 assert.deepEqual(Object.keys(payload).sort(),['body','day','expiresAt','title','type']);
 assert.deepEqual(f.settled,[['a','sent']]);
});

test('skips invalid, revoked or rotated destinations and never retries a provider outcome',async()=>{
 const deliveries={
  revoked:null,
  offOrigin:{...valid,subscription:{endpoint:'https://outside.example/'}},
  rotated:{...valid,vapidPublicKey:'new-key'},
  gone:{...valid,subscription:{endpoint:'https://web.push.apple.com/gone'}},
  timeout:{...valid,subscription:{endpoint:'https://updates.push.services.mozilla.com/timeout'}},
 };
 const f=setup({deliveries,provider:async ({endpoint})=>{
  if(endpoint.endsWith('/gone'))return 410;
  throw new Error('simulated ambiguous transport');
 }});
 const result=await (await f.dispatch(req())).json();
 assert.equal(result.skipped,1);
 assert.equal(result.rejected,2);
 assert.equal(result.expired,1);
 assert.equal(result.ambiguous,1);
 assert.equal(f.sent.length,2);
 assert.deepEqual(f.settled.sort(),[['gone','expired'],['offOrigin','rejected'],['rotated','rejected'],['timeout','ambiguous']]);
 await f.dispatch(req());
 assert.equal(f.sent.length,2,'a second pass does not send another request for an already authorized claim');
});
