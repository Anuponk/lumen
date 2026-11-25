import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createHmac} from 'node:crypto';

// #730: execute the real Stripe Edge handlers (checkout + webhook + shared helpers) with
// synthetic Auth, RPC and Stripe API boundaries. No network, no real keys, no SQL: the
// SQL rules (ranks, ledger, cap, test accounts) are covered by scripts/fixtures/stripe-checkout.sql.
const shared=fs.readFileSync('supabase/functions/_shared/lumen-stripe.ts','utf8').replace(/^export /gm,'');
const strip=f=>fs.readFileSync(f,'utf8').replace(/^import .* from .*;\r?\n/gm,'');
const SOURCES={checkout:shared+strip('supabase/functions/lumen-stripe-checkout/index.ts'),webhook:shared+strip('supabase/functions/lumen-stripe-webhook/index.ts')};
const KEY='sk_test_'+'S'.repeat(24),WHSEC='whsec_'+'w'.repeat(32),USER='00000000-0000-0000-0000-000000073001';
const plain=v=>JSON.parse(JSON.stringify(v)); // vm realm → this realm

function paidSession(over={}){
 return {id:'cs_test_A1',object:'checkout.session',livemode:false,mode:'payment',status:'complete',payment_status:'paid',amount_total:100,currency:'eur',
  client_reference_id:USER,metadata:{lumen_user_id:USER,lumen_product_id:'real-adventure-02'},created:1763300000,
  payment_intent:{id:'pi_A1',status:'succeeded',latest_charge:{id:'ch_A1',amount:100,amount_refunded:0,refunded:false,disputed:false,created:1763300005}},...over};
}
function fixture({fn='checkout',user={id:USER},begin={result:'reserved',reservation_id:'11111111-1111-1111-1111-111111111111',product_id:'real-adventure-02',kind:'adventure',pack_id:'real-adventure-02',amount_cents:100,currency:'EUR',superseded:null},
 sessions={cs_test_A1:paidSession()},disputes=[],stripeDown=false,createReply=null,record=null,known={},owned=[{session_id:'cs_test_A1',product_id:'real-adventure-02',status:'open'}],env={},rpcError={}}={}){
 let handler;const calls=[],logs=[];
 const createClient=(_url,key)=>key==='synthetic-public'
  ?{auth:{getUser:async token=>{calls.push({kind:'auth',token});return {data:{user},error:user?null:{message:'invalid'}}}}}
  :{rpc:async(name,args)=>{calls.push({kind:'rpc',name,args:plain(args)});
    if(rpcError[name])return {data:null,error:rpcError[name]};
    if(name==='lumen_stripe_checkout_begin')return {data:begin,error:null};
    if(name==='lumen_stripe_checkout_attach')return {data:true,error:null};
    if(name==='lumen_stripe_checkout_release')return {data:null,error:null};
    if(name==='lumen_stripe_session_by_payment_intent')return {data:known[args.p_payment_intent]||null,error:null};
    if(name==='lumen_stripe_sessions_for_user')return {data:owned.filter(s=>!args.p_session_id||s.session_id===args.p_session_id),error:null};
    if(name==='lumen_stripe_record_session')return record?record(args):{data:{result:'recorded',status:args.p_status,adventures:args.p_status==='paid'?['real-adventure-02']:[]},error:null};
    throw Error('unexpected rpc '+name)}};
 const fetch=async(url,init={})=>{
  const u=new URL(url);calls.push({kind:'stripe',method:init.method,path:u.pathname,query:u.search,body:init.body||'',headers:init.headers});
  if(stripeDown)return new Response('{"error":{}}',{status:500});
  if(init.method==='POST'&&u.pathname==='/v1/checkout/sessions')return createReply?createReply():new Response(JSON.stringify({id:'cs_test_NEW',livemode:false,url:'https://checkout.stripe.com/c/pay/cs_test_NEW',expires_at:1763301800}),{status:200});
  if(init.method==='POST'&&u.pathname.endsWith('/expire'))return new Response('{}',{status:200});
  if(u.pathname==='/v1/disputes')return new Response(JSON.stringify({data:disputes}),{status:200});
  if(u.pathname==='/v1/checkout/sessions'){const pi=u.searchParams.get('payment_intent');const found=Object.values(sessions).filter(s=>s.payment_intent?.id===pi);return new Response(JSON.stringify({data:found}),{status:200})}
  const id=decodeURIComponent(u.pathname.split('/').pop());
  return sessions[id]?new Response(JSON.stringify(sessions[id]),{status:200}):new Response('{"error":{"code":"resource_missing"}}',{status:404});
 };
 const values={SUPABASE_URL:'https://synthetic.invalid',SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',STRIPE_SECRET_KEY:KEY,STRIPE_WEBHOOK_SECRET:WHSEC,...env};
 vm.runInNewContext(SOURCES[fn],{Request,Response,URL,URLSearchParams,TextEncoder,crypto:globalThis.crypto,Uint8Array,JSON,Number,String,Date,Math,Error,Object,
  createClient,fetch,console:{error:(...a)=>logs.push(a.join(' '))},Deno:{serve:f=>{handler=f},env:{get:k=>values[k]}}});
 const checkout=({body={productId:'real-adventure-02',waiver:true},token='player-token',origin='https://lumen.nopuna.fr',method='POST'}={})=>
  handler(new Request('https://synthetic.invalid/checkout',{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
 const webhook=(event,{sign=true,secret=WHSEC,t=Math.floor(Date.now()/1000),header=null,tamper=false}={})=>{
  const raw=JSON.stringify(event),sig=createHmac('sha256',secret).update(t+'.'+raw).digest('hex');
  const h=header??(sign?'t='+t+',v1='+sig:null);
  return handler(new Request('https://synthetic.invalid/webhook',{method:'POST',headers:{'content-type':'application/json',...(h?{'stripe-signature':h}:{})},body:tamper?raw.replace('"livemode":false','"livemode":false ' ):raw}));
 };
 return {calls,logs,checkout,webhook,records:()=>calls.filter(c=>c.kind==='rpc'&&c.name==='lumen_stripe_record_session').map(c=>c.args)};
}
const event=(type,object,over={})=>({id:'evt_'+type.replace(/\W/g,''),object:'event',type,livemode:false,data:{object},...over});

// 1. Checkout session creation
test('a valid checkout is created server-side from the catalogue reservation, for the verified player only',async()=>{
 const f=fixture();const r=await f.checkout({body:{productId:'real-adventure-02',waiver:true,amount:1,price_cents:1,currency:'usd',userId:'someone-else'}});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{url:'https://checkout.stripe.com/c/pay/cs_test_NEW'});
 const begin=f.calls.find(c=>c.name==='lumen_stripe_checkout_begin');
 assert.equal(begin.args.p_user,USER);assert.equal(begin.args.p_product,'real-adventure-02');assert.deepEqual(Object.keys(begin.args).sort(),['p_livemode','p_product','p_user','p_waiver_at']);
 assert.equal(begin.args.p_livemode,false,'a test key reserves a test checkout');
 const create=f.calls.find(c=>c.kind==='stripe'&&c.path==='/v1/checkout/sessions'&&c.method==='POST');const p=new URLSearchParams(create.body);
 assert.equal(p.get('mode'),'payment');assert.equal(p.get('line_items[0][price_data][unit_amount]'),'100','price from the server reservation, never the body');
 assert.equal(p.get('line_items[0][price_data][currency]'),'eur');assert.equal(p.get('line_items[0][quantity]'),'1');
 assert.equal(p.get('client_reference_id'),USER);assert.equal(p.get('metadata[lumen_user_id]'),USER);assert.equal(p.get('payment_intent_data[metadata][lumen_product_id]'),'real-adventure-02');
 assert.match(p.get('success_url'),/^https:\/\/lumen\.nopuna\.fr\/\?lumen_checkout=success&session_id=\{CHECKOUT_SESSION_ID\}$/);
 assert.match(p.get('cancel_url'),/^https:\/\/lumen\.nopuna\.fr\//);
 assert.equal(create.headers['idempotency-key'],'lumen-checkout-11111111-1111-1111-1111-111111111111','a retried reservation never creates a second session');
 assert.equal(create.headers.authorization,'Bearer '+KEY);
 assert.equal(p.get('invoice_creation[enabled]'),'true','Stripe emails a durable confirmation (CGV §6)');
 assert.match(p.get('invoice_creation[invoice_data][footer]'),/renonciation au droit de rétractation[^]*L221-28, 13°[^]*TVA non applicable, art\. 293 B du CGI/);
 const attach=f.calls.find(c=>c.name==='lumen_stripe_checkout_attach');assert.equal(attach.args.p_session_id,'cs_test_NEW');
});
test('checkout and the durable receipt use the selected language without changing the reservation',async()=>{
 for(const [requested,locale,name] of [['en','en','Adventure'],['es','es','Aventura'],['xx','fr','Aventure']]){
  const f=fixture();
  const r=await f.checkout({body:{productId:'real-adventure-02',waiver:true,locale:requested}});
  assert.equal(r.status,200);
  const p=new URLSearchParams(f.calls.find(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST').body);
  assert.equal(p.get('locale'),locale);
  assert.equal(p.get('line_items[0][price_data][product_data][name]'),'Lumen · '+name+' 2');
  assert.equal(p.get('line_items[0][price_data][unit_amount]'),'100');
  assert.match(p.get('invoice_creation[invoice_data][footer]'),/L221-28.*293 B/);
 }
});
// 2. Unauthenticated
test('unauthenticated or invalid sessions are refused before any reservation',async()=>{
 for(const [opts,status] of [[{token:null},401],[{},401]]){
  const f=fixture({user:opts.token===null?{id:USER}:null});const r=await f.checkout(opts);assert.equal(r.status,status);
  assert(!f.calls.some(c=>c.kind==='rpc'||c.kind==='stripe'));
 }
});
// 3. Unknown product, 4. price falsification, waiver
test('unknown products, a missing waiver and malformed ids are refused; the body can never set a price',async()=>{
 let f=fixture({begin:{result:'unknown_product'}});let r=await f.checkout({body:{productId:'real-adventure-99',waiver:true}});
 assert.equal(r.status,400);assert.deepEqual(await r.json(),{error:'unknown_product'});assert(!f.calls.some(c=>c.kind==='stripe'));
 f=fixture();r=await f.checkout({body:{productId:'real-adventure-02'}});assert.equal(r.status,400);assert.deepEqual(await r.json(),{error:'waiver_required'});
 assert(!f.calls.some(c=>c.kind==='rpc'));
 f=fixture();r=await f.checkout({body:{productId:'../x',waiver:true}});assert.equal(r.status,400);
 f=fixture({begin:{result:'reserved',reservation_id:'r',product_id:'real-adventure-02',kind:'adventure',amount_cents:0,currency:'EUR'}});
 r=await f.checkout();assert.equal(r.status,503,'a non-positive server price is never sent to Stripe');assert(!f.calls.some(c=>c.kind==='stripe'));
});
test('ownership, eligibility, double clicks and abuse map to explicit refusals without a new Stripe session',async()=>{
 for(const [begin,status,body] of [[{result:'already_owned'},409,{error:'already_owned'}],[{result:'sky_after_single'},409,{error:'sky_after_single'}],[{result:'offer_changed'},409,{error:'offer_changed'}],
  [{result:'not_eligible'},403,{error:'not_eligible'}],[{result:'busy'},409,{error:'checkout_in_progress'}],[{result:'rate_limited'},429,{error:'rate_limited'}],
  [{result:'reuse',url:'https://checkout.stripe.com/c/pay/cs_test_OLD'},200,{url:'https://checkout.stripe.com/c/pay/cs_test_OLD',reused:true}]]){
  const f=fixture({begin});const r=await f.checkout();assert.equal(r.status,status);assert.deepEqual(await r.json(),body);
  assert(!f.calls.some(c=>c.kind==='stripe'),'no Stripe call for '+begin.result);
 }
});
test('a superseded unpaid session is expired at Stripe; a failed creation releases the reservation',async()=>{
 let f=fixture({begin:{result:'reserved',reservation_id:'r2',product_id:'real-sky-all',kind:'sky',pack_id:null,amount_cents:500,currency:'EUR',superseded:'cs_test_OLD'}});
 await f.checkout({body:{productId:'real-sky-all',waiver:true}});
 assert(f.calls.some(c=>c.kind==='stripe'&&c.path==='/v1/checkout/sessions/cs_test_OLD/expire'));
 assert.equal(new URLSearchParams(f.calls.find(c=>c.path==='/v1/checkout/sessions'&&c.method==='POST').body).get('line_items[0][price_data][unit_amount]'),'500');
 f=fixture({createReply:()=>new Response('{"error":{"code":"api_error"}}',{status:500})});const r=await f.checkout();
 assert.equal(r.status,502);assert(f.calls.some(c=>c.name==='lumen_stripe_checkout_release'));assert(!f.calls.some(c=>c.name==='lumen_stripe_checkout_attach'));
 f=fixture({createReply:()=>new Response(JSON.stringify({id:'cs_live_X',livemode:true,url:'https://checkout.stripe.com/c/pay/cs_live_X'}),{status:200})});
 assert.equal((await f.checkout()).status,502,'a live session is never handed to the player');
});
test('missing or publishable keys disable checkout; keys are never logged',async()=>{
 for(const k of ['','pk_test_abc','pk_live_abc','sk_other_'+'L'.repeat(24)]){
  const f=fixture({env:{STRIPE_SECRET_KEY:k}});const r=await f.checkout();assert.equal(r.status,503);
  assert(!f.calls.some(c=>c.kind==='rpc'||c.kind==='stripe'));
  if(k)assert(!f.logs.join('\n').includes(k),'key never logged');
 }
 const f=fixture();assert.equal((await f.checkout({origin:'https://evil.example'})).status,403);
});
// Real sales: a live key asks the server for a LIVE checkout; the SQL gateway refuses it
// until the owner switches 'stripe_live' on (not_eligible), and only cs_live_ sessions are handed out.
const LIVE='sk_live_'+'L'.repeat(24);
test('a live key reserves live checkouts only, refused while the server switch is off',async()=>{
 let f=fixture({env:{STRIPE_SECRET_KEY:LIVE},begin:{result:'not_eligible'}});let r=await f.checkout();
 assert.equal(r.status,403);assert.equal(f.calls.find(c=>c.name==='lumen_stripe_checkout_begin').args.p_livemode,true);
 assert(!f.calls.some(c=>c.kind==='stripe'),'switch off: no Stripe session');assert(!f.logs.join('\n').includes(LIVE));
 f=fixture({env:{STRIPE_SECRET_KEY:LIVE},createReply:()=>new Response(JSON.stringify({id:'cs_live_NEW',livemode:true,url:'https://checkout.stripe.com/c/pay/cs_live_NEW',expires_at:1763301800}),{status:200})});
 r=await f.checkout();assert.equal(r.status,200);assert.deepEqual(await r.json(),{url:'https://checkout.stripe.com/c/pay/cs_live_NEW'});
 assert.equal(f.calls.find(c=>c.name==='lumen_stripe_checkout_attach').args.p_session_id,'cs_live_NEW');
 f=fixture({env:{STRIPE_SECRET_KEY:LIVE}});r=await f.checkout();
 assert.equal(r.status,502,'a test session is never handed out with a live key');assert(f.calls.some(c=>c.name==='lumen_stripe_checkout_release'));
});
test('the webhook only accepts events and sessions of its key mode',async()=>{
 const liveSession=paidSession({id:'cs_live_L1',livemode:true});
 let f=fixture({fn:'webhook',env:{STRIPE_SECRET_KEY:LIVE},sessions:{cs_live_L1:liveSession}});
 let r=await f.webhook(event('checkout.session.completed',{id:'cs_live_L1'},{livemode:true}));
 assert.equal(r.status,200);assert.equal(f.records()[0].p_livemode,true);assert.equal(f.records()[0].p_session_id,'cs_live_L1');
 f=fixture({fn:'webhook',env:{STRIPE_SECRET_KEY:LIVE}});r=await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}));
 assert.equal(r.status,400,'a test event never reaches the live endpoint');assert.deepEqual(f.records(),[]);
 f=fixture({fn:'webhook',env:{STRIPE_SECRET_KEY:LIVE},sessions:{cs_live_L1:paidSession({id:'cs_live_L1',livemode:false})}});
 r=await f.webhook(event('checkout.session.completed',{id:'cs_live_L1'},{livemode:true}));
 assert.equal(r.status,400,'the read-back session must be live too');assert.deepEqual(f.records(),[]);
 f=fixture({fn:'webhook',env:{STRIPE_WEBHOOK_SECRET:' '+WHSEC+'\n'}});
 assert.equal((await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}))).status,200,'spaces around the configured secret are ignored');
 f=fixture({fn:'webhook'});await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}),{secret:'whsec_wrong'});
 assert.match(f.logs.join('\n'),/signature refused: mismatch/,'the refusal reason is logged');assert(!f.logs.join('\n').includes(WHSEC));
});

// 5. Webhook signature
test('webhooks without a valid Stripe signature on the raw body are refused and record nothing',async()=>{
 const e=event('checkout.session.completed',{id:'cs_test_A1'});
 for(const opts of [{sign:false},{secret:'whsec_wrong'},{t:Math.floor(Date.now()/1000)-3600},{header:'t=1,v1=zz'},{tamper:true}]){
  const f=fixture({fn:'webhook'});const r=await f.webhook(e,opts);assert.equal(r.status,400,JSON.stringify(opts));
  assert.deepEqual(f.records(),[]);assert(!f.calls.some(c=>c.kind==='stripe'));
 }
 const f=fixture({fn:'webhook',env:{STRIPE_WEBHOOK_SECRET:''}});assert.equal((await f.webhook(e)).status,503,'missing secret: Stripe retries later');
});
test('a live-mode event or a live session is refused in the test phase',async()=>{
 let f=fixture({fn:'webhook'});let r=await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'},{livemode:true}));
 assert.equal(r.status,400);assert.deepEqual(f.records(),[]);
 f=fixture({fn:'webhook',sessions:{cs_test_A1:paidSession({livemode:true})}});r=await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}));
 assert.equal(r.status,400);assert.deepEqual(f.records(),[]);
 f=fixture({fn:'webhook'});r=await f.webhook(event('checkout.session.completed',{id:'cs_live_A1'}));
 assert.equal(r.status,200);assert.deepEqual(f.records(),[],'a live session id is never looked up');
});
// 6. Paid
test('a confirmed payment is read back from Stripe and recorded with the server identity',async()=>{
 const f=fixture({fn:'webhook'});
 // The event payload lies about the amount and owner: only Stripe's read-back counts.
 const r=await f.webhook(event('checkout.session.completed',{id:'cs_test_A1',amount_total:1,metadata:{lumen_user_id:'attacker'}}));
 assert.equal(r.status,200);assert.deepEqual(await r.json(),{status:'paid'});
 assert.deepEqual(f.records(),[{p_session_id:'cs_test_A1',p_user:USER,p_product:'real-adventure-02',p_amount_cents:100,p_currency:'EUR',p_livemode:false,
  p_dispute_closed:false,p_payment_intent:'pi_A1',p_purchased_at:new Date(1763300005000).toISOString(),p_status:'paid'}]);
 const read=f.calls.find(c=>c.kind==='stripe');assert.equal(read.path,'/v1/checkout/sessions/cs_test_A1');assert.match(decodeURIComponent(read.query),/expand\[\]=payment_intent\.latest_charge/);
});
// 7. Cancelled / failed / pending / expired
test('unpaid, failed, delayed and expired sessions never record a paid state',async()=>{
 for(const [over,status] of [[{status:'complete',payment_status:'unpaid',payment_intent:{id:'pi_A1',status:'processing'}},'pending'],
  [{status:'complete',payment_status:'unpaid',payment_intent:{id:'pi_A1',status:'requires_payment_method'}},'failed'],
  [{status:'expired',payment_status:'unpaid',payment_intent:null},'expired']]){
  const f=fixture({fn:'webhook',sessions:{cs_test_A1:paidSession(over)}});await f.webhook(event('checkout.session.async_payment_failed',{id:'cs_test_A1'}));
  assert.equal(f.records()[0].p_status,status);
 }
 const f=fixture({fn:'webhook',sessions:{cs_test_A1:paidSession({status:'open',payment_status:'unpaid'})}});
 const r=await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}));assert.deepEqual(await r.json(),{status:'open'});assert.deepEqual(f.records(),[]);
});
// 8. Duplicate, 9. out of order
test('a replayed webhook records the same state again (the ledger is idempotent) and a stale event records the current truth',async()=>{
 const f=fixture({fn:'webhook'});const e=event('checkout.session.completed',{id:'cs_test_A1'});
 await f.webhook(e);await f.webhook(e);
 const [a,b]=f.records();assert.deepEqual(a,b,'same provider reference, same identity: one purchase in the ledger');
 const late=fixture({fn:'webhook',sessions:{cs_test_A1:paidSession({payment_intent:{id:'pi_A1',status:'succeeded',latest_charge:{amount:100,amount_refunded:100,refunded:true,disputed:false,created:1763300005}}})}});
 await late.webhook(event('checkout.session.completed',{id:'cs_test_A1'}));
 assert.equal(late.records()[0].p_status,'refunded','a late "completed" after a refund never grants again');
 const stale=fixture({fn:'webhook',record:()=>({data:{result:'stale',status:'refunded'},error:null})});
 const r=await stale.webhook(e);assert.deepEqual(await r.json(),{status:'refunded'});
});
// 10. Refund & disputes
test('refunds and disputes reach the ledger through the payment intent',async()=>{
 const refunded=paidSession({payment_intent:{id:'pi_A1',status:'succeeded',latest_charge:{amount:100,amount_refunded:100,refunded:true,disputed:false,created:1}}});
 let f=fixture({fn:'webhook',sessions:{cs_test_A1:refunded},known:{pi_A1:'cs_test_A1'}});
 await f.webhook(event('charge.refunded',{id:'ch_A1',payment_intent:'pi_A1'}));assert.equal(f.records()[0].p_status,'refunded');
 f=fixture({fn:'webhook',sessions:{cs_test_A1:refunded}});
 await f.webhook(event('charge.refunded',{id:'ch_A1',payment_intent:'pi_A1'}));
 assert(f.calls.some(c=>c.kind==='stripe'&&c.path==='/v1/checkout/sessions'&&/payment_intent=pi_A1/.test(c.query)),'unknown intent: found through Stripe');
 assert.equal(f.records()[0].p_status,'refunded');
 const partial=paidSession({payment_intent:{id:'pi_A1',status:'succeeded',latest_charge:{amount:500,amount_refunded:100,refunded:false,disputed:false,created:1}}});
 f=fixture({fn:'webhook',sessions:{cs_test_A1:partial},known:{pi_A1:'cs_test_A1'}});await f.webhook(event('charge.refunded',{payment_intent:'pi_A1'}));
 assert.equal(f.records()[0].p_status,'paid','a partial refund keeps the access');
 const disputed=paidSession({payment_intent:{id:'pi_A1',status:'succeeded',latest_charge:{amount:100,amount_refunded:0,refunded:false,disputed:true,created:1}}});
 for(const [dispute,status,closed] of [['needs_response','disputed',false],['under_review','disputed',false],['won','paid',true],['lost','disputed',true]]){
  f=fixture({fn:'webhook',sessions:{cs_test_A1:disputed},known:{pi_A1:'cs_test_A1'},disputes:[{status:'warning_closed',created:1},{status:dispute,created:9}]});
  await f.webhook(event('charge.dispute.closed',{id:'dp_1',payment_intent:'pi_A1'}));
  assert.equal(f.records()[0].p_status,status,dispute);assert.equal(f.records()[0].p_dispute_closed,closed,dispute);
 }
 f=fixture({fn:'webhook',sessions:{}});const r=await f.webhook(event('charge.refunded',{payment_intent:'pi_unknown'}));
 assert.equal(r.status,200);assert.deepEqual(f.records(),[],'not a Lumen checkout: ignored');
});
test('temporary failures answer 5xx so Stripe retries; conflicts are reported, never recorded elsewhere',async()=>{
 let f=fixture({fn:'webhook',stripeDown:true});assert.equal((await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}))).status,503);
 f=fixture({fn:'webhook',rpcError:{lumen_stripe_record_session:{code:'40001',message:'could not serialize'}}});
 assert.equal((await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}))).status,503);
 f=fixture({fn:'webhook',rpcError:{lumen_stripe_record_session:{code:'22023',message:'session identity conflict'}}});
 assert.equal((await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}))).status,409);
 f=fixture({fn:'webhook',record:()=>({data:{result:'unknown_session'},error:null})});
 assert.deepEqual(await (await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}))).json(),{status:'ignored'});
 f=fixture({fn:'webhook'});assert.equal((await f.webhook(event('customer.created',{id:'cus_1'}))).status,200);assert.deepEqual(f.records(),[]);
 f=fixture({fn:'webhook',env:{STRIPE_SECRET_KEY:'pk_live_x'}});
 assert.equal((await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}))).status,503,'unusable key: Stripe retries later');
 assert(!f.logs.join().includes(WHSEC));
});
test('metadata must match the Stripe client reference; another account cannot claim a session',async()=>{
 let f=fixture({fn:'webhook',sessions:{cs_test_A1:paidSession({client_reference_id:'00000000-0000-0000-0000-00000000dead'})}});
 await f.webhook(event('checkout.session.completed',{id:'cs_test_A1'}));assert.deepEqual(f.records(),[]);
 // Status after the return: the session must belong to the signed-in player.
 f=fixture({owned:[]});let r=await f.checkout({body:{mode:'status',sessionId:'cs_test_A1'}});assert.equal(r.status,404);assert.deepEqual(f.records(),[]);
 f=fixture({user:{id:'00000000-0000-0000-0000-000000000bad'}});r=await f.checkout({body:{mode:'status',sessionId:'cs_test_A1'}});
 assert.equal((await r.json()).status,'error');assert.deepEqual(f.records(),[],'metadata owner differs from the caller: nothing recorded');
});
// 15. Status after return and restore
test('after the Stripe return and on automatic restore, the server re-reads Stripe for the signed-in player only',async()=>{
 let f=fixture();let r=await f.checkout({body:{mode:'status',sessionId:'cs_test_A1'}});
 assert.deepEqual(await r.json(),{productId:'real-adventure-02',status:'paid',adventures:['real-adventure-02']});
 assert.equal(f.calls.find(c=>c.name==='lumen_stripe_sessions_for_user').args.p_user,USER);
 f=fixture();r=await f.checkout({body:{mode:'status',sessionId:'not-a-session'}});assert.equal(r.status,400);
 f=fixture({owned:[{session_id:'cs_test_A1',product_id:'real-adventure-02',status:'paid'},{session_id:'cs_test_B2',product_id:'real-adventure-03',status:'open'}],
  sessions:{cs_test_A1:paidSession(),cs_test_B2:paidSession({id:'cs_test_B2',status:'expired',payment_status:'unpaid',payment_intent:null,metadata:{lumen_user_id:USER,lumen_product_id:'real-adventure-03'}})}});
 r=await f.checkout({body:{mode:'restore'}});const body=await r.json();
 assert.deepEqual(body.results.map(x=>x.status),['expired'],'restore re-reads unsettled sessions only');
 assert(!f.calls.some(c=>c.kind==='stripe'&&c.path==='/v1/checkout/sessions/cs_test_A1'),'a settled (paid) session follows the webhook, not each sign-in');
 f=fixture({stripeDown:true});assert.equal((await f.checkout({body:{mode:'restore'}})).status,503);
});
